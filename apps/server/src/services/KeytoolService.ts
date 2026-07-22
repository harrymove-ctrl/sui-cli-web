import { SuiCliExecutor } from '../cli/SuiCliExecutor.js';
import { sanitizeErrorMessage } from '../utils/errorHandler.js';

export type KeyScheme = 'ed25519' | 'secp256k1' | 'secp256r1';

export interface GenerateKeyResult {
  success: boolean;
  address?: string;
  publicKey?: string;
  keyScheme?: KeyScheme;
  mnemonic?: string; // Only if requested, NEVER store this
  error?: string;
}

export interface SignResult {
  success: boolean;
  signature?: string;
  publicKey?: string;
  error?: string;
}

export interface MultiSigAddressResult {
  success: boolean;
  address?: string;
  threshold?: number;
  publicKeys?: string[];
  weights?: number[];
  error?: string;
}

export interface DecodeResult {
  success: boolean;
  decoded?: object | string;
  signatureValid?: boolean;
  error?: string;
}

export interface CombineSignaturesResult {
  success: boolean;
  combinedSignature?: string;
  multiSigAddress?: string;
  error?: string;
}

export interface GenerateSampleTxResult {
  success: boolean;
  txBytes?: string;
  description?: string;
  error?: string;
}

export interface ExecuteTxResult {
  success: boolean;
  digest?: string;
  status?: string;
  gasUsed?: string;
  error?: string;
}

export interface BuildTransferTxResult {
  success: boolean;
  txBytes?: string;
  description?: string;
  error?: string;
}

export type SampleTxType = 'self-transfer' | 'split-coin' | 'merge-coins';

export interface KeyInfo {
  alias?: string;
  suiAddress: string;
  publicBase64Key: string;
  keyScheme: string;
  flag: number;
  peerId?: string;
}

export interface ListKeysResult {
  success: boolean;
  keys?: KeyInfo[];
  error?: string;
}

export class KeytoolService {
  private cli: SuiCliExecutor;

  constructor() {
    this.cli = SuiCliExecutor.getInstance();
  }

  /**
   * Generate a new keypair
   * @param scheme Key scheme (ed25519, secp256k1, secp256r1)
   * @param wordLength Optional word length for mnemonic (12, 15, 18, 21, 24)
   * @param noOutput If true, don't include mnemonic in response (more secure)
   */
  public async generateKey(
    scheme: KeyScheme = 'ed25519',
    wordLength?: number,
    noOutput?: boolean
  ): Promise<GenerateKeyResult> {
    try {
      // Build args for: sui keytool generate <scheme> [--word-length <length>]
      const args = ['keytool', 'generate', scheme];

      if (wordLength) {
        // Validate word length
        const validLengths = [12, 15, 18, 21, 24];
        if (!validLengths.includes(wordLength)) {
          return {
            success: false,
            error: `Invalid word length. Must be one of: ${validLengths.join(', ')}`,
          };
        }
        args.push('--word-length', wordLength.toString());
      }

      // SECURITY: Add --json flag for structured parsing (avoids mnemonic in plain output)
      args.push('--json');

      const output = await this.cli.execute(args);

      // Parse JSON output
      const result = this.parseGenerateOutput(output, noOutput);

      if (!result.address) {
        return {
          success: false,
          error: 'Failed to parse generated key from output',
        };
      }

      // NEVER log mnemonics or private keys
      console.log(
        `[KeytoolService] Generated new ${scheme} key with address: ${result.address}`
      );

      return {
        success: true,
        address: result.address,
        publicKey: result.publicKey,
        keyScheme: scheme,
        mnemonic: result.mnemonic, // Only include if requested
      };
    } catch (error) {
      console.error('[KeytoolService] Generate key failed:', error);
      return {
        success: false,
        error: sanitizeErrorMessage(error),
      };
    }
  }

