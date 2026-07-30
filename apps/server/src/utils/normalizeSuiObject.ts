/**
 * `sui client object <id> --json` and `sui client objects --json` use
 * different field names entirely from the JSON-RPC/gRPC shapes the rest of
 * this codebase (and the web client) expect - `objType` instead of `type`,
 * `prevTx` instead of `previousTransaction`. It also always flattens a Move
 * struct's own fields directly onto `content` rather than nesting them under
 * `content.fields` the way RPC/gRPC do - confirmed for both `Coin<T>`
 * (`content: { balance, id }`) and `Display<T>` (`content: { fields, id,
 * version }`, where "fields" there is just Display's own Move field of that
 * name, not a wrapper around the others - `content.fields` never exists as a
 * generic "every field lives here" container in the CLI's own JSON). Every
 * key on `content` is therefore a genuine Move field and gets wrapped
 * verbatim, with no exclusions - there is no reliable way to tell "CLI
 * bookkeeping" apart from "a struct that really does have a field named
 * `version`" (Display is exactly that case), so keeping everything is the
 * only safe choice.
 *
 * Normalizing once here means the CLI fallback (only ever reached when
 * neither JSON-RPC nor gRPC succeeded - e.g. localnet with no reachable
 * endpoint) returns the same shape as every other source, instead of
 * silently rendering blank fields downstream.
 */
export function normalizeCliObjectShape(raw: Record<string, unknown>): Record<string, unknown> {
  const type = (raw.objType as string | undefined) ?? (raw.type as string | undefined) ?? null;
  const previousTransaction =
    (raw.prevTx as string | undefined) ?? (raw.previousTransaction as string | undefined) ?? null;

  const rawContent = raw.content as Record<string, unknown> | undefined;
  const content =
    rawContent && typeof rawContent === 'object' ? { dataType: 'moveObject', type, fields: rawContent } : null;

  return { ...raw, type, previousTransaction, content };
}
