import type { CoinGroup, CoinGroupedResponse, CoinInfo } from '@sui-cli-web/shared';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  ChevronDown,
  ChevronRight,
  Coins,
  Combine,
  Copy,
  Droplet,
  Send,
  Split,
} from 'lucide-react';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import * as api from '@/api/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CopyForAiMenu } from '@/components/ui/copy-for-ai';
import { ShimmerSkeleton } from '@/components/unlumen-ui/shimmer-skeleton';
import { useCopyToClipboard } from '@/hooks';
import { useAppStore } from '@/stores/useAppStore';

// Format balance with proper decimals
function formatBalance(balance: string, decimals: number): string {
  const balanceBigInt = BigInt(balance);
  const divisor = BigInt(10 ** decimals);
  const integerPart = balanceBigInt / divisor;
  const fractionalPart = balanceBigInt % divisor;

  let fractionalStr = fractionalPart.toString().padStart(decimals, '0');
  fractionalStr = fractionalStr.replace(/0+$/, '');
  if (fractionalStr.length < 4) {
    fractionalStr = fractionalStr.padEnd(4, '0');
  }

  return `${integerPart}.${fractionalStr}`;
}

export function CoinList() {
  const navigate = useNavigate();
  const { addresses, isLoading: storeLoading, searchQuery } = useAppStore();
  const [coinData, setCoinData] = useState<CoinGroupedResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const activeAddress = addresses.find((a) => a.isActive);

  useEffect(() => {
    async function loadCoins() {
      if (!activeAddress?.address) return;

      setIsLoading(true);
      setError(null);

      try {
        const response = await api.getCoinsGrouped(activeAddress.address);
        if (response.success && response.data) {
          setCoinData(response.data);
          // Auto-expand first group (usually SUI)
          if (response.data.groups.length > 0) {
            setExpandedGroups(new Set([response.data.groups[0].coinType]));
          }
        } else {
          setError(response.error || 'Failed to load coins');
        }
      } catch (err) {
        setError('Failed to connect to server');
      } finally {
        setIsLoading(false);
      }
    }

    loadCoins();
  }, [activeAddress?.address]);

  const toggleGroup = (coinType: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(coinType)) {
        next.delete(coinType);
      } else {
        next.add(coinType);
      }
      return next;
    });
  };

  const copyToClipboard = useCopyToClipboard();

  // Filter groups by search query
  const filteredGroups = useMemo(() => {
    if (!coinData?.groups) return [];
    if (!searchQuery) return coinData.groups;

    const query = searchQuery.toLowerCase();
    return coinData.groups.filter(
      (g) =>
        g.symbol.toLowerCase().includes(query) ||
        g.name.toLowerCase().includes(query) ||
        g.coinType.toLowerCase().includes(query)
    );
  }, [coinData?.groups, searchQuery]);

  // Actions handlers
  const handleTransfer = (coin: CoinInfo) => {
    navigate(`/app/transfer?coinId=${coin.coinObjectId}&type=${encodeURIComponent(coin.coinType)}`);
  };

  const handleSplit = (coin: CoinInfo) => {
    navigate(
      `/app/coins/split?coinId=${coin.coinObjectId}&type=${encodeURIComponent(coin.coinType)}`
    );
  };

  const handleMerge = (group: CoinGroup) => {
    if (group.coins.length < 2) {
      toast.error('Need at least 2 coins to merge');
      return;
    }
    navigate(`/app/coins/merge?type=${encodeURIComponent(group.coinType)}`);
  };

  // Cap the exported coin groups so a dust-heavy wallet (hundreds of types)
  // doesn't produce an unusable multi-MB payload.
  const AI_GROUP_CAP = 200;
  const aiGroups = filteredGroups.slice(0, AI_GROUP_CAP).map((g) => ({
    symbol: g.symbol,
    coinType: g.coinType,
    totalBalance: g.formattedBalance,
    coinCount: g.coinCount,
    isVerified: g.isVerified,
  }));

  const aiJson = JSON.stringify(
    {
      address: activeAddress?.address ?? null,
      alias: activeAddress?.alias ?? null,
      totalCoinTypes: coinData?.totalCoinTypes ?? 0,
      totalCoins: coinData?.totalCoins ?? 0,
      balancesOnly: coinData?.balancesOnly ?? false,
      truncated: filteredGroups.length > AI_GROUP_CAP,
      groups: aiGroups,
    },
    null,
    2
  );

  const aiMarkdown = [
    '# Sui coin balances',
    '',
    `- **Address:** ${activeAddress?.alias || activeAddress?.address || 'not connected'}`,
    `- **Coin types:** ${coinData?.totalCoinTypes ?? 0}`,
    `- **Coin objects:** ${coinData?.balancesOnly ? 'n/a (balances only)' : (coinData?.totalCoins ?? 0)}`,
    '',
    '## Balances',
    '| Symbol | Balance | Coins | Coin type |',
    '|---|---|---|---|',
    ...aiGroups.map(
      (g) =>
        `| ${g.symbol}${g.isVerified ? ' ✓' : ''} | ${g.totalBalance} | ${g.coinCount} | ${g.coinType} |`
    ),
    ...(filteredGroups.length > AI_GROUP_CAP
      ? ['', `_… ${filteredGroups.length - AI_GROUP_CAP} more coin types truncated._`]
      : []),
  ].join('\n');

  const aiPrompt = `Here are the coin balances for my Sui wallet ${
    activeAddress?.alias || activeAddress?.address || ''
  }:\n\n${aiMarkdown}\n\nGive me a summary of my holdings and flag anything worth attention (e.g. a large number of dust coins in one type that could be merged, or unverified coin types).`;

  if (!activeAddress) {
    return <div className="px-3 py-8 text-center text-muted-foreground">No address selected</div>;
  }

  if (isLoading || storeLoading) {
    return (
      <div className="px-2 py-2 space-y-4">
        {/* Header skeleton */}
        <ShimmerSkeleton className="h-[46px] w-full" rounded="xl" />

        {/* Coin Groups skeleton */}
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <ShimmerSkeleton key={i} className="h-[68px] w-full" rounded="xl" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-3 py-8 text-center">
        <div className="text-muted-foreground mb-2">Something went wrong</div>
        <div className="text-muted-foreground">{error}</div>
        <Button onClick={() => window.location.reload()} className="mt-4">
          Retry
        </Button>
      </div>
    );
  }

  if (!coinData || filteredGroups.length === 0) {
    return (
      <div className="px-3 py-8 text-center text-muted-foreground">
        <Coins className="w-10 h-10 mx-auto mb-2 text-tertiary" />
        <div className="mb-1">No coins found</div>
        <p className="text-sm">This address doesn't have any coins yet.</p>
        <Button onClick={() => navigate('/app/faucet')} className="mt-4" variant="secondary">
          Request from Faucet
        </Button>
      </div>
    );
  }

  return (
    <div className="px-2 py-2 space-y-4">
      {/* Header */}
      <div className="px-4 py-3 bg-card border border-border rounded-xl flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Coins className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          {/* A real <button>, not a clickable span: copying the address is an
              action, and it was previously unreachable by keyboard. text-left
              undoes the button default so the truncation reads as before. */}
          <button
            type="button"
            className="text-sm text-foreground truncate text-left cursor-pointer hover:text-muted-foreground transition-colors"
            onClick={() => copyToClipboard(activeAddress.address, 'Address')}
          >
            {activeAddress.alias || `${activeAddress.address.slice(0, 12)}...`}
          </button>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Badge variant="secondary">
            {coinData.totalCoinTypes} type{coinData.totalCoinTypes !== 1 ? 's' : ''}
          </Badge>
          {coinData && (
            <CopyForAiMenu
              prompt={aiPrompt}
              json={aiJson}
              markdown={aiMarkdown}
              onCopy={copyToClipboard}
            />
          )}
        </div>
      </div>

      {/* Coin Groups */}
      <div className="space-y-3">
        {filteredGroups.map((group) => (
          <CoinGroupCard
            key={group.coinType}
            group={group}
            isExpanded={expandedGroups.has(group.coinType)}
            onToggle={() => toggleGroup(group.coinType)}
            onTransfer={handleTransfer}
            onSplit={handleSplit}
            onMerge={() => handleMerge(group)}
            onCopy={copyToClipboard}
          />
        ))}
      </div>

      {/* Footer. When the node served only aggregate balances there are no coin
          objects to count or expand, so say that instead of printing "0 coin
          objects" next to real balances and letting it read as a broken page. */}
      <div className="px-3 py-2 flex items-center justify-between text-xs text-muted-foreground">
        {coinData.balancesOnly ? (
          <span>
            Balances only - this node returned no coin objects, so split and merge are unavailable
          </span>
        ) : (
          <>
            <span>{coinData.totalCoins} coin objects</span>
            <span>Click a coin type to expand</span>
          </>
        )}
      </div>
    </div>
  );
}

