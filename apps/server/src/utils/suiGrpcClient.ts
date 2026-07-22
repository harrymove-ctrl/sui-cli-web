import { SuiGrpcClient } from '@mysten/sui/grpc';

// One SuiGrpcClient per fullnode URL - transports are cheap to reuse, not to recreate per call.
const clientCache = new Map<string, SuiGrpcClient>();

export function inferNetwork(rpcUrl: string): string {
  try {
    const host = new URL(rpcUrl).hostname;
    if (host.includes('mainnet')) return 'mainnet';
    if (host.includes('testnet')) return 'testnet';
    if (host.includes('devnet')) return 'devnet';
    if (host === 'localhost' || host === '127.0.0.1') return 'localnet';
  } catch {
    // Fall through to default below
  }
  return 'testnet';
}

function getGrpcClient(rpcUrl: string): SuiGrpcClient {
  let client = clientCache.get(rpcUrl);
  if (!client) {
    client = new SuiGrpcClient({ network: inferNetwork(rpcUrl), baseUrl: rpcUrl });
    clientCache.set(rpcUrl, client);
  }
  return client;
}

/** Shared cached gRPC client for a given RPC URL - exported so other services
 * (e.g. WalrusMemoryService) reuse the same transport instead of opening a new one. */
export function getSharedGrpcClient(rpcUrl: string): SuiGrpcClient {
  return getGrpcClient(rpcUrl);
}

export async function getBalanceViaGrpc(
  address: string,
  rpcUrl: string,
  coinType: string
): Promise<string> {
  const client = getGrpcClient(rpcUrl);
  const { balance } = await client.core.getBalance({ address, coinType });
  return balance.balance;
}

export async function getAllBalancesViaGrpc(
  address: string,
  rpcUrl: string
): Promise<{ coinType: string; balance: string }[]> {
  const client = getGrpcClient(rpcUrl);
  const balances: { coinType: string; balance: string }[] = [];
  let cursor: string | null | undefined;
  do {
    const page = await client.core.getAllBalances({ address, limit: 200, cursor });
    balances.push(...page.balances);
    cursor = page.hasNextPage ? page.cursor : null;
  } while (cursor);
  return balances;
}

export interface TransactionBalanceEffect {
  digest: string;
  /** Unix ms of the checkpoint containing this transaction */
  timestampMs: number;
  /** Net SUI delta (in MIST, signed) for the given address in this transaction */
  suiDeltaMist: bigint;
}

const BATCH_SIZE = 20;

/**
 * Fetch timestamp + this-address SUI balance change for a set of transaction
 * digests, in concurrent batches. Digests with errors (pruned/unknown) are
 * skipped rather than failing the whole set.
 */
export async function getTransactionBalanceEffectsViaGrpc(
  address: string,
  digests: string[],
  rpcUrl: string
): Promise<TransactionBalanceEffect[]> {
  const client = getGrpcClient(rpcUrl);
  const unique = [...new Set(digests)];

  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += BATCH_SIZE) {
    chunks.push(unique.slice(i, i + BATCH_SIZE));
  }

  const normalizedAddress = address.toLowerCase();
  const results = await Promise.all(
    chunks.map(async (chunk) => {
      try {
        const { response } = await client.ledgerService.batchGetTransactions({
          digests: chunk,
          readMask: { paths: ['digest', 'timestamp', 'balance_changes'] },
        });
        const effects: TransactionBalanceEffect[] = [];
        for (const result of response.transactions) {
          if (result.result.oneofKind !== 'transaction') continue;
          const tx = result.result.transaction;
          if (!tx.timestamp) continue;
          let delta = BigInt(0);
          for (const change of tx.balanceChanges) {
            // coinType may come back short (0x2::sui::SUI) or fully padded
            if (
              change.address?.toLowerCase() === normalizedAddress &&
              change.coinType?.endsWith('::sui::SUI') &&
              change.amount
            ) {
              delta += BigInt(change.amount);
            }
          }
          effects.push({
            digest: tx.digest ?? '',
            timestampMs: Number(tx.timestamp.seconds) * 1000,
            suiDeltaMist: delta,
          });
        }
        return effects;
      } catch {
        return [] as TransactionBalanceEffect[];
      }
    })
  );

  return results.flat();
}

export interface OwnedObjectSummary {
  objectId: string | null;
  /** Full type string, e.g. "0x2::coin::Coin<0x2::sui::SUI>" - gRPC returns this directly,
   * unlike `sui client objects` whose raw BCS carries only a short struct name. */
  type: string;
  version: number | null;
  /** Normalized to the CLI-compatible owner shape the client already reads
   * ({ AddressOwner } / { ObjectOwner } / { Shared: { initial_shared_version } } / "Immutable"). */
  owner: unknown;
  previousTransaction: string | null;
}

/** Raw gRPC Owner proto ({ kind, address, version }) -> the CLI-style shape the
 * client's getOwnerDisplay understands. Party (CONSENSUS_ADDRESS) objects are
 * singly owned, so we surface their owner address rather than "Unknown".
 * kind enum: 1 ADDRESS, 2 OBJECT, 3 SHARED, 4 IMMUTABLE, 5 CONSENSUS_ADDRESS. */
function mapProtoOwner(o: any): unknown {
  if (!o) return null;
  switch (o.kind) {
    case 1: return { AddressOwner: o.address };
    case 2: return { ObjectOwner: o.address };
    case 3: return { Shared: { initial_shared_version: o.version?.toString() } };
    case 4: return 'Immutable';
    case 5: return { AddressOwner: o.address };
    default: return null;
  }
}

