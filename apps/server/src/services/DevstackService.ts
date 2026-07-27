/**
 * Reads a devstack project the user already runs and makes it usable from
 * Sui CLI Web.
 *
 * The unit of truth is `.devstack/stacks/<stack>/deployment.json`, which
 * devstack writes on every `up`/`apply`: RPC, faucet and GraphQL endpoints,
 * the chain id, published package ids, and the addresses of the named accounts
 * it funded. That file is a stable, documented artifact - `devstack status`
 * by contrast reports the *live supervisor's* projection and reads `present:
 * false` after a one-shot `apply`, which would look like "no stack" for a
 * stack that exists on disk. So the file leads and status only annotates.
 */

import type {
  DevstackCapabilities,
  DevstackDeployment,
  DevstackDoctorReport,
  DevstackNetwork,
} from '@sui-cli-web/shared';
import { readFile, stat } from 'fs/promises';
import { join, normalize, resolve } from 'path';
import {
  DevstackCommandError,
  DevstackExecutor,
  DevstackNotInstalledError,
} from '../cli/DevstackExecutor';
import { isProjectPathAllowed } from '../utils/pathSafety';
import { EnvironmentService } from './EnvironmentService';

/** Devstack declares engines.node >= 24; this server only requires >= 18. */
const REQUIRED_NODE_MAJOR = 24;

interface DoctorData {
  reports: Array<{
    name: string;
    description: string;
    required: boolean;
    outcome: { status: string; detail: string };
  }>;
}

interface ConfigData {
  resolvedConfigPath: string;
  app: string;
  stack: string;
  stateDir: string;
  network: string | null;
}

/** Raw shape of deployment.json - only the fields we rely on. */
interface RawDeployment {
  defaultNetwork?: string;
  networks?: Record<
    string,
    {
      network?: string;
      rpc?: string;
      chainId?: string;
      faucet?: string;
      graphql?: string;
      local?: boolean;
      packages?: Record<string, string>;
    }
  >;
  accounts?: Record<string, string>;
}

interface CacheEntry<T> {
  value: T;
  /** Wall-clock expiry for capability probes. */
  expiresAt?: number;
  /** mtime of the source file, for deployment reads. */
  mtimeMs?: number;
}

const CAPABILITIES_TTL_MS = 30_000;

export class DevstackService {
  private static instance: DevstackService;

  private readonly executor = DevstackExecutor.getInstance();
  private readonly environments = new EnvironmentService();

  /** Keyed by project dir: probing spawns two processes, so it is worth a TTL. */
  private capabilitiesCache = new Map<string, CacheEntry<DevstackCapabilities>>();
  /** Keyed by deployment.json path and invalidated by mtime, not by clock. */
  private deploymentCache = new Map<string, CacheEntry<DevstackDeployment>>();

  public static getInstance(): DevstackService {
    if (!DevstackService.instance) {
      DevstackService.instance = new DevstackService();
    }
    return DevstackService.instance;
  }

  /**
   * Resolve and authorise a caller-supplied project directory.
   *
   * The path arrives from an HTTP request, so it is normalised and then checked
   * against the same home-scoped allowlist the filesystem browser uses. Without
   * this, `?dir=/` would let a page walk the disk looking for deployment.json.
   */
  private safeDir(dir: string): string {
    const resolved = normalize(resolve(dir));
    if (!isProjectPathAllowed(resolved)) {
      throw new Error(`Path is outside the allowed directories: ${resolved}`);
    }
    return resolved;
  }

  private nodeMeetsRequirement(): boolean {
    const major = Number.parseInt(process.versions.node.split('.')[0], 10);
    return Number.isFinite(major) && major >= REQUIRED_NODE_MAJOR;
  }

