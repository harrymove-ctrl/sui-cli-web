import { SuiCliExecutor } from '../cli/SuiCliExecutor';
import { ConfigParser } from '../cli/ConfigParser';
import { sanitizeErrorMessage } from '../utils/errorHandler';

// Security constants
const EXPORT_CONFIRMATION_CODE = 'EXPORT MY KEY';
const MAX_EXPORTS_PER_HOUR = 3;
const EXPORT_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

// Rate limiting for exports
interface ExportRateLimitEntry {
  count: number;
  windowStart: number;
}
const exportRateLimits = new Map<string, ExportRateLimitEntry>();

export const EXPORT_WARNING = `
⚠️ CRITICAL SECURITY WARNING ⚠️

Your private key provides COMPLETE ACCESS to your wallet.

NEVER share it with:
- Anyone asking for help
- Any website or app
- Customer support (real support NEVER asks for keys)

IF SOMEONE HAS YOUR KEY:
- They can steal ALL your funds
- You CANNOT undo this
- There is NO customer support to help

ONLY export if you:
- Are backing up your wallet
- Know exactly what you're doing
- Are storing it securely (password manager, hardware wallet)

Type "EXPORT MY KEY" to confirm you understand these risks.
`;

export interface ExportKeyResult {
  success: boolean;
  privateKey?: string;
  keyScheme?: string;
  publicKey?: string;
  warning?: string;
  error?: string;
}

export interface ImportKeyResult {
  success: boolean;
  address?: string;
  alias?: string;
  error?: string;
}

export class KeyManagementService {
  private executor: SuiCliExecutor;
  private configParser: ConfigParser;

  constructor() {
    this.executor = SuiCliExecutor.getInstance();
    this.configParser = ConfigParser.getInstance();
  }

  /**
   * Export private key for an address
   * @param addressOrAlias Address or alias to export key for
   * @param confirmationCode Must be exactly "EXPORT MY KEY"
   */
  public async exportPrivateKey(
    addressOrAlias: string,
    confirmationCode: string
  ): Promise<ExportKeyResult> {
    try {
      // Validate confirmation code
      if (confirmationCode !== EXPORT_CONFIRMATION_CODE) {
        return {
          success: false,
          error: 'Invalid confirmation code. You must type "EXPORT MY KEY" exactly.',
        };
      }

      // Check rate limiting
      const rateLimitCheck = this.checkExportRateLimit(addressOrAlias);
      if (!rateLimitCheck.allowed) {
        return {
          success: false,
          error: rateLimitCheck.error,
        };
      }

      // Execute keytool export
      const args = ['keytool', 'export', '--key-identity', addressOrAlias];
      const output = await this.executor.execute(args);

      // Parse output to extract key information
      const result = this.parseExportOutput(output);

      if (!result.privateKey) {
        return {
          success: false,
          error: 'Failed to parse private key from output',
        };
      }

      // Record successful export for rate limiting
      this.recordExport(addressOrAlias);

      // NEVER log private keys or sensitive data
      console.log(`[KeyManagementService] Private key exported for address: ${addressOrAlias}`);

      return {
        success: true,
        privateKey: result.privateKey,
        keyScheme: result.keyScheme,
        publicKey: result.publicKey,
        warning: EXPORT_WARNING,
      };
    } catch (error) {
      console.error('[KeyManagementService] Export private key failed:', error);
      return {
        success: false,
        error: sanitizeErrorMessage(error),
      };
    }
  }

  /**
   * Import private key from mnemonic phrase
   * @param mnemonic Mnemonic phrase (12, 15, 18, 21, or 24 words)
   * @param keyScheme Key scheme to use
   * @param alias Optional alias for the address
   */
  public async importFromMnemonic(
    mnemonic: string,
    keyScheme: 'ed25519' | 'secp256k1' | 'secp256r1',
    alias?: string
  ): Promise<ImportKeyResult> {
    try {
      // Validate mnemonic (basic check - word count)
      const words = mnemonic.trim().split(/\s+/);
      const validWordCounts = [12, 15, 18, 21, 24];

      if (!validWordCounts.includes(words.length)) {
        return {
          success: false,
          error: `Invalid mnemonic word count. Expected 12, 15, 18, 21, or 24 words, got ${words.length}`,
        };
      }

      // Build command
      const args = ['keytool', 'import', mnemonic, keyScheme];
      if (alias) {
        args.push('--alias', alias);
      }

      const output = await this.executor.execute(args);

      // Parse output to extract address
      const addressMatch = output.match(/0x[a-fA-F0-9]{64}/);

      if (!addressMatch) {
        return {
          success: false,
          error: 'Import completed but could not extract address from output',
        };
      }

      // NEVER log mnemonics or private keys
      console.log(`[KeyManagementService] Successfully imported address: ${addressMatch[0]}`);

      return {
        success: true,
        address: addressMatch[0],
        alias,
      };
    } catch (error) {
      console.error('[KeyManagementService] Import from mnemonic failed:', error);
      return {
        success: false,
        error: sanitizeErrorMessage(error),
      };
    }
  }

