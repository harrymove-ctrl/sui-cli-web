/**
 * Devstack bridge routes.
 *
 * Read-only by construction: this exposes what a devstack project on *this
 * machine* looks like, plus one write that goes through the `sui` CLI's own
 * env list. There is deliberately no boot/stop endpoint - `devstack up`
 * requires Docker and runs containers, and this server has no authentication,
 * so an unauthenticated POST must never be able to start one.
 *
 * On a hosted deployment every route here answers 503: the filesystem it would
 * inspect belongs to a shared container, not to the person asking.
 */

import type {
  ApiResponse,
  DevstackAttachResult,
  DevstackCapabilities,
  DevstackDeployment,
} from '@sui-cli-web/shared';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { DevstackService } from '../services/DevstackService';
import { handleRouteError } from '../utils/errorHandler';
import { isHostedDeployment } from '../utils/pathSafety';

/** Shared guard: hosted instances have no user machine to inspect. */
function refuseIfHosted(reply: FastifyReply): boolean {
  if (!isHostedDeployment()) return false;
  reply.status(503);
  return true;
}

export async function devstackRoutes(fastify: FastifyInstance) {
  const service = DevstackService.getInstance();

  /**
   * GET /api/devstack/capabilities?dir=<projectDir>
   *
   * Answers "can this machine use devstack, and why not". `installed: false`
   * is the expected answer for most users and is still a 200 - the UI needs to
   * render an explanation, not an error toast.
   */
  fastify.get<{
    Querystring: { dir?: string };
    Reply: ApiResponse<DevstackCapabilities>;
  }>('/devstack/capabilities', async (request, reply) => {
    if (refuseIfHosted(reply)) {
      return { success: false, error: 'Devstack inspection is only available on a local server' };
    }
    try {
      const dir = request.query.dir?.trim();
      if (!dir) {
        reply.status(400);
        return { success: false, error: 'dir is required' };
      }
      return { success: true, data: await service.getCapabilities(dir) };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  /**
   * GET /api/devstack/deployment?dir=<projectDir>
   *
   * The stack's endpoints, packages and funded accounts. `data: null` means
   * the project has a config but has never been booted, which is a normal
   * state and not a 404.
   */
  fastify.get<{
    Querystring: { dir?: string };
    Reply: ApiResponse<DevstackDeployment | null>;
  }>('/devstack/deployment', async (request, reply) => {
    if (refuseIfHosted(reply)) {
      return { success: false, error: 'Devstack inspection is only available on a local server' };
    }
    try {
      const dir = request.query.dir?.trim();
      if (!dir) {
        reply.status(400);
        return { success: false, error: 'dir is required' };
      }
      return { success: true, data: await service.getDeployment(dir) };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  /**
   * POST /api/devstack/attach { dir, network? }
   *
   * Registers the stack's RPC as a `sui client` env and switches to it, so
   * every other feature in the product follows without knowing devstack
   * exists. Idempotent: re-attaching an unchanged stack reuses the alias.
   */
  fastify.post<{
    Body: { dir?: string; network?: string };
    Reply: ApiResponse<DevstackAttachResult>;
  }>('/devstack/attach', async (request, reply) => {
    if (refuseIfHosted(reply)) {
      return { success: false, error: 'Devstack inspection is only available on a local server' };
    }
    try {
      const { dir, network } = request.body ?? {};
      if (!dir?.trim()) {
        reply.status(400);
        return { success: false, error: 'dir is required' };
      }
      return { success: true, data: await service.attach(dir.trim(), network) };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });
}