  /**
   * What can this machine do with devstack right now.
   *
   * Never throws for the ordinary case of "not installed" - that is the answer
   * for almost every user of this product, and it is not a failure.
   */
  public async getCapabilities(dir: string): Promise<DevstackCapabilities> {
    const cwd = this.safeDir(dir);

    const cached = this.capabilitiesCache.get(cwd);
    if (cached?.expiresAt && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    const node = {
      current: process.versions.node,
      meetsDevstackRequirement: this.nodeMeetsRequirement(),
    };

    const binary = this.executor.resolveBinary(cwd);
    if (!binary) {
      const value: DevstackCapabilities = {
        installed: false,
        node,
        reports: [],
        ready: false,
        blockers: ['devstack is not installed in this project or on PATH'],
      };
      this.cacheCapabilities(cwd, value);
      return value;
    }

    const blockers: string[] = [];
    if (!node.meetsDevstackRequirement) {
      blockers.push(
        `devstack requires Node >= ${REQUIRED_NODE_MAJOR}, this server runs Node ${node.current}`
      );
    }

    let reports: DevstackDoctorReport[] = [];
    try {
      const envelope = await this.executor.run<DoctorData>('doctor', [], { cwd });
      reports = (envelope.data?.reports ?? []).map((r) => ({
        name: r.name,
        description: r.description,
        required: r.required,
        status: r.outcome?.status ?? 'unknown',
        detail: r.outcome?.detail ?? '',
      }));
      for (const report of reports) {
        if (report.required && report.status !== 'ok') {
          blockers.push(`${report.description}: ${report.detail || report.status}`);
        }
      }
    } catch (error) {
      // doctor itself failing is a blocker, not a crash - report it as one.
      blockers.push(
        error instanceof DevstackCommandError
          ? `devstack doctor failed: ${error.stderr || error.message}`
          : `devstack doctor failed: ${(error as Error).message}`
      );
    }

    const value: DevstackCapabilities = {
      installed: true,
      binaryPath: binary.path,
      source: binary.source,
      version: (await this.executor.version(cwd)) ?? undefined,
      node,
      reports,
      ready: blockers.length === 0,
      blockers,
    };
    this.cacheCapabilities(cwd, value);
    return value;
  }

  private cacheCapabilities(cwd: string, value: DevstackCapabilities): void {
    this.capabilitiesCache.set(cwd, { value, expiresAt: Date.now() + CAPABILITIES_TTL_MS });
  }

  /**
   * Where devstack would put this project's state. Asking the CLI beats
   * guessing `<dir>/.devstack`: app name, stack name and state dir are all
   * overridable by config or flags.
   */
  private async resolveConfig(cwd: string): Promise<ConfigData> {
    const envelope = await this.executor.run<ConfigData>('config', [], { cwd });
    const data = envelope.data;
    if (!data?.stateDir || !data?.stack) {
      throw new Error('devstack config did not report a state directory');
    }
    return data;
  }

  /**
   * Read the deployment for a project, or null when the stack has never been
   * booted. A missing file is the normal "you have a config but have not run
   * `devstack up` yet" state, so it is not an error.
   */
  public async getDeployment(dir: string): Promise<DevstackDeployment | null> {
    const cwd = this.safeDir(dir);
    const config = await this.resolveConfig(cwd);
    const deploymentPath = join(config.stateDir, 'stacks', config.stack, 'deployment.json');

    let mtimeMs: number;
    try {
      mtimeMs = (await stat(deploymentPath)).mtimeMs;
    } catch {
      return null;
    }

    const cached = this.deploymentCache.get(deploymentPath);
    if (cached && cached.mtimeMs === mtimeMs) {
      return cached.value;
    }

    const raw = JSON.parse(await readFile(deploymentPath, 'utf-8')) as RawDeployment;

    const networks: Record<string, DevstackNetwork> = {};
    for (const [name, net] of Object.entries(raw.networks ?? {})) {
      if (!net?.rpc) continue;
      networks[name] = {
        network: net.network ?? name,
        rpc: net.rpc,
        chainId: net.chainId,
        faucet: net.faucet,
        graphql: net.graphql,
        local: net.local,
        packages: net.packages ?? {},
      };
    }

    const value: DevstackDeployment = {
      projectDir: cwd,
      app: config.app,
      stack: config.stack,
      stateDir: config.stateDir,
      defaultNetwork: raw.defaultNetwork ?? Object.keys(networks)[0] ?? 'localnet',
      networks,
      accounts: raw.accounts ?? {},
    };

    this.deploymentCache.set(deploymentPath, { value, mtimeMs });
    return value;
  }

  /**
   * Point Sui CLI Web at a devstack network.
   *
   * This writes through `sui client new-env` rather than holding the endpoint
   * in server memory, so every other feature - objects, coins, transfers, the
   * MCP server - follows automatically, and the choice survives a restart. The
   * alias is derived from the stack so re-attaching is idempotent.
   */
  public async attach(
    dir: string,
    networkName?: string
  ): Promise<{
    alias: string;
    rpc: string;
    network: string;
    reused: boolean;
  }> {
    const deployment = await this.getDeployment(dir);
    if (!deployment) {
      throw new Error('This project has no booted stack - run `devstack up` first');
    }

    const name = networkName ?? deployment.defaultNetwork;
    const network = deployment.networks[name];
    if (!network) {
      throw new Error(
        `Stack has no network "${name}" (available: ${Object.keys(deployment.networks).join(', ') || 'none'})`
      );
    }

    const alias = `devstack-${deployment.stack}`;
    const existing = await this.environments.getEnvironments();
    const match = existing.find((e: { alias: string; rpc: string }) => e.alias === alias);

    if (match && match.rpc === network.rpc) {
      await this.environments.switchEnvironment(alias);
      return { alias, rpc: network.rpc, network: name, reused: true };
    }

    // A stale alias points at a dead port from a previous boot; devstack
    // reassigns ports, so replace rather than leave the user on a dead RPC.
    if (match) {
      await this.environments.removeEnvironment(alias);
    }

    await this.environments.addEnvironment(alias, network.rpc);
    await this.environments.switchEnvironment(alias);
    return { alias, rpc: network.rpc, network: name, reused: false };
  }

  /** Exposed for tests: drop every cached probe. */
  public clearCaches(): void {
    this.capabilitiesCache.clear();
    this.deploymentCache.clear();
  }
}

export { DevstackNotInstalledError };
