import { Area } from '@/components/dither-kit/area';
import { AreaChart } from '@/components/dither-kit/area-chart';
import { Tooltip } from '@/components/dither-kit/tooltip';
import { XAxis } from '@/components/dither-kit/x-axis';

export interface BalancePoint {
  /** Unix ms */
  timestamp: number;
  balance: number;
}

interface BalanceHistoryChartProps {
  data: BalancePoint[];
}

function formatTick(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatTooltipDate(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const CONFIG = { balance: { label: 'Balance', color: 'blue' as const } };

export function BalanceHistoryChart({ data }: BalanceHistoryChartProps) {
  if (data.length < 2) {
    return (
      <div className="h-[160px] w-full flex items-center justify-center text-center px-6">
        <p className="text-sm text-muted-foreground">
          Not enough balance changes on-chain yet — points accumulate as you transact and as
          daily snapshots build up.
        </p>
      </div>
    );
  }

  // AreaChart positions points evenly by index, not proportional to elapsed time (it's a
  // categorical x-axis, like the library's own month-based examples) - dateLabel carries the
  // real date into the tooltip heading since Tooltip's labelKey shows the raw row value with
  // no formatter hook, so the timestamp itself can't be the labelKey.
  const rows = data.map((p) => ({
    timestamp: p.timestamp,
    balance: p.balance,
    dateLabel: formatTooltipDate(p.timestamp),
  }));

  return (
    <div className="h-full min-h-[160px] w-full">
      <AreaChart data={rows} config={CONFIG} bloom="low">
        <XAxis dataKey="timestamp" tickFormatter={(v) => formatTick(Number(v))} />
        <Tooltip labelKey="dateLabel" valueFormatter={(v) => `${v.toFixed(4)} SUI`} />
        <Area dataKey="balance" variant="gradient" />
      </AreaChart>
    </div>
  );
}
