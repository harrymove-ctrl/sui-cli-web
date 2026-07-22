import { FastifyInstance } from 'fastify';
import { KeyManagementService, EXPORT_WARNING } from '../services/KeyManagementService';
import type { ApiResponse } from '@sui-cli-web/shared';
import {
  validateAddress,
  validateOptionalAlias,
  validateKeyScheme,
} from '../utils/validation';
import { handleRouteError } from '../utils/errorHandler';

const keyManagementService = new KeyManagementService();

export async function keyManagementRoutes(fastify: FastifyInstance) {
  // Get export warning (for UI to display before export)
  fastify.get<{
    Reply: ApiResponse<{ warning: string }>;
  }>('/keys/export-warning', async (request, reply) => {
    try {
      return {
        success: true,
        data: { warning: EXPORT_WARNING },
      };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  // Export private key
  fastify.post<{
    Body: { address: string; confirmationCode: string };
    Reply: ApiResponse<{
      privateKey: string;
      keyScheme: string;
      publicKey: string;
      warning: string;
    }>;
  }>('/keys/export', async (request, reply) => {
    try {
      // Validate address (can be address or alias)
      const address = request.body?.address;
      const confirmationCode = request.body?.confirmationCode;

      if (!address || typeof address !== 'string') {
        reply.status(400);
        return { success: false, error: 'Address or alias is required' };
      }

      if (!confirmationCode || typeof confirmationCode !== 'string') {
        reply.status(400);
        return { success: false, error: 'Confirmation code is required' };
      }

      const result = await keyManagementService.exportPrivateKey(address, confirmationCode);

      if (!result.success) {
        reply.status(400);
        return { success: false, error: result.error };
      }

      return {
        success: true,
        data: {
          privateKey: result.privateKey!,
          keyScheme: result.keyScheme || 'unknown',
          publicKey: result.publicKey || '',
          warning: result.warning || EXPORT_WARNING,
        },
      };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  // Import key (mnemonic or private key)
  fastify.post<{
    Body: {
      type: 'mnemonic' | 'privatekey';
      input: string;
      keyScheme: 'ed25519' | 'secp256k1' | 'secp256r1';
      alias?: string;
    };
    Reply: ApiResponse<{ address: string; alias?: string }>;
  }>('/keys/import', async (request, reply) => {
    try {
      const { type, input, keyScheme, alias } = request.body || {};

      // Validate type
      if (type !== 'mnemonic' && type !== 'privatekey') {
        reply.status(400);
        return { success: false, error: 'Type must be "mnemonic" or "privatekey"' };
      }

      // Validate input
      if (!input || typeof input !== 'string' || input.trim().length === 0) {
        reply.status(400);
        return { success: false, error: 'Input (mnemonic or private key) is required' };
      }

      // Validate key scheme
      const validatedKeyScheme = validateKeyScheme(keyScheme);
      if (!validatedKeyScheme) {
        reply.status(400);
        return { success: false, error: 'Valid key scheme is required (ed25519, secp256k1, secp256r1)' };
      }

      // Validate alias (optional)
      const validatedAlias = validateOptionalAlias(alias);

      // Import based on type
      let result;
      if (type === 'mnemonic') {
        result = await keyManagementService.importFromMnemonic(
          input.trim(),
          validatedKeyScheme,
          validatedAlias
        );
      } else {
        result = await keyManagementService.importFromPrivateKey(
          input.trim(),
          validatedKeyScheme,
          validatedAlias
        );
      }

      if (!result.success) {
        reply.status(400);
        return { success: false, error: result.error };
      }

      return {
        success: true,
        data: {
          address: result.address!,
          alias: result.alias,
        },
      };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  // Check if address is duplicate (before import)
  fastify.post<{
    Body: { address: string };
    Reply: ApiResponse<{ isDuplicate: boolean }>;
  }>('/keys/check-duplicate', async (request, reply) => {
    try {
      const address = validateAddress(request.body?.address);
      const isDuplicate = await keyManagementService.isAddressDuplicate(address);

      return {
        success: true,
        data: { isDuplicate },
      };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });
}
