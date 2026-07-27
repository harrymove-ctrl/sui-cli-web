# Research: forking/adopting `suiup` to grow `sui-cli-web` → `suiup-cli-web`

Question this answers: can `sui-cli-web` become a web UI over the whole Sui
*ecosystem* toolchain (Sui CLI **and** Walrus, MVR, Seal, etc.) instead of
just Sui CLI, by building on top of `MystenLabs/suiup`? Short answer: **yes
— suiup already does exactly the "install & switch multiple ecosystem CLIs"
job you'd otherwise have to build, and it already lists Walrus as a
first-class binary.** The right move isn't forking suiup's code, it's
depending on it as the toolchain manager underneath a renamed/expanded
`sui-cli-web`.

## 1. What suiup actually is

[MystenLabs/suiup](https://github.com/MystenLabs/suiup) — Apache-2.0, Rust,
82 stars, actively maintained (last update within the last ~2 months as of
this writing). It is **not** a wallet or RPC bridge — it's a version
manager/installer, the same category as `nvm`/`rustup`/`asdf`, scoped to the
Sui ecosystem's binaries.

**Binaries it manages today** (from its README):

| Binary | Purpose | Source repo |
|---|---|---|
| `sui` | Sui CLI | `MystenLabs/sui` |
| `sui-fork` | Experimental Sui CLI fork | `MystenLabs/sui` |
| `sui-node` | Sui validator/full node | `MystenLabs/sui` |
| `mvr` | Move Registry CLI | `MystenLabs/mvr` |
| `seal` | Seal (secrets/encryption) CLI | `MystenLabs/seal` |
| **`walrus`** | **Walrus decentralized storage CLI** | `MystenLabs/walrus` |
| `site-builder` | Walrus Sites publishing | `MystenLabs/walrus-sites` |
| `move-analyzer` | Move language server | `MystenLabs/sui` |
| `ledger-signer` / `yubikey-signer` | Hardware-signer helpers | `MystenLabs/rust-signers` |

So **Walrus support is already there** — `suiup install walrus@mainnet`
today. The gap isn't "does something support Sui + Walrus," it's "does
`sui-cli-web`'s web UI/server expose Walrus commands the way it exposes Sui
CLI commands." That's a `sui-cli-web` feature-development problem, not
something you need to fork suiup to solve.

## 2. How suiup is built (relevant parts)

- **Declarative binary registry**: each supported tool is one TOML file
  under `binaries/*.toml` (e.g. `binaries/walrus.toml`, `binaries/sui.toml`),
  compiled into the binary at build time (`build.rs` → `registry.rs`).
  Adding a new tool to suiup is "add a TOML file," not "write new install
  logic" — the installer, version resolver, and default-switcher are all
  generic over `BinaryConfig`.

  ```toml
  # binaries/walrus.toml
  name = "walrus"
  repository = "MystenLabs/walrus"
  installation_type = "archive"
  network_based = true
  supported_networks = ["testnet", "devnet", "mainnet"]
  default_network = "testnet"
  supports_debug = false
  cargo_package = "walrus-service"
  ```

- **Storage layout** (`src/paths.rs`) — XDG-style on Unix/macOS
  (`~/.local/share`, `~/.config`, `~/.cache`, all overridable via
  `XDG_*_HOME`), `%LOCALAPPDATA%` on Windows. It tracks:
  - `installed_binaries.json` — every version of every tool ever installed,
    per network (`BinaryVersion { binary_name, network_release, version,
    debug, path }`)
  - a "default" pointer per binary (`suiup default set sui@testnet-1.40.0`)
    that's what ends up symlinked/copied onto `PATH`
- **Commands** map directly onto that model: `install`, `update`, `remove`,
  `list` (available), `show` (installed), `default get/set`, `which`,
  `status`, `doctor` (environment diagnostics), `cleanup` (cache GC),
  `self update/uninstall`.
- Ships as a single static binary (`install.sh` curl-pipe, cargo install, or
  GitHub release download) — no runtime dependency beyond itself.

This is a clean, generic "ecosystem toolchain manager" — the exact
`nvm`-for-Sui role `sui-cli-web` currently has zero opinion about (it just
assumes `sui` is already on `PATH`, per
[`SuiCliExecutor`](../../apps/server/src/cli/SuiCliExecutor.ts) and
[`utils/platform.ts`](../../apps/server/src/utils/platform.ts)).

## 3. Fork vs. depend-on: recommendation

**Don't fork suiup's Rust codebase.** Depend on it as an external tool the
same way `sui-cli-web` already depends on `sui` being installed. Reasons:

1. **Maintenance cost.** Forking means you now track every Sui/Walrus/MVR/
   Seal release format change yourself. Mysten Labs already owns that
   integration surface (they publish the binaries suiup installs) and ships
   updates every ~2 weeks per the CLI release cadence mentioned in suiup's
   own README. A fork drifts immediately.
2. **No code-level integration point exists anyway.** suiup is a standalone
   CLI, not a library `sui-cli-web`'s Node/TypeScript server could import —
   there's no `suiup` crate exposed as an SDK, only a binary you shell out
   to. Forking its Rust source buys you nothing your own server can call
   into; you'd shell out to your fork exactly like you'd shell out to
   upstream.
3. **The real value to capture is the *registry model* (§2), not the
   binary.** `sui-cli-web` already has a `SuiCliExecutor` singleton that
   shells out to one binary (`sui`). Generalizing that to a small set of
   `XyzCliExecutor`s (or one generic `ToolExecutor` parameterized by binary
   name) that shell out through `suiup which <tool>` / a resolved path is a
   much smaller, much more maintainable change than vendoring suiup's Rust
   source.

**What you *do* fork/own:** the naming and product surface —
`suiup-cli-web` as your project's new identity, positioned as "the web UI
for the tools `suiup` manages," with suiup itself as an optional/recommended
dependency, not a vendored copy.

## 4. Two integration modes to support

### Mode A — "bring your own toolchain" (works today, zero new code)

`sui-cli-web`'s server already just calls whatever `sui` binary it finds on
`PATH`/known install locations (`Platform.getBinarySearchPaths` in
`utils/platform.ts`). If a user installed `sui` *via* suiup
(`suiup default set sui@testnet`), suiup has already put the resolved
binary on `PATH` — the existing server works unmodified. Nothing to build;
worth stating explicitly in docs/marketing ("works great alongside suiup").

### Mode B — "suiup-aware" (the actual feature work for `suiup-cli-web`)

Let the web UI *see and drive* suiup itself, not just consume its output:

1. **Detection.** On startup, `SuiCliExecutor`-style check: is `suiup` on
   `PATH`? (`suiup --version`). Surface this in `/api/status` alongside the
   existing `suiInstalled`/`suiVersion` fields.
2. **New `ToolchainService`** (parallel to `EnvironmentService`) wrapping:
   - `suiup list` → available tools/versions (structured via `--json` if
     suiup supports it, else parse table output — check current suiup CLI
     for a `--json`/`--format json` flag before committing to a parser)
   - `suiup show` → installed versions per tool
   - `suiup default get/set <tool>@<network>-<version>` → switch active
     version, mirroring how `EnvironmentService.switchEnvironment` already
     works for RPC envs
   - `suiup install <tool>@<network>` → install a new tool/version (this is
     a write operation — gets its own rate-limit tier and a confirmation
     step in the UI, same posture as `key-management` routes)
   - `suiup doctor` → surface environment problems (PATH ordering, etc.) as
     a health-check panel
3. **New routes**: `routes/toolchain.ts` → `GET /toolchain/tools`,
   `GET /toolchain/installed`, `POST /toolchain/install`,
   `POST /toolchain/default`, `GET /toolchain/doctor` — same
   `ApiResponse<T>` envelope as everything else
   ([BACKEND_ARCHITECTURE.md](./BACKEND_ARCHITECTURE.md) §2).
4. **Walrus as the first non-Sui tool surfaced in the UI.** Once
   `ToolchainService` can install/select `walrus`, add a `WalrusService` +
   `routes/walrus.ts` that shells out to the `walrus` binary the same way
   `AddressService` shells out to `sui` — e.g. `walrus store`, `walrus
   read`, `walrus blob-status`, mirrored 1:1 the way `EnvironmentService`
   mirrors `sui client envs`. (Exact Walrus CLI surface needs its own pass
   over `walrus --help` / Walrus docs before locking the route list — not
   researched in depth here since this doc's scope was suiup itself.)
5. **MCP tools** (if you build the MCP server from
   [MCP_SERVER_DESIGN.md](./MCP_SERVER_DESIGN.md)): add
   `toolchain_list_tools`, `toolchain_install`,
   `toolchain_set_default` alongside `environment.*`/`wallet.*` — same
   confirmation-token gating for `install`/`set_default` since they mutate
   what's on the user's `PATH`.

## 5. Suggested rename/rebrand scope

If committing to "`suiup-cli-web`" as the new identity:

- `package.json` `name`/`description`/`keywords`, `apps/server`
  `bin` name (consider keeping `sui-cli-web` as a back-compat alias binary
  pointing at the same entrypoint, since it's already published to npm at
  that name — a hard rename breaks existing `npx sui-cli-web` users).
- README/marketing copy: reposition from "web UI for Sui CLI" to "web UI
  for the Sui ecosystem toolchain (Sui, Walrus, MVR, …) — pairs with
  `suiup`."
- New top-level nav/section in the client for "Toolchain" (parallel to the
  existing "Environments" section), surfacing `ToolchainService` data.
- Server-side: no need to rename `SuiCliExecutor` itself — it's still
  correctly scoped to the Sui CLI specifically; add sibling executors per
  tool rather than generalizing prematurely.

## 6. What this doc deliberately does not cover

- The actual Walrus CLI command surface (store/read/blob lifecycle) — needs
  a follow-up pass reading `walrus --help` output and Walrus docs
  (`docs.wal.app`) the same way this doc read suiup's source.
- Whether to shell out to `suiup` itself for installs vs. replicating its
  GitHub-release-download logic directly in `sui-cli-web`'s server. Default
  recommendation is "shell out to suiup" (less code, matches §3), but if
  `suiup` ever lacks a `--json` output mode needed for clean parsing, that
  tips toward the server doing its own release-fetching for just the
  binaries it cares about (mirroring `binaries/*.toml`'s data, not its
  code).