  /**
   * Sign transaction data with an address
   * @param address Address or alias to sign with
   * @param data BCS-serialized transaction bytes (Base64 encoded)
   *
   * Note: sui keytool sign expects Base64-encoded BCS-serialized transaction bytes.
   * Use `sui client tx-block --serialize` to get transaction bytes.
   */
  public async signMessage(address: string, data: string): Promise<SignResult> {
    try {
      // Build args for: sui keytool sign --address <addr> --data <data>
      // Data must be Base64 encoded BCS-serialized transaction bytes
      const args = ['keytool', 'sign', '--address', address, '--data', data];

      const output = await this.cli.execute(args);

      // Parse output to extract signature
      const result = this.parseSignOutput(output);

      if (!result.signature) {
        return {
          success: false,
          error: 'Failed to parse signature from output',
        };
      }

      console.log(`[KeytoolService] Message signed by address: ${address}`);

      return {
        success: true,
        signature: result.signature,
        publicKey: result.publicKey,
      };
    } catch (error) {
      console.error('[KeytoolService] Sign message failed:', error);
      return {
        success: false,
        error: sanitizeErrorMessage(error),
      };
    }
  }

  /**
   * Create a multi-signature address
   * @param publicKeys Array of public keys (Base64)
   * @param weights Array of weights (must match public keys length)
   * @param threshold Minimum weight required for valid signature
   */
  public async createMultiSigAddress(
    publicKeys: string[],
    weights: number[],
    threshold: number
  ): Promise<MultiSigAddressResult> {
    try {
      // Validate inputs
      if (publicKeys.length === 0) {
        return {
          success: false,
          error: 'At least one public key is required',
        };
      }

      if (publicKeys.length !== weights.length) {
        return {
          success: false,
          error: 'Number of public keys must match number of weights',
        };
      }

      if (threshold <= 0) {
        return {
          success: false,
          error: 'Threshold must be positive',
        };
      }

      const totalWeight = weights.reduce((sum, w) => sum + w, 0);
      if (threshold > totalWeight) {
        return {
          success: false,
          error: `Threshold (${threshold}) cannot exceed total weight (${totalWeight})`,
        };
      }

      // Build args for: sui keytool multi-sig-address --pks <pk1> <pk2> ... --weights <w1> <w2> ... --threshold <t>
      const args = ['keytool', 'multi-sig-address'];

      // Add public keys
      args.push('--pks');
      args.push(...publicKeys);

      // Add weights
      args.push('--weights');
      args.push(...weights.map((w) => w.toString()));

      // Add threshold
      args.push('--threshold', threshold.toString());

      const output = await this.cli.execute(args);

      // Parse output to extract multi-sig address
      const result = this.parseMultiSigOutput(output);

      if (!result.address) {
        return {
          success: false,
          error: 'Failed to parse multi-sig address from output',
        };
      }

      console.log(
        `[KeytoolService] Created multi-sig address with ${publicKeys.length} keys and threshold ${threshold}`
      );

      return {
        success: true,
        address: result.address,
        threshold,
        publicKeys,
        weights,
      };
    } catch (error) {
      console.error('[KeytoolService] Create multi-sig address failed:', error);
      return {
        success: false,
        error: sanitizeErrorMessage(error),
      };
    }
  }

  /**
   * List all keys in the keystore
   */
  public async listKeys(): Promise<ListKeysResult> {
    try {
      // Build args for: sui keytool list --json
      const args = ['keytool', 'list', '--json'];

      const output = await this.cli.execute(args);

      // Parse JSON output
      try {
        const keys = JSON.parse(output);

        if (!Array.isArray(keys)) {
          return {
            success: false,
            error: 'Unexpected response format from keytool list',
          };
        }

        console.log(`[KeytoolService] Listed ${keys.length} keys`);

        return {
          success: true,
          keys,
        };
      } catch (parseError) {
        return {
          success: false,
          error: 'Failed to parse JSON output from keytool list',
        };
      }
    } catch (error) {
      console.error('[KeytoolService] List keys failed:', error);
      return {
        success: false,
        error: sanitizeErrorMessage(error),
      };
    }
  }

