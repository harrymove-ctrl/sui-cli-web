/**
 * Decodes the raw object envelope returned by `sui client objects --json` in
 * current CLI versions: `{ data: { Move: { type_, contents, ... } }, owner,
 * previous_transaction, storage_rebate }`. This shape carries no top-level
 * `objectId` and `type_` is a struct descriptor, not the flat
 * `"0x2::module::Type"` string the older JSON-RPC-derived shape used.
 *
 * Every Move object with the `key` ability has `id: UID` as its mandatory
 * first field (enforced by the Sui bytecode verifier), so the object's own ID
 * is always recoverable as the first 32 bytes of its BCS-encoded `contents`,
 * regardless of type - verified against a real GasCoin (40 raw bytes = 32-byte
 * UID + 8-byte u64 balance).
 */

type MoveTypeDescriptor =
  | string
  | { Coin: { struct: { address: string; module: string; name: string; type_args: unknown[] } } }
  | { Other: { address: string; module: string; name: string; type_args: unknown[] } };

export interface DecodedRawObject {
  objectId: string | null;
  /** Human-readable type, e.g. "0x2::sui::SUI" or "0x...::package::UpgradeCap" */
  type: string;
  version: number | null;
  owner: unknown;
  previousTransaction: string | null;
}

function bytesToObjectId(contents: unknown): string | null {
  if (!Array.isArray(contents) || contents.length < 32) return null;
  return '0x' + Buffer.from(contents.slice(0, 32)).toString('hex');
}

function formatStructType(struct: { address: string; module: string; name: string }): string {
  return `0x${struct.address}::${struct.module}::${struct.name}`;
}

export function decodeMoveType(type_: MoveTypeDescriptor | undefined): string {
  if (!type_) return 'Unknown';
  if (typeof type_ === 'string') {
    // The CLI's shorthand for the SUI gas coin - the real type is 0x2::sui::SUI
    return type_ === 'GasCoin' ? '0x2::sui::SUI' : type_;
  }
  if ('Coin' in type_) {
    return `0x2::coin::Coin<${formatStructType(type_.Coin.struct)}>`;
  }
  if ('Other' in type_) {
    return formatStructType(type_.Other);
  }
  return 'Unknown';
}

/** Accepts a single raw object envelope from `sui client objects --json`. */
export function decodeRawObject(raw: any): DecodedRawObject {
  const move = raw?.data?.Move;
  return {
    objectId: bytesToObjectId(move?.contents),
    type: decodeMoveType(move?.type_),
    version: typeof move?.version === 'number' ? move.version : null,
    owner: raw?.owner ?? null,
    previousTransaction: raw?.previous_transaction ?? null,
  };
}
