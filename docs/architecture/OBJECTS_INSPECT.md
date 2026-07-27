# Objects & Object Inspector

The `/app/objects` view — where a developer browses every object an address owns
and drills into any one to see its full on-chain shape.

It's two experiences in one screen. The **list** is a fast, filterable table of
everything the wallet holds. The **inspector** opens in place when you click a
row, replacing the list with a detailed breakdown of that single object. Under
the hood these are two components — `ObjectList` and `ObjectDetail` — but to a
user it feels like one surface that zooms in and back out.

This doc is both a **reference** for what exists today and a **plan** for where
it should go, framed around what Sui developers actually need and where the Sui
stack is heading in 2026.

> **Legend used in the grids below:** ✅ built · 🟡 partial · 🔭 planned

---

## Features

Everything shipped in the inspector today, at a glance:

| Feature | What it does |
|---|---|
| **Coin Balance + Quick Actions** | Real balance for any `Coin<T>`, plus one-tap Transfer/Split/Merge, regardless of whether the framework address arrived in short or canonical form. |
| **Ownership, all 5 kinds** | Address-owned, Object-owned (with a link to the parent object), Shared, Immutable, and Party (`ConsensusAddressOwner`) are all named and labeled correctly — none fall back to "Unknown." |
| **Custom Transfer Rules legible** | The Public Transfer row explains *why*: "Anyone can transfer this (has store)" or "Only this object's module can transfer it — custom transfer rules," sourced from RPC's real `hasPublicTransfer` ability check. |
| **Display V2 metadata** | Real NFT preview — image, name, description, link, project, creator — read from the object's resolved Display standard data, not guessed from raw struct fields. |
| **Display config object card** | A `Display<T>` template object (the config, not an NFT instance) gets its own card showing the target type and the raw `{field}` template strings it registered. |
| **TransferPolicy / Kiosk cards** | `TransferPolicy<T>`, `TransferPolicyCap<T>`, `Kiosk`, and `KioskOwnerCap` each get a dedicated card — rules, balance, item count, profits, and a click-through link between a cap and the object it controls. |
| **Version history** | A bounded backward walk through an object's version chain — version number, producing transaction, timestamp — a handful of real hops back, not just the single last tx. |
| **Dynamic fields count** | The "Explore Dynamic Fields" link only appears once a real fetched count confirms there's something attached (or the object is a known container type), instead of showing for almost every object. |
| **Derived Address Calculator** | A standalone tool (Development → Derived Address Calculator) that computes a derived object's deterministic address from a parent id + key, using Sui's own official hash implementation. |
| **Fast, virtualized list** | Every owned object in one filterable, sortable, virtualized table, sorted into categories (Coins/NFTs/Walrus Memory/Capabilities/Other) that only appear when the wallet actually holds that kind. |
| **Walrus Memory tab** | Decoded blob details, the memwal account, blob decryption as a chosen signer, and delegate-key management, for Walrus storage objects. |

---

## What you're looking at

The screen reads top to bottom in four bands:

| Band | Content |
|---|---|
| **Header** | *Objects* on the left, the active wallet alias (e.g. `romantic-labradorite`) on the right — you always know whose objects these are. |
| **Filter bar** | Category pills (`All`, `Coins`, `NFTs`, `Walrus Memory`, `Capabilities`, `Other`, …) each with a live count. The active pill is a solid dark chip. A category only shows when the wallet has objects in it, so the bar reshapes per wallet. |
| **Table** | One object per row, in a virtualized scroll viewport. Click a row to inspect it. |
| **Footer** | A `353/353 objects` counter (filtered / total) on the left, a *Click to inspect* hint on the right. |

The look is a quiet, monochrome developer tool — near-black for the one active
element, muted grey for everything secondary, hairline dividers, generous
spacing. Nothing competes with the data.

---

## Bugs found and fixed — why a plain coin's Overview looked sparse

