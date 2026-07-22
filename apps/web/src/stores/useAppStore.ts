import { create } from 'zustand';
import type { SuiAddress, SuiEnvironment, GasCoin } from '@/types';
import * as api from '@/api/client';
import { checkConnection } from '@/api/client';
import { trackEvent, identifyUser, setTag, ClarityEvents } from '@/lib/clarity';
import { apiCache, cacheKeys } from '@/api/cache';

export type View =
  | 'commands'
  | 'addresses'
  | 'environments'
  | 'objects'
  | 'gas'
  | 'faucet'
  | 'object-detail';

export type ThemeMode = 'glass' | 'dark';

interface AppState {
  // UI State
  isOpen: boolean;
  view: View;
  searchQuery: string;
  selectedIndex: number;
  isLoading: boolean;
  error: string | null;
  themeMode: ThemeMode;

  // Connection state
  isServerConnected: boolean | null; // null = checking, true = connected, false = disconnected
  isCheckingConnection: boolean;

  // Data
  addresses: SuiAddress[];
  environments: SuiEnvironment[];
  gasCoins: GasCoin[];
  objects: Record<string, unknown>[];
  selectedObjectId: string | null;
  suiInstalled: boolean | null;
  suiVersion: string | null;

  // Actions
  setOpen: (open: boolean) => void;
  setView: (view: View) => void;
  setSearchQuery: (query: string) => void;
  setSelectedIndex: (index: number) => void;
  setError: (error: string | null) => void;
  setThemeMode: (mode: ThemeMode) => void;

  // Data fetching
  fetchStatus: () => Promise<void>;
  fetchAddresses: () => Promise<void>;
  fetchEnvironments: () => Promise<void>;
  fetchGasCoins: (address: string) => Promise<void>;
  fetchObjects: (address: string) => Promise<void>;

  // Address actions
  switchAddress: (address: string) => Promise<void>;
  createAddress: (keyScheme?: 'ed25519' | 'secp256k1' | 'secp256r1', alias?: string) => Promise<{ address: string; phrase?: string }>;
  removeAddress: (address: string) => Promise<void>;

  // Environment actions
  switchEnvironment: (alias: string) => Promise<void>;
  addEnvironment: (alias: string, rpc: string, ws?: string) => Promise<void>;
  removeEnvironment: (alias: string) => Promise<void>;

  // Gas actions
  splitCoin: (coinId: string, amounts: string[]) => Promise<void>;
  mergeCoins: (primaryCoinId: string, coinIdsToMerge: string[]) => Promise<void>;

  // Faucet
  requestFaucet: (network: 'testnet' | 'devnet' | 'localnet', address?: string) => Promise<void>;

  // Object detail
  viewObjectDetail: (objectId: string) => void;

  // Connection
  checkServerConnection: () => Promise<boolean>;
}

