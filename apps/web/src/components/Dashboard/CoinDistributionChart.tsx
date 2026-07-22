import type { ChartConfig } from '@/components/dither-kit/chart-context';
import { PALETTE, rgb } from '@/components/dither-kit/palette';
import { Pie } from '@/components/dither-kit/pie';
import { PieChart } from '@/components/dither-kit/pie-chart';
import { Tooltip } from '@/components/dither-kit/tooltip';

interface CoinDistributionChartProps {
  data: { symbol: string; formattedBalance: string; value: number }[];
}

// Fixed order (never cycled/reassigned by filtering) so a coin type keeps the same colour
// across reloads - same convention the old SVG hatch patterns followed, just with dither-kit's
// palette instead of texture, since dither-kit's dither fill already carries identity fine at
// this size (a handful of slices, not a dense series list).
const COLOR_ORDER = ['blue', 'green', 'purple', 'orange', 'pink', 'red', 'grey'] as const;

// Below this share of the total, a slice's arc is thinner than the dither pattern
// itself can render - it silently disappears into the ring instead of showing as
// a sliver, so 4 of 6 legend colors never actually appeared on the chart (only
// the two dominant coins did, making the ring look broken/inconsistent with its
// own legend). Flooring each slice's *chart-only* share and renormalizing keeps
// every coin visibly present with its own colour, while the legend's percentages
// and balances stay the real, unadjusted numbers - only the wedge widths shift.
const MIN_VISUAL_SHARE = 0.04;

function withVisualFloor(data: { value: number }[]): number[] {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  if (total <= 0) return data.map(() => 0);
  const floored = data.map((d) => Math.max(d.value / total, MIN_VISUAL_SHARE));
  const flooredTotal = floored.reduce((sum, v) => sum + v, 0);
  return floored.map((v) => v / flooredTotal);
}

export function CoinDistributionChart({ data }: CoinDistributionChartProps) {
  const total = data.reduce((sum, d) => sum + d.value, 0);

  const config: ChartConfig = {};
  data.forEach((entry, i) => {
    config[entry.symbol] = { label: entry.symbol, color: COLOR_ORDER[i % COLOR_ORDER.length] };
  });

  const visualShares = withVisualFloor(data);
  const chartData = data.map((entry, i) => ({ ...entry, value: visualShares[i] }));

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      <div className="h-[180px] w-[180px] flex-shrink-0">
        <PieChart
          data={chartData}
          config={config}
          dataKey="value"
          nameKey="symbol"
          innerRadius={0.65}
          bloom="low"
        >
          <Pie variant="gradient" />
          <Tooltip
            valueFormatter={(_value, name) => {
              const entry = data.find((d) => d.symbol === name);
              const pct = total > 0 ? ((entry?.value ?? 0) / total) * 100 : 0;
              return `${entry?.formattedBalance ?? ''} ${name} (${pct.toFixed(1)}%)`;
            }}
          />
        </PieChart>
      </div>
      {/* A grid, not per-row flex: with flex, each row sized its own name/percentage/value
          independently, so a long symbol name (USDT_FAUCET, 11 chars, vs. SUI's 3) pushed
          that one row's percentage+value further right than every other row - widening just
          that row past the card's edge instead of aligning with the rest. Fixed grid columns
          force every row to share the same widths, so no single row can grow past the others
          (or the container) no matter how long its name is; `minmax(0, 1fr)` on the name
          column is what lets it truncate instead of stealing space from the value column. */}
      <div className="flex-1 w-full min-w-0 space-y-2">
        {data.map((entry, i) => {
          const pct = total > 0 ? (entry.value / total) * 100 : 0;
          const color = COLOR_ORDER[i % COLOR_ORDER.length];
          return (
            <div
              key={entry.symbol}
              className="grid grid-cols-[12px_minmax(0,1fr)_2.5rem_5.5rem] items-center gap-x-2 text-sm"
            >
              <span
                className="w-3 h-3 rounded-sm"
                style={{ backgroundColor: rgb(PALETTE[color].fill) }}
              />
              <span className="text-foreground truncate">{entry.symbol}</span>
              <span className="text-right text-muted-foreground tabular-nums">
                {pct.toFixed(1)}%
              </span>
              <span className="text-foreground tabular-nums text-right truncate">
                {entry.formattedBalance}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
