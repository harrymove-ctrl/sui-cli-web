import { FastifyInstance } from 'fastify';
import { CoinService } from '../services/CoinService';
import type {
  ApiResponse,
  CoinGroupedResponse,
  CoinInfo,
  CoinMetadata,
  CoinOperationResult,
} from '@sui-cli-web/shared';
import {
  validateAddress,
  validateObjectId,
  validateAmounts,
  validateCoinIds,
  validateOptionalGasBudget,
} from '../utils/validation';
import { handleRouteError } from '../utils/errorHandler';

const coinService = new CoinService();
const handleError = handleRouteError;

// Validate coin type format (basic check)
function validateCoinType(coinType: unknown, fieldName: string = 'coinType'): string {
  if (typeof coinType !== 'string' || !coinType) {
    throw new Error(`${fieldName} is required`);
  }
  // Basic validation: should contain ::
  if (!coinType.includes('::')) {
    throw new Error(`Invalid ${fieldName} format. Expected format: 0x...::module::TYPE`);
  }
  return coinType;
}

export async function coinRoutes(fastify: FastifyInstance) {
  // Get all coins grouped by type for an address
  fastify.get<{
    Params: { address: string };
    Reply: ApiResponse<CoinGroupedResponse>;
  }>('/coins/:address', async (request, reply) => {
    try {
      const address = validateAddress(request.params.address);
      const result = await coinService.getCoinsGrouped(address);
      return { success: true, data: result };
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // Get coins of a specific type for an address
  fastify.get<{
    Params: { address: string };
    Querystring: { type: string };
    Reply: ApiResponse<CoinInfo[]>;
  }>('/coins/:address/by-type', async (request, reply) => {
    try {
      const address = validateAddress(request.params.address);
      const coinType = validateCoinType(request.query.type);
      const coins = await coinService.getCoinsByType(address, coinType);
      return { success: true, data: coins };
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // Get coin metadata
  fastify.get<{
    Querystring: { type: string };
    Reply: ApiResponse<CoinMetadata | null>;
  }>('/coins/metadata', async (request, reply) => {
    try {
      const coinType = validateCoinType(request.query.type);
      const metadata = await coinService.getCoinMetadata(coinType);
      return { success: true, data: metadata };
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // Split a coin (works for any coin type)
  fastify.post<{
    Body: {
      coinId: string;
      coinType: string;
      amounts: string[];
      gasBudget?: string;
    };
    Reply: ApiResponse<CoinOperationResult>;
  }>('/coins/split', async (request, reply) => {
    try {
      const coinId = validateObjectId(request.body?.coinId, 'coinId');
      const coinType = validateCoinType(request.body?.coinType);
      const amounts = validateAmounts(request.body?.amounts);
      const gasBudget = validateOptionalGasBudget(request.body?.gasBudget);

      const result = await coinService.splitCoin(coinId, coinType, amounts, gasBudget);
      return { success: true, data: result };
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // Dry run split
  fastify.post<{
    Body: {
      coinId: string;
      coinType: string;
      amounts: string[];
      gasBudget?: string;
    };
    Reply: ApiResponse<CoinOperationResult>;
  }>('/coins/split/dry-run', async (request, reply) => {
    try {
      const coinId = validateObjectId(request.body?.coinId, 'coinId');
      const coinType = validateCoinType(request.body?.coinType);
      const amounts = validateAmounts(request.body?.amounts);
      const gasBudget = validateOptionalGasBudget(request.body?.gasBudget);

      const result = await coinService.dryRunSplit(coinId, coinType, amounts, gasBudget);
      return { success: true, data: result };
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // Merge coins (works for any coin type)
  fastify.post<{
    Body: {
      primaryCoinId: string;
      coinIdsToMerge: string[];
      coinType: string;
      gasBudget?: string;
    };
    Reply: ApiResponse<CoinOperationResult>;
  }>('/coins/merge', async (request, reply) => {
    try {
      const primaryCoinId = validateObjectId(request.body?.primaryCoinId, 'primaryCoinId');
      const coinIdsToMerge = validateCoinIds(request.body?.coinIdsToMerge, 'coinIdsToMerge');
      const coinType = validateCoinType(request.body?.coinType);
      const gasBudget = validateOptionalGasBudget(request.body?.gasBudget);

      const result = await coinService.mergeCoins(primaryCoinId, coinIdsToMerge, coinType, gasBudget);
      return { success: true, data: result };
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // Dry run merge
  fastify.post<{
    Body: {
      primaryCoinId: string;
      coinIdsToMerge: string[];
      coinType: string;
      gasBudget?: string;
    };
    Reply: ApiResponse<CoinOperationResult>;
  }>('/coins/merge/dry-run', async (request, reply) => {
    try {
      const primaryCoinId = validateObjectId(request.body?.primaryCoinId, 'primaryCoinId');
      const coinIdsToMerge = validateCoinIds(request.body?.coinIdsToMerge, 'coinIdsToMerge');
      const coinType = validateCoinType(request.body?.coinType);
      const gasBudget = validateOptionalGasBudget(request.body?.gasBudget);

      const result = await coinService.dryRunMerge(primaryCoinId, coinIdsToMerge, coinType, gasBudget);
      return { success: true, data: result };
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // Transfer a coin (works for any coin type)
  fastify.post<{
    Body: {
      coinId: string;
      coinType: string;
      to: string;
      amount: string;
      gasBudget?: string;
    };
    Reply: ApiResponse<CoinOperationResult>;
  }>('/coins/transfer', async (request, reply) => {
    try {
      const coinId = validateObjectId(request.body?.coinId, 'coinId');
      const coinType = validateCoinType(request.body?.coinType);
      const to = validateAddress(request.body?.to, 'to');
      const amount = request.body?.amount;
      const gasBudget = validateOptionalGasBudget(request.body?.gasBudget);

      // Validate amount
      if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
        reply.status(400);
        return { success: false, error: 'Amount must be a positive number' };
      }

      const result = await coinService.transferCoin(coinId, coinType, to, amount, gasBudget);
      return { success: true, data: result };
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // Dry run transfer coin
  fastify.post<{
    Body: {
      coinId: string;
      coinType: string;
      to: string;
      amount: string;
      gasBudget?: string;
    };
    Reply: ApiResponse<CoinOperationResult>;
  }>('/coins/transfer/dry-run', async (request, reply) => {
    try {
      const coinId = validateObjectId(request.body?.coinId, 'coinId');
      const coinType = validateCoinType(request.body?.coinType);
      const to = validateAddress(request.body?.to, 'to');
      const amount = request.body?.amount;
      const gasBudget = validateOptionalGasBudget(request.body?.gasBudget);

      // Validate amount
      if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
        reply.status(400);
        return { success: false, error: 'Amount must be a positive number' };
      }

      const result = await coinService.dryRunTransferCoin(coinId, coinType, to, amount, gasBudget);
      return { success: true, data: result };
    } catch (error) {
      return handleError(error, reply);
    }
  });
}