// CoinGroup Card Component
interface CoinGroupCardProps {
  group: CoinGroup;
  isExpanded: boolean;
  onToggle: () => void;
  onTransfer: (coin: CoinInfo) => void;
  onSplit: (coin: CoinInfo) => void;
  onMerge: () => void;
  onCopy: (text: string, label: string) => void;
}

function CoinGroupCard({
  group,
  isExpanded,
  onToggle,
  onTransfer,
  onSplit,
  onMerge,
  onCopy,
}: CoinGroupCardProps) {
  // Truncate package ID for display
  const truncatedPackageId = group.packageId
    ? group.packageId.length > 16
      ? `${group.packageId.slice(0, 8)}...${group.packageId.slice(-4)}`
      : group.packageId
    : '';

  return (
    <div className="border border-border rounded-xl overflow-hidden bg-card">
      {/* Group Header */}
      <button
        type="button"
        onClick={onToggle}
        className={`w-full flex items-center justify-between px-4 py-3 transition-colors ${
          isExpanded ? 'bg-accent' : 'hover:bg-accent/50'
        }`}
      >
        <div className="flex items-center gap-3">
          {/* Expand indicator */}
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-4 h-4 text-tertiary" />
          )}

          {/* Icon */}
          {group.iconUrl ? (
            <img
              src={group.iconUrl}
              alt={group.symbol}
              className="w-7 h-7 rounded-full"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : (
            <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
              {group.coinType.includes('sui::SUI') ? (
                <Droplet className="w-3.5 h-3.5 text-muted-foreground" />
              ) : (
                <Coins className="w-3.5 h-3.5 text-muted-foreground" />
              )}
            </div>
          )}

          <div className="text-left">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground">{group.symbol}</span>
              {group.isVerified && <Badge variant="secondary">Verified</Badge>}
              <span className="text-xs text-tertiary">({group.coinCount})</span>
            </div>
            <div className="text-xs text-muted-foreground">
              {group.formattedBalance} {group.symbol}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Merge button */}
          {group.coinCount > 1 && (
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                onMerge();
              }}
            >
              <Combine className="w-3.5 h-3.5" />
              Merge
            </Button>
          )}

          {/* Package info */}
          {group.packageId && (
            <span
              className="text-xs font-mono text-tertiary hover:text-muted-foreground cursor-pointer hidden sm:block"
              onClick={(e) => {
                // Nested inside the group-header <button>, so a real button
                // here would be invalid HTML. stopPropagation keeps the copy
                // from also toggling the group open.
                e.stopPropagation();
                onCopy(group.packageId, 'Package ID');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  onCopy(group.packageId, 'Package ID');
                }
              }}
              role="button"
              tabIndex={0}
            >
              {truncatedPackageId}
            </span>
          )}
        </div>
      </button>

      {/* Expanded Coin List */}
      {isExpanded && (
        <div className="border-t border-border">
          {group.description && (
            <div className="px-4 py-2 text-xs text-muted-foreground border-b border-border">
              {group.description}
            </div>
          )}
          {/* A wallet that farms the faucet or splits gas accumulates hundreds
              of dust coins in one group - and the first group (SUI) auto-expands
              on mount. Rendering them all is ~19 DOM nodes each in one
              synchronous commit. Past a threshold, window the rows; below it the
              plain map avoids a scroll container nobody needs. */}
          {group.coins.length > VIRTUALIZE_THRESHOLD ? (
            <VirtualCoinList
              coins={group.coins}
              symbol={group.symbol}
              decimals={group.decimals}
              onTransfer={onTransfer}
              onSplit={onSplit}
              onCopy={onCopy}
            />
          ) : (
            group.coins.map((coin) => (
              <CoinItem
                key={coin.coinObjectId}
                coin={coin}
                symbol={group.symbol}
                decimals={group.decimals}
                onTransfer={() => onTransfer(coin)}
                onSplit={() => onSplit(coin)}
                onCopy={onCopy}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

// Above this many coins in one expanded group, window the rows instead of
// mounting all of them. Chosen so a normal wallet (a handful of coin types,
// a few objects each) never pays for a scroll container, while a dust-heavy
// SUI group does not block the main thread on mount.
const VIRTUALIZE_THRESHOLD = 40;

// Estimated row height in px (px-4 py-3 around two text lines); the virtualizer
// measures real rows and corrects this, so it only needs to be close.
const COIN_ROW_HEIGHT = 64;

interface VirtualCoinListProps {
  coins: CoinInfo[];
  symbol: string;
  decimals: number;
  onTransfer: (coin: CoinInfo) => void;
  onSplit: (coin: CoinInfo) => void;
  onCopy: (text: string, label: string) => void;
}

/** Windowed rendering of one expanded group's coins. Only the rows in (and near)
 *  the viewport exist in the DOM, so a 900-coin dust group mounts ~10 rows, not
 *  900. The container is a bounded scroll area; the total-height spacer keeps the
 *  scrollbar honest. */
function VirtualCoinList({
  coins,
  symbol,
  decimals,
  onTransfer,
  onSplit,
  onCopy,
}: VirtualCoinListProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: coins.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => COIN_ROW_HEIGHT,
    overscan: 8,
    getItemKey: (i) => coins[i].coinObjectId,
  });

  return (
    <div ref={parentRef} className="max-h-[28rem] overflow-auto">
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
        {virtualizer.getVirtualItems().map((row) => {
          const coin = coins[row.index];
          return (
            <div
              key={row.key}
              ref={virtualizer.measureElement}
              data-index={row.index}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${row.start}px)`,
              }}
            >
              <CoinItem
                coin={coin}
                symbol={symbol}
                decimals={decimals}
                onTransfer={() => onTransfer(coin)}
                onSplit={() => onSplit(coin)}
                onCopy={onCopy}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Individual Coin Item Component
interface CoinItemProps {
  coin: CoinInfo;
  symbol: string;
  decimals: number;
  onTransfer: () => void;
  onSplit: () => void;
  onCopy: (text: string, label: string) => void;
}

const CoinItem = memo(function CoinItem({
  coin,
  symbol,
  decimals,
  onTransfer,
  onSplit,
  onCopy,
}: CoinItemProps) {
  const formattedBalance = formatBalance(coin.balance, decimals);

  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-accent/50 transition-colors group">
      <div className="flex-1 min-w-0">
        <button
          type="button"
          className="text-xs font-mono text-tertiary truncate text-left cursor-pointer hover:text-muted-foreground flex items-center gap-1 w-full"
          onClick={() => onCopy(coin.coinObjectId, 'Coin ID')}
        >
          {coin.coinObjectId}
          <Copy className="w-3 h-3 flex-shrink-0" />
        </button>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-sm text-foreground">
            {formattedBalance} {symbol}
          </span>
          <span className="text-xs text-tertiary">v{coin.version}</span>
        </div>
      </div>

      {/* Actions - show on hover */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button size="icon" variant="ghost" onClick={onTransfer} title="Send">
          <Send className="w-3.5 h-3.5" />
        </Button>
        <Button size="icon" variant="ghost" onClick={onSplit} title="Split">
          <Split className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
});
