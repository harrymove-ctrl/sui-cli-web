/**
 * Security Tools API (verify source, bytecode, decode tx)
 * @module api/services/security
 */

import { fetchApi } from '../core/request';

export async function verifySource(packagePath: string, verifyDeps?: boolean, skipSource?: boolean) {
  return fetchApi<{ verified: boolean; output: string; packagePath: string }>('/security/verify-source', {
    method: 'POST',
    body: JSON.stringify({ packagePath, verifyDeps, skipSource }),
  });
}

export async function verifyBytecode(packagePath?: string, modulePaths?: string[], protocolVersion?: number) {
  return fetchApi<{ output: string; withinLimits: boolean; meterUsage?: { current: number; limit: number } }>('/security/verify-bytecode', {
    method: 'POST',
    body: JSON.stringify({ packagePath, modulePaths, protocolVersion }),
  });
}

export async function decodeTransaction(txBytes: string, signature?: string) {
  return fetchApi<{ decoded: any; signatureValid?: boolean }>('/security/decode-tx', {
    method: 'POST',
    body: JSON.stringify({ txBytes, signature }),
  });
}
