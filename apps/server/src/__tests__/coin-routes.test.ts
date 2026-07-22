/**
 * API Route Validation Tests for Coin Split/Merge Endpoints
 *
 * Tests the HTTP API validation layer:
 * - Request validation
 * - Error handling
 * - Input sanitization
 */

import { describe, it, expect } from 'vitest';
import {
  validateAddress,
  validateObjectId,
  validateAmounts,
  validateCoinIds,
  validateOptionalGasBudget,
} from '../utils/validation';

// Test data
const VALID_COIN_ID = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
const VALID_ADDRESS = '0x02a212de6a9dfa3a69e22387acfbafbb1a9e591bd9d636e7895dcfc8de05f331';
const SUI_COIN_TYPE = '0x2::sui::SUI';

// Validate coin type format (from routes/coin.ts)
function validateCoinType(coinType: unknown, fieldName: string = 'coinType'): string {
  if (typeof coinType !== 'string' || !coinType) {
    throw new Error(`${fieldName} is required`);
  }
  if (!coinType.includes('::')) {
    throw new Error(`Invalid ${fieldName} format. Expected format: 0x...::module::TYPE`);
  }
  return coinType;
}

// ==========================================
// ADDRESS VALIDATION TESTS
// ==========================================
describe('Address Validation', () => {
  describe('validateAddress', () => {
    it('should accept valid Sui address (64 hex chars)', () => {
      expect(() => validateAddress(VALID_ADDRESS)).not.toThrow();
    });

    it('should accept address with 0x prefix', () => {
      const result = validateAddress(VALID_ADDRESS);
      expect(result).toBe(VALID_ADDRESS);
    });

    it('should reject address without 0x prefix', () => {
      const invalidAddr = '02a212de6a9dfa3a69e22387acfbafbb1a9e591bd9d636e7895dcfc8de05f331';
      expect(() => validateAddress(invalidAddr)).toThrow();
    });

    it('should accept and normalize short address', () => {
      // Sui addresses can be short and get normalized to 64 chars
      const shortAddr = '0x1234567890abcdef';
      const result = validateAddress(shortAddr);
      expect(result).toBeDefined();
      expect(result.startsWith('0x')).toBe(true);
    });

    it('should reject null address', () => {
      expect(() => validateAddress(null as any)).toThrow();
    });

    it('should reject undefined address', () => {
      expect(() => validateAddress(undefined as any)).toThrow();
    });

    it('should reject empty string', () => {
      expect(() => validateAddress('')).toThrow();
    });

    it('should reject non-hex characters', () => {
      const invalidAddr = '0xGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG';
      expect(() => validateAddress(invalidAddr)).toThrow();
    });
  });
});

// ==========================================
// OBJECT ID VALIDATION TESTS
// ==========================================
describe('Object ID Validation', () => {
  describe('validateObjectId', () => {
    it('should accept valid object ID (64 hex chars)', () => {
      expect(() => validateObjectId(VALID_COIN_ID, 'coinId')).not.toThrow();
    });

    it('should return the validated object ID', () => {
      const result = validateObjectId(VALID_COIN_ID, 'coinId');
      expect(result).toBe(VALID_COIN_ID);
    });

    it('should reject object ID without 0x prefix', () => {
      const invalidId = '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      expect(() => validateObjectId(invalidId, 'coinId')).toThrow();
    });

    it('should accept and normalize short object ID', () => {
      // Object IDs can be short and get normalized
      const shortId = '0x1234';
      const result = validateObjectId(shortId, 'coinId');
      expect(result).toBeDefined();
      expect(result.startsWith('0x')).toBe(true);
    });

    it('should include field name in error message', () => {
      try {
        validateObjectId('invalid', 'myCoinId');
      } catch (e: any) {
        expect(e.message).toContain('myCoinId');
      }
    });

    it('should reject null object ID', () => {
      expect(() => validateObjectId(null as any, 'coinId')).toThrow();
    });

    it('should reject undefined object ID', () => {
      expect(() => validateObjectId(undefined as any, 'coinId')).toThrow();
    });
  });
});

