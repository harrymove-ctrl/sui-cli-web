import { DitherGradient } from '@/components/dither-kit/gradient';
import type { DitherColor } from '@/components/dither-kit/palette';

// Same fixed order the coin/wallet charts use so a given series keeps its colour.
const BAR_COLORS: DitherColor[] = ['blue', 'green', 'purple', 'orange', 'pink', 'red', 'grey'];

export interface BarDatum {
  label: string;
  value: number;
  /** Pre-formatted value shown on the right (falls back to the raw number). */
  formatted?: string;
  /** Optional per-row colour override; otherwise cycles the palette by index. */
  color?: DitherColor;
}

/**
 * Horizontal dither bar chart - the on-brand way to compare a handful of
 * labelled values (coin balances, per-wallet object/package counts, "top N"
 * lists). Bars are widthed against the largest value in the set. Built from the
 * same DitherGradient fill the wallets table uses, so it reads as one system.
 */
export function DitherBarList({
  data,
  emptyMessage = 'Nothing to show yet',
  maxRows,
}: {
  data: BarDatum[];
  emptyMessage?: string;
  maxRows?: number;
}) {
  const sorted = [...data].sort((a, b) => b.value - a.value);
  const rows = maxRows ? sorted.slice(0, maxRows) : sorted;
  const max = rows.reduce((m, d) => Math.max(m, d.value), 0);

  if (rows.length === 0 || max <= 0) {
    return (
      <div className="flex h-full min-h-[120px] items-center justify-center px-4 text-center text-sm text-tertiary">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {rows.map((d, i) => {
        // Floor visible bars at 4% so a tiny-but-nonzero value still registers.
        const pct = d.value > 0 ? Math.max((d.value / max) * 100, 4) : 0;
        const color = d.color ?? BAR_COLORS[i % BAR_COLORS.length];
        return (
          <div key={`${d.label}-${i}`} className="space-y-1">
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="truncate text-foreground">{d.label}</span>
              <span className="flex-shrink-0 tabular-nums text-muted-foreground">
                {d.formatted ?? d.value.toLocaleString()}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted/60">
              {pct > 0 && (
                <div
                  className="relative h-full overflow-hidden rounded-full"
                  style={{ width: `${pct}%` }}
                >
                  <DitherGradient from={color} to="transparent" direction="right" cell={2} bloom="low" />
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
