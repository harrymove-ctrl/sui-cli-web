/**
 * Local Network Routes - sui start management
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ProcessManager, LocalNetworkConfig } from '../services/core/ProcessManager';
import { handleRouteError } from '../utils/errorHandler';
import { createSSEResponse } from '../utils/sse';

export async function localNetworkRoutes(fastify: FastifyInstance) {
  const manager = ProcessManager.getInstance();

  // POST /api/network/start - Start local network
  fastify.post<{
    Body: LocalNetworkConfig;
  }>('/network/start', async (request, reply) => {
    try {
      const processId = await manager.startLocalNetwork(request.body);
      return {
        success: true,
        processId,
        message: 'Local network starting...',
      };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  // POST /api/network/stop - Stop local network
  fastify.post<{
    Body: { processId: string };
  }>('/network/stop', async (request, reply) => {
    try {
      const { processId } = request.body;

      if (!processId) {
        reply.status(400);
        return { success: false, error: 'processId is required' };
      }

      await manager.stopProcess(processId);
      return { success: true, message: 'Network stopped' };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  // GET /api/network/status - Get all network process statuses
  fastify.get('/network/status', async (request, reply) => {
    try {
      const processes = manager.getProcessesByType('local-network');
      return { success: true, processes };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  // GET /api/network/status/:processId - Get specific process status
  fastify.get<{
    Params: { processId: string };
  }>('/network/status/:processId', async (request, reply) => {
    try {
      const process = manager.getProcessStatus(request.params.processId);

      if (!process) {
        reply.status(404);
        return { success: false, error: 'Process not found' };
      }

      return { success: true, process };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  // GET /api/network/health - Check network health
  fastify.get('/network/health', async (request, reply) => {
    try {
      const health = await manager.checkNetworkHealth();
      return { success: true, ...health };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  // GET /api/network/output/:processId - Get recent output
  fastify.get<{
    Params: { processId: string };
    Querystring: { lines?: string };
  }>('/network/output/:processId', async (request, reply) => {
    try {
      const lines = parseInt(request.query.lines || '100', 10);
      const output = manager.getRecentOutput(request.params.processId, lines);
      return { success: true, output };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  // GET /api/network/stream/:processId - SSE stream for output
  fastify.get<{
    Params: { processId: string };
  }>('/network/stream/:processId', async (request, reply) => {
    const { processId } = request.params;

    // Check if process exists
    const processInfo = manager.getProcessStatus(processId);
    if (!processInfo) {
      reply.status(404);
      return { success: false, error: 'Process not found' };
    }

    // Create SSE response
    const sse = createSSEResponse(reply);

    // Send initial status
    sse.send({
      type: 'status',
      process: processInfo,
    });

    // Send recent output
    const recentOutput = manager.getRecentOutput(processId, 50);
    for (const line of recentOutput) {
      sse.output(line);
    }

    // Subscribe to new output
    const unsubscribe = manager.subscribe(processId, (output) => {
      if (!sse.isOpen()) {
        unsubscribe();
        return;
      }

      switch (output.type) {
        case 'stdout':
        case 'stderr':
          sse.output(output.data || '', output.type);
          break;
        case 'exit':
          sse.send({ type: 'exit', code: output.code });
          sse.close();
          break;
        case 'error':
          sse.error(output.data || 'Unknown error');
          break;
      }
    });

    // Handle client disconnect
    request.raw.on('close', () => {
      unsubscribe();
      sse.close();
    });
  });

  // POST /api/network/input/:processId - Send input to process
  fastify.post<{
    Params: { processId: string };
    Body: { input: string };
  }>('/network/input/:processId', async (request, reply) => {
    try {
      const { processId } = request.params;
      const { input } = request.body;

      if (!input) {
        reply.status(400);
        return { success: false, error: 'input is required' };
      }

      manager.sendInput(processId, input);
      return { success: true };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  // GET /api/network/all - Get all managed processes
  fastify.get('/network/all', async (request, reply) => {
    try {
      const processes = manager.getAllProcesses();
      return { success: true, processes };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });
}
