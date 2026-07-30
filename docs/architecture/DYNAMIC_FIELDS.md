# Dynamic Fields explorer — audit and redesign

Status: design, not implemented.
Scope: `/app/dynamic-fields` (`apps/web/src/components/DynamicFieldExplorer/`).

Source of truth for the concepts below: the Move Book chapters on
[dynamic fields](https://move-book.com/programmability/dynamic-fields/) and
[dynamic object fields](https://move-book.com/programmability/dynamic-object-fields/),
plus the Sui framework reference for
[`sui::dynamic_field`](https://docs.sui.io/references/framework/sui_sui/dynamic_field)
and [`sui::dynamic_object_field`](https://docs.sui.io/references/framework/sui_sui/dynamic_object_field).

---

## 0. The page is currently broken

Before any of the design below matters: **the explorer throws on every query.**

Querying `0x5` renders the error boundary with:

```
Something went wrong
r.slice is not a function
```

Cause — a response-shape mismatch between client and server:

| Layer | Shape |
|---|---|
| `getDynamicFields()` declares (`api/services/objects.ts:21`) | `{ objectId, data: any[], nextCursor, hasNextPage }` |
| Server actually returns (`GET /api/dynamic-fields/:id`) | `{ objectId, data: { dynamicFields: [...] } }` |

`DynamicFieldExplorer` does `setFields(result.data)` (`index.tsx:161`) and later
treats it as an array. `result.data` is an object, so the first array method
called on it throws.

The component's `DynamicField` interface is also stale. It expects the old
JSON-RPC shape:

```ts
{ name, bcsName, type, objectType, objectId, version, digest }
```

The live payload is the GraphQL shape:

```ts
{ kind, parent, fieldId, name, value, valueType,
  fieldObject: { objectId, version, digest, owner, objectType,
                 hasPublicTransfer, contents, previousTransaction,
                 storageRebate, bcs, json } }
```

**Fix before redesigning.** Everything in §2–§4 assumes a working list.

---

## 1. Concept coverage audit

Does the page currently convey the properties that make dynamic fields worth
having? Mostly no.

| Property | Covered today | Notes |
|---|---|---|
| **Heterogeneous storage** — one parent holds values of unrelated types | ✗ | Types are shown per row, never aggregated. Nothing conveys "this is the point". |
| **Arbitrary names** — any type with `copy + drop + store` | Partial | `parseFieldKey` renders the key, but nothing explains the constraint or lets you group by name type. |
| **Lazy loading** — fields cost gas only when accessed | ✗ | Never mentioned. This is *why* the pattern exists and the page is silent on it. |
| **DF vs DOF** — the central distinction | ✗ | **The data is already there and unread.** The API returns `kind: "FIELD" \| "OBJECT"`; the UI never reads it. `field.type` (`index.tsx:38`) is the *name* type, not the kind. |
| Field listing, key type/value, child object id/type | ✓ | Works (once §0 is fixed). |
| Cursor pagination (50/page) | ✓ | |
| Copy-for-AI export | ✓ | Would need `kind` added. |

### Why DF vs DOF is the one that matters

They are not interchangeable, and the difference is user-visible:

| | `dynamic_field` | `dynamic_object_field` |
|---|---|---|
| Value abilities | `store` | `key + store` |
| On-chain form | value **wrapped** in a `Field` object | child stays its **own** object |
| Findable by its own ID? | **No** — disappears from ID-based queries | **Yes** — visible in wallets/explorers |
| Cost | cheaper | dearer — stored as *two* objects (name field + value object) |

Consequence for this tool: a user looking at a DOF child can click through to it
in My Objects; a user looking at a DF child **cannot**, because that ID isn't
independently addressable. Today the UI renders both identically, so any
click-through it offers is broken half the time.

Name derivation is deterministic — `hash(parent.id || name || Name)` — which is
what makes a parent → child edge reconstructible offline.

### Caveats worth surfacing in the UI

- Dynamic fields **bypass the object size limit**; that's the point of the pattern.
- Max **1000 fields touched per transaction**.
- More expensive than regular struct fields.
- **Orphaned fields**: deleting the parent's `UID` does *not* delete attached
  fields. They become permanently inaccessible and their storage rebate is
  unrecoverable. This is a real footgun and belongs as a warning, not a footnote.

---

## 2. Redesign

Three views over one fetch. Nothing here needs a new RPC — everything is derivable
from the existing `dynamic-fields` payload except where flagged.

### 2.1 Header — composition at a glance

A summary strip answering "what is attached to this object?" before any table:

- **Total fields**, split **FIELD vs OBJECT** as a dither donut
  (`components/dither-kit/pie-chart`, same as the test-results donut).
  This is the heterogeneity and the DF/DOF split in one mark.
- **Distinct value types** count, with the top 3 named.
- **Distinct name (key) types** — usually 1; more than 1 is interesting and
  worth surfacing rather than hiding.
- Parent object id, its own type, and a link to it in My Objects.

Empty state must distinguish *"this object has no dynamic fields"* from
*"this object doesn't exist"* — currently both look the same.

### 2.2 Table — with the distinction made visible

Extend the existing `DataTable` rather than replacing it:

| Column | Source | Notes |
|---|---|---|
| Kind | `kind` | **New.** `FIELD` / `OBJECT` badge. The single highest-value addition. |
| Name type | `name.type` | Filterable (reuse the multi-select chips from My Objects). |
| Name value | `name.value` | |
| Value type | `valueType` / `fieldObject.objectType` | Filterable. |
| Child | `fieldObject.objectId` | Link through **only when `kind === 'OBJECT'`**; for `FIELD`, show the id but disable the link with a tooltip explaining it's wrapped and not independently addressable. |
| Version | `fieldObject.version` | |
| Storage rebate | `fieldObject.storageRebate` | Already in the payload, currently discarded. Feeds the orphan warning. |

Row expansion shows `fieldObject.json` (decoded contents) — the payload already
carries it.

### 2.3 Relationships — the graph

The thing a table cannot show: dynamic fields form a **tree**, and children can
themselves have children (a `Table` inside a `Bag` inside an object).

- Render parent → children as a node graph, `kind` distinguishing edge style
  (solid for `OBJECT`, dashed for wrapped `FIELD`).
- Lazy expansion: clicking a child with `kind === 'OBJECT'` fetches *its*
  dynamic fields and grows the graph. This mirrors on-chain lazy loading, which
  makes the mechanic legible through the interaction itself.
- Cap depth and node count, with an explicit "N more not shown" — never silently
  truncate.

### 2.4 Activity and history

Requires data the current endpoint does not return:

- `fieldObject.previousTransaction` **is** in the payload — enough to link each
  field to the tx that last touched it, for free.
- A real timeline (when fields were added/removed) needs either
  `queryTransactionBlocks` filtered by `ChangedObject`, or the GraphQL
  `object { dynamicFields }` history. **Not currently wired.** Treat as a second
  phase and mark it clearly as such rather than faking it.
- Cheap first step: sort by `version` descending as a proxy for recency, and say
  in the UI that it's a proxy.

---

## 3. Implementation order

1. **Fix the crash** (§0) — align `getDynamicFields`'s declared type and the
   component's interface with the GraphQL shape. Nothing else can be verified
   until this lands.
2. **Surface `kind`** — badge + conditional child link. Small change, removes a
   class of broken links, teaches the distinction.
3. **Header summary + donut** — reuses `dither-kit/pie-chart`.
4. **Filters** — reuse the multi-select chip pattern from My Objects.
5. **Graph** — largest piece; do after 1–4 are verified.
6. **History** — only after the tx-query dependency is decided.

## 4. Copy-for-AI

The page's context export should carry `kind` per field, the DF/DOF ability
rules, and the orphaned-field caveat — an LLM asked "why can't I find this
object by ID?" cannot answer correctly without knowing the value was wrapped.
Use `buildAiContext()` (`apps/web/src/lib/ai-context.ts`) and add
`GET /dynamic-fields/:id` to its endpoint table.
