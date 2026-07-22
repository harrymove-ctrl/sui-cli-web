/**
 * Outputs Routes - Large output file management
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { OutputService } from '../services/core/OutputService';
import { handleRouteError } from '../utils/errorHandler';

export async function outputsRoutes(fastify: FastifyInstance) {
  const service = OutputService.getInstance();

  // GET /api/outputs - List all stored outputs
  fastify.get('/outputs', async (request, reply) => {
    try {
      const outputs = await service.listOutputs();
      return { success: true, outputs };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  // GET /api/outputs/:id - Get output by ID
  fastify.get<{
    Params: { id: string };
  }>('/outputs/:id', async (request, reply) => {
    try {
      const output = await service.getOutput(request.params.id);

      if (!output) {
        reply.status(404);
        return { success: false, error: 'Output not found' };
      }

      return { success: true, ...output };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  // GET /api/outputs/:id/download - Download output as file
  fastify.get<{
    Params: { id: string };
  }>('/outputs/:id/download', async (request, reply) => {
    try {
      const { data, filename, contentType } = await service.downloadOutput(request.params.id);

      reply.header('Content-Type', contentType);
      reply.header('Content-Disposition', `attachment; filename="${filename}"`);

      return data;
    } catch (error) {
      if ((error as Error).message.includes('not found')) {
        reply.status(404);
        return { success: false, error: 'Output not found' };
      }
      return handleRouteError(error, reply);
    }
  });

  // DELETE /api/outputs/:id - Delete output
  fastify.delete<{
    Params: { id: string };
  }>('/outputs/:id', async (request, reply) => {
    try {
      await service.deleteOutput(request.params.id);
      return { success: true };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  // POST /api/outputs/cleanup - Cleanup old outputs
  fastify.post<{
    Body: { olderThanHours?: number };
  }>('/outputs/cleanup', async (request, reply) => {
    try {
      const deleted = await service.cleanup(request.body.olderThanHours);
      return { success: true, deleted };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  // GET /api/outputs/stats - Get storage stats
  fastify.get('/outputs/stats', async (request, reply) => {
    try {
      const stats = await service.getStats();
      return { success: true, ...stats };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  // POST /api/outputs/store - Store a new output (internal use)
  fastify.post<{
    Body: {
      data: string;
      type: 'trace' | 'coverage' | 'build' | 'test' | 'replay' | 'other';
      command?: string;
      digest?: string;
      packagePath?: string;
    };
  }>('/outputs/store', async (request, reply) => {
    try {
      const { data, ...metadata } = request.body;

      if (!data) {
        reply.status(400);
        return { success: false, error: 'data is required' };
      }

      const reference = await service.storeLargeOutput(data, metadata);
      return { success: true, ...reference };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });
}
