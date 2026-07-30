# Design: `sui-cli-web` MCP server for AI-agent env/wallet management

Goal: let an AI agent (Claude Desktop, Claude Code, or any MCP client) manage
Sui **environments** (RPC networks) and **wallets/addresses** on a person's
machine through the same trusted local bridge `sui-cli-web-server` already
provides — without the agent ever needing shell access to `sui` directly, and
without private keys ever landing in the model's context window.

Background this builds on: [BACKEND_ARCHITECTURE.md](./BACKEND_ARCHITECTURE.md).

> **Status (2026-07-23): partially built.** The read-only slice of §3 ships as
> `packages/mcp` (`@sui-cli-web/mcp`). Everything involving writes, gas spend
> or key material — §4's confirmation flow and the last three steps of §7 — is
> still design only. Sections below say which is which; where the shipped code
> diverged from this document, the code is described and the reason given.

## 1. Why not just give the agent shell access to `sui`?

Because that's the thing we're trying to avoid:

- No input validation, no rate limiting, no confirmation gates — whatever
  `EnvironmentService`/`KeyManagementService`/`utils/validation.ts` already
  enforce would need to be re-implemented per-agent, or skipped.
- Private keys/mnemonics would flow through raw stdout into the agent's
  context, get logged in transcripts, and potentially get sent to a model
  provider. The whole point of `sui-cli-web` is that keys never leave the
  machine.
- No consistent audit trail of what the agent actually did.

