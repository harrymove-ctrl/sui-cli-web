/**
 * Migration Routes - Move 2024 migration
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { MigrationService } from '../services/dev/MigrationService';
import { handleRouteError } from '../utils/errorHandler';

export async function migrationRoutes(fastify: FastifyInstance) {
  const service = new MigrationService();

  // GET /api/move/migrate/status - Check migration status
  fastify.get<{
    Querystring: { packagePath: string };
  }>('/move/migrate/status', async (request, reply) => {
    try {
      const { packagePath } = request.query;

      if (!packagePath) {
        reply.status(400);
        return { success: false, error: 'packagePath is required' };
      }

      const status = await service.checkMigrationStatus(packagePath);
      return { success: true, ...status };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  // POST /api/move/migrate/preview - Preview migration changes
  fastify.post<{
    Body: { packagePath: string };
  }>('/move/migrate/preview', async (request, reply) => {
    try {
      const { packagePath } = request.body;

      if (!packagePath) {
        reply.status(400);
        return { success: false, error: 'packagePath is required' };
      }

      const preview = await service.preview(packagePath);
      return { success: true, ...preview };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  // POST /api/move/migrate - Apply migration
  fastify.post<{
    Body: { packagePath: string; createBackup?: boolean };
  }>('/move/migrate', async (request, reply) => {
    try {
      const { packagePath, createBackup } = request.body;

      if (!packagePath) {
        reply.status(400);
        return { success: false, error: 'packagePath is required' };
      }

      const result = await service.migrate(packagePath, createBackup !== false);
      return result;
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  // POST /api/move/migrate/restore - Restore from backup
  fastify.post<{
    Body: { packagePath: string; backupPath: string };
  }>('/move/migrate/restore', async (request, reply) => {
    try {
      const { packagePath, backupPath } = request.body;

      if (!packagePath || !backupPath) {
        reply.status(400);
        return { success: false, error: 'packagePath and backupPath are required' };
      }

      const result = await service.restore(packagePath, backupPath);
      return result;
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  // GET /api/move/migrate/backups - List available backups
  fastify.get<{
    Querystring: { packagePath: string };
  }>('/move/migrate/backups', async (request, reply) => {
    try {
      const { packagePath } = request.query;

      if (!packagePath) {
        reply.status(400);
        return { success: false, error: 'packagePath is required' };
      }

      const backups = await service.listBackups(packagePath);
      return { success: true, backups };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });
}
