/**
 * ReplayService - Enhanced transaction replay with trace support
 * Uses new `sui replay` command instead of deprecated `sui client replay-transaction`
 */

import { SuiCliExecutor } from '../../cli/SuiCliExecutor';
import { OutputService } from '../core/OutputService';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

export interface ReplayOptions {
  digest: string;
  trace?: boolean;
  showEffects?: boolean;
  outputDir?: string;
  overwrite?: boolean;
}

export interface TraceFileInfo {
  name: string;
  path: string;
  size: number;
  type: 'json' | 'log' | 'other';
}

export interface ReplayResult {
  success: boolean;
  digest: string;
  effects?: any;
  events?: any[];
  objectChanges?: any[];
  balanceChanges?: any[];
  traceDir?: string;
  traceFiles?: TraceFileInfo[];
  error?: string;
  gasUsed?: {
    computationCost: string;
    storageCost: string;
    storageRebate: string;
    nonRefundableStorageFee: string;
  };
}

export interface BatchReplayOptions {
  digests: string[];
  trace?: boolean;
  terminateEarly?: boolean;
}

export interface BatchReplayResult {
  total: number;
  successful: number;
  failed: number;
  results: ReplayResult[];
}

const TRACE_BASE_DIR = path.join(os.homedir(), '.sui-cli-web', 'traces');

export class ReplayService {
  private executor: SuiCliExecutor;
  private outputService: OutputService;

  constructor() {
    this.executor = SuiCliExecutor.getInstance();
    this.outputService = OutputService.getInstance();
  }

  /**
   * Ensure trace directory exists
   */
  private async ensureTraceDir(): Promise<void> {
    await fs.mkdir(TRACE_BASE_DIR, { recursive: true });
  }

  /**
   * Get trace directory for a specific digest
   */
  private getTraceDir(digest: string): string {
    // Sanitize digest for use as directory name
    const safeDigest = digest.replace(/[^a-zA-Z0-9]/g, '_');
    return path.join(TRACE_BASE_DIR, safeDigest);
  }

