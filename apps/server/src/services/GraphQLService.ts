import fetch from 'node-fetch';
import type { TransactionBalanceEffect } from '../utils/suiGrpcClient';

const PAGE_SIZE = 50;
// The GraphQL RPC service caps request payload size at 5000 bytes. Each aliased
// `transaction(digest: ...)` sub-query below runs ~130-140 bytes; 50 in one
// request measured at 6666B (over the limit and silently dropped), 35 measured
// comfortably under it - 25 leaves solid margin for digest-length variance.
const TIMESTAMP_BATCH_SIZE = 25;
// Safety net against runaway pagination for very high-activity addresses - a
// personal wallet's full history comfortably fits well under this many pages.
const MAX_PAGES = 40;
const GRAPHQL_TIMEOUT_MS = 8_000;

interface BalanceChangeNode {
  amount: string | null;
  coinType: { repr: string } | null;
  owner: { address: string } | null;
}

interface TransactionNode {
  digest: string;
  effects: {
    timestamp: string | null;
    balanceChanges: { nodes: BalanceChangeNode[] } | null;
  } | null;
}

interface TransactionsResponse {
  data?: {
    transactions: {
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
      nodes: TransactionNode[];
    };
  };
  errors?: unknown;
}

const QUERY = `
  query WalletHistory($address: SuiAddress!, $after: String) {
    transactions(filter: { affectedAddress: $address }, first: ${PAGE_SIZE}, after: $after) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        digest
        effects {
          timestamp
          balanceChanges(first: 50) {
            nodes {
              amount
              coinType { repr }
              owner { address }
            }
          }
        }
      }
    }
  }
`;

/** Current (GA) GraphQL RPC endpoints - not to be confused with the old,
 * now-dead "Beta" hosts (sui-mainnet.mystenlabs.com/graphql etc). */
function getGraphqlUrl(rpcUrl: string): string | null {
  if (rpcUrl.includes('mainnet')) return 'https://graphql.mainnet.sui.io/graphql';
  if (rpcUrl.includes('testnet')) return 'https://graphql.testnet.sui.io/graphql';
  if (rpcUrl.includes('devnet')) return 'https://graphql.devnet.sui.io/graphql';
  // No public GraphQL RPC for localnet - caller should fall back to another source.
  return null;
}

/**
 * Fetch the full SUI balance-change history for an address, from its very
 * first on-chain transaction to the newest one the indexer has, via the
 * `transactions(filter: { affectedAddress })` GraphQL query. This is backed
 * by the General-Purpose Indexer + Archival Store, so it isn't limited by
 * full-node pruning the way a live-fullnode query would be.
 *
 * Returns `null` (rather than throwing) when this network has no public
 * GraphQL endpoint, or the request fails/rate-limits - callers should treat
 * that as "try another source", not "address has no history".
 */
export async function getAddressBalanceEffects(
  address: string,
  rpcUrl: string
): Promise<TransactionBalanceEffect[] | null> {
  const graphqlUrl = getGraphqlUrl(rpcUrl);
  if (!graphqlUrl) return null;

  const normalizedAddress = address.toLowerCase();
  const effects: TransactionBalanceEffect[] = [];
  let after: string | null = null;

  try {
    for (let page = 0; page < MAX_PAGES; page++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), GRAPHQL_TIMEOUT_MS);
      let body: TransactionsResponse;
      try {
        const response = await fetch(graphqlUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: QUERY, variables: { address, after } }),
          signal: controller.signal,
        });
        if (!response.ok) return effects.length > 0 ? effects : null;
        body = (await response.json()) as TransactionsResponse;
      } finally {
        clearTimeout(timeout);
      }

      if (body.errors || !body.data) return effects.length > 0 ? effects : null;

      const { nodes, pageInfo } = body.data.transactions;
      for (const node of nodes) {
        const timestamp = node.effects?.timestamp;
        if (!timestamp) continue;
        const timestampMs = new Date(timestamp).getTime();

        let delta = BigInt(0);
        for (const change of node.effects?.balanceChanges?.nodes ?? []) {
          if (
            change.owner?.address?.toLowerCase() === normalizedAddress &&
            change.coinType?.repr?.endsWith('::sui::SUI') &&
            change.amount
          ) {
            delta += BigInt(change.amount);
          }
        }

        effects.push({ digest: node.digest, timestampMs, suiDeltaMist: delta });
      }

      if (!pageInfo.hasNextPage || !pageInfo.endCursor) break;
      after = pageInfo.endCursor;
    }

    return effects;
  } catch {
    // Network error / abort - fall back to whatever the caller has, or null.
    return effects.length > 0 ? effects : null;
  }
}

