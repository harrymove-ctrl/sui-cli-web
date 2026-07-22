# Sui CLI Web

A keyboard-first web interface for the Sui CLI. Manage addresses, switch
environments, request faucet tokens, publish Move packages and inspect
transactions — without leaving the keyboard.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![npm](https://img.shields.io/npm/v/sui-cli-web-server)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-green)

**Live**: https://sui-cli-web-production.up.railway.app · **npm**: `sui-cli-web-server`

## Features

- **Address Management** — view, switch and create addresses with balances
- **Transfer SUI** — send tokens with gas estimation and a dry run first
- **Gas Management** — split and merge gas coins
- **Environment Switching** — mainnet, testnet, devnet, localnet
- **Faucet Integration** — request test tokens from the UI
- **Move Development** — build, test, publish and upgrade packages
- **Transaction Inspector** — inspect, replay and analyse gas
- **MCP Server** — read-only access for AI agents (`@sui-cli-web/mcp`)

## How it works

The browser never touches your keys. It talks to a small server running on
your own machine, which shells out to the `sui` CLI you already have.

```
┌──────────────────────────────────────────────────────────────┐
│  Browser                                                     │
│  https://sui-cli-web-production.up.railway.app               │
└──────────────────────────────────────────────────────────────┘
                             │
                             │  HTTP to http://localhost:<port>
                             ▼
┌──────────────────────────────────────────────────────────────┐
│  Your machine                                                │
│                                                              │
│    npx sui-cli-web-server        (Fastify, binds 127.0.0.1)  │
│                             │                                │
│                             │  executes                      │
│                             ▼                                │
│    sui CLI                       ~/.sui/sui_config/*         │
└──────────────────────────────────────────────────────────────┘
```

**Your keys stay on your machine.** They live in your local Sui CLI config and
are never sent anywhere. The only exception is the explicit export flow, which
is gated behind a confirmation code.

The hosted URL above serves the UI. It runs the same server binary, but with
no Sui config and no keystore behind it — it exists to hand your browser the
interface, not to hold anything of yours.

## Quick start

**Prerequisites:** Node.js 18+ and the Sui CLI
([install guide](https://docs.sui.io/guides/developer/getting-started/sui-install)).

```bash
brew install sui                     # macOS
cargo install --locked sui           # any platform, via Rust
```

Start the local server and leave it running:

```bash
npx sui-cli-web-server
```

Then open **https://sui-cli-web-production.up.railway.app** — it finds your
server automatically.

> The UI discovers the server by scanning ports 3001–3005, 4001, 4002, 8001
> and 8080. If you set `PORT`, keep it inside that list or the UI will not
> find it — a server on an unscanned port looks exactly like one that failed
> to start.

## Development

```bash
npm install
npm run dev            # server + client together
npm run dev:server     # server only
npm run dev:client     # client only, on http://localhost:5174
npm run dev:marketing  # Astro site (landing + changelog)
npm run build          # every workspace, in dependency order
```

The Vite dev server proxies `/api` to `http://localhost:4001`
(`apps/web/vite.config.ts`). If you start the backend on a different port,
change the proxy target to match — they are not linked automatically.

### Project structure

```
apps/
├── marketing/   Astro site — landing page and changelog
├── web/         React + Vite + Tailwind UI            (@sui-cli-web/client)
└── server/      Fastify server, shells out to sui CLI (npm: sui-cli-web-server)

packages/
├── mcp/         MCP server for AI agents              (@sui-cli-web/mcp)
└── shared/      Shared TypeScript types and utilities (@sui-cli-web/shared)
```

Only the changelog is published from the marketing site right now; the deploy
step copies `changelog/`, `_astro/` and `images/changelog/` and nothing else,
so the blog routes do not exist in the deployment.

## Deployment

The hosted app runs on Railway from the repository root `Dockerfile`
(`railway.json` sets `builder: DOCKERFILE`). The build compiles every
workspace, then copies the marketing changelog output into the client's
`dist/blog`, and the server serves the whole thing.

Two things worth knowing before changing it:

- The platform injects `PORT`, and the server binds `0.0.0.0` whenever a
  `PORT` variable is present. The public domain's target port has to match
  what the process actually listens on, or every request returns 502.
- CORS is an allowlist. It holds the hosted origin, `localhost`, this
  deployment's own domain, and anything in `ALLOWED_ORIGINS`. A local server
  driven by some other page will be refused unless that origin is added.

## Troubleshooting

**The UI cannot find the server.** Check the server is still running, and that
its port is one the UI scans (see the note in Quick start).

**`sui` not found.** Install it (`brew install sui`, or
`cargo install --locked sui`) and confirm with `sui --version` in the same
terminal the server runs in — the server inherits that shell's `PATH`.

**Port already in use.**

```bash
lsof -ti:3001 | xargs kill -9        # macOS/Linux
```

## Security

- Run locally, the server binds `127.0.0.1` and is reachable only from your
  machine.
- **There is no per-request authentication.** Anything that can reach the
  server can call any endpoint. On loopback that is fine — anything that
  local is already running as you. It is not fine on a public interface, and
  the same binary binds `0.0.0.0` when a `PORT` variable is present, so do not
  expose it without putting authentication in front of it first.
- Private keys stay in your local Sui CLI config. Export is confirmation-gated
  and is the only path that returns a raw key.
- Everything is open source — [read it](https://github.com/hien-p/raycast-sui-cli).

## Documentation

| Document | Description |
|---|---|
| [Server README](apps/server/README.md) | The npm package: install, endpoints, configuration |
| [MCP Server](packages/mcp/README.md) | Read-only MCP server for AI agents |
| [Changelog](https://sui-cli-web-production.up.railway.app/changelog) | What shipped, by date |

Architecture notes (backend, dashboard, object inspector, MCP design, backlog)
live in `docs/`, which is currently **gitignored** — they exist on a checkout
but are not in the repository, so they cannot be linked from here.

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b fix/short-slug`)
3. Commit your changes — a pre-commit hook runs Biome over staged files
4. Push and open a pull request

## License

MIT.

## Links

- [Live app](https://sui-cli-web-production.up.railway.app)
- [npm package](https://www.npmjs.com/package/sui-cli-web-server)
- [GitHub](https://github.com/hien-p/raycast-sui-cli)
- [Sui documentation](https://docs.sui.io)
