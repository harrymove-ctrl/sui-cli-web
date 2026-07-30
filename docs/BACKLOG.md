# Product backlog — sui-cli-web (pre-Walrus-CLI-integration)

> "pre-Walrus" here means *before Walrus is wired up as a CLI toolchain*
> (§3.2/[SUIUP_RESEARCH_AND_ROADMAP.md](./architecture/SUIUP_RESEARCH_AND_ROADMAP.md)),
> not "before any Walrus feature." Walrus decentralized storage (blob
> decoding, memwal accounts, Seal decryption) already shipped in the Object
> Inspector's Walrus Memory tab — see `WalrusMemoryService` in
> [BACKEND_ARCHITECTURE.md](./architecture/BACKEND_ARCHITECTURE.md). It uses
> HTTP aggregators + gRPC directly, not the `walrus` CLI binary, so it
> doesn't overlap with this backlog's still-unbuilt §3.2/toolchain-manager
> work.

> **Status (2026-07-23):** the §0 community/tier ripout and
> Dashboard/Sidebar/QuickSwitcher overhaul this backlog was written around
> have since shipped, along with the MCP read-only tool slice (§4.1, now
> done — see [MCP_SERVER_DESIGN.md](./architecture/MCP_SERVER_DESIGN.md))
> and a Railway/monorepo restructure not covered by this doc at all. Treat
> every item below as a snapshot to re-verify against the current code
> before picking it up, not a live queue — some may already be done, stale,
> or superseded.

**Scope, in priority order:**

0. Codebase cleanup + performance
1. Landing page UI/UX
2. Local-server connect / onboarding experience ("app manager")
3. General feature backlog
4. MCP-for-agents proposal — §4.1 done, §4.2 onward still open

Walrus CLI integration
([SUIUP_RESEARCH_AND_ROADMAP.md](./architecture/SUIUP_RESEARCH_AND_ROADMAP.md))
is intentionally *after* this list — no point wiring up a new toolchain
before the core "get a human from zero to connected" flow is solid.

Each item below has a rough size — `S`mall / `M`edium / `L`arge — and
references the exact file(s) involved so there's no re-discovery needed
when picking one up.

---

## 0. Codebase cleanup + performance — *current priority*

The client had accumulated a large uncommitted working-tree diff (91 files)
before this section was written: ripping out an on-chain community/tier
membership system (`CommunityService`, `TierService`, `routes/community.ts`,
`membershipCheck` middleware, `MembershipJoin/Lookup/Profile`, `TierBadge`,
`MembershipGuard`, old `CommandPalette`, old `LandingPage`) and replacing
the app shell with `Dashboard` / `Sidebar` / `QuickSwitcher`, alongside new
Walrus/gRPC/GraphQL/local-keystore service additions.

#### 0.1 Finish + commit the ripout/overhaul — `L`

In progress. Dead code already swept: unused `config/contracts.ts`,
orphaned `components/ui/profile-card.tsx`, stale `isCommunityMember` /
`tierLevel` / `tierName` / `tierIcon` fields in `@sui-cli-web/shared`, dead
`membership` sidebar icon entry, dead "Join → /app/membership" button, dead
`403 MEMBERSHIP_REQUIRED` branches in `TransactionBuilder`, unused
community/membership analytics event constants. `contracts/community_registry`
removed from the repo (still deployed on testnet independently of this repo
copy).

#### 0.2 Broader dead-code / consistency audit — `M`

Beyond the ripout diff: `tsc --noEmit` currently surfaces ~50 pre-existing
client errors and ~5 server errors (mostly unused imports/vars, a few real
type mismatches, e.g. `ObjectList/ObjectDetail.tsx` owner-type narrowing).
Also flagged: `components/HomePage/wireframe/*` (16 files — pricing, faq,
testimonials, community, etc.) is a fully unused prototype set, not
imported anywhere. Needs a decision: finish wiring it in, or remove it.

#### 0.3 Client performance investigation — `M`

Re-renders, bundle size, virtualization behavior on large tables/lists,
load time. Investigate/profile first — report findings before changing
code.

#### 0.4 Server performance investigation — `M`

