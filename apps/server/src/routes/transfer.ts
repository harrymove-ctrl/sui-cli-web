import { FastifyInstance } from 'fastify';
import { TransferService } from '../services/TransferService';
import type { ApiResponse } from '@sui-cli-web/shared';
import {
  validateAddress,
  validateObjectId,
  validateOptionalGasBudget,
} from '../utils/validation';
import { handleRouteError } from '../utils/errorHandler';

const transferService = new TransferService();

export async function transferRoutes(fastify: FastifyInstance) {
  // Transfer SUI
  fastify.post<{
    Body: { to: string; amount: string; coinId?: string; gasBudget?: string };
    Reply: ApiResponse<{ digest: string; gasUsed?: string }>;
  }>('/transfers/sui', async (request, reply) => {
    try {
      const to = validateAddress(request.body?.to, 'to');
      const amount = request.body?.amount;
      const coinId = request.body?.coinId ? validateObjectId(request.body.coinId, 'coinId') : undefined;
      const gasBudget = validateOptionalGasBudget(request.body?.gasBudget);

      // Validate amount is a positive number
      const amountNum = parseFloat(amount);
      if (isNaN(amountNum) || amountNum <= 0) {
        reply.status(400);
        return { success: false, error: 'Amount must be a positive number' };
      }

      const result = await transferService.transferSui(to, amount, coinId, gasBudget);

      if (!result.success) {
        reply.status(500);
        return { success: false, error: result.error };
      }

      return {
        success: true,
        data: {
          digest: result.digest,
          gasUsed: result.gasUsed,
        },
      };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  // Dry run transfer SUI
  fastify.post<{
    Body: { to: string; amount: string; coinId?: string; gasBudget?: string };
    Reply: ApiResponse<{ estimatedGas: string; effects?: any }>;
  }>('/transfers/sui/dry-run', async (request, reply) => {
    try {
      const to = validateAddress(request.body?.to, 'to');
      const amount = request.body?.amount;
      const coinId = request.body?.coinId ? validateObjectId(request.body.coinId, 'coinId') : undefined;
      const gasBudget = validateOptionalGasBudget(request.body?.gasBudget);

      // Validate amount is a positive number
      const amountNum = parseFloat(amount);
      if (isNaN(amountNum) || amountNum <= 0) {
        reply.status(400);
        return { success: false, error: 'Amount must be a positive number' };
      }

      const result = await transferService.dryRunTransferSui(to, amount, coinId, gasBudget);

      if (!result.success) {
        reply.status(500);
        return { success: false, error: result.error };
      }

      return {
        success: true,
        data: {
          estimatedGas: result.estimatedGas,
          effects: result.effects,
        },
      };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  // Get transferable coins for an address
  fastify.get<{
    Params: { address: string };
    Reply: ApiResponse<Array<{ coinObjectId: string; balance: string; balanceSui: string }>>;
  }>('/transfers/sui/coins/:address', async (request, reply) => {
    try {
      const address = validateAddress(request.params.address);
      const coins = await transferService.getTransferableCoins(address);
      return { success: true, data: coins };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  // Transfer object/NFT
  fastify.post<{
    Body: { to: string; objectId: string; gasBudget?: string };
    Reply: ApiResponse<{ digest: string; gasUsed?: string }>;
  }>('/transfers/object', async (request, reply) => {
    try {
      const to = validateAddress(request.body?.to, 'to');
      const objectId = validateObjectId(request.body?.objectId, 'objectId');
      const gasBudget = validateOptionalGasBudget(request.body?.gasBudget);

      const result = await transferService.transferObject(to, objectId, gasBudget);

      if (!result.success) {
        reply.status(500);
        return { success: false, error: result.error };
      }

      return {
        success: true,
        data: {
          digest: result.digest,
          gasUsed: result.gasUsed,
        },
      };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  // Dry run transfer object
  fastify.post<{
    Body: { to: string; objectId: string; gasBudget?: string };
    Reply: ApiResponse<{ estimatedGas: string; effects?: any }>;
  }>('/transfers/object/dry-run', async (request, reply) => {
    try {
      const to = validateAddress(request.body?.to, 'to');
      const objectId = validateObjectId(request.body?.objectId, 'objectId');
      const gasBudget = validateOptionalGasBudget(request.body?.gasBudget);

      const result = await transferService.dryRunTransferObject(to, objectId, gasBudget);

      if (!result.success) {
        reply.status(500);
        return { success: false, error: result.error };
      }

      return {
        success: true,
        data: {
          estimatedGas: result.estimatedGas,
          effects: result.effects,
        },
      };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  // Get transferable objects for an address
  fastify.get<{
    Params: { address: string };
    Reply: ApiResponse<Array<{ objectId: string; type: string; owner: string; digest: string }>>;
  }>('/transfers/objects/:address', async (request, reply) => {
    try {
      const address = validateAddress(request.params.address);
      const objects = await transferService.getTransferableObjects(address);
      return { success: true, data: objects };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  // Verify object ownership (useful before transfer)
  fastify.post<{
    Body: { objectId: string; address: string };
    Reply: ApiResponse<{ isOwner: boolean }>;
  }>('/transfers/verify-ownership', async (request, reply) => {
    try {
      const objectId = validateObjectId(request.body?.objectId, 'objectId');
      const address = validateAddress(request.body?.address);

      const isOwner = await transferService.verifyObjectOwnership(objectId, address);
      return { success: true, data: { isOwner } };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });
}
