import { FastifyInstance } from 'fastify';
import { FaucetService } from '../services/FaucetService';
import type { ApiResponse, FaucetResponse } from '@sui-cli-web/shared';
import {
  validateNetwork,
  validateAddress,
} from '../utils/validation';
import { handleRouteError } from '../utils/errorHandler';

const faucetService = new FaucetService();

// Alias for cleaner code
const handleError = handleRouteError;

export async function faucetRoutes(fastify: FastifyInstance) {
  // Request tokens from faucet
  fastify.post<{
    Body: { network: 'testnet' | 'devnet' | 'localnet'; address?: string };
    Reply: ApiResponse<FaucetResponse>;
  }>('/faucet/request', async (request, reply) => {
    try {
      const network = validateNetwork(request.body?.network);
      // Address is optional - if not provided, uses active address
      let address: string | undefined;
      if (request.body?.address) {
        address = validateAddress(request.body.address);
      }
      const result = await faucetService.requestTokens(network, address);

      // If faucet service returned an error, propagate it properly
      if (!result.success) {
        reply.status(400);
        return { success: false, error: result.message };
      }

      return { success: true, data: result };
    } catch (error) {
      return handleError(error, reply);
    }
  });

}
