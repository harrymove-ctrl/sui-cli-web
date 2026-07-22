import { bcs } from '@mysten/sui/bcs';
import { deriveObjectID } from '@mysten/sui/utils';
import type { ApiResponse } from '@sui-cli-web/shared';
import { FastifyInstance } from 'fastify';
import { handleRouteError } from '../utils/errorHandler';
import { ValidationException, validateObjectId } from '../utils/validation';

export type DerivedObjectKeyType =
  | 'address'
  | 'bool'
  | 'u8'
  | 'u16'
  | 'u32'
  | 'u64'
  | 'u128'
  | 'u256'
  | 'string';

// Move type tags for each supported key type - address/u*/bool are primitives (their
// tag is just the bare word); `string` is Move's `std::string::String` struct, the
// only non-primitive kept in scope here to stay unambiguous about BCS encoding.
const KEY_TYPE_TAGS: Record<DerivedObjectKeyType, string> = {
  address: 'address',
  bool: 'bool',
  u8: 'u8',
  u16: 'u16',
  u32: 'u32',
  u64: 'u64',
  u128: 'u128',
  u256: 'u256',
  string: '0x1::string::String',
};

function encodeKey(keyType: DerivedObjectKeyType, value: string): Uint8Array {
  switch (keyType) {
    case 'address':
      return bcs.Address.serialize(value).toBytes();
    case 'bool':
      return bcs.Bool.serialize(value === 'true').toBytes();
    case 'u8':
      return bcs.U8.serialize(Number(value)).toBytes();
    case 'u16':
      return bcs.U16.serialize(Number(value)).toBytes();
    case 'u32':
      return bcs.U32.serialize(Number(value)).toBytes();
    case 'u64':
      return bcs.U64.serialize(value).toBytes();
    case 'u128':
      return bcs.U128.serialize(value).toBytes();
    case 'u256':
      return bcs.U256.serialize(value).toBytes();
    case 'string':
      return bcs.String.serialize(value).toBytes();
  }
}

/** Derived Address Calculator - https://docs.sui.io/develop/objects/derived-objects.
 * A derived object's address is deterministic from its parent id + key, computable
 * fully offchain; `@mysten/sui`'s `deriveObjectID` is the real, official implementation
 * of Sui's `derived_object::derive_address` hash scheme (not hand-rolled here). There's
 * no way to discover an *existing* derived object generically (its parent link only
 * proves uniqueness, per Sui's own docs), so this is a calculator, not an inspector. */
export async function derivedObjectsRoutes(fastify: FastifyInstance) {
  fastify.post<{
    Body: { parentId: string; keyType: DerivedObjectKeyType; keyValue: string };
    Reply: ApiResponse<{ address: string }>;
  }>('/derive', async (request, reply) => {
    try {
      const parentId = validateObjectId(request.body?.parentId, 'parentId');
      const keyType = request.body?.keyType;
      const keyValue = request.body?.keyValue;

      if (!keyType || !(keyType in KEY_TYPE_TAGS)) {
        throw new ValidationException([
          { field: 'keyType', message: `Must be one of: ${Object.keys(KEY_TYPE_TAGS).join(', ')}` },
        ]);
      }
      if (keyValue === undefined || keyValue === '') {
        throw new ValidationException([{ field: 'keyValue', message: 'keyValue is required' }]);
      }

      let keyBytes: Uint8Array;
      try {
        keyBytes = encodeKey(keyType, keyValue);
      } catch {
        throw new ValidationException([
          { field: 'keyValue', message: `Could not encode "${keyValue}" as ${keyType}` },
        ]);
      }

      const address = deriveObjectID(parentId, KEY_TYPE_TAGS[keyType], keyBytes);
      return { success: true, data: { address } };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });
}
