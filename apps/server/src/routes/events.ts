/**
 * Events Routes - Event parsing and querying
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { EventService, EventFilter } from '../services/dev/EventService';
import { handleRouteError } from '../utils/errorHandler';
import { validateTxDigest, validateAddress } from '../utils/validation';

export async function eventsRoutes(fastify: FastifyInstance) {
  const service = new EventService();

  // GET /api/events/transaction/:digest - Get events from transaction
  fastify.get<{
    Params: { digest: string };
  }>('/inspector/events/transaction/:digest', async (request, reply) => {
    try {
      const digest = validateTxDigest(request.params.digest, 'digest');
      const result = await service.getTransactionEvents(digest);
      return result;
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  // POST /api/events/query - Query events with filters
  fastify.post<{
    Body: {
      filter: EventFilter;
      cursor?: string;
      limit?: number;
    };
  }>('/inspector/events/query', async (request, reply) => {
    try {
      const { filter, cursor, limit } = request.body;

      // Validate filter fields
      if (filter.packageId) {
        validateAddress(filter.packageId, 'packageId');
      }
      if (filter.sender) {
        validateAddress(filter.sender, 'sender');
      }
      if (filter.transactionDigest) {
        validateTxDigest(filter.transactionDigest, 'transactionDigest');
      }

      const result = await service.queryEvents(filter, cursor, limit || 50);
      return result;
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  // GET /api/events/schema/:packageId/:module/:eventName - Get event schema
  fastify.get<{
    Params: { packageId: string; module: string; eventName: string };
  }>('/inspector/events/schema/:packageId/:module/:eventName', async (request, reply) => {
    try {
      const { packageId, module, eventName } = request.params;
      validateAddress(packageId, 'packageId');

      const result = await service.getEventSchema(packageId, module, eventName);
      return result;
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  // POST /api/events/format - Format event for display
  fastify.post<{
    Body: {
      id: string;
      type: string;
      packageId: string;
      module: string;
      eventName: string;
      sender: string;
      transactionDigest: string;
      timestamp?: number;
      parsedFields: Record<string, any>;
      rawData: any;
    };
  }>('/inspector/events/format', async (request, reply) => {
    try {
      const formatted = service.formatEvent(request.body);
      return { success: true, ...formatted };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  // POST /api/events/filter - Filter events locally
  fastify.post<{
    Body: {
      events: any[];
      filter: Partial<EventFilter>;
    };
  }>('/inspector/events/filter', async (request, reply) => {
    try {
      const { events, filter } = request.body;
      const filtered = service.filterEvents(events, filter);
      return { success: true, events: filtered, count: filtered.length };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  // POST /api/events/group - Group events by type
  fastify.post<{
    Body: { events: any[] };
  }>('/inspector/events/group', async (request, reply) => {
    try {
      const groups = service.groupEventsByType(request.body.events);
      const result: Record<string, any[]> = {};
      for (const [type, events] of groups) {
        result[type] = events;
      }
      return { success: true, groups: result };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });
}