/**
 * Batch-fetch checkpoint timestamps for a set of transaction digests, via
 * GraphQL (indexer + archival store). Digests older than a full node's
 * retention window 404 over gRPC/JSON-RPC, but the indexer keeps them, so
 * this is used ahead of any live-fullnode digest lookup.
 *
 * GraphQL has no "transactions by digest list" filter, so this batches many
 * single-transaction lookups into one HTTP round-trip via query aliases
 * (`t0: transaction(digest: $d0) { ... }`, `t1: ...`), chunked to keep any
 * one request modestly sized.
 *
 * Returns `null` when this network has no public GraphQL endpoint or the
 * request fails - callers should fall back to another source.
 */
export async function getTransactionTimestamps(
  digests: string[],
  rpcUrl: string
): Promise<Record<string, number> | null> {
  const graphqlUrl = getGraphqlUrl(rpcUrl);
  if (!graphqlUrl) return null;

  const unique = [...new Set(digests)];
  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += TIMESTAMP_BATCH_SIZE) {
    chunks.push(unique.slice(i, i + TIMESTAMP_BATCH_SIZE));
  }

  const chunkResults = await Promise.all(
    chunks.map(async (chunk) => {
      const variableDefs = chunk.map((_, i) => `$d${i}: String!`).join(', ');
      const fields = chunk
        .map((_, i) => `t${i}: transaction(digest: $d${i}) { digest effects { timestamp } }`)
        .join('\n');
      const query = `query TransactionTimestamps(${variableDefs}) { ${fields} }`;
      const variables = Object.fromEntries(chunk.map((digest, i) => [`d${i}`, digest]));

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), GRAPHQL_TIMEOUT_MS);
      try {
        const response = await fetch(graphqlUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query, variables }),
          signal: controller.signal,
        });
        if (!response.ok) return {};
        const body = (await response.json()) as {
          data?: Record<string, { digest?: string; effects?: { timestamp?: string } } | null>;
          errors?: unknown;
        };
        if (!body.data) return {};

        const entries: Record<string, number> = {};
        for (const node of Object.values(body.data)) {
          if (node?.digest && node.effects?.timestamp) {
            entries[node.digest] = new Date(node.effects.timestamp).getTime();
          }
        }
        return entries;
      } catch {
        return {};
      } finally {
        clearTimeout(timeout);
      }
    })
  );

  const timestamps = Object.assign({}, ...chunkResults) as Record<string, number>;
  return Object.keys(timestamps).length > 0 || digests.length === 0 ? timestamps : null;
}

/**
 * Fetch a transaction's status/gas/created-objects/kind, shaped like the
 * legacy `sui client tx-block --json` (JSON-RPC) response that the
 * Transaction detail tab already renders. A full node prunes older
 * transactions (the local CLI 404s on anything but recent activity); the
 * indexer + archival store behind GraphQL don't have that limit.
 *
 * Returns `null` when this network has no public GraphQL endpoint, the
 * transaction isn't found, or the request fails - callers should fall back
 * to another source.
 */
