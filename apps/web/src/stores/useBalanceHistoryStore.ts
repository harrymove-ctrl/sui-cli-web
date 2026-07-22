import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface BalanceSnapshot {
  /** YYYY-MM-DD, local date */
  date: string;
  balance: number;
}

interface BalanceHistoryState {
  /** Per-address daily snapshots - keyed by wallet address so series are never
   * mixed across scopes (a wallet's history is only ever its own balance). */
  snapshotsByAddress: Record<string, BalanceSnapshot[]>;
  /** Records today's balance for one address - overwrites today's existing point
   * if present (one point per day, not per page load). */
  recordSnapshot: (address: string, balance: number) => void;
}

const MAX_SNAPSHOTS = 180;

export const useBalanceHistoryStore = create<BalanceHistoryState>()(
  persist(
    (set, get) => ({
      snapshotsByAddress: {},
      recordSnapshot: (address: string, balance: number) => {
        const today = new Date().toISOString().slice(0, 10);
        const all = get().snapshotsByAddress;
        const snapshots = all[address] ?? [];
        const last = snapshots[snapshots.length - 1];
        let next: BalanceSnapshot[];
        if (last?.date === today) {
          if (last.balance === balance) return;
          next = [...snapshots.slice(0, -1), { date: today, balance }];
        } else {
          next = [...snapshots, { date: today, balance }];
          if (next.length > MAX_SNAPSHOTS) next = next.slice(-MAX_SNAPSHOTS);
        }
        set({ snapshotsByAddress: { ...all, [address]: next } });
      },
    }),
    {
      name: 'sui-cli-web-balance-history',
      storage: createJSONStorage(() => localStorage),
      version: 2,
      // v1 stored a single cross-wallet total series - not attributable to any
      // one address, so it can't be migrated into per-address series. Drop it.
      migrate: () => ({ snapshotsByAddress: {} }) as never,
    }
  )
);
