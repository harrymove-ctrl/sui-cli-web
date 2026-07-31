import { EncryptedObject, SealClient, SessionKey } from '@mysten/seal';
import { bcs } from '@mysten/sui/bcs';
import { Transaction } from '@mysten/sui/transactions';
import { fromHex, normalizeSuiAddress, toHex } from '@mysten/sui/utils';
import fetch from 'node-fetch';
import { ConfigParser } from '../cli/ConfigParser';
import { SuiCliExecutor } from '../cli/SuiCliExecutor';
import { loadLocalKeypairForAddress } from '../utils/localKeystore';
import { getObjectsJsonViaGrpc, getSharedGrpcClient, inferNetwork } from '../utils/suiGrpcClient';

// Verified against the deployed testnet/mainnet packages directly (gRPC
// MovePackageService.getMoveFunction) - see docs/contract/overview.md in
// MystenLabs/MemWal for the canonical values.
const NETWORK_CONFIG: Record<
  string,
  { packageId: string; registryId: string; sealServers: { objectId: string; weight: number }[] }
> = {
  testnet: {
    packageId: '0xcf6ad755a1cdff7217865c796778fabe5aa399cb0cf2eba986f4b582047229c6',
    registryId: '0xe80f2feec1c139616a86c9f71210152e2a7ca552b20841f2e192f99f75864437',
    sealServers: [
      { objectId: '0x73d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db75', weight: 1 },
      { objectId: '0xf5d14a81a982144ae441cd7d64b09027f116a468bd36e7eca494f750591623c8', weight: 1 },
    ],
  },
  mainnet: {
    packageId: '0xcee7a6fd8de52ce645c38332bde23d4a30fd9426bc4681409733dd50958a24c6',
    registryId: '0x0da982cefa26864ae834a8a0504b904233d49e20fcc17c373c8bed99c75a7edd',
    sealServers: [
      { objectId: '0x145540d931f182fef76467dd8074c9839aea126852d90d18e1556fcbbd1208b6', weight: 1 },
      { objectId: '0xe0eb52eba9261b96e895bbb4deca10dcd64fbc626a1133017adcd5131353fd10', weight: 1 },
    ],
  },
};

const WALRUS_AGGREGATORS: Record<string, string[]> = {
  testnet: [
    'https://aggregator.walrus-testnet.walrus.space',
    'https://walrus-testnet-aggregator.natsai.xyz',
    'https://walrus-testnet.blockscope.net',
  ],
  mainnet: ['https://aggregator.walrus-mainnet.walrus.space'],
};

export interface DelegateKeySummary {
  label: string;
  suiAddress: string;
  createdAt: number | null;
}

export interface MemwalAccountSummary {
  accountId: string;
  owner: string | null;
  active: boolean;
  createdAt: number | null;
  delegateKeys: DelegateKeySummary[];
}

export interface DecryptResult {
  isText: boolean;
  text?: string;
  base64?: string;
  byteLength: number;
}

export class WalrusMemoryService {
  private configParser = ConfigParser.getInstance();
  private cliExecutor = SuiCliExecutor.getInstance();

  private async getActiveRpcUrl(): Promise<string> {
    const rpcUrl = await this.configParser.getActiveRpcUrl();
    if (!rpcUrl) throw new Error('No active RPC URL found');
    return rpcUrl;
  }

  private getNetworkConfig(rpcUrl: string) {
    const network = inferNetwork(rpcUrl);
    const config = NETWORK_CONFIG[network];
    if (!config) {
      throw new Error(
        `Walrus Memory is only available on mainnet/testnet (active network: ${network})`
      );
    }
    return { network, ...config };
  }

