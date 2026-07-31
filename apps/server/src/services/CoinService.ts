import type {
  CoinGroup,
  CoinGroupedResponse,
  CoinInfo,
  CoinMetadata,
  CoinOperationResult,
} from '@sui-cli-web/shared';
import { getShortSymbol } from '@sui-cli-web/shared';
import { ConfigParser } from '../cli/ConfigParser';
import { SuiCliExecutor } from '../cli/SuiCliExecutor';
import { getKnownToken, getTokenPriority, isVerifiedToken } from '../utils/knownTokens';
import { getAllBalancesViaGrpc, getOwnedCoinsViaGrpc } from '../utils/suiGrpcClient';
import { getCoinMetadataViaGraphQL } from './GraphQLService';

// Constants
const MIST_PER_SUI = 1_000_000_000;
const FETCH_TIMEOUT_MS = 10_000;
const SUI_COIN_TYPE = '0x2::sui::SUI';

/**
 * Parse coinType to extract package ID and module name
 * "0x2::sui::SUI" -> { packageId: "0x2", moduleName: "sui" }
 */
function parseCoinType(coinType: string): { packageId: string; moduleName: string } {
  const parts = coinType.split('::');
  return {
    packageId: parts[0] || '',
    moduleName: parts[1] || '',
  };
}

/**
 * Detect network from RPC URL
 */
function detectNetworkFromRpc(rpcUrl: string): 'mainnet' | 'testnet' | 'devnet' | 'localnet' {
  if (rpcUrl.includes('mainnet')) return 'mainnet';
  if (rpcUrl.includes('testnet')) return 'testnet';
  if (rpcUrl.includes('devnet')) return 'devnet';
  if (rpcUrl.includes('127.0.0.1') || rpcUrl.includes('localhost')) return 'localnet';
  return 'testnet'; // default
}

// Cache for coin metadata
const metadataCache = new Map<string, { data: CoinMetadata; timestamp: number }>();
const METADATA_CACHE_TTL_MS = 300_000; // 5 minutes

// Helper for fetch with timeout
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number = FETCH_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

export class CoinService {
  private executor: SuiCliExecutor;
  private configParser: ConfigParser;

  constructor() {
    this.executor = SuiCliExecutor.getInstance();
    this.configParser = ConfigParser.getInstance();
  }

  private async getActiveRpcUrl(): Promise<string | null> {
    return this.configParser.getActiveRpcUrl();
  }

  private async getActiveAddress(): Promise<string> {
    const output = await this.executor.execute(['client', 'active-address']);
    return output.trim();
  }

