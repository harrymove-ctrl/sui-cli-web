/**
 * Generic object transfer API (works for any object type - coins, NFTs, caps, etc.)
 * @module api/services/transfers
 */
import { fetchApi } from '../core/request';

export async function transferObject(to: string, objectId: string, gasBudget?: string) {
  return fetchApi<{ digest: string; gasUsed?: string }>('/transfers/object', {
    method: 'POST',
    body: JSON.stringify({ to, objectId, gasBudget }),
  });
}
