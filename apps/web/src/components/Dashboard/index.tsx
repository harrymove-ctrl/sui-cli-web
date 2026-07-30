import { Check, Coins, LayoutGrid, Package, RefreshCw, RotateCcw } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { Layout, Layouts } from 'react-grid-layout';
import toast from 'react-hot-toast';
import { getHistoricalBalance, getWalletSummary } from '@/api/services/addresses';
import { DitherButton } from '@/components/dither-kit/button';
import { DitherGradient } from '@/components/dither-kit/gradient';
import { Sparkline } from '@/components/dither-kit/sparkline';
import { formatInteger } from '@/components/formater';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CopyForAiMenu } from '@/components/ui/copy-for-ai';
import { Loader } from '@/components/ui/loader';
import { useApiOnMount } from '@/hooks/api/useApi';
import { buildAiContext } from '@/lib/ai-context';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/stores/useAppStore';
import { useBalanceHistoryStore } from '@/stores/useBalanceHistoryStore';
import { formatRelativeTime } from '@/utils/format';
import { type AddableWidget, AddComponentMenu } from './AddComponentMenu';
import { BalanceHistoryChart } from './BalanceHistoryChart';
import { CoinDistributionChart } from './CoinDistributionChart';
import { DashboardGrid, type DashboardGridItem } from './DashboardGrid';
import { DitherBarList } from './DitherBarList';
import { RecentActivity } from './RecentActivity';
import { useDashboardConfig, type WidgetSize } from './useDashboardConfig';
import { useLenisScrollable } from './useLenisScrollable';
import { WalletsTable } from './WalletsTable';

// The catalogue of every dashboard widget: what it's called, which group it
// shows under in the "Add component" menu, and its default grid footprint. The
// render logic lives in the component (renderWidget) because it needs live data;
// this static half is what the add-menu, persistence, and defaults key off.
type WidgetCategory = 'Stats' | 'Active wallet' | 'Portfolio';
interface WidgetMeta {
  title: string;
  category: WidgetCategory;
  description: string;
  size: WidgetSize;
}

const WIDGET_META: Record<string, WidgetMeta> = {
  'stat-balance': {
    title: 'Total Balance',
    category: 'Stats',
    description: 'Portfolio SUI across all wallets',
    size: { w: 3, h: 4, minW: 2, minH: 3 },
  },
  'stat-objects': {
    title: 'Total Objects',
    category: 'Stats',
    description: 'Owned objects across all wallets',
    size: { w: 3, h: 4, minW: 2, minH: 3 },
  },
  'stat-packages': {
    title: 'Total Packages',
    category: 'Stats',
    description: 'Published packages across all wallets',
    size: { w: 3, h: 4, minW: 2, minH: 3 },
  },
  'stat-wallets': {
    title: 'Wallets & Coins',
    category: 'Stats',
    description: 'Wallet count and active coin types',
    size: { w: 3, h: 4, minW: 2, minH: 3 },
  },
  'balance-trend': {
    title: 'Balance Trend',
    category: 'Active wallet',
    description: 'Sparkline of the active wallet balance',
    size: { w: 3, h: 5, minW: 2, minH: 4 },
  },
  wallets: {
    title: 'Wallets Table',
    category: 'Portfolio',
    description: 'Every wallet with balance / objects / packages bars',
    size: { w: 12, h: 9, minW: 4, minH: 5 },
  },
  'wallet-balances': {
    title: 'Wallets by Balance',
    category: 'Portfolio',
    description: 'Bar chart comparing SUI across wallets',
    size: { w: 4, h: 9, minW: 3, minH: 5 },
  },
  'wallet-objects': {
    title: 'Wallets by Objects',
    category: 'Portfolio',
    description: 'Top wallets by owned-object count',
    size: { w: 4, h: 9, minW: 3, minH: 5 },
  },
  'wallet-packages': {
    title: 'Wallets by Packages',
    category: 'Portfolio',
    description: 'Top wallets by published packages',
    size: { w: 4, h: 9, minW: 3, minH: 5 },
  },
  'balance-history': {
    title: 'Balance History',
    category: 'Active wallet',
    description: 'Full on-chain SUI balance over time',
    size: { w: 8, h: 11, minW: 4, minH: 6 },
  },
  'coin-distribution': {
    title: 'Coin Distribution',
    category: 'Active wallet',
    description: 'Ring chart of the active wallet coin mix',
    size: { w: 6, h: 10, minW: 3, minH: 6 },
  },
  'coin-balances': {
    title: 'Coin Balances',
    category: 'Active wallet',
    description: 'Bar chart of each coin type you hold',
    size: { w: 4, h: 9, minW: 3, minH: 5 },
  },
  'recent-activity': {
    title: 'Recent Activity',
    category: 'Active wallet',
    description: 'Latest local & on-chain events',
    size: { w: 6, h: 10, minW: 3, minH: 6 },
  },
};

