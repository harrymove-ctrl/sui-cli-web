import { FastifyInstance } from 'fastify';
import { WalrusMemoryService } from '../services/WalrusMemoryService';
import type { ApiResponse } from '@sui-cli-web/shared';
import { validateAddress, validateObjectId, ValidationException } from '../utils/validation';
import { handleRouteError } from '../utils/errorHandler';

const walrusMemoryService = new WalrusMemoryService();
const handleError = handleRouteError;

export async function walrusMemoryRoutes(fastify: FastifyInstance) {
  // Resolve + summarize the MemWalAccount for an owner address
  fastify.get<{
    Querystring: { address: string };
    Reply: ApiResponse<{ accountId: string | null; account: unknown }>;
  }>('/walrus-memory/account', async (request, reply) => {
    try {
      const address = validateAddress(request.query?.address);
      const accountId = await walrusMemoryService.getAccountId(address);
      const account = accountId ? await walrusMemoryService.getAccountDetails(accountId) : null;
      return { success: true, data: { accountId, account } };
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // Decrypt a Walrus Memory Blob's content using a keypair already present in
  // the local sui.keystore (never accepts raw key material over the wire).
  fastify.post<{
    Body: { blobObjectId: string; signerAddress: string };
    Reply: ApiResponse<unknown>;
  }>('/walrus-memory/decrypt', async (request, reply) => {
    try {
      const blobObjectId = validateObjectId(request.body?.blobObjectId, 'blobObjectId');
      const signerAddress = validateAddress(request.body?.signerAddress);
      const result = await walrusMemoryService.decryptBlob(blobObjectId, signerAddress);
      return { success: true, data: result };
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // Register a new delegate key on a MemWalAccount so a second address can
  // decrypt on behalf of the owner. Must be signed by the account owner
  // (owner's keypair must be in the local sui.keystore, active on the CLI).
  fastify.post<{
    Body: { accountId: string; ownerAddress: string; delegateAddress: string; label: string };
    Reply: ApiResponse<{ digest: string }>;
  }>('/walrus-memory/delegate', async (request, reply) => {
    try {
      const accountId = validateObjectId(request.body?.accountId, 'accountId');
      const ownerAddress = validateAddress(request.body?.ownerAddress, 'ownerAddress');
      const delegateAddress = validateAddress(request.body?.delegateAddress, 'delegateAddress');
      const label = (request.body?.label ?? '').trim();
      if (!label || label.length > 64 || label.includes('"') || /[\r\n]/.test(label)) {
        throw new ValidationException([
          { field: 'label', message: 'Label is required, must be 1-64 characters, and cannot contain quotes or newlines' },
        ]);
      }
      const result = await walrusMemoryService.addDelegateKey(accountId, ownerAddress, delegateAddress, label);
      return { success: true, data: result };
    } catch (error) {
      return handleError(error, reply);
    }
  });

  // Revoke a previously-registered delegate key. Must be signed by the
  // account owner (owner's keypair must be in the local sui.keystore).
  fastify.delete<{
    Body: { accountId: string; ownerAddress: string; delegateAddress: string };
    Reply: ApiResponse<{ digest: string }>;
  }>('/walrus-memory/delegate', async (request, reply) => {
    try {
      const accountId = validateObjectId(request.body?.accountId, 'accountId');
      const ownerAddress = validateAddress(request.body?.ownerAddress, 'ownerAddress');
      const delegateAddress = validateAddress(request.body?.delegateAddress, 'delegateAddress');
      const result = await walrusMemoryService.removeDelegateKey(accountId, ownerAddress, delegateAddress);
      return { success: true, data: result };
    } catch (error) {
      return handleError(error, reply);
    }
  });
}
