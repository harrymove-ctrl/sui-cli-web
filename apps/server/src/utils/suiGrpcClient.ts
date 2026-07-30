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

/**
 * gRPC reports every address in a type padded to 32 bytes
 * (`0x0000...0002::sui::SUI`), while suix_getAllCoins - and therefore
 * knownTokens, the SUI_COIN_TYPE constants and the client's equality checks -
 * used the short form for system packages. Strip the padding only when what
 * remains is short enough to be a system package (`0x2`, `0x3`, `0xdee9`);
 * a real package id keeps its full 64 hex digits, leading zeros included,
 * because that is the form JSON-RPC returned for it too.
 */
function compactSuiAddress(addr: string): string {
  const stripped = addr.replace(/^0x0*/, '');
  return stripped.length > 0 && stripped.length <= 4 ? `0x${stripped}` : addr;
}

export interface OwnedCoinSummary {
  coinObjectId: string;
  coinType: string;
  /** Raw balance in the coin's smallest unit. */
  balance: string;
  version: string;
  digest: string;
}

/**
 * List every `0x2::coin::Coin<T>` an address owns, as individual objects.
 *
 * The JSON-RPC equivalent (`suix_getAllCoins`) is gone from Mysten's public
 * fullnodes - every method there answers 404 - and `getAllBalancesViaGrpc` only
 * returns per-type aggregates, which is why coin groups could show a balance
 * but no objects to split, merge or transfer.
 *
 * `object_type` filters server-side: passing the bare `0x2::coin::Coin` (no
 * type parameter) matches every `Coin<T>` regardless of `T`, so one paginated
 * call covers all coin types instead of one call per type. `balance` is a
 * first-class field on the Object message for coins, so no second lookup is
 * needed to decode the Move struct.
 */
