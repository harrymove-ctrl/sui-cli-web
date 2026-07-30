import { useCallback, useState } from 'react';
import type { Layout, Layouts } from 'react-grid-layout';
import { GRID_COLS } from './DashboardGrid';

// Persists BOTH which widgets are on the dashboard and how they're arranged.
// Bumped past the layout-only keys (v1-v4) now that the shape includes activeIds.
const STORAGE_KEY = 'dashboard-config-v5';

export interface WidgetSize {
  w: number;
  h: number;
  minW: number;
  minH: number;
}

interface DashboardConfig {
  activeIds: string[];
  layouts: Layouts;
}

const BREAKPOINTS = ['lg', 'md', 'sm', 'xs', 'xxs'] as const;

/** Bottom edge (in grid rows) of a layout, so a newly-added widget can be
 * dropped just below everything else instead of overlapping. */
function bottomOf(layout: Layout[]): number {
  return layout.reduce((max, l) => Math.max(max, l.y + l.h), 0);
}

function widthForBreakpoint(bp: string, size: WidgetSize): number {
  const cols = GRID_COLS[bp as keyof typeof GRID_COLS] ?? 12;
  // On the narrow breakpoints every card spans the full width (matches the
  // stacked defaults); on lg/md keep the widget's intended width.
  return cols < 12 ? cols : Math.min(size.w, cols);
}

function makeEntry(bp: string, id: string, size: WidgetSize, y: number): Layout {
  const cols = GRID_COLS[bp as keyof typeof GRID_COLS] ?? 12;
  return {
    i: id,
    x: 0,
    y,
    w: widthForBreakpoint(bp, size),
    h: size.h,
    minW: Math.min(size.minW, cols),
    minH: size.minH,
  };
}

/**
 * Reconcile a (possibly partial/stale) config against the current widget set:
 *  - drop active ids the registry no longer knows about,
 *  - guarantee every active widget has a layout entry at every breakpoint
 *    (appending missing ones at the bottom), and
 *  - drop layout entries for widgets that are no longer active.
 * This is what stops an async-loaded or newly-added widget from rendering with
 * no/garbage geometry.
 */
function reconcile(
  config: Partial<DashboardConfig> | null,
  defaults: DashboardConfig,
  sizeOf: (id: string) => WidgetSize | undefined
): DashboardConfig {
  const rawIds = config?.activeIds && config.activeIds.length > 0 ? config.activeIds : defaults.activeIds;
  const activeIds = rawIds.filter((id) => sizeOf(id));
  const finalIds = activeIds.length > 0 ? activeIds : defaults.activeIds;

  const layouts: Layouts = {};
  for (const bp of BREAKPOINTS) {
    const saved = config?.layouts?.[bp] ?? defaults.layouts[bp] ?? [];
    const savedById = new Map(saved.map((l) => [l.i, l]));
    const out: Layout[] = [];
    for (const id of finalIds) {
      const size = sizeOf(id);
      if (!size) continue;
      const existing = savedById.get(id);
      if (existing) {
        out.push({
          ...existing,
          w: Math.max(existing.w, Math.min(size.minW, GRID_COLS[bp] ?? 12)),
          h: Math.max(existing.h, size.minH),
          minW: Math.min(size.minW, GRID_COLS[bp] ?? 12),
          minH: size.minH,
        });
      } else {
        out.push(makeEntry(bp, id, size, bottomOf(out)));
      }
    }
    layouts[bp] = out;
  }
  return { activeIds: finalIds, layouts };
}

export function useDashboardConfig(opts: {
  defaultIds: string[];
  defaultLayouts: Layouts;
  sizeOf: (id: string) => WidgetSize | undefined;
}) {
  const { defaultIds, defaultLayouts, sizeOf } = opts;
  const defaults: DashboardConfig = { activeIds: defaultIds, layouts: defaultLayouts };

  const [config, setConfig] = useState<DashboardConfig>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return reconcile(JSON.parse(raw), defaults, sizeOf);
    } catch {
      // ignore
    }
    return reconcile(null, defaults, sizeOf);
  });

  // Persist layout edits (called from the grid on drag/resize stop).
  const onLayoutChange = useCallback(
    (_current: Layout[], allLayouts: Layouts) => {
      setConfig((prev) => {
        const next = reconcile({ activeIds: prev.activeIds, layouts: allLayouts }, defaults, sizeOf);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
          // ignore
        }
        return next;
      });
    },
    // defaults/sizeOf are stable enough (module-level data); intentionally omitted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const add = useCallback(
    (id: string) => {
      setConfig((prev) => {
        if (prev.activeIds.includes(id)) return prev;
        const size = sizeOf(id);
        if (!size) return prev;
        const layouts: Layouts = {};
        for (const bp of BREAKPOINTS) {
          const arr = prev.layouts[bp] ?? [];
          layouts[bp] = [...arr, makeEntry(bp, id, size, bottomOf(arr))];
        }
        const next = { activeIds: [...prev.activeIds, id], layouts };
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
          /* ignore */
        }
        return next;
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const remove = useCallback(
    (id: string) => {
      setConfig((prev) => {
        if (!prev.activeIds.includes(id)) return prev;
        const layouts: Layouts = {};
        for (const bp of BREAKPOINTS) {
          layouts[bp] = (prev.layouts[bp] ?? []).filter((l) => l.i !== id);
        }
        const next = { activeIds: prev.activeIds.filter((x) => x !== id), layouts };
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
          /* ignore */
        }
        return next;
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const reset = useCallback(() => {
    const fresh = reconcile(null, defaults, sizeOf);
    setConfig(fresh);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    activeIds: config.activeIds,
    layouts: config.layouts,
    onLayoutChange,
    add,
    remove,
    reset,
  };
}
