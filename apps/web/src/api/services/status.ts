/**
 * Status API
 * @module api/services/status
 */

import { fetchApi } from '../core/request';

export async function getStatus() {
  return fetchApi<{ suiInstalled: boolean; suiVersion?: string }>('/status');
}