export const useAppStore = create<AppState>((set, get) => ({
  // Initial UI State
  isOpen: true,
  view: 'commands',
  searchQuery: '',
  selectedIndex: 0,
  isLoading: false,
  error: null,
  themeMode: 'dark' as ThemeMode,

  // Connection state
  isServerConnected: null,
  isCheckingConnection: false,

  // Initial Data
  addresses: [],
  environments: [],
  gasCoins: [],
  objects: [],
  selectedObjectId: null,
  suiInstalled: null as boolean | null,
  suiVersion: null,

  // UI Actions
  setOpen: (open) => set({ isOpen: open }),
  setView: (view) => set({ view, searchQuery: '', selectedIndex: 0 }),
  setSearchQuery: (query) => set({ searchQuery: query, selectedIndex: 0 }),
  setSelectedIndex: (index) => set({ selectedIndex: index }),
  setError: (error) => set({ error }),
  setThemeMode: (mode) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('sui-cli-theme', mode);
    }
    set({ themeMode: mode });
  },

  // Data fetching
  fetchStatus: async () => {
    try {
      const status = await api.getStatus();
      set({ suiInstalled: status.suiInstalled, suiVersion: status.suiVersion || null });
    } catch (error) {
      // Don't show error for status check, just log it
      console.error('Failed to fetch status:', error);
      // Assume installed if we can't check (server might be starting)
      set({ suiInstalled: true });
    }
  },

  fetchAddresses: async () => {
    // Return cached data immediately if available (instant UI update)
    const cachedAddresses = get().addresses;
    if (cachedAddresses.length > 0) {
      // Data already in store - UI shows this instantly
      // But still fetch fresh data in background
      set({ isLoading: false });
    } else {
      set({ isLoading: true, error: null });
    }

    try {
      // Use cache and deduplication - prevents redundant calls
      const addresses = await apiCache.dedupe(
        cacheKeys.addresses(),
        () => api.getAddresses(),
        3000 // 3s cache for addresses
      );
      set({ addresses, isLoading: false, error: null });
    } catch (error) {
      // If we had cached data, keep showing it despite error
      if (cachedAddresses.length > 0) {
        set({ isLoading: false });
      } else {
        set({ error: String(error), isLoading: false });
      }
    }
  },

  fetchEnvironments: async () => {
    set({ isLoading: true, error: null });
    try {
      // Use cache and deduplication
      const environments = await apiCache.dedupe(
        cacheKeys.environments(),
        () => api.getEnvironments(),
        5000 // 5s cache for environments (changes less frequently)
      );
      set({ environments, isLoading: false });
    } catch (error) {
      set({ error: String(error), isLoading: false });
    }
  },

  fetchGasCoins: async (address: string) => {
    set({ isLoading: true, error: null });
    try {
      // Use cache and deduplication
      const gasCoins = await apiCache.dedupe(
        cacheKeys.gasCoins(address),
        () => api.getGasCoins(address),
        2000 // 2s cache for gas coins
      );
      set({ gasCoins, isLoading: false });
    } catch (error) {
      set({ error: String(error), isLoading: false });
    }
  },

  fetchObjects: async (address: string) => {
    set({ isLoading: true, error: null });
    try {
      // Use cache and deduplication
      const objects = await apiCache.dedupe(
        cacheKeys.objects(address),
        () => api.getObjects(address),
        3000 // 3s cache for objects
      );
      set({ objects, isLoading: false });
    } catch (error) {
      set({ error: String(error), isLoading: false });
    }
  },

  // Address actions
  switchAddress: async (address: string) => {
    set({ isLoading: true, error: null });
    try {
      await api.switchAddress(address);
      // Invalidate cache after address switch
      apiCache.invalidate(cacheKeys.addresses());
      await get().fetchAddresses();
      set({ isLoading: false });
      trackEvent(ClarityEvents.ADDRESS_SWITCHED);
      identifyUser(address);
    } catch (error) {
      set({ error: String(error), isLoading: false });
    }
  },

  createAddress: async (keyScheme, alias) => {
    set({ isLoading: true, error: null });
    try {
      const result = await api.createAddress(keyScheme, alias);
      // Invalidate addresses cache
      apiCache.invalidate(cacheKeys.addresses());
      await get().fetchAddresses();
      set({ isLoading: false });
      trackEvent(ClarityEvents.ADDRESS_CREATED);
      return result;
    } catch (error) {
      set({ error: String(error), isLoading: false });
      throw error;
    }
  },

  removeAddress: async (address: string) => {
    set({ isLoading: true, error: null });
    try {
      await api.removeAddress(address);
      // Invalidate addresses cache
      apiCache.invalidate(cacheKeys.addresses());
      await get().fetchAddresses();
      set({ isLoading: false });
    } catch (error) {
      set({ error: String(error), isLoading: false });
      throw error;
    }
  },

  // Environment actions
  switchEnvironment: async (alias: string) => {
    set({ isLoading: true, error: null });
    try {
      await api.switchEnvironment(alias);
      // Invalidate environments and addresses cache
      apiCache.invalidate(cacheKeys.environments());
      apiCache.invalidate(cacheKeys.addresses());
      // Fetch in parallel for faster update
      await Promise.all([
        get().fetchEnvironments(),
        get().fetchAddresses(),
      ]);
      set({ isLoading: false });
      trackEvent(ClarityEvents.ENVIRONMENT_SWITCHED);
      setTag('network', alias);
    } catch (error) {
      set({ error: String(error), isLoading: false });
    }
  },

  addEnvironment: async (alias: string, rpc: string, ws?: string) => {
    set({ isLoading: true, error: null });
    try {
      await api.addEnvironment(alias, rpc, ws);
      // Invalidate environments cache
      apiCache.invalidate(cacheKeys.environments());
      await get().fetchEnvironments();
      set({ isLoading: false });
    } catch (error) {
      set({ error: String(error), isLoading: false });
      throw error;
    }
  },

  removeEnvironment: async (alias: string) => {
    set({ isLoading: true, error: null });
    try {
      await api.removeEnvironment(alias);
      // Invalidate environments cache
      apiCache.invalidate(cacheKeys.environments());
      await get().fetchEnvironments();
      set({ isLoading: false });
    } catch (error) {
      set({ error: String(error), isLoading: false });
      throw error;
    }
  },

  // Gas actions
  splitCoin: async (coinId: string, amounts: string[]) => {
    set({ isLoading: true, error: null });
    try {
      await api.splitCoin(coinId, amounts);
      const activeAddress = get().addresses.find((a) => a.isActive);
      if (activeAddress) {
        // Invalidate gas coins cache after mutation
        apiCache.invalidate(cacheKeys.gasCoins(activeAddress.address));
        await get().fetchGasCoins(activeAddress.address);
      }
      set({ isLoading: false });
    } catch (error) {
      set({ error: String(error), isLoading: false });
      throw error;
    }
  },

  mergeCoins: async (primaryCoinId: string, coinIdsToMerge: string[]) => {
    set({ isLoading: true, error: null });
    try {
      await api.mergeCoins(primaryCoinId, coinIdsToMerge);
      const activeAddress = get().addresses.find((a) => a.isActive);
      if (activeAddress) {
        // Invalidate gas coins cache after mutation
        apiCache.invalidate(cacheKeys.gasCoins(activeAddress.address));
        await get().fetchGasCoins(activeAddress.address);
      }
      set({ isLoading: false });
    } catch (error) {
      set({ error: String(error), isLoading: false });
      throw error;
    }
  },

  // Faucet
  requestFaucet: async (network: 'testnet' | 'devnet' | 'localnet', address?: string) => {
    set({ isLoading: true, error: null });
    try {
      await api.requestFaucet(network, address);
      // Wait for transaction to finalize on blockchain before refreshing balance
      await new Promise((resolve) => setTimeout(resolve, 3000));
      // Invalidate addresses cache after faucet request (only for known addresses)
      if (!address) {
        apiCache.invalidate(cacheKeys.addresses());
        await get().fetchAddresses();
      }
      set({ isLoading: false });
      trackEvent(ClarityEvents.FAUCET_REQUESTED);
    } catch (error) {
      set({ error: String(error), isLoading: false });
      throw error;
    }
  },

  // Object detail
  viewObjectDetail: (objectId: string) => {
    set({ selectedObjectId: objectId, view: 'object-detail' });
  },

  // Connection
  checkServerConnection: async () => {
    set({ isCheckingConnection: true });
    try {
      const connected = await checkConnection();
      set({ isServerConnected: connected, isCheckingConnection: false });
      if (connected) {
        trackEvent(ClarityEvents.SERVER_CONNECTED);
      }
      return connected;
    } catch {
      set({ isServerConnected: false, isCheckingConnection: false });
      return false;
    }
  },
}));
