/**
 * Tests for the devstack bridge.
 *
 * The interesting behaviour is not "does it call the CLI" - it is what happens
 * in the three states almost every user is actually in: devstack absent,
 * devstack present but blocked (wrong Node, no Docker), and a project that has
 * a config but has never been booted. All three have to be ordinary answers,
 * not exceptions, or the UI shows an error toast to a user who did nothing
 * wrong. The security guard on the caller-supplied path is tested here too,
 * because that path arrives from an unauthenticated HTTP request.
 */

import { homedir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const run = vi.fn();
const resolveBinary = vi.fn();
const version = vi.fn();

vi.mock('../cli/DevstackExecutor', async () => {
  const actual =
    await vi.importActual<typeof import('../cli/DevstackExecutor')>('../cli/DevstackExecutor');
  return {
    ...actual,
    DevstackExecutor: {
      getInstance: () => ({ run, resolveBinary, version }),
    },
  };
});

const getEnvironments = vi.fn();
const addEnvironment = vi.fn();
const removeEnvironment = vi.fn();
const switchEnvironment = vi.fn();

vi.mock('../services/EnvironmentService', () => ({
  EnvironmentService: class {
    getEnvironments = getEnvironments;
    addEnvironment = addEnvironment;
    removeEnvironment = removeEnvironment;
    switchEnvironment = switchEnvironment;
  },
}));

const statMock = vi.fn();
const readFileMock = vi.fn();

vi.mock('fs/promises', () => ({
  stat: (...args: unknown[]) => statMock(...args),
  readFile: (...args: unknown[]) => readFileMock(...args),
}));

import { DevstackCommandError } from '../cli/DevstackExecutor';
import { DevstackService } from '../services/DevstackService';

const PROJECT = join(homedir(), 'projects', 'my-dapp');

const DEPLOYMENT = {
  defaultNetwork: 'localnet',
  networks: {
    localnet: {
      network: 'localnet',
      rpc: 'http://rpc.my-dapp.localhost:9000',
      chainId: 'E1QW5Dax',
      faucet: 'http://faucet.my-dapp.localhost:9123',
      graphql: 'http://graphql.my-dapp.localhost:9125',
      local: true,
      packages: { hello: '0xabc' },
    },
  },
  accounts: { alice: '0xf175', publisher: '0x0e0e' },
};

function mockConfigOk() {
  run.mockImplementation(async (verb: string) => {
    if (verb === 'config') {
      return {
        schemaVersion: 1,
        ok: true,
        command: 'config',
        elapsedMs: 0,
        data: {
          resolvedConfigPath: join(PROJECT, 'devstack.config.ts'),
          app: 'my-dapp',
          stack: 'main',
          stateDir: join(PROJECT, '.devstack'),
          network: null,
        },
      };
    }
    throw new Error(`unexpected verb ${verb}`);
  });
}

describe('DevstackService', () => {
  let service: DevstackService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = DevstackService.getInstance();
    service.clearCaches();
    resolveBinary.mockReturnValue({ path: '/usr/local/bin/devstack', source: 'path' });
    version.mockResolvedValue('0.7.2');
  });

  afterEach(() => {
    service.clearCaches();
  });

  describe('path authorisation', () => {
    it('refuses a directory outside the home tree', async () => {
      await expect(service.getCapabilities('/etc')).rejects.toThrow(/outside the allowed/);
    });

    it('refuses a traversal that escapes home', async () => {
      await expect(service.getCapabilities(join(homedir(), '..', '..', 'etc'))).rejects.toThrow(
        /outside the allowed/
      );
    });

    it('allows a project inside home', async () => {
      resolveBinary.mockReturnValue(null);
      await expect(service.getCapabilities(PROJECT)).resolves.toMatchObject({ installed: false });
    });
  });

  describe('capabilities', () => {
    it('reports absence as a normal answer, not an error', async () => {
      resolveBinary.mockReturnValue(null);

      const caps = await service.getCapabilities(PROJECT);

      expect(caps.installed).toBe(false);
      expect(caps.ready).toBe(false);
      expect(caps.blockers[0]).toMatch(/not installed/);
      // No CLI should have been invoked to learn this.
      expect(run).not.toHaveBeenCalled();
    });

    it('turns a failing required doctor check into a blocker', async () => {
      run.mockResolvedValue({
        schemaVersion: 1,
        ok: true,
        command: 'doctor',
        elapsedMs: 12,
        data: {
          reports: [
            {
              name: 'docker',
              description: 'Docker daemon reachable',
              required: true,
              outcome: { status: 'error', detail: 'daemon not running' },
            },
            {
              name: 'sui-cli',
              description: '`sui` CLI on PATH',
              required: false,
              outcome: { status: 'error', detail: 'absent' },
            },
          ],
        },
      });

      const caps = await service.getCapabilities(PROJECT);

      expect(caps.installed).toBe(true);
      expect(caps.ready).toBe(false);
      expect(caps.blockers).toContain('Docker daemon reachable: daemon not running');
      // required:false must not block - a missing sui CLI degrades, not stops.
      expect(caps.blockers.some((b) => b.includes('sui` CLI'))).toBe(false);
      expect(caps.reports).toHaveLength(2);
    });

    it('is ready when every required check passes', async () => {
      run.mockResolvedValue({
        schemaVersion: 1,
        ok: true,
        command: 'doctor',
        elapsedMs: 8,
        data: {
          reports: [
            {
              name: 'docker',
              description: 'Docker daemon reachable',
              required: true,
              outcome: { status: 'ok', detail: 'server 29.2.1' },
            },
          ],
        },
      });

      const caps = await service.getCapabilities(PROJECT);

      // This suite runs on whatever Node the developer has; only assert the
      // doctor half, and assert the Node half through blockers below.
      const dockerBlocked = caps.blockers.some((b) => b.includes('Docker'));
      expect(dockerBlocked).toBe(false);
      expect(caps.version).toBe('0.7.2');
    });

    it('reports a doctor crash as a blocker instead of throwing', async () => {
      run.mockRejectedValue(new DevstackCommandError('boom', 78, 'config error'));

      const caps = await service.getCapabilities(PROJECT);

      expect(caps.installed).toBe(true);
      expect(caps.ready).toBe(false);
      expect(caps.blockers.join(' ')).toMatch(/doctor failed.*config error/);
    });

    it('caches the probe so a polling UI does not spawn a process per second', async () => {
      run.mockResolvedValue({
        schemaVersion: 1,
        ok: true,
        command: 'doctor',
        elapsedMs: 1,
        data: { reports: [] },
      });

      await service.getCapabilities(PROJECT);
      await service.getCapabilities(PROJECT);

      expect(run).toHaveBeenCalledTimes(1);
    });
  });

  describe('deployment', () => {
    it('returns null when the stack has never been booted', async () => {
      mockConfigOk();
      statMock.mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));

      await expect(service.getDeployment(PROJECT)).resolves.toBeNull();
    });

    it('maps endpoints, packages and funded accounts', async () => {
      mockConfigOk();
      statMock.mockResolvedValue({ mtimeMs: 111 });
      readFileMock.mockResolvedValue(JSON.stringify(DEPLOYMENT));

      const deployment = await service.getDeployment(PROJECT);

      expect(deployment).not.toBeNull();
      expect(deployment?.stack).toBe('main');
      expect(deployment?.defaultNetwork).toBe('localnet');
      expect(deployment?.networks.localnet.rpc).toBe('http://rpc.my-dapp.localhost:9000');
      expect(deployment?.networks.localnet.faucet).toBe('http://faucet.my-dapp.localhost:9123');
      expect(deployment?.networks.localnet.packages).toEqual({ hello: '0xabc' });
      expect(deployment?.accounts).toEqual({ alice: '0xf175', publisher: '0x0e0e' });
    });

    it('drops a network with no rpc rather than surfacing an unusable entry', async () => {
      mockConfigOk();
      statMock.mockResolvedValue({ mtimeMs: 222 });
      readFileMock.mockResolvedValue(
        JSON.stringify({
          networks: { broken: { network: 'broken' }, localnet: DEPLOYMENT.networks.localnet },
        })
      );

      const deployment = await service.getDeployment(PROJECT);

      expect(Object.keys(deployment?.networks ?? {})).toEqual(['localnet']);
    });

    it('re-reads the file when it changes and not before', async () => {
      mockConfigOk();
      statMock.mockResolvedValue({ mtimeMs: 100 });
      readFileMock.mockResolvedValue(JSON.stringify(DEPLOYMENT));

      await service.getDeployment(PROJECT);
      await service.getDeployment(PROJECT);
      expect(readFileMock).toHaveBeenCalledTimes(1);

      // A reboot rewrites deployment.json with new ports; mtime is what tells us.
      statMock.mockResolvedValue({ mtimeMs: 200 });
      await service.getDeployment(PROJECT);
      expect(readFileMock).toHaveBeenCalledTimes(2);
    });
  });

  describe('attach', () => {
    beforeEach(() => {
      mockConfigOk();
      statMock.mockResolvedValue({ mtimeMs: 1 });
      readFileMock.mockResolvedValue(JSON.stringify(DEPLOYMENT));
    });

    it('registers the stack rpc as a sui env and switches to it', async () => {
      getEnvironments.mockResolvedValue([{ alias: 'testnet', rpc: 'https://x' }]);

      const result = await service.attach(PROJECT);

      expect(addEnvironment).toHaveBeenCalledWith(
        'devstack-main',
        'http://rpc.my-dapp.localhost:9000'
      );
      expect(switchEnvironment).toHaveBeenCalledWith('devstack-main');
      expect(result).toMatchObject({ alias: 'devstack-main', network: 'localnet', reused: false });
    });

    it('reuses an unchanged alias instead of recreating it', async () => {
      getEnvironments.mockResolvedValue([
        { alias: 'devstack-main', rpc: 'http://rpc.my-dapp.localhost:9000' },
      ]);

      const result = await service.attach(PROJECT);

      expect(result.reused).toBe(true);
      expect(addEnvironment).not.toHaveBeenCalled();
      expect(removeEnvironment).not.toHaveBeenCalled();
      expect(switchEnvironment).toHaveBeenCalledWith('devstack-main');
    });

    it('replaces an alias left pointing at a dead port by an earlier boot', async () => {
      getEnvironments.mockResolvedValue([
        { alias: 'devstack-main', rpc: 'http://rpc.my-dapp.localhost:9001' },
      ]);

      await service.attach(PROJECT);

      expect(removeEnvironment).toHaveBeenCalledWith('devstack-main');
      expect(addEnvironment).toHaveBeenCalledWith(
        'devstack-main',
        'http://rpc.my-dapp.localhost:9000'
      );
    });

    it('refuses a network the stack does not have, naming what it does have', async () => {
      getEnvironments.mockResolvedValue([]);

      await expect(service.attach(PROJECT, 'mainnet')).rejects.toThrow(/localnet/);
      expect(addEnvironment).not.toHaveBeenCalled();
    });

    it('refuses to attach a project that was never booted', async () => {
      statMock.mockRejectedValue(new Error('ENOENT'));

      await expect(service.attach(PROJECT)).rejects.toThrow(/devstack up/);
    });
  });
});
