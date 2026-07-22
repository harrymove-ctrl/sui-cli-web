/**
 * Derived Address Calculator - https://docs.sui.io/develop/objects/derived-objects
 * @module api/services/derivedObjects
 */

import { fetchApi } from '../core/request';

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

export async function deriveObjectAddress(
  parentId: string,
  keyType: DerivedObjectKeyType,
  keyValue: string
) {
  return fetchApi<{ address: string }>('/derived-objects/derive', {
    method: 'POST',
    body: JSON.stringify({ parentId, keyType, keyValue }),
  });
}