A real user report ("this isn't detailed enough") pointed at a plain SUI coin's
Overview showing only Type/Version/Digest/Owner/Storage Rebate/Public
Transfer — no balance, no Transfer/Split/Merge, and a garbled breadcrumb title
(`Coin<0x000...002` instead of `Coin`). Tracing it found three concrete,
already-fixed bugs, not missing features:

1. **`isCoinType()` matched only the short-form package address.** It checked
   for the literal substring `0x2::coin::Coin<`, but the CLI/RPC can return
   the framework package address in its full 32-byte zero-padded canonical
   form instead (`0x000...0002::coin::Coin<...>`), which doesn't contain that
   substring. Every coin object using the canonical form silently failed the
   `isCoin` check — hiding the whole Coin Balance section and its
   Transfer/Split/Merge actions, for what is otherwise a perfectly normal
   coin. Fixed in `@sui-cli-web/shared` by matching on the module path alone
   (`::coin::Coin<`), which is invariant regardless of how the address is
   formatted. (`ObjectList`'s own category classification already used this
   looser style of match — `type.toLowerCase().includes('coin')` — so the
   **list/filter view was never affected**, only the detail Overview.)
2. **The breadcrumb title split the raw type string on `::` without
   stripping the generic parameter first**, so `Coin<0x2::sui::SUI>`'s *own*
   `::` separators (inside the `<...>`) contaminated the split, producing a
   fragment of the generic argument instead of the struct name. This breaks
   for *any* generic type, not just coins. Fixed by splitting on `<` first to
   isolate the outer type, then splitting that on `::`.
3. **"Public Transfer" was always "No" for every object, permanently** — the
   field it reads (`content.hasPublicTransfer`) is never populated anywhere
   in this codebase (checked client and server), so it silently defaulted to
   `false` and rendered as a confident, wrong "No" regardless of the
   object's real abilities. This wasn't a display bug so much as a feature
   that was never actually built behind a field that looked like it worked.
   Rather than fabricate a real ability check right now (that needs a
   package/module ABI lookup this app doesn't have on hand yet — see
   "Regulated-coin / DenyList status" in the feature grid below, which needs
   the same kind of lookup), the honest fix was to show **"Unknown"**
   whenever the field was never actually fetched, instead of a wrong "No".

   **Update:** `AddressService.getObject` (the single-object fetch behind this
   page) is now RPC-first (`sui_getObject` with `showContent: true`), and RPC's
   real `content.hasPublicTransfer` genuinely *is* an ability check — it's
   true exactly when the object's type has Move's `store` ability, which is
   also precisely what Sui calls **[Custom Transfer
   Rules](https://docs.sui.io/develop/objects/transfers/custom-rules)**: no
   `store` means only the defining module can transfer the object. So this
   field is no longer a stub — it's populated and correct on the RPC path (the
   CLI fallback path's shape for this field is unverified, which is exactly
   why `knowsPublicTransfer` still guards it and falls back to "Unknown"
   rather than assuming). The Overview row now spells this out instead of
   just saying Yes/No with no context.

None of these needed a design decision — they were straightforward
"the code assumed one shape of CLI output and got a different one" bugs, the
same class of issue as the address/owner shape drift noted throughout this
doc (see the Owner section next, and the `AddressOwner`/`ObjectOwner`/
`Shared` type errors already flagged in `apps/web/src/components/
ObjectList/ObjectDetail.tsx` — `owner` can arrive as a plain string instead
of the expected `{ AddressOwner: "0x.." }` wrapper object in some cases,
which the current code doesn't yet handle; it just hasn't been hit by a real
object shape yet, unlike the three above).

---

## Anatomy of a Sui object

The inspector's whole job is to make an object's internals legible, so it helps
to know what those internals *are*. Every Sui object — coin, NFT, capability,
package — carries the same core envelope, and then a type-specific payload
inside it.

