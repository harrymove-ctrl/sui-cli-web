import type { ApiResponse, GasCoin, SuiAddress, WalletSummary } from '@sui-cli-web/shared';
import { FastifyInstance } from 'fastify';
import { AddressService } from '../services/AddressService';
import { CoinService } from '../services/CoinService';
import { PackageService } from '../services/dev/PackageService';
import { ParameterHelperService } from '../services/ParameterHelperService';
import { handleRouteError } from '../utils/errorHandler';
import {
  ValidationException,
  validateAddress,
  validateAmounts,
  validateCoinIds,
  validateFunctionName,
  validateKeyScheme,
  validateModuleName,
  validateMoveArgs,
  validateObjectId,
  validateOptionalAlias,
  validateOptionalGasBudget,
  validateTxDigest,
  validateTypeArgs,
} from '../utils/validation';

const addressService = new AddressService();
const parameterHelperService = new ParameterHelperService();
const coinService = new CoinService();
const packageService = new PackageService();

// Alias for cleaner code
const handleError = handleRouteError;

export async function addressRoutes(fastify: FastifyInstance) {
  // Get all addresses with balances
  fastify.get<{ Reply: ApiResponse<SuiAddress[]> }>('/addresses', async (_request, reply) => {
    try {
      // getAddresses already includes balance fetching by default
      const addresses = await addressService.getAddresses(true);
      return { success: true, data: addresses };
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // Get active address
  fastify.get<{ Reply: ApiResponse<{ address: string }> }>(
    '/addresses/active',
    async (_request, reply) => {
      try {
        const address = await addressService.getActiveAddress();
        return { success: true, data: { address } };
      } catch (error) {
        return handleError(error, reply);
      }
    }
  );

  // Switch active address
  fastify.post<{
    Body: { address: string };
    Reply: ApiResponse<void>;
  }>('/addresses/switch', async (request, reply) => {
    try {
      const address = validateAddress(request.body?.address);
      await addressService.switchAddress(address);
      return { success: true };
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // Create new address
  fastify.post<{
    Body: { keyScheme?: 'ed25519' | 'secp256k1' | 'secp256r1'; alias?: string };
    Reply: ApiResponse<{ address: string; phrase?: string }>;
  }>('/addresses/create', async (request, reply) => {
    try {
      const keyScheme = validateKeyScheme(request.body?.keyScheme);
      const alias = validateOptionalAlias(request.body?.alias);
      const result = await addressService.createAddress(keyScheme, alias);
      return { success: true, data: result };
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // Remove address
  fastify.post<{
    Body: { address: string };
    Reply: ApiResponse<void>;
  }>('/addresses/remove', async (request, reply) => {
    try {
      const address = validateAddress(request.body?.address);
      await addressService.removeAddress(address);
      return { success: true };
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // Get balance for specific address
  fastify.get<{
    Params: { address: string };
    Reply: ApiResponse<{ balance: string }>;
  }>('/addresses/:address/balance', async (request, reply) => {
    try {
      const address = validateAddress(request.params.address);
      const balance = await addressService.getBalance(address);
      return { success: true, data: { balance } };
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // Get historical balance for specific address
  fastify.get<{
    Params: { address: string };
    Reply: ApiResponse<{ timestamp: number; balance: number }[]>;
  }>('/addresses/:address/history', async (request, reply) => {
    try {
      const address = validateAddress(request.params.address);
      const history = await addressService.getHistoricalBalance(address);
      return { success: true, data: history };
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // Get objects for an address
  fastify.get<{
    Params: { address: string };
    Reply: ApiResponse<any[]>;
  }>('/addresses/:address/objects', async (request, reply) => {
    try {
      const address = validateAddress(request.params.address);
      const objects = await addressService.getObjects(address);
      return { success: true, data: objects };
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // Combined per-wallet fetch (object count + published packages + coin groups) in one
  // request instead of 3, and one `sui client objects` subprocess instead of 2 - the
  // object list is fetched once and reused for both the count and the UpgradeCap filter.
  // Dashboard used to fire ~17 requests across 5 wallets at once, which the browser's
  // ~6-connections-per-origin HTTP/1.1 cap serialized into slow queued waves; this cuts
  // it to 1 request per wallet.
  fastify.get<{
    Params: { address: string };
    Reply: ApiResponse<WalletSummary>;
  }>('/addresses/:address/summary', async (request, reply) => {
    try {
      const address = validateAddress(request.params.address);
      const [rawObjects, coinGroups] = await Promise.all([
        addressService.getRawObjects(address),
        coinService.getCoinsGrouped(address),
      ]);
      const packages = packageService.extractPublishedPackages(rawObjects);
      return {
        success: true,
        data: { objectCount: rawObjects.length, packages, coinGroups },
      };
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // Get objects for an address filtered by type
  fastify.get<{
    Params: { address: string };
    Querystring: { type: string };
    Reply: ApiResponse<any[]>;
  }>('/addresses/:address/objects/by-type', async (request, reply) => {
    try {
      const address = validateAddress(request.params.address);
      const typePattern = request.query.type;

      if (!typePattern) {
        reply.status(400);
        return { success: false, error: 'type query parameter is required' };
      }

      const objects = await parameterHelperService.getObjectsByType(address, typePattern);
      return { success: true, data: objects };
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // Get gas coins
  fastify.get<{
    Params: { address: string };
    Reply: ApiResponse<GasCoin[]>;
  }>('/addresses/:address/gas', async (request, reply) => {
    try {
      const address = validateAddress(request.params.address);
      const gasCoins = await addressService.getGasCoins(address);
      return { success: true, data: gasCoins };
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // Split coin
  fastify.post<{
    Body: { coinId: string; amounts: string[]; gasBudget?: string };
    Reply: ApiResponse<string>;
  }>('/gas/split', async (request, reply) => {
    try {
      const coinId = validateObjectId(request.body?.coinId, 'coinId');
      const amounts = validateAmounts(request.body?.amounts);
      const gasBudget = validateOptionalGasBudget(request.body?.gasBudget);
      const result = await addressService.splitCoin(coinId, amounts, gasBudget);
      return { success: true, data: result };
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // Merge coins
  fastify.post<{
    Body: { primaryCoinId: string; coinIdsToMerge: string[]; gasBudget?: string };
    Reply: ApiResponse<string>;
  }>('/gas/merge', async (request, reply) => {
    try {
      const primaryCoinId = validateObjectId(request.body?.primaryCoinId, 'primaryCoinId');
      const coinIdsToMerge = validateCoinIds(request.body?.coinIdsToMerge, 'coinIdsToMerge');
      const gasBudget = validateOptionalGasBudget(request.body?.gasBudget);
      const result = await addressService.mergeCoins(primaryCoinId, coinIdsToMerge, gasBudget);
      return { success: true, data: result };
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // Get object by ID
  fastify.get<{
    Params: { objectId: string };
    Reply: ApiResponse<any>;
  }>('/objects/:objectId', async (request, reply) => {
    try {
      const objectId = validateObjectId(request.params.objectId);
      const object = await addressService.getObject(objectId);
      return { success: true, data: object };
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // Walk an object backward through its version chain (GraphQL/indexer-only - see
  // AddressService.getObjectVersionHistory for why there's no CLI/RPC fallback).
  fastify.get<{
    Params: { objectId: string };
    Querystring: { version?: string; previousTx?: string };
    Reply: ApiResponse<any>;
  }>('/objects/:objectId/version-history', async (request, reply) => {
    try {
      const objectId = validateObjectId(request.params.objectId);
      if (!request.query.version) {
        throw new ValidationException([{ field: 'version', message: 'version is required' }]);
      }
      const previousTx = validateTxDigest(request.query.previousTx);
      const history = await addressService.getObjectVersionHistory(
        objectId,
        request.query.version,
        previousTx
      );
      return { success: true, data: history };
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // Batch-decode Walrus Blob objects (size, certification, storage window,
  // last-touched timestamp) for the "Walrus Memory" list view.
  fastify.post<{
    Body: { objectIds: string[] };
    Reply: ApiResponse<any>;
  }>('/objects/blobs/summary', async (request, reply) => {
    try {
      const rawIds = Array.isArray(request.body?.objectIds) ? request.body.objectIds : [];
      const objectIds = rawIds.slice(0, 500).map((id) => validateObjectId(id));
      const summaries = await addressService.getBlobSummaries(objectIds);
      return { success: true, data: summaries };
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // Batch-fetch NFT presentation metadata (image, name, key attributes) for the
  // "NFTs" list view + inspector preview. Objects with no image return imageUrl:null.
  fastify.post<{
    Body: { objectIds: string[] };
    Reply: ApiResponse<any>;
  }>('/objects/nft-metadata', async (request, reply) => {
    try {
      const rawIds = Array.isArray(request.body?.objectIds) ? request.body.objectIds : [];
      const objectIds = rawIds.slice(0, 500).map((id) => validateObjectId(id));
      const metadata = await addressService.getNftMetadata(objectIds);
      return { success: true, data: metadata };
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // Get transaction block by digest
  fastify.get<{
    Params: { digest: string };
    Reply: ApiResponse<any>;
  }>('/tx/:digest', async (request, reply) => {
    try {
      const digest = validateTxDigest(request.params.digest);
      const txBlock = await addressService.getTransactionBlock(digest);
      return { success: true, data: txBlock };
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // Get package summary (modules, functions, structs)
  fastify.get<{
    Params: { packageId: string };
    Reply: ApiResponse<any>;
  }>('/packages/:packageId/summary', async (request, reply) => {
    try {
      const packageId = validateObjectId(request.params.packageId, 'packageId');
      const summary = await addressService.getPackageSummary(packageId);
      return { success: true, data: summary };
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // Call a Move function
  fastify.post<{
    Body: {
      packageId: string;
      module: string;
      function: string;
      typeArgs?: string[];
      args?: string[];
      gasBudget?: string;
    };
    Reply: ApiResponse<any>;
  }>('/call', async (request, reply) => {
    try {
      const { packageId, module, function: functionName, typeArgs, args, gasBudget } = request.body;

      // Validate all inputs at route level for early rejection
      const validPackageId = validateObjectId(packageId, 'packageId');
      const validModule = validateModuleName(module);
      const validFunction = validateFunctionName(functionName);
      const validTypeArgs = validateTypeArgs(typeArgs);
      const validArgs = validateMoveArgs(args);
      const validGasBudget = validateOptionalGasBudget(gasBudget);

      const result = await addressService.callFunction(
        validPackageId,
        validModule,
        validFunction,
        validTypeArgs,
        validArgs,
        validGasBudget || '10000000'
      );
      return { success: true, data: result };
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // Dry run a Move function call
  fastify.post<{
    Body: {
      packageId: string;
      module: string;
      function: string;
      typeArgs?: string[];
      args?: string[];
      gasBudget?: string;
    };
    Reply: ApiResponse<any>;
  }>('/call/dry-run', async (request, reply) => {
    try {
      const { packageId, module, function: functionName, typeArgs, args, gasBudget } = request.body;

      // Validate all inputs at route level for early rejection
      const validPackageId = validateObjectId(packageId, 'packageId');
      const validModule = validateModuleName(module);
      const validFunction = validateFunctionName(functionName);
      const validTypeArgs = validateTypeArgs(typeArgs);
      const validArgs = validateMoveArgs(args);
      const validGasBudget = validateOptionalGasBudget(gasBudget);

      const result = await addressService.dryRunCall(
        validPackageId,
        validModule,
        validFunction,
        validTypeArgs,
        validArgs,
        validGasBudget || '10000000'
      );
      return { success: true, data: result };
    } catch (error) {
      return handleError(error, reply);
    }
  });
}