export async function getTransactionSummary(
  digest: string,
  rpcUrl: string
): Promise<Record<string, unknown> | null> {
  const graphqlUrl = getGraphqlUrl(rpcUrl);
  if (!graphqlUrl) return null;

  const query = `
      query TransactionSummary($digest: String!) {
        transaction(digest: $digest) {
          digest
          kind { __typename }
          effects {
            status
            timestamp
            epoch { epochId }
            gasEffects { gasSummary { computationCost storageCost storageRebate } }
            objectChanges(first: 50) { nodes { address idCreated } }
          }
        }
      }
    `;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GRAPHQL_TIMEOUT_MS);
  try {
    const response = await fetch(graphqlUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables: { digest } }),
      signal: controller.signal,
    });
    if (!response.ok) return null;

    const body = (await response.json()) as {
      data?: {
        transaction: {
          digest: string;
          kind: { __typename: string } | null;
          effects: {
            status: string | null;
            timestamp: string | null;
            epoch: { epochId: number } | null;
            gasEffects: {
              gasSummary: {
                computationCost: string;
                storageCost: string;
                storageRebate: string;
              } | null;
            } | null;
            objectChanges: { nodes: { address: string; idCreated: boolean }[] } | null;
          } | null;
        } | null;
      };
      errors?: unknown;
    };

    const tx = body.data?.transaction;
    if (!tx || body.errors) return null;

    const effects = tx.effects;
    return {
      digest: tx.digest,
      effects: {
        status: { status: effects?.status === 'SUCCESS' ? 'success' : 'failure' },
        gasUsed: {
          computationCost: effects?.gasEffects?.gasSummary?.computationCost ?? '0',
          storageCost: effects?.gasEffects?.gasSummary?.storageCost ?? '0',
          storageRebate: effects?.gasEffects?.gasSummary?.storageRebate ?? '0',
        },
        executedEpoch:
          effects?.epoch?.epochId !== undefined ? String(effects.epoch.epochId) : undefined,
        created: (effects?.objectChanges?.nodes ?? [])
          .filter((n) => n.idCreated)
          .map((n) => ({ reference: { objectId: n.address } })),
      },
      transaction: { data: { transaction: { kind: tx.kind?.__typename ?? 'Unknown' } } },
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function runQuery(
  graphqlUrl: string,
  query: string,
  variables: Record<string, unknown>
): Promise<any> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GRAPHQL_TIMEOUT_MS);
  try {
    const response = await fetch(graphqlUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables }),
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { data?: any; errors?: unknown };
    if (body.errors || !body.data) return null;
    return body.data;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Walk an object backward through its version chain, Sui's real "Versioning"
 * mechanism (https://docs.sui.io/develop/objects/versioning): each hop finds
 * the version this object was at *before* a given transaction
 * (`objectChanges.inputState.version`), then asks the indexer what
 * transaction produced that earlier version (`object(address, version)
 * .previousTransaction`) to continue walking. Public fullnodes prune old
 * object versions within hours (`sui_tryGetPastObject` 404s almost
 * immediately) - the indexer behind GraphQL doesn't have that limit, which
 * is why this is GraphQL-only with no CLI/RPC fallback; callers should treat
 * a `null` return as "history unavailable", not "object has no history".
 */
export async function getObjectVersionHistory(
  objectId: string,
  currentVersion: string,
  currentPreviousTx: string,
  rpcUrl: string,
  maxHops = 5
): Promise<{ version: string; txDigest: string; timestampMs: number | null }[] | null> {
  const graphqlUrl = getGraphqlUrl(rpcUrl);
  if (!graphqlUrl) return null;

  const hops: { version: string; txDigest: string; timestampMs: number | null }[] = [];
  let version = currentVersion;
  let txDigest: string | null = currentPreviousTx;

  for (let i = 0; i < maxHops && txDigest; i++) {
    const txData = await runQuery(
      graphqlUrl,
      `query ObjectChangeInTx($digest: String!) {
          transaction(digest: $digest) {
            effects {
              timestamp
              objectChanges(first: 50) { nodes { address inputState { version } } }
            }
          }
        }`,
      { digest: txDigest }
    );
    if (!txData) break;

    const timestamp = txData.transaction?.effects?.timestamp ?? null;
    hops.push({
      version,
      txDigest,
      timestampMs: timestamp ? new Date(timestamp).getTime() : null,
    });

    const node = (txData.transaction?.effects?.objectChanges?.nodes ?? []).find(
      (n: { address: string }) => n.address === objectId
    );
    const prevVersion = node?.inputState?.version;
    // No inputState means this transaction *created* the object - genesis reached.
    if (prevVersion === undefined || prevVersion === null) break;

    const objData = await runQuery(
      graphqlUrl,
      // Version is a trusted, internally-computed integer (not user input) - inlined
      // directly to sidestep GraphQL scalar-type ambiguity (UInt53 vs Int vs BigInt).
      `query PastObjectPrevTx($address: SuiAddress!) {
          object(address: $address, version: ${prevVersion}) {
            previousTransaction { digest }
          }
        }`,
      { address: objectId }
    );

    version = String(prevVersion);
    txDigest = objData?.object?.previousTransaction?.digest ?? null;
  }

  return hops;
}
