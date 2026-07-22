# sui-cli-web

<div align="center">

![npm version](https://img.shields.io/npm/v/sui-cli-web-server?color=blue&label=npm)
![downloads](https://img.shields.io/npm/dm/sui-cli-web-server?color=green)
![license](https://img.shields.io/npm/l/sui-cli-web-server)
![node](https://img.shields.io/node/v/sui-cli-web-server)

**Local server that bridges your browser to the Sui CLI**

[Live Demo](https://cli.firstmovers.io) · [Documentation](https://github.com/hien-p/raycast-sui-cli#readme) · [Report Bug](https://github.com/hien-p/raycast-sui-cli/issues)

</div>

---

## Why sui-cli-web-server?

**Your private keys stay on YOUR machine.** This package runs a local server that connects the [web interface](https://cli.firstmovers.io) to your locally installed Sui CLI. No keys are ever transmitted to external servers.

```
Browser (cli.firstmovers.io)  ←→  Local Server (this package)  ←→  Sui CLI (your machine)
```

## Quick Start

```bash
# Make sure Sui CLI is installed
sui --version

# Run the server (no installation needed!)
npx sui-cli-web
```

Then open **https://cli.firstmovers.io** - it connects automatically.

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
npx sui-cli-web
```

### Option 2: Global Install

```bash
npm install -g sui-cli-web
sui-cli-web
```

### Option 3: Local Install

```bash
npm install sui-cli-web
npx sui-cli-web
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

The server exposes a REST API at `http://localhost:3001/api`

### Core Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check |
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

The server runs on port **3001** by default and binds to **localhost** only.

| Setting | Value | Notes |
|---------|-------|-------|
| Port | 3001 | Fixed |
| Host | localhost | Security: no external access |
| CORS | Configured | cli.firstmovers.io + localhost |

## Security

- **Private keys never leave your machine** - All signing happens via local Sui CLI
- **Localhost only** - Server doesn't accept external connections
- **Open source** - [Audit the code](https://github.com/hien-p/raycast-sui-cli)
- **Rate limited** - 100/min read, 30/min write, 5/min faucet

## Troubleshooting

### Server won't start

```bash
# Check if port 3001 is in use
lsof -ti:3001 | xargs kill -9
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
- `https://cli.firstmovers.io`
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

- [Web Interface](https://cli.firstmovers.io) - Beautiful UI for this server
- [Sui Documentation](https://docs.sui.io) - Official Sui docs
- [Move Language](https://move-language.github.io/move/) - Smart contract language

## License

MIT © [hien-p](https://github.com/hien-p)

---

<div align="center">

**[cli.firstmovers.io](https://cli.firstmovers.io)** · Made with ❤️ for the Sui community

</div>
