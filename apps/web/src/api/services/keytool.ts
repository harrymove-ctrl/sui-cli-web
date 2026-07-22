/**
 * Keytool API (key management, signing, multi-sig)
 * @module api/services/keytool
 */

import { fetchApi } from '../core/request';

// Types
export type SampleTxType = 'self-transfer' | 'split-coin' | 'merge-coins';

// API functions
export async function listKeys() {
  return fetchApi<any[]>('/keytool/list');
}

export async function generateKey(scheme?: 'ed25519' | 'secp256k1' | 'secp256r1', wordLength?: number) {
  return fetchApi<{
    address: string;
    publicKey: string;
    keyScheme: string;
    mnemonic?: string;
  }>('/keytool/generate', {
    method: 'POST',
    body: JSON.stringify({ scheme, wordLength }),
  });
}

export async function signMessage(address: string, data: string) {
  return fetchApi<{ signature: string; publicKey: string }>('/keytool/sign', {
    method: 'POST',
    body: JSON.stringify({ address, data }),
  });
}

export async function createMultiSigAddress(publicKeys: string[], weights: number[], threshold: number) {
  return fetchApi<{
    address: string;
    threshold: number;
    publicKeys: string[];
    weights: number[];
  }>('/keytool/multisig-address', {
    method: 'POST',
    body: JSON.stringify({ publicKeys, weights, threshold }),
  });
}

export async function decodeTransactionKeytool(txBytes: string, signature?: string) {
  return fetchApi<{ decoded: any; signatureValid?: boolean }>('/keytool/decode-tx', {
    method: 'POST',
    body: JSON.stringify({ txBytes, signature }),
  });
}

export async function generateSampleTx(address: string, txType?: SampleTxType) {
  return fetchApi<{ txBytes: string; description: string }>('/keytool/generate-sample-tx', {
    method: 'POST',
    body: JSON.stringify({ address, txType }),
  });
}

export async function combineMultiSigSignatures(
  publicKeys: string[],
  weights: number[],
  threshold: number,
  signatures: string[]
) {
  return fetchApi<{ combinedSignature: string; multiSigAddress?: string }>('/keytool/combine-signatures', {
    method: 'POST',
    body: JSON.stringify({ publicKeys, weights, threshold, signatures }),
  });
}

export async function buildTransferTransaction(
  from: string,
  to: string,
  amount: string,
  coinObjectId?: string,
  gasBudget?: string
) {
  return fetchApi<{ txBytes: string; description: string }>('/keytool/build-transfer-tx', {
    method: 'POST',
    body: JSON.stringify({ from, to, amount, coinObjectId, gasBudget }),
  });
}

export async function executeSignedTransaction(txBytes: string, signature: string) {
  return fetchApi<{ digest: string; status: string; gasUsed: string }>('/keytool/execute-signed-tx', {
    method: 'POST',
    body: JSON.stringify({ txBytes, signature }),
  });
}
