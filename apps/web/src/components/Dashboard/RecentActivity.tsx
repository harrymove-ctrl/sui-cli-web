import { ArrowLeftRight, Beaker, CheckCircle2, Hammer, Rocket, XCircle, ArrowUpCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { selectHistory, useMoveDevStore } from '@/components/MoveDeploy/hooks/state/useMoveDevState';
import type { OperationType } from '@/components/MoveDeploy/types';
import { Button } from '@/components/ui/button';

interface OnChainActivityEntry {
  timestamp: number;
  balance: number;
}

interface RecentActivityProps {
  /** Real on-chain transactions for the active wallet, most recent first - reconstructed
   * server-side from previous-transaction digests. Only reaches back as far as public nodes
   * retain (a short window), so an empty list here is often genuinely correct, not a bug. */
  onChainHistory?: OnChainActivityEntry[];
  activeWalletAlias?: string;
}

const OPERATION_LABELS: Record<OperationType, string> = {
  build: 'Build',
  test: 'Test',
  publish: 'Publish',
  upgrade: 'Upgrade',
};

const OPERATION_ICONS: Record<OperationType, typeof Hammer> = {
  build: Hammer,
  test: Beaker,
  publish: Rocket,
  upgrade: ArrowUpCircle,
};

function formatRelativeTime(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

export function RecentActivity({ onChainHistory = [], activeWalletAlias }: RecentActivityProps) {
  const navigate = useNavigate();
  const history = useMoveDevStore(selectHistory);
  const recent = history.slice(0, 8);

  return (
    <div className="rounded-xl border border-border bg-card/90 backdrop-blur-sm p-5 space-y-5">
      <div>
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-sm font-medium text-foreground">Recent activity</h2>
          <span className="text-xs text-muted-foreground">Local to this browser</span>
        </div>
        <p className="text-xs text-muted-foreground mb-4">Build, test, publish, and upgrade runs from Move Studio</p>

        {recent.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <p className="text-sm text-muted-foreground">
              No local build/deploy activity yet — actions in Move Studio will show up here.
            </p>
            <Button
              variant="outline"
              onClick={() => navigate('/app/move')}
              className="border-[#4da2ff]/40 text-[#4da2ff] hover:bg-[#4da2ff]/10 hover:text-[#4da2ff]"
            >
              Open Move Studio
            </Button>
          </div>
        ) : (
          <div className="space-y-1">
            {recent.map((entry) => {
              const Icon = OPERATION_ICONS[entry.type];
              const packageName = entry.packagePath.split('/').filter(Boolean).pop() || entry.packagePath;
              return (
                <div key={entry.id} className="flex items-center gap-3 px-3 py-2 rounded-lg transition-colors hover:bg-[#4da2ff]/5">
                  <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-[#4da2ff]/10">
                    <Icon className="w-4 h-4 text-[#4da2ff]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-foreground truncate">
                      {OPERATION_LABELS[entry.type]} · {packageName}
                    </div>
                    {entry.status === 'error' && entry.error && (
                      <div className="text-xs text-error truncate">{entry.error.message}</div>
                    )}
                  </div>
                  {entry.status === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-error flex-shrink-0" />
                  )}
                  <span className="text-xs text-muted-foreground flex-shrink-0 w-16 text-right">
                    {formatRelativeTime(entry.timestamp)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="border-t border-border pt-4">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-sm font-medium text-foreground">On-chain activity</h2>
          <span className="text-xs text-muted-foreground">{activeWalletAlias || 'Active wallet'}</span>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Real transactions for the active wallet - only reaches as far back as public nodes
          retain, so an empty list here can be genuinely correct, not broken.
        </p>

        {onChainHistory.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm text-muted-foreground">
              No on-chain transactions in the retained window for this wallet.
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {onChainHistory.map((entry) => (
              <div key={entry.timestamp} className="flex items-center gap-3 px-3 py-2 rounded-lg transition-colors hover:bg-[#4da2ff]/5">
                <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-[#4da2ff]/10">
                  <ArrowLeftRight className="w-4 h-4 text-[#4da2ff]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-foreground truncate">
                    Balance changed to {entry.balance.toFixed(4)} SUI
                  </div>
                </div>
                <span className="text-xs text-muted-foreground flex-shrink-0 w-16 text-right">
                  {formatRelativeTime(entry.timestamp)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
