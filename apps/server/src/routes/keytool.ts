import { FastifyInstance } from 'fastify';
import { KeytoolService, KeyScheme, SampleTxType, CombineSignaturesResult, ExecuteTxResult, BuildTransferTxResult } from '../services/KeytoolService.js';
import type { ApiResponse } from '@sui-cli-web/shared';
import { validateAddress, validateKeyScheme } from '../utils/validation.js';
import { handleRouteError } from '../utils/errorHandler.js';

const keytoolService = new KeytoolService();

/**
 * Keytool routes for cryptographic operations
 * These operations work with keys, signatures, and multi-sig addresses
 */
export async function keytoolRoutes(fastify: FastifyInstance) {
  // List all keys in keystore
  fastify.get<{
    Reply: ApiResponse<any[]>;
  }>('/list', async (request, reply) => {
    try {
      const result = await keytoolService.listKeys();

      if (!result.success) {
        reply.status(500);
        return { success: false, error: result.error };
      }

      return { success: true, data: result.keys || [] };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  // Generate new keypair
  fastify.post<{
    Body: {
      scheme?: KeyScheme;
      wordLength?: number;
      noOutput?: boolean;
    };
    Reply: ApiResponse<{
      address: string;
      publicKey?: string;
      keyScheme: KeyScheme;
      mnemonic?: string;
    }>;
  }>('/generate', async (request, reply) => {
    try {
      const { scheme, wordLength, noOutput } = request.body || {};

      // Validate key scheme (optional, defaults to ed25519)
      const validatedScheme = validateKeyScheme(scheme);

      // Validate word length if provided
      if (wordLength !== undefined) {
        const validLengths = [12, 15, 18, 21, 24];
        if (!validLengths.includes(wordLength)) {
          reply.status(400);
          return {
            success: false,
            error: `Invalid word length. Must be one of: ${validLengths.join(', ')}`,
          };
        }
      }

      const result = await keytoolService.generateKey(
        validatedScheme || 'ed25519',
        wordLength,
        noOutput
      );

      if (!result.success || !result.address) {
        reply.status(500);
        return { success: false, error: result.error || 'Failed to generate key' };
      }

      return {
        success: true,
        data: {
          address: result.address,
          publicKey: result.publicKey,
          keyScheme: result.keyScheme || validatedScheme || 'ed25519',
          mnemonic: result.mnemonic, // Only included if noOutput is false
        },
      };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  // Sign a message
  fastify.post<{
    Body: {
      address: string;
      data: string;
    };
    Reply: ApiResponse<{
      signature: string;
      publicKey?: string;
    }>;
  }>('/sign', async (request, reply) => {
    try {
      const { address, data } = request.body || {};

      // Validate address (can be address or alias)
      if (!address || typeof address !== 'string') {
        reply.status(400);
        return { success: false, error: 'Address or alias is required' };
      }

      // Validate data
      if (!data || typeof data !== 'string') {
        reply.status(400);
        return { success: false, error: 'Data to sign is required' };
      }

      const result = await keytoolService.signMessage(address, data);

      if (!result.success || !result.signature) {
        reply.status(500);
        return { success: false, error: result.error || 'Failed to sign message' };
      }

      return {
        success: true,
        data: {
          signature: result.signature,
          publicKey: result.publicKey,
        },
      };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  // Create multi-signature address
  fastify.post<{
    Body: {
      publicKeys: string[];
      weights: number[];
      threshold: number;
    };
    Reply: ApiResponse<{
      address: string;
      threshold: number;
      publicKeys: string[];
      weights: number[];
    }>;
  }>('/multisig-address', async (request, reply) => {
    try {
      const { publicKeys, weights, threshold } = request.body || {};

      // Validate public keys
      if (!Array.isArray(publicKeys) || publicKeys.length === 0) {
        reply.status(400);
        return { success: false, error: 'At least one public key is required' };
      }

      // Validate all public keys are strings
      if (!publicKeys.every((pk) => typeof pk === 'string' && pk.length > 0)) {
        reply.status(400);
        return { success: false, error: 'All public keys must be non-empty strings' };
      }

      // Validate weights
      if (!Array.isArray(weights) || weights.length === 0) {
        reply.status(400);
        return { success: false, error: 'Weights array is required' };
      }

      // Validate all weights are positive numbers
      if (!weights.every((w) => typeof w === 'number' && w > 0)) {
        reply.status(400);
        return { success: false, error: 'All weights must be positive numbers' };
      }

      // Validate lengths match
      if (publicKeys.length !== weights.length) {
        reply.status(400);
        return {
          success: false,
          error: 'Number of public keys must match number of weights',
        };
      }

      // Validate threshold
      if (typeof threshold !== 'number' || threshold <= 0) {
        reply.status(400);
        return { success: false, error: 'Threshold must be a positive number' };
      }

      const result = await keytoolService.createMultiSigAddress(publicKeys, weights, threshold);

      if (!result.success || !result.address) {
        reply.status(500);
        return { success: false, error: result.error || 'Failed to create multi-sig address' };
      }

      return {
        success: true,
        data: {
          address: result.address,
          threshold: result.threshold!,
          publicKeys: result.publicKeys!,
          weights: result.weights!,
        },
      };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  // Decode transaction (and optionally verify signature)
  fastify.post<{
    Body: {
      txBytes: string;
      signature?: string;
    };
    Reply: ApiResponse<{
      decoded: object | string;
      signatureValid?: boolean;
    }>;
  }>('/decode-tx', async (request, reply) => {
    try {
      const { txBytes, signature } = request.body || {};

      // Validate transaction bytes
      if (!txBytes || typeof txBytes !== 'string') {
        reply.status(400);
        return { success: false, error: 'Transaction bytes are required' };
      }

      // Validate signature if provided
      if (signature !== undefined && typeof signature !== 'string') {
        reply.status(400);
        return { success: false, error: 'Signature must be a string' };
      }

      const result = await keytoolService.decodeTx(txBytes, signature);

      if (!result.success) {
        reply.status(500);
        return { success: false, error: result.error || 'Failed to decode transaction' };
      }

      return {
        success: true,
        data: {
          decoded: result.decoded!,
          signatureValid: result.signatureValid,
        },
      };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  // Combine partial signatures into a multi-sig signature
  fastify.post<{
    Body: {
      publicKeys: string[];
      weights: number[];
      threshold: number;
      signatures: string[];
    };
    Reply: ApiResponse<{
      combinedSignature: string;
      multiSigAddress?: string;
    }>;
  }>('/combine-signatures', async (request, reply) => {
    try {
      const { publicKeys, weights, threshold, signatures } = request.body || {};

      // Validate public keys
      if (!Array.isArray(publicKeys) || publicKeys.length === 0) {
        reply.status(400);
        return { success: false, error: 'At least one public key is required' };
      }

      // Validate weights
      if (!Array.isArray(weights) || weights.length !== publicKeys.length) {
        reply.status(400);
        return { success: false, error: 'Weights array must match public keys length' };
      }

      // Validate threshold
      if (typeof threshold !== 'number' || threshold <= 0) {
        reply.status(400);
        return { success: false, error: 'Threshold must be a positive number' };
      }

      // Validate signatures
      if (!Array.isArray(signatures) || signatures.length === 0) {
        reply.status(400);
        return { success: false, error: 'At least one signature is required' };
      }

      const result = await keytoolService.combinePartialSignatures(
        publicKeys,
        weights,
        threshold,
        signatures
      );

      if (!result.success || !result.combinedSignature) {
        reply.status(500);
        return { success: false, error: result.error || 'Failed to combine signatures' };
      }

      return {
        success: true,
        data: {
          combinedSignature: result.combinedSignature,
          multiSigAddress: result.multiSigAddress,
        },
      };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  // Generate sample transaction for testing signing
  fastify.post<{
    Body: {
      address: string;
      txType?: SampleTxType;
    };
    Reply: ApiResponse<{
      txBytes: string;
      description: string;
    }>;
  }>('/generate-sample-tx', async (request, reply) => {
    try {
      const { address, txType } = request.body || {};

      // Validate address
      if (!address || typeof address !== 'string') {
        reply.status(400);
        return { success: false, error: 'Address is required' };
      }

      // Validate txType if provided
      const validTypes: SampleTxType[] = ['self-transfer', 'split-coin', 'merge-coins'];
      if (txType && !validTypes.includes(txType)) {
        reply.status(400);
        return { success: false, error: `Invalid txType. Must be one of: ${validTypes.join(', ')}` };
      }

      const result = await keytoolService.generateSampleTransaction(address, txType);

      if (!result.success || !result.txBytes) {
        reply.status(500);
        return { success: false, error: result.error || 'Failed to generate sample transaction' };
      }

      return {
        success: true,
        data: {
          txBytes: result.txBytes,
          description: result.description || 'Sample transaction',
        },
      };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  // Build unsigned transfer transaction (for multi-sig)
  fastify.post<{
    Body: {
      from: string;
      to: string;
      amount: string;
      coinObjectId?: string;
      gasBudget?: string;
    };
    Reply: ApiResponse<{
      txBytes: string;
      description: string;
    }>;
  }>('/build-transfer-tx', async (request, reply) => {
    try {
      const { from, to, amount, coinObjectId, gasBudget } = request.body || {};

      // Validate from address
      if (!from || typeof from !== 'string') {
        reply.status(400);
        return { success: false, error: 'From address is required' };
      }

      // Validate to address
      if (!to || typeof to !== 'string') {
        reply.status(400);
        return { success: false, error: 'To address is required' };
      }

      // Validate amount
      if (!amount || typeof amount !== 'string') {
        reply.status(400);
        return { success: false, error: 'Amount is required' };
      }

      const result = await keytoolService.buildTransferTransaction(
        from,
        to,
        amount,
        coinObjectId,
        gasBudget
      );

      if (!result.success || !result.txBytes) {
        reply.status(500);
        return { success: false, error: result.error || 'Failed to build transfer transaction' };
      }

      return {
        success: true,
        data: {
          txBytes: result.txBytes,
          description: result.description || 'Transfer transaction',
        },
      };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  // Execute signed transaction
  fastify.post<{
    Body: {
      txBytes: string;
      signature: string;
    };
    Reply: ApiResponse<{
      digest: string;
      status: string;
      gasUsed: string;
    }>;
  }>('/execute-signed-tx', async (request, reply) => {
    try {
      const { txBytes, signature } = request.body || {};

      // Validate transaction bytes
      if (!txBytes || typeof txBytes !== 'string') {
        reply.status(400);
        return { success: false, error: 'Transaction bytes are required' };
      }

      // Validate signature
      if (!signature || typeof signature !== 'string') {
        reply.status(400);
        return { success: false, error: 'Signature is required' };
      }

      const result = await keytoolService.executeSignedTransaction(txBytes, signature);

      if (!result.success || !result.digest) {
        reply.status(500);
        return { success: false, error: result.error || 'Failed to execute transaction' };
      }

      return {
        success: true,
        data: {
          digest: result.digest,
          status: result.status || 'unknown',
          gasUsed: result.gasUsed || '0',
        },
      };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });
}