// ==========================================
// AMOUNTS VALIDATION TESTS
// ==========================================
describe('Amounts Validation', () => {
  describe('validateAmounts', () => {
    it('should accept array of valid amount strings', () => {
      expect(() => validateAmounts(['1000000000', '2000000000'])).not.toThrow();
    });

    it('should accept single amount', () => {
      const result = validateAmounts(['1000000000']);
      expect(result).toEqual(['1000000000']);
    });

    it('should accept large amounts', () => {
      const result = validateAmounts(['999999999999999999']);
      expect(result).toEqual(['999999999999999999']);
    });

    it('should reject empty array', () => {
      expect(() => validateAmounts([])).toThrow();
    });

    it('should reject null', () => {
      expect(() => validateAmounts(null as any)).toThrow();
    });

    it('should reject undefined', () => {
      expect(() => validateAmounts(undefined as any)).toThrow();
    });

    it('should reject non-array', () => {
      expect(() => validateAmounts('1000000000' as any)).toThrow();
    });

    it('should reject negative amounts', () => {
      expect(() => validateAmounts(['-1000000000'])).toThrow();
    });

    it('should reject non-numeric strings', () => {
      expect(() => validateAmounts(['abc'])).toThrow();
    });

    it('should reject mixed valid/invalid amounts', () => {
      expect(() => validateAmounts(['1000000000', 'invalid'])).toThrow();
    });

    it('should reject amounts with decimal points', () => {
      // Amounts should be in smallest unit (MIST), no decimals
      expect(() => validateAmounts(['1.5'])).toThrow();
    });

    it('should reject zero amount', () => {
      // Zero is not valid - amounts must be positive
      expect(() => validateAmounts(['0'])).toThrow();
    });
  });
});

// ==========================================
// COIN IDS VALIDATION TESTS
// ==========================================
describe('Coin IDs Validation', () => {
  describe('validateCoinIds', () => {
    it('should accept array of valid coin IDs', () => {
      const coinIds = [
        '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
      ];
      expect(() => validateCoinIds(coinIds, 'coinIdsToMerge')).not.toThrow();
    });

    it('should return validated coin IDs', () => {
      const coinIds = [VALID_COIN_ID];
      const result = validateCoinIds(coinIds, 'coinIdsToMerge');
      expect(result).toEqual(coinIds);
    });

    it('should reject empty array', () => {
      expect(() => validateCoinIds([], 'coinIdsToMerge')).toThrow();
    });

    it('should reject array with invalid coin ID', () => {
      const coinIds = [VALID_COIN_ID, 'invalid-id'];
      expect(() => validateCoinIds(coinIds, 'coinIdsToMerge')).toThrow();
    });

    it('should reject null', () => {
      expect(() => validateCoinIds(null as any, 'coinIdsToMerge')).toThrow();
    });

    it('should reject undefined', () => {
      expect(() => validateCoinIds(undefined as any, 'coinIdsToMerge')).toThrow();
    });

    it('should include field name in error', () => {
      try {
        validateCoinIds([], 'myCoins');
      } catch (e: any) {
        expect(e.message).toContain('myCoins');
      }
    });
  });
});

// ==========================================
// GAS BUDGET VALIDATION TESTS
// ==========================================
describe('Gas Budget Validation', () => {
  describe('validateOptionalGasBudget', () => {
    it('should accept valid gas budget string', () => {
      const result = validateOptionalGasBudget('50000000');
      expect(result).toBe('50000000');
    });

    it('should return undefined for undefined input', () => {
      const result = validateOptionalGasBudget(undefined);
      expect(result).toBeUndefined();
    });

    it('should return undefined for null input', () => {
      const result = validateOptionalGasBudget(null as any);
      expect(result).toBeUndefined();
    });

    it('should reject non-numeric gas budget', () => {
      expect(() => validateOptionalGasBudget('abc')).toThrow();
    });

    it('should reject negative gas budget', () => {
      expect(() => validateOptionalGasBudget('-1000')).toThrow();
    });

    it('should reject zero gas budget', () => {
      expect(() => validateOptionalGasBudget('0')).toThrow();
    });

    it('should accept gas budget up to 50 billion', () => {
      const result = validateOptionalGasBudget('50000000000'); // 50 billion
      expect(result).toBe('50000000000');
    });

    it('should reject gas budget over 50 billion', () => {
      expect(() => validateOptionalGasBudget('51000000000')).toThrow();
    });
  });
});

