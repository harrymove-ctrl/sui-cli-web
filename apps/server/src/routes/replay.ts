/**
 * Replay Routes - Enhanced transaction replay with trace support
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ReplayService, ReplayOptions, BatchReplayOptions } from '../services/dev/ReplayService';
import { handleRouteError } from '../utils/errorHandler';
import { validateTxDigest } from '../utils/validation';

export async function replayRoutes(fastify: FastifyInstance) {
  const service = new ReplayService();

  // POST /api/inspector/replay/enhanced - Enhanced replay with traces
  fastify.post<{
    Body: ReplayOptions;
  }>('/inspector/replay/enhanced', async (request, reply) => {
    try {
      const digest = validateTxDigest(request.body.digest, 'digest');
      const result = await service.replay({
        ...request.body,
        digest,
      });
      return result;
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  // POST /api/replay/legacy - Use legacy replay command
  fastify.post<{
    Body: { digest: string };
  }>('/inspector/replay/legacy', async (request, reply) => {
    try {
      const digest = validateTxDigest(request.body.digest, 'digest');
      const result = await service.replayLegacy(digest);
      return result;
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  // GET /api/replay/:digest/traces - List trace files
  fastify.get<{
    Params: { digest: string };
  }>('/inspector/replay/:digest/traces', async (request, reply) => {
    try {
      const digest = validateTxDigest(request.params.digest, 'digest');
      const files = await service.listTraceFiles(digest);
      return { success: true, files };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  // GET /api/replay/:digest/trace/:filename - Get trace file content
  fastify.get<{
    Params: { digest: string; filename: string };
  }>('/inspector/replay/:digest/trace/:filename', async (request, reply) => {
    try {
      const digest = validateTxDigest(request.params.digest, 'digest');
      const content = await service.getTraceFile(digest, request.params.filename);

      if (content === null) {
        reply.status(404);
        return { success: false, error: 'Trace file not found' };
      }

      return { success: true, content };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  // POST /api/replay/batch - Replay multiple transactions
  fastify.post<{
    Body: BatchReplayOptions;
  }>('/inspector/replay/batch', async (request, reply) => {
    try {
      // Validate all digests
      const digests = request.body.digests.map(d => validateTxDigest(d, 'digest'));
      const result = await service.batchReplay({
        ...request.body,
        digests,
      });
      return { success: true, ...result };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  // POST /api/replay/cleanup - Clean up old trace files
  fastify.post<{
    Body: { olderThanDays?: number };
  }>('/inspector/replay/cleanup', async (request, reply) => {
    try {
      const deleted = await service.cleanupTraces(request.body.olderThanDays);
      return { success: true, deleted };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  // GET /api/replay/stats - Get trace storage stats
  fastify.get('/inspector/replay/stats', async (request, reply) => {
    try {
      const stats = await service.getTraceStats();
      return { success: true, ...stats };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });
}
