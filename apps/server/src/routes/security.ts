import { FastifyInstance } from 'fastify';
import { SecurityService } from '../services/dev/SecurityService.js';
import type { ApiResponse } from '@sui-cli-web/shared';
import { handleRouteError } from '../utils/errorHandler.js';

const securityService = new SecurityService();

export async function securityRoutes(fastify: FastifyInstance) {
  // Verify on-chain source against local Move package
  fastify.post<{
    Body: { packagePath: string; verifyDeps?: boolean; skipSource?: boolean };
    Reply: ApiResponse<{ verified: boolean; output: string; packagePath: string }>;
  }>('/security/verify-source', async (request, reply) => {
    try {
      const { packagePath, verifyDeps = false, skipSource = false } = request.body;

      if (!packagePath) {
        reply.status(400);
        return { success: false, error: 'packagePath is required' };
      }

      // Validate skipSource flag
      if (skipSource && !verifyDeps) {
        reply.status(400);
        return {
          success: false,
          error: 'skipSource can only be used when verifyDeps is true',
        };
      }

      const result = await securityService.verifySource(packagePath, verifyDeps, skipSource);

      if (!result.success) {
        reply.status(500);
        return {
          success: false,
          error: result.output || result.error || 'Source verification failed',
        };
      }

      return {
        success: true,
        data: {
          verified: result.verified,
          output: result.output,
          packagePath: result.packagePath,
        },
      };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  // Verify bytecode meter usage
  fastify.post<{
    Body: {
      packagePath?: string;
      modulePaths?: string[];
      protocolVersion?: number;
    };
    Reply: ApiResponse<{
      output: string;
      withinLimits: boolean;
      meterUsage?: { current: number; limit: number };
    }>;
  }>('/security/verify-bytecode', async (request, reply) => {
    try {
      const { packagePath, modulePaths, protocolVersion } = request.body;

      // Validate that at least one option is provided
      if (!packagePath && (!modulePaths || modulePaths.length === 0)) {
        reply.status(400);
        return {
          success: false,
          error: 'Either packagePath or modulePaths must be provided',
        };
      }

      const result = await securityService.verifyBytecode(
        packagePath,
        modulePaths,
        protocolVersion
      );

      if (!result.success) {
        reply.status(500);
        return {
          success: false,
          error: result.output || result.error || 'Bytecode verification failed',
        };
      }

      return {
        success: true,
        data: {
          output: result.output,
          withinLimits: result.withinLimits,
          meterUsage: result.meterUsage,
        },
      };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  // Decode transaction and optionally verify signature
  fastify.post<{
    Body: { txBytes: string; signature?: string; curEpoch?: number };
    Reply: ApiResponse<{
      decoded: object | string;
      signatureValid?: boolean;
    }>;
  }>('/security/decode-tx', async (request, reply) => {
    try {
      const { txBytes, signature, curEpoch } = request.body;

      if (!txBytes) {
        reply.status(400);
        return { success: false, error: 'txBytes is required' };
      }

      const result = await securityService.decodeTransaction(txBytes, signature, curEpoch);

      if (!result.success) {
        reply.status(500);
        return { success: false, error: result.error || 'Transaction decoding failed' };
      }

      return {
        success: true,
        data: {
          decoded: result.decoded,
          signatureValid: result.signatureValid,
        },
      };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });
}