// ==========================================
// COIN TYPE VALIDATION TESTS
// ==========================================
describe('Coin Type Validation', () => {
  describe('validateCoinType', () => {
    it('should accept SUI coin type', () => {
      const result = validateCoinType(SUI_COIN_TYPE);
      expect(result).toBe(SUI_COIN_TYPE);
    });

    it('should accept custom coin type', () => {
      const customType = '0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN';
      const result = validateCoinType(customType);
      expect(result).toBe(customType);
    });

    it('should accept coin type with type parameters', () => {
      const genericType = '0x123::pool::LP<0x2::sui::SUI, 0x456::usdc::USDC>';
      const result = validateCoinType(genericType);
      expect(result).toBe(genericType);
    });

    it('should reject coin type without ::', () => {
      expect(() => validateCoinType('0x2sui')).toThrow();
    });

    it('should reject empty string', () => {
      expect(() => validateCoinType('')).toThrow();
    });

    it('should reject null', () => {
      expect(() => validateCoinType(null)).toThrow();
    });

    it('should reject undefined', () => {
      expect(() => validateCoinType(undefined)).toThrow();
    });

    it('should include field name in error', () => {
      try {
        validateCoinType('invalid', 'myCoinType');
      } catch (e: any) {
        expect(e.message).toContain('myCoinType');
      }
    });
  });
});

// ==========================================
// SPLIT REQUEST VALIDATION TESTS
// ==========================================
describe('Split Request Validation', () => {
  interface SplitRequest {
    coinId: string;
    coinType: string;
    amounts: string[];
    gasBudget?: string;
  }

  function validateSplitRequest(body: Partial<SplitRequest>) {
    const coinId = validateObjectId(body.coinId, 'coinId');
    const coinType = validateCoinType(body.coinType);
    const amounts = validateAmounts(body.amounts);
    const gasBudget = validateOptionalGasBudget(body.gasBudget);
    return { coinId, coinType, amounts, gasBudget };
  }

  it('should validate complete split request', () => {
    const request: SplitRequest = {
      coinId: VALID_COIN_ID,
      coinType: SUI_COIN_TYPE,
      amounts: ['1000000000', '2000000000'],
      gasBudget: '50000000',
    };

    const result = validateSplitRequest(request);
    expect(result.coinId).toBe(VALID_COIN_ID);
    expect(result.coinType).toBe(SUI_COIN_TYPE);
    expect(result.amounts).toEqual(['1000000000', '2000000000']);
    expect(result.gasBudget).toBe('50000000');
  });

  it('should return undefined gas budget when not provided', () => {
    const request = {
      coinId: VALID_COIN_ID,
      coinType: SUI_COIN_TYPE,
      amounts: ['1000000000'],
    };

    const result = validateSplitRequest(request);
    // Gas budget is optional - returns undefined when not provided
    // The service layer provides a default
    expect(result.gasBudget).toBeUndefined();
  });

  it('should throw on missing coinId', () => {
    const request = {
      coinType: SUI_COIN_TYPE,
      amounts: ['1000000000'],
    };

    expect(() => validateSplitRequest(request)).toThrow(/coinId/);
  });

  it('should throw on missing coinType', () => {
    const request = {
      coinId: VALID_COIN_ID,
      amounts: ['1000000000'],
    };

    expect(() => validateSplitRequest(request)).toThrow(/coinType/);
  });

  it('should throw on missing amounts', () => {
    const request = {
      coinId: VALID_COIN_ID,
      coinType: SUI_COIN_TYPE,
    };

    expect(() => validateSplitRequest(request)).toThrow();
  });
});

