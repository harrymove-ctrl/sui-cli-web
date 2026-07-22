/**
 * ProcessManager - Singleton for managing long-running processes
 * Handles sui start, watch mode, and other persistent processes
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs/promises';

export type ProcessType = 'local-network' | 'watch' | 'build-stream' | 'test-stream' | 'other';
export type ProcessStatus = 'starting' | 'running' | 'stopping' | 'stopped' | 'error';

export interface ManagedProcess {
  id: string;
  type: ProcessType;
  pid: number | null;
  status: ProcessStatus;
  startTime: Date;
  command: string;
  args: string[];
  lastOutput: string[];
  exitCode: number | null;
  error?: string;
}

export interface LocalNetworkConfig {
  configDir?: string;
  forceRegenesis?: boolean;
  withFaucet?: boolean | string;
  withIndexer?: boolean | string;
  withGraphql?: boolean | string;
  envOverrides?: Record<string, string>;
}

export interface ProcessOutput {
  type: 'stdout' | 'stderr' | 'exit' | 'error';
  data?: string;
  code?: number;
  timestamp: number;
}

type Unsubscribe = () => void;

export class ProcessManager {
  private static instance: ProcessManager;
  private processes: Map<string, { process: ChildProcess; info: ManagedProcess }> = new Map();
  private eventEmitter: EventEmitter = new EventEmitter();
  private outputBufferSize: number = 1000; // Keep last 1000 lines per process

  private constructor() {
    // Cleanup on process exit
    process.on('exit', () => this.shutdownAll());
    process.on('SIGINT', () => this.shutdownAll());
    process.on('SIGTERM', () => this.shutdownAll());
  }

  public static getInstance(): ProcessManager {
    if (!ProcessManager.instance) {
      ProcessManager.instance = new ProcessManager();
    }
    return ProcessManager.instance;
  }

  /**
   * Generate unique process ID
   */
  private generateId(): string {
    return `proc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Start a generic process
   */
  async startProcess(
    type: ProcessType,
    command: string,
    args: string[],
    options?: {
      cwd?: string;
      env?: Record<string, string>;
    }
  ): Promise<string> {
    const id = this.generateId();

    const info: ManagedProcess = {
      id,
      type,
      pid: null,
      status: 'starting',
      startTime: new Date(),
      command,
      args,
      lastOutput: [],
      exitCode: null,
    };

    const proc = spawn(command, args, {
      cwd: options?.cwd,
      env: { ...process.env, ...options?.env },
      stdio: ['pipe', 'pipe', 'pipe'],
      detached: false,
    });

    info.pid = proc.pid || null;
    info.status = 'running';

    // Handle stdout
    proc.stdout?.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n').filter(l => l.trim());
      lines.forEach(line => {
        // Keep buffer limited
        if (info.lastOutput.length >= this.outputBufferSize) {
          info.lastOutput.shift();
        }
        info.lastOutput.push(line);

        this.eventEmitter.emit(`output:${id}`, {
          type: 'stdout',
          data: line,
          timestamp: Date.now(),
        } as ProcessOutput);
      });
    });

    // Handle stderr
    proc.stderr?.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n').filter(l => l.trim());
      lines.forEach(line => {
        if (info.lastOutput.length >= this.outputBufferSize) {
          info.lastOutput.shift();
        }
        info.lastOutput.push(`[stderr] ${line}`);

        this.eventEmitter.emit(`output:${id}`, {
          type: 'stderr',
          data: line,
          timestamp: Date.now(),
        } as ProcessOutput);
      });
    });

    // Handle process exit
    proc.on('close', (code) => {
      info.status = code === 0 ? 'stopped' : 'error';
      info.exitCode = code;

      this.eventEmitter.emit(`output:${id}`, {
        type: 'exit',
        code,
        timestamp: Date.now(),
      } as ProcessOutput);

      // Keep process info for a while after exit
      setTimeout(() => {
        this.processes.delete(id);
      }, 60000); // Keep for 1 minute
    });

    // Handle process errors
    proc.on('error', (err) => {
      info.status = 'error';
      info.error = err.message;

      this.eventEmitter.emit(`output:${id}`, {
        type: 'error',
        data: err.message,
        timestamp: Date.now(),
      } as ProcessOutput);
    });

    this.processes.set(id, { process: proc, info });

    return id;
  }

  /**
   * Start local Sui network
   */
  async startLocalNetwork(config: LocalNetworkConfig = {}): Promise<string> {
    // Check if network is already running
    const existing = this.getProcessesByType('local-network').find(p => p.status === 'running');
    if (existing) {
      throw new Error(`Local network already running with ID: ${existing.id}`);
    }

    const args: string[] = ['start'];

    if (config.configDir) {
      args.push('--network.config', config.configDir);
    }

    if (config.forceRegenesis) {
      args.push('--force-regenesis');
    }

    if (config.withFaucet) {
      if (typeof config.withFaucet === 'string') {
        args.push(`--with-faucet=${config.withFaucet}`);
      } else {
        args.push('--with-faucet');
      }
    }

    if (config.withIndexer) {
      if (typeof config.withIndexer === 'string') {
        args.push(`--with-indexer=${config.withIndexer}`);
      } else {
        args.push('--with-indexer');
      }
    }

    if (config.withGraphql) {
      if (typeof config.withGraphql === 'string') {
        args.push(`--with-graphql=${config.withGraphql}`);
      } else {
        args.push('--with-graphql');
      }
    }

    // Build environment with protocol config overrides
    const env: Record<string, string> = {};
    if (config.envOverrides && Object.keys(config.envOverrides).length > 0) {
      env['SUI_PROTOCOL_CONFIG_OVERRIDE_ENABLE'] = '1';
      for (const [key, value] of Object.entries(config.envOverrides)) {
        env[`SUI_PROTOCOL_CONFIG_OVERRIDE_${key}`] = value;
      }
    }

    return this.startProcess('local-network', 'sui', args, { env });
  }

  /**
   * Stop a process by ID
   */
  async stopProcess(id: string): Promise<void> {
    const entry = this.processes.get(id);
    if (!entry) {
      throw new Error(`Process not found: ${id}`);
    }

    if (entry.info.status !== 'running') {
      return; // Already stopped
    }

    entry.info.status = 'stopping';

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        // Force kill if not stopped after 5 seconds
        entry.process.kill('SIGKILL');
        resolve();
      }, 5000);

      entry.process.once('close', () => {
        clearTimeout(timeout);
        resolve();
      });

      // Try graceful shutdown first
      entry.process.kill('SIGTERM');
    });
  }

  /**
   * Get process status by ID
   */
  getProcessStatus(id: string): ManagedProcess | undefined {
    return this.processes.get(id)?.info;
  }

  /**
   * Get all processes
   */
  getAllProcesses(): ManagedProcess[] {
    return Array.from(this.processes.values()).map(e => e.info);
  }

  /**
   * Get processes by type
   */
  getProcessesByType(type: ProcessType): ManagedProcess[] {
    return this.getAllProcesses().filter(p => p.type === type);
  }

  /**
   * Subscribe to process output
   */
  subscribe(id: string, callback: (output: ProcessOutput) => void): Unsubscribe {
    const handler = callback;
    this.eventEmitter.on(`output:${id}`, handler);
    return () => this.eventEmitter.off(`output:${id}`, handler);
  }

  /**
   * Get recent output for a process
   */
  getRecentOutput(id: string, lines: number = 100): string[] {
    const entry = this.processes.get(id);
    if (!entry) return [];
    return entry.info.lastOutput.slice(-lines);
  }

  /**
   * Check if local network is healthy
   */
  async checkNetworkHealth(): Promise<{
    running: boolean;
    processId?: string;
    rpcUrl?: string;
    faucetUrl?: string;
  }> {
    const networkProcess = this.getProcessesByType('local-network').find(p => p.status === 'running');

    if (!networkProcess) {
      return { running: false };
    }

    // Try to connect to local RPC
    try {
      const response = await fetch('http://127.0.0.1:9000', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'sui_getLatestCheckpointSequenceNumber',
          params: [],
        }),
      });

      if (response.ok) {
        return {
          running: true,
          processId: networkProcess.id,
          rpcUrl: 'http://127.0.0.1:9000',
          faucetUrl: 'http://127.0.0.1:9123',
        };
      }
    } catch {
      // Network not responding yet
    }

    return {
      running: true,
      processId: networkProcess.id,
    };
  }

  /**
   * Shutdown all managed processes
   */
  async shutdownAll(): Promise<void> {
    const promises = Array.from(this.processes.keys()).map(id =>
      this.stopProcess(id).catch(() => {}) // Ignore errors during shutdown
    );
    await Promise.all(promises);
  }

  /**
   * Send input to a process (for interactive mode)
   */
  sendInput(id: string, input: string): void {
    const entry = this.processes.get(id);
    if (entry && entry.process.stdin) {
      entry.process.stdin.write(input + '\n');
    }
  }
}