export async function getOwnedCoinsViaGrpc(
  address: string,
  rpcUrl: string
): Promise<OwnedCoinSummary[]> {
  const client = getGrpcClient(rpcUrl);
  const out: OwnedCoinSummary[] = [];
  let pageToken: Uint8Array | undefined;
  do {
    const { response } = await (client as any).stateService.listOwnedObjects({
      owner: address,
      objectType: '0x2::coin::Coin',
      pageSize: OWNED_OBJECTS_PAGE_SIZE,
      pageToken,
      readMask: { paths: ['object_id', 'object_type', 'version', 'digest', 'balance'] },
    });
    for (const o of response.objects) {
      if (!o.objectId || !o.objectType) continue;
      // gRPC reports the wrapper type, `Coin<T>`, while every consumer here
      // keys off the inner `T` the way suix_getAllCoins did. The leading
      // address arrives zero-padded, so match loosely and compact after.
      const inner = o.objectType.match(/^0x0*2::coin::Coin<(.+)>$/);
      if (!inner) continue;
      const coinType = inner[1].replace(/0x[0-9a-fA-F]+/g, compactSuiAddress);
      out.push({
        coinObjectId: o.objectId,
        coinType,
        // Absent balance means the node did not resolve this object as a coin;
        // "0" keeps it listable rather than crashing the BigInt sum downstream.
        balance: o.balance != null ? o.balance.toString() : '0',
        version: o.version != null ? o.version.toString() : '0',
        digest: o.digest ?? '',
      });
    }
    pageToken =
      response.nextPageToken && response.nextPageToken.length > 0 ? response.nextPageToken : undefined;
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

/** Same canonical shape `AddressService.getObject`'s JSON-RPC path already
 * returns, so callers don't need to know which transport served a given
 * object. `content` is `null` for Move packages (they have no Move struct
 * fields; `package` metadata lives on the raw gRPC object we don't surface
 * here since nothing currently reads it). */
export interface FullObjectViaGrpc {
  objectId: string;
  version: string;
  digest: string;
  /** `null` for packages - `sui.rpc.v2.Object.object_type` is literally the
   * string "package" for those, which is not a real Move type to show. */
  type: string | null;
  owner: unknown;
  previousTransaction: string | null;
  storageRebate: string;
  content: {
    dataType: 'moveObject';
    type: string;
    hasPublicTransfer: boolean;
    fields: Record<string, unknown>;
  } | null;
}

/**
 * Single-object equivalent of `getObjectsJsonViaGrpc`, used as the primary
 * data source for "object detail" fetches now that Mysten's public
 * testnet/devnet fullnodes 404 every legacy JSON-RPC method (mainnet still
 * serves `sui_getObject` - this path works there too, gRPC is just faster).
 * Returns `null` for a missing/deleted/pruned object rather than throwing,
 * so callers can fall back to the CLI the same way a thrown RPC error would
 * have triggered fallback before.
 *
 * Deliberately does NOT attempt Display-standard metadata (`display.data`) -
 * that is a JSON-RPC/GraphQL-only computation with no gRPC equivalent
 * (`sui.rpc.v2.Object` has no `display` field at all). Callers that need it
 * layer a GraphQL lookup on top of this instead of expecting it here.
 */
export async function getObjectFullViaGrpc(
  objectId: string,
  rpcUrl: string
): Promise<FullObjectViaGrpc | null> {
  const client = getGrpcClient(rpcUrl);
  const { response } = await client.ledgerService.getObject({
    objectId,
    readMask: {
      paths: [
        'object_id',
        'version',
        'digest',
        'owner',
        'object_type',
        'has_public_transfer',
        'previous_transaction',
        'storage_rebate',
        'json',
      ],
    },
  });
  const obj = response.object;
  if (!obj?.objectId) return null;

  const isPackage = obj.objectType === 'package';
  return {
    objectId: obj.objectId,
    version: obj.version != null ? obj.version.toString() : '0',
    digest: obj.digest ?? '',
    type: isPackage ? null : (obj.objectType ?? null),
    owner: mapProtoOwner(obj.owner),
    previousTransaction: obj.previousTransaction ?? null,
    storageRebate: obj.storageRebate != null ? obj.storageRebate.toString() : '0',
    content:
      isPackage || !obj.objectType
        ? null
        : {
            dataType: 'moveObject',
            type: obj.objectType,
            hasPublicTransfer: obj.hasPublicTransfer ?? false,
            fields: obj.json ? (protobufValueToJs(obj.json) as Record<string, unknown>) : {},
          },
  };
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

export interface ObjectAttributesViaGrpc {
  objectId: string;
  version: string | null;
  digest: string | null;
  /** `null` for Move packages (their object_type is literally "package"). */
  type: string | null;
  /** CLI-style owner shape ({ AddressOwner } / { Shared } / "Immutable" / ...). */
  owner: unknown;
  previousTransaction: string | null;
  /** MIST. */
  storageRebate: string | null;
  /** True iff the type has Move's `store` ability (freely transferable). */
  hasPublicTransfer: boolean | null;
  /** Decoded Move content fields, kept so callers can derive Display (name/image). */
  json: unknown | null;
}

/**
 * Batch-fetch the richer per-object attributes the "My Objects" expandable rows
 * show (owner, storage rebate, digest, has-public-transfer, previous tx) plus the
 * decoded content json (for a best-effort Display name/image). One
 * `batchGetObjects` per chunk, same shape as {@link getObjectsJsonViaGrpc} but
 * with a fuller read mask. Missing/pruned objects are simply omitted.
 */
export async function getObjectsAttributesViaGrpc(
  objectIds: string[],
  rpcUrl: string
): Promise<ObjectAttributesViaGrpc[]> {
  const client = getGrpcClient(rpcUrl);
  const unique = [...new Set(objectIds)].filter(Boolean);

  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += BATCH_SIZE) {
    chunks.push(unique.slice(i, i + BATCH_SIZE));
  }

  const results = await Promise.all(
    chunks.map(async (chunk) => {
      try {
        const { response } = await client.ledgerService.batchGetObjects({
          requests: chunk.map((objectId) => ({ objectId })),
          readMask: {
            paths: [
              'object_id',
              'object_type',
              'version',
              'digest',
              'owner',
              'previous_transaction',
              'storage_rebate',
              'has_public_transfer',
              'json',
            ],
          },
        });
        const out: ObjectAttributesViaGrpc[] = [];
        for (const result of response.objects) {
          if (result.result.oneofKind !== 'object') continue;
          const obj = result.result.object;
          if (!obj.objectId) continue;
          const isPackage = obj.objectType === 'package';
          out.push({
            objectId: obj.objectId,
            version: obj.version != null ? obj.version.toString() : null,
            digest: obj.digest ?? null,
            type: isPackage ? null : (obj.objectType ?? null),
            owner: mapProtoOwner(obj.owner),
            previousTransaction: obj.previousTransaction ?? null,
            storageRebate: obj.storageRebate != null ? obj.storageRebate.toString() : null,
            hasPublicTransfer: obj.hasPublicTransfer ?? null,
            json: obj.json ? protobufValueToJs(obj.json) : null,
          });
        }
        return out;
      } catch {
        return [] as ObjectAttributesViaGrpc[];
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

// ---------------------------------------------------------------------------
// Move package introspection (Package Explorer)
//
// `MovePackageService.GetPackage` returns a fully normalized package: modules
// with their functions and datatypes (structs/enums), each already decoded from
// bytecode. This is why the Package Explorer prefers it over regex-scraping the
// CLI's `disassembled` output - the shapes below are the proto enums, compared
// by their numeric wire values so we don't have to import the generated enums.
// ---------------------------------------------------------------------------

const ABILITY_NAMES: Record<number, string> = { 1: 'copy', 2: 'drop', 3: 'store', 4: 'key' };
const VISIBILITY_NAMES: Record<number, string> = { 1: 'private', 2: 'public', 3: 'public(friend)' };
const DATATYPE_KIND_NAMES: Record<number, string> = { 1: 'struct', 2: 'enum' };
// OpenSignatureBody.Type wire values -> primitive Move type name.
const PRIMITIVE_TYPE_NAMES: Record<number, string> = {
  1: 'address',
  2: 'bool',
  3: 'u8',
  4: 'u16',
  5: 'u32',
  6: 'u64',
  7: 'u128',
  8: 'u256',
};
const TYPE_VECTOR = 9;
const TYPE_DATATYPE = 10;
const TYPE_PARAMETER = 11;
const REFERENCE_IMMUTABLE = 1;
const REFERENCE_MUTABLE = 2;

export interface MoveField {
  name: string;
  type: string;
}

export interface MoveDatatype {
  name: string;
  kind: string; // 'struct' | 'enum'
  abilities: string[];
  typeParameters: string[]; // e.g. ['T0', 'phantom T1']
  fields: MoveField[]; // struct fields, or flattened for single-variant enums
  variants?: { name: string; fields: MoveField[] }[];
}

export interface MoveFunction {
  name: string;
  visibility: string; // 'public' | 'private' | 'public(friend)'
  isEntry: boolean;
  typeParameters: string[];
  parameters: string[];
  returns: string[];
}

export interface MoveModule {
  name: string;
  functions: MoveFunction[];
  datatypes: MoveDatatype[];
}

export interface PackageModulesViaGrpc {
  storageId: string;
  originalId: string;
  version: string;
  modules: MoveModule[];
}

/** Shorten a fully-qualified `<addr>::module::Name` so the leading package
 * address is truncated but the module + type name stay readable. */
function shortenTypeName(typeName: string): string {
  const [addr, ...rest] = typeName.split('::');
  if (rest.length === 0) return typeName;
  const shortAddr = addr && addr.length > 12 ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : addr;
  return [shortAddr, ...rest].join('::');
}

/** Render an `OpenSignatureBody` (a field/param type without the reference
 * prefix) into a readable Move type string. `typeParams` names the enclosing
 * datatype/function's generic parameters so `TYPE_PARAMETER` renders as `T0`. */
function renderSignatureBody(body: any, typeParams: string[]): string {
  if (!body) return 'unknown';
  const type = body.type ?? 0;
  if (PRIMITIVE_TYPE_NAMES[type]) return PRIMITIVE_TYPE_NAMES[type];
  if (type === TYPE_VECTOR) {
    const inner = body.typeParameterInstantiation?.[0];
    return `vector<${inner ? renderSignatureBody(inner, typeParams) : 'unknown'}>`;
  }
  if (type === TYPE_DATATYPE) {
    const base = shortenTypeName(body.typeName ?? 'unknown');
    const args = body.typeParameterInstantiation ?? [];
    if (args.length === 0) return base;
    return `${base}<${args.map((a: any) => renderSignatureBody(a, typeParams)).join(', ')}>`;
  }
  if (type === TYPE_PARAMETER) {
    const idx = body.typeParameter ?? 0;
    return typeParams[idx] ?? `T${idx}`;
  }
  return 'unknown';
}

/** Render an `OpenSignature` (function param/return: a body plus an optional
 * `&`/`&mut` reference prefix). */
function renderSignature(sig: any, typeParams: string[]): string {
  const body = renderSignatureBody(sig?.body, typeParams);
  if (sig?.reference === REFERENCE_MUTABLE) return `&mut ${body}`;
  if (sig?.reference === REFERENCE_IMMUTABLE) return `&${body}`;
  return body;
}

/** Name a datatype's generic parameters `T0`, `T1`, ... prefixing `phantom`
 * where declared, so they read the way they appear in Move source. */
function renderTypeParameters(typeParameters: any[]): string[] {
  return (typeParameters ?? []).map((tp: any, i: number) =>
    tp?.isPhantom ? `phantom T${i}` : `T${i}`
  );
}

function mapDatatype(dt: any): MoveDatatype {
  const typeParamNames = renderTypeParameters(dt.typeParameters).map((n) => n.replace('phantom ', ''));
  const mapFields = (fields: any[]): MoveField[] =>
    (fields ?? []).map((f: any) => ({
      name: f.name ?? '',
      type: renderSignatureBody(f.type, typeParamNames),
    }));
  return {
    name: dt.name ?? '',
    kind: DATATYPE_KIND_NAMES[dt.kind ?? 0] ?? 'struct',
    abilities: (dt.abilities ?? []).map((a: number) => ABILITY_NAMES[a]).filter(Boolean),
    typeParameters: renderTypeParameters(dt.typeParameters),
    fields: mapFields(dt.fields),
    variants:
      dt.variants && dt.variants.length > 0
        ? dt.variants.map((v: any) => ({ name: v.name ?? '', fields: mapFields(v.fields) }))
        : undefined,
  };
}

function mapFunction(fn: any): MoveFunction {
  const typeParamNames = renderTypeParameters(fn.typeParameters).map((n) => n.replace('phantom ', ''));
  return {
    name: fn.name ?? '',
    visibility: VISIBILITY_NAMES[fn.visibility ?? 0] ?? 'private',
    isEntry: fn.isEntry ?? false,
    typeParameters: renderTypeParameters(fn.typeParameters),
    parameters: (fn.parameters ?? []).map((p: any) => renderSignature(p, typeParamNames)),
    returns: (fn.returns ?? []).map((r: any) => renderSignature(r, typeParamNames)),
  };
}

/**
 * Fetch a package's normalized modules (functions + datatypes) over gRPC.
 * Returns `null` when the package is not found, so the route can surface a 404
 * instead of a 500 the same way the object-detail path does.
 */
export async function getPackageModulesViaGrpc(
  packageId: string,
  rpcUrl: string
): Promise<PackageModulesViaGrpc | null> {
  const client = getGrpcClient(rpcUrl);
  const { response } = await client.movePackageService.getPackage({ packageId });
  const pkg = response.package;
  if (!pkg?.storageId) return null;

  const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);
  const modules: MoveModule[] = (pkg.modules ?? [])
    .map(
      (m: any): MoveModule => ({
        name: m.name ?? '',
        functions: (m.functions ?? []).map(mapFunction).sort(byName),
        datatypes: (m.datatypes ?? []).map(mapDatatype).sort(byName),
      })
    )
    .sort(byName);

  return {
    storageId: pkg.storageId,
    originalId: pkg.originalId ?? pkg.storageId,
    version: pkg.version != null ? pkg.version.toString() : '1',
    modules,
  };
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
