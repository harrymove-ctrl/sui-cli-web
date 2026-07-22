/**
 * OutputService - Handle large outputs with file storage and streaming
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';

export interface OutputMetadata {
  type: 'trace' | 'coverage' | 'build' | 'test' | 'replay' | 'other';
  command?: string;
  digest?: string;
  packagePath?: string;
  createdAt: string;
}

export interface OutputReference {
  id: string;
  size: number;
  preview: string;
  downloadUrl: string;
  metadata: OutputMetadata;
}

export interface StoredOutput {
  metadata: OutputMetadata;
  data: string;
  createdAt: string;
}

const OUTPUT_DIR = path.join(os.homedir(), '.sui-cli-web', 'outputs');
const MAX_PREVIEW_SIZE = 2000;
const MAX_AGE_HOURS = 24;

export class OutputService {
  private static instance: OutputService;

  private constructor() {}

  public static getInstance(): OutputService {
    if (!OutputService.instance) {
      OutputService.instance = new OutputService();
    }
    return OutputService.instance;
  }

  /**
   * Ensure output directory exists
   */
  private async ensureDir(): Promise<void> {
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
  }

  /**
   * Generate unique output ID
   */
  private generateId(): string {
    return crypto.randomUUID();
  }

  /**
   * Get file path for an output ID
   */
  private getFilePath(id: string): string {
    return path.join(OUTPUT_DIR, `${id}.json`);
  }

  /**
   * Store large output to file and return reference
   */
  async storeLargeOutput(data: string, metadata: Omit<OutputMetadata, 'createdAt'>): Promise<OutputReference> {
    await this.ensureDir();

    const id = this.generateId();
    const filePath = this.getFilePath(id);
    const createdAt = new Date().toISOString();

    const fullMetadata: OutputMetadata = {
      ...metadata,
      createdAt,
    };

    const storedOutput: StoredOutput = {
      metadata: fullMetadata,
      data,
      createdAt,
    };

    await fs.writeFile(filePath, JSON.stringify(storedOutput, null, 2));

    return {
      id,
      size: data.length,
      preview: data.slice(0, MAX_PREVIEW_SIZE) + (data.length > MAX_PREVIEW_SIZE ? '...' : ''),
      downloadUrl: `/api/outputs/${id}/download`,
      metadata: fullMetadata,
    };
  }

  /**
   * Get stored output by ID
   */
  async getOutput(id: string): Promise<StoredOutput | null> {
    try {
      const filePath = this.getFilePath(id);
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content) as StoredOutput;
    } catch {
      return null;
    }
  }

  /**
   * Stream output in chunks
   */
  async *streamOutput(id: string, chunkSize: number = 64 * 1024): AsyncGenerator<string> {
    const output = await this.getOutput(id);
    if (!output) {
      throw new Error(`Output not found: ${id}`);
    }

    for (let i = 0; i < output.data.length; i += chunkSize) {
      yield output.data.slice(i, i + chunkSize);
    }
  }

  /**
   * Get output for download
   */
  async downloadOutput(id: string): Promise<{ data: Buffer; filename: string; contentType: string }> {
    const output = await this.getOutput(id);
    if (!output) {
      throw new Error(`Output not found: ${id}`);
    }

    const filename = `${output.metadata.type}_${id}.json`;

    return {
      data: Buffer.from(output.data, 'utf-8'),
      filename,
      contentType: 'application/json',
    };
  }

  /**
   * List all stored outputs
   */
  async listOutputs(): Promise<OutputReference[]> {
    await this.ensureDir();

    const files = await fs.readdir(OUTPUT_DIR);
    const outputs: OutputReference[] = [];

    for (const file of files) {
      if (!file.endsWith('.json')) continue;

      const id = file.replace('.json', '');
      try {
        const output = await this.getOutput(id);
        if (output) {
          outputs.push({
            id,
            size: output.data.length,
            preview: output.data.slice(0, MAX_PREVIEW_SIZE),
            downloadUrl: `/api/outputs/${id}/download`,
            metadata: output.metadata,
          });
        }
      } catch {
        // Skip invalid files
      }
    }

    return outputs.sort((a, b) =>
      new Date(b.metadata.createdAt).getTime() - new Date(a.metadata.createdAt).getTime()
    );
  }

  /**
   * Delete an output
   */
  async deleteOutput(id: string): Promise<void> {
    const filePath = this.getFilePath(id);
    await fs.unlink(filePath).catch(() => {});
  }

  /**
   * Cleanup old outputs
   */
  async cleanup(olderThanHours: number = MAX_AGE_HOURS): Promise<number> {
    await this.ensureDir();

    const files = await fs.readdir(OUTPUT_DIR);
    const cutoff = Date.now() - olderThanHours * 60 * 60 * 1000;
    let deleted = 0;

    for (const file of files) {
      if (!file.endsWith('.json')) continue;

      const id = file.replace('.json', '');
      try {
        const output = await this.getOutput(id);
        if (output && new Date(output.createdAt).getTime() < cutoff) {
          await this.deleteOutput(id);
          deleted++;
        }
      } catch {
        // Skip invalid files
      }
    }

    return deleted;
  }

  /**
   * Get storage stats
   */
  async getStats(): Promise<{
    totalFiles: number;
    totalSize: number;
    oldestFile?: string;
    newestFile?: string;
  }> {
    const outputs = await this.listOutputs();

    let totalSize = 0;
    for (const output of outputs) {
      totalSize += output.size;
    }

    return {
      totalFiles: outputs.length,
      totalSize,
      oldestFile: outputs[outputs.length - 1]?.metadata.createdAt,
      newestFile: outputs[0]?.metadata.createdAt,
    };
  }
}
