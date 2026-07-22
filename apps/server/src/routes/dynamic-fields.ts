import { FastifyInstance } from 'fastify';
import { SuiCliExecutor } from '../cli/SuiCliExecutor.js';
import type { ApiResponse } from '@sui-cli-web/shared';
import { validateObjectId } from '../utils/validation';
import { handleRouteError } from '../utils/errorHandler';

export async function dynamicFieldsRoutes(fastify: FastifyInstance) {
  const cli = SuiCliExecutor.getInstance();

  // GET /api/dynamic-fields/:objectId
  // Query dynamic fields of an object
  // sui client dynamic-field <object_id> [--cursor <cursor>] [--limit <limit>] --json
  fastify.get<{
    Params: { objectId: string };
    Querystring: { cursor?: string; limit?: string };
    Reply: ApiResponse<{
      objectId: string;
      data: any;
      nextCursor: string | null;
      hasNextPage: boolean;
    }>;
  }>('/:objectId', async (request, reply) => {
    try {
      // Validate and normalize objectId
      const objectId = validateObjectId(request.params.objectId);
      const { cursor, limit } = request.query;

      // Validate limit if provided (must be positive integer, max 1000)
      if (limit !== undefined) {
        const limitNum = parseInt(limit, 10);
        if (isNaN(limitNum) || limitNum < 1 || limitNum > 1000) {
          reply.status(400);
          return { success: false, error: 'Invalid limit (must be 1-1000)' };
        }
      }

      // Build command args
      const args = ['client', 'dynamic-field', objectId];
      if (cursor) {
        args.push('--cursor', cursor);
      }
      if (limit) {
        args.push('--limit', limit);
      }
      args.push('--json');

      // Execute CLI command
      const result = await cli.execute(args);

      // Parse JSON output
      const parsed = JSON.parse(result);

      return {
        success: true,
        data: {
          objectId,
          data: parsed.data || parsed,
          nextCursor: parsed.nextCursor || null,
          hasNextPage: parsed.hasNextPage || false,
        },
      };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });
}
