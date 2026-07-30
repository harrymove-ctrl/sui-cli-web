/**
 * Devstack CLI executor.
 *
 * Same shape as SuiCliExecutor - execFile with an argv array, never a shell -
 * but with three differences that come from what devstack is:
 *
 * 1. We never install it. Devstack needs Node >= 24, a Docker daemon and
 *    @mysten/sui v2 (we are on v1), and its own README says the API "can break
 *    freely" with "no deprecation cycles". Depending on it would push all of
 *    that onto every user of `npx sui-cli-web-server`. So the binary is
 *    resolved from whatever the user already has, and absence is a normal
 *    answer rather than an error.
 *
 * 2. Only read-only verbs are allowed. `up`, `apply`, `wipe` and `snapshot
 *    restore` mutate a developer's environment and, per the CLI's own schema,
 *    require Docker; exposing them over HTTP would let a page in a browser
 *    start containers. Reading is enough to be useful.
 *
 * 3. Output is a JSON envelope, not free text, and exit codes are meaningful.
 */

import type { DevstackEnvelope } from '@sui-cli-web/shared';
import { execFile } from 'child_process';
import { existsSync } from 'fs';
import { dirname, join, parse } from 'path';
import { promisify } from 'util';
import { Platform, PlatformConfig } from '../utils/platform';

const execFileAsync = promisify(execFile);

/**
 * Verbs this executor will run. Everything here is documented as
 * `lifecycle: offline` or otherwise side-effect free in `devstack schema
 * --json`, so none of them boot containers or write to a stack.
 */
const READ_ONLY_VERBS = ['doctor', 'status', 'config', 'schema'] as const;
export type DevstackVerb = (typeof READ_ONLY_VERBS)[number];

/** Documented devstack exit codes worth telling the user apart. */
export const DEVSTACK_EXIT = {
  OK: 0,
  SUPERVISOR_LIVE: 40,
  SNAPSHOT_NOT_FOUND: 41,
  USAGE: 64,
  CONFIG: 78,
} as const;

export class DevstackNotInstalledError extends Error {
  constructor() {
    super('devstack is not installed');
    this.name = 'DevstackNotInstalledError';
  }
}

export class DevstackCommandError extends Error {
  constructor(
    message: string,
    public readonly exitCode: number | undefined,
    public readonly stderr: string
  ) {
    super(message);
    this.name = 'DevstackCommandError';
  }
}

export interface DevstackRunOptions {
  /** Directory to run in - a devstack project root. */
  cwd: string;
  timeoutMs?: number;
}

export interface ResolvedBinary {
  path: string;
  /** workspace = found in a node_modules/.bin above cwd; path = found on PATH. */
  source: 'workspace' | 'path';
}

export class DevstackExecutor {
  private static instance: DevstackExecutor;

  public static getInstance(): DevstackExecutor {
    if (!DevstackExecutor.instance) {
      DevstackExecutor.instance = new DevstackExecutor();
    }
    return DevstackExecutor.instance;
  }

  private binaryName(): string {
    return Platform.isWindows() ? 'devstack.cmd' : 'devstack';
  }

  /**
   * Find the binary for a project. A devstack project installs it locally, so
   * the workspace copy is checked first and wins: it is the version that
   * matches the project's config, whereas a global install may be older.
   * Walks up from cwd because pnpm/npm workspaces hoist .bin to the repo root.
   */
  public resolveBinary(cwd: string): ResolvedBinary | null {
    const name = this.binaryName();

    let dir = cwd;
    const { root } = parse(cwd);
    while (true) {
      const candidate = join(dir, 'node_modules', '.bin', name);
      if (existsSync(candidate)) {
        return { path: candidate, source: 'workspace' };
      }
      if (dir === root) break;
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }

    for (const searchPath of PlatformConfig.getBinarySearchPaths()) {
      const candidate = join(searchPath, name);
      if (existsSync(candidate)) {
        return { path: candidate, source: 'path' };
      }
    }

    return null;
  }

  public isInstalled(cwd: string): boolean {
    return this.resolveBinary(cwd) !== null;
  }

