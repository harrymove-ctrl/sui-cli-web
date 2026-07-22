import { FastifyInstance } from 'fastify';
import { MoveService } from '../services/dev/MoveService';
import type { ApiResponse } from '@sui-cli-web/shared';
import { handleRouteError } from '../utils/errorHandler';

const moveService = new MoveService();

export async function moveRoutes(fastify: FastifyInstance) {
  // Build a Move package
  fastify.post<{
    Body: { packagePath: string };
    Reply: ApiResponse<{ output: string }>;
  }>('/move/build', async (request, reply) => {
    try {
      const { packagePath } = request.body;

      if (!packagePath) {
        reply.status(400);
        return { success: false, error: 'packagePath is required' };
      }

      const result = await moveService.buildPackage(packagePath);

      if (!result.success) {
        reply.status(500);
        // Return output as error so frontend can display detailed build error
        return { success: false, error: result.output || result.error || 'Build failed' };
      }

      return {
        success: true,
        data: { output: result.output },
      };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  // Run Move tests
  fastify.post<{
    Body: { packagePath: string; filter?: string };
    Reply: ApiResponse<{ output: string; passed: number; failed: number }>;
  }>('/move/test', async (request, reply) => {
    try {
      const { packagePath, filter } = request.body;

      if (!packagePath) {
        reply.status(400);
        return { success: false, error: 'packagePath is required' };
      }

      const result = await moveService.runTests(packagePath, filter);

      if (!result.success) {
        reply.status(500);
        return {
          success: false,
          // Return output as error so frontend can display detailed test error
          error: result.output || result.error || `Tests failed: ${result.failed} test(s) failed`,
        };
      }

      return {
        success: true,
        data: {
          output: result.output,
          passed: result.passed,
          failed: result.failed,
        },
      };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  // Create new Move package
  fastify.post<{
    Body: { name: string; parentPath?: string };
    Reply: ApiResponse<{ path: string }>;
  }>('/move/new', async (request, reply) => {
    try {
      const { name, parentPath } = request.body;

      if (!name) {
        reply.status(400);
        return { success: false, error: 'name is required' };
      }

      const result = await moveService.createNewPackage(name, parentPath);

      if (!result.success) {
        reply.status(500);
        return { success: false, error: result.error || 'Failed to create package' };
      }

      return {
        success: true,
        data: { path: result.path! },
      };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  // Publish Move package to blockchain
  fastify.post<{
    Body: { packagePath: string; gasBudget?: number };
    Reply: ApiResponse<{ output: string; packageId?: string; upgradeCapId?: string }>;
  }>('/move/publish', async (request, reply) => {
    try {
      const { packagePath, gasBudget } = request.body;

      if (!packagePath) {
        reply.status(400);
        return { success: false, error: 'packagePath is required' };
      }

      const result = await moveService.publishPackage(packagePath, gasBudget);

      if (!result.success) {
        reply.status(500);
        // Return output as error so frontend can display detailed publish error
        return { success: false, error: result.output || result.error || 'Publish failed' };
      }

      return {
        success: true,
        data: {
          output: result.output,
          packageId: result.packageId,
          upgradeCapId: result.upgradeCapId,
        },
      };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });
}
