import type { GasCoin, SuiAddress } from '@sui-cli-web/shared';
import { ConfigParser } from '../cli/ConfigParser';
import { SuiCliExecutor } from '../cli/SuiCliExecutor';
import type { TransactionBalanceEffect } from '../utils/suiGrpcClient';
import {
  getBalanceViaGrpc,
  getObjectsJsonViaGrpc,
  getOwnedObjectsViaGrpc,
  getTransactionBalanceEffectsViaGrpc,
  getTransactionTimestampsViaGrpc,
} from '../utils/suiGrpcClient';
import {
  getAddressBalanceEffects,
  getObjectVersionHistory,
  getTransactionSummary,
  getTransactionTimestamps,
} from './GraphQLService';

export interface BlobSummary {
  objectId: string;
  blobId: string | null;
  size: number | null;
  encodingType: number | null;
  registeredEpoch: number | null;
  certifiedEpoch: number | null;
  deletable: boolean;
  storageStartEpoch: number | null;
  storageEndEpoch: number | null;
  storageSize: number | null;
  /** Checkpoint timestamp (ms) of the transaction that last touched this object. */
  lastTouchedMs: number | null;
}

import { type DecodedRawObject, decodeRawObject } from '../utils/rawObjectDecode';
import {
  validateFunctionName,
  validateModuleName,
  validateMoveArgs,
  validateObjectId,
  validateOptionalGasBudget,
  validateTypeArgs,
} from '../utils/validation';

// Constants
const SUI_COIN_TYPE = '0x2::sui::SUI';
const MIST_PER_SUI = 1_000_000_000;
const FETCH_TIMEOUT_MS = 5_000; // Reduced from 10s to 5s for faster failures
const RPC_BATCH_SIZE = 10; // Max concurrent RPC calls

// Cache for addresses data (reduces repeated CLI calls)
interface AddressCache {
  data: SuiAddress[];
  timestamp: number;
}
const addressCache: AddressCache | null = null;
const ADDRESS_CACHE_TTL_MS = 30_000; // 30 seconds

// Cache for balances with stale-while-revalidate pattern
interface BalanceCacheEntry {
  balance: string;
  timestamp: number;
  isFresh: boolean;
}
const balanceCache = new Map<string, BalanceCacheEntry>();
const BALANCE_CACHE_FRESH_MS = 30_000; // 30 seconds - fresh data
const BALANCE_CACHE_STALE_MS = 120_000; // 2 minutes - serve stale while revalidating
const BALANCE_REVALIDATION_IN_PROGRESS = new Set<string>(); // Track ongoing revalidations

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

// Batch RPC helper - executes multiple RPC calls in single batch request
async function batchRpcCall(
  rpcUrl: string,
  calls: Array<{ method: string; params: unknown[] }>
): Promise<unknown[]> {
  const batchRequest = calls.map((call, idx) => ({
    jsonrpc: '2.0',
    id: idx + 1,
    method: call.method,
    params: call.params,
  }));

  const response = await fetchWithTimeout(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(batchRequest),
  });

  if (!response.ok) throw new Error(response.statusText);

  const results = (await response.json()) as
    | Array<{ id: number; result?: unknown }>
    | { result?: unknown };

  // Results may come back in any order, sort by id
  if (Array.isArray(results)) {
    results.sort((a, b) => a.id - b.id);
    return results.map((r) => r.result);
  }

  return [(results as { result?: unknown }).result];
}

export class AddressService {
  private executor: SuiCliExecutor;
  private configParser: ConfigParser;

  constructor() {
    this.executor = SuiCliExecutor.getInstance();
    this.configParser = ConfigParser.getInstance();
  }