  /**
   * Resolve the MemWalAccount object ID for `ownerAddress` by scanning the
   * AccountRegistry's Table<address, ID> dynamic fields. There's no by-key
   * lookup primitive that reliably decodes non-primitive values on the gRPC
   * SDK's experimental client, so this walks pages of raw DynamicField
   * entries (well-defined proto, unlike the buggy convenience wrapper) and
   * stops at the first match.
   */
  public async getAccountId(ownerAddress: string): Promise<string | null> {
    const rpcUrl = await this.getActiveRpcUrl();
    const { registryId } = this.getNetworkConfig(rpcUrl);
    const client = getSharedGrpcClient(rpcUrl);

    const registry = (await getObjectsJsonViaGrpc([registryId], rpcUrl))[0];
    const tableId = (registry?.json as { accounts?: { id?: string } } | undefined)?.accounts?.id;
    if (!tableId) return null;

    const normalized = normalizeSuiAddress(ownerAddress);
    let pageToken: Uint8Array | undefined;
    const MAX_PAGES = 10; // 10 * 1000 = up to 10k registered accounts

    for (let page = 0; page < MAX_PAGES; page++) {
      const { response } = await (client as any).stateService.listDynamicFields({
        parent: tableId,
        pageSize: 1000,
        pageToken,
        readMask: { paths: ['name', 'value'] },
      });

      for (const field of response.dynamicFields) {
        const nameHex = '0x' + toHex(field.name?.value ?? new Uint8Array());
        if (nameHex === normalized) {
          return '0x' + toHex(field.value?.value ?? new Uint8Array());
        }
      }

      pageToken = response.nextPageToken;
      if (!pageToken || pageToken.length === 0) break;
    }

    return null;
  }

  public async getAccountDetails(accountId: string): Promise<MemwalAccountSummary | null> {
    const rpcUrl = await this.getActiveRpcUrl();
    const obj = (await getObjectsJsonViaGrpc([accountId], rpcUrl))[0];
    const fields = obj?.json as Record<string, unknown> | undefined;
    if (!fields) return null;

    const delegateKeys = Array.isArray(fields.delegate_keys)
      ? (fields.delegate_keys as Record<string, unknown>[]).map((k) => ({
          label: String(k.label ?? ''),
          suiAddress: String(k.sui_address ?? ''),
          createdAt: k.created_at !== undefined ? Number(k.created_at) : null,
        }))
      : [];

    return {
      accountId,
      owner: fields.owner !== undefined ? String(fields.owner) : null,
      active: Boolean(fields.active),
      createdAt: fields.created_at !== undefined ? Number(fields.created_at) : null,
      delegateKeys,
    };
  }

  /**
   * Register a new delegate key on a MemWalAccount, so a second address can
   * decrypt/seal_approve on behalf of the account owner. Must be signed by
   * the account owner (enforced on-chain; a non-owner signer aborts).
   *
   * `account::add_delegate_key(account: &mut MemWalAccount, key: vector<u8>,
   * delegate_address: address, label: String, clock: &Clock, ctx)` - verified
   * directly against the deployed testnet package via a dry-run: `key` must
   * be exactly the delegate address's raw 32 bytes (bcs::to_bytes(address)),
   * not an arbitrary public key - a mismatched `key` aborts with MoveAbort
   * code 5 (confirmed by dry-running with `[1,2,3]` instead).
   *
   * This shells out to the real `sui` CLI (this app's convention for writes,
   * see CoinService/AddressService) rather than signing in-process, since
   * `sui client ptb`'s `--json` flag does not actually emit machine-readable
   * JSON for this subcommand on the installed CLI version - output is parsed
   * from the human-readable table instead (see parsePtbOutput).
   */
  public async addDelegateKey(
    accountId: string,
    ownerAddress: string,
    delegateAddress: string,
    label: string
  ): Promise<{ digest: string }> {
    const rpcUrl = await this.getActiveRpcUrl();
    const { packageId } = this.getNetworkConfig(rpcUrl);

    const normalizedOwner = normalizeSuiAddress(ownerAddress);
    const normalizedDelegate = normalizeSuiAddress(delegateAddress);

    if (normalizedDelegate === normalizedOwner) {
      throw new Error('The account owner cannot also be added as a delegate');
    }
    const existingAccount = await this.getAccountDetails(accountId);
    if (
      existingAccount?.delegateKeys.some(
        (k) => normalizeSuiAddress(k.suiAddress) === normalizedDelegate
      )
    ) {
      throw new Error('This address is already a registered delegate for this account');
    }

    const keyBytes = Array.from(fromHex(normalizedDelegate.slice(2)));

    const ptbArgs = [
      'client',
      'ptb',
      '--sender',
      `@${normalizedOwner}`,
      '--make-move-vec',
      '<u8>',
      `[${keyBytes.join(',')}]`,
      '--assign',
      'delegate_key_bytes',
      '--move-call',
      `${packageId}::account::add_delegate_key`,
      `@${accountId}`,
      'delegate_key_bytes',
      `@${normalizedDelegate}`,
      `"${label}"`,
      '@0x6',
      '--gas-budget',
      '50000000',
    ];

    return this.runPtbDryRunThenExecute(ptbArgs);
  }

