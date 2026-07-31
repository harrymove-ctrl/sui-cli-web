import type { ApiResponse } from '@sui-cli-web/shared';
import { FastifyInstance } from 'fastify';
import { ConfigParser } from '../cli/ConfigParser';
import { PackageService, PublishedPackageInfo } from '../services/dev/PackageService';
import { handleRouteError } from '../utils/errorHandler';
import { getPackageModulesViaGrpc, type PackageModulesViaGrpc } from '../utils/suiGrpcClient';
import {
  validateFunctionName,
  validateModuleName,
  validateMoveArgs,
  validateObjectId,
  validateOptionalGasBudget,
  validateTypeArgs,
} from '../utils/validation';

const packageService = new PackageService();
const configParser = ConfigParser.getInstance();

export async function packageRoutes(fastify: FastifyInstance) {
  // Get user's published packages (via UpgradeCap objects)
  fastify.get<{
    Querystring: { address?: string };
    Reply: ApiResponse<{ packages: PublishedPackageInfo[] }>;
  }>('/packages/published', async (request, reply) => {
    try {
      const { address } = request.query;

      const result = await packageService.getPublishedPackages(address);

      if (!result.success) {
        reply.status(500);
        return { success: false, error: result.error || 'Failed to get published packages' };
      }

      return {
        success: true,
        data: {
          packages: result.packages || [],
        },
      };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });
  // Explore a package: normalized modules (functions + datatypes) via gRPC.
  fastify.get<{
    Params: { id: string };
    Reply: ApiResponse<PackageModulesViaGrpc>;
  }>('/packages/:id/explore', async (request, reply) => {
    try {
      const packageId = validateObjectId(request.params.id, 'packageId');

      const rpcUrl = await configParser.getActiveRpcUrl();
      if (!rpcUrl) {
        reply.status(503);
        return { success: false, error: 'No active Sui environment configured' };
      }

      const result = await getPackageModulesViaGrpc(packageId, rpcUrl);
      if (!result) {
        reply.status(404);
        return { success: false, error: 'Package not found' };
      }

      return { success: true, data: result };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  // Publish a Move package
  fastify.post<{
    Body: {
      packagePath: string;
      gasBudget?: string;
      skipDependencyVerification?: boolean;
    };
    Reply: ApiResponse<{
      packageId: string;
      digest: string;
      createdObjects: any[];
    }>;
  }>('/packages/publish', async (request, reply) => {
    try {
      const { packagePath, gasBudget, skipDependencyVerification } = request.body;

      if (!packagePath) {
        reply.status(400);
        return { success: false, error: 'packagePath is required' };
      }

      const validatedGasBudget = validateOptionalGasBudget(gasBudget);

      const result = await packageService.publishPackage(
        packagePath,
        validatedGasBudget,
        skipDependencyVerification
      );

      if (!result.success) {
        reply.status(500);
        return { success: false, error: result.error || 'Publish failed' };
      }

      return {
        success: true,
        data: {
          packageId: result.packageId!,
          digest: result.digest!,
          createdObjects: result.createdObjects!,
        },
      };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  // Upgrade a Move package
  fastify.post<{
    Body: {
      packagePath: string;
      upgradeCapId: string;
      gasBudget?: string;
    };
    Reply: ApiResponse<{
      packageId: string;
      digest: string;
    }>;
  }>('/packages/upgrade', async (request, reply) => {
    try {
      const { packagePath, upgradeCapId, gasBudget } = request.body;

      if (!packagePath) {
        reply.status(400);
        return { success: false, error: 'packagePath is required' };
      }

      if (!upgradeCapId) {
        reply.status(400);
        return { success: false, error: 'upgradeCapId is required' };
      }

      const validatedUpgradeCapId = validateObjectId(upgradeCapId, 'upgradeCapId');
      const validatedGasBudget = validateOptionalGasBudget(gasBudget);

      const result = await packageService.upgradePackage(
        packagePath,
        validatedUpgradeCapId,
        validatedGasBudget
      );

      if (!result.success) {
        reply.status(500);
        return { success: false, error: result.error || 'Upgrade failed' };
      }

      return {
        success: true,
        data: {
          packageId: result.packageId!,
          digest: result.digest!,
        },
      };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  // Get package info
  fastify.get<{
    Params: { id: string };
    Reply: ApiResponse<{
      data: any;
      objectId: string;
      type: string;
      owner: string;
    }>;
  }>('/packages/:id', async (request, reply) => {
    try {
      const packageId = validateObjectId(request.params.id, 'packageId');

      const result = await packageService.getPackageInfo(packageId);

      if (!result.success) {
        reply.status(404);
        return { success: false, error: result.error || 'Package not found' };
      }

      return {
        success: true,
        data: {
          data: result.data!,
          objectId: result.objectId!,
          type: result.type!,
          owner: result.owner!,
        },
      };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  // Call package function
  fastify.post<{
    Params: { id: string };
    Body: {
      module: string;
      function: string;
      args?: string[];
      typeArgs?: string[];
      gasBudget?: string;
    };
    Reply: ApiResponse<{
      digest: string;
      effects: any;
      events: any[];
      gasUsed?: string;
    }>;
  }>('/packages/:id/call', async (request, reply) => {
    try {
      const packageId = validateObjectId(request.params.id, 'packageId');
      const { module, function: functionName, args, typeArgs, gasBudget } = request.body;

      if (!module || !functionName) {
        reply.status(400);
        return { success: false, error: 'module and function are required' };
      }

      const validatedModule = validateModuleName(module);
      const validatedFunction = validateFunctionName(functionName);
      const validatedArgs = validateMoveArgs(args);
      const validatedTypeArgs = validateTypeArgs(typeArgs);
      const validatedGasBudget = validateOptionalGasBudget(gasBudget);

      const result = await packageService.callPackageFunction(
        packageId,
        validatedModule,
        validatedFunction,
        validatedArgs,
        validatedTypeArgs,
        validatedGasBudget
      );

      if (!result.success) {
        reply.status(500);
        return { success: false, error: result.error || 'Function call failed' };
      }

      return {
        success: true,
        data: {
          digest: result.digest!,
          effects: result.effects!,
          events: result.events!,
          gasUsed: result.gasUsed,
          objectChanges: result.objectChanges,
        },
      };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });
}
