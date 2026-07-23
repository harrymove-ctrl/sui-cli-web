# sui-cli-web

<div align="center">

![npm version](https://img.shields.io/npm/v/sui-cli-web-server?color=blue&label=npm)
![downloads](https://img.shields.io/npm/dm/sui-cli-web-server?color=green)
![license](https://img.shields.io/npm/l/sui-cli-web-server)
![node](https://img.shields.io/node/v/sui-cli-web-server)

**Local server that bridges your browser to the Sui CLI**

[Live Demo](https://sui-cli-web-production.up.railway.app) · [Documentation](https://github.com/hien-p/raycast-sui-cli#readme) · [Report Bug](https://github.com/hien-p/raycast-sui-cli/issues)

</div>

---

## Why sui-cli-web-server?

**Your private keys stay on YOUR machine.** This package runs a local server that connects the [web interface](https://sui-cli-web-production.up.railway.app) to your locally installed Sui CLI. No keys are ever transmitted to external servers.

```
Browser (sui-cli-web-production.up.railway.app)  ←→  Local Server (this package)  ←→  Sui CLI (your machine)
```

## Quick Start

```bash
# Make sure Sui CLI is installed
sui --version

# Run the server (no installation needed!)
npx sui-cli-web-server
```

The installed binary is called `sui-cli-web`, but the package is
`sui-cli-web-server` — and `npx` resolves package names. `npx sui-cli-web`
fetches a different, older package (1.0.2) that is no longer updated, so use
the full name.

Then open **https://sui-cli-web-production.up.railway.app** - it connects automatically.

## Features

| Feature | Description |
|---------|-------------|
| **Address Management** | Create, switch, view addresses with balances |
| **Transfer SUI** | Send tokens with gas estimation |
| **Gas Management** | Split and merge gas coins |
| **Network Switching** | Mainnet, testnet, devnet, localnet |
| **Faucet Integration** | Request test tokens |
| **Move Development** | Build, test, publish, upgrade packages |
| **Transaction Inspector** | Inspect and replay transactions |
| **Community Tiers** | On-chain membership with progression |

## Installation

### Option 1: npx (Recommended)

```bash
npx sui-cli-web-server
```

### Option 2: Global Install

```bash
npm install -g sui-cli-web
sui-cli-web
```

### Option 3: Local Install

```bash
npm install sui-cli-web
npx sui-cli-web-server
```

## Requirements

- **Node.js 18+**
- **Sui CLI** installed and configured ([Install Guide](https://docs.sui.io/build/install))

```bash
# Install Sui CLI
brew install sui          # macOS
cargo install --locked sui  # All platforms
```

## API Reference

The server exposes a REST API at `http://localhost:<port>/api` (3001 by
default). `GET /health` sits outside that prefix — it is the endpoint
clients probe to identify this server, and it reports
`service: "sui-cli-web-server"` so they do not attach to something else
that happens to hold the port.

### Core Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Liveness + service identity — **not** under `/api` |
| `GET` | `/api/health` | Health check (status, timestamp, port) |
| `GET` | `/status` | Sui CLI status |
| `GET` | `/addresses` | List all addresses |
| `GET` | `/addresses/active` | Get active address |
| `POST` | `/addresses/create` | Create new address |
| `POST` | `/addresses/switch` | Switch active address |

### Transfer Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/transfers/sui` | Transfer SUI tokens |
| `POST` | `/transfers/sui/dry-run` | Estimate gas |
| `POST` | `/transfers/object` | Transfer object/NFT |
| `GET` | `/transfers/sui/coins/:address` | Get transferable coins |

### Gas Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/gas/split` | Split gas coin |
| `POST` | `/gas/merge` | Merge gas coins |

### Environment Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/environments` | List environments |
| `POST` | `/environments/switch` | Switch network |
| `POST` | `/environments` | Add custom RPC |

### Move Development

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/move/build` | Build package |
| `POST` | `/move/test` | Run tests |
| `POST` | `/packages/publish` | Publish on-chain |
| `POST` | `/packages/upgrade` | Upgrade package |

### Community

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/community/membership` | Check membership |
| `POST` | `/community/join` | Join community |
| `GET` | `/community/tier/:address` | Get tier info |

[Full API Documentation →](https://github.com/hien-p/raycast-sui-cli/blob/main/API_REFERENCE.md)

## Example Usage

### Transfer SUI

```bash
curl -X POST http://localhost:3001/api/transfers/sui \
  -H "Content-Type: application/json" \
  -d '{
    "to": "0x1234...abcd",
    "amount": "1.5"
  }'
```

### Get Addresses

```bash
curl http://localhost:3001/api/addresses
```

### Switch Network

```bash
curl -X POST http://localhost:3001/api/environments/switch \
  -H "Content-Type: application/json" \
  -d '{"alias": "testnet"}'
```

## Configuration

| Setting | Default | How to change |
|---|---|---|
| Port | `3001` | `PORT=4002 npx sui-cli-web-server` |
| Host | `127.0.0.1` | `HOST=0.0.0.0` — see the warning below |
| Allowed origins | hosted UI + `localhost` | `ALLOWED_ORIGINS=https://example.com,...` |

The port is **not fixed** — `PORT` is read at startup. One caveat: clients find
the server by scanning ports `3001`–`3005`, `4001`, `4002`, `8001` and `8080`,
so a port outside that list works but leaves the web UI and the MCP server
unable to discover it. Pick one from the list, or point them at it explicitly
(`SUI_CLI_WEB_PORT` for the MCP server).

`HOST` defaults to `127.0.0.1`, but the server binds `0.0.0.0` automatically
when a `PORT` variable is present in the environment — the check that detects
container platforms. If you set `PORT` inside something that also treats it as
a signal, be aware you may be listening on every interface.

## Security

- **Private keys never leave your machine.** All signing happens through your
  local Sui CLI. The one exception is the explicit export endpoint, which is
  gated behind a confirmation code.
- **No authentication, on any endpoint.** Whatever can reach the server can
  call anything on it, including the `sui keytool` routes. On loopback that is
  fine — anything that local already runs as you. It is *not* fine on a public
  interface, so do not set `HOST=0.0.0.0` (or run this where `PORT` is
  injected) without putting authentication in front of it.
- **Rate limited** — 1000/min read, 300/min write, 200/min keytool, 5/min
  faucet. Sized for one local user, not for public traffic.
- **CORS is an allowlist**, not a wildcard — but it only governs which web
  pages may read responses. It stops nothing that is not a browser.
- **Open source** — [audit the code](https://github.com/hien-p/raycast-sui-cli).

## Troubleshooting

### Server won't start

```bash
# Something else already on the port?
lsof -ti:3001 | xargs kill -9

# Or just use another one from the scanned list
PORT=4002 npx sui-cli-web-server
```

### Sui CLI not found

```bash
# Verify Sui is installed
sui --version

# If not, install it
brew install sui  # macOS
cargo install --locked sui  # Other
```

### CORS errors

Make sure you're accessing via:
- `https://sui-cli-web-production.up.railway.app`
- `http://localhost:5173` (dev mode)

## Development

```bash
# Clone the repo
git clone https://github.com/hien-p/raycast-sui-cli.git
cd raycast-sui-cli/packages/server

# Install dependencies
npm install

# Run in dev mode
npm run dev

# Build
npm run build
```

## Tech Stack

- **[Fastify](https://fastify.io/)** - Fast, low overhead web framework
- **TypeScript** - Type safety
- **Sui CLI** - Official Sui command line tool

## Related

- [Web Interface](https://sui-cli-web-production.up.railway.app) - Beautiful UI for this server
- [Sui Documentation](https://docs.sui.io) - Official Sui docs
- [Move Language](https://move-language.github.io/move/) - Smart contract language

## License

MIT © [hien-p](https://github.com/hien-p)

---

<div align="center">

**[sui-cli-web-production.up.railway.app](https://sui-cli-web-production.up.railway.app)** · Made with ❤️ for the Sui community

</div>
