/**
 * Faucet API
 * @module api/services/faucet
 */

import type { FaucetResponse } from '@/types';
import { fetchApi } from '../core/request';

export async function requestFaucet(
  network: 'testnet' | 'devnet' | 'localnet',
  address?: string
) {
  return fetchApi<FaucetResponse>('/faucet/request', {
    method: 'POST',
    body: JSON.stringify({ network, address }),
  });
}
