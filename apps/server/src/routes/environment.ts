import { FastifyInstance } from 'fastify';
import { EnvironmentService, ChainIdentifierResult } from '../services/EnvironmentService';
import type { ApiResponse, SuiEnvironment } from '@sui-cli-web/shared';
import {
  validateOptionalAlias,
  validateRpcUrl,
  ValidationException,
} from '../utils/validation';

const environmentService = new EnvironmentService();

// Helper to handle validation errors
function handleError(error: unknown, reply: any) {
  if (error instanceof ValidationException) {
    reply.status(400);
    return { success: false, error: error.message };
  }
  reply.status(500);
  return { success: false, error: String(error) };
}

// Validate environment alias (required, non-empty)
function validateRequiredAlias(alias: unknown): string {
  if (typeof alias !== 'string' || alias.trim().length === 0) {
    throw new ValidationException([
      { field: 'alias', message: 'Alias is required and must be non-empty' },
    ]);
  }
  // Use the optional alias validator for format checking
  const validated = validateOptionalAlias(alias);
  if (!validated) {
    throw new ValidationException([
      { field: 'alias', message: 'Invalid alias format' },
    ]);
  }
  return validated;
}

export async function environmentRoutes(fastify: FastifyInstance) {
  // Get all environments
  fastify.get<{ Reply: ApiResponse<SuiEnvironment[]> }>('/environments', async (request, reply) => {
    try {
      const environments = await environmentService.getEnvironments();
      return { success: true, data: environments };
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // Get active environment
  fastify.get<{ Reply: ApiResponse<{ alias: string | null }> }>('/environments/active', async (request, reply) => {
    try {
      const alias = await environmentService.getActiveEnvironment();
      return { success: true, data: { alias } };
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // Get chain identifier from current RPC
  fastify.get<{ Reply: ApiResponse<ChainIdentifierResult> }>('/environments/chain-id', async (request, reply) => {
    try {
      const result = await environmentService.getChainIdentifier();
      return { success: true, data: result };
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // Switch environment
  fastify.post<{
    Body: { alias: string };
    Reply: ApiResponse<void>;
  }>('/environments/switch', async (request, reply) => {
    try {
      const alias = validateRequiredAlias(request.body?.alias);
      await environmentService.switchEnvironment(alias);
      return { success: true };
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // Add new environment
  fastify.post<{
    Body: { alias: string; rpc: string; ws?: string };
    Reply: ApiResponse<void>;
  }>('/environments', async (request, reply) => {
    try {
      const alias = validateRequiredAlias(request.body?.alias);
      const rpc = validateRpcUrl(request.body?.rpc, 'rpc');
      // ws is optional but must be valid URL if provided
      let ws: string | undefined;
      if (request.body?.ws) {
        ws = validateRpcUrl(request.body.ws, 'ws');
      }
      await environmentService.addEnvironment(alias, rpc, ws);
      return { success: true };
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // Remove environment
  fastify.delete<{
    Params: { alias: string };
    Reply: ApiResponse<void>;
  }>('/environments/:alias', async (request, reply) => {
    try {
      const alias = validateRequiredAlias(request.params.alias);
      await environmentService.removeEnvironment(alias);
      return { success: true };
    } catch (error) {
      return handleError(error, reply);
    }
  });
}