Fastify response times, `sui` CLI shell-out latency, caching opportunities
(`OutputService` already caches large outputs — check what else should
be).

#### 0.5 Build/dev-loop performance investigation — `S`

Build times, dev server startup, monorepo pipeline (plain npm workspaces,
no turbo/nx — evaluate whether that's actually a bottleneck before adding
one).

#### 0.6 Dashboard UX polish pass — `M`

Derived from a design review of the current `/app` Dashboard (see
[DASHBOARD_ARCHITECTURE.md](./architecture/DASHBOARD_ARCHITECTURE.md) for
how the feature is put together). The fetch-consolidation and empty-state
work already landed (§2–3 of that doc); these are the remaining UX gaps
found on top of it, each independently shippable.

- **0.6.1 Activity heatmap's empty state is functionally invisible — `S`.**
  `ActivityHeatmap.tsx` renders empty cells at `--chart-segment-background`
  (~6% opacity) — on a white card this reads as a blank/broken card, not
  "no activity yet," even though the 12-week grid and explanatory copy are
  both actually in the DOM. Give empty cells a visible `--chart-grid`
  border so the grid *shape* communicates structure even at zero data.
- **0.6.2 Wallet rows don't navigate per-wallet — `S`.** `WalletsList.tsx`
  and `WalletBarChart.tsx` were since merged into
  `WalletsTable.tsx` — the gap persists there: `handleSelect` (line ~103)
  calls `switchAddress(addr.address)` then unconditionally
  `navigate('/app/addresses')` regardless of which wallet was clicked —
  still no way to jump to a specific wallet's own detail view from the
  Dashboard, only to flip which one is active.
- **0.6.3 Small values are illegible in the proportional bar charts — `S`.**
  Still present in `WalletsTable.tsx`'s `MetricCell` (Balance/Objects/
  Packages columns): bar width is `(value / max) * 100`, floored at a
  `MIN_VISIBLE_FRACTION` of 4% (line ~30) so it's never literally zero
  width, but a value at ~1% of the set's max still renders as a barely
  visible 4%-wide sliver next to a full-width bar for the max. The number
  already carries the meaning; consider a log scale, or raising the floor
  further, so small-but-nonzero values read as clearly nonzero.
- **0.6.4 No section grouping in the Dashboard grid — `M`.** Stat tiles,
  cross-wallet bar charts, the active-wallet radar/history/coin-distribution
  charts, and local-only activity data all sit in one flat `grid-cols-4` in
  `Dashboard/index.tsx` with no visual separation. A first-time viewer can't
  tell at a glance which numbers are portfolio-wide vs. active-wallet-only
  vs. local-to-this-browser. Split into labeled sections instead of one
  undifferentiated grid.
- **0.6.5 No refresh affordance or staleness indicator — `S`.** No "updated
  Xs ago" text or manual refresh button, despite the §3 fetch-consolidation
  work (`WalletSummary`, one request per wallet) making a full reload cheap
  now — worth surfacing that it's cheap.
- **0.6.6 Per-wallet fetch failures are silent — `S`.** In
  `Dashboard/index.tsx`, a failed `getWalletSummary` call for one wallet is
  caught and replaced with all-zeros — indistinguishable from "this wallet
  genuinely has nothing." Needs a visible "couldn't load" state per wallet
  instead of a fabricated zero.
- **0.6.7 No per-number network/environment context — `S`.** Nothing on
  the Dashboard clarifies that every balance/object/package number is
  scoped to the currently-active RPC environment — could matter if a user's
  wallets are actually split across networks.
- **0.6.8 Table layout doesn't adapt at narrow/mobile widths — `M`.**
  In `WalletsTable.tsx`, the alias `<span>` has `truncate` with a `title`
  fallback, but its containing `<td>`/`<button>` are `min-w-0` with no
  explicit max-width — long aliases (`condescending-chrysoprase`) rely on
  the table's own layout to constrain column width rather than a fixed cap,
  so truncation isn't guaranteed at narrow/mobile widths. Consider an
  explicit max-width on the name column, or a stacked-row layout (name
  above the metric cells, full width) as the narrow/mobile variant.

---