// The dashboard as it ships before any customization (order == render order).
const DEFAULT_WIDGET_IDS = [
  'stat-balance',
  'stat-objects',
  'stat-packages',
  'stat-wallets',
  'wallets',
  'balance-history',
  'coin-distribution',
  'recent-activity',
];

const sizeOf = (id: string): WidgetSize | undefined => WIDGET_META[id]?.size;

// The full catalogue passed to the add-menu.
const ADDABLE_WIDGETS: AddableWidget[] = Object.entries(WIDGET_META).map(([id, m]) => ({
  id,
  title: m.title,
  category: m.category,
  description: m.description,
}));

// Base 12-col desktop arrangement. Heights are in grid rows (rowHeight 30 + 16px
// gaps): stat tiles ~4, charts ~10-11, the wide wallets table ~9.
const BASE_LAYOUT: Layout[] = [
  { i: 'stat-balance', x: 0, y: 0, w: 3, h: 4, minW: 2, minH: 3 },
  { i: 'stat-objects', x: 3, y: 0, w: 3, h: 4, minW: 2, minH: 3 },
  { i: 'stat-packages', x: 6, y: 0, w: 3, h: 4, minW: 2, minH: 3 },
  { i: 'stat-wallets', x: 9, y: 0, w: 3, h: 4, minW: 2, minH: 3 },
  { i: 'wallets', x: 0, y: 4, w: 12, h: 9, minW: 4, minH: 5 },
  { i: 'balance-history', x: 0, y: 13, w: 12, h: 11, minW: 4, minH: 6 },
  { i: 'coin-distribution', x: 0, y: 24, w: 6, h: 10, minW: 3, minH: 6 },
  { i: 'recent-activity', x: 6, y: 24, w: 6, h: 10, minW: 3, minH: 6 },
];

// On narrow breakpoints, stack every card full-width so nothing can be squeezed
// into an unreadable column. Explicit per-breakpoint layouts (rather than letting
// RGL synthesize them) keep the arrangement predictable at every width.
function stackForCols(base: Layout[], cols: number): Layout[] {
  let y = 0;
  return base.map((item) => {
    const laid: Layout = { ...item, x: 0, y, w: cols, minW: 1 };
    y += item.h;
    return laid;
  });
}

const DEFAULT_LAYOUTS: Layouts = {
  lg: BASE_LAYOUT.map((l) => ({ ...l })),
  md: BASE_LAYOUT.map((l) => ({ ...l })),
  sm: stackForCols(BASE_LAYOUT, 6),
  xs: stackForCols(BASE_LAYOUT, 4),
  xxs: stackForCols(BASE_LAYOUT, 2),
};

/* Card anatomy borrowed from the @efferd/dashboard-3 block (stats.tsx / chart cards):
   muted xs CardTitle, big tabular-nums value, xs footnote - all in one unified grid. */
