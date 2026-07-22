import { selectHistory, useMoveDevStore } from '@/components/MoveDeploy/hooks/state/useMoveDevState';
import { cn } from '@/lib/utils';

const WEEKS = 12;
const DAYS = 7;

// 0 = empty, 1-4 = increasing intensity, thresholds scale to the busiest day seen
// so a handful of local runs still reads as visibly "some activity."
const INTENSITY_OPACITY = [0, 0.25, 0.45, 0.65, 0.9];

function intensityFor(count: number, max: number): number {
  if (count === 0) return 0;
  if (max <= 1) return count > 0 ? 4 : 0;
  const ratio = count / max;
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
}

interface ActivityHeatmapProps {
  /** Unix ms timestamps of real on-chain transactions for the active wallet (already deduped
   * of the synthetic "current balance" anchor point by the caller). */
  onChainTimestamps?: number[];
}

export function ActivityHeatmap({ onChainTimestamps = [] }: ActivityHeatmapProps) {
  const history = useMoveDevStore(selectHistory);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const totalDays = WEEKS * DAYS;
  const startDate = new Date(today);
  // Align the grid so the last column ends on today, Sunday-first rows.
  startDate.setDate(today.getDate() - totalDays + 1 + today.getDay());

  const localByDate = new Map<string, number>();
  for (const entry of history) {
    const key = new Date(entry.timestamp).toISOString().slice(0, 10);
    localByDate.set(key, (localByDate.get(key) ?? 0) + 1);
  }

  const onChainByDate = new Map<string, number>();
  for (const ts of onChainTimestamps) {
    const key = new Date(ts).toISOString().slice(0, 10);
    onChainByDate.set(key, (onChainByDate.get(key) ?? 0) + 1);
  }

  const totalsByDate = new Map<string, number>();
  for (const key of new Set([...localByDate.keys(), ...onChainByDate.keys()])) {
    totalsByDate.set(key, (localByDate.get(key) ?? 0) + (onChainByDate.get(key) ?? 0));
  }

  const maxCount = Math.max(0, ...totalsByDate.values());

  const cells: { date: string; local: number; onChain: number; count: number }[] = [];
  for (let i = 0; i < totalDays; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    cells.push({
      date: key,
      local: localByDate.get(key) ?? 0,
      onChain: onChainByDate.get(key) ?? 0,
      count: totalsByDate.get(key) ?? 0,
    });
  }

  const hasAnyActivity = maxCount > 0;

  return (
    <div>
      <div
        className="grid gap-1"
        style={{ gridTemplateColumns: `repeat(${WEEKS}, minmax(0, 1fr))`, gridAutoFlow: 'column' }}
      >
        {cells.map((cell) => {
          const level = intensityFor(cell.count, maxCount);
          const parts = [
            cell.local > 0 ? `${cell.local} local` : null,
            cell.onChain > 0 ? `${cell.onChain} on-chain` : null,
          ].filter(Boolean);
          const label = parts.length > 0 ? parts.join(' · ') : 'no activity';
          return (
            <div
              key={cell.date}
              title={`${cell.date}: ${label}`}
              className={cn(
                'aspect-square rounded-sm',
                level === 0 && 'bg-muted border border-border'
              )}
              style={
                level === 0
                  ? undefined
                  : { backgroundColor: 'var(--chart-foreground)', opacity: INTENSITY_OPACITY[level] }
              }
            />
          );
        })}
      </div>
      {!hasAnyActivity && (
        <p className="text-xs text-muted-foreground mt-3">
          No local or on-chain activity in this window yet — build/test/publish/upgrade runs from
          Move Studio, and transactions from the active wallet, will fill this in.
        </p>
      )}
    </div>
  );
}