## 1. Landing page UI/UX

Current state: `components/HomePage/index.tsx` is the current entry point
(the old `LandingPage/NewLandingPage.tsx` was removed in the §0 ripout).
`components/HomePage/wireframe/*` (header, dither-shader hero, logo-marquee,
pricing, testimonials, faq, footer) is a complete, unused alternate
landing-page prototype sitting alongside it — not wired in (see 0.2).

#### 1.1 Finish wireframe → production pass on `HomePage/wireframe/*` — `M`

These were mechanically ported from a Next.js template via `refactor.py`
(now removed) — verify every component (`dither-shader`, `smooth-scroll`,
`reveal`, `section-corners`) actually renders correctly under Vite/
react-router instead of Next, not just compiles.

#### 1.2 Replace generic template copy with real product narrative — `M`

Landing page should lead with "local-first, keys never leave your machine"
— that's the actual differentiator vs. any hosted Sui explorer/wallet UI,
and it's currently buried in `README.md` (§ security), not on the page a
new visitor sees first.

#### 1.3 Add a live "what this looks like once connected" preview — `M`

Screenshot/GIF/embedded read-only demo of `AddressList`/`EnvironmentList`
in the hero, so the value prop is visible before a visitor installs
anything.

#### 1.4 Dark/light theme audit across landing components — `S`

`ThemeToggle.astro`/`ThemeSwitch` exist on the blog side; confirm the
client's landing page wireframe components (ported from a dark-only Next
template) actually respect the app's theme system rather than being
hardcoded dark.

#### 1.5 Mobile pass on landing page — `S`

`useMobileDetect` is already used to branch behavior in `AppGuard`/
`SetupPage` for the "can't run a local server on your phone" case — the
landing page itself (marketing content, not the app) should still look
intentional on mobile, independent of that guard logic.

---

## 2. Local-server connect / onboarding ("app manager") experience

This is the highest-leverage item in the backlog — it's the first real
interaction every user has, and today it's a copy-paste-a-terminal-command
flow dressed up with animation, not an actual install/launch experience.

**Current state** (traced through the code, not assumed):

- `api/core/connection.ts` — parallel port-scan across `[3001, 3002, 3003,
  3004, 3005, 4001, 4002, 8001, 8080]`, hitting `/api/health` on each,
  remembering the winning port in `localStorage`.
- `components/guards/AppGuard.tsx` — blocks `/app` behind a connection
  check; shows a spinner, then either renders the app or redirects to
  `/setup`.
- `components/SetupPage/index.tsx` — polls `checkConnection()` every 5s
  in a `useEffect`, shows a toast on success, has a manual "Retry" button.
- `components/SetupInstructions/index.tsx` — the actual "install" UX: a
  **static 2.5s fake intro animation**, a **fake terminal-typing effect**
  (`'Waiting for local server connection...'` typed character-by-character
  on a fixed timer, unrelated to real connection state), OS-tabbed
  copy-to-clipboard blocks for `npx sui-cli-web`, and that's it — no actual
  feedback once the user has copied the command and gone to their terminal,
  beyond the 5s poll eventually succeeding.

**What's missing**, concretely:

- No signal to the user *between* "copied the command" and "server
  connected" — if `npm install` is slow, or `sui` isn't on `PATH` and the
  server fails to start, the UI just keeps showing the same static
  instructions and silently retries forever. `getLastConnectionError()`
  already exists and is displayed as raw text in `SetupPage` — but there's
  no attempt to *interpret* it (e.g. "connection refused" vs. "timed out"
  vs. "wrong CORS origin") into an actionable next step.
- No detection of *why* the server isn't there: is `node`/`npx` missing
  entirely? Is `sui` not installed (so the server started but
  `/api/status` would report `suiInstalled: false`)? Today's flow can't
  tell the difference between "you haven't run the command yet" and "you
  ran it and it's broken."
- No persistent "app manager" — every browser refresh re-runs the whole
  port-scan from scratch (mitigated only by the `localStorage` saved port).
  There's no lightweight background helper that could, e.g., keep the
  server alive, auto-restart it, or launch it on login.

#### 2.1 Replace the fake typing/intro animation with real state machine — `S`