| Part | What it is | Surfaced today? |
|---|---|---|
| **Object ID (UID)** | The permanent 32-byte identity. Never changes across the object's life. | ✅ |
| **Version** | A sequence number that ticks up every time the object is touched. The basis for optimistic concurrency and upgrades. | ✅ (current number, plus a backward version-history walk) |
| **Digest** | A hash of the object's current contents — its fingerprint at this version. | ✅ |
| **Owner** | *How* the object is held (see below). Determines whether touching it needs consensus. | ✅ (all 5 kinds, party objects included) |
| **Type** | The fully-qualified Move type: `package::module::Struct`, with generic parameters. | ✅ |
| **Contents (BCS)** | The actual fields, serialized as BCS. The inspector decodes these into the Fields tab. | 🟡 (decoded fields, no raw BCS view) |
| **Storage rebate** | SUI locked as a deposit against storage, refunded when the object is deleted. | ✅ |
| **Previous transaction** | The digest of the tx that produced this version — the thread you pull to trace history. | ✅ (one hop via the Transaction tab, further via the version-history walk) |

### Ownership is the important one

How an object is owned decides what can touch it and how fast:

| Ownership | Meaning | Execution path | Inspector |
|---|---|---|---|
| **Address-owned** | Held by one account (or one parent object). | Fast path, ~300 ms finality, no consensus. | ✅ |
| **Object-owned (child)** | Owned by another object — the shape behind dynamic object fields. | Fast path. | ✅ — links to the parent object's own detail view |
| **Shared** | Anyone can use it (a DEX pool, a lending market). | Full consensus. | ✅ |
| **Immutable** | No owner, can never change — published packages, `CoinMetadata`. | No consensus, freely read. | ✅ |
| **Party object** | Singly owned but **versioned by consensus** (`ConsensusAddressOwner`). A newer model bridging fast-path ownership and consensus guarantees. | Consensus. | ✅ — labeled "Party", distinct from a plain address owner |
| **Wrapped** | Not an ownership type — an object nested *inside* another struct, so it has no independent owner until unwrapped. | — | 🔭 not detected (no independent `owner` field exists to detect this from) |

All ownership kinds Sui actually models are now distinguished in the Overview.
"Wrapped" isn't a real gap in the same sense — there's no on-chain `owner`
field to read for a wrapped object in the first place, since it only exists
serialized inside its parent's own fields.

---

## The categories

Every object is sorted into exactly one category; the pills narrow to that kind.

| Category | What lands here |
|---|---|
| **All** | Everything the wallet owns. |
| **Coins** | Fungible tokens — SUI, USDC, WAL, test coins. |
| **NFTs** | Anything that presents as a collectible or carries display metadata. |
| **Walrus Memory** | On-chain blobs and memwal account objects from the Walrus storage integration. |
| **Capabilities** | Permission objects — admin caps, upgrade caps, kiosk owner caps, publishers. |
| **Other** | Everything that doesn't fit above. |

Classification matches on the object's Move type string — coins contain `coin`,
NFTs contain `nft` or `display`, Walrus objects belong to the memwal packages or
are storage blobs, capabilities contain `cap`, and the rest fall through to
*Other*. The rule is first-match-wins, so every object lands in exactly one
bucket and the counts always sum to the total.

The **Coins** category orders the well-known coins first (SUI, then WAL, USDC,
USDT) and the rest by balance, and marks recognised coins with a green check so
you can tell a real USDC from a look-alike.

> A hidden **Game Demo** category lingers from the removed game-demo feature. It
> only appears if a wallet holds objects from that old package, so you'll never
> see it in practice — dead weight worth removing.

---

## The table

Each row is one object. In the default view: **Type** (icon + readable name +
module tag), **Object ID** (monospace, trimmed to fit — copy always yields the
full id), **Balance** (coins only), and **Version**. The row icon matches the
kind — a coin stack, an image, a package box, a key for caps, a crown for admin
caps.

The **Walrus Memory** tab swaps in storage-blob columns instead: **size**,
**availability** (confirmed on Walrus vs still distributing), **storage
reservation**, and **last touched**.

The table is virtualized, so a wallet with thousands of objects stays smooth —
this example has 353. Filtering and sorting happen instantly in the browser; the
list is loaded once, not paged from the server.

---

## Acting on objects

