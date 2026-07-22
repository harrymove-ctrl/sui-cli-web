/**
 * Connection State Slice - Server connection status
 * @module stores/slices/connectionSlice
 */

import type { StateCreator } from 'zustand';
import { checkConnection } from '@/api/core/connection';

export interface ConnectionSlice {
  // State
  isServerConnected: boolean | null; // null = checking, true = connected, false = disconnected
  isCheckingConnection: boolean;

  // Actions
  checkServerConnection: () => Promise<boolean>;
  setServerConnected: (connected: boolean | null) => void;
}

export const createConnectionSlice: StateCreator<ConnectionSlice, [], [], ConnectionSlice> = (set, get) => ({
  // Initial State
  isServerConnected: null,
  isCheckingConnection: false,

  // Actions
  checkServerConnection: async () => {
    // Don't run multiple checks at once
    if (get().isCheckingConnection) {
      return get().isServerConnected ?? false;
    }

    set({ isCheckingConnection: true });

    try {
      const connected = await checkConnection();
      set({ isServerConnected: connected, isCheckingConnection: false });
      return connected;
    } catch {
      set({ isServerConnected: false, isCheckingConnection: false });
      return false;
    }
  },

  setServerConnected: (connected) => set({ isServerConnected: connected }),
});
