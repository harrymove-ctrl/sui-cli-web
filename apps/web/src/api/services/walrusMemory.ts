/**
 * Walrus Memory API - resolving the MemWalAccount for an address and
 * decrypting a Blob's content using a keypair already present in the local
 * sui.keystore (no raw key material ever passes through this API).
 * @module api/services/walrusMemory
 */

import { fetchApi } from '../core/request';

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

export async function getWalrusMemoryAccount(address: string) {
  return fetchApi<{ accountId: string | null; account: MemwalAccountSummary | null }>(
    `/walrus-memory/account?address=${encodeURIComponent(address)}`
  );
}

export async function decryptWalrusMemoryBlob(blobObjectId: string, signerAddress: string) {
  return fetchApi<DecryptResult>('/walrus-memory/decrypt', {
    method: 'POST',
    body: JSON.stringify({ blobObjectId, signerAddress }),
  });
}

/**
 * Register a new delegate key on a MemWalAccount so a second address can
 * decrypt on behalf of the owner. Must be signed by the account owner - the
 * owner's keypair must be in the local sui.keystore.
 */
export async function addWalrusMemoryDelegateKey(
  accountId: string,
  ownerAddress: string,
  delegateAddress: string,
  label: string
) {
  return fetchApi<{ digest: string }>('/walrus-memory/delegate', {
    method: 'POST',
    body: JSON.stringify({ accountId, ownerAddress, delegateAddress, label }),
    // Server runs a dry-run (up to 60s) then the real transaction (up to 60s) -
    // the default 30s client timeout would abort while the transaction may
    // still be landing on-chain, misreporting a real success as a failure.
    timeoutMs: 130_000,
  });
}

/**
 * Revoke a previously-registered delegate key. Must be signed by the account
 * owner - the owner's keypair must be in the local sui.keystore.
 */
export async function removeWalrusMemoryDelegateKey(
  accountId: string,
  ownerAddress: string,
  delegateAddress: string
) {
  return fetchApi<{ digest: string }>('/walrus-memory/delegate', {
    method: 'DELETE',
    body: JSON.stringify({ accountId, ownerAddress, delegateAddress }),
    timeoutMs: 130_000,
  });
}
