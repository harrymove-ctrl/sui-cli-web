/**
 * PTB Builder Routes - Visual PTB construction and execution
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PtbBuilderService, PtbCommand, PtbBuildRequest } from '../services/dev/PtbBuilderService';
import { handleRouteError } from '../utils/errorHandler';

export async function ptbBuilderRoutes(fastify: FastifyInstance) {
  const service = new PtbBuilderService();

  // POST /api/ptb/validate - Validate PTB commands
  fastify.post<{
    Body: { commands: PtbCommand[] };
  }>('/inspector/ptb-builder/validate', async (request, reply) => {
    try {
      const result = service.validateCommands(request.body.commands);
      return { success: true, ...result };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  // POST /api/ptb/build - Build and execute PTB
  fastify.post<{
    Body: PtbBuildRequest;
  }>('/inspector/ptb-builder/build', async (request, reply) => {
    try {
      const result = await service.executePtb(request.body);
      return result;
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  // GET /api/ptb/templates - Get common PTB templates
  fastify.get('/inspector/ptb-builder/templates', async (request, reply) => {
    try {
      const templates = service.getTemplates();
      return { success: true, templates };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  // GET /api/ptb/types - Get common Move types
  fastify.get('/inspector/ptb-builder/types', async (request, reply) => {
    try {
      const types = service.getCommonTypes();
      return { success: true, types };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  // POST /api/ptb/variables - Get available variables at a given point
  fastify.post<{
    Body: { commands: PtbCommand[]; currentIndex: number };
  }>('/inspector/ptb-builder/variables', async (request, reply) => {
    try {
      const variables = service.getAvailableVariables(
        request.body.commands,
        request.body.currentIndex
      );
      return { success: true, variables };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  // POST /api/ptb/preview - Preview CLI command without executing
  fastify.post<{
    Body: PtbBuildRequest;
  }>('/inspector/ptb-builder/preview', async (request, reply) => {
    try {
      const args = service.buildCliArgs(request.body);
      const cliCommand = `sui ${args.join(' ')}`;
      return { success: true, cliCommand, args };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });
}
