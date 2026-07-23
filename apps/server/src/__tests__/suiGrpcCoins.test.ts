/**
 * Tests for the gRPC coin listing that replaced suix_getAllCoins.
 *
 * The risk here is not "does it call the node" - it is the two translations
 * between what gRPC returns and what every consumer downstream expects:
 * the wrapper type `Coin<T>` has to become `T`, and addresses arrive padded to
 * 32 bytes while knownTokens and the SUI_COIN_TYPE constants use the short form
 * for system packages. Get either wrong and coins silently land in the wrong
 * group, or SUI stops matching as a known token.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const listOwnedObjects = vi.fn();

vi.mock('@mysten/sui/grpc', () => ({
  SuiGrpcClient: class {
    stateService = { listOwnedObjects };
  },
}));

import { getOwnedCoinsViaGrpc } from '../utils/suiGrpcClient';

const SUI_PADDED = '0x0000000000000000000000000000000000000000000000000000000000000002';
const DEEP_PKG = '0x36dbef866a1d62bf7328989a10fb2f07d769f4ee587c0de4a0a256e57e0a58a8';

function coinObject(overrides: Record<string, unknown> = {}) {
  return {
    objectId: '0xc01n',
    objectType: `${SUI_PADDED}::coin::Coin<${SUI_PADDED}::sui::SUI>`,
    balance: 5000000000n,
    version: 12345n,
    digest: 'DigestAAA',
    ...overrides,
  };
}

/** Each test gets its own RPC URL: the module caches one client per URL. */
let urlCounter = 0;
function freshUrl() {
  urlCounter += 1;
  return `https://fullnode-${urlCounter}.testnet.example:443`;
}

describe('getOwnedCoinsViaGrpc', () => {
  beforeEach(() => {
    listOwnedObjects.mockReset();
  });

  it('unwraps Coin<T> to the inner type and compacts the system address', async () => {
    listOwnedObjects.mockResolvedValueOnce({
      response: { objects: [coinObject()], nextPageToken: undefined },
    });

    const coins = await getOwnedCoinsViaGrpc('0xowner', freshUrl());

    expect(coins).toHaveLength(1);
    expect(coins[0].coinType).toBe('0x2::sui::SUI');
    expect(coins[0].coinObjectId).toBe('0xc01n');
    expect(coins[0].balance).toBe('5000000000');
    expect(coins[0].version).toBe('12345');
    expect(coins[0].digest).toBe('DigestAAA');
  });

  it('keeps a real package id at full length', async () => {
    listOwnedObjects.mockResolvedValueOnce({
      response: {
        objects: [coinObject({ objectType: `${SUI_PADDED}::coin::Coin<${DEEP_PKG}::deep::DEEP>` })],
        nextPageToken: undefined,
      },
    });

    const coins = await getOwnedCoinsViaGrpc('0xowner', freshUrl());

    expect(coins[0].coinType).toBe(`${DEEP_PKG}::deep::DEEP`);
  });

  it('asks the node for every Coin<T> in one filtered call', async () => {
    listOwnedObjects.mockResolvedValueOnce({
      response: { objects: [], nextPageToken: undefined },
    });

    await getOwnedCoinsViaGrpc('0xowner', freshUrl());

    const request = listOwnedObjects.mock.calls[0][0];
    // The bare type - with a type parameter the node would return only that one
    // coin type, turning this into one round trip per type.
    expect(request.objectType).toBe('0x2::coin::Coin');
    expect(request.owner).toBe('0xowner');
    expect(request.readMask.paths).toContain('balance');
  });

  it('follows pagination until the node stops handing back a token', async () => {
    listOwnedObjects
      .mockResolvedValueOnce({
        response: {
          objects: [coinObject({ objectId: '0xpage1' })],
          nextPageToken: new Uint8Array([1, 2, 3]),
        },
      })
      .mockResolvedValueOnce({
        response: {
          objects: [coinObject({ objectId: '0xpage2' })],
          nextPageToken: new Uint8Array(),
        },
      });

    const coins = await getOwnedCoinsViaGrpc('0xowner', freshUrl());

    expect(coins.map((c) => c.coinObjectId)).toEqual(['0xpage1', '0xpage2']);
    expect(listOwnedObjects).toHaveBeenCalledTimes(2);
    expect(listOwnedObjects.mock.calls[1][0].pageToken).toEqual(new Uint8Array([1, 2, 3]));
  });

  it('skips anything that is not a Coin<T>', async () => {
    listOwnedObjects.mockResolvedValueOnce({
      response: {
        objects: [
          coinObject(),
          coinObject({ objectId: '0xblob', objectType: `${DEEP_PKG}::blob::Blob` }),
          coinObject({ objectId: '0xnotype', objectType: undefined }),
        ],
        nextPageToken: undefined,
      },
    });

    const coins = await getOwnedCoinsViaGrpc('0xowner', freshUrl());

    expect(coins.map((c) => c.coinObjectId)).toEqual(['0xc01n']);
  });

  it('treats a missing balance as zero rather than throwing downstream', async () => {
    // The grouping code sums balances with BigInt(); undefined would throw
    // there and take the whole coin list down with it.
    listOwnedObjects.mockResolvedValueOnce({
      response: { objects: [coinObject({ balance: undefined })], nextPageToken: undefined },
    });

    const coins = await getOwnedCoinsViaGrpc('0xowner', freshUrl());

    expect(coins[0].balance).toBe('0');
    expect(() => BigInt(coins[0].balance)).not.toThrow();
  });
});
