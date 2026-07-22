/**
 * Coin management API
 * @module api/services/coins
 */

import type { ApiResponse } from '@/types';
import type {
  CoinGroupedResponse,
  CoinInfo,
  CoinMetadata,
  CoinOperationResult,
  GenericSplitRequest,
  GenericMergeRequest,
} from '@sui-cli-web/shared';
import { fetchApi } from '../core/request';

// Legacy gas coin operations
export async function splitCoin(
  coinId: string,
  amounts: string[],
  gasBudget?: string
) {
  return fetchApi<string>('/gas/split', {
    method: 'POST',
    body: JSON.stringify({ coinId, amounts, gasBudget }),
  });
}

export async function mergeCoins(
  primaryCoinId: string,
  coinIdsToMerge: string[],
  gasBudget?: string
) {
  return fetchApi<string>('/gas/merge', {
    method: 'POST',
    body: JSON.stringify({ primaryCoinId, coinIdsToMerge, gasBudget }),
  });
}

// Generic coin operations (works for any coin type)
export async function getCoinsGrouped(address: string) {
  return fetchApi<ApiResponse<CoinGroupedResponse>>(`/coins/${address}`).then(
    (data) => ({ success: true, data } as ApiResponse<CoinGroupedResponse>)
  ).catch((error) => ({ success: false, error: error.message } as ApiResponse<CoinGroupedResponse>));
}

export async function getCoinsByType(address: string, coinType: string) {
  return fetchApi<CoinInfo[]>(`/coins/${address}/by-type?type=${encodeURIComponent(coinType)}`);
}

export async function getCoinMetadata(coinType: string) {
  return fetchApi<CoinMetadata | null>(`/coins/metadata?type=${encodeURIComponent(coinType)}`);
}

export async function splitGenericCoin(request: GenericSplitRequest) {
  return fetchApi<CoinOperationResult>('/coins/split', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export async function dryRunSplitCoin(request: GenericSplitRequest) {
  return fetchApi<CoinOperationResult>('/coins/split/dry-run', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export async function mergeGenericCoins(request: GenericMergeRequest) {
  return fetchApi<CoinOperationResult>('/coins/merge', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export async function dryRunMergeCoins(request: GenericMergeRequest) {
  return fetchApi<CoinOperationResult>('/coins/merge/dry-run', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}