  /**
   * Revoke a previously-registered delegate key. `account::remove_delegate_key(
   * account: &mut MemWalAccount, key: vector<u8>, ctx)` - same `key` convention
   * as add_delegate_key (the delegate address's raw 32 bytes), verified against
   * the deployed package's function signature via gRPC MovePackageService.
   */
  public async removeDelegateKey(
    accountId: string,
    ownerAddress: string,
    delegateAddress: string
  ): Promise<{ digest: string }> {
    const rpcUrl = await this.getActiveRpcUrl();
    const { packageId } = this.getNetworkConfig(rpcUrl);

    const normalizedOwner = normalizeSuiAddress(ownerAddress);
    const normalizedDelegate = normalizeSuiAddress(delegateAddress);
    const keyBytes = Array.from(fromHex(normalizedDelegate.slice(2)));

    const ptbArgs = [
      'client',
      'ptb',
      '--sender',
      `@${normalizedOwner}`,
      '--make-move-vec',
      '<u8>',
      `[${keyBytes.join(',')}]`,
      '--assign',
      'delegate_key_bytes',
      '--move-call',
      `${packageId}::account::remove_delegate_key`,
      `@${accountId}`,
      'delegate_key_bytes',
      '--gas-budget',
      '50000000',
    ];

    return this.runPtbDryRunThenExecute(ptbArgs);
  }

  /**
   * Dry-run a PTB command first so a MoveAbort surfaces without spending real
   * gas or mutating shared state, then execute it for real if the dry run
   * succeeds. Shared by addDelegateKey/removeDelegateKey.
   */
  private async runPtbDryRunThenExecute(ptbArgs: string[]): Promise<{ digest: string }> {
    const dryRunOutput = await this.cliExecutor.execute([...ptbArgs, '--dry-run'], {
      timeout: 60000,
    });
    const dryRunResult = this.parsePtbOutput(dryRunOutput, true);
    if (!dryRunResult.success) {
      throw new Error(dryRunResult.error ?? 'Dry run failed');
    }

    const output = await this.cliExecutor.execute(ptbArgs, { timeout: 60000 });
    const result = this.parsePtbOutput(output, false);
    if (!result.success) {
      throw new Error(result.error ?? 'Transaction failed');
    }
    // A missing digest here means the CLI reported success but our output
    // parsing couldn't find it - the transaction still landed on-chain, so
    // this must not be reported as a failure (see parsePtbOutput).
    return {
      digest:
        result.digest ?? 'unknown (transaction succeeded - check your wallet or a block explorer)',
    };
  }

  private parsePtbOutput(
    output: string,
    isDryRun: boolean
  ): { success: boolean; digest?: string; error?: string } {
    const digestMatch = output.match(/Digest:\s*(\S+)/);
    const success = isDryRun
      ? /execution status:\s*success/i.test(output)
      : /Status:\s*Success/i.test(output);

    if (success) {
      return { success: true, digest: digestMatch?.[1] };
    }

    const errorMatch =
      output.match(/Execution error:\s*(.+)/) ||
      output.match(/execution status:\s*failure due to (.+?)(?:\n|$)/i);
    return {
      success: false,
      digest: digestMatch?.[1],
      error: errorMatch?.[1]?.trim() ?? 'Transaction failed',
    };
  }

  /** Walrus's canonical Blob ID string (url-safe base64) from the on-chain u256 blob_id. */
  private walrusBlobIdFromU256(blobIdDecimal: string): string {
    return bcs
      .u256()
      .serialize(BigInt(blobIdDecimal))
      .toBase64()
      .replace(/=*$/, '')
      .replaceAll('+', '-')
      .replaceAll('/', '_');
  }

