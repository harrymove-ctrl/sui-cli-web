# Dashboard Architecture

`apps/web/src/components/Dashboard` — the `/app` landing page.

Snapshot of how the Dashboard gets chart data on screen, how that
data-fetching is optimized, and the conventions to follow when extending it.
Written the same way as [`BACKEND_ARCHITECTURE.md`](./BACKEND_ARCHITECTURE.md)
— a reference for future work, not a tutorial.

## Contents

1. [Feature layout](#1-feature-layout)
2. [How charts get their data on screen](#2-how-charts-get-their-data-on-screen)
3. [Optimization: one request per wallet, not ~17](#3-optimization-one-request-per-wallet-not-17)
4. [DevX: adding a new chart](#4-devx-adding-a-new-chart)
5. [Local-only data, clearly labeled](#5-local-only-data-clearly-labeled)

---

## 1. Feature layout

| File | Responsibility |
|---|---|
| `index.tsx` | Page shell — fetches, derives every view-model, lays out the sections |
| `WalletsTable.tsx` | One row per wallet — `DitherAvatar`, name, coin-type badge, balance / objects / packages columns (each with a `DitherGradient` scan-bar, normalized to its own column max), click switches active wallet |
| `BalanceHistoryChart.tsx` | dither-kit `AreaChart` — active wallet's balance over time |
| `ActivityHeatmap.tsx` | 12-week local + on-chain activity heatmap (GitHub-style, hand-rolled CSS grid) |
| `CoinDistributionChart.tsx` | dither-kit `PieChart` (donut) — active wallet's coin-type breakdown, plus a custom %/amount side-list |
| `RecentActivity.tsx` | Local Move Studio history **and** a real on-chain-transactions list, both for the active wallet |

`components/dither-kit/` (outside `Dashboard/`, shared) is a vendored
canvas-based chart/UI library — see the dedicated subsection in §2.

`StatCard`, `ChartCard`, and `DashboardSection` (shared chrome) are defined
inline at the top of `index.tsx` rather than as separate files — small
enough to not warrant a split. `StatTile.tsx` in this same directory is
dead — not imported anywhere — likely an earlier, file-based version of the
inline `StatCard`; safe to delete rather than treat as a source of truth.

`DashboardSection` wraps a titled group with a
`scope` line (e.g. "across all wallets · testnet") — the dashboard is split
into **Portfolio** (all wallets), **Active wallet** (just the active one),
and **Local activity** (this browser only), so it's clear at a glance what
each section's numbers are scoped to, instead of one flat undifferentiated
grid.

There used to be a `WalletRadarChart.tsx` (active wallet's balance/objects/
packages/coin-types normalized against its *own* other wallets' max, on a
4-axis radar). Removed — normalizing a wallet against your other wallets
across four unrelated units doesn't answer a real question, it just looks
like a chart.

There also used to be 3 separate `WalletBarChart` cards — "Balance by
wallet", "Objects by wallet", "Packages by wallet" — each independently
listing the same 5 wallet names. Comparing one wallet's balance against its
own object count meant re-scanning the same truncated names across 3 cards.
First replaced with a metrics-only table (`WalletMetricsTable`), one row per
wallet, one column per metric. That table and the separate `WalletsList`
card (the plain wallet-switcher list) turned out to be the *same* 5 wallets
listed twice more, so they were merged into what's now `WalletsTable`: one
card, one row per wallet, with the avatar/coin-badge/click-to-switch
behavior `WalletsList` had *and* the balance/objects/packages columns —
comparing and acting on a wallet now both happen in the same row instead of
two different cards.

`BalanceHistoryChart` and `CoinDistributionChart` were originally Recharts
(`AreaChart`/`PieChart`) — both migrated to dither-kit's equivalents (§2)
once dither-kit was adopted broadly enough across the page that having two
different chart libraries side by side stopped making sense. `recharts` is
no longer imported anywhere under `Dashboard/` (or, after this migration,
anywhere in the client) — the dependency is still in `package.json` since a
pre-existing, already-unused `components/ui/chart.tsx` still references it,
but nothing live depends on it.

**Every chart component is a dumb view.** It takes already-shaped data as
props and renders it. All fetching, derivation, and cross-wallet aggregation
happens once, in `index.tsx`, and flows down as props. No chart component
calls the API layer itself.

---

## 2. How charts get their data on screen

**Data sources, fetched once on mount:**

| Source | Scope | Gets you |
|---|---|---|
| `useAppStore()` | global state | `addresses`, `environments` (already loaded app-wide) |
| `useApiOnMount(getWalletSummary)` | per wallet | object count + published packages + coin groups |
| `useApiOnMount(getHistoricalBalance)` | active wallet only | on-chain balance timeline |
| `useBalanceHistoryStore` (Zustand) | local | daily balance snapshots, fills gaps older than the on-chain window |
| `useMoveDevStore` (Zustand) | local | build/test/publish/upgrade history |

**Then it flows straight through, no memoization layer:**

```
raw sources
   → derive view-models inline (plain .map/.reduce/.find, recomputed every render)
   → <ChartCard title subtitle total>
   → chart component (dither-kit, or hand-rolled CSS for ActivityHeatmap/WalletsTable)
```

The derived view-models, all plain consts in `index.tsx`:

| View-model | Shape | Feeds |
|---|---|---|
| `balanceData` / `objectData` / `packageData` | `{ name, value, isActive }[]` | merged into `walletMetrics` below |
| `walletMetrics` | `{ address, name, isActive, failed, balance, objects, packages }[]` - the 3 arrays above zipped by index (same `addresses` order, so alignment holds without a re-lookup) | `WalletsTable` |
| `coinData` | `{ symbol, formattedBalance, value }[]` | `CoinDistributionChart` |
| `realBalanceHistory` | on-chain points + older local snapshots, merged & sorted | `BalanceHistoryChart` |
| `onChainActivityTimestamps` | `activeWalletHistory` minus its synthetic "now" anchor, timestamps only | `ActivityHeatmap` |
| `recentOnChainActivity` | same points as above but `{ timestamp, balance }`, newest first, capped at 8 | `RecentActivity` |
| `failedAddresses` | `Set<string>` of wallets whose `/summary` fetch threw this load | folded into each `walletMetrics` row as `.failed`, shown as a warning icon in `WalletsTable` |

**Conventions that hold across every chart:**

- **`useApiOnMount(fn, deps)`** (`hooks/api/useApi.ts`) is the entire
  data-fetching primitive here — `useApi`'s `{data, loading, error, execute}`
  plus a `useEffect` that calls `execute()` on mount and on `deps` change.
  No React Query / SWR. Every fetch is one visible hook call at the top of
  `Dashboard`, not hidden behind cache config.
- **No cross-load cache.** Data lives in React state for the component's
  lifetime only — leave the page, come back, it re-fetches. The optimization
  in §3 is about not re-fetching *redundantly within one load*, not about
  caching across loads.
- **`components/dither-kit/`** (outside `Dashboard/`, shared) is a separate,
  vendored library — installed via its own `npx @dither-kit/cli add <name>`,
  not the shadcn registry flow, files land under `components/dither-kit/`.
  Canvas-based ordered-dither textures for charts/avatars/buttons/gradients.
  It's now the **only** chart-rendering library the Dashboard uses:
  `BalanceHistoryChart` → `AreaChart`, `CoinDistributionChart` → `PieChart`,
  `WalletsTable`'s scan-bars → `DitherGradient`, wallet avatars →
  `DitherAvatar`, the refresh/faucet buttons and stat-tile backdrops →
  `DitherButton`/`DitherGradient`. `ActivityHeatmap` (hand-rolled CSS grid —
  a calendar heatmap isn't a dither-kit chart type) and the plain `<table>`
  structure of `WalletsTable` are the two things that aren't dither-kit
  components themselves, though `WalletsTable`'s bars are. **Recharts is no
  longer used anywhere in the Dashboard** (see §1's migration note).
- **⚠️ React 18 compatibility patches — re-apply after any `@dither-kit/cli`
  add/update.** The vendored source ships assuming React 19 and a newer
  `@types/react`; this project is on React 18 (`^18.2.0`). Two real bugs
  showed up on install, both fixed by hand directly in
  `components/dither-kit/*.tsx` (not upstream — a future `cli add`/update
  will silently overwrite these fixes):
  1. `<SomeContext value={x}>` (React 19's terser Provider syntax) doesn't
     type-check or work on React 18 — needs `<SomeContext.Provider
     value={x}>`. Fixed in `area.tsx`, `cartesian-root.tsx`, `polar-root.tsx`
     (5 provider/consumer pairs total).
  2. `cartesian-canvas.tsx`'s `LoopArgs.state`/`targets`/`stars` were typed
     as `RefObject<T>` (React types define `RefObject.current` as always
     `T | null`) even though they're populated via `useRef(realValue)`
     (genuinely `MutableRefObject<T>`, non-null `.current`) — ~40 spurious
     "possibly null" errors. Fixed by retyping those three fields as
     `MutableRefObject<T>`, matching what's actually passed in.
  If `npx @dither-kit/cli` is run again for an update, re-check
  `npx tsc --noEmit` for these two error signatures before trusting the
  result.
- **Colors always come from CSS custom properties or the dither-kit
  palette**, never a raw hex literal. Dither-kit's own components
  (`XAxis`/`YAxis`/`Tooltip`/`Legend`) already read `text-muted-foreground`/
  `bg-popover`/`text-popover-foreground` — shadcn's semantic tokens — so they
  re-theme for free with the app's light/dark toggle with zero extra work.
  `ActivityHeatmap`'s empty (zero-activity) cells intentionally use
  `bg-muted`/`border-border` (the app's real, visible surface/border
  tokens), not a dither fill — a near-invisible empty state was a real bug
  here once (see the empty-state bullet below).
- **Identity is a fixed color order, not reassigned by filtering.**
  `CoinDistributionChart` builds its dither-kit `ChartConfig` by walking its
  coin list and assigning colors from a fixed `COLOR_ORDER` array (`blue,
  green, purple, orange, pink, red, grey`) by index — a coin type keeps the
  same color across reloads as long as its position in the list is stable.
  This replaced the old `chartPatterns.tsx` (SVG hatch-texture `<defs>`,
  deleted once its only consumer moved to dither-kit's own dithered fill,
  which already carries identity fine at this size — a handful of slices,
  not a dense series list needing a texture fallback).
- **Direct labels are selective, not universal.** `WalletsTable` shows
  the real number in every cell, with the `DitherGradient` scan-bar
  underneath as an accent (normalized to that *column's* own max —
  balance/objects/packages are different units, so a global max across
  columns would be meaningless). The dither-kit charts rely on their shared
  hover `<Tooltip>` instead for point-level detail.
- **Every chart owns its real empty state.** `data.length < 2`
  (`BalanceHistoryChart`), `maxCount > 0` (`ActivityHeatmap`), `data.length
  === 0` (`WalletsTable`) — each renders honest copy instead of
  degrading into an empty-looking chart. This rule exists because of a real
  bug: an all-zero bar chart used to silently render as a bare list of axis
  labels with no bars and no explanation, and later, `ActivityHeatmap`'s
  first empty-cell treatment (a `--chart-grid`-bordered cell) was *still*
  too low-contrast to read as anything other than a blank card — fixed by
  switching to `bg-muted`/`border-border` instead.

---

## 3. Optimization: one request per wallet, not ~17

### Before

`index.tsx` fired 4 independent `useApiOnMount` fan-outs per mount:

- object counts — `Promise.all` over all wallets
- coin groups — active wallet only
- coin groups **again** — all wallets, just to get per-wallet coin-type counts
- published-package counts — all wallets

At 5 wallets that's **~17 simultaneous HTTP requests**, with two real
problems layered on top of the redundancy:

1. **A literal duplicate CLI subprocess call.** The server's
   `getPublishedPackages` independently re-ran the exact same `sui client
   objects <address>` subprocess that `getObjects` already ran — just to
   filter it for `UpgradeCap` objects.
2. **Browser HTTP/1.1 connection queueing.** The local server runs plain
   Fastify over HTTP/1.1 (no `http2`), and Chrome caps concurrent connections
   per origin at ~6. ~17 simultaneous requests queue into slow waves instead
   of running in parallel — this, not server throughput, was the dominant
   cause of "reload feels slow."

### Now

One combined endpoint, `GET /addresses/:address/summary`
(`apps/server/src/routes/address.ts`), returns everything for one wallet
in a single request: `{ objectCount, packages, coinGroups }`.

Server — one raw objects call, reused for both the count and the package
filter:

```ts
const [rawObjects, coinGroups] = await Promise.all([
  addressService.getRawObjects(address), // undecoded, shared with count + package filter
  coinService.getCoinsGrouped(address),  // separate CLI command, can't be merged with objects
]);
const packages = packageService.extractPublishedPackages(rawObjects);
```

Client — one hook, `Promise.all` over wallets:

```ts
const { data: walletSummaries } = useApiOnMount(
  () => Promise.all(addresses.map((a) => getWalletSummary(a.address))),
  [addresses.map((a) => a.address).join(',')]
);
const activeSummary = walletSummaries?.find((w) => w.address === activeAddress?.address);
```

Everything the Dashboard used to fetch separately — `objectCounts`,
`walletCoinGroups`, the active-only `coinGroups`, `packageCounts` — is now
*derived* from `walletSummaries` with plain `.find()`/`.length`. No extra
fetches.

**Result: ~17 requests → 5 (one per wallet)** — under the browser's
connection cap, so they run concurrently instead of queuing.

Two small additions ride on top of this fetch: a per-wallet failure is
tracked in a `failedAddresses: Set<string>` (a failed `getWalletSummary`
call falls back to an all-zero summary internally, which would otherwise be
indistinguishable from a wallet that genuinely has nothing — `WalletsTable`
shows a warning icon for these instead), and `refetch` + `loading` from
`useApiOnMount` back a manual refresh button plus an "Updated Xs ago"
timestamp in the header, ticking every 30s.

> **Note:** `getHistoricalBalance` (the balance-timeline chart) deliberately
> stays a separate, un-merged fetch. It's active-wallet-only, and it does
> meaningfully more work server-side (gRPC batch-fetching transaction effects
> for every owned object's `previousTransaction` digest) — folding it into
> the per-wallet summary would make the other 4 wallets pay for work only the
> active one needs.

The shared type is `WalletSummary` in `@sui-cli-web/shared`. **After editing
`packages/shared/src/index.ts`, run `npm run build` in `packages/shared`** —
client and server both consume the compiled `dist/`, not the source.

---

## 4. DevX: adding a new chart

1. **Check if the data already exists** in `walletSummaries` /
   `activeWalletHistory` / the Zustand stores. If yes, derive it inline with
   a plain `.map`/`.reduce` — don't add a new fetch. If it's per-wallet data
   that doesn't exist yet, extend `WalletSummary` +
   `/addresses/:address/summary` rather than adding a 5th parallel fetch (see
   §3 — that's the exact mistake being undone there).
2. **Build the chart as a dumb component** under `Dashboard/`: `{ data: T[];
   ...formatting props }` in, dither-kit JSX out (`AreaChart`/`LineChart`/
   `BarChart`/`PieChart`/`RadarChart` + composable `XAxis`/`YAxis`/`Tooltip`/
   `Legend`/`Area`/`Line`/`Pie` children — see `BalanceHistoryChart.tsx` or
   `CoinDistributionChart.tsx` for a worked example). If the component you
   need isn't installed yet, `npx @dither-kit/cli add <name>` from
   `apps/web` — then immediately re-run `npx tsc --noEmit` and check
   for the two React-18 error signatures in the bullet above before writing
   any code against it.
3. **Handle the real empty state.** Decide what "no data yet" looks like for
   this specific metric (all-zero? empty array? `< 2` points for a trend?)
   and render honest copy, not a degraded/invisible chart.
4. **Wrap it in `<ChartCard title subtitle? total?>`** so header typography
   and spacing match every other tile. Use `className="md:col-span-2"` (or
   `lg:col-span-3`) only if the chart genuinely needs the width — most tiles
   are 1-col in the `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4` grid.
5. **Need more than one series to stay distinguishable without color?** Build
   a `ChartConfig` that assigns each series a color from a fixed order (see
   `CoinDistributionChart`'s `COLOR_ORDER`) rather than reusing whatever
   order the data happens to arrive in — a series should keep its color
   across reloads even if the data order shifts.
6. **Run `npx tsc --noEmit` in `apps/web` before calling it done.** The
   Dashboard has a zero-tolerance baseline here — unlike some older feature
   pages in this repo that still carry pre-existing unused-import/type
   errors, don't let a new chart introduce fresh ones.

---

## 5. Local-only data, clearly labeled

Two pieces of the Dashboard read from `localStorage` (Zustand
`persist`/`createJSONStorage`), not the server — and both say so in their UI
copy, so they never read as more authoritative than they are. Neither
component that surfaces them is *purely* local, though — both pair the local
data with the real on-chain equivalent, side by side, rather than only
showing one source and letting it imply it's the whole picture:

- **`useBalanceHistoryStore`** — daily balance snapshots recorded
  client-side on every mount. Used only to backfill dates *older* than what
  the on-chain gRPC reconstruction can reach (public nodes prune old
  transaction history).
- **`useMoveDevStore`'s `history`** — local Move Studio build/test/publish/
  upgrade log.
  - In `ActivityHeatmap`, merged with real on-chain tx timestamps into one
    combined per-day count, tooltipped as `"N local · M on-chain"` so the
    two sources are never presented as indistinguishable.
  - In `RecentActivity`, kept as its own labeled section ("Local to this
    browser") **above** a second section, "On-chain activity," which lists
    the active wallet's real recent transactions (`recentOnChainActivity`
    from §2). An empty on-chain section is often genuinely correct (short
    retention window on public nodes), not a bug — the copy says so
    explicitly rather than looking broken.
