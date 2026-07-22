/**
 * Address management hooks
 * @module hooks/api/useAddresses
 */

import { useState, useCallback, useEffect } from 'react';
import {
  getAddresses,
  getActiveAddress,
  switchAddress as apiSwitchAddress,
  createAddress as apiCreateAddress,
  removeAddress as apiRemoveAddress,
  getBalance,
  getGasCoins,
} from '@/api/services/addresses';
import type { SuiAddress, GasCoin } from '@/types';

interface UseAddressesReturn {
  addresses: SuiAddress[];
  activeAddress: SuiAddress | null;
  loading: boolean;
  error: string | null;
  // Actions
  refresh: () => Promise<void>;
  switchAddress: (address: string) => Promise<boolean>;
  createAddress: (keyScheme?: 'ed25519' | 'secp256k1' | 'secp256r1', alias?: string) => Promise<string | null>;
  removeAddress: (address: string) => Promise<boolean>;
  getAddressBalance: (address: string) => Promise<string | null>;
  getAddressGasCoins: (address: string) => Promise<GasCoin[]>;
}

/**
 * Hook for managing Sui addresses
 *
 * @example
 * const { addresses, activeAddress, switchAddress, loading } = useAddresses();
 */
export function useAddresses(): UseAddressesReturn {
  const [addresses, setAddresses] = useState<SuiAddress[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeAddress = addresses.find(a => a.isActive) || null;

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await getAddresses();
      setAddresses(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch addresses');
    } finally {
      setLoading(false);
    }
  }, []);

  const switchAddress = useCallback(async (address: string): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      await apiSwitchAddress(address);
      await refresh();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to switch address');
      return false;
    } finally {
      setLoading(false);
    }
  }, [refresh]);

  const createAddress = useCallback(async (
    keyScheme?: 'ed25519' | 'secp256k1' | 'secp256r1',
    alias?: string
  ): Promise<string | null> => {
    setLoading(true);
    setError(null);

    try {
      const result = await apiCreateAddress(keyScheme, alias);
      await refresh();
      return result.address;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create address');
      return null;
    } finally {
      setLoading(false);
    }
  }, [refresh]);

  const removeAddress = useCallback(async (address: string): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      await apiRemoveAddress(address);
      await refresh();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove address');
      return false;
    } finally {
      setLoading(false);
    }
  }, [refresh]);

  const getAddressBalance = useCallback(async (address: string): Promise<string | null> => {
    try {
      const result = await getBalance(address);
      return result.balance;
    } catch {
      return null;
    }
  }, []);

  const getAddressGasCoins = useCallback(async (address: string): Promise<GasCoin[]> => {
    try {
      return await getGasCoins(address);
    } catch {
      return [];
    }
  }, []);

  // Auto-refresh on mount
  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    addresses,
    activeAddress,
    loading,
    error,
    refresh,
    switchAddress,
    createAddress,
    removeAddress,
    getAddressBalance,
    getAddressGasCoins,
  };
}