function ChartCard({
  title,
  total,
  subtitle,
  className,
  children,
}: {
  title: string;
  total?: string;
  subtitle?: string;
  className?: string;
  children: React.ReactNode;
}) {
  // min-h-0 lets this flex child shrink so its own overflow-auto engages when the
  // card is resized smaller than its content; the hook enables native wheel
  // scrolling inside it despite the page's Lenis smooth-scroll.
  const bodyRef = useLenisScrollable<HTMLDivElement>();
  return (
    <Card className={cn('shadow-none bg-card/90 backdrop-blur-sm h-full flex flex-col', className)}>
      <CardHeader className="pb-2">
        <CardTitle className="font-normal text-muted-foreground text-xs">{title}</CardTitle>
        {total ? (
          <p className="font-semibold text-2xl tabular-nums text-foreground">{total}</p>
        ) : null}
        {subtitle ? <CardDescription className="text-xs">{subtitle}</CardDescription> : null}
      </CardHeader>
      <CardContent ref={bodyRef} className="flex-1 min-h-0 overflow-auto">
        {children}
      </CardContent>
    </Card>
  );
}

// Grid item whose body scrolls natively even under the page's Lenis smooth-scroll
// (used for cards that render their own container, e.g. RecentActivity).
function ScrollableItem({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useLenisScrollable<HTMLDivElement>();
  return (
    <div ref={ref} className={cn('h-full overflow-auto', className)}>
      {children}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  unit,
  footnote,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  unit?: string;
  footnote: string;
}) {
  return (
    <Card className="relative overflow-hidden shadow-none bg-card/90 backdrop-blur-sm h-full">
      <DitherGradient from="blue" direction="up" opacity={0.14} cell={3} />
      <CardHeader className="relative pb-2">
        <CardTitle className="font-normal text-muted-foreground text-xs flex items-center gap-1.5">
          {icon}
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="relative flex flex-col gap-2">
        <p className="font-semibold text-2xl tabular-nums text-foreground">
          {value}
          {unit ? (
            <span className="text-sm font-medium text-muted-foreground ml-1">{unit}</span>
          ) : null}
        </p>
        <span className="text-xs text-muted-foreground">{footnote}</span>
      </CardContent>
    </Card>
  );
}

export function Dashboard() {
  const { addresses, environments, isLoading } = useAppStore();
  const activeAddress = addresses.find((a) => a.isActive);
  const activeEnv = environments.find((e) => e.isActive);

  // No wallet data yet (first mount, before fetchAddresses resolves) - show a
  // loading state instead of a flash of all-zero stat tiles.
  const dashboardNotReady = isLoading && addresses.length === 0;

  // One combined request per wallet (object count + published packages + coin groups)
  // instead of the 3 separate per-wallet fetches this used to fire independently -
  // each of those spawned its own `sui` CLI subprocess server-side (object count and
  // published-packages even ran the *same* `sui client objects` call twice). At 5
  // wallets that was ~17 simultaneous requests, which the browser's ~6-connection
  // per-origin HTTP/1.1 cap serialized into slow queued waves. See
  // /addresses/:address/summary on the server.
  // Tracks which wallets' summary fetch failed this load, so a failure can be shown as
  // "couldn't load" instead of silently rendering as an all-zero summary indistinguishable
  // from a wallet that genuinely has nothing.
  const [failedAddresses, setFailedAddresses] = useState<Set<string>>(new Set());

  const {
    data: walletSummaries,
    loading: walletSummariesLoading,
    refetch: refetchWalletSummaries,
  } = useApiOnMount(() => {
    const failed = new Set<string>();
    return Promise.all(
      addresses.map(async (addr) => {
        try {
          const summary = await getWalletSummary(addr.address);
          return { address: addr.address, ...summary };
        } catch {
          failed.add(addr.address);
          return {
            address: addr.address,
            objectCount: 0,
            packages: [],
            coinGroups: { groups: [], totalCoinTypes: 0, totalCoins: 0 },
          };
        }
      })
    ).then((results) => {
      setFailedAddresses(failed);
      return results;
    });
  }, [addresses.map((a) => a.address).join(',')]);

  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  useEffect(() => {
    if (walletSummaries) setLastUpdatedAt(Date.now());
  }, [walletSummaries]);

  const activeSummary = walletSummaries?.find((w) => w.address === activeAddress?.address);

  // Per-wallet coin-type count (SUI itself always counts as 1) - used only as a
  // count badge in the wallets list, never summed with SUI balance (different
  // coin types aren't the same unit and can't be added together meaningfully).
  const coinTypeCounts: Record<string, number> = {};
  for (const w of walletSummaries ?? []) {
    coinTypeCounts[w.address] = w.coinGroups.totalCoinTypes;
  }

  const balanceData = addresses.map((addr) => ({
    name: addr.alias || `${addr.address.slice(0, 6)}...`,
    value: parseFloat(addr.balance || '0'),
    isActive: addr.isActive,
  }));

  const objectData = addresses.map((addr) => ({
    name: addr.alias || `${addr.address.slice(0, 6)}...`,
    value: walletSummaries?.find((w) => w.address === addr.address)?.objectCount ?? 0,
    isActive: addr.isActive,
  }));

  const packageData = addresses.map((addr) => ({
    name: addr.alias || `${addr.address.slice(0, 6)}...`,
    value: walletSummaries?.find((w) => w.address === addr.address)?.packages.length ?? 0,
    isActive: addr.isActive,
  }));

  // One row per wallet instead of 3 separate cards each re-listing the same wallet names -
  // arrays below are all mapped from `addresses` in the same order, so index alignment holds.
  const walletMetrics = addresses.map((addr, i) => ({
    address: addr.address,
    name: balanceData[i].name,
    isActive: addr.isActive,
    failed: failedAddresses.has(addr.address),
    balance: balanceData[i].value,
    objects: objectData[i].value,
    packages: packageData[i].value,
  }));

  const coinGroupList = activeSummary?.coinGroups.groups ?? [];

  const coinData = coinGroupList.map((g) => ({
    symbol: g.symbol,
    formattedBalance: g.formattedBalance,
    value: parseFloat(g.totalBalance) || 0,
  }));

  const totalBalance = balanceData.reduce((sum, w) => sum + w.value, 0);
  const totalObjects = objectData.reduce((sum, w) => sum + w.value, 0);
  const totalPackages = packageData.reduce((sum, w) => sum + w.value, 0);
  const topCoin = [...coinData].sort((a, b) => b.value - a.value)[0];

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  };

  const aiJson = JSON.stringify(
    {
      network: activeEnv?.alias ?? null,
      totalBalance,
      totalObjects,
      totalPackages,
      wallets: walletMetrics,
    },
    null,
    2
  );

  const aiMarkdown = [
    '# Sui wallet portfolio',
    '',
    `- **Network:** ${activeEnv?.alias ?? 'not connected'}`,
    `- **Total balance:** ${totalBalance.toFixed(2)} SUI across ${addresses.length} wallets`,
    `- **Total objects:** ${totalObjects}`,
    `- **Total packages:** ${totalPackages}`,
    '',
    '## Wallets',
    '| Wallet | Balance (SUI) | Objects | Packages |',
    '|---|---|---|---|',
    ...walletMetrics.map(
      (w) =>
        `| ${w.name}${w.isActive ? ' (active)' : ''} | ${w.balance.toFixed(2)} | ${w.objects} | ${w.packages} |`
    ),
  ].join('\n');

  const aiPrompt = buildAiContext({
    title: 'Sui wallet portfolio',
    intro: [
      'A portfolio dashboard across every address in this local Sui CLI keystore,',
      'scoped to the active network. Nothing here mutates anything.',
    ],
    stateJson: aiJson,
    endpoints: [
      { method: 'GET', path: '/addresses', effect: 'every address in the keystore' },
      {
        method: 'GET',
        path: '/addresses/:address/summary',
        effect: 'balance, object and package counts for one address',
      },
      {
        method: 'GET',
        path: '/addresses/:address/history',
        effect: 'balance over time (per-transaction points)',
      },
      { method: 'GET', path: '/coins/:address', effect: 'coin objects held, by type' },
      { method: 'GET', path: '/health', effect: 'confirm the server is up' },
    ],
    rules: [
      'Balances are SUI in the UI but MIST over the RPC (1 SUI = 1e9 MIST)',
      'Totals here span ALL addresses; the "active wallet" figures are one address',
      'Every figure is scoped to the active network - testnet and mainnet balances are unrelated',
      'An address needs its own SUI coin for gas; a large non-SUI balance does not make it spendable',
    ],
    examples: [
      'summarise what this account holds',
      'find wallets with objects but no gas',
      'chart the balance history',
    ],
  });

  // Active wallet's profile across the 4 real per-wallet metrics, each normalized
  // to 0-100 against the max held by any of the user's wallets - a genuine
  // comparison, not a fabricated score.
  const activeObjects = activeSummary?.objectCount ?? 0;
  const activePackages = activeSummary?.packages.length ?? 0;
  const activeBalance = activeAddress ? parseFloat(activeAddress.balance || '0') : 0;
  const activeCoinTypes = activeAddress ? (coinTypeCounts[activeAddress.address] ?? 1) : 1;
  // Real on-chain balance history for the active wallet, reconstructed server-side
  // from the GraphQL RPC transaction-by-address index (full history since the
  // wallet's first transaction). Falls back to a previous-transaction-digest
  // walk over gRPC on networks without a public GraphQL endpoint (e.g. localnet),
  // which only reaches back as far as currently-owned objects allow - the local
  // per-address snapshot store fills in any older dates as it accumulates them.
  const { data: activeWalletHistory } = useApiOnMount(
    () => (activeAddress ? getHistoricalBalance(activeAddress.address) : Promise.resolve([])),
    [activeAddress?.address]
  );

  // getHistoricalBalance prepends a synthetic "current balance right now" anchor point
  // (timestamp = the moment of the fetch) that isn't a real transaction; dropping the
  // last entry leaves genuine on-chain points, newest first, for RecentActivity.
  const recentOnChainActivity = useMemo(() => {
    const points = activeWalletHistory ?? [];
    return points.length > 1
      ? [...points.slice(0, -1)].sort((a, b) => b.timestamp - a.timestamp).slice(0, 8)
      : [];
  }, [activeWalletHistory]);

  // Re-render every 30s purely so the "updated Xs ago" text stays live without a manual refresh.
  const [, forceTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => forceTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const recordSnapshot = useBalanceHistoryStore((s) => s.recordSnapshot);
  const snapshotsByAddress = useBalanceHistoryStore((s) => s.snapshotsByAddress);

  useEffect(() => {
    if (activeAddress) {
      recordSnapshot(activeAddress.address, parseFloat(activeAddress.balance || '0'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAddress?.address, activeAddress?.balance]);

  const realBalanceHistory = useMemo(() => {
    const onChain = activeWalletHistory ?? [];
    // On-chain points are per-transaction (authoritative). Daily local snapshots
    // only fill in days OLDER than the retained on-chain window - inside the
    // window the tx-level points already tell the full story.
    const earliestOnChain = onChain.length > 0 ? onChain[0].timestamp : Infinity;
    const localSnapshots = activeAddress ? (snapshotsByAddress[activeAddress.address] ?? []) : [];
    const older = localSnapshots
      .map((p) => ({ timestamp: new Date(`${p.date}T12:00:00`).getTime(), balance: p.balance }))
      .filter((p) => p.timestamp < earliestOnChain);
    return [...older, ...onChain].sort((a, b) => a.timestamp - b.timestamp);
  }, [activeWalletHistory, snapshotsByAddress, activeAddress?.address]);

  // Customizable-grid state: `editing` gates the drag/resize handles so normal
  // viewing stays clean; `layouts` is persisted to localStorage (this browser).
  const [editing, setEditing] = useState(false);
  const { activeIds, layouts, onLayoutChange, add, remove, reset } = useDashboardConfig({
    defaultIds: DEFAULT_WIDGET_IDS,
    defaultLayouts: DEFAULT_LAYOUTS,
    sizeOf,
  });

  // Pin the action toolbar once the hero row scrolls out of view, so
  // Add component / Customize / Done stay reachable while arranging cards
  // far down the page. The hero keeps its own inline copy; the pinned pill
  // only fades in when that copy is off-screen, so both are never visible
  // at once.
  //
  // Held as state (callback ref), not a useRef: the hero unmounts behind the
  // `dashboardNotReady` loader and remounts on HMR edits, and an observer
  // bound once via [] deps would keep watching the detached node - reporting
  // "not intersecting" forever and wedging the pill permanently on (or, on a
  // cold load where the loader renders first, never attaching at all).
  const [heroEl, setHeroEl] = useState<HTMLDivElement | null>(null);
  const [toolbarPinned, setToolbarPinned] = useState(false);
  useEffect(() => {
    if (!heroEl || typeof IntersectionObserver === 'undefined') {
      setToolbarPinned(false);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => setToolbarPinned(!entry.isIntersecting),
      // Count the hero as "gone" slightly early so the pill is already there
      // by the time the buttons disappear under the app's top bar.
      { rootMargin: '-72px 0px 0px 0px' }
    );
    observer.observe(heroEl);
    return () => observer.disconnect();
  }, [heroEl]);

  if (dashboardNotReady) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 min-h-[60vh]">
        <Loader variant="dither" size={48} label="Loading dashboard" className="text-primary" />
        <p className="text-sm text-muted-foreground">Loading your wallets…</p>
      </div>
    );
  }

  // Point series for the Balance Trend sparkline widget.
  const balanceSpark = realBalanceHistory.map((p) => p.balance);

  // Render a widget by id. Only ids present in WIDGET_META reach here (the config
  // hook filters unknown ids on load), so `default` is just a safety net.
  const renderWidget = (id: string): React.ReactNode => {
    switch (id) {
      case 'stat-balance':
        return (
          <StatCard
            icon={<Coins className="h-3.5 w-3.5" />}
            label="Total Balance"
            value={totalBalance.toFixed(2)}
            unit="SUI"
            footnote={`Active wallet: ${activeBalance.toFixed(2)} SUI`}
          />
        );
      case 'stat-objects':
        return (
          <StatCard
            icon={<Package className="h-3.5 w-3.5" />}
            label="Total Objects"
            value={String(totalObjects)}
            footnote={`Active wallet: ${activeObjects}`}
          />
        );
      case 'stat-packages':
        return (
          <StatCard
            icon={<Package className="h-3.5 w-3.5" />}
            label="Total Packages"
            value={String(totalPackages)}
            footnote={`Active wallet: ${activePackages}`}
          />
        );
      case 'stat-wallets':
        return (
          <StatCard
            icon={<Coins className="h-3.5 w-3.5" />}
            label="Wallets & Coins"
            value={String(addresses.length)}
            unit="wallets"
            footnote={`Active wallet coin types: ${activeCoinTypes}`}
          />
        );
      case 'balance-trend':
        return (
          <ChartCard
            title="Balance Trend"
            total={`${activeBalance.toFixed(2)} SUI`}
            subtitle={`${activeAddress?.alias || 'Active wallet'} · recent balance`}
          >
            {balanceSpark.length >= 2 ? (
              <div className="h-full min-h-[64px] w-full">
                <Sparkline data={balanceSpark} color="blue" variant="gradient" />
              </div>
            ) : (
              <div className="flex h-full min-h-[64px] items-center justify-center text-xs text-tertiary">
                Not enough history yet
              </div>
            )}
          </ChartCard>
        );
      case 'wallets':
        return (
          <ChartCard
            title="Wallets"
            subtitle={`${addresses.length} wallet${addresses.length === 1 ? '' : 's'} · balance / objects / packages, each column normalized to its own max · click a row to switch`}
          >
            <WalletsTable
              addresses={addresses}
              metrics={walletMetrics}
              coinTypeCounts={coinTypeCounts}
            />
          </ChartCard>
        );
      case 'wallet-balances':
        return (
          <ChartCard title="Wallets by Balance" subtitle="SUI balance across your wallets">
            <DitherBarList
              data={walletMetrics.map((w) => ({
                label: w.name,
                value: w.balance,
                formatted: `${w.balance.toFixed(2)} SUI`,
              }))}
              emptyMessage="No wallet balances yet"
            />
          </ChartCard>
        );
      case 'wallet-objects':
        return (
          <ChartCard title="Wallets by Objects" subtitle="Owned objects across your wallets">
            <DitherBarList
              data={walletMetrics.map((w) => ({
                label: w.name,
                value: w.objects,
                formatted: formatInteger(w.objects),
              }))}
              emptyMessage="No objects found"
            />
          </ChartCard>
        );
      case 'wallet-packages':
        return (
          <ChartCard title="Wallets by Packages" subtitle="Published packages across your wallets">
            <DitherBarList
              data={walletMetrics.map((w) => ({
                label: w.name,
                value: w.packages,
                formatted: formatInteger(w.packages),
              }))}
              emptyMessage="No packages published yet"
            />
          </ChartCard>
        );
      case 'balance-history':
        return (
          <ChartCard
            title="Active Wallet Balance History"
            total={`${activeBalance.toFixed(2)} SUI`}
            subtitle={`${activeAddress?.alias || 'Active wallet'} · full on-chain history since first transaction + daily snapshots`}
          >
            {/* h-full (not a fixed 260px) so the chart grows/shrinks with the card. */}
            <div className="h-full min-h-[200px]">
              <BalanceHistoryChart data={realBalanceHistory} />
            </div>
          </ChartCard>
        );
      case 'coin-distribution':
        return (
          <ChartCard
            title={`Coin distribution — ${activeAddress?.alias || 'active wallet'}`}
            total={
              coinData.length > 0 && topCoin
                ? `${topCoin.formattedBalance} ${topCoin.symbol}`
                : undefined
            }
            subtitle={
              coinData.length > 0
                ? `${coinData.length} coin type${coinData.length === 1 ? '' : 's'} held${topCoin ? ` · ${topCoin.symbol} leads` : ''}`
                : 'No coins held in this wallet'
            }
          >
            {coinData.length > 0 ? (
              <CoinDistributionChart data={coinData} />
            ) : (
              <div className="flex h-full min-h-[120px] items-center justify-center text-sm text-tertiary">
                No coins to display
              </div>
            )}
          </ChartCard>
        );
      case 'coin-balances':
        return (
          <ChartCard
            title="Coin Balances"
            subtitle={`${coinData.length} coin type${coinData.length === 1 ? '' : 's'} in ${activeAddress?.alias || 'active wallet'}`}
          >
            <DitherBarList
              data={coinData.map((c) => ({
                label: c.symbol || 'Unknown',
                value: c.value,
                formatted: c.formattedBalance,
              }))}
              emptyMessage="No coins held in this wallet"
            />
          </ChartCard>
        );
      case 'recent-activity':
        // RecentActivity renders its own bordered card; ScrollableItem makes the
        // grid cell scroll natively (past Lenis) when the activity list overflows.
        return (
          <ScrollableItem className="rounded-xl">
            <RecentActivity
              onChainHistory={recentOnChainActivity}
              activeWalletAlias={activeAddress?.alias}
            />
          </ScrollableItem>
        );
      default:
        return null;
    }
  };

  const gridItems: DashboardGridItem[] = activeIds.map((id) => ({ i: id, node: renderWidget(id) }));

  // Rendered twice: inline in the hero row, and inside the pinned pill that
  // follows the viewport once the hero scrolls away. One shared control
  // height (h-9) so every pill sits flush with its neighbours.
  const actionToolbar = (
    <>
      <CopyForAiMenu
        prompt={aiPrompt}
        json={aiJson}
        markdown={aiMarkdown}
        onCopy={handleCopy}
        className="h-9"
      />
      <DitherButton
        onClick={() => refetchWalletSummaries()}
        variant="dotted"
        disabled={walletSummariesLoading}
        title="Refresh wallet data"
        className="rounded-full h-9 w-9 p-0 flex items-center justify-center"
      >
        <RefreshCw className={cn('h-4 w-4', walletSummariesLoading && 'animate-spin')} />
      </DitherButton>
      <AddComponentMenu
        widgets={ADDABLE_WIDGETS}
        activeIds={activeIds}
        onAdd={add}
        onRemove={remove}
      />
      {editing ? (
        <>
          <DitherButton
            onClick={reset}
            variant="dotted"
            title="Reset to the default layout"
            aria-label="Reset layout"
            className="rounded-full h-9 px-3 lg:px-4"
          >
            <RotateCcw className="h-4 w-4" />
            <span className="hidden lg:inline">Reset</span>
          </DitherButton>
          <DitherButton
            onClick={() => setEditing(false)}
            variant="gradient"
            bloom="low"
            aria-label="Done customizing"
            className="rounded-full h-9 px-3 lg:px-4"
          >
            <Check className="h-4 w-4" />
            <span className="hidden lg:inline">Done</span>
          </DitherButton>
        </>
      ) : (
        <DitherButton
          onClick={() => setEditing(true)}
          variant="dotted"
          title="Customize layout — drag & resize cards"
          aria-label="Customize layout"
          className="rounded-full h-9 px-3 lg:px-4"
        >
          <LayoutGrid className="h-4 w-4" />
          <span className="hidden lg:inline">Customize</span>
        </DitherButton>
      )}
    </>
  );

  return (
    <div className="space-y-8">
      {/* Welcome hero. Stacked until `lg`, not `sm`: the sidebar eats the
          viewport, and sharing a row with the (variable-length) greeting leaves
          the toolbar ~150px at tablet widths - enough to force every pill onto
          its own line. */}
        <div
          ref={setHeroEl}
          className="flex flex-col items-start justify-between gap-4 lg:flex-row lg:items-center"
        >
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              Welcome back{activeAddress?.alias ? `, ${activeAddress.alias}` : ''}! 👋
            </h1>
            <p className="text-sm text-muted-foreground mt-2">
              {activeEnv ? `Connected to ${activeEnv.alias}` : 'No network connected'}
              {' · '}
              {lastUpdatedAt ? `Updated ${formatRelativeTime(lastUpdatedAt)}` : 'Loading…'}
            </p>
          </div>
          {/* Fades out as the pill fades in. Both copies live in the DOM at once,
              so without this they overlap for the length of the transition - and
              a screen reader would read every control twice. */}
          <div
            className={cn(
              'flex max-w-full flex-wrap items-center justify-end gap-2 transition-opacity duration-200',
              toolbarPinned ? 'pointer-events-none opacity-0' : 'opacity-100'
            )}
            aria-hidden={toolbarPinned}
          >
            {actionToolbar}
          </div>
        </div>

        {/* Pinned toolbar - a zero-height sticky rail: once the hero copy of the
            buttons scrolls out of view, this glass pill fades in at the top of
            the scroll area and follows the user down the page. */}
        <div className="sticky top-3 z-30 h-0 !mt-0">
          <div
            className={cn(
              'flex justify-end transition-all duration-200',
              toolbarPinned
                ? 'opacity-100 translate-y-0 pointer-events-auto'
                : 'pointer-events-none -translate-y-2 opacity-0'
            )}
            aria-hidden={!toolbarPinned}
          >
            {/* `max-w-full` + `flex-wrap`: the row is wider than a phone viewport,
                and a non-wrapping pill inside a `justify-end` flex parent gets
                pushed off the left edge rather than clipped on the right. */}
            <div className="flex max-w-full flex-wrap items-center justify-end gap-2 rounded-3xl border border-border/60 bg-background/75 px-2.5 py-2 shadow-lg shadow-black/20 backdrop-blur-md">
              {actionToolbar}
            </div>
          </div>
        </div>

        {/* One free-form grid: every card can be dragged/resized in edit mode and
            the arrangement is remembered per browser. Toggle via "Customize". */}
        {editing && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-2 text-xs text-muted-foreground">
            Drag any card to move it, drag its bottom-right corner to resize, or click the
            <span className="font-medium text-foreground"> × </span> to remove it. Use
            <span className="font-medium text-foreground"> Add component </span> to add charts.
            Everything saves to this browser — hit{' '}
            <span className="font-medium text-foreground">Reset</span> to restore the default.
          </div>
        )}
        <DashboardGrid
          items={gridItems}
          layouts={layouts}
          editing={editing}
          // Persist only while customizing - viewing/breakpoint reflows must never
          // overwrite the saved arrangement (that's what wedged the old version).
          onLayoutChange={editing ? onLayoutChange : undefined}
          onRemove={editing ? remove : undefined}
        />
    </div>
  );
}