  public async getAddresses(includeBalance: boolean = true): Promise<SuiAddress[]> {
    const activeAddress = await this.getActiveAddress();
    const rpcUrl = await this.getActiveRpcUrl();

    let addresses: SuiAddress[] = [];

    try {
      const output = await this.executor.execute(['client', 'addresses'], { json: true });
      const data = JSON.parse(output);

      if (data.addresses && Array.isArray(data.addresses)) {
        addresses = data.addresses
          .map((addr: any) => {
            try {
              let address: string;
              let alias: string | undefined;

              if (Array.isArray(addr)) {
                const p1 = addr[0];
                const p2 = addr[1];
                if (typeof p1 === 'string' && p1.startsWith('0x')) {
                  address = p1;
                  alias = p2 || undefined;
                } else if (typeof p2 === 'string' && p2.startsWith('0x')) {
                  address = p2;
                  alias = p1 || undefined;
                } else {
                  address = String(p1);
                }
              } else if (typeof addr === 'string') {
                address = addr;
              } else {
                return null;
              }

              return {
                address,
                alias,
                isActive: address === activeAddress,
              };
            } catch {
              return null;
            }
          })
          .filter((item: SuiAddress | null): item is SuiAddress => item !== null);
      }
    } catch {
      // Fallback to text parsing
      try {
        const textOutput = await this.executor.execute(['client', 'addresses']);
        const parsed = textOutput
          .split('\n')
          .map((line) => {
            const parts = line.trim().split(/\s+/);
            const addr = parts.find((p) => p.startsWith('0x'));
            const alias = parts.find(
              (p) => !p.startsWith('0x') && p !== 'Active' && p !== 'Address'
            );
            if (addr) {
              return {
                address: addr,
                alias,
                isActive: addr === activeAddress,
              } as SuiAddress;
            }
            return null;
          })
          .filter((item): item is SuiAddress => item !== null);
        addresses = parsed;
      } catch {
        // Return empty array if both methods fail
        addresses = [];
      }
    }

    // OPTIMIZED: Batch fetch ALL balances in ONE RPC call
    if (addresses.length > 0 && rpcUrl) {
      const balanceMap = includeBalance
        ? await this.fetchBalancesBatch(
            addresses.map((a) => a.address),
            rpcUrl
          )
        : new Map<string, string>();

      addresses = addresses.map((addr) => ({
        ...addr,
        balance: balanceMap.get(addr.address) || '0',
      }));
    } else if (addresses.length > 0) {
      // Fallback: No RPC URL, use sequential fetching
      const enrichedPromises = addresses.map(async (addr) => {
        const enrichedAddr = { ...addr };
        if (includeBalance) {
          try {
            enrichedAddr.balance = await this.getBalance(addr.address);
          } catch {
            enrichedAddr.balance = '0';
          }
        }
        return enrichedAddr;
      });
      addresses = await Promise.all(enrichedPromises);
    }

    return addresses;
  }

