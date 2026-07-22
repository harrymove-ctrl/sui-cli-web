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

export function CoinDistributionChart({ data }: CoinDistributionChartProps) {
  const total = data.reduce((sum, d) => sum + d.value, 0);

  const config: ChartConfig = {};
  data.forEach((entry, i) => {
    config[entry.symbol] = { label: entry.symbol, color: COLOR_ORDER[i % COLOR_ORDER.length] };
  });

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      <div className="h-[180px] w-[180px] flex-shrink-0">
        <PieChart data={data} config={config} dataKey="value" nameKey="symbol" innerRadius={0.65} bloom="low">
          <Pie variant="gradient" />
          <Tooltip
            valueFormatter={(_value, name) => {
              const entry = data.find((d) => d.symbol === name);
              return `${entry?.formattedBalance ?? ''} ${name}`;
            }}
          />
        </PieChart>
      </div>
      <div className="flex-1 w-full space-y-2">
        {data.map((entry, i) => {
          const pct = total > 0 ? (entry.value / total) * 100 : 0;
          const color = COLOR_ORDER[i % COLOR_ORDER.length];
          return (
            <div key={entry.symbol} className="flex items-center gap-2 text-sm">
              <span
                className="w-3 h-3 flex-shrink-0 rounded-sm"
                style={{ backgroundColor: rgb(PALETTE[color].fill) }}
              />
              <span className="text-foreground flex-shrink-0">{entry.symbol}</span>
              <span className="flex-1 text-right text-muted-foreground tabular-nums">
                {pct.toFixed(1)}%
              </span>
              <span className="text-foreground tabular-nums w-28 text-right truncate">
                {entry.formattedBalance}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
