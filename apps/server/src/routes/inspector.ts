import { FastifyInstance } from 'fastify';
import { InspectorService, ExecuteSignedTxResult, PtbCommand, PtbOptions, PtbResult } from '../services/dev/InspectorService';
import { ParameterHelperService, AnalyzedParameter } from '../services/ParameterHelperService';
import type { ApiResponse } from '@sui-cli-web/shared';
import { handleRouteError } from '../utils/errorHandler';
import { validateTxDigest, validateObjectId, validateAddress, validateModuleName, validateFunctionName } from '../utils/validation';

const inspectorService = new InspectorService();
const parameterHelperService = new ParameterHelperService();

export async function inspectorRoutes(fastify: FastifyInstance) {
  // Inspect transaction block (view details of an executed transaction)
  fastify.post<{
    Body: { txDigest: string };
    Reply: ApiResponse<{
      results: any;
      events: any[];
      effects: any;
    }>;
  }>('/inspector/inspect', async (request, reply) => {
    try {
      const txDigest = validateTxDigest(request.body?.txDigest, 'txDigest');

      const result = await inspectorService.inspectTransaction(txDigest);

      if (!result.success) {
        reply.status(500);
        return { success: false, error: result.error || 'Inspection failed' };
      }

      return {
        success: true,
        data: {
          results: result.results,
          events: result.events || [],
          effects: result.effects,
        },
      };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  // Replay transaction for debugging
  fastify.post<{
    Body: { txDigest: string };
    Reply: ApiResponse<{ output: string }>;
  }>('/inspector/replay', async (request, reply) => {
    try {
      const txDigest = validateTxDigest(request.body?.txDigest, 'txDigest');

      const result = await inspectorService.replayTransaction(txDigest);

      if (!result.success) {
        reply.status(500);
        return { success: false, error: result.error || 'Replay failed' };
      }

      return {
        success: true,
        data: { output: result.output },
      };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  // Inspect package (get modules and functions)
  fastify.get<{
    Params: { id: string };
    Reply: ApiResponse<{
      packageId: string;
      modules: any[];
    }>;
  }>('/inspector/package/:id', async (request, reply) => {
    try {
      const packageId = validateObjectId(request.params.id, 'packageId');

      const result = await inspectorService.inspectPackage(packageId);

      if (!result.success) {
        reply.status(500);
        return { success: false, error: result.error || 'Package inspection failed' };
      }

      return {
        success: true,
        data: {
          packageId: result.packageId!,
          modules: result.modules!,
        },
      };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  // Parse function signature
  fastify.post<{
    Body: { signature: string };
    Reply: ApiResponse<{
      functionName: string;
      parameters: any[];
      returnTypes: string[];
      typeParameters: string[];
    }>;
  }>('/inspector/parse-signature', async (request, reply) => {
    try {
      const { signature } = request.body;

      if (!signature) {
        reply.status(400);
        return { success: false, error: 'signature is required' };
      }

      const parsed = inspectorService.parseFunctionSignature(signature);

      if (!parsed) {
        reply.status(400);
        return { success: false, error: 'Failed to parse function signature' };
      }

      return {
        success: true,
        data: {
          functionName: parsed.functionName,
          parameters: parsed.parameters,
          returnTypes: parsed.returnTypes,
          typeParameters: parsed.typeParameters,
        },
      };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  // Analyze function parameters and provide suggestions
  fastify.post<{
    Body: {
      packageId: string;
      module: string;
      functionName: string;
      userAddress: string;
    };
    Reply: ApiResponse<{
      parameters: AnalyzedParameter[];
      function: { name: string; visibility: string };
    }>;
  }>('/inspector/analyze-parameters', async (request, reply) => {
    try {
      const { packageId, module, functionName, userAddress } = request.body;

      // Validate inputs
      const validPackageId = validateObjectId(packageId, 'packageId');
      const validModule = validateModuleName(module);
      const validFunction = validateFunctionName(functionName);
      const validAddress = validateAddress(userAddress, 'userAddress');

      const result = await parameterHelperService.analyzeParameters(
        validPackageId,
        validModule,
        validFunction,
        validAddress
      );

      if (!result.success) {
        reply.status(400);
        return { success: false, error: result.error || 'Failed to analyze parameters' };
      }

      return {
        success: true,
        data: {
          parameters: result.parameters!,
          function: result.function!,
        },
      };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  // Get object metadata for preview
  fastify.get<{
    Params: { id: string };
    Reply: ApiResponse<any>;
  }>('/inspector/object/:id/metadata', async (request, reply) => {
    try {
      const objectId = validateObjectId(request.params.id, 'objectId');

      const metadata = await parameterHelperService.getObjectMetadata(objectId);

      if (!metadata) {
        reply.status(404);
        return { success: false, error: 'Object not found' };
      }

      return {
        success: true,
        data: metadata,
      };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  // Convert string/hex to vector<u8> format
  fastify.post<{
    Body: { value: string; format: 'string' | 'hex' };
    Reply: ApiResponse<{ result: string }>;
  }>('/inspector/convert-to-vector-u8', async (request, reply) => {
    try {
      const { value, format } = request.body;

      if (!value) {
        reply.status(400);
        return { success: false, error: 'value is required' };
      }

      let result: string;
      if (format === 'hex') {
        result = parameterHelperService.hexToVectorU8(value);
      } else {
        result = parameterHelperService.stringToVectorU8(value);
      }

      return {
        success: true,
        data: { result },
      };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  // Execute a pre-signed transaction (for hardware wallet users)
  fastify.post<{
    Body: { txBytes: string; signatures: string[] };
    Reply: ApiResponse<ExecuteSignedTxResult>;
  }>('/inspector/execute-signed-tx', async (request, reply) => {
    try {
      const { txBytes, signatures } = request.body;

      if (!txBytes) {
        reply.status(400);
        return { success: false, error: 'txBytes is required' };
      }

      if (!signatures || !Array.isArray(signatures) || signatures.length === 0) {
        reply.status(400);
        return { success: false, error: 'At least one signature is required' };
      }

      const result = await inspectorService.executeSignedTransaction(txBytes, signatures);

      if (!result.success) {
        reply.status(500);
        return { success: false, error: result.error || 'Execution failed' };
      }

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  // Execute a combined serialized SenderSignedData
  fastify.post<{
    Body: { serializedSignedTx: string };
    Reply: ApiResponse<ExecuteSignedTxResult>;
  }>('/inspector/execute-combined-signed-tx', async (request, reply) => {
    try {
      const { serializedSignedTx } = request.body;

      if (!serializedSignedTx) {
        reply.status(400);
        return { success: false, error: 'serializedSignedTx is required' };
      }

      const result = await inspectorService.executeCombinedSignedTransaction(serializedSignedTx);

      if (!result.success) {
        reply.status(500);
        return { success: false, error: result.error || 'Execution failed' };
      }

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  // Execute a Programmable Transaction Block (PTB)
  fastify.post<{
    Body: { commands: PtbCommand[]; options?: PtbOptions };
    Reply: ApiResponse<PtbResult>;
  }>('/inspector/ptb', async (request, reply) => {
    try {
      const { commands, options } = request.body;

      if (!commands || !Array.isArray(commands) || commands.length === 0) {
        reply.status(400);
        return { success: false, error: 'At least one command is required' };
      }

      // Validate command types
      const validTypes = ['split-coins', 'merge-coins', 'transfer-objects', 'move-call', 'assign', 'make-move-vec'];
      for (const cmd of commands) {
        if (!validTypes.includes(cmd.type)) {
          reply.status(400);
          return { success: false, error: `Invalid command type: ${cmd.type}. Valid types: ${validTypes.join(', ')}` };
        }
        if (!cmd.args || !Array.isArray(cmd.args)) {
          reply.status(400);
          return { success: false, error: `Command ${cmd.type} requires args array` };
        }
      }

      const result = await inspectorService.executePtb(commands, options || {});

      if (!result.success) {
        reply.status(500);
        return { success: false, error: result.error || 'PTB execution failed' };
      }

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });
}
