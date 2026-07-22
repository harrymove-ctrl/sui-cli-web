import { execFile } from 'child_process';
import { promisify } from 'util';
import { AnalyticsService } from '../services/core/AnalyticsService';
import { Platform, PlatformConfig } from '../utils/platform';

const execAsync = promisify(execFile);

export interface ExecuteOptions {
  json?: boolean;
  cwd?: string;
  timeout?: number;
}

export class SuiCliExecutor {
  private static instance: SuiCliExecutor;
  private analytics: AnalyticsService;

  private constructor() {
    this.analytics = AnalyticsService.getInstance();
  }

  /**
   * Remove ANSI color codes from terminal output
   * ANSI codes like [0m, [34m, [1;31m make output hard to read in UI
   */
  private stripAnsiCodes(text: string): string {
    // eslint-disable-next-line no-control-regex
    return text.replace(/\x1b\[[0-9;]*m/g, '');
  }

  public static getInstance(): SuiCliExecutor {
    if (!SuiCliExecutor.instance) {
      SuiCliExecutor.instance = new SuiCliExecutor();
    }
    return SuiCliExecutor.instance;
  }

  private getPaths(): string[] {
    // Use platform-aware binary search paths
    return PlatformConfig.getBinarySearchPaths();
  }

  public async execute(args: string[], options?: ExecuteOptions): Promise<string> {
    const pathSeparator = Platform.getPathSeparator();
    const customPaths = this.getPaths();

    const env = {
      ...process.env,
      PATH: `${customPaths.join(pathSeparator)}${pathSeparator}${process.env.PATH || ''}`,
    };

    const finalArgs = options?.json ? [...args, '--json'] : args;
    const execOptions = {
      env,
      cwd: options?.cwd,
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      timeout: options?.timeout || 60000, // 60s default timeout
    };

    const command = Platform.isWindows() ? 'sui.exe' : 'sui';
    const startTime = Date.now();

    try {
      const { stdout, stderr } = await execAsync(command, finalArgs, execOptions);
      const duration = Date.now() - startTime;

      // Track success
      this.analytics.track({
        type: 'command_success',
        command: args[0], // e.g., 'client', 'move'
        duration,
        metadata: { fullArgs: args },
      });

      if (stdout.trim()) {
        return stdout.trim();
      }
      return stderr.trim();
    } catch (error: any) {
      const duration = Date.now() - startTime;
      // Prioritize stderr (has detailed error), fallback to stdout, then message
      const rawOutput = error.stderr || error.stdout || error.message || String(error);
      // Strip ANSI color codes for cleaner UI display
      const errorOutput = this.stripAnsiCodes(rawOutput);

      // Track error
      this.analytics.track({
        type: 'command_error',
        command: args[0],
        duration,
        error: errorOutput,
        metadata: { fullArgs: args },
      });

      // Throw with the cleaned output so UI can display it properly
      const err: any = new Error(errorOutput);
      err.stderr = error.stderr ? this.stripAnsiCodes(error.stderr) : undefined;
      err.stdout = error.stdout ? this.stripAnsiCodes(error.stdout) : undefined;
      throw err;
    }
  }

  public async executeJson<T>(args: string[], options?: Omit<ExecuteOptions, 'json'>): Promise<T> {
    const output = await this.execute(args, { ...options, json: true });
    try {
      // Extract JSON from output (may contain build logs before JSON)
      const jsonMatch = output.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('No JSON found in output');
      }
      return JSON.parse(jsonMatch[0]) as T;
    } catch (error: any) {
      throw new Error(`Failed to parse JSON output: ${error.message}\n\nOutput:\n${output.substring(0, 500)}`);
    }
  }

  public async checkInstallation(): Promise<{ installed: boolean; version?: string }> {
    try {
      const output = await this.execute(['--version']);
      const versionMatch = output.match(/sui (\d+\.\d+\.\d+)/i);
      return {
        installed: true,
        version: versionMatch ? versionMatch[1] : output,
      };
    } catch {
      return { installed: false };
    }
  }
}