  /**
   * Generate a sample transaction for testing signing
   * @param address Address to create the sample TX for
   * @param txType Type of sample transaction to generate
   */
  public async generateSampleTransaction(
    address: string,
    txType: SampleTxType = 'self-transfer'
  ): Promise<GenerateSampleTxResult> {
    try {
      // First, get gas coins for this address
      // Note: sui client gas uses positional argument, not --address flag
      const gasArgs = ['client', 'gas', address, '--json'];
      const gasOutput = await this.cli.execute(gasArgs);

      let gasCoins: Array<{ gasCoinId: string; mistBalance: number }> = [];
      try {
        gasCoins = JSON.parse(gasOutput);
      } catch {
        return {
          success: false,
          error: 'Failed to get gas coins. Make sure the address has SUI balance.',
        };
      }

      if (!Array.isArray(gasCoins) || gasCoins.length === 0) {
        return {
          success: false,
          error: 'No gas coins found for this address. Request from faucet first.',
        };
      }

      // Find a gas coin with enough balance (need at least 10M MIST for gas)
      const suitableCoin = gasCoins.find((c) => c.mistBalance >= 10000000);
      if (!suitableCoin) {
        return {
          success: false,
          error: 'No gas coin with sufficient balance. Need at least 0.01 SUI.',
        };
      }

      let args: string[];
      let description: string;

      switch (txType) {
        case 'split-coin':
          // Split coin into smaller amounts
          args = [
            'client',
            'split-coin',
            '--coin-id',
            suitableCoin.gasCoinId,
            '--amounts',
            '1000', // Split off 1000 MIST
            '--gas-budget',
            '10000000',
            '--serialize-unsigned-transaction',
          ];
          description = `Split coin: create new coin with 1000 MIST from ${suitableCoin.gasCoinId.slice(0, 8)}...`;
          break;

        case 'merge-coins':
          // Need at least 2 coins to merge
          if (gasCoins.length < 2) {
            return {
              success: false,
              error: 'Need at least 2 gas coins to merge. Try "Split Coin" first to create more coins.',
            };
          }
          const primaryCoin = gasCoins[0];
          const coinToMerge = gasCoins[1];
          args = [
            'client',
            'merge-coin',
            '--primary-coin',
            primaryCoin.gasCoinId,
            '--coin-to-merge',
            coinToMerge.gasCoinId,
            '--gas-budget',
            '10000000',
            '--serialize-unsigned-transaction',
          ];
          description = `Merge coins: combine ${coinToMerge.gasCoinId.slice(0, 8)}... into ${primaryCoin.gasCoinId.slice(0, 8)}...`;
          break;

        case 'self-transfer':
        default:
          // Create a self-transfer transaction (transfer 1 MIST to self)
          args = [
            'client',
            'transfer-sui',
            '--to',
            address,
            '--sui-coin-object-id',
            suitableCoin.gasCoinId,
            '--amount',
            '1', // 1 MIST (smallest unit)
            '--gas-budget',
            '10000000',
            '--serialize-unsigned-transaction',
          ];
          description = `Self-transfer of 1 MIST (test transaction for ${address.slice(0, 8)}...)`;
          break;
      }

      const output = await this.cli.execute(args);

      // The output is the Base64 encoded transaction bytes
      const txBytes = output.trim();

      if (!txBytes || txBytes.length < 50) {
        return {
          success: false,
          error: 'Failed to generate transaction bytes',
        };
      }

      console.log(`[KeytoolService] Generated ${txType} sample TX for address: ${address}`);

      return {
        success: true,
        txBytes,
        description,
      };
    } catch (error) {
      console.error('[KeytoolService] Generate sample TX failed:', error);
      return {
        success: false,
        error: sanitizeErrorMessage(error),
      };
    }
  }