  /**
   * Replay a transaction using the new sui replay command
   */
  async replay(options: ReplayOptions): Promise<ReplayResult> {
    const { digest, trace, showEffects, outputDir, overwrite } = options;

    const args: string[] = ['replay', '-d', digest];

    // Set up trace directory if tracing is enabled
    let traceDir: string | undefined;
    if (trace) {
      await this.ensureTraceDir();
      traceDir = outputDir || this.getTraceDir(digest);
      args.push('--trace');
      args.push('-o', traceDir);
    }

    if (showEffects !== false) {
      args.push('-e', 'true');
    }

    if (overwrite) {
      args.push('--overwrite');
    }

    try {
      const output = await this.executor.execute(args, { timeout: 180000 });

      // Try to parse JSON from output
      let effects: any;
      let events: any[];
      let objectChanges: any[];
      let balanceChanges: any[];
      let gasUsed: any;

      try {
        // The output might contain JSON or might be plain text
        const jsonMatch = output.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          effects = parsed.effects;
          events = parsed.events;
          objectChanges = parsed.objectChanges;
          balanceChanges = parsed.balanceChanges;
          gasUsed = effects?.gasUsed;
        }
      } catch {
        // Output is not JSON, that's okay for replay
      }

      // Get trace files if tracing was enabled
      let traceFiles: TraceFileInfo[] | undefined;
      if (trace && traceDir) {
        traceFiles = await this.listTraceFiles(digest);
      }

      return {
        success: true,
        digest,
        effects,
        events,
        objectChanges,
        balanceChanges,
        gasUsed,
        traceDir,
        traceFiles,
      };
    } catch (error) {
      return {
        success: false,
        digest,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Replay using the legacy command (fallback)
   */
  async replayLegacy(digest: string): Promise<ReplayResult> {
    const args = ['client', 'replay-transaction', digest];

    try {
      const result = await this.executor.executeJson<any>(args, { timeout: 120000 });

      return {
        success: true,
        digest,
        effects: result.effects,
        events: result.events,
        objectChanges: result.objectChanges,
        balanceChanges: result.balanceChanges,
        gasUsed: result.effects?.gasUsed,
      };
    } catch (error) {
      return {
        success: false,
        digest,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * List trace files for a replayed transaction
   */
  async listTraceFiles(digest: string): Promise<TraceFileInfo[]> {
    const traceDir = this.getTraceDir(digest);
    const files: TraceFileInfo[] = [];

    try {
      const entries = await fs.readdir(traceDir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isFile()) {
          const filePath = path.join(traceDir, entry.name);
          const stats = await fs.stat(filePath);

          let type: 'json' | 'log' | 'other' = 'other';
          if (entry.name.endsWith('.json')) type = 'json';
          else if (entry.name.endsWith('.log')) type = 'log';

          files.push({
            name: entry.name,
            path: filePath,
            size: stats.size,
            type,
          });
        }
      }
    } catch {
      // Directory doesn't exist or is not accessible
    }

    return files;
  }

  /**
   * Get content of a specific trace file
   */
  async getTraceFile(digest: string, filename: string): Promise<string | null> {
    const traceDir = this.getTraceDir(digest);
    const filePath = path.join(traceDir, filename);

    // Security: ensure we're not escaping the trace directory
    const normalizedPath = path.normalize(filePath);
    if (!normalizedPath.startsWith(traceDir)) {
      throw new Error('Invalid file path');
    }

    try {
      return await fs.readFile(filePath, 'utf-8');
    } catch {
      return null;
    }
  }

  /**
   * Batch replay multiple transactions
   */
  async batchReplay(options: BatchReplayOptions): Promise<BatchReplayResult> {
    const { digests, trace, terminateEarly } = options;
    const results: ReplayResult[] = [];
    let successful = 0;
    let failed = 0;

    for (const digest of digests) {
      const result = await this.replay({ digest, trace });
      results.push(result);

      if (result.success) {
        successful++;
      } else {
        failed++;
        if (terminateEarly) {
          break;
        }
      }
    }

    return {
      total: digests.length,
      successful,
      failed,
      results,
    };
  }

  /**
   * Clean up old trace files
   */
  async cleanupTraces(olderThanDays: number = 7): Promise<number> {
    await this.ensureTraceDir();

    const cutoff = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;
    let deleted = 0;

    try {
      const entries = await fs.readdir(TRACE_BASE_DIR, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const dirPath = path.join(TRACE_BASE_DIR, entry.name);
          const stats = await fs.stat(dirPath);

          if (stats.mtimeMs < cutoff) {
            await fs.rm(dirPath, { recursive: true });
            deleted++;
          }
        }
      }
    } catch {
      // Ignore errors during cleanup
    }

    return deleted;
  }

  /**
   * Get trace storage stats
   */
  async getTraceStats(): Promise<{
    totalDirectories: number;
    totalSize: number;
    oldestTrace?: string;
    newestTrace?: string;
  }> {
    await this.ensureTraceDir();

    let totalDirectories = 0;
    let totalSize = 0;
    let oldestTime = Infinity;
    let newestTime = 0;
    let oldestTrace: string | undefined;
    let newestTrace: string | undefined;

    try {
      const entries = await fs.readdir(TRACE_BASE_DIR, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          totalDirectories++;
          const dirPath = path.join(TRACE_BASE_DIR, entry.name);

          // Get directory stats
          const stats = await fs.stat(dirPath);
          if (stats.mtimeMs < oldestTime) {
            oldestTime = stats.mtimeMs;
            oldestTrace = entry.name;
          }
          if (stats.mtimeMs > newestTime) {
            newestTime = stats.mtimeMs;
            newestTrace = entry.name;
          }

          // Calculate directory size
          const files = await fs.readdir(dirPath);
          for (const file of files) {
            const filePath = path.join(dirPath, file);
            const fileStats = await fs.stat(filePath);
            totalSize += fileStats.size;
          }
        }
      }
    } catch {
      // Ignore errors
    }

    return {
      totalDirectories,
      totalSize,
      oldestTrace,
      newestTrace,
    };
  }
}
