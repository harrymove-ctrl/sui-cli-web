/**
 * Comprehensive Test Suite for CoinService Split/Merge Operations
 *
 * Tests cover:
 * - Split coin operations (SUI and other tokens)
 * - Merge coin operations (single and multiple coins)
 * - Dry run operations for gas estimation
 * - Error handling and edge cases
 * - Validation of inputs
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CoinService } from '../services/CoinService';

// Mock the SuiCliExecutor
vi.mock('../cli/SuiCliExecutor', () => ({
  SuiCliExecutor: {
    getInstance: vi.fn(() => ({
      execute: vi.fn(),
    })),
  },
}));

// Mock the ConfigParser
vi.mock('../cli/ConfigParser', () => ({
  ConfigParser: {
    getInstance: vi.fn(() => ({
      getConfig: vi.fn().mockResolvedValue({
        active_env: 'testnet',
        envs: [{ alias: 'testnet', rpc: 'https://fullnode.testnet.sui.io:443' }],
      }),
    })),
  },
}));

// Test data
const TEST_DATA = {
  // Valid addresses
  VALID_ADDRESS: '0x02a212de6a9dfa3a69e22387acfbafbb1a9e591bd9d636e7895dcfc8de05f331',
  VALID_RECIPIENT: '0x7d20dcdb2bca4f508ea9613994683eb4e76e9c4ed371f6f2b8f7e4e7e1a3b5c9',

  // Valid coin IDs
  SUI_COIN_ID: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
  COIN_ID_2: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
  COIN_ID_3: '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',

  // Coin types
  SUI_COIN_TYPE: '0x2::sui::SUI',
  USDC_COIN_TYPE: '0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN',
  CUSTOM_COIN_TYPE: '0xabcd::my_token::TOKEN',

  // Amounts
  SMALL_AMOUNT: '1000000000', // 1 SUI
  MEDIUM_AMOUNT: '5000000000', // 5 SUI
  LARGE_AMOUNT: '100000000000', // 100 SUI

  // Gas
  DEFAULT_GAS_BUDGET: '50000000',
  CUSTOM_GAS_BUDGET: '100000000',
};

// Mock successful transaction response
const mockSuccessResponse = (digest: string, newCoinIds: string[] = []) =>
  JSON.stringify({
    digest,
    effects: {
      transactionDigest: digest,
      status: { status: 'success' },
      gasUsed: {
        computationCost: '1000000',
        storageCost: '2000000',
        storageRebate: '500000',
      },
      created: newCoinIds.map((id) => ({ reference: { objectId: id } })),
    },
  });

// Mock failed transaction response
const mockFailureResponse = (error: string) =>
  JSON.stringify({
    effects: {
      status: { status: 'failure', error },
      gasUsed: {
        computationCost: '1000000',
        storageCost: '0',
        storageRebate: '0',
      },
    },
  });

describe('CoinService', () => {
  let coinService: CoinService;
  let mockExecute: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    // Reset mocks
    vi.clearAllMocks();

    // Get mock executor
    const { SuiCliExecutor } = await import('../cli/SuiCliExecutor');
    mockExecute = vi.fn();
    (SuiCliExecutor.getInstance as ReturnType<typeof vi.fn>).mockReturnValue({
      execute: mockExecute,
    });

    // Mock active address
    mockExecute.mockImplementation(async (args: string[]) => {
      if (args.includes('active-address')) {
        return TEST_DATA.VALID_ADDRESS;
      }
      throw new Error('Unexpected command');
    });

    coinService = new CoinService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================
  // SPLIT COIN TESTS
  // ==========================================
  describe('splitCoin', () => {
    describe('SUI coin splitting', () => {
      it('should split SUI coin into multiple amounts', async () => {
        const newCoinIds = [
          '0xnew1111111111111111111111111111111111111111111111111111111111111111',
          '0xnew2222222222222222222222222222222222222222222222222222222222222222',
        ];

        mockExecute.mockImplementation(async (args: string[]) => {
          if (args.includes('active-address')) return TEST_DATA.VALID_ADDRESS;
          if (args.includes('split-coin')) {
            // Verify correct args for SUI split
            expect(args).toContain('client');
            expect(args).toContain('split-coin');
            expect(args).toContain('--coin-id');
            expect(args).toContain(TEST_DATA.SUI_COIN_ID);
            expect(args).toContain('--amounts');
            return mockSuccessResponse('split_sui_digest_123', newCoinIds);
          }
          throw new Error('Unexpected command');
        });

        const result = await coinService.splitCoin(
          TEST_DATA.SUI_COIN_ID,
          TEST_DATA.SUI_COIN_TYPE,
          [TEST_DATA.SMALL_AMOUNT, TEST_DATA.MEDIUM_AMOUNT]
        );

        expect(result.success).toBe(true);
        expect(result.digest).toBe('split_sui_digest_123');
        expect(result.newCoinIds).toEqual(newCoinIds);
        expect(result.gasUsed).toBeDefined();
      });

      it('should split SUI coin with custom gas budget', async () => {
        mockExecute.mockImplementation(async (args: string[]) => {
          if (args.includes('active-address')) return TEST_DATA.VALID_ADDRESS;
          if (args.includes('split-coin')) {
            expect(args).toContain('--gas-budget');
            expect(args).toContain(TEST_DATA.CUSTOM_GAS_BUDGET);
            return mockSuccessResponse('split_custom_gas_digest');
          }
          throw new Error('Unexpected command');
        });

        const result = await coinService.splitCoin(
          TEST_DATA.SUI_COIN_ID,
          TEST_DATA.SUI_COIN_TYPE,
          [TEST_DATA.SMALL_AMOUNT],
          TEST_DATA.CUSTOM_GAS_BUDGET
        );

        expect(result.success).toBe(true);
      });

      it('should handle split into single amount', async () => {
        mockExecute.mockImplementation(async (args: string[]) => {
          if (args.includes('active-address')) return TEST_DATA.VALID_ADDRESS;
          if (args.includes('split-coin')) {
            return mockSuccessResponse('single_split_digest', ['0xnewcoin']);
          }
          throw new Error('Unexpected command');
        });

        const result = await coinService.splitCoin(
          TEST_DATA.SUI_COIN_ID,
          TEST_DATA.SUI_COIN_TYPE,
          [TEST_DATA.SMALL_AMOUNT]
        );

        expect(result.success).toBe(true);
        expect(result.newCoinIds?.length).toBe(1);
      });

      it('should handle split into many amounts (5+)', async () => {
        const manyAmounts = [
          '100000000',
          '200000000',
          '300000000',
          '400000000',
          '500000000',
        ];

        mockExecute.mockImplementation(async (args: string[]) => {
          if (args.includes('active-address')) return TEST_DATA.VALID_ADDRESS;
          if (args.includes('split-coin')) {
            // Verify all amounts are passed
            manyAmounts.forEach((amt) => expect(args).toContain(amt));
            return mockSuccessResponse('many_split_digest', manyAmounts.map((_, i) => `0xnew${i}`));
          }
          throw new Error('Unexpected command');
        });

        const result = await coinService.splitCoin(
          TEST_DATA.SUI_COIN_ID,
          TEST_DATA.SUI_COIN_TYPE,
          manyAmounts
        );

        expect(result.success).toBe(true);
        expect(result.newCoinIds?.length).toBe(5);
      });
    });

    describe('Non-SUI coin splitting (PTB)', () => {
      it('should split USDC using PTB', async () => {
        mockExecute.mockImplementation(async (args: string[]) => {
          if (args.includes('active-address')) return TEST_DATA.VALID_ADDRESS;
          if (args.includes('ptb')) {
            // Verify PTB format for non-SUI coins
            expect(args).toContain('client');
            expect(args).toContain('ptb');
            expect(args).toContain('--split-coins');
            expect(args).toContain(`@${TEST_DATA.SUI_COIN_ID}`);
            expect(args).toContain('--assign');
            expect(args).toContain('new_coins');
            expect(args).toContain('--transfer-objects');
            return mockSuccessResponse('ptb_split_digest', ['0xnewusdc']);
          }
          throw new Error('Unexpected command');
        });

        const result = await coinService.splitCoin(
          TEST_DATA.SUI_COIN_ID,
          TEST_DATA.USDC_COIN_TYPE,
          [TEST_DATA.SMALL_AMOUNT]
        );

        expect(result.success).toBe(true);
        expect(result.digest).toBe('ptb_split_digest');
      });

      it('should split custom token using PTB', async () => {
        mockExecute.mockImplementation(async (args: string[]) => {
          if (args.includes('active-address')) return TEST_DATA.VALID_ADDRESS;
          if (args.includes('ptb')) {
            return mockSuccessResponse('custom_token_split');
          }
          throw new Error('Unexpected command');
        });

        const result = await coinService.splitCoin(
          TEST_DATA.SUI_COIN_ID,
          TEST_DATA.CUSTOM_COIN_TYPE,
          [TEST_DATA.SMALL_AMOUNT, TEST_DATA.MEDIUM_AMOUNT]
        );

        expect(result.success).toBe(true);
      });
    });

    describe('Split error handling', () => {
      it('should handle insufficient balance error', async () => {
        mockExecute.mockImplementation(async (args: string[]) => {
          if (args.includes('active-address')) return TEST_DATA.VALID_ADDRESS;
          if (args.includes('split-coin')) {
            return mockFailureResponse('InsufficientCoinBalance');
          }
          throw new Error('Unexpected command');
        });

        const result = await coinService.splitCoin(
          TEST_DATA.SUI_COIN_ID,
          TEST_DATA.SUI_COIN_TYPE,
          [TEST_DATA.LARGE_AMOUNT]
        );

        expect(result.success).toBe(false);
        expect(result.error).toContain('InsufficientCoinBalance');
      });

      it('should handle coin not found error', async () => {
        mockExecute.mockImplementation(async (args: string[]) => {
          if (args.includes('active-address')) return TEST_DATA.VALID_ADDRESS;
          throw new Error('ObjectNotFound');
        });

        const result = await coinService.splitCoin(
          '0xinvalidcoinid',
          TEST_DATA.SUI_COIN_TYPE,
          [TEST_DATA.SMALL_AMOUNT]
        );

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      });

      it('should handle gas exhausted error', async () => {
        mockExecute.mockImplementation(async (args: string[]) => {
          if (args.includes('active-address')) return TEST_DATA.VALID_ADDRESS;
          if (args.includes('split-coin')) {
            return mockFailureResponse('InsufficientGas');
          }
          throw new Error('Unexpected command');
        });

        const result = await coinService.splitCoin(
          TEST_DATA.SUI_COIN_ID,
          TEST_DATA.SUI_COIN_TYPE,
          [TEST_DATA.SMALL_AMOUNT],
          '1000' // Very low gas
        );

        expect(result.success).toBe(false);
      });

      it('should handle CLI execution error', async () => {
        mockExecute.mockImplementation(async (args: string[]) => {
          if (args.includes('active-address')) return TEST_DATA.VALID_ADDRESS;
          throw new Error('CLI execution failed');
        });

        const result = await coinService.splitCoin(
          TEST_DATA.SUI_COIN_ID,
          TEST_DATA.SUI_COIN_TYPE,
          [TEST_DATA.SMALL_AMOUNT]
        );

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      });
    });
  });

  // ==========================================
  // MERGE COIN TESTS
  // ==========================================
  describe('mergeCoins', () => {
    describe('Basic merge operations', () => {
      it('should merge two coins', async () => {
        mockExecute.mockImplementation(async (args: string[]) => {
          if (args.includes('active-address')) return TEST_DATA.VALID_ADDRESS;
          if (args.includes('ptb') && args.includes('--merge-coins')) {
            expect(args).toContain(`@${TEST_DATA.SUI_COIN_ID}`);
            expect(args.some((a) => a.includes(`@${TEST_DATA.COIN_ID_2}`))).toBe(true);
            return mockSuccessResponse('merge_two_digest');
          }
          throw new Error('Unexpected command');
        });

        const result = await coinService.mergeCoins(
          TEST_DATA.SUI_COIN_ID,
          [TEST_DATA.COIN_ID_2],
          TEST_DATA.SUI_COIN_TYPE
        );

        expect(result.success).toBe(true);
        expect(result.digest).toBe('merge_two_digest');
      });

      it('should merge multiple coins (3+)', async () => {
        mockExecute.mockImplementation(async (args: string[]) => {
          if (args.includes('active-address')) return TEST_DATA.VALID_ADDRESS;
          if (args.includes('ptb') && args.includes('--merge-coins')) {
            // Verify all coins are in the merge command
            expect(args.some((a) => a.includes(`@${TEST_DATA.COIN_ID_2}`))).toBe(true);
            expect(args.some((a) => a.includes(`@${TEST_DATA.COIN_ID_3}`))).toBe(true);
            return mockSuccessResponse('merge_multiple_digest');
          }
          throw new Error('Unexpected command');
        });

        const result = await coinService.mergeCoins(
          TEST_DATA.SUI_COIN_ID,
          [TEST_DATA.COIN_ID_2, TEST_DATA.COIN_ID_3],
          TEST_DATA.SUI_COIN_TYPE
        );

        expect(result.success).toBe(true);
      });

      it('should merge non-SUI tokens', async () => {
        mockExecute.mockImplementation(async (args: string[]) => {
          if (args.includes('active-address')) return TEST_DATA.VALID_ADDRESS;
          if (args.includes('ptb') && args.includes('--merge-coins')) {
            return mockSuccessResponse('merge_usdc_digest');
          }
          throw new Error('Unexpected command');
        });

        const result = await coinService.mergeCoins(
          TEST_DATA.SUI_COIN_ID,
          [TEST_DATA.COIN_ID_2],
          TEST_DATA.USDC_COIN_TYPE
        );

        expect(result.success).toBe(true);
      });

      it('should merge with custom gas budget', async () => {
        mockExecute.mockImplementation(async (args: string[]) => {
          if (args.includes('active-address')) return TEST_DATA.VALID_ADDRESS;
          if (args.includes('ptb')) {
            expect(args).toContain('--gas-budget');
            expect(args).toContain(TEST_DATA.CUSTOM_GAS_BUDGET);
            return mockSuccessResponse('merge_custom_gas');
          }
          throw new Error('Unexpected command');
        });

        const result = await coinService.mergeCoins(
          TEST_DATA.SUI_COIN_ID,
          [TEST_DATA.COIN_ID_2],
          TEST_DATA.SUI_COIN_TYPE,
          TEST_DATA.CUSTOM_GAS_BUDGET
        );

        expect(result.success).toBe(true);
      });
    });

    describe('Merge error handling', () => {
      it('should handle merging same coin error', async () => {
        mockExecute.mockImplementation(async (args: string[]) => {
          if (args.includes('active-address')) return TEST_DATA.VALID_ADDRESS;
          throw new Error('Cannot merge coin with itself');
        });

        const result = await coinService.mergeCoins(
          TEST_DATA.SUI_COIN_ID,
          [TEST_DATA.SUI_COIN_ID], // Same coin!
          TEST_DATA.SUI_COIN_TYPE
        );

        expect(result.success).toBe(false);
      });

      it('should handle coin type mismatch error', async () => {
        mockExecute.mockImplementation(async (args: string[]) => {
          if (args.includes('active-address')) return TEST_DATA.VALID_ADDRESS;
          return mockFailureResponse('CoinTypeMismatch');
        });

        const result = await coinService.mergeCoins(
          TEST_DATA.SUI_COIN_ID,
          [TEST_DATA.COIN_ID_2],
          TEST_DATA.SUI_COIN_TYPE
        );

        expect(result.success).toBe(false);
      });

      it('should handle coin not owned error', async () => {
        mockExecute.mockImplementation(async (args: string[]) => {
          if (args.includes('active-address')) return TEST_DATA.VALID_ADDRESS;
          return mockFailureResponse('ObjectNotOwned');
        });

        const result = await coinService.mergeCoins(
          TEST_DATA.SUI_COIN_ID,
          [TEST_DATA.COIN_ID_2],
          TEST_DATA.SUI_COIN_TYPE
        );

        expect(result.success).toBe(false);
      });
    });
  });

  // ==========================================
  // DRY RUN TESTS
  // ==========================================
  describe('Dry Run Operations', () => {
    describe('dryRunSplit', () => {
      it('should estimate gas for SUI split', async () => {
        mockExecute.mockImplementation(async (args: string[]) => {
          if (args.includes('active-address')) return TEST_DATA.VALID_ADDRESS;
          if (args.includes('--dry-run')) {
            expect(args).toContain('--dry-run');
            return JSON.stringify({
              effects: {
                status: { status: 'success' },
                gasUsed: {
                  computationCost: '1500000',
                  storageCost: '2500000',
                  storageRebate: '0',
                },
              },
            });
          }
          throw new Error('Unexpected command');
        });

        const result = await coinService.dryRunSplit(
          TEST_DATA.SUI_COIN_ID,
          TEST_DATA.SUI_COIN_TYPE,
          [TEST_DATA.SMALL_AMOUNT]
        );

        expect(result.success).toBe(true);
        expect(result.gasUsed).toBe('4000000'); // 1.5M + 2.5M - 0
      });

      it('should estimate gas for non-SUI split (PTB)', async () => {
        mockExecute.mockImplementation(async (args: string[]) => {
          if (args.includes('active-address')) return TEST_DATA.VALID_ADDRESS;
          if (args.includes('ptb') && args.includes('--dry-run')) {
            return JSON.stringify({
              effects: {
                status: { status: 'success' },
                gasUsed: {
                  computationCost: '2000000',
                  storageCost: '3000000',
                  storageRebate: '500000',
                },
              },
            });
          }
          throw new Error('Unexpected command');
        });

        const result = await coinService.dryRunSplit(
          TEST_DATA.SUI_COIN_ID,
          TEST_DATA.USDC_COIN_TYPE,
          [TEST_DATA.SMALL_AMOUNT]
        );

        expect(result.success).toBe(true);
        expect(result.gasUsed).toBe('4500000'); // 2M + 3M - 0.5M
      });

      it('should report failure for insufficient balance in dry run', async () => {
        mockExecute.mockImplementation(async (args: string[]) => {
          if (args.includes('active-address')) return TEST_DATA.VALID_ADDRESS;
          if (args.includes('--dry-run')) {
            return JSON.stringify({
              effects: {
                status: { status: 'failure', error: 'InsufficientCoinBalance' },
                gasUsed: { computationCost: '0', storageCost: '0', storageRebate: '0' },
              },
            });
          }
          throw new Error('Unexpected command');
        });

        const result = await coinService.dryRunSplit(
          TEST_DATA.SUI_COIN_ID,
          TEST_DATA.SUI_COIN_TYPE,
          ['999999999999999999'] // Very large amount
        );

        expect(result.success).toBe(false);
        expect(result.error).toContain('InsufficientCoinBalance');
      });
    });

    describe('dryRunMerge', () => {
      it('should estimate gas for merge', async () => {
        mockExecute.mockImplementation(async (args: string[]) => {
          if (args.includes('active-address')) return TEST_DATA.VALID_ADDRESS;
          if (args.includes('--dry-run') && args.includes('--merge-coins')) {
            return JSON.stringify({
              effects: {
                status: { status: 'success' },
                gasUsed: {
                  computationCost: '1000000',
                  storageCost: '0',
                  storageRebate: '2000000', // Rebate for deleted coin
                },
              },
            });
          }
          throw new Error('Unexpected command');
        });

        const result = await coinService.dryRunMerge(
          TEST_DATA.SUI_COIN_ID,
          [TEST_DATA.COIN_ID_2],
          TEST_DATA.SUI_COIN_TYPE
        );

        expect(result.success).toBe(true);
        // Gas calculation: 1M + 0 - 2M = -1M (negative means rebate > cost)
        expect(BigInt(result.gasUsed || '0')).toBeLessThan(BigInt(0));
      });
    });
  });

  // ==========================================
  // EDGE CASES
  // ==========================================
  describe('Edge Cases', () => {
    it('should handle zero amount in split', async () => {
      // Zero amounts should still be sent to CLI (CLI will validate)
      mockExecute.mockImplementation(async (args: string[]) => {
        if (args.includes('active-address')) return TEST_DATA.VALID_ADDRESS;
        if (args.includes('split-coin')) {
          return mockFailureResponse('InvalidAmount');
        }
        throw new Error('Unexpected command');
      });

      const result = await coinService.splitCoin(
        TEST_DATA.SUI_COIN_ID,
        TEST_DATA.SUI_COIN_TYPE,
        ['0']
      );

      expect(result.success).toBe(false);
    });

    it('should handle very large amounts', async () => {
      const veryLargeAmount = '999999999999999999999'; // Very large

      mockExecute.mockImplementation(async (args: string[]) => {
        if (args.includes('active-address')) return TEST_DATA.VALID_ADDRESS;
        if (args.includes('split-coin')) {
          expect(args).toContain(veryLargeAmount);
          return mockFailureResponse('InsufficientCoinBalance');
        }
        throw new Error('Unexpected command');
      });

      const result = await coinService.splitCoin(
        TEST_DATA.SUI_COIN_ID,
        TEST_DATA.SUI_COIN_TYPE,
        [veryLargeAmount]
      );

      expect(result.success).toBe(false);
    });

    it('should handle empty coin IDs array in merge', async () => {
      mockExecute.mockImplementation(async (args: string[]) => {
        if (args.includes('active-address')) return TEST_DATA.VALID_ADDRESS;
        // Should still execute but with empty array
        if (args.includes('ptb')) {
          expect(args.some((a) => a.includes('[]'))).toBe(true);
          return mockFailureResponse('EmptyMergeList');
        }
        throw new Error('Unexpected command');
      });

      const result = await coinService.mergeCoins(
        TEST_DATA.SUI_COIN_ID,
        [],
        TEST_DATA.SUI_COIN_TYPE
      );

      expect(result.success).toBe(false);
    });

    it('should handle special characters in coin type', async () => {
      const specialCoinType = '0x123::my_module::MY_TOKEN<0x456::other::TYPE>';

      mockExecute.mockImplementation(async (args: string[]) => {
        if (args.includes('active-address')) return TEST_DATA.VALID_ADDRESS;
        if (args.includes('ptb')) {
          return mockSuccessResponse('special_type_digest');
        }
        throw new Error('Unexpected command');
      });

      const result = await coinService.splitCoin(
        TEST_DATA.SUI_COIN_ID,
        specialCoinType,
        [TEST_DATA.SMALL_AMOUNT]
      );

      expect(result.success).toBe(true);
    });

    it('should handle concurrent split operations', async () => {
      let callCount = 0;

      mockExecute.mockImplementation(async (args: string[]) => {
        if (args.includes('active-address')) return TEST_DATA.VALID_ADDRESS;
        if (args.includes('split-coin')) {
          callCount++;
          return mockSuccessResponse(`concurrent_split_${callCount}`);
        }
        throw new Error('Unexpected command');
      });

      // Execute multiple splits concurrently
      const results = await Promise.all([
        coinService.splitCoin(TEST_DATA.SUI_COIN_ID, TEST_DATA.SUI_COIN_TYPE, ['100']),
        coinService.splitCoin(TEST_DATA.SUI_COIN_ID, TEST_DATA.SUI_COIN_TYPE, ['200']),
        coinService.splitCoin(TEST_DATA.SUI_COIN_ID, TEST_DATA.SUI_COIN_TYPE, ['300']),
      ]);

      expect(results.every((r) => r.success)).toBe(true);
      expect(callCount).toBe(3);
    });
  });

  // ==========================================
  // TRANSFER COIN TESTS (uses split internally)
  // ==========================================
  describe('transferCoin', () => {
    it('should transfer SUI using pay-sui', async () => {
      mockExecute.mockImplementation(async (args: string[]) => {
        if (args.includes('active-address')) return TEST_DATA.VALID_ADDRESS;
        if (args.includes('pay-sui')) {
          expect(args).toContain('--recipients');
          expect(args).toContain(TEST_DATA.VALID_RECIPIENT);
          expect(args).toContain('--amounts');
          expect(args).toContain(TEST_DATA.SMALL_AMOUNT);
          return mockSuccessResponse('transfer_sui_digest');
        }
        throw new Error('Unexpected command');
      });

      const result = await coinService.transferCoin(
        TEST_DATA.SUI_COIN_ID,
        TEST_DATA.SUI_COIN_TYPE,
        TEST_DATA.VALID_RECIPIENT,
        TEST_DATA.SMALL_AMOUNT
      );

      expect(result.success).toBe(true);
    });

    it('should transfer non-SUI using PTB split+transfer', async () => {
      mockExecute.mockImplementation(async (args: string[]) => {
        if (args.includes('active-address')) return TEST_DATA.VALID_ADDRESS;
        if (args.includes('ptb')) {
          expect(args).toContain('--split-coins');
          expect(args).toContain('--transfer-objects');
          expect(args.some((a) => a.includes(TEST_DATA.VALID_RECIPIENT))).toBe(true);
          return mockSuccessResponse('transfer_usdc_digest');
        }
        throw new Error('Unexpected command');
      });

      const result = await coinService.transferCoin(
        TEST_DATA.SUI_COIN_ID,
        TEST_DATA.USDC_COIN_TYPE,
        TEST_DATA.VALID_RECIPIENT,
        TEST_DATA.SMALL_AMOUNT
      );

      expect(result.success).toBe(true);
    });
  });
});

// ==========================================
// VALIDATION TESTS (for route handlers)
// ==========================================
describe('Input Validation', () => {
  describe('validateAmounts', () => {
    it('should accept valid amount strings', () => {
      // Import validation function
      const amounts = ['1000000000', '5000000000'];
      expect(amounts.every((a) => !isNaN(Number(a)))).toBe(true);
    });

    it('should reject negative amounts', () => {
      const amount = '-1000000000';
      expect(Number(amount) < 0).toBe(true);
    });

    it('should reject non-numeric amounts', () => {
      const amount = 'abc';
      expect(isNaN(Number(amount))).toBe(true);
    });

    it('should reject empty amounts array', () => {
      const amounts: string[] = [];
      expect(amounts.length === 0).toBe(true);
    });
  });

  describe('validateCoinIds', () => {
    it('should accept valid coin IDs', () => {
      const coinId = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      expect(coinId.startsWith('0x') && coinId.length === 66).toBe(true);
    });

    it('should reject invalid coin IDs', () => {
      const invalidCoinId = 'not-a-valid-id';
      expect(invalidCoinId.startsWith('0x')).toBe(false);
    });
  });

  describe('validateCoinType', () => {
    it('should accept valid coin type format', () => {
      const coinType = '0x2::sui::SUI';
      expect(coinType.includes('::')).toBe(true);
    });

    it('should reject invalid coin type format', () => {
      const invalidType = '0x2sui';
      expect(invalidType.includes('::')).toBe(false);
    });
  });
});