  /**
   * Get all coins for an address, grouped by coin type
   */
  public async getCoinsGrouped(address: string): Promise<CoinGroupedResponse> {
    const rpcUrl = await this.getActiveRpcUrl();
    if (!rpcUrl) {
      throw new Error('No active RPC URL configured');
    }

    // Detect network for known tokens lookup
    const network = detectNetworkFromRpc(rpcUrl);

    // Fetch every coin object. suix_getAllCoins first for nodes that still
    // serve JSON-RPC, then gRPC's owned-object listing, which returns the same
    // per-object detail - Mysten's public fullnodes now answer 404 to every
    // JSON-RPC method, so on those the gRPC path is the only one that runs.
    //
    // Aggregate balances are the last resort only: they carry no object IDs, so
    // groups built from them cannot be split, merged or transferred. That mode
    // is now reported (`balancesOnly`) instead of looking like an empty wallet.
    let allCoins: CoinInfo[] = [];
    let grpcBalances: { coinType: string; balance: string }[] | null = null;
    try {
      allCoins = await this.fetchAllCoins(address, rpcUrl);
    } catch {
      try {
        allCoins = (await getOwnedCoinsViaGrpc(address, rpcUrl)).map((c) => ({
          coinObjectId: c.coinObjectId,
          coinType: c.coinType,
          balance: c.balance,
          version: c.version,
          digest: c.digest,
        }));
      } catch {
        grpcBalances = await getAllBalancesViaGrpc(address, rpcUrl);
        allCoins = [];
      }
    }

    // Group coins by type
    const groupedByType = new Map<string, CoinInfo[]>();
    for (const coin of allCoins) {
      const existing = groupedByType.get(coin.coinType) || [];
      existing.push(coin);
      groupedByType.set(coin.coinType, existing);
    }

    // gRPC fallback carries only aggregate totals, no individual coin objects
    const grpcTotalByType = new Map<string, bigint>();
    if (grpcBalances) {
      for (const b of grpcBalances) {
        if (BigInt(b.balance) > BigInt(0)) {
          grpcTotalByType.set(b.coinType, BigInt(b.balance));
          if (!groupedByType.has(b.coinType)) groupedByType.set(b.coinType, []);
        }
      }
    }

    // Fetch metadata for all coin types in parallel
    const coinTypes = Array.from(groupedByType.keys());
    const metadataPromises = coinTypes.map((type) => this.getCoinMetadata(type));
    const metadataResults = await Promise.all(metadataPromises);
    const metadataMap = new Map<string, CoinMetadata>();
    metadataResults.forEach((meta, idx) => {
      if (meta) {
        metadataMap.set(coinTypes[idx], meta);
      }
    });

    // Build coin groups
    const groups: CoinGroup[] = [];
    for (const [coinType, coins] of groupedByType) {
      const metadata = metadataMap.get(coinType);
      const knownToken = getKnownToken(coinType, network);

      const decimals = metadata?.decimals ?? (coinType === SUI_COIN_TYPE ? 9 : 9);
      const symbol = metadata?.symbol || knownToken?.symbol || getShortSymbol(coinType);
      const name = metadata?.name || knownToken?.name || symbol;

      // Parse package ID and module name
      const { packageId, moduleName } = parseCoinType(coinType);

      // Calculate total balance (gRPC fallback supplies the aggregate directly)
      const totalBalance =
        grpcTotalByType.get(coinType) ??
        coins.reduce((sum, coin) => sum + BigInt(coin.balance), BigInt(0));
      const formattedBalance = this.formatBalance(totalBalance.toString(), decimals);

      groups.push({
        coinType,
        symbol,
        name,
        decimals,
        totalBalance: totalBalance.toString(),
        formattedBalance,
        coins: coins.sort((a, b) => {
          // Sort by balance descending
          return BigInt(b.balance) > BigInt(a.balance) ? 1 : -1;
        }),
        coinCount: coins.length,
        iconUrl: metadata?.iconUrl || knownToken?.iconUrl,
        // New fields
        packageId,
        moduleName,
        isVerified: isVerifiedToken(coinType, network),
        description: metadata?.description || knownToken?.description,
      });
    }

    // Enhanced sorting: priority tokens first, then by balance
    groups.sort((a, b) => {
      const priorityA = getTokenPriority(a.coinType, network);
      const priorityB = getTokenPriority(b.coinType, network);

      // Both have priority (known tokens) - sort by priority
      if (priorityA !== 999 && priorityB !== 999) {
        return priorityA - priorityB;
      }
      // Only A has priority
      if (priorityA !== 999) return -1;
      // Only B has priority
      if (priorityB !== 999) return 1;
      // Neither has priority - sort by balance descending
      return BigInt(b.totalBalance) > BigInt(a.totalBalance) ? 1 : -1;
    });

    return {
      groups,
      totalCoinTypes: groups.length,
      // Count objects, never types: the old fallback reported `groups.length`
      // here, so a balances-only answer rendered "6 coin objects" above six
      // groups each showing (0) - a contradiction that read as a broken page
      // rather than as a degraded data source.
      totalCoins: allCoins.length,
      // True when only aggregate balances could be fetched, so the UI can say
      // why every group is empty instead of implying the wallet holds nothing.
      balancesOnly: grpcBalances !== null,
    };
  }

  /**
   * Get coins of a specific type for an address
   */
  public async getCoinsByType(address: string, coinType: string): Promise<CoinInfo[]> {
    const rpcUrl = await this.getActiveRpcUrl();
    if (!rpcUrl) {
      throw new Error('No active RPC URL configured');
    }

    // JSON-RPC first, gRPC fallback - same reasoning as `getCoinsGrouped` above:
    // `suix_getCoins` 404s on Mysten's public testnet/devnet fullnodes, and unlike
    // `getCoinsGrouped` this method previously had no fallback at all, so it threw
    // outright on those networks instead of degrading.
    try {
      return await this.fetchCoinsByType(address, coinType, rpcUrl);
    } catch {
      const owned = await getOwnedCoinsViaGrpc(address, rpcUrl);
      return owned
        .filter((c) => c.coinType === coinType)
        .map((c) => ({
          coinObjectId: c.coinObjectId,
          coinType: c.coinType,
          balance: c.balance,
          version: c.version,
          digest: c.digest,
        }));
    }
  }