  /**
   * Import private key from encoded private key string
   * @param privateKey Private key string (Bech32 starting with "suiprivkey")
   * @param keyScheme Key scheme to use
   * @param alias Optional alias for the address
   */
  public async importFromPrivateKey(
    privateKey: string,
    keyScheme: 'ed25519' | 'secp256k1' | 'secp256r1',
    alias?: string
  ): Promise<ImportKeyResult> {
    try {
      // Validate private key format
      if (!privateKey.startsWith('suiprivkey')) {
        return {
          success: false,
          error: 'Invalid private key format. Expected Bech32 string starting with "suiprivkey"',
        };
      }

      // Build command
      const args = ['keytool', 'import', privateKey, keyScheme];
      if (alias) {
        args.push('--alias', alias);
      }

      const output = await this.executor.execute(args);

      // Parse output to extract address
      const addressMatch = output.match(/0x[a-fA-F0-9]{64}/);

      if (!addressMatch) {
        return {
          success: false,
          error: 'Import completed but could not extract address from output',
        };
      }

      // NEVER log private keys
      console.log(`[KeyManagementService] Successfully imported address: ${addressMatch[0]}`);

      return {
        success: true,
        address: addressMatch[0],
        alias,
      };
    } catch (error) {
      console.error('[KeyManagementService] Import from private key failed:', error);
      return {
        success: false,
        error: sanitizeErrorMessage(error),
      };
    }
  }

  /**
   * Check if address already exists in wallet
   */
  public async isAddressDuplicate(address: string): Promise<boolean> {
    try {
      const config = await this.configParser.getConfig();
      if (!config || !config.keystore) {
        return false;
      }

      // Keystore is an array of key objects
      const keystore = config.keystore as unknown as any[];
      return Array.isArray(keystore) && keystore.some((key: any) => key.suiAddress === address);
    } catch (error) {
      console.error('[KeyManagementService] Check duplicate address failed:', error);
      return false;
    }
  }

  // Private helper: Check export rate limit
  private checkExportRateLimit(addressOrAlias: string): { allowed: boolean; error?: string } {
    const now = Date.now();
    const entry = exportRateLimits.get(addressOrAlias);

    if (!entry) {
      return { allowed: true };
    }

    // Check if window has expired
    if (now - entry.windowStart > EXPORT_RATE_LIMIT_WINDOW_MS) {
      // Reset window
      exportRateLimits.set(addressOrAlias, { count: 0, windowStart: now });
      return { allowed: true };
    }

    // Check if limit exceeded
    if (entry.count >= MAX_EXPORTS_PER_HOUR) {
      const timeRemaining = Math.ceil(
        (EXPORT_RATE_LIMIT_WINDOW_MS - (now - entry.windowStart)) / 1000 / 60
      );
      return {
        allowed: false,
        error: `Rate limit exceeded. You can only export ${MAX_EXPORTS_PER_HOUR} keys per hour. Try again in ${timeRemaining} minutes.`,
      };
    }

    return { allowed: true };
  }

  // Private helper: Record export for rate limiting
  private recordExport(addressOrAlias: string): void {
    const now = Date.now();
    const entry = exportRateLimits.get(addressOrAlias);

    if (!entry || now - entry.windowStart > EXPORT_RATE_LIMIT_WINDOW_MS) {
      exportRateLimits.set(addressOrAlias, { count: 1, windowStart: now });
    } else {
      entry.count += 1;
    }
  }

  // Private helper: Parse keytool export output
  private parseExportOutput(output: string): {
    privateKey?: string;
    keyScheme?: string;
    publicKey?: string;
  } {
    const result: {
      privateKey?: string;
      keyScheme?: string;
      publicKey?: string;
    } = {};

    // Try to parse as JSON first
    try {
      const data = JSON.parse(output);
      result.privateKey = data.privateKey || data.exportedPrivateKey;
      result.keyScheme = data.keyScheme;
      result.publicKey = data.publicKey || data.publicBase64Key;
      return result;
    } catch {
      // Not JSON, parse as text
    }

    // Parse text output
    const lines = output.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();

      // Look for private key (starts with "suiprivkey")
      if (trimmed.includes('suiprivkey')) {
        const match = trimmed.match(/suiprivkey[a-zA-Z0-9]+/);
        if (match) {
          result.privateKey = match[0];
        }
      }

      // Look for key scheme
      if (trimmed.toLowerCase().includes('scheme') || trimmed.toLowerCase().includes('algorithm')) {
        if (trimmed.includes('ed25519')) result.keyScheme = 'ed25519';
        else if (trimmed.includes('secp256k1')) result.keyScheme = 'secp256k1';
        else if (trimmed.includes('secp256r1')) result.keyScheme = 'secp256r1';
      }

      // Look for public key (Base64)
      const pubKeyMatch = trimmed.match(/[A-Za-z0-9+/]{40,}={0,2}/);
      if (pubKeyMatch && !result.publicKey) {
        result.publicKey = pubKeyMatch[0];
      }
    }

    return result;
  }
}