  /**
   * Decode and optionally verify a transaction
   * @param txBytes Transaction bytes (Base64 or hex)
   * @param signature Optional signature to verify
   */
  public async decodeTx(txBytes: string, signature?: string): Promise<DecodeResult> {
    try {
      // Build args for: sui keytool decode-or-verify-tx --tx-bytes <bytes> [--sig <sig>]
      const args = ['keytool', 'decode-or-verify-tx', '--tx-bytes', txBytes];

      if (signature) {
        args.push('--sig', signature);
      }

      const output = await this.cli.execute(args);

      // Parse output
      const result = this.parseDecodeOutput(output, !!signature);

      console.log(
        `[KeytoolService] Decoded transaction${signature ? ' and verified signature' : ''}`
      );

      return {
        success: true,
        decoded: result.decoded,
        signatureValid: result.signatureValid,
      };
    } catch (error) {
      console.error('[KeytoolService] Decode transaction failed:', error);
      return {
        success: false,
        error: sanitizeErrorMessage(error),
      };
    }
  }

  // Private helper: Parse generate output
  private parseGenerateOutput(
    output: string,
    noOutput?: boolean
  ): {
    address?: string;
    publicKey?: string;
    mnemonic?: string;
  } {
    try {
      // Try JSON parsing first
      const data = JSON.parse(output);

      return {
        address: data.address || data.suiAddress,
        publicKey: data.publicKey || data.publicBase64Key,
        mnemonic: noOutput ? undefined : data.mnemonic || data.recoveryPhrase,
      };
    } catch {
      // Fallback to text parsing
      const result: {
        address?: string;
        publicKey?: string;
        mnemonic?: string;
      } = {};

      const lines = output.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();

        // Extract address
        const addressMatch = trimmed.match(/0x[a-fA-F0-9]{64}/);
        if (addressMatch && !result.address) {
          result.address = addressMatch[0];
        }

        // Extract mnemonic (only if not suppressed)
        if (!noOutput && trimmed.includes('word')) {
          const words = trimmed.match(/\b[a-z]+\b/g);
          if (words && words.length >= 12) {
            result.mnemonic = words.join(' ');
          }
        }
      }

      return result;
    }
  }

  // Private helper: Parse sign output
  private parseSignOutput(output: string): {
    signature?: string;
    publicKey?: string;
  } {
    try {
      // Try JSON parsing first
      const data = JSON.parse(output);
      return {
        signature: data.signature || data.suiSignature,
        publicKey: data.publicKey || data.publicBase64Key,
      };
    } catch {
      // Fallback to text parsing
      const result: {
        signature?: string;
        publicKey?: string;
      } = {};

      const lines = output.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();

        // Look for signature (Base64 encoded)
        if (
          trimmed.toLowerCase().includes('signature') &&
          !trimmed.toLowerCase().includes('public')
        ) {
          const sigMatch = trimmed.match(/[A-Za-z0-9+/]{40,}={0,2}/);
          if (sigMatch) {
            result.signature = sigMatch[0];
          }
        }

        // Look for public key
        if (trimmed.toLowerCase().includes('public')) {
          const pubMatch = trimmed.match(/[A-Za-z0-9+/]{40,}={0,2}/);
          if (pubMatch) {
            result.publicKey = pubMatch[0];
          }
        }
      }

      return result;
    }
  }

  // Private helper: Parse multi-sig output
  private parseMultiSigOutput(output: string): {
    address?: string;
  } {
    try {
      // Try JSON parsing first
      const data = JSON.parse(output);
      return {
        address: data.address || data.multiSigAddress,
      };
    } catch {
      // Fallback to text parsing
      const addressMatch = output.match(/0x[a-fA-F0-9]{64}/);
      return {
        address: addressMatch ? addressMatch[0] : undefined,
      };
    }
  }

  /**
   * Combine partial signatures into a multi-sig signature
   * @param publicKeys Array of public keys (Base64) in order
   * @param weights Array of weights (must match public keys)
   * @param threshold Required threshold
   * @param signatures Array of partial signatures (in same order as public keys, can have gaps)
   */
  public async combinePartialSignatures(
    publicKeys: string[],
    weights: number[],
    threshold: number,
    signatures: string[]
  ): Promise<CombineSignaturesResult> {
    try {
      // Validate inputs
      if (publicKeys.length === 0) {
        return {
          success: false,
          error: 'At least one public key is required',
        };
      }

      if (publicKeys.length !== weights.length) {
        return {
          success: false,
          error: 'Number of public keys must match number of weights',
        };
      }

      if (signatures.length === 0) {
        return {
          success: false,
          error: 'At least one signature is required',
        };
      }

      // Filter out empty signatures but keep track of positions
      const validSignatures = signatures.filter((s) => s && s.trim());
      if (validSignatures.length === 0) {
        return {
          success: false,
          error: 'At least one non-empty signature is required',
        };
      }

      // Check if we have enough weight
      let totalSignedWeight = 0;
      for (let i = 0; i < signatures.length && i < weights.length; i++) {
        if (signatures[i] && signatures[i].trim()) {
          totalSignedWeight += weights[i];
        }
      }

      if (totalSignedWeight < threshold) {
        return {
          success: false,
          error: `Not enough signatures. Signed weight: ${totalSignedWeight}, required: ${threshold}`,
        };
      }

      // Build args: sui keytool multi-sig-combine-partial-sig --pks <...> --weights <...> --threshold <t> --sigs <...>
      const args = ['keytool', 'multi-sig-combine-partial-sig'];

      // Add public keys
      args.push('--pks');
      args.push(...publicKeys);

      // Add weights
      args.push('--weights');
      args.push(...weights.map((w) => w.toString()));

      // Add threshold
      args.push('--threshold', threshold.toString());

      // Add signatures (only non-empty ones, in order)
      args.push('--sigs');
      args.push(...validSignatures);

      // Add --json for structured output
      args.push('--json');

      const output = await this.cli.execute(args);

      // Parse the output
      try {
        const data = JSON.parse(output);
        return {
          success: true,
          combinedSignature: data.signature || data.multiSigSignature || data.combinedSignature,
          multiSigAddress: data.address || data.multiSigAddress,
        };
      } catch {
        // Try to extract signature from text output
        const sigMatch = output.match(/[A-Za-z0-9+/]{60,}={0,2}/);
        return {
          success: true,
          combinedSignature: sigMatch ? sigMatch[0] : output.trim(),
        };
      }
    } catch (error) {
      console.error('[KeytoolService] Combine partial signatures failed:', error);
      return {
        success: false,
        error: sanitizeErrorMessage(error),
      };
    }
  }

  // Private helper: Parse decode output
  private parseDecodeOutput(
    output: string,
    hasSignature: boolean
  ): {
    decoded?: object | string;
    signatureValid?: boolean;
  } {
    try {
      // Try JSON parsing first
      const data = JSON.parse(output);

      return {
        decoded: data,
        signatureValid: hasSignature
          ? data.signatureValid || data.verified || true
          : undefined,
      };
    } catch {
      // Return raw output if not JSON
      return {
        decoded: output,
        signatureValid: hasSignature
          ? output.toLowerCase().includes('valid') ||
            output.toLowerCase().includes('verified')
          : undefined,
      };
    }
  }

  /**
   * Execute a signed transaction on-chain
   * @param txBytes Transaction bytes (Base64)
   * @param signature Combined signature (for multi-sig or single sig)
   */
  public async executeSignedTransaction(
    txBytes: string,
    signature: string
  ): Promise<ExecuteTxResult> {
    try {
      // Build args: sui client execute-signed-tx --tx-bytes <bytes> --signatures <sig>
      const args = [
        'client',
        'execute-signed-tx',
        '--tx-bytes',
        txBytes,
        '--signatures',
        signature,
        '--json',
      ];

      const output = await this.cli.execute(args);

      // Parse output
      try {
        const data = JSON.parse(output);

        // Extract relevant info
        const digest = data.digest || data.effects?.transactionDigest;
        const status = data.effects?.status?.status ||
                       (data.effects ? 'success' : undefined);

        // Calculate gas used
        let gasUsed: string | undefined;
        if (data.effects?.gasUsed) {
          const gas = data.effects.gasUsed;
          const total = BigInt(gas.computationCost || 0) +
                        BigInt(gas.storageCost || 0) -
                        BigInt(gas.storageRebate || 0);
          gasUsed = (Number(total) / 1_000_000_000).toFixed(6) + ' SUI';
        }

        console.log(`[KeytoolService] Transaction executed: ${digest}`);

        return {
          success: true,
          digest,
          status,
          gasUsed,
        };
      } catch {
        // Try to extract digest from text output
        const digestMatch = output.match(/[A-Za-z0-9+/]{43,44}/);
        return {
          success: true,
          digest: digestMatch ? digestMatch[0] : undefined,
        };
      }
    } catch (error) {
      console.error('[KeytoolService] Execute signed transaction failed:', error);
      return {
        success: false,
        error: sanitizeErrorMessage(error),
      };
    }
  }

  /**
   * Build an unsigned transfer transaction for multi-sig use
   * @param from Source address (multi-sig address)
   * @param to Destination address
   * @param amount Amount in MIST
   * @param coinObjectId Specific coin to use (optional)
   * @param gasBudget Gas budget in MIST (default: 10000000)
   */
  public async buildTransferTransaction(
    from: string,
    to: string,
    amount: string,
    coinObjectId?: string,
    gasBudget: string = '10000000'
  ): Promise<BuildTransferTxResult> {
    try {
      // If no coin specified, we need to find one from the address
      let coinId = coinObjectId;

      if (!coinId) {
        // Get gas coins for the address
        const gasOutput = await this.cli.execute(['client', 'gas', from, '--json']);
        try {
          const gasData = JSON.parse(gasOutput);
          if (Array.isArray(gasData) && gasData.length > 0) {
            // Find a suitable coin
            const amountNeeded = BigInt(amount) + BigInt(gasBudget);
            const suitableCoin = gasData.find((c: any) => {
              const balance = BigInt(c.balance || c.mistBalance || '0');
              return balance >= amountNeeded;
            });

            if (!suitableCoin) {
              return {
                success: false,
                error: `No coin with sufficient balance. Need at least ${Number(amountNeeded) / 1_000_000_000} SUI`,
              };
            }
            coinId = suitableCoin.gasCoinId || suitableCoin.coinObjectId;
          } else {
            return {
              success: false,
              error: 'No gas coins found for this address',
            };
          }
        } catch {
          return {
            success: false,
            error: 'Failed to fetch gas coins for address',
          };
        }
      }

      // Build the unsigned transaction
      const args = [
        'client',
        'transfer-sui',
        '--to',
        to,
        '--sui-coin-object-id',
        coinId,
        '--amount',
        amount,
        '--gas-budget',
        gasBudget,
        '--serialize-unsigned-transaction',
      ];

      const output = await this.cli.execute(args);
      const txBytes = output.trim();

      if (!txBytes || txBytes.length < 50) {
        return {
          success: false,
          error: 'Failed to generate transaction bytes',
        };
      }

      const amountSui = (Number(amount) / 1_000_000_000).toFixed(4);
      const description = `Transfer ${amountSui} SUI to ${to.slice(0, 8)}...${to.slice(-4)}`;

      console.log(`[KeytoolService] Built transfer TX: ${description}`);

      return {
        success: true,
        txBytes,
        description,
      };
    } catch (error) {
      console.error('[KeytoolService] Build transfer transaction failed:', error);
      return {
        success: false,
        error: sanitizeErrorMessage(error),
      };
    }
  }
}
