# @sui-cli-web/mcp

# Design: `sui-cli-web` MCP server for AI-agent env/wallet management

An MCP (Model Context Protocol) server that lets an AI agent — Claude Desktop,
Claude Code, or any other MCP client — manage Sui **environments** (RPC
networks) and **wallets/addresses** on a person's machine through the same
trusted local bridge `sui-cli-web-server` already provides for the browser
UI — without the agent ever needing shell access to `sui` directly, and
without private keys or recovery phrases ever landing in the model's context
window.

This package is the read-only MVP slice of that idea. Full background and the
complete design (including the write-tool/confirmation-flow phases not built
yet) lives in [`docs/architecture/MCP_SERVER_DESIGN.md`](../../docs/architecture/MCP_SERVER_DESIGN.md).

## The problem

An AI agent that's useful for Sui development eventually wants to answer or
act on questions like "what wallets do I have," "what's my balance," "switch
me to testnet," or "send this transaction." The obvious shortcut — just give
the agent shell access to the `sui` CLI — is exactly the thing to avoid:

- **No input validation, no rate limiting, no confirmation gates.** Whatever
  `sui-cli-web-server`'s `EnvironmentService`, `AddressService`, and
  `utils/validation.ts` already enforce would need to be re-implemented per
  agent, or silently skipped.
- **Private keys and mnemonics would flow through raw stdout** straight into
  the agent's context — logged in transcripts, potentially sent to a model
  provider. The entire point of `sui-cli-web` is that keys never leave the
  machine; shell access to `sui` throws that away.
- **No audit trail.** Nothing to look back on for "what did the agent
  actually do to my wallet."

## The idea

An MCP server is just a translation layer in front of the *existing* Fastify
API (`sui-cli-web-server`) — same trust boundary (localhost, the user's own
keystore), but shaped the way agents actually call tools: structured
schemas, explicit human confirmation for anything irreversible, instead of
raw shell commands and hoping the model "asks nicely" first.

It runs as its own process, talking plain HTTP to the already-running local
server, rather than being embedded inside it:

- `sui-cli-web-server` is built to be started once (`npx sui-cli-web-server`) and
  stay running for the browser UI. MCP clients launch tool servers over
  **stdio** as a subprocess they own the lifecycle of — a different process
  model entirely.
- It keeps the feature **additive and opt-in**: someone who only wants the
  web UI never runs the MCP process at all, and the attack surface doesn't
  grow for them.
- Because this package is just an HTTP *client* of `/api/*`, it automatically
  inherits every validation and rate-limit rule the Fastify layer already
  enforces — nothing is duplicated, and there's no way for the two to drift
  apart.

If the local server isn't reachable, this package fails fast with a clear
message. It never falls back to shelling out to `sui` itself — doing so
would quietly recreate the exact problem this whole design exists to avoid.

## What's built vs. what's designed but deferred

This package ships the **read-only** slice on purpose — the design doc's own
suggested build order starts here because it's zero-risk (nothing mutates
state or spends gas) and immediately useful ("what's my setup" questions),
before any human-confirmation machinery needs to exist:

| Phase | Status |
|---|---|
| `environment.*` + `wallet.*` **read-only** tools (list/get) | ✅ **this package** |
| `tx_dry_run_call`, `tx_pay_summary`, `tx_pay_total` (still read-only in effect) | 🔭 planned |
| Confirmation-token flow (`confirmation.ts`), wired into `environment_switch`, `wallet_switch_active` | 🔭 planned |
| Write tools with real gas spend: `tx_call`, `tx_pay`, `wallet_create_address`, `wallet_remove_address`, `environment_add`/`remove` | 🔭 planned |
| `wallet_export_private_key` / `wallet_import_key`, gated behind an explicit `--enable-key-export` flag a human sets out-of-band (never something an agent can toggle for itself) | 🔭 planned, ships last |

The safety model for the deferred phases, in short: a tool that would do
something irreversible returns `{ status: "confirmation_required", summary,
confirmationToken }` instead of executing; the human approves via the MCP
client's own tool-approval UI; the agent re-calls the tool with the token.
Key export gets a second, independent gate on top of that — the tool isn't
even registered unless the human launched the server with the opt-in flag.

## Tools (this version — all read-only)

| Tool | Wraps | Notes |
|---|---|---|
| `environment_list` | `GET /environments` | Every configured Sui RPC environment — alias, RPC URL, active flag |
| `environment_get_active` | `GET /environments/active` | The active environment's alias |
| `environment_get_chain_id` | `GET /environments/chain-id` | Chain id + known network name (mainnet/testnet/devnet/custom) — lets an agent confirm which network it's looking at before reasoning about anything else |
| `wallet_list_addresses` | `GET /addresses` | Every address in the local keystore, with alias, balance, object count |
| `wallet_get_active_address` | `GET /addresses/active` | The active address |
| `wallet_get_balance` | `GET /addresses/:address/balance` | SUI balance for a given address |
| `wallet_list_objects` | `GET /addresses/:address/objects` (or `/objects/by-type` if a `type` filter is given) | Objects an address owns |
| `wallet_list_gas_coins` | `GET /addresses/:address/gas` | Gas coin objects an address can spend from |

## Requirements

`sui-cli-web-server` must already be running (`npx sui-cli-web-server`, or
however you normally start it) — this package only talks HTTP to it.

It finds the server itself: on first use it probes `127.0.0.1` on ports
3001–3005, 4001, 4002, 8001 and 8080 in that order — the same list the web UI
scans — and takes the first one whose `/health` identifies itself as
`sui-cli-web-server`. Checking that field, rather than settling for any
`{"status":"ok"}`, is what stops it from attaching to an unrelated app that
happens to hold one of those ports.

The result is cached for the life of the process, so the scan runs once.

To pin it instead, set either of these and discovery is skipped entirely:

| Variable | Example | Use when |
|---|---|---|
| `SUI_CLI_WEB_PORT` | `4002` | the server is on your machine, on a known port |
| `SUI_CLI_WEB_SERVER_URL` | `http://127.0.0.1:4002` | it is on another host, or behind a path |

Pinning is worth doing when more than one server is running: discovery takes
the first match in list order, which may not be the one you meant.

## Configuring in an MCP client

Build it first:

```sh
npm run build -w @sui-cli-web/mcp
```

Then point your MCP client at the built entrypoint. For Claude
Desktop/Claude Code's `mcpServers` config:

```json
{
  "mcpServers": {
    "sui-cli-web": {
      "command": "node",
      "args": ["/absolute/path/to/raycast-sui-cli/packages/mcp/dist/server.js"]
    }
  }
}
```

Discovery covers the usual ports, so this is usually all you need. To pin a
specific server — say you run more than one — set `SUI_CLI_WEB_PORT` (or
`SUI_CLI_WEB_SERVER_URL` for another host) in the same entry's `env`:

```json
{
  "mcpServers": {
    "sui-cli-web": {
      "command": "node",
      "args": ["/absolute/path/to/raycast-sui-cli/packages/mcp/dist/server.js"],
      "env": { "SUI_CLI_WEB_PORT": "4002" }
    }
  }
}
```

## Development

```sh
npm run dev -w @sui-cli-web/mcp     # tsx watch
npm run build -w @sui-cli-web/mcp   # tsup, emits dist/ + types
```

To exercise it interactively without a full MCP client, use the
[MCP Inspector](https://github.com/modelcontextprotocol/inspector):

```sh
npx @modelcontextprotocol/inspector node packages/mcp/dist/server.js
```