States: `idle → checking → (not-installed | starting | connected | error)`.
Drive the UI purely off `checkConnection()` results plus a coarser
diagnosis (see 2.2), not off timers. Removes the disconnect between "shows
a spinner" and "actually polling."

#### 2.2 Diagnose *why* connection failed, not just *that* it failed — `M`

Layer on top of `getLastConnectionError()`: distinguish `ECONNREFUSED`-style
errors (nothing listening — show "run the command") from a CORS rejection
(server running, wrong origin — points at a real misconfig) from a
slow/hanging fetch (still starting — keep waiting). The server already
logs `[CORS] Rejected origin` (`apps/server/src/index.ts`) — worth also
having `/api/health` reachable at all *before* CORS is even evaluated
(preflight-exempt), to distinguish "not running" from "running but
blocked."

#### 2.3 Post-connect, surface `sui` CLI install status inline — `S`

`/api/status` already returns `{ suiInstalled, suiVersion }` (`routes` root
in `index.ts`) — once the server connects, immediately call it and show
"Sui CLI: v1.40.1 ✓" or "Sui CLI not found — install it" instead of
silently assuming it's fine until the user hits a broken feature later.

#### 2.4 One-click copy → auto-detect-paste-ran affordance — `M`

Can't literally detect a paste into an external terminal, but can shorten
the feedback loop: as soon as `copyToClipboard` fires, start a *faster*
poll interval (e.g. 1s for the first 30s) instead of the flat 5s in
`SetupPage`, so success is reflected quickly right after the likely moment
the user ran the command.

#### 2.5 Background "app manager" helper — `L` *(needs a product decision)*

The real fix for "no persistent manager" is a small native helper
(menu-bar app on macOS, tray app on Windows/Linux, or a lightweight
background daemon installed once) that supervises the `sui-cli-web-server`
process — auto-start on login, auto-restart on crash, one place to see
"server: running / stopped" without a browser tab open. This is a
meaningfully bigger scope decision (new distributable, not just a web
change) — worth a dedicated design pass before committing, not something
to size precisely here.

#### 2.6 Better "no Node.js" fallback messaging — `S`

Detecting Node/npx availability client-side isn't possible, but
*documentation* can branch better: `SetupInstructions` already branches by
OS (`mac`/`linux`/`windows`) — extend with a pre-flight note for "no
Node.js yet" (link to install Node) so the copy-paste command isn't
presented as if Node is a given.

---

## 3. General feature backlog

Broader features, roughly ordered by how directly they extend what's
already built vs. net-new surface area.

#### 3.1 Toolchain manager UI (suiup-aware) — `L`

See [SUIUP_RESEARCH_AND_ROADMAP.md](./architecture/SUIUP_RESEARCH_AND_ROADMAP.md)
§4 Mode B — new `ToolchainService` + `routes/toolchain.ts`, new "Toolchain"
nav section parallel to the existing `EnvironmentList`.

#### 3.2 Walrus CLI surface (store/read/blob lifecycle) — `L`

Explicitly deferred until after this backlog per your instruction — needs
its own research pass over `walrus --help`/docs.wal.app before route
design.

#### 3.3 Multi-sig flows in the UI — `M`

`KeytoolService`/`routes/keytool.ts` already has `/multisig-address` and
`/combine-signatures` at the API layer — no dedicated UI component
surfaces a guided multi-sig setup/sign flow yet (`components/KeytoolManager`
exists but check current coverage before assuming it's a gap vs. already
built).

#### 3.4 Transaction history / activity feed per address — `M`

`AddressService`/`routes/address.ts` can fetch a tx by digest (`GET
/tx/:digest`) but there's no "list recent transactions for this address"
endpoint or UI — would need either indexer/RPC support beyond the CLI's
own capabilities, or scraping via `sui client objects`/events as a
stopgap.

#### 3.5 Move package deploy history / re-deploy diffing — `M`

`services/dev/PackageService.ts` + `routes/package.ts` handle
publish/upgrade; a "here's every version you've published from this
project, with digests" view would build directly on `OutputService`'s
existing large-output cache (`services/core/OutputService.ts`).

