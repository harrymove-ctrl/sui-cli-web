/**
 * Gas Analysis Routes - Gas breakdown and optimization
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { GasAnalysisService } from '../services/dev/GasAnalysisService';
import { handleRouteError } from '../utils/errorHandler';
import { validateTxDigest } from '../utils/validation';

export async function gasRoutes(fastify: FastifyInstance) {
  const service = new GasAnalysisService();

  // GET /api/gas/analyze/:digest - Analyze transaction gas
  fastify.get<{
    Params: { digest: string };
  }>('/inspector/gas/analyze/:digest', async (request, reply) => {
    try {
      const digest = validateTxDigest(request.params.digest, 'digest');
      const result = await service.analyzeTransaction(digest);

      if (!result.success) {
        reply.status(400);
      }

      return result;
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  // POST /api/gas/estimate - Estimate gas for transaction bytes
  fastify.post<{
    Body: { txBytes: string };
  }>('/inspector/gas/estimate', async (request, reply) => {
    try {
      if (!request.body.txBytes) {
        reply.status(400);
        return { success: false, error: 'Transaction bytes are required' };
      }

      const result = await service.estimateGas(request.body.txBytes);
      return result;
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  // GET /api/gas/reference - Get reference gas price
  fastify.get('/inspector/gas/reference', async (request, reply) => {
    try {
      const result = await service.getReferenceGasPrice();
      return result;
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  // POST /api/gas/format - Format gas breakdown for display
  fastify.post<{
    Body: {
      computationCost: string;
      storageCost: string;
      storageRebate: string;
      nonRefundableStorageFee: string;
      totalGasUsed: string;
      totalGasBudget: string;
      efficiency: number;
    };
  }>('/inspector/gas/format', async (request, reply) => {
    try {
      const formatted = service.formatBreakdown(request.body);
      return { success: true, ...formatted };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });
}
