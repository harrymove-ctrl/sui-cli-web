import { SuiCliExecutor } from '../../cli/SuiCliExecutor.js';
import { sanitizeErrorMessage } from '../../utils/errorHandler.js';
import path from 'path';
import fs from 'fs/promises';

export interface VerifySourceResult {
  success: boolean;
  verified: boolean;
  output: string;
  packagePath: string;
  error?: string;
}

export interface VerifyBytecodeResult {
  success: boolean;
  output: string;
  withinLimits: boolean;
  meterUsage?: {
    current: number;
    limit: number;
  };
  error?: string;
}

export interface DecodeTransactionResult {
  success: boolean;
  decoded: object | string;
  signatureValid?: boolean;
  error?: string;
}

export class SecurityService {
  private cli: SuiCliExecutor;

  constructor() {
    this.cli = SuiCliExecutor.getInstance();
  }

  /**
   * Verify on-chain source against local Move package
   * @param packagePath Path to the Move package directory
   * @param verifyDeps Whether to verify dependencies as well
   * @param skipSource Skip source verification (only valid with verifyDeps)
   */
  public async verifySource(
    packagePath: string,
    verifyDeps: boolean = false,
    skipSource: boolean = false
  ): Promise<VerifySourceResult> {
    try {
      // Validate path exists and has Move.toml
      try {
        await fs.access(path.join(packagePath, 'Move.toml'));
      } catch {
        return {
          success: false,
          verified: false,
          output: '',
          packagePath,
          error: `Invalid package path: No Move.toml found in ${packagePath}`,
        };
      }

      // Build command args
      const args = [
        'client',
        'verify-source',
        packagePath,
      ];

      if (verifyDeps) {
        args.push('--verify-deps');
      }

      if (skipSource && verifyDeps) {
        args.push('--skip-source');
      }

      // Execute verify command with JSON output
      const output = await this.cli.execute(args, { json: true });

      // Parse JSON output to determine verification status
      try {
        const jsonData = JSON.parse(output);

        // The JSON output structure varies, but typically includes verification results
        // Check for success indicators
        const verified = jsonData.verified === true ||
                        jsonData.status === 'verified' ||
                        !jsonData.error;

        return {
          success: true,
          verified,
          output,
          packagePath,
        };
      } catch (parseError) {
        // If JSON parsing fails, check output text for verification indicators
        const verified = output.includes('Successfully verified') ||
                        output.includes('verified: true') ||
                        !output.includes('error');

        return {
          success: true,
          verified,
          output,
          packagePath,
        };
      }
    } catch (error: any) {
      console.error('[SecurityService] Verify source failed:', error);
      const errorMessage = error.message || String(error);

      // Check if the "error" is actually just lint warnings (not real errors)
      // Sui CLI exits with non-zero code even for warnings
      // Note: Sui CLI uses "Lint" (capital L) in output
      const hasOnlyWarnings = /warning\[(?:[Ll]int\s+)?W\d+\]:/.test(errorMessage) &&
                             !/error\[E\d+\]:/.test(errorMessage);

      if (hasOnlyWarnings) {
        // Check if verification actually succeeded despite warnings
        const verified = errorMessage.includes('Successfully verified') ||
                        errorMessage.includes('verified: true');
        return {
          success: true,
          verified,
          output: errorMessage,
          packagePath,
        };
      }

      return {
        success: false,
        verified: false,
        output: errorMessage,
        packagePath,
        error: 'Source verification failed',
      };
    }
  }

