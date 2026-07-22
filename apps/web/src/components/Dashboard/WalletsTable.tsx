import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { AlertTriangle } from 'lucide-react';
import { DitherAvatar } from '@/components/dither-kit/avatar';
import { DitherGradient } from '@/components/dither-kit/gradient';
import { useAppStore } from '@/stores/useAppStore';
import { cn } from '@/lib/utils';
import type { SuiAddress } from '@/types';

export interface WalletMetrics {
  address: string;
  name: string;
  isActive?: boolean;
  failed?: boolean;
  balance: number;
  objects: number;
  packages: number;
}

interface WalletsTableProps {
  addresses: SuiAddress[];
  metrics: WalletMetrics[];
  /** address -> distinct coin type count (SUI itself counts as 1). Used only as a
   * count badge - never summed with balance, since different coin types aren't
   * the same unit and can't be added together meaningfully. */
  coinTypeCounts?: Record<string, number>;
}

const MIN_VISIBLE_FRACTION = 0.04;
const BAR_HEIGHT = 8; // px - tall enough for the dither pattern to actually read as texture

/** Same "text carries the meaning, bar is a scan accent" language as before, but the fill
 * itself is now the dither-kit ordered-dither texture (DitherGradient, direction="right",
 * dissolving to transparent) instead of a flat CSS bar - solid dithered grain at the base,
 * softening toward the tip. Each column normalizes against its own max (balance/objects/
 * packages are different units, comparing across columns would be meaningless). */
function MetricCell({
  value,
  max,
  format,
  bloom,
}: {
  value: number;
  max: number;
  format: (v: number) => string;
  bloom: boolean;
}) {
  const widthPct =
    max > 0 && value > 0 ? Math.max((value / max) * 100, MIN_VISIBLE_FRACTION * 100) : 0;

  return (
    <div className="flex flex-col items-end gap-1 min-w-[72px]">
      <span
        className={cn(
          'text-sm tabular-nums',
          value > 0 ? 'text-foreground' : 'text-muted-foreground'
        )}
      >
        {format(value)}
      </span>
      <div
        className="w-full rounded-full bg-muted overflow-hidden"
        style={{ height: BAR_HEIGHT }}
      >
        {widthPct > 0 && (
          <div className="relative h-full rounded-full overflow-hidden" style={{ width: `${widthPct}%` }}>
            <DitherGradient
              from="blue"
              to="transparent"
              direction="right"
              cell={2}
              bloom={bloom ? 'low' : 'off'}
            />
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * One row per wallet - avatar, name, coin-type badge, and balance/objects/packages as
 * columns, all in one table. Replaces what used to be two separate cards (a metrics-only
 * table and a plain wallets list) that both listed the same 5 wallets - clicking a row here
 * switches the active wallet (same behavior the old WalletsList had), so there's one place
 * to both compare wallets and act on one.
 */
export function WalletsTable({ addresses, metrics, coinTypeCounts }: WalletsTableProps) {
  const navigate = useNavigate();
  const switchAddress = useAppStore((s) => s.switchAddress);

  const handleSelect = useCallback(
    async (addr: SuiAddress) => {
      if (!addr.isActive) {
        try {
          await switchAddress(addr.address);
        } catch (error) {
          toast.error(String(error));
          return;
        }
      }
      navigate('/app/addresses');
    },
    [switchAddress, navigate]
  );

  if (addresses.length === 0) {
    return <p className="text-sm text-muted-foreground">No wallets found.</p>;
  }

  const maxBalance = Math.max(...metrics.map((m) => m.balance), 0);
  const maxObjects = Math.max(...metrics.map((m) => m.objects), 0);
  const maxPackages = Math.max(...metrics.map((m) => m.packages), 0);

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="text-xs text-muted-foreground">
            <th className="text-left font-normal pb-2 pr-3">Wallet</th>
            <th className="text-right font-normal pb-2 px-3">Balance</th>
            <th className="text-right font-normal pb-2 px-3">Objects</th>
            <th className="text-right font-normal pb-2 pl-3">Packages</th>
          </tr>
        </thead>
        <tbody>
          {addresses.map((addr) => {
            const row = metrics.find((m) => m.address === addr.address);
            const otherTypes = (coinTypeCounts?.[addr.address] ?? 1) - 1;

            return (
              <tr
                key={addr.address}
                className={cn('border-t border-border/50', addr.isActive && 'bg-accent/60')}
              >
                <td className="py-2 pr-3 min-w-0">
                  <button
                    onClick={() => handleSelect(addr)}
                    title={addr.isActive ? 'View this wallet' : 'Switch to this wallet and view it'}
                    className="flex items-center gap-2.5 w-full min-w-0 text-left rounded-md hover:bg-accent/40 transition-colors -mx-1 px-1 py-0.5"
                  >
                    <DitherAvatar
                      name={addr.alias || addr.address}
                      size={22}
                      className="rounded-full overflow-hidden flex-shrink-0"
                    />
                    <span className="text-sm text-foreground truncate" title={addr.alias || addr.address}>
                      {addr.alias || 'Unnamed'}
                    </span>
                    {row?.failed && (
                      <span
                        title="Couldn't load objects/packages/coins for this wallet - try reloading"
                        className="flex-shrink-0"
                      >
                        <AlertTriangle className="w-3.5 h-3.5 text-warning" />
                      </span>
                    )}
                    {otherTypes > 0 && (
                      <span className="text-[11px] text-muted-foreground bg-muted rounded-full px-1.5 py-0.5 flex-shrink-0">
                        +{otherTypes}
                      </span>
                    )}
                  </button>
                </td>
                <td className="py-2 px-3">
                  <MetricCell
                    value={row?.balance ?? 0}
                    max={maxBalance}
                    format={(v) => `${v.toFixed(2)} SUI`}
                    bloom={!!addr.isActive}
                  />
                </td>
                <td className="py-2 px-3">
                  <MetricCell
                    value={row?.objects ?? 0}
                    max={maxObjects}
                    format={(v) => String(v)}
                    bloom={!!addr.isActive}
                  />
                </td>
                <td className="py-2 pl-3">
                  <MetricCell
                    value={row?.packages ?? 0}
                    max={maxPackages}
                    format={(v) => String(v)}
                    bloom={!!addr.isActive}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