#### 3.6 Quick switcher coverage audit — `S`

`components/QuickSwitcher` (replaced the old `CommandPalette` in the §0
ripout) reads from `lib/routes.ts`'s `VIEW_TO_ROUTE` map, whose keys today
are just `addresses, environments, objects, dynamic-fields, gas, faucet,
transfer, move, inspector, devtools, derived-objects, security, keytool`.
Cross-checked against `App.tsx`'s real routes: it's missing entries for
`coins`, `coins/split`, `coins/merge`, `coins/transfer`, `gas-analysis`,
`events`, `network`, `migrate`, and `payments` — all real, reachable routes
with no quick-switcher entry. (`ptb-builder`/`replay` aren't real routes at
all — drop them from scope.)

---

## 4. MCP proposal — agents talk directly to `sui-cli-web` — *§4.1 shipped, rest open*

This reframes [MCP_SERVER_DESIGN.md](./architecture/MCP_SERVER_DESIGN.md)
around the specific pitch: **a dev or user should be able to point an AI
agent (Claude Code, Claude Desktop, or any MCP client) at their own
`sui-cli-web` server and have the agent manage addresses, packages, and
environments/wallets on their behalf** — without the agent shelling out to
`sui` directly and without keys entering the model's context.

That design doc already covers the mechanics in depth (tool list,
confirmation-token gating, why a separate stdio process, build order). What
this backlog entry adds is **positioning and sequencing relative to items
1–3 above**.

#### 4.1 Ship `environment.*` + `wallet.*` read-only MCP tools first — `M` — ✅ **done**

Shipped as `packages/mcp` (`@sui-cli-web/mcp`) — matches
[MCP_SERVER_DESIGN.md](./architecture/MCP_SERVER_DESIGN.md) §7 step 1.
Delivers the headline pitch ("ask your agent what environments/addresses
you have") with zero write-path risk. See the package's own README for the
tool list and MCP client configuration.

#### 4.2 Package/contract-control tools — `M`

`package_get_summary`, `package_publish` (confirm-gated),
`package_call_function` / `package_dry_run_call`. New tool group not yet
enumerated in MCP_SERVER_DESIGN.md — maps to `GET
/packages/:packageId/summary`, `POST /call`, `POST /call/dry-run`
(`routes/address.ts`) and `routes/package.ts` publish/upgrade. Add this as
a `package.*` group alongside `environment.*`/`wallet.*`/`tx.*`.

#### 4.3 "Connect your agent" onboarding surface in the web UI — `M`

Once 4.1 exists, the web UI itself should tell users it exists: a
settings/docs panel with the MCP config JSON to paste into Claude
Desktop/Code, generated with the user's actual local port already filled
in (reuses `getServerPort()` from `api/core/connection.ts`) instead of
generic docs they have to hand-edit.

#### 4.4 Confirmation-token UI round-trip — `L`

[MCP_SERVER_DESIGN.md](./architecture/MCP_SERVER_DESIGN.md) §4's
`confirmation_required` flow assumes the MCP *client* (Claude Desktop/Code)
is the human-approval surface — confirm that's sufficient before building
anything extra; only add a companion in-browser "pending agent actions"
view if testing shows the client-side approval UX isn't visible/
trustworthy enough for high-stakes ops like `tx_call`.

#### 4.5 Usage analytics for agent-originated calls — `S`

`AnalyticsService` (`services/core/AnalyticsService.ts`) already exists for
the web UI — extend the `X-Sui-Cli-Web-Client: mcp` header from
MCP_SERVER_DESIGN.md §5 into a real (opt-in, local-only) breakdown of
"actions taken by agents vs. by you in the browser," useful both for user
trust and for prioritizing which tools get built next.

---

**Suggested overall sequencing:** land 2.1–2.3 (onboarding state machine +
real diagnosis) since every other surface — web UI *and* MCP setup —
benefits from `sui-cli-web` being able to say *why* it isn't connected;
then 4.1 (read-only MCP tools, fastest path to the agent pitch); then
either continue down the MCP write-path (4.2 onward) or pick up
landing-page polish (§1) in parallel, since they don't block each other.