  /**
   * Verify bytecode meter usage for a package
   * @param packagePath Path to the Move package (optional, defaults to current dir)
   * @param modulePaths Paths to specific pre-compiled module bytecode (optional)
   * @param protocolVersion Protocol version to use (optional, defaults to latest)
   */
  public async verifyBytecode(
    packagePath?: string,
    modulePaths?: string[],
    protocolVersion?: number
  ): Promise<VerifyBytecodeResult> {
    try {
      // Validate package path if provided
      if (packagePath) {
        try {
          await fs.access(path.join(packagePath, 'Move.toml'));
        } catch {
          return {
            success: false,
            output: '',
            withinLimits: false,
            error: `Invalid package path: No Move.toml found in ${packagePath}`,
          };
        }
      }

      // Build command args
      const args = ['client', 'verify-bytecode-meter'];

      if (packagePath) {
        args.push('--package', packagePath);
      }

      if (modulePaths && modulePaths.length > 0) {
        for (const modulePath of modulePaths) {
          args.push('--module', modulePath);
        }
      }

      if (protocolVersion) {
        args.push('--protocol-version', protocolVersion.toString());
      }

      // Execute verify command with JSON output
      const output = await this.cli.execute(args, {
        json: true,
        cwd: packagePath,
      });

      // Parse JSON output for meter usage
      try {
        const jsonData = JSON.parse(output);

        // Extract meter usage information
        const withinLimits = jsonData.withinLimits === true ||
                            jsonData.success === true ||
                            !jsonData.exceeded;

        let meterUsage: { current: number; limit: number } | undefined;

        if (jsonData.meterUsage) {
          meterUsage = {
            current: jsonData.meterUsage.current || 0,
            limit: jsonData.meterUsage.limit || 0,
          };
        } else if (jsonData.current !== undefined && jsonData.limit !== undefined) {
          meterUsage = {
            current: jsonData.current,
            limit: jsonData.limit,
          };
        }

        return {
          success: true,
          output,
          withinLimits,
          meterUsage,
        };
      } catch (parseError) {
        // If JSON parsing fails, check output text
        const withinLimits = !output.includes('exceeded') &&
                            !output.includes('over limit') &&
                            (output.includes('within limits') || output.includes('success'));

        return {
          success: true,
          output,
          withinLimits,
        };
      }
    } catch (error: any) {
      console.error('[SecurityService] Verify bytecode failed:', error);
      return {
        success: false,
        output: error.message || String(error),
        withinLimits: false,
        error: 'Bytecode verification failed',
      };
    }
  }

  /**
   * Decode a transaction and optionally verify its signature
   * @param txBytes Base64 encoded transaction bytes
   * @param signature Optional signature to verify (Base64 encoded)
   * @param curEpoch Current epoch for verification (optional)
   */
  public async decodeTransaction(
    txBytes: string,
    signature?: string,
    curEpoch?: number
  ): Promise<DecodeTransactionResult> {
    try {
      // Validate base64 inputs
      if (!txBytes || !this.isValidBase64(txBytes)) {
        return {
          success: false,
          decoded: '',
          error: 'Invalid transaction bytes: must be valid Base64 encoded string',
        };
      }

      if (signature && !this.isValidBase64(signature)) {
        return {
          success: false,
          decoded: '',
          error: 'Invalid signature: must be valid Base64 encoded string',
        };
      }

      // Build command args
      const args = ['keytool', 'decode-or-verify-tx', '--tx-bytes', txBytes];

      if (signature) {
        args.push('--sig', signature);
      }

      if (curEpoch !== undefined) {
        args.push('--cur-epoch', curEpoch.toString());
      }

      // Execute decode command with JSON output
      const output = await this.cli.execute(args, { json: true });

      // Parse JSON output
      try {
        const jsonData = JSON.parse(output);

        // Determine if signature was valid (if provided)
        let signatureValid: boolean | undefined;
        if (signature) {
          signatureValid = jsonData.signatureValid === true ||
                          jsonData.verified === true ||
                          jsonData.valid === true ||
                          !jsonData.signatureError;
        }

        return {
          success: true,
          decoded: jsonData,
          signatureValid,
        };
      } catch (parseError) {
        // If JSON parsing fails, return raw output
        console.warn('[SecurityService] Could not parse decode JSON output:', parseError);
        return {
          success: true,
          decoded: output,
          signatureValid: signature ? output.includes('valid') : undefined,
        };
      }
    } catch (error: any) {
      console.error('[SecurityService] Decode transaction failed:', error);
      return {
        success: false,
        decoded: '',
        error: sanitizeErrorMessage(error),
      };
    }
  }

  /**
   * Validate if a string is valid Base64
   * @param str String to validate
   */
  private isValidBase64(str: string): boolean {
    try {
      // Check if string is valid Base64
      const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
      if (!base64Regex.test(str)) {
        return false;
      }

      // Try to decode to verify it's valid
      Buffer.from(str, 'base64');
      return true;
    } catch {
      return false;
    }
  }
}