Coins carry quick actions: hover a coin row and **Send** / **Split** appear,
jumping to the matching coin flow with the coin pre-selected. Checkboxes enable
multi-select; the selection toolbar then offers **Merge** (when everything
picked is one coin type), **Transfer** (send all selected to an address), and
**Clear**.

None of these mutate anything from the Objects screen — they hand off to the
dedicated coin and transfer flows. Objects stays a place to *look*, not a place
where writes happen.

---

## The inspector

Click a row and the list is replaced by the inspector. (You can also reach it by
URL, or by pasting a full object id into search.) It opens on **Overview** and
adds tabs only when the object has that data — a plain coin shows just an
overview; a blob or a package reveals more.

| Tab | Shows | Appears for |
|---|---|---|
| **Overview** | Type, version + version history, digest, owner (and *how* it's owned), storage rebate, public-transfer flag (with Custom Transfer Rules framing), a shortcut into dynamic fields when the object can hold them, and an explorer picker. Coins add a balance with one-tap Transfer/Split/Merge; NFTs/Display objects/TransferPolicy/Kiosk objects add their own dedicated card. | Every object — always present. |
| **Fields** | Every field, with nested structures as formatted JSON, all copyable. The raw shape of the data. | Every object. |
| **Package** | The controlled package: id, module list, and each module's structs and functions on demand. | Upgrade caps. |
| **Walrus Memory** | Decoded blob details plus the memwal account; decrypt the blob as a chosen signer and manage the delegate keys allowed to read it. | Storage blobs. |
| **Transaction** | The tx that last changed this object: status, digest, type, gas breakdown, created objects, explorer link. | Any object with a `previousTransaction`. |

The guiding rule: the inspector never shows an empty section. If a tab is there,
it has something to say.

---

## What Sui devs need next — the feature grid

The current inspector is a solid "what is this object" reader. The gap is that a
Sui developer's real questions go deeper — *how does it render, who can touch
it, what's it worth, where did it come from, what can I do with it.* This grid
is the planning backlog, grouped by the question it answers.

### See it clearly

| Feature | Why a Sui dev wants it | Status |
|---|---|---|
| **Display V2 rendering** | Show the object as wallets/marketplaces render it — image, name, description from its on-chain `Display` — instead of only a type string. The single biggest "this looks like a real explorer" upgrade for NFTs. | 🔭 |
| **Raw BCS + type layout** | Toggle from decoded fields to the raw BCS bytes and the struct layout, for when you're debugging serialization or a type you don't control. | 🔭 |
| **Copy-as** | Copy the object as JSON, as BCS, or as a TypeScript/Move type reference. | 🔭 |

### Trust it

| Feature | Why a Sui dev wants it | Status |
|---|---|---|
| **Regulated-coin / DenyList status** | Flag whether a coin is regulated (has `RegulatedCoinMetadata` + `DenyCapV2`) and whether the current address is on its DenyList — the difference between "I can move this" and "this is frozen." | 🔭 |
| **Coin metadata** | Decimals, symbol, icon, and verified/regulated badges pulled from `CoinMetadata`, so balances are shown in real units, not raw base amounts. | 🟡 |
| **Ownership clarity** | Name party objects correctly; link object-owners and parents so you can walk the ownership graph. | ✅ (wrapped objects excepted — see Ownership table above, there's no independent field to detect them from) |
| **Custom Transfer Rules legible** | Say *why* an object can't be publicly transferred (no `store` ability → only the defining module can move it — [Custom Transfer Rules](https://docs.sui.io/develop/objects/transfers/custom-rules)), not just a bare Yes/No. | ✅ |
| **TransferPolicy / Kiosk awareness** | Recognize `TransferPolicy<T>`/`TransferPolicyCap<T>`/`Kiosk`/`KioskOwnerCap` and show their rules, balance, item count, and cap↔object links instead of the generic Overview. | ✅ |

### Trace it

| Feature | Why a Sui dev wants it | Status |
|---|---|---|
| **Version history** | Walk an object backward through its versions via `previousTransaction`, so you can see how it got to now — not just the single last tx. GraphQL/indexer-only (public fullnodes prune old object versions within hours, so `sui_tryGetPastObject` isn't viable), bounded to a handful of hops per click. | ✅ |
| **Related-object graph** | The kiosk behind a `KioskOwnerCap` and the policy behind a `TransferPolicyCap` are now one click away; children (dynamic object fields) still require the separate explorer. | 🟡 |
| **Dynamic fields inline** | The dynamic-fields explorer is a separate page today; a preview of the first N fields in the inspector saves the round trip. A real fetched count now gates whether the "Explore" button even shows, at least. | 🟡 |
| **Derived Address Calculator** | Sui's derived objects ([docs](https://docs.sui.io/develop/objects/derived-objects)) have a deterministic address computable offchain from parent id + key — but no generic on-chain signal exists to discover an *existing* one (the parent link only proves uniqueness). A standalone calculator (Development → Derived Address Calculator) computes the address via `@mysten/sui`'s official `deriveObjectID`, for when a dev already knows the parent+key and wants to jump straight to the object. | ✅ |

### Act on it

| Feature | Why a Sui dev wants it | Status |
|---|---|---|
| **Dry-run against an object** | Simulate calling a function that takes this object, and see the effects, before signing. | 🔭 |
| **Seal-gated read** | Decrypt Seal-encrypted content (beyond today's Walrus-blob case) for any object whose access policy the signer satisfies. | 🟡 |
| **Address Balance view** | Surface the new accumulator-based address balances alongside coin objects (see stack section). | 🔭 |

Not on this grid on purpose: [Simulating References](https://docs.sui.io/develop/objects/transfers/simulating-refs)
(the `borrow` module's hot-potato pattern for working around a PTB limitation) is
purely a Move-code/PTB-construction concern — there's nothing per-object to
inspect or render, so it isn't a gap.

---

## Riding the current Sui stack

The object surface can't be planned in a vacuum — the Sui data stack is shifting
under it right now, and some of these are hard deadlines, not nice-to-haves.

### The JSON-RPC sunset — this is urgent

Sui is **fully deactivating public JSON-RPC on July 31, 2026** (mainnet
endpoints began shutting down the week of July 20). Everything that reads chain
data has to move to one of two replacements:

| Replacement | Best for |
|---|---|
| **gRPC** | Fast, type-safe, low-latency point lookups, transaction submission, simulation, and streaming — "fetch this one object" and "watch for changes." |
| **GraphQL RPC** | Reads the indexer's relational store; pulls an object *and its related objects* (effects, balance changes, version history) in a single nested query instead of many round trips — what the version-history walk above is built on. |

This app already added `suiGrpcClient` and `GraphQLService` — the object
inspector is exactly the surface that benefits: point lookups over gRPC,
related-object graphs over GraphQL. Completing that migration (and not leaning
on the CLI's JSON-RPC underneath) is the top infrastructure item. As part of the
same cutover, the old `sui::display::new` (V1 Display) APIs also stop working
after July 31, 2026 — Display rendering should target **Display V2**.

### Display V2

Display V2 is the on-chain standard for how an object presents itself — image,
name, description — consistently across wallets, explorers, and marketplaces. An
inspector that reads Display V2 can show a real NFT preview instead of a bare
type. V1 auto-migrated but its authoring APIs end with JSON-RPC in July 2026, so
build against V2 from the start.

### Party objects — ✅ handled

The ownership model gained **party objects** — singly owned but consensus-
versioned (`ConsensusAddressOwner`). The Overview's owner band recognises and
labels them ("Party") instead of falling back to "Unknown."

### Regulated coins & the DenyList

Regulated coins carry `RegulatedCoinMetadata` and a `DenyCapV2`, and reference a
shared **DenyList** object that names addresses barred from using the coin. For
a wallet tool this is safety-critical context: a coin row should be able to say
"regulated," and an inspector should be able to answer "is *this* address
denied?" before a dev tries to move funds that can't move.

### Address balances & the accumulator

Sui is introducing **address balances** — an accumulator-settled balance you
deposit into directly (`send_funds`) instead of creating yet another coin
object. It targets the coin-fragmentation UX where wallets accumulate hundreds
of dust coins. As it rolls out, the Objects view should show an address's
accumulator balances beside its coin objects, and eventually offer settlement.

### Walrus, Seal, Nautilus

The storage/access/indexing layers (Walrus storage, Seal access control,
Nautilus offchain indexing) went GA on mainnet in 2025 and this app already
integrates Walrus + Seal in the Walrus Memory tab. The natural extension is to
treat Seal access control as a general capability — any object with a Seal
policy the signer satisfies becomes decryptable — not a Walrus-blob special
case.

---

## Data, states, and extending it

**Data flow.** The list loads once per address; single objects (URL/search) load
on demand; the inspector's heavier tabs (package modules, transaction, blob
contents) load lazily when opened, so you only pay for the depth you look at.
Walrus storage details for the memory columns come in one batched request, not
one per row. Every empty or in-between state says something honest — a shimmer
while loading, a faucet nudge for an empty wallet, a plain "not found" for a
missing id, a clear "couldn't load" inside a failed tab — never a blank table.

**Extending it.** Adding a **category** means teaching the classifier a new
rule, ordered specific-before-broad since first match wins. Adding a **column**
should read a field the object already has; if it needs outside data, fetch it
once in a batched request and join by id — never one request per row. Adding an
**inspector tab** means giving it a rule for when it appears and loading its
contents lazily. Adding an **action** should hand off to the flow that owns the
write, keeping Objects a browse-and-inspect surface.

**One seam to know.** Categories are decided in two places — one list drives
which pills render, a separate rule set does the actual filtering and counting.
The second is the source of truth; if a count ever looks wrong, read the
filtering rule, not the pill definitions.

---

## Sources

Sui stack facts in this doc were checked against current Sui documentation and
announcements (2026):

| Source | Covers |
|---|---|
| [Types of Object Ownership](https://docs.sui.io/concepts/object-ownership) | Address-owned, immutable, party, shared, wrapped. |
| [Custom Transfer Rules](https://docs.sui.io/develop/objects/transfers/custom-rules) | The `key`-without-`store` pattern behind the Public Transfer row's framing. |
| [Transfer Policies](https://docs.sui.io/develop/objects/transfers/transfer-policies) | `TransferPolicy`/`TransferPolicyCap` fields and rules, behind the TransferPolicy/Kiosk cards. |
| [Transfer to Object](https://docs.sui.io/develop/objects/transfers/transfer-to-object) | Object-owned (child) semantics, behind the parent-object link. |
| [Simulating References](https://docs.sui.io/develop/objects/transfers/simulating-refs) | Confirms the `borrow` module is Move/PTB-only, not an inspector feature. |
| [Versioning](https://docs.sui.io/develop/objects/versioning) | The Lamport-timestamp version chain behind the version-history walk. |
| [Derived Objects](https://docs.sui.io/develop/objects/derived-objects) | The `derive_address` hash scheme behind the Derived Address Calculator. |
| [Accessing Data / Data Serving](https://docs.sui.io/concepts/data-access/data-serving) and [gRPC Overview](https://docs.sui.io/concepts/data-access/grpc-overview) | JSON-RPC deactivation July 31 2026; gRPC + GraphQL. |
| [Display V2: How Sui Objects Present Themselves](https://blog.sui.io/display-v2-mainnet/) | The Display standard behind the NFT preview + config-object card. |
| [Regulated Currency and Deny List](https://docs.sui.io/guides/developer/coin/regulated) | Still-planned regulated-coin/DenyList status. |
| [Address Balances Migration Guide](https://docs.sui.io/guides/developer/digital-assets/migrate-address-balances) | Still-planned accumulator balance view. |
| [2025 in Review: How the Sui Stack Came Together](https://blog.sui.io/2025-sui-stack-developments/) | Walrus, Seal, Nautilus GA. |