// ==========================================
// MERGE REQUEST VALIDATION TESTS
// ==========================================
describe('Merge Request Validation', () => {
  interface MergeRequest {
    primaryCoinId: string;
    coinIdsToMerge: string[];
    coinType: string;
    gasBudget?: string;
  }

  function validateMergeRequest(body: Partial<MergeRequest>) {
    const primaryCoinId = validateObjectId(body.primaryCoinId, 'primaryCoinId');
    const coinIdsToMerge = validateCoinIds(body.coinIdsToMerge, 'coinIdsToMerge');
    const coinType = validateCoinType(body.coinType);
    const gasBudget = validateOptionalGasBudget(body.gasBudget);
    return { primaryCoinId, coinIdsToMerge, coinType, gasBudget };
  }

  it('should validate complete merge request', () => {
    const secondCoinId = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
    const request: MergeRequest = {
      primaryCoinId: VALID_COIN_ID,
      coinIdsToMerge: [secondCoinId],
      coinType: SUI_COIN_TYPE,
      gasBudget: '50000000',
    };

    const result = validateMergeRequest(request);
    expect(result.primaryCoinId).toBe(VALID_COIN_ID);
    expect(result.coinIdsToMerge).toEqual([secondCoinId]);
    expect(result.coinType).toBe(SUI_COIN_TYPE);
  });

  it('should validate merge with multiple coins', () => {
    const coinIds = [
      '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
      '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',
    ];

    const request: MergeRequest = {
      primaryCoinId: VALID_COIN_ID,
      coinIdsToMerge: coinIds,
      coinType: SUI_COIN_TYPE,
    };

    const result = validateMergeRequest(request);
    expect(result.coinIdsToMerge.length).toBe(2);
  });

  it('should throw on empty coinIdsToMerge', () => {
    const request = {
      primaryCoinId: VALID_COIN_ID,
      coinIdsToMerge: [],
      coinType: SUI_COIN_TYPE,
    };

    expect(() => validateMergeRequest(request)).toThrow(/coinIdsToMerge/);
  });

  it('should throw on missing primaryCoinId', () => {
    const request = {
      coinIdsToMerge: [VALID_COIN_ID],
      coinType: SUI_COIN_TYPE,
    };

    expect(() => validateMergeRequest(request)).toThrow(/primaryCoinId/);
  });
});

// ==========================================
// TRANSFER REQUEST VALIDATION TESTS
// ==========================================
describe('Transfer Request Validation', () => {
  interface TransferRequest {
    coinId: string;
    coinType: string;
    to: string;
    amount: string;
    gasBudget?: string;
  }

  function validateTransferAmount(amount: unknown): string {
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      throw new Error('Amount must be a positive number');
    }
    return String(amount);
  }

  function validateTransferRequest(body: Partial<TransferRequest>) {
    const coinId = validateObjectId(body.coinId, 'coinId');
    const coinType = validateCoinType(body.coinType);
    const to = validateAddress(body.to, 'to');
    const amount = validateTransferAmount(body.amount);
    const gasBudget = validateOptionalGasBudget(body.gasBudget);
    return { coinId, coinType, to, amount, gasBudget };
  }

  it('should validate complete transfer request', () => {
    const request: TransferRequest = {
      coinId: VALID_COIN_ID,
      coinType: SUI_COIN_TYPE,
      to: VALID_ADDRESS,
      amount: '1000000000',
    };

    const result = validateTransferRequest(request);
    expect(result.to).toBe(VALID_ADDRESS);
    expect(result.amount).toBe('1000000000');
  });

  it('should throw on invalid recipient address', () => {
    const request = {
      coinId: VALID_COIN_ID,
      coinType: SUI_COIN_TYPE,
      to: 'invalid-address',
      amount: '1000000000',
    };

    expect(() => validateTransferRequest(request)).toThrow();
  });

  it('should throw on zero amount', () => {
    const request = {
      coinId: VALID_COIN_ID,
      coinType: SUI_COIN_TYPE,
      to: VALID_ADDRESS,
      amount: '0',
    };

    expect(() => validateTransferRequest(request)).toThrow(/positive/);
  });

  it('should throw on negative amount', () => {
    const request = {
      coinId: VALID_COIN_ID,
      coinType: SUI_COIN_TYPE,
      to: VALID_ADDRESS,
      amount: '-100',
    };

    expect(() => validateTransferRequest(request)).toThrow(/positive/);
  });

  it('should throw on non-numeric amount', () => {
    const request = {
      coinId: VALID_COIN_ID,
      coinType: SUI_COIN_TYPE,
      to: VALID_ADDRESS,
      amount: 'abc',
    };

    expect(() => validateTransferRequest(request)).toThrow(/positive/);
  });
});
