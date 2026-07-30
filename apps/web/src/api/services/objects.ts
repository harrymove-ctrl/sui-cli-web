/**
 * Object queries API
 * @module api/services/objects
 */

import { fetchApi } from '../core/request';

export async function getObject(objectId: string) {
  return fetchApi<Record<string, unknown>>(`/objects/${objectId}`);
}

export async function getTransactionBlock(digest: string) {
  return fetchApi<Record<string, unknown>>(`/tx/${digest}`);
}

export interface DynamicFieldItem {
  kind?: 'FIELD' | 'OBJECT' | string;
  fieldId?: string;
  name?:
    | {
        type?: string;
        bcs?: string;
        value?: any;
        json?: any;
      }
    | any;
  value?:
    | {
        type?: string;
        json?: any;
      }
    | any;
  valueType?: string;
  fieldObject?: {
    objectId?: string;
    version?: string;
    digest?: string;
    owner?: any;
    objectType?: string;
    hasPublicTransfer?: boolean;
    contents?: any;
    previousTransaction?: string;
    storageRebate?: string;
    bcs?: string;
    json?: any;
  };
  // Fallbacks for legacy/alternative payload keys
  objectId?: string;
  objectType?: string;
  type?: string;
  version?: string;
  digest?: string;
  bcsName?: string;
}

export interface DynamicFieldsResult {
  objectId: string;
  data: DynamicFieldItem[];
  nextCursor: string | null;
  hasNextPage: boolean;
}

export async function getDynamicFields(
  objectId: string,
  cursor?: string,
  limit?: number
): Promise<DynamicFieldsResult> {
  const params = new URLSearchParams();
  if (cursor) params.set('cursor', cursor);
  if (limit) params.set('limit', String(limit));
  const query = params.toString() ? `?${params.toString()}` : '';
  const raw = await fetchApi<any>(`/dynamic-fields/${objectId}${query}`);

  // Safely extract field array regardless of client/server wrapping shape
  let list: DynamicFieldItem[] = [];
  if (Array.isArray(raw?.data)) {
    list = raw.data;
  } else if (Array.isArray(raw?.data?.dynamicFields)) {
    list = raw.data.dynamicFields;
  } else if (Array.isArray(raw?.data?.nodes)) {
    list = raw.data.nodes;
  } else if (Array.isArray(raw?.dynamicFields)) {
    list = raw.dynamicFields;
  } else if (Array.isArray(raw)) {
    list = raw;
  }

  return {
    objectId: raw?.objectId || objectId,
    data: list,
    nextCursor: raw?.nextCursor || raw?.data?.nextCursor || null,
    hasNextPage: Boolean(raw?.hasNextPage || raw?.data?.hasNextPage || false),
  };
}

export async function getObjectMetadata(objectId: string) {
  return fetchApi<Record<string, unknown>>(`/inspector/object/${objectId}/metadata`);
}

export interface VersionHistoryEntry {
  version: string;
  txDigest: string;
  timestampMs: number | null;
}

/** GraphQL/indexer-only (see server's `GraphQLService.getObjectVersionHistory`) - a
 * bounded backward walk through the object's version chain, not a full history. */
export async function getObjectVersionHistory(
  objectId: string,
  version: string,
  previousTx: string
) {
  return fetchApi<VersionHistoryEntry[] | null>(
    `/objects/${objectId}/version-history?version=${encodeURIComponent(version)}&previousTx=${encodeURIComponent(previousTx)}`
  );
}

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
  lastTouchedMs: number | null;
}

export async function getBlobSummaries(objectIds: string[]) {
  return fetchApi<BlobSummary[]>('/objects/blobs/summary', {
    method: 'POST',
    body: JSON.stringify({ objectIds }),
  });
}

export interface NftMetadata {
  objectId: string;
  /** Resolved http(s)/data image URL, or null when the NFT carries no image. */
  imageUrl: string | null;
  name: string | null;
  /** A few primitive fields (rarity, atk, ...) for the no-image fallback card. */
  attributes: { label: string; value: string }[];
}

export async function getNftMetadata(objectIds: string[]) {
  return fetchApi<NftMetadata[]>('/objects/nft-metadata', {
    method: 'POST',
    body: JSON.stringify({ objectIds }),
  });
}

export interface ObjectAttributes {
  objectId: string;
  version: string | null;
  digest: string | null;
  type: string | null;
  /** CLI-style owner shape: { AddressOwner } / { ObjectOwner } / { Shared } / "Immutable". */
  owner: unknown;
  previousTransaction: string | null;
  /** MIST. */
  storageRebate: string | null;
  /** True iff the type is freely transferable (has Move's `store` ability). */
  hasPublicTransfer: boolean | null;
  display: { name: string | null; imageUrl: string | null } | null;
}

/** Batch-fetch richer per-object attributes for the "My Objects" expandable rows. */
export async function getObjectsAttributes(objectIds: string[]) {
  return fetchApi<ObjectAttributes[]>('/objects/attributes', {
    method: 'POST',
    body: JSON.stringify({ objectIds }),
  });
}