  private async fetchBlobBytes(walrusBlobId: string, network: string): Promise<Uint8Array> {
    const aggregators = WALRUS_AGGREGATORS[network] ?? [];
    const errors: string[] = [];

    for (const base of aggregators) {
      try {
        const res = await fetch(`${base}/v1/blobs/${walrusBlobId}`, {
          signal: AbortSignal.timeout(20_000),
        });
        if (res.ok) {
          return new Uint8Array(await res.arrayBuffer());
        }
        errors.push(`${base}: HTTP ${res.status}`);
      } catch (e) {
        errors.push(`${base}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    throw new Error(
      `Blob not retrievable from any Walrus aggregator (likely past its storage window / garbage-collected): ${errors.join('; ')}`
    );
  }

  /**
   * Decrypt a Walrus Memory Blob's content. `signerAddress` must be an
   * address whose keypair is present in the LOCAL sui.keystore - the owner
   * of the MemWalAccount, or a registered delegate key already imported into
   * the local keystore (`sui keytool import`). The keypair is loaded
   * in-process only to sign the SEAL SessionKey and is never persisted,
   * logged, or returned.
   */
  public async decryptBlob(blobObjectId: string, signerAddress: string): Promise<DecryptResult> {
    const rpcUrl = await this.getActiveRpcUrl();
    const { network, packageId } = this.getNetworkConfig(rpcUrl);

    const blobObj = (await getObjectsJsonViaGrpc([blobObjectId], rpcUrl))[0];
    const blobIdDecimal = (blobObj?.json as { blob_id?: unknown } | undefined)?.blob_id;
    if (blobIdDecimal === undefined) {
      throw new Error('Not a Walrus Blob object (missing blob_id field)');
    }

    const walrusBlobId = this.walrusBlobIdFromU256(String(blobIdDecimal));
    const encryptedBytes = await this.fetchBlobBytes(walrusBlobId, network);

    const keypair = await loadLocalKeypairForAddress(signerAddress);
    if (!keypair) {
      throw new Error(`No keypair for ${signerAddress} found in the local sui.keystore`);
    }

    const client = getSharedGrpcClient(rpcUrl);
    const { sealServers } = NETWORK_CONFIG[network];
    const threshold = Math.min(
      2,
      sealServers.reduce((sum, s) => sum + s.weight, 0)
    );

    const sealClient = new SealClient({
      suiClient: client as any,
      serverConfigs: sealServers,
      verifyKeyServers: true,
    });

    const parsed = EncryptedObject.parse(encryptedBytes);
    const idBytes = fromHex(parsed.id);

    // The encrypted object's `id` is `bcs::to_bytes(owner)` (see memwal::account::seal_key_id) -
    // i.e. the owner's raw 32-byte address - so the account this memory belongs to can be
    // derived from the ciphertext itself, rather than requiring the caller to supply it.
    if (idBytes.length !== 32) {
      throw new Error(`Unexpected SEAL id length (${idBytes.length} bytes, expected 32)`);
    }
    const ownerAddress = normalizeSuiAddress('0x' + parsed.id);
    const accountId = await this.getAccountId(ownerAddress);
    if (!accountId) {
      throw new Error(`No MemWalAccount found on-chain for owner ${ownerAddress}`);
    }

    const sessionKey = await SessionKey.create({
      address: signerAddress,
      packageId,
      ttlMin: 5,
      signer: keypair,
      suiClient: client as any,
    });

    const tx = new Transaction();
    tx.moveCall({
      target: `${packageId}::account::seal_approve`,
      arguments: [tx.pure('vector<u8>', Array.from(idBytes)), tx.object(accountId)],
    });
    // Note: seal_approve takes the MemWalAccount object, not the AccountRegistry -
    // verified directly against the deployed package's function signature via
    // gRPC MovePackageService, since the reference script's comment (AccountRegistry)
    // is stale relative to what's actually deployed.
    const txBytes = await tx.build({ client: client as any, onlyTransactionKind: true });

    await sealClient.fetchKeys({ ids: [parsed.id], txBytes, sessionKey, threshold });
    const decrypted = await sealClient.decrypt({ data: encryptedBytes, sessionKey, txBytes });

    const decoder = new TextDecoder('utf-8', { fatal: true });
    try {
      const text = decoder.decode(decrypted);
      return { isText: true, text, byteLength: decrypted.length };
    } catch {
      return {
        isText: false,
        base64: Buffer.from(decrypted).toString('base64'),
        byteLength: decrypted.length,
      };
    }
  }
}
