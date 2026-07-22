/**
 * UI State Slice - Theme, loading, error states
 * @module stores/slices/uiSlice
 *
 * This slice can be used with Zustand's slice pattern:
 * @see https://docs.pmnd.rs/zustand/guides/slices-pattern
 */

import type { StateCreator } from 'zustand';

export type View =
  | 'commands'
  | 'addresses'
  | 'environments'
  | 'objects'
  | 'gas'
  | 'faucet'
  | 'object-detail';

export type ThemeMode = 'glass' | 'dark';

export interface UISlice {
  // State
  isOpen: boolean;
  view: View;
  searchQuery: string;
  selectedIndex: number;
  isLoading: boolean;
  error: string | null;
  themeMode: ThemeMode;

  // Actions
  setOpen: (open: boolean) => void;
  setView: (view: View) => void;
  setSearchQuery: (query: string) => void;
  setSelectedIndex: (index: number) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setThemeMode: (mode: ThemeMode) => void;
}

export const createUISlice: StateCreator<UISlice, [], [], UISlice> = (set) => ({
  // Initial State
  isOpen: true,
  view: 'commands',
  searchQuery: '',
  selectedIndex: 0,
  isLoading: false,
  error: null,
  themeMode: 'dark',

  // Actions
  setOpen: (open) => set({ isOpen: open }),

  setView: (view) => set({
    view,
    searchQuery: '',
    selectedIndex: 0,
  }),

  setSearchQuery: (query) => set({
    searchQuery: query,
    selectedIndex: 0,
  }),

  setSelectedIndex: (index) => set({ selectedIndex: index }),

  setLoading: (loading) => set({ isLoading: loading }),

  setError: (error) => set({ error }),

  setThemeMode: (mode) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('sui-cli-theme', mode);
    }
    set({ themeMode: mode });
  },
});
