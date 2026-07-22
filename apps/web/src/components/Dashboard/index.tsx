import { GradientSpin } from 'gradient-spin';
import { Coins, Package, RefreshCw } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getHistoricalBalance, getWalletSummary } from '@/api/services/addresses';
import { DitherButton } from '@/components/dither-kit/button';
import { DitherGradient } from '@/components/dither-kit/gradient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PixelCard } from '@/components/ui/pixel-card';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';
import { useApiOnMount } from '@/hooks/api/useApi';
import { useAppStore } from '@/stores/useAppStore';
import { useBalanceHistoryStore } from '@/stores/useBalanceHistoryStore';
import { formatRelativeTime } from '@/utils/format';
import { ActivityHeatmap } from './ActivityHeatmap';
import { BalanceHistoryChart } from './BalanceHistoryChart';
import { CoinDistributionChart } from './CoinDistributionChart';
import { RecentActivity } from './RecentActivity';
import { WalletsTable } from './WalletsTable';

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
  return (
    <Card className={cn('shadow-none bg-card/90 backdrop-blur-sm', className)}>
      <CardHeader className="pb-2">
        <CardTitle className="font-normal text-muted-foreground text-xs">{title}</CardTitle>
        {total ? (
          <p className="font-semibold text-2xl tabular-nums text-foreground">{total}</p>
        ) : null}
        {subtitle ? <CardDescription className="text-xs">{subtitle}</CardDescription> : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

/* Labeled section wrapper - the dashboard grid used to be one flat 4-col block mixing
   portfolio-wide, active-wallet-only, and local-only-to-this-browser numbers with no visual
   separation. Each section says up front what scope its numbers are. */
function DashboardSection({
  title,
  scope,
  children,
}: {
  title: string;
  scope: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-baseline gap-2">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <span className="text-xs text-muted-foreground">{scope}</span>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
    </section>
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
    <Card className="relative overflow-hidden shadow-none bg-card/90 backdrop-blur-sm">
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
  const navigate = useNavigate();
  const { theme } = useTheme();
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
  } = useApiOnMount(
    () => {
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
    },
    [addresses.map((a) => a.address).join(',')]
  );

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
  // (timestamp = the moment of the fetch) that isn't a real transaction. It always sorts
  // to the newest slot, so dropping the last entry leaves only genuine on-chain tx timestamps.
  const onChainActivityTimestamps = useMemo(() => {
    const points = activeWalletHistory ?? [];
    return points.length > 1 ? points.slice(0, -1).map((p) => p.timestamp) : [];
  }, [activeWalletHistory]);

  // Same real on-chain points as above, kept as {timestamp, balance} (not just timestamps) so
  // RecentActivity can show what actually happened, not just when - most recent first.
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

  if (dashboardNotReady) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 min-h-[60vh]">
        <GradientSpin pattern="ripple" colorBy="row" period={750} rows={5} cols={5} cellSize={8} label="Loading dashboard" />
        <p className="text-sm text-muted-foreground">Loading your wallets…</p>
      </div>
    );
  }

  return (
    <div className="relative -m-8 p-8 overflow-hidden">
      {/* Pixel background - sits behind the whole dashboard content, auto-animating (no hover needed).
          Canvas fillStyle can't resolve CSS custom properties, so pick literal colors per theme. */}
      <PixelCard
        className="absolute inset-0"
        autoPlay
        colors={
          theme === 'dark'
            ? ['#4da2ff', '#003f87', '#199e70']
            : ['rgba(20,20,25,0.5)', 'rgba(77,162,255,0.35)', 'rgba(20,20,25,0.25)']
        }
        backgroundColor={theme === 'dark' ? '#0a0a0a' : '#ffffff'}
        gap={14}
        pixelSize={2.5}
        speed={35}
        appearFrom="middle"
        durationMs={2000}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-background/70 via-background/25 to-background/50" />

      <div className="relative z-10 space-y-8">
        {/* Welcome hero */}
        <div className="flex items-center justify-between gap-4">
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
          <div className="flex items-center gap-2">
            <DitherButton
              onClick={() => refetchWalletSummaries()}
              variant="dotted"
              disabled={walletSummariesLoading}
              title="Refresh wallet data"
              className="rounded-full h-11 w-11 p-0 flex items-center justify-center"
            >
              <RefreshCw className={cn('h-4 w-4', walletSummariesLoading && 'animate-spin')} />
            </DitherButton>
            <DitherButton
              onClick={() => navigate('/app/faucet')}
              variant="gradient"
              bloom="low"
              className="rounded-full h-11 px-6 text-sm"
            >
              + Request Faucet
            </DitherButton>
          </div>
        </div>

        {/* Every number below is scoped to activeEnv - split into labeled sections so it's
            clear at a glance what's portfolio-wide vs. active-wallet-only vs. local-to-this-
            browser, instead of one flat undifferentiated grid. */}
        <DashboardSection
          title="Portfolio"
          scope={`across all wallets · ${activeEnv?.alias ?? 'no network'}`}
        >
          <StatCard
            icon={<Coins className="h-3.5 w-3.5" />}
            label="Total Balance"
            value={totalBalance.toFixed(2)}
            unit="SUI"
            footnote={`Active wallet: ${activeBalance.toFixed(2)} SUI`}
          />
          <StatCard
            icon={<Package className="h-3.5 w-3.5" />}
            label="Total Objects"
            value={String(totalObjects)}
            footnote={`Active wallet: ${activeObjects}`}
          />
          <StatCard
            icon={<Package className="h-3.5 w-3.5" />}
            label="Total Packages"
            value={String(totalPackages)}
            footnote={`Active wallet: ${activePackages}`}
          />
          <StatCard
            icon={<Coins className="h-3.5 w-3.5" />}
            label="Wallets & Coins"
            value={String(addresses.length)}
            unit="wallets"
            footnote={`Active wallet coin types: ${activeCoinTypes}`}
          />

          <ChartCard
            className="md:col-span-2 lg:col-span-4"
            title="Wallets"
            subtitle={`${addresses.length} wallet${addresses.length === 1 ? '' : 's'} · balance / objects / packages, each column normalized to its own max · click a row to switch`}
          >
            <WalletsTable addresses={addresses} metrics={walletMetrics} coinTypeCounts={coinTypeCounts} />
          </ChartCard>
        </DashboardSection>

        <DashboardSection
          title={`Active wallet — ${activeAddress?.alias || 'none selected'}`}
          scope={activeEnv ? `${activeEnv.alias} only` : 'no network'}
        >
          <ChartCard
            className="md:col-span-2 lg:col-span-3"
            title="Active Wallet Balance History"
            total={`${activeBalance.toFixed(2)} SUI`}
            subtitle={`${activeAddress?.alias || 'Active wallet'} · full on-chain history since first transaction + daily snapshots`}
          >
            <div className="h-[260px]">
              <BalanceHistoryChart data={realBalanceHistory} />
            </div>
          </ChartCard>
          <ChartCard
            title="Activity"
            subtitle={`Local build/test/publish/upgrade runs + on-chain transactions for ${activeAddress?.alias || 'active wallet'}, last 12 weeks`}
          >
            <ActivityHeatmap onChainTimestamps={onChainActivityTimestamps} />
          </ChartCard>

          {coinData.length > 0 && (
            <ChartCard
              className="md:col-span-2"
              title={`Coin distribution — ${activeAddress?.alias || 'active wallet'}`}
              total={topCoin ? `${topCoin.formattedBalance} ${topCoin.symbol}` : undefined}
              subtitle={`${coinData.length} coin type${coinData.length === 1 ? '' : 's'} held${topCoin ? ` · ${topCoin.symbol} leads` : ''}`}
            >
              <CoinDistributionChart data={coinData} />
            </ChartCard>
          )}
        </DashboardSection>

        {/* Local build/test/publish/upgrade history - this browser only, never synced. */}
        <DashboardSection title="Local activity" scope="this browser only, not synced">
          <div className="sm:col-span-2 lg:col-span-4">
            <RecentActivity
              onChainHistory={recentOnChainActivity}
              activeWalletAlias={activeAddress?.alias}
            />
          </div>
        </DashboardSection>
      </div>
    </div>
  );
}