const OWNED_OBJECTS_PAGE_SIZE = 1000;

/**
 * List every object an address owns via gRPC, returning the same shape
 * `decodeRawObject` produces from the CLI. Fast replacement for `sui client
 * objects --json` (~40s serialized multi-object call for large wallets).
 *
 * Calls `stateService.listOwnedObjects` directly rather than the `core`
 * wrapper so we can pass a large `pageSize`: the wrapper's default page size
 * paginated a 353-object wallet into ~7 sequential round trips (~7s); a single
 * 1000-item page returns the same data in one (~1s). Still loops on
 * `nextPageToken` for wallets beyond one page.
 */
export async function getOwnedObjectsViaGrpc(
  address: string,
  rpcUrl: string
): Promise<OwnedObjectSummary[]> {
  const client = getGrpcClient(rpcUrl);
  const out: OwnedObjectSummary[] = [];
  let pageToken: Uint8Array | undefined;
  do {
    const { response } = await (client as any).stateService.listOwnedObjects({
      owner: address,
      pageSize: OWNED_OBJECTS_PAGE_SIZE,
      pageToken,
      readMask: { paths: ['object_id', 'object_type', 'version', 'owner', 'previous_transaction'] },
    });
    for (const o of response.objects) {
      out.push({
        objectId: o.objectId ?? null,
        type: o.objectType ?? 'Unknown',
        version: o.version != null ? Number(o.version) : null,
        owner: mapProtoOwner(o.owner),
        previousTransaction: o.previousTransaction ?? null,
      });
    }
    pageToken = response.nextPageToken && response.nextPageToken.length > 0 ? response.nextPageToken : undefined;
  } while (pageToken);
  return out;
}

export interface ObjectJsonSummary {
  objectId: string;
  objectType: string | null;
  previousTransaction: string | null;
  /** Decoded Move struct fields as JSON (the gRPC `json` field rendering). */
  json: unknown;
}

/**
 * Batch-fetch decoded Move struct content (as JSON) plus `previousTransaction`
 * for a set of object IDs, in concurrent batches. Used to enrich list views
 * (e.g. Walrus `Blob` size/certification) without spawning one `sui client
 * object` CLI subprocess per row - the list endpoint's raw BCS bytes carry no
 * decoded fields at all, but gRPC's `json` read-mask field does.
 * Objects with errors (deleted/pruned) are skipped rather than failing the set.
 */
export async function getObjectsJsonViaGrpc(
  objectIds: string[],
  rpcUrl: string
): Promise<ObjectJsonSummary[]> {
  const client = getGrpcClient(rpcUrl);
  const unique = [...new Set(objectIds)];

  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += BATCH_SIZE) {
    chunks.push(unique.slice(i, i + BATCH_SIZE));
  }

  const results = await Promise.all(
    chunks.map(async (chunk) => {
      try {
        const { response } = await client.ledgerService.batchGetObjects({
          requests: chunk.map((objectId) => ({ objectId })),
          readMask: { paths: ['object_id', 'object_type', 'previous_transaction', 'json'] },
        });
        const summaries: ObjectJsonSummary[] = [];
        for (const result of response.objects) {
          if (result.result.oneofKind !== 'object') continue;
          const obj = result.result.object;
          if (!obj.objectId) continue;
          summaries.push({
            objectId: obj.objectId,
            objectType: obj.objectType ?? null,
            previousTransaction: obj.previousTransaction ?? null,
            json: obj.json ? protobufValueToJs(obj.json) : null,
          });
        }
        return summaries;
      } catch {
        return [] as ObjectJsonSummary[];
      }
    })
  );

  return results.flat();
}

/**
 * Batch-fetch just the checkpoint timestamp for a set of transaction digests -
 * a cheaper sibling of {@link getTransactionBalanceEffectsViaGrpc} for callers
 * that only need "when was this last touched", not a balance delta.
 */
export async function getTransactionTimestampsViaGrpc(
  digests: string[],
  rpcUrl: string
): Promise<Record<string, number>> {
  const client = getGrpcClient(rpcUrl);
  const unique = [...new Set(digests)];

  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += BATCH_SIZE) {
    chunks.push(unique.slice(i, i + BATCH_SIZE));
  }

  const results = await Promise.all(
    chunks.map(async (chunk) => {
      try {
        const { response } = await client.ledgerService.batchGetTransactions({
          digests: chunk,
          readMask: { paths: ['digest', 'timestamp'] },
        });
        const entries: [string, number][] = [];
        for (const result of response.transactions) {
          if (result.result.oneofKind !== 'transaction') continue;
          const tx = result.result.transaction;
          if (!tx.digest || !tx.timestamp) continue;
          entries.push([tx.digest, Number(tx.timestamp.seconds) * 1000]);
        }
        return entries;
      } catch {
        return [] as [string, number][];
      }
    })
  );

  return Object.fromEntries(results.flat());
}

/** `google.protobuf.Value` (protobuf-ts `Value` message) -> plain JS value. */
function protobufValueToJs(value: any): unknown {
  const kind = value?.kind;
  if (!kind || kind.oneofKind === undefined || kind.oneofKind === 'nullValue') return null;
  if (kind.oneofKind === 'stringValue') return kind.stringValue;
  if (kind.oneofKind === 'numberValue') return kind.numberValue;
  if (kind.oneofKind === 'boolValue') return kind.boolValue;
  if (kind.oneofKind === 'listValue') return kind.listValue.values.map(protobufValueToJs);
  if (kind.oneofKind === 'structValue') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(kind.structValue.fields)) {
      out[k] = protobufValueToJs(v);
    }
    return out;
  }
  return null;
}