  /**
   * Fetch balances for multiple addresses with stale-while-revalidate pattern
   * - Fresh cache (<30s): Return immediately
   * - Stale cache (30s-2m): Return stale data + revalidate in background
   * - No cache/expired: Fetch and return
   */
  private async fetchBalancesBatch(
    addresses: string[],
    rpcUrl: string
  ): Promise<Map<string, string>> {
    const balanceMap = new Map<string, string>();
    const now = Date.now();

    // Separate addresses into: fresh, stale (need revalidation), and uncached
    const staleAddresses: string[] = [];
    const uncachedAddresses: string[] = [];

    for (const addr of addresses) {
      const cached = balanceCache.get(addr);

      if (!cached) {
        // No cache - must fetch
        uncachedAddresses.push(addr);
      } else if (now - cached.timestamp < BALANCE_CACHE_FRESH_MS) {
        // Fresh cache - use immediately
        balanceMap.set(addr, cached.balance);
      } else if (now - cached.timestamp < BALANCE_CACHE_STALE_MS) {
        // Stale but usable - return immediately, revalidate in background
        balanceMap.set(addr, cached.balance);
        if (!BALANCE_REVALIDATION_IN_PROGRESS.has(addr)) {
          staleAddresses.push(addr);
        }
      } else {
        // Expired - must fetch
        uncachedAddresses.push(addr);
      }
    }

    // If all are fresh, return immediately
    if (uncachedAddresses.length === 0 && staleAddresses.length === 0) {
      return balanceMap;
    }

    // Fetch uncached addresses (blocking - needed for response)
    if (uncachedAddresses.length > 0) {
      try {
        const balancePromises = uncachedAddresses.map(async (addr) => {
          try {
            const balance = await this.fetchBalanceViaRpc(addr, rpcUrl);
            return { addr, balance };
          } catch {
            return { addr, balance: '0' };
          }
        });

        const results = await Promise.all(balancePromises);

        // Process results and update cache
        for (const { addr, balance } of results) {
          balanceMap.set(addr, balance);
          balanceCache.set(addr, { balance, timestamp: now, isFresh: true });
        }
      } catch (error) {
        // On failure, set all to '0' but DON'T cache
        for (const addr of uncachedAddresses) {
          balanceMap.set(addr, '0');
        }
      }
    }

    // Revalidate stale addresses in background (non-blocking)
    if (staleAddresses.length > 0) {
      // Mark as in progress to avoid duplicate revalidations
      staleAddresses.forEach((addr) => {
        BALANCE_REVALIDATION_IN_PROGRESS.add(addr);
      });

      // Don't await - let it run in background
      this.revalidateBalancesInBackground(staleAddresses, rpcUrl).finally(() => {
        staleAddresses.forEach((addr) => {
          BALANCE_REVALIDATION_IN_PROGRESS.delete(addr);
        });
      });
    }

    return balanceMap;
  }

  /**
   * Background revalidation - updates cache without blocking response
   */
  private async revalidateBalancesInBackground(addresses: string[], rpcUrl: string): Promise<void> {
    try {
      const now = Date.now();
      const balancePromises = addresses.map(async (addr) => {
        try {
          const balance = await this.fetchBalanceViaRpc(addr, rpcUrl);
          return { addr, balance };
        } catch {
          return { addr, balance: null }; // null means keep existing stale data
        }
      });

      const results = await Promise.all(balancePromises);

      for (const { addr, balance } of results) {
        if (balance !== null) {
          // Update cache with fresh data
          balanceCache.set(addr, { balance, timestamp: now, isFresh: true });
        }
      }
    } catch (error) {
      // Silent fail - stale data is still being served
      console.error('[AddressService] Background revalidation failed:', error);
    }
  }

  public async getActiveAddress(): Promise<string> {
    const output = await this.executor.execute(['client', 'active-address']);
    return output.trim();
  }

  public async switchAddress(address: string): Promise<void> {
    await this.executor.execute(['client', 'switch', '--address', address]);
  }

  public async createAddress(
    keyScheme: 'ed25519' | 'secp256k1' | 'secp256r1' = 'ed25519',
    alias?: string
  ): Promise<{ address: string; phrase?: string }> {
    // Sui CLI format: sui client new-address <KEY_SCHEME> [ALIAS] [WORD_LENGTH] [DERIVATION_PATH]
    // ALIAS is now a positional argument, not a --alias flag
    const args = ['client', 'new-address', keyScheme];
    if (alias) {
      args.push(alias); // positional argument
    }

    const output = await this.executor.execute(args);

    // Parse output to extract address and recovery phrase
    const addressMatch = output.match(/0x[a-fA-F0-9]+/);
    const phraseMatch = output.match(/Recovery phrase[:\s]+(.+?)(?:\n|$)/i);

    return {
      address: addressMatch?.[0] || '',
      phrase: phraseMatch?.[1]?.trim(),
    };
  }

  public async removeAddress(address: string): Promise<void> {
    // Check if address is active
    const activeAddress = await this.getActiveAddress();
    if (address === activeAddress) {
      throw new Error('Cannot remove active address. Please switch to another address first.');
    }

    // Execute sui client remove-address command
    await this.executor.execute(['client', 'remove-address', address]);
  }