  /**
   * Run a read-only verb and return its parsed envelope.
   *
   * Devstack prints the same envelope on failure as on success - `ok: false`
   * with a non-zero exit - so a thrown execFile error still carries usable
   * JSON on stdout, and we parse it before deciding to throw.
   */
  public async run<T = unknown>(
    verb: DevstackVerb,
    args: string[],
    options: DevstackRunOptions
  ): Promise<DevstackEnvelope<T>> {
    if (!READ_ONLY_VERBS.includes(verb)) {
      // Defence in depth: the type already forbids this, but the verb can
      // arrive from a request body that lied about its type.
      throw new DevstackCommandError(`refusing to run non-read-only verb: ${verb}`, undefined, '');
    }

    const binary = this.resolveBinary(options.cwd);
    if (!binary) {
      throw new DevstackNotInstalledError();
    }

    const finalArgs = [verb, ...args, '--json'];

    try {
      const { stdout } = await execFileAsync(binary.path, finalArgs, {
        cwd: options.cwd,
        timeout: options.timeoutMs ?? 20000,
        maxBuffer: 8 * 1024 * 1024,
        env: process.env,
      });
      return this.parseEnvelope<T>(stdout);
    } catch (error) {
      const err = error as NodeJS.ErrnoException & {
        stdout?: string;
        stderr?: string;
        code?: number | string;
      };

      // A failing check still prints an envelope; prefer it over the raw error.
      if (err.stdout) {
        try {
          return this.parseEnvelope<T>(err.stdout);
        } catch {
          // Not JSON after all - fall through to the error path.
        }
      }

      const exitCode = typeof err.code === 'number' ? err.code : undefined;
      throw new DevstackCommandError(
        `devstack ${verb} failed${exitCode !== undefined ? ` (exit ${exitCode})` : ''}`,
        exitCode,
        (err.stderr || err.message || '').trim()
      );
    }
  }

  /** Read the version without going through the envelope - `-V` prints bare text. */
  public async version(cwd: string): Promise<string | null> {
    const binary = this.resolveBinary(cwd);
    if (!binary) return null;
    try {
      const { stdout } = await execFileAsync(binary.path, ['--version'], {
        cwd,
        timeout: 10000,
        env: process.env,
      });
      return stdout.trim() || null;
    } catch {
      return null;
    }
  }

  private parseEnvelope<T>(stdout: string): DevstackEnvelope<T> {
    const trimmed = stdout.trim();
    if (!trimmed.includes('{')) {
      throw new DevstackCommandError(
        'devstack produced no JSON output',
        undefined,
        trimmed.slice(0, 500)
      );
    }

    // The CLI can emit warnings before the envelope - npm prints EBADENGINE
    // lines that themselves end in `{`, so seeking the *first* brace lands
    // inside the warning. Take the whole stream when it parses, otherwise walk
    // lines from the bottom and parse the last block that starts one: that is
    // the envelope whether it is one line or pretty-printed.
    const parsed = this.parseJsonSuffix(trimmed);
    if (parsed === undefined) {
      throw new DevstackCommandError(
        'devstack output was not valid JSON',
        undefined,
        trimmed.slice(0, 500)
      );
    }

    const envelope = parsed as Partial<DevstackEnvelope<T>>;
    if (typeof envelope?.ok !== 'boolean' || typeof envelope?.command !== 'string') {
      throw new DevstackCommandError(
        'devstack output was not a recognised envelope',
        undefined,
        trimmed.slice(0, 500)
      );
    }

    return {
      schemaVersion: envelope.schemaVersion ?? 1,
      ok: envelope.ok,
      command: envelope.command,
      elapsedMs: envelope.elapsedMs ?? 0,
      data: envelope.data as T,
    };
  }

  /** Parse the largest trailing block of `text` that is valid JSON. */
  private parseJsonSuffix(text: string): unknown | undefined {
    try {
      return JSON.parse(text);
    } catch {
      // Fall through to the line scan.
    }

    const lines = text.split('\n');
    for (let i = lines.length - 1; i >= 0; i--) {
      if (!lines[i].trimStart().startsWith('{')) continue;
      try {
        return JSON.parse(lines.slice(i).join('\n'));
      } catch {
        // Not the start of the envelope - keep walking up.
      }
    }
    return undefined;
  }
}
