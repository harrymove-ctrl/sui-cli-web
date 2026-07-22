/**
 * Environment management API
 * @module api/services/environments
 */

import type { SuiEnvironment } from '@/types';
import { fetchApi } from '../core/request';

export async function getEnvironments() {
  return fetchApi<SuiEnvironment[]>('/environments');
}

export async function getActiveEnvironment() {
  return fetchApi<{ alias: string | null }>('/environments/active');
}

export async function switchEnvironment(alias: string) {
  return fetchApi<void>('/environments/switch', {
    method: 'POST',
    body: JSON.stringify({ alias }),
  });
}

export async function addEnvironment(alias: string, rpc: string, ws?: string) {
  return fetchApi<void>('/environments', {
    method: 'POST',
    body: JSON.stringify({ alias, rpc, ws }),
  });
}

export async function removeEnvironment(alias: string) {
  return fetchApi<void>(`/environments/${alias}`, {
    method: 'DELETE',
  });
}

export async function getChainIdentifier() {
  return fetchApi<{ chainId: string; network?: string }>('/environments/chain-id');
}