  private async getActiveRpcUrl(): Promise<string | null> {
    try {
      const config = await this.configParser.getConfig();
      if (config) {
        const activeEnv = config.envs.find((e) => e.alias === config.active_env);
        return activeEnv?.rpc || null;
      }
    } catch {
      // Ignore
    }
    return null;
  }

  private async fetchBalanceViaRpc(address: string, rpcUrl: string): Promise<string> {
    try {
      const mist = await getBalanceViaGrpc(address, rpcUrl, SUI_COIN_TYPE);
      return (parseInt(mist, 10) / MIST_PER_SUI).toFixed(4);
    } catch {
      // Fall back to JSON-RPC below (e.g. node doesn't support gRPC-Web yet)
    }

    const response = await fetchWithTimeout(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'suix_getBalance',
        params: [address, SUI_COIN_TYPE],
      }),
    });

    if (!response.ok) throw new Error(response.statusText);

    const data = (await response.json()) as {
      error?: { message: string };
      result?: { totalBalance?: string };
    };
    if (data.error) throw new Error(data.error.message);

    const totalBalance = data.result?.totalBalance;
    if (totalBalance) {
      return (parseInt(totalBalance, 10) / MIST_PER_SUI).toFixed(4);
    }
    return '0';
  }

  public async getBalance(address: string): Promise<string> {
    // Try RPC first
    try {
      const rpcUrl = await this.getActiveRpcUrl();
      if (rpcUrl) {
        return await this.fetchBalanceViaRpc(address, rpcUrl);
      }
    } catch {
      // Fall back to CLI
    }

    try {
      const output = await this.executor.execute(['client', 'balance', address], { json: true });
      const data = JSON.parse(output);

      if (Array.isArray(data) && data.length >= 1 && Array.isArray(data[0])) {
        const groups = data[0];
        let totalSui = 0;
        for (const group of groups) {
          if (Array.isArray(group) && group.length === 2) {
            const coins = group[1];
            if (Array.isArray(coins)) {
              for (const coin of coins) {
                if (coin.coinType === SUI_COIN_TYPE) {
                  totalSui += parseInt(coin.balance || '0', 10);
                }
              }
            }
          }
        }
        return (totalSui / MIST_PER_SUI).toFixed(4);
      }

      if (Array.isArray(data) && data.length > 0) {
        const suiBalance = data.find((b: any) => b.coinType === SUI_COIN_TYPE);
        if (suiBalance?.totalBalance) {
          return (parseInt(suiBalance.totalBalance, 10) / MIST_PER_SUI).toFixed(4);
        }
      }

      return '0';
    } catch (e) {
      const errStr = String(e);
      if (
        errStr.includes('No gas objects') ||
        errStr.includes('No coins') ||
        errStr.includes('not found')
      ) {
        return '0';
      }
      throw e;
    }
  }

  public async getGasCoins(address: string): Promise<GasCoin[]> {
    try {
      const output = await this.executor.execute(['client', 'gas', address], { json: true });
      const data = JSON.parse(output);

      if (Array.isArray(data)) {
        return data.map((coin: any) => ({
          coinObjectId: coin.gasCoinId || coin.gas_coin_id || coin.id?.id || '',
          balance: String(coin.mistBalance || coin.mist_balance || parseInt(coin.balance, 10) || 0),
          version: coin.version || '',
          digest: coin.digest || '',
        }));
      }
      return [];
    } catch {
      return [];
    }
  }

  public async splitCoin(
    coinId: string,
    amounts: string[],
    gasBudget: string = '10000000'
  ): Promise<string> {
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
    return this.executor.execute(args, { json: true });
  }

  public async mergeCoins(
    primaryCoinId: string,
    coinIdsToMerge: string[],
    gasBudget: string = '10000000'
  ): Promise<string> {
    const args = [
      'client',
      'merge-coin',
      '--primary-coin',
      primaryCoinId,
      '--coin-to-merge',
      ...coinIdsToMerge,
      '--gas-budget',
      gasBudget,
    ];
    return this.executor.execute(args, { json: true });
  }

  public async getObjects(address: string): Promise<DecodedRawObject[]> {
    // gRPC first: `sui client objects` serializes one slow (~40s for a large
    // wallet) multi-object RPC call that borderline-exceeds the executor timeout
    // and hangs the list. gRPC pages the same data quickly and hands back the
    // full type string + a real owner instead of raw BCS we'd decode locally.
    try {
      const rpcUrl = await this.getActiveRpcUrl();
      if (rpcUrl) {
        try {
          return await getOwnedObjectsViaGrpc(address, rpcUrl);
        } catch {
          // gRPC unavailable (e.g. localnet without a gRPC endpoint) - fall back to CLI.
        }
      }
      const data = await this.getRawObjects(address);
      return data.map(decodeRawObject);
    } catch {
      return [];
    }
  }

  /** Undecoded `sui client objects --json` output. Exists so callers that need to derive
   * more than one thing from the same objects list (count + published-package filtering)
   * can share a single CLI subprocess call instead of each re-fetching and re-decoding it. */
  public async getRawObjects(address: string): Promise<any[]> {
    const output = await this.executor.execute(['client', 'objects', address], { json: true });
    const data = JSON.parse(output);
    return Array.isArray(data) ? data : [];
  }

  public async getObject(objectId: string): Promise<any> {
    // RPC first - only path that can return Display-standard metadata (`display.data`),
    // which the CLI's `client object` output never includes. Falls back to the CLI when
    // there's no active RPC URL (e.g. localnet) or the RPC call fails outright.
    const rpcUrl = await this.getActiveRpcUrl();
    if (rpcUrl) {
      try {
        const response = await fetchWithTimeout(rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'sui_getObject',
            params: [
              objectId,
              {
                showType: true,
                showContent: true,
                showOwner: true,
                showDisplay: true,
                showPreviousTransaction: true,
                showStorageRebate: true,
              },
            ],
          }),
        });
        if (response.ok) {
          const result = (await response.json()) as { result?: { data?: unknown } };
          if (result.result?.data) return result.result.data;
        }
      } catch {
        // fall through to CLI
      }
    }

    const output = await this.executor.execute(['client', 'object', objectId], { json: true });

    // Handle "Object does not exist" case - CLI returns plain text instead of JSON
    if (output.includes('does not exist') || output.includes('not found')) {
      throw new Error(`Object ${objectId} does not exist`);
    }

    return JSON.parse(output);
  }

  /**
   * GraphQL (indexer + archival store) first - the local `sui client tx-block`
   * CLI talks to a full node, which prunes older transactions and 404s on
   * anything but recent activity. Falls back to the CLI where GraphQL isn't
   * available (localnet) or the transaction genuinely can't be found there either.
   */
  public async getTransactionBlock(digest: string): Promise<any> {
    const rpcUrl = await this.getActiveRpcUrl();
    if (rpcUrl) {
      const summary = await getTransactionSummary(digest, rpcUrl);
      if (summary) return summary;
    }

    const output = await this.executor.execute(['client', 'tx-block', digest], { json: true });
    return JSON.parse(output);
  }

  /** GraphQL-only (see `getObjectVersionHistory` in GraphQLService.ts for why there's no CLI
   * fallback) - returns `null` when there's no active RPC / no GraphQL endpoint for this
   * network, or `[]` when the walk found nothing (e.g. genesis reached immediately). */
  public async getObjectVersionHistory(
    objectId: string,
    currentVersion: string,
    currentPreviousTx: string
  ): Promise<{ version: string; txDigest: string; timestampMs: number | null }[] | null> {
    const rpcUrl = await this.getActiveRpcUrl();
    if (!rpcUrl) return null;
    return getObjectVersionHistory(objectId, currentVersion, currentPreviousTx, rpcUrl);
  }

  public async getPackageSummary(packageId: string): Promise<any> {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const os = await import('node:os');

    // Create temp directory for output
    const tempDir = path.join(os.tmpdir(), `sui-pkg-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });

    try {
      // Run sui move summary
      await this.executor.execute([
        'move',
        'summary',
        '--package-id',
        packageId,
        '--bytecode',
        '--output-directory',
        tempDir,
      ]);

      // Read the generated files
      const result: any = {
        packageId,
        modules: [],
        metadata: null,
      };

      // Read root package metadata
      const metadataPath = path.join(tempDir, 'root_package_metadata.json');
      try {
        const metadataContent = await fs.readFile(metadataPath, 'utf-8');
        result.metadata = JSON.parse(metadataContent);
      } catch {
        // Metadata might not exist
      }

      // Read module summaries
      const packageDir = path.join(tempDir, packageId);
      try {
        const files = await fs.readdir(packageDir);
        for (const file of files) {
          if (file.endsWith('.json')) {
            const modulePath = path.join(packageDir, file);
            const moduleContent = await fs.readFile(modulePath, 'utf-8');
            const moduleData = JSON.parse(moduleContent);
            result.modules.push({
              name: file.replace('.json', ''),
              ...moduleData,
            });
          }
        }
      } catch {
        // Package directory might not exist
      }

      return result;
    } finally {
      // Cleanup temp directory
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  public async callFunction(
    packageId: string,
    module: string,
    functionName: string,
    typeArgs: string[] = [],
    args: string[] = [],
    gasBudget: string = '10000000'
  ): Promise<any> {
    // Validate all inputs to prevent command injection
    const validPackageId = validateObjectId(packageId, 'packageId');
    const validModule = validateModuleName(module);
    const validFunction = validateFunctionName(functionName);
    const validTypeArgs = validateTypeArgs(typeArgs);
    const validArgs = validateMoveArgs(args);
    const validGasBudget = validateOptionalGasBudget(gasBudget) || '10000000';

    const cmdArgs = [
      'client',
      'call',
      '--package',
      validPackageId,
      '--module',
      validModule,
      '--function',
      validFunction,
      '--gas-budget',
      validGasBudget,
    ];

    if (validTypeArgs.length > 0) {
      cmdArgs.push('--type-args', ...validTypeArgs);
    }

    if (validArgs.length > 0) {
      cmdArgs.push('--args', ...validArgs);
    }

    const output = await this.executor.execute(cmdArgs, { json: true });
    return JSON.parse(output);
  }

  public async dryRunCall(
    packageId: string,
    module: string,
    functionName: string,
    typeArgs: string[] = [],
    args: string[] = [],
    gasBudget: string = '10000000'
  ): Promise<any> {
    // Validate all inputs to prevent command injection
    const validPackageId = validateObjectId(packageId, 'packageId');
    const validModule = validateModuleName(module);
    const validFunction = validateFunctionName(functionName);
    const validTypeArgs = validateTypeArgs(typeArgs);
    const validArgs = validateMoveArgs(args);
    const validGasBudget = validateOptionalGasBudget(gasBudget) || '10000000';

    const cmdArgs = [
      'client',
      'call',
      '--package',
      validPackageId,
      '--module',
      validModule,
      '--function',
      validFunction,
      '--gas-budget',
      validGasBudget,
      '--dry-run',
    ];

    if (validTypeArgs.length > 0) {
      cmdArgs.push('--type-args', ...validTypeArgs);
    }

    if (validArgs.length > 0) {
      cmdArgs.push('--args', ...validArgs);
    }

    const output = await this.executor.execute(cmdArgs, { json: true });
    return JSON.parse(output);
  }

  /**
   * Reconstruct a real on-chain balance timeline for an address, from its
   * first transaction to now.
   *
   * Primary source: the GraphQL RPC `transactions(filter: { affectedAddress })`
   * query (GraphQLService), backed by the General-Purpose Indexer + Archival
   * Store - this covers the address's entire on-chain history, not just a
   * pruned fullnode window.
   *
   * Fallback: for networks without a public GraphQL endpoint (e.g. localnet),
   * or if the GraphQL request fails, every owned object still carries the
   * digest of the transaction that last touched it - we batch-fetch those over
   * gRPC and walk the balance backwards from the current balance. This only
   * covers transactions that last-touched a *currently owned* object, so it's
   * a partial trend rather than full history.
   */
  public async getHistoricalBalance(
    address: string
  ): Promise<{ timestamp: number; balance: number }[]> {
    const rpcUrl = await this.getActiveRpcUrl();
    if (!rpcUrl) {
      throw new Error('No active RPC URL found');
    }

    const currentBalanceStr = await this.getBalance(address);
    const currentBalanceMist = BigInt(Math.round(parseFloat(currentBalanceStr) * MIST_PER_SUI));

    const history: { timestamp: number; balance: number }[] = [
      { timestamp: Date.now(), balance: Number(currentBalanceMist) / MIST_PER_SUI },
    ];

    let effects: TransactionBalanceEffect[] | null = await getAddressBalanceEffects(
      address,
      rpcUrl
    );

    if (effects === null) {
      const objects = await this.getObjects(address);
      const digests = objects
        .map((obj) => obj.previousTransaction)
        .filter((d): d is string => typeof d === 'string' && d.length > 0);
      effects =
        digests.length > 0
          ? await getTransactionBalanceEffectsViaGrpc(address, digests, rpcUrl)
          : [];
    }

    if (effects.length === 0) {
      return history;
    }

    // Newest first, so we can walk the balance backwards through time
    effects.sort((a, b) => b.timestampMs - a.timestampMs);

    let runningBalance = currentBalanceMist;

    for (const effect of effects) {
      // Balance right after this transaction executed
      history.push({
        timestamp: effect.timestampMs,
        balance: Number(runningBalance) / MIST_PER_SUI,
      });
      // Balance before this transaction = balance after it minus its delta
      runningBalance -= effect.suiDeltaMist;
    }

    return history.sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Batch-decode Walrus `Blob` objects (size, certification, storage window)
   * plus each one's last-touched timestamp, for a set of object IDs. Used to
   * enrich the "Walrus Memory" list view - the plain objects list only has
   * raw BCS bytes with nothing decoded, so this exists to avoid spawning one
   * `sui client object` CLI subprocess per row.
   */
  public async getBlobSummaries(objectIds: string[]): Promise<BlobSummary[]> {
    if (objectIds.length === 0) return [];

    const rpcUrl = await this.getActiveRpcUrl();
    if (!rpcUrl) {
      throw new Error('No active RPC URL found');
    }

    const objects = await getObjectsJsonViaGrpc(objectIds, rpcUrl);

    const digests = objects
      .map((o) => o.previousTransaction)
      .filter((d): d is string => typeof d === 'string' && d.length > 0);

    // GraphQL (indexer + archival store) first - a full node prunes older
    // transactions, so a gRPC digest lookup 404s for anything but recent
    // activity. Fall back to gRPC only where GraphQL isn't available (localnet).
    let timestamps: Record<string, number> | null = null;
    if (digests.length > 0) {
      timestamps = await getTransactionTimestamps(digests, rpcUrl);
      if (timestamps === null) {
        timestamps = await getTransactionTimestampsViaGrpc(digests, rpcUrl);
      }
    }
    timestamps = timestamps ?? {};

    return objects.map((obj) => {
      const fields = (obj.json ?? {}) as Record<string, unknown>;
      const storage = (fields.storage ?? {}) as Record<string, unknown>;

      const toNumber = (v: unknown): number | null => {
        if (v === null || v === undefined) return null;
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
      };

      return {
        objectId: obj.objectId,
        blobId: fields.blob_id !== undefined ? String(fields.blob_id) : null,
        size: toNumber(fields.size),
        encodingType: toNumber(fields.encoding_type),
        registeredEpoch: toNumber(fields.registered_epoch),
        certifiedEpoch: toNumber(fields.certified_epoch),
        deletable: Boolean(fields.deletable),
        storageStartEpoch: toNumber(storage.start_epoch),
        storageEndEpoch: toNumber(storage.end_epoch),
        storageSize: toNumber(storage.storage_size),
        lastTouchedMs: obj.previousTransaction
          ? (timestamps[obj.previousTransaction] ?? null)
          : null,
      };
    });
  }

  /**
   * Batch-fetch presentation metadata (image, name, a few key attributes) for
   * NFT objects, so the list/inspector can render a real preview instead of a
   * hex id. Like {@link getBlobSummaries}, this uses gRPC's decoded `json` field
   * to avoid one CLI subprocess per row. Objects with no image field (e.g.
   * stat-only game NFTs) return `imageUrl: null` and carry their attributes so
   * the UI can fall back to a generated visual + key stats.
   */
  public async getNftMetadata(objectIds: string[]): Promise<NftMetadata[]> {
    if (objectIds.length === 0) return [];

    const rpcUrl = await this.getActiveRpcUrl();
    if (!rpcUrl) {
      throw new Error('No active RPC URL found');
    }

    const objects = await getObjectsJsonViaGrpc(objectIds, rpcUrl);

    return objects.map((obj) => {
      const fields = (obj.json ?? {}) as Record<string, unknown>;
      return {
        objectId: obj.objectId,
        imageUrl: extractImageUrl(fields),
        name: extractName(fields),
        attributes: extractAttributes(fields),
      };
    });
  }
}

export interface NftMetadata {
  objectId: string;
  /** Resolved http(s)/data image URL, or null when the NFT carries no image. */
  imageUrl: string | null;
  name: string | null;
  /** A few primitive fields (rarity, atk, ...) for the no-image fallback card. */
  attributes: { label: string; value: string }[];
}

const IMAGE_FIELD_KEYS = [
  'image_url',
  'image',
  'img_url',
  'imageuri',
  'image_uri',
  'url',
  'media_url',
  'media',
];

/** ipfs://CID and bare CIDs -> a public gateway; http(s)/data URIs pass through. */
function normalizeImageUrl(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  if (v.startsWith('http://') || v.startsWith('https://') || v.startsWith('data:')) return v;
  if (v.startsWith('ipfs://'))
    return `https://ipfs.io/ipfs/${v.slice('ipfs://'.length).replace(/^ipfs\//, '')}`;
  if (/^(Qm[1-9A-Za-z]{44}|baf[0-9a-z]+)/.test(v)) return `https://ipfs.io/ipfs/${v}`;
  return null;
}

function extractImageUrl(fields: Record<string, unknown>): string | null {
  for (const key of Object.keys(fields)) {
    if (IMAGE_FIELD_KEYS.includes(key.toLowerCase())) {
      const val = fields[key];
      if (typeof val === 'string') {
        const url = normalizeImageUrl(val);
        if (url) return url;
      }
    }
  }
  return null;
}

function extractName(fields: Record<string, unknown>): string | null {
  for (const key of ['name', 'title', 'skill_name']) {
    const val = fields[key];
    if (typeof val === 'string' && val.trim()) return val.trim();
  }
  return null;
}

const ATTR_SKIP_KEYS = new Set(['id', 'name', 'title', 'description', ...IMAGE_FIELD_KEYS]);

/** Snake_case -> Title Case for attribute labels. */
function titleCase(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function extractAttributes(fields: Record<string, unknown>): { label: string; value: string }[] {
  const out: { label: string; value: string }[] = [];
  for (const [key, val] of Object.entries(fields)) {
    if (ATTR_SKIP_KEYS.has(key.toLowerCase())) continue;
    if (val === null || val === undefined) continue;
    if (typeof val === 'object') continue; // only surface primitives in the compact fallback
    const str = typeof val === 'number' && Number.isInteger(val) ? String(val) : String(val);
    out.push({ label: titleCase(key), value: str });
    if (out.length >= 5) break;
  }
  return out;
}