An MCP server is just a translation layer in front of the *existing* Fastify
API — same trust boundary (localhost, user's own keystore), better fit for
how agents call tools (structured schemas, explicit confirmations) than raw
shell.

## 2. Where it lives — **built**

A separate workspace package, not a new mode of the existing server. What
exists today:

```
packages/
  mcp/                        # @sui-cli-web/mcp
    src/
      server.ts               # MCP server entrypoint (stdio transport)
      client.ts               # HTTP client: discovery + ApiResponse unwrapping
      tools/
        environments.ts       # environment_* tools
        wallets.ts            # wallet_* tools
    package.json
    README.md
```

`tools/transactions.ts` and `confirmation.ts` are in the plan below but not
written — nothing that mutates state ships yet, so there is nothing for the
confirmation gate to guard.

Rationale for a **separate process** talking HTTP to the existing server,
rather than embedding MCP handlers inside `sui-cli-web-server` itself:

- `sui-cli-web-server` is optimized to be started by `npx` and long-running
  for the browser UI. MCP clients (Claude Desktop, Claude Code) launch tool
  servers over **stdio**, as a subprocess they own the lifecycle of — a very
  different process model.
- Keeps the attack surface additive and opt-in: someone who only wants the
  web UI never runs the MCP process at all.
- The MCP package becomes a *client* of `/api/*`, so it automatically
  inherits every validation/rate-limit rule already in the Fastify layer —
  no logic duplicated, no drift.

Startup requirement: the MCP server verifies the local server on launch and
fails fast with a clear message if it is not reachable. It never falls back to
shelling out to `sui` itself — that would recreate §1's problem inside the MCP
package.

Two details the implementation settled differently from the sketch above:

- **It probes `/health`, not `/api/health`.** Only `/health` reports
  `service: "sui-cli-web-server"`; `/api/health` returns a bare
  `{ status, timestamp, port }`, so anything on the port answering
  `{"status":"ok"}` would pass. Attaching an agent that holds wallet tools to
  an unrelated process is not a failure worth risking to save a field.
- **The port is discovered, not assumed.** The client scans
  `COMMON_SERVER_PORTS` from `@sui-cli-web/shared` — the same list the web UI
  uses — and caches the first match for the process lifetime.
  `SUI_CLI_WEB_PORT` or `SUI_CLI_WEB_SERVER_URL` skip discovery entirely. The
  earlier hardcoded `127.0.0.1:3001` meant a server on any other port failed
  with "is it running?" while running perfectly.

## 3. Tool surface — read-only tools built, the rest designed

Group tools by domain, mirroring the route groups. Keep names verbose and
unambiguous — agents pick tools by name+description, not by reading route
code.

### `environment.*` (maps to `routes/environment.ts`)

| Tool | Maps to | Notes |
|---|---|---|
| `environment_list` | `GET /environments` | read-only |
| `environment_get_active` | `GET /environments/active` | read-only |
| `environment_get_chain_id` | `GET /environments/chain-id` | read-only, useful for agent to confirm mainnet vs testnet before acting |
| `environment_switch` | `POST /environments/switch` | **confirm** — switching networks changes where subsequent writes land |
| `environment_add` | `POST /environments` | validates RPC URL shape server-side already |
| `environment_remove` | `DELETE /environments/:alias` | **confirm** |

### `wallet.*` (maps to `routes/address.ts`, `key-management.ts`)

| Tool | Maps to | Notes |
|---|---|---|
| `wallet_list_addresses` | `GET /addresses` | read-only, includes balances |
| `wallet_get_active_address` | `GET /addresses/active` | read-only |
| `wallet_switch_active` | `POST /addresses/switch` | **confirm** |
| `wallet_create_address` | `POST /addresses/create` | returns `address`, and `phrase` **only** if the CLI emits one — see §4 for how the tool must handle that |
| `wallet_remove_address` | `POST /addresses/remove` | **confirm**, destructive-adjacent (removes from local keystore, not on-chain) |
| `wallet_get_balance` | `GET /addresses/:address/balance` | read-only |
| `wallet_list_objects` | `GET /addresses/:address/objects[/by-type]` | read-only |
| `wallet_list_gas_coins` | `GET /addresses/:address/gas` | read-only |

Deliberately **not exposed** as agent tools, or exposed only behind an
explicit opt-in flag (`--enable-key-export`) that a human sets in the MCP
config, never something an agent can toggle itself:

- `wallet_export_private_key` → `POST /keys/export`
- `wallet_import_key` → `POST /keys/import`

These are the two operations where a mistake (agent hallucinates, prompt
injection from a malicious contract's error message, etc.) causes
irreversible loss of funds. See §4.

### `tx.*` (maps to `address.ts`, `pay.ts`, `keytool.ts`)

| Tool | Maps to | Notes |
|---|---|---|
| `tx_dry_run_call` | `POST /call/dry-run` | read-only-equivalent, safe for the agent to call freely to "see what would happen" |
| `tx_call` | `POST /call` | **confirm**, real gas spend |
| `tx_get` | `GET /tx/:digest` | read-only |
| `tx_pay_summary` / `tx_pay_total` | `GET /pay/summary`, `/pay/total` | read-only, good for "how much would this cost" before `tx_pay` |
| `tx_pay` | `POST /pay` | **confirm** |
| `tx_faucet_request` | `POST /faucet/request` | testnet/devnet only; safe to allow without confirmation since it's inbound funds, but still rate-limited server-side (5/min) |

Everything under `keytool` that produces or consumes raw signatures
(`sign`, `combine-signatures`, `execute-signed-tx`) should stay **out of the
v1 tool surface**. It's the raw cryptographic layer meant for the UI's
power-user flows, not something to hand an agent until the confirmation
model in §4 is proven out on the simpler wallet/env tools.

## 4. Safety model — human-in-the-loop for anything irreversible (design only)

MCP already gives you a structural hook for this: a tool can return a
response that means "needs confirmation" instead of executing, and the
*client* (Claude Desktop/Code) surfaces that to the human before calling the
tool again with a confirmation token. Design it explicitly rather than
relying on the model to "ask nicely":

```
1. Agent calls wallet_remove_address({ address: "0x..." })
2. Tool handler sees this is in SENSITIVE_TOOLS, no confirmationToken passed
   → returns { status: "confirmation_required",
               summary: "Remove address 0x1234...abcd (alias: deployer) from local keystore?",
               confirmationToken: "<random, single-use, 60s TTL>" }
3. MCP client shows this to the human (this is standard MCP elicitation /
   the client's own tool-call approval UI — Claude Code already prompts
   before running a tool with side effects).
4. Human approves → agent re-calls
   wallet_remove_address({ address: "0x...", confirmationToken: "..." })
5. Tool handler validates the token (unexpired, unused, matches the same
   args) → forwards to POST /addresses/remove.
```

`SENSITIVE_TOOLS` (require confirmation token, defined in `confirmation.ts`):
`environment_switch`, `environment_remove`, `wallet_switch_active`,
`wallet_remove_address`, `tx_call`, `tx_pay`, and — if ever enabled —
`wallet_export_private_key`, `wallet_import_key`.

`wallet_create_address` is a special case: it's not destructive, but its
response can contain a recovery phrase. The tool must:
- Never put the phrase in the tool's *return text* verbatim without a
  wrapper — return `{ address, phraseAvailable: true }` and require a
  second explicit tool call (`wallet_reveal_recovery_phrase`, itself in
  `SENSITIVE_TOOLS`) to actually surface it. This avoids a phrase sitting in
  chat history/transcripts by default.

For `wallet_export_private_key` specifically, add a second, independent gate
on top of the confirmation-token flow: require the human to have started the
MCP server with `--enable-key-export` (an explicit, out-of-band opt-in, not
something set via a tool call or env var an agent could set for itself).
Without that flag, the tool isn't registered at all — the agent can't even
see it exists.

## 5. Auth between the MCP process and the local server — design only

Today `sui-cli-web-server` has no request auth (§5 of the architecture doc) —
acceptable when the only caller is a browser tab a human is looking at. An
MCP server changes that assumption slightly (a *second*, non-human process
can now drive it), so:

- Keep the **local** server bound to `127.0.0.1`. Note this is no longer true
  of every instance: the same binary binds `0.0.0.0` whenever a `PORT`
  variable is present, which is how the hosted deployment runs. That instance
  has no keystore behind it, but the assumption "this server is only ever
  reachable from one machine" no longer holds unconditionally, and any
  auth decision has to account for both.
- **Not built:** a static per-launch marker (`X-Sui-Cli-Web-Client: mcp`)
  passed purely for **logging/audit**, not as real auth — so server logs could
  distinguish "browser UI did this" from "an agent did this" when someone is
  reviewing what happened. Worth adding before any write tool ships; with only
  read tools there is nothing yet to attribute.
- Do not add a shared-secret auth scheme unless multi-tenant/remote access
  is ever on the roadmap — for a single-user localhost bridge it's
  complexity without a threat it defends against.

## 6. Read tools vs write tools — rate limiting carries over for free

Because every MCP tool is a thin wrapper over `/api/*`, the existing
`read`/`write`/`keytool`/`faucet` rate limits in `utils/rateLimiter.ts`
already apply — an agent in a bad loop (e.g. retrying `tx_call` on a
transient error) gets throttled by the same limits a runaway browser tab
would hit. No new rate-limiting logic needed in the MCP package itself.

## 7. Suggested build order

1. ✅ **Done** — `environment.*` + `wallet.*` **read-only** tools (list/get);
   zero risk, immediately useful for "what's my setup" questions. Shipped as
   `packages/mcp`; see its README for the tool list and client configuration.
2. `tx_dry_run_call`, `tx_pay_summary`, `tx_pay_total` — still read-only in
   effect, lets an agent reason about a transaction before proposing it.
3. Confirmation-token plumbing (`confirmation.ts`) + wire it into
   `environment_switch`, `wallet_switch_active`.
4. Write tools with real gas spend: `tx_call`, `tx_pay`,
   `wallet_create_address`, `wallet_remove_address`,
   `environment_add`/`remove`.
5. `wallet_export_private_key` / `wallet_import_key`, gated behind the
   explicit CLI flag from §4 — ship last, and only if there's a concrete
   use case (e.g. agent-assisted wallet migration) that justifies it.