  /**
   * Get coin metadata (decimals, symbol, name, etc.)
   */
  public async getCoinMetadata(coinType: string): Promise<CoinMetadata | null> {
    // Check cache first
    const cached = metadataCache.get(coinType);
    if (cached && Date.now() - cached.timestamp < METADATA_CACHE_TTL_MS) {
      return cached.data;
    }

    const rpcUrl = await this.getActiveRpcUrl();
    if (!rpcUrl) {
      // Return default for SUI
      if (coinType === SUI_COIN_TYPE) {
        return {
          coinType,
          name: 'Sui',
          symbol: 'SUI',
          decimals: 9,
          description: 'Native token of the Sui network',
        };
      }
      return null;
    }

    try {
      const response = await fetchWithTimeout(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'suix_getCoinMetadata',
          params: [coinType],
        }),
      });

      if (!response.ok) {
        throw new Error(response.statusText);
      }

      const data = (await response.json()) as {
        error?: { message: string };
        result?: {
          decimals: number;
          name: string;
          symbol: string;
          description?: string;
          iconUrl?: string;
        };
      };

      if (data.error || !data.result) {
        // Return default metadata based on coin type
        const symbol = getShortSymbol(coinType);
        return {
          coinType,
          name: symbol,
          symbol,
          decimals: 9, // Default to 9 decimals
        };
      }

      const metadata: CoinMetadata = {
        coinType,
        name: data.result.name,
        symbol: data.result.symbol,
        decimals: data.result.decimals,
        description: data.result.description,
        iconUrl: data.result.iconUrl,
      };

      // Cache the result
      metadataCache.set(coinType, { data: metadata, timestamp: Date.now() });

      return metadata;
    } catch {
      // JSON-RPC unreachable (`suix_getCoinMetadata` 404s on Mysten's public
      // testnet/devnet fullnodes, same as every other legacy JSON-RPC method) -
      // there's no gRPC equivalent (a coin's on-chain `CoinMetadata<T>` object
      // isn't looked up by type over gRPC), so GraphQL is the fallback here
      // instead, before giving up to a synthesized default.
      const viaGraphQL = await getCoinMetadataViaGraphQL(coinType, rpcUrl).catch(() => null);
      if (viaGraphQL) {
        const metadata: CoinMetadata = { coinType, ...viaGraphQL };
        metadataCache.set(coinType, { data: metadata, timestamp: Date.now() });
        return metadata;
      }

      // Return default for SUI on error
      if (coinType === SUI_COIN_TYPE) {
        return {
          coinType,
          name: 'Sui',
          symbol: 'SUI',
          decimals: 9,
        };
      }
      return null;
    }
  }

  /**
   * Split a coin into multiple coins using PTB
   * Works for ANY coin type, not just SUI
   */
  public async splitCoin(
    coinId: string,
    coinType: string,
    amounts: string[],
    gasBudget: string = '50000000'
  ): Promise<CoinOperationResult> {
    try {
      const sender = await this.getActiveAddress();

      // For SUI coins, we can use the simpler split-coin command
      if (coinType === SUI_COIN_TYPE) {
        const args = [
          'client',
          'split-coin',
          '--coin-id',
          coinId,
          '--amounts',
          ...amounts,
          '--gas-budget',
          gasBudget,
        ];
        const output = await this.executor.execute(args, { json: true });
        return this.parseTransactionResult(output);
      }

      // For other coin types, use PTB
      // Format: sui client ptb --split-coins @coinId "[amt1, amt2]" --assign coins --transfer-objects "[coins.0, coins.1]" @sender
      // Note: Must index into result array with coins.0, coins.1, etc.
      const amountsJson = `[${amounts.join(', ')}]`;
      const coinsToTransfer = amounts.map((_, i) => `new_coins.${i}`).join(', ');
      const args = [
        'client',
        'ptb',
        '--split-coins',
        `@${coinId}`,
        amountsJson,
        '--assign',
        'new_coins',
        '--transfer-objects',
        `[${coinsToTransfer}]`,
        `@${sender}`,
        '--gas-budget',
        gasBudget,
      ];

      const output = await this.executor.execute(args, { json: true });
      return this.parseTransactionResult(output);
    } catch (error) {
      return {
        success: false,
        error: this.sanitizeError(error),
      };
    }
  }

  /**
   * Merge multiple coins into one using PTB
   * Works for ANY coin type, including SUI
   * Note: CLI merge-coin only supports ONE coin at a time, so we use PTB for multiple coins
   */
  public async mergeCoins(
    primaryCoinId: string,
    coinIdsToMerge: string[],
    // Kept in the signature for call-site symmetry with splitCoin; merging
    // needs no type argument because the coins carry it.
    _coinType: string,
    gasBudget: string = '50000000'
  ): Promise<CoinOperationResult> {
    try {
      // Always use PTB for merging multiple coins (CLI merge-coin only supports one coin at a time)
      // Format: sui client ptb --merge-coins @primaryCoin "[@coin1, @coin2]"
      const coinsToMergeJson = `[${coinIdsToMerge.map((id) => `@${id}`).join(', ')}]`;
      const args = [
        'client',
        'ptb',
        '--merge-coins',
        `@${primaryCoinId}`,
        coinsToMergeJson,
        '--gas-budget',
        gasBudget,
      ];

      const output = await this.executor.execute(args, { json: true });
      return this.parseTransactionResult(output);
    } catch (error) {
      return {
        success: false,
        error: this.sanitizeError(error),
      };
    }
  }

  /**
   * Transfer a coin to another address
   * Works for ANY coin type - uses PTB for non-SUI coins
   */
  public async transferCoin(
    coinId: string,
    coinType: string,
    to: string,
    amount: string,
    gasBudget: string = '50000000'
  ): Promise<CoinOperationResult> {
    try {
      const sender = await this.getActiveAddress();

      // For SUI coins, we can use the simpler pay-sui command
      if (coinType === SUI_COIN_TYPE) {
        const args = [
          'client',
          'pay-sui',
          '--input-coins',
          coinId,
          '--recipients',
          to,
          '--amounts',
          amount,
          '--gas-budget',
          gasBudget,
        ];
        const output = await this.executor.execute(args, { json: true });
        return this.parseTransactionResult(output);
      }

      // For other coin types, use PTB:
      // 1. Split the exact amount from the source coin
      // 2. Transfer the split coin to recipient
      const args = [
        'client',
        'ptb',
        '--split-coins',
        `@${coinId}`,
        `[${amount}]`,
        '--assign',
        'split_coin',
        '--transfer-objects',
        '[split_coin]',
        `@${to}`,
        '--gas-budget',
        gasBudget,
      ];

      const output = await this.executor.execute(args, { json: true });
      return this.parseTransactionResult(output);
    } catch (error) {
      return {
        success: false,
        error: this.sanitizeError(error),
      };
    }
  }

  /**
   * Dry run transfer coin to estimate gas
   */
  public async dryRunTransferCoin(
    coinId: string,
    coinType: string,
    to: string,
    amount: string,
    gasBudget: string = '50000000'
  ): Promise<CoinOperationResult> {
    try {
      // For SUI coins
      if (coinType === SUI_COIN_TYPE) {
        const args = [
          'client',
          'pay-sui',
          '--input-coins',
          coinId,
          '--recipients',
          to,
          '--amounts',
          amount,
          '--gas-budget',
          gasBudget,
          '--dry-run',
        ];
        const output = await this.executor.execute(args, { json: true });
        return this.parseDryRunResult(output);
      }

      // For other coin types, use PTB with dry-run
      const args = [
        'client',
        'ptb',
        '--split-coins',
        `@${coinId}`,
        `[${amount}]`,
        '--assign',
        'split_coin',
        '--transfer-objects',
        '[split_coin]',
        `@${to}`,
        '--gas-budget',
        gasBudget,
        '--dry-run',
      ];

      const output = await this.executor.execute(args, { json: true });
      return this.parseDryRunResult(output);
    } catch (error) {
      return {
        success: false,
        error: this.sanitizeError(error),
      };
    }
  }

  /**
   * Dry run split operation to estimate gas
   */
  public async dryRunSplit(
    coinId: string,
    coinType: string,
    amounts: string[],
    gasBudget: string = '50000000'
  ): Promise<CoinOperationResult> {
    try {
      const sender = await this.getActiveAddress();

      if (coinType === SUI_COIN_TYPE) {
        const args = [
          'client',
          'split-coin',
          '--coin-id',
          coinId,
          '--amounts',
          ...amounts,
          '--gas-budget',
          gasBudget,
          '--dry-run',
        ];
        const output = await this.executor.execute(args, { json: true });
        return this.parseDryRunResult(output);
      }

      // For other coin types, use PTB with dry-run
      // Note: PTB --dry-run does NOT support JSON output, so don't use { json: true }
      // Must index into result array with new_coins.0, new_coins.1, etc.
      const amountsJson = `[${amounts.join(', ')}]`;
      const coinsToTransfer = amounts.map((_, i) => `new_coins.${i}`).join(', ');
      const args = [
        'client',
        'ptb',
        '--split-coins',
        `@${coinId}`,
        amountsJson,
        '--assign',
        'new_coins',
        '--transfer-objects',
        `[${coinsToTransfer}]`,
        `@${sender}`,
        '--gas-budget',
        gasBudget,
        '--dry-run',
      ];

      const output = await this.executor.execute(args);
      return this.parseDryRunResult(output);
    } catch (error) {
      return {
        success: false,
        error: this.sanitizeError(error),
      };
    }
  }

  /**
   * Dry run merge operation to estimate gas
   */
  public async dryRunMerge(
    primaryCoinId: string,
    coinIdsToMerge: string[],
    // Kept in the signature for call-site symmetry with splitCoin; merging
    // needs no type argument because the coins carry it.
    _coinType: string,
    gasBudget: string = '50000000'
  ): Promise<CoinOperationResult> {
    try {
      // Always use PTB for merging (CLI merge-coin only supports one coin at a time)
      // Note: PTB --dry-run does NOT support JSON output, so don't use { json: true }
      const coinsToMergeJson = `[${coinIdsToMerge.map((id) => `@${id}`).join(', ')}]`;
      const args = [
        'client',
        'ptb',
        '--merge-coins',
        `@${primaryCoinId}`,
        coinsToMergeJson,
        '--gas-budget',
        gasBudget,
        '--dry-run',
      ];

      const output = await this.executor.execute(args);
      return this.parseDryRunResult(output);
    } catch (error) {
      return {
        success: false,
        error: this.sanitizeError(error),
      };
    }
  }

  // ====== Private helpers ======

  private async fetchAllCoins(address: string, rpcUrl: string): Promise<CoinInfo[]> {
    const allCoins: CoinInfo[] = [];
    let cursor: string | null = null;
    let hasNextPage = true;

    while (hasNextPage) {
      const response = await fetchWithTimeout(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'suix_getAllCoins',
          params: [address, cursor, 50], // 50 coins per page
        }),
      });

      if (!response.ok) {
        throw new Error(response.statusText);
      }

      const data = (await response.json()) as {
        error?: { message: string };
        result?: {
          data: Array<{
            coinObjectId: string;
            coinType: string;
            balance: string;
            version: string;
            digest: string;
          }>;
          nextCursor: string | null;
          hasNextPage: boolean;
        };
      };

      if (data.error) {
        throw new Error(data.error.message);
      }

      if (data.result) {
        for (const coin of data.result.data) {
          allCoins.push({
            coinObjectId: coin.coinObjectId,
            coinType: coin.coinType,
            balance: coin.balance,
            version: coin.version,
            digest: coin.digest,
          });
        }
        cursor = data.result.nextCursor;
        hasNextPage = data.result.hasNextPage;
      } else {
        hasNextPage = false;
      }
    }

    return allCoins;
  }

  private async fetchCoinsByType(
    address: string,
    coinType: string,
    rpcUrl: string
  ): Promise<CoinInfo[]> {
    const allCoins: CoinInfo[] = [];
    let cursor: string | null = null;
    let hasNextPage = true;

    while (hasNextPage) {
      const response = await fetchWithTimeout(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'suix_getCoins',
          params: [address, coinType, cursor, 50],
        }),
      });

      if (!response.ok) {
        throw new Error(response.statusText);
      }

      const data = (await response.json()) as {
        error?: { message: string };
        result?: {
          data: Array<{
            coinObjectId: string;
            coinType: string;
            balance: string;
            version: string;
            digest: string;
          }>;
          nextCursor: string | null;
          hasNextPage: boolean;
        };
      };

      if (data.error) {
        throw new Error(data.error.message);
      }

      if (data.result) {
        for (const coin of data.result.data) {
          allCoins.push({
            coinObjectId: coin.coinObjectId,
            coinType: coin.coinType,
            balance: coin.balance,
            version: coin.version,
            digest: coin.digest,
          });
        }
        cursor = data.result.nextCursor;
        hasNextPage = data.result.hasNextPage;
      } else {
        hasNextPage = false;
      }
    }

    return allCoins;
  }

  private formatBalance(balance: string, decimals: number): string {
    const balanceBigInt = BigInt(balance);
    const divisor = BigInt(10 ** decimals);
    const integerPart = balanceBigInt / divisor;
    const fractionalPart = balanceBigInt % divisor;

    // Pad fractional part with leading zeros
    let fractionalStr = fractionalPart.toString().padStart(decimals, '0');
    // Trim trailing zeros but keep at least 4 decimal places for display
    fractionalStr = fractionalStr.replace(/0+$/, '');
    if (fractionalStr.length < 4) {
      fractionalStr = fractionalStr.padEnd(4, '0');
    }

    return `${integerPart}.${fractionalStr}`;
  }

  private parseTransactionResult(output: string): CoinOperationResult {
    try {
      const data = JSON.parse(output);

      // Check for transaction digest
      const digest = data.digest || data.effects?.transactionDigest;

      // Check execution status
      const status = data.effects?.status?.status;
      const success = status === 'success';

      // Extract gas used
      const gasUsed = data.effects?.gasUsed;
      let totalGas = '0';
      if (gasUsed) {
        const computation = BigInt(gasUsed.computationCost || 0);
        const storage = BigInt(gasUsed.storageCost || 0);
        const rebate = BigInt(gasUsed.storageRebate || 0);
        totalGas = (computation + storage - rebate).toString();
      }

      // Extract created coin IDs
      const newCoinIds: string[] = [];
      if (data.effects?.created) {
        for (const obj of data.effects.created) {
          if (obj.reference?.objectId) {
            newCoinIds.push(obj.reference.objectId);
          }
        }
      }

      return {
        success,
        digest,
        gasUsed: totalGas,
        newCoinIds: newCoinIds.length > 0 ? newCoinIds : undefined,
        error: !success ? data.effects?.status?.error : undefined,
      };
    } catch {
      return {
        success: false,
        error: 'Failed to parse transaction result',
      };
    }
  }

  private parseDryRunResult(output: string): CoinOperationResult {
    // First try JSON parsing (for non-PTB commands)
    try {
      const data = JSON.parse(output);

      // Check execution status
      const status = data.effects?.status?.status;
      const success = status === 'success';

      // Extract gas used
      const gasUsed = data.effects?.gasUsed;
      let totalGas = '0';
      if (gasUsed) {
        const computation = BigInt(gasUsed.computationCost || 0);
        const storage = BigInt(gasUsed.storageCost || 0);
        const rebate = BigInt(gasUsed.storageRebate || 0);
        totalGas = (computation + storage - rebate).toString();
      }

      return {
        success,
        gasUsed: totalGas,
        error: !success ? data.effects?.status?.error : undefined,
      };
    } catch {
      // Not JSON - try parsing text output (for PTB dry-run)
      return this.parsePtbDryRunText(output);
    }
  }

  /**
   * Parse PTB dry-run text output (not JSON)
   * Example: "Dry run completed, execution status: success"
   * Example: "Dry run completed, execution status: failure due to InsufficientCoinBalance in command 0"
   * Example: "Estimated gas cost (includes a small buffer): 2000000 MIST"
   */
  private parsePtbDryRunText(output: string): CoinOperationResult {
    try {
      // Check for success status - look for "execution status: success" or "execution status: failure"
      const statusMatch = output.match(/execution status:\s*(\w+)/i);
      const success = statusMatch?.[1]?.toLowerCase() === 'success';

      // Extract estimated gas cost
      const gasMatch = output.match(/Estimated gas cost[^:]*:\s*(\d+)\s*MIST/i);
      const gasUsed = gasMatch?.[1] || '0';

      // Check for failure status - extract error from "failure due to X" pattern
      if (!success) {
        // Try to extract error from "execution status: failure due to <ERROR>"
        const failureMatch = output.match(/execution status:\s*failure\s+due\s+to\s+([^\n]+)/i);
        let errorMsg = failureMatch?.[1]?.trim();

        // Clean up common error messages for user-friendly display
        if (errorMsg) {
          if (errorMsg.includes('InsufficientCoinBalance')) {
            errorMsg = 'Insufficient balance for this split';
          } else if (errorMsg.includes('InvalidResultArity')) {
            errorMsg = 'Invalid transaction structure';
          }
        }

        return {
          success: false,
          gasUsed,
          error: errorMsg || 'Dry run failed',
        };
      }

      return {
        success: true,
        gasUsed,
      };
    } catch {
      return {
        success: false,
        error: 'Failed to parse dry run result',
      };
    }
  }

  private sanitizeError(error: unknown): string {
    const errStr = String(error);
    // Remove file paths for security
    return errStr.replace(/\/[^\s]+\//g, '').replace(/Error:\s*/g, '');
  }
}
