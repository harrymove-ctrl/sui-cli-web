# Backend Architecture — sui-cli-web-server

Snapshot of how the server (`apps/server`) is put together today, so future
design docs (like the MCP proposal) can reference it instead of re-deriving it.

> Verified against the tree on 2026-07-23. If a path or route below does not
> exist, the doc is stale — trust the code.

**On the two npm names.** The package is `sui-cli-web-server`; the binary it
installs is called `sui-cli-web` (`apps/server/package.json`'s `bin` field).
That mismatch is easy to misread as "users type `npx sui-cli-web`" — but `npx`
resolves by *package* name, not bin name, and `sui-cli-web` is also a real
published package:

| npm package | latest | last published |
|---|---|---|
| `sui-cli-web-server` | 1.5.0 | 2025-12-18 |
| `sui-cli-web` | 1.0.2 | 2025-12-03 |

`apps/server/package.json` is `sui-cli-web-server@1.5.0`, so **`npx
sui-cli-web-server` is the correct command**. `npx sui-cli-web` fetches the
1.0.2 package instead, and does so silently: the update check compares against
its own `PACKAGE_NAME`, so a 1.0.2 install resolves `sui-cli-web@latest` to
1.0.2 and reports itself current. Anyone following that instruction runs
months-old code with no warning.

Consolidating onto the shorter name would mean publishing the current build to
`sui-cli-web` first — until that happens, documentation pointing there is
pointing at the wrong artifact.

## 1. Two deployments, two trust models

This is the single most important thing to understand before reading anything
else, because the same binary runs in two very different situations.

**Local companion (the designed model).** Distributed as an npm bin
(bin `sui-cli-web`), started via `npx sui-cli-web-server` or a global
install. It
binds `127.0.0.1` and runs next to the user's own `sui` CLI and keystore. The
hosted web UI talks to it over `http://localhost:<port>`. Nothing is exposed
beyond the machine.

**Hosted deployment (what is live now).** The same server also runs on Railway
at `sui-cli-web-production.up.railway.app`, where it serves the built UI as
static files and answers `/api/*` on the public internet.

The bind address is decided at startup (`apps/server/src/index.ts`):

```ts
const isCloud = !!(RAILWAY_STATIC_URL || RAILWAY_SERVICE_ID || PORT);
const HOST = process.env.HOST || (isCloud ? '0.0.0.0' : '127.0.0.1');
```

Note that a bare `PORT` variable is enough to flip this — any platform that
injects `PORT` gets `0.0.0.0`.

**There is no authentication on any endpoint.** Locally that is fine: the
trust boundary is the loopback interface, and anything that can reach
`127.0.0.1:<port>` is already running as the user. On the public deployment
that boundary is gone, and every route — including `sui keytool` primitives —
is reachable by anyone who knows the URL. The hosted instance has no user
keystore to act on, which is why this has not caused an incident, but the
property is a consequence of the deployment, not a designed safeguard. Any
work that gives the hosted instance access to real key material has to add
authentication first.

CORS is an allowlist, never a wildcard. It now holds exactly one hosted
origin — `https://sui-cli-web-production.up.railway.app` — plus regexes for
`localhost` and `127.0.0.1`, whatever the platform reports as this
deployment's own domain, and anything in `ALLOWED_ORIGINS`. The earlier hosts
(`cli.firstmovers.io`, `harriweb3.dev`, the Vercel previews) were removed on
purpose; a local server driven by one of those pages will now refuse it, and
`ALLOWED_ORIGINS` is the way to add one back without a code change.

The listed origin is load-bearing for the local model, not decoration: a
user's own `npx sui-cli-web-server` has no `RAILWAY_*` variables, so the
self-origin detection does not cover it, and the hosted UI's origin has to be
named explicitly or every local install rejects the UI it exists to serve.

CORS is a browser-side control only: it governs which *web pages* may read
responses and stops nothing that is not a browser — `curl` was never subject
to it. A rejected origin gets a response without CORS headers rather than an
error, so a refused origin is not reported as a server fault.

Every route group is wrapped in a rate-limit hook (`utils/rateLimiter.ts`),
tiered by sensitivity: `read` (1000/min), `write` (300/min), `keytool`
(200/min), `faucet` (5/min, since it hits an external API). The limits are
sized for a single local user, not for public traffic.

## 2. Layering

```
HTTP route (routes/*.ts)
   → validates input (utils/validation.ts)
   → calls a Service (services/*.ts)
        → Service shells out via SuiCliExecutor (cli/SuiCliExecutor.ts)
             → wraps `execFile` against the user's local `sui` binary
        → some services parse CLI YAML/JSON output (cli/ConfigParser.ts)
        → some read the RPC or GraphQL endpoint directly
   → route maps result/error to a uniform ApiResponse<T>
```

- **No database.** State of record is whatever `sui client`/`sui keytool`
  reports from `~/.sui/sui_config/*` — the server is a thin, stateless
  bridge over the CLI, not a system that owns wallet state itself.
- **Not every read goes through the CLI.** Some paths query the JSON-RPC
  endpoint directly because the CLI cannot express them — object Display
  metadata, for instance, only comes back from `sui_getObject` with
  `showDisplay`, and never appears in `sui client object` output. Those paths
  fall back to the CLI when there is no active RPC URL.
- **Private keys never enter the HTTP response by default.** Only the
  explicit "export" flow returns a raw key, gated by a confirmation code
  (`services/KeyManagementService.ts`, `routes/key-management.ts`).
- `ApiResponse<T>` (from `@sui-cli-web/shared`) is the uniform envelope:
  `{ success: true, data: T } | { success: false, error: string }`.
- `SuiCliExecutor` is a singleton; it resolves the `sui` binary across
  platforms (`utils/platform.ts`) and strips ANSI codes from CLI output.

## 3. Service inventory

| Service | Responsibility |
|---|---|
| `AddressService` | List/create/remove addresses, balances, objects, gas coins, Move calls (`call`, `dry-run`) |
| `EnvironmentService` | List/add/remove/switch RPC environments (`sui client envs`), chain-id lookup |
| `KeyManagementService` | Export private key (confirmation-gated), import from mnemonic/private key, duplicate check |
| `KeytoolService` | Low-level `sui keytool`: list keys, generate keypairs, sign, multisig address, decode tx, combine signatures, build/execute a signed transfer tx |
| `FaucetService` | Request testnet/devnet SUI from the faucet |
| `TransferService` | SUI/object transfers |
| `CoinService` | Generic coin split/merge for arbitrary coin types |
| `ParameterHelperService` | Resolves and validates Move call arguments |
| `GraphQLService` | Sui GraphQL RPC client |
| `WalrusMemoryService` | Walrus decentralized storage integration — blob decoding, memwal accounts, Seal-based decryption, delegate-key management. Shipped and live in the Object Inspector's Walrus Memory tab, not in-progress. |
| `dev/*Service` (Move, Package, Inspector, Replay, GasAnalysis, Event, Migration, Pay, Security, PtbBuilder, DevTools) | Move package publish/upgrade, transaction inspection & replay, gas analysis, event querying, Move-2024 migration, multi-recipient pay, bytecode/source verification, visual PTB builder |
| `core/*` (ProcessManager, WatchService, OutputService, AnalyticsService) | Local network process lifecycle (`sui start`), file watching, large-output caching to disk, opt-in usage analytics |

Supporting utilities worth knowing about: `utils/suiGrpcClient.ts` (Sui gRPC
client), `utils/localKeystore.ts` (local keystore helpers),
`utils/rawObjectDecode.ts` (raw on-chain object decoding),
`utils/knownTokens.ts` (static coin metadata for coins whose on-chain
`CoinMetadata` is missing or has an empty icon), `utils/sse.ts` (server-sent
event helpers), `utils/errorHandler.ts`.

## 4. Endpoint catalog (by domain, all under `/api`)

**Addresses & objects** (`routes/address.ts`)
`GET /addresses`, `GET /addresses/active`, `POST /addresses/switch`,
`POST /addresses/create`, `POST /addresses/remove`,
`GET /addresses/:address/balance`, `GET /addresses/:address/objects`,
`GET /addresses/:address/objects/by-type`, `GET /addresses/:address/gas`,
`GET /addresses/:address/history`, `GET /addresses/:address/summary`,
`POST /gas/split`, `POST /gas/merge`, `GET /objects/:objectId`,
`GET /objects/:objectId/version-history` (bounded backward walk through an
object's version chain, GraphQL-indexer-only — see [OBJECTS_INSPECT.md](./OBJECTS_INSPECT.md)),
`POST /objects/blobs/summary`, `POST /objects/nft-metadata`,
`GET /tx/:digest`, `GET /packages/:packageId/summary`,
`POST /call`, `POST /call/dry-run`

**Environments** (`routes/environment.ts`)
`GET /environments`, `GET /environments/active`, `GET /environments/chain-id`,
`POST /environments/switch`, `POST /environments` (add),
`DELETE /environments/:alias`

**Keys — high sensitivity** (`routes/key-management.ts`)
`GET /keys/export-warning`, `POST /keys/export` (confirmation-code gated),
`POST /keys/import` (mnemonic or raw private key), `POST /keys/check-duplicate`

**Keytool — cryptographic primitives** (`routes/keytool.ts`, prefix `/api/keytool`)
`/list`, `/generate`, `/sign`, `/multisig-address`, `/decode-tx`,
`/combine-signatures`, `/generate-sample-tx`, `/build-transfer-tx`,
`/execute-signed-tx`

**Faucet** (`routes/faucet.ts`) — `POST /faucet/request` (5 req/min)

**Transfers / payments**
`routes/transfer.ts`: `POST /transfers/sui`, `POST /transfers/sui/dry-run`,
`GET /transfers/sui/coins/:address`, `POST /transfers/object`,
`POST /transfers/object/dry-run`, `GET /transfers/objects/:address`,
`POST /transfers/verify-ownership`.
`routes/pay.ts`: `/pay`, `/pay/sui`, `/pay/all-sui`, `/pay/summary`, `/pay/total`

**Move development** — `routes/move.ts`, `routes/package.ts`,
`routes/migration.ts` (`/move/migrate*`), `routes/devtools.ts`

**Inspection & debugging** — `routes/inspector.ts`, `routes/replay.ts`
(`/inspector/replay/*`), `routes/gas.ts` (`/inspector/gas/*`),
`routes/events.ts` (`/inspector/events/*`), `routes/ptb-builder.ts`
(`/inspector/ptb-builder/*`), `routes/security.ts`

**Local network** (`routes/local-network.ts`) — start/stop/status a local
`sui start` node, `/network/stream/:processId` (SSE, unrated)

**Misc** — `routes/coin.ts` (generic split/merge), `routes/outputs.ts`
(large-output cache), `routes/filesystem.ts` (directory browse for
project paths), `routes/dynamic-fields.ts`, `routes/derivedObjects.ts`
(derived object ID calculation, no CLI shell-out — pure `@mysten/sui`
computation), `routes/walrusMemory.ts` (Walrus decentralized storage)

**Health & status** — three distinct endpoints, easy to conflate:
- `GET /health` (not under `/api`) — Railway/cloud platform healthcheck,
  returns `{ status, version, service, timestamp }`.
- `GET /api/health` (no rate limit) — the one local tooling should poll;
  returns `{ status, timestamp, port }`. Note it does **not** include a
  `service` field — `packages/mcp`'s port-discovery client deliberately polls
  `/health` instead of `/api/health` for exactly this reason, since it needs
  the `service: "sui-cli-web-server"` field to avoid attaching to an
  unrelated process that happens to hold one of the scanned ports.
- `GET /api/status` (read rate limit) — reports whether the `sui` CLI itself
  is installed and its version, not server liveness.

Anything that is not `/api/*`/`/health` and does not match a static file
falls through to the SPA's `index.html`, with the marketing aliases
redirected first (`/changelog` → `/blog/changelog/`).

## 5. Notable properties an MCP design must respect

1. **No per-request auth, anywhere.** Locally the trust boundary is loopback;
   on the hosted deployment there is no boundary at all. Either way, nothing
   in the server distinguishes one caller from another. "Any MCP client on the
   machine can silently drive it" is the default, not an edge case.
2. **Key export/import is already gated**, but gated by a UI-driven
   confirmation code, not a machine-checkable permission. An agent-facing
   surface needs its own explicit confirmation step (see MCP doc, §4).
3. **Most of it is a CLI shell-out.** Latency, error strings, and available
   networks are bounded by whatever `sui` CLI is installed locally — an MCP
   layer inherits that constraint (e.g. no network available if
   `sui client envs` has none configured). The RPC/GraphQL paths are the
   exception and fail differently, so error handling cannot assume one shape.
4. **`ApiResponse<T>` is already a clean contract to wrap as MCP tool
   outputs** — no reshaping needed, just pass `data` through and surface
   `error` as a tool error.
