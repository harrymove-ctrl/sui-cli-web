/**
 * Pay Routes - Multi-recipient payments
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PayService, PayRequest, PayAllSuiRequest } from '../services/dev/PayService';
import { handleRouteError } from '../utils/errorHandler';
import { validateAddress } from '../utils/validation';

export async function payRoutes(fastify: FastifyInstance) {
  const service = new PayService();

  // POST /api/pay - Pay using any coins
  fastify.post<{
    Body: PayRequest;
  }>('/pay', async (request, reply) => {
    try {
      // Validate recipients
      if (request.body.recipients) {
        for (const recipient of request.body.recipients) {
          validateAddress(recipient, 'recipient');
        }
      }

      const result = await service.pay(request.body);

      if (!result.success) {
        reply.status(400);
      }

      return result;
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  // POST /api/pay/sui - Pay using SUI coins
  fastify.post<{
    Body: PayRequest;
  }>('/pay/sui', async (request, reply) => {
    try {
      // Validate recipients
      if (request.body.recipients) {
        for (const recipient of request.body.recipients) {
          validateAddress(recipient, 'recipient');
        }
      }

      const result = await service.paySui(request.body);

      if (!result.success) {
        reply.status(400);
      }

      return result;
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  // POST /api/pay/all-sui - Pay all SUI to one recipient
  fastify.post<{
    Body: PayAllSuiRequest;
  }>('/pay/all-sui', async (request, reply) => {
    try {
      if (request.body.recipient) {
        validateAddress(request.body.recipient, 'recipient');
      }

      const result = await service.payAllSui(request.body);

      if (!result.success) {
        reply.status(400);
      }

      return result;
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  // POST /api/pay/summary - Get payment summary
  fastify.post<{
    Body: PayRequest;
  }>('/pay/summary', async (request, reply) => {
    try {
      // Validate recipients
      if (request.body.recipients) {
        for (const recipient of request.body.recipients) {
          validateAddress(recipient, 'recipient');
        }
      }

      const summary = service.formatPaymentSummary(request.body);
      return { success: true, ...summary };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  // POST /api/pay/total - Calculate total amount
  fastify.post<{
    Body: { amounts: string[] };
  }>('/pay/total', async (request, reply) => {
    try {
      const total = service.calculateTotal(request.body.amounts || []);
      const totalSui = (Number(total) / 1_000_000_000).toFixed(9);
      return {
        success: true,
        total,
        totalSui,
      };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });
}
