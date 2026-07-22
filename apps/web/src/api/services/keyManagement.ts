/**
 * Key management API - export/import private keys. Export requires typing
 * the literal confirmation phrase "EXPORT MY KEY", enforced server-side.
 * @module api/services/keyManagement
 */

import { fetchApi } from '../core/request';

export interface ExportedKey {
  privateKey: string;
  keyScheme: string;
  publicKey: string;
  warning: string;
}

export async function getExportWarning() {
  return fetchApi<{ warning: string }>('/keys/export-warning');
}

export async function exportPrivateKey(address: string, confirmationCode: string) {
  return fetchApi<ExportedKey>('/keys/export', {
    method: 'POST',
    body: JSON.stringify({ address, confirmationCode }),
  });
}
