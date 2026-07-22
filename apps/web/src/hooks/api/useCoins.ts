/**
 * Coin management hooks
 * @module hooks/api/useCoins
 */

import { useState, useCallback } from 'react';
import {
  getCoinsGrouped,
  getCoinsByType,
  getCoinMetadata,
  splitGenericCoin,
  mergeGenericCoins,
  dryRunSplitCoin,
  dryRunMergeCoins,
} from '@/api/services/coins';
import type {
  CoinGroupedResponse,
  CoinInfo,
  CoinMetadata,
  CoinOperationResult,
  GenericSplitRequest,
  GenericMergeRequest,
} from '@sui-cli-web/shared';

interface UseCoinsReturn {
  loading: boolean;
  error: string | null;
  // Queries
  fetchCoinsGrouped: (address: string) => Promise<CoinGroupedResponse | null>;
  fetchCoinsByType: (address: string, coinType: string) => Promise<CoinInfo[]>;
  fetchCoinMetadata: (coinType: string) => Promise<CoinMetadata | null>;
  // Operations
  splitCoin: (request: GenericSplitRequest) => Promise<CoinOperationResult | null>;
  mergeCoins: (request: GenericMergeRequest) => Promise<CoinOperationResult | null>;
  // Dry runs
  dryRunSplit: (request: GenericSplitRequest) => Promise<CoinOperationResult | null>;
  dryRunMerge: (request: GenericMergeRequest) => Promise<CoinOperationResult | null>;
  clearError: () => void;
}

/**
 * Hook for coin management operations
 *
 * @example
 * const { fetchCoinsGrouped, splitCoin, loading, error } = useCoins();
 * const coins = await fetchCoinsGrouped(activeAddress);
 */
export function useCoins(): UseCoinsReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCoinsGrouped = useCallback(async (address: string): Promise<CoinGroupedResponse | null> => {
    setLoading(true);
    setError(null);

    try {
      const result = await getCoinsGrouped(address);
      if (result.success && result.data) {
        return result.data;
      }
      setError(result.error || 'Failed to fetch coins');
      return null;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch coins');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCoinsByType = useCallback(async (address: string, coinType: string): Promise<CoinInfo[]> => {
    setLoading(true);
    setError(null);

    try {
      return await getCoinsByType(address, coinType);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch coins');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCoinMetadata = useCallback(async (coinType: string): Promise<CoinMetadata | null> => {
    try {
      return await getCoinMetadata(coinType);
    } catch {
      return null;
    }
  }, []);

  const splitCoin = useCallback(async (request: GenericSplitRequest): Promise<CoinOperationResult | null> => {
    setLoading(true);
    setError(null);

    try {
      return await splitGenericCoin(request);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Split failed');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const mergeCoins = useCallback(async (request: GenericMergeRequest): Promise<CoinOperationResult | null> => {
    setLoading(true);
    setError(null);

    try {
      return await mergeGenericCoins(request);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Merge failed');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const dryRunSplit = useCallback(async (request: GenericSplitRequest): Promise<CoinOperationResult | null> => {
    setLoading(true);
    setError(null);

    try {
      return await dryRunSplitCoin(request);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Dry run failed');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const dryRunMerge = useCallback(async (request: GenericMergeRequest): Promise<CoinOperationResult | null> => {
    setLoading(true);
    setError(null);

    try {
      return await dryRunMergeCoins(request);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Dry run failed');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    fetchCoinsGrouped,
    fetchCoinsByType,
    fetchCoinMetadata,
    splitCoin,
    mergeCoins,
    dryRunSplit,
    dryRunMerge,
    clearError: useCallback(() => setError(null), []),
  };
}
