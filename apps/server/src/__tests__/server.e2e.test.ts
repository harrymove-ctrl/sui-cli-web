/**
 * End-to-end server smoke test.
 *
 * This boots the *real*, fully-assembled server - the same CORS config, the
 * same rate-limit hooks, every one of the ~25 route plugins, in the order
 * production registers them - via buildServer() + fastify.inject(). No port is
 * bound, so it cannot flake on a busy socket or a ready-poll race, and it runs
 * under the vitest the repo already has rather than dragging in a browser.
 *
 * What it is here to catch: the assembled server failing to boot at all (a bad
 * route plugin, a static-serving collision), a route silently unregistered, the
 * CORS allowlist regressing (which once turned every hosted asset into a 500),
 * and the devstack routes I added answering the wrong way on bad input or on a
 * hosted deployment.
 *
 * What it deliberately does NOT assert: anything that depends on a `sui` binary
 * or ~/.sui/sui_config. A CI runner has neither, a dev machine has both, so the
 * only stable contract is the *shape* of the answer - status 200 and a boolean
 * field - never its value. Asserting `suiInstalled: false` would pass in CI and
 * fail on every developer's machine.
 */

import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildServer } from '../index';

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildServer();
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe('server boots and serves the liveness contract', () => {
  it('answers /api/health with 200 - the string the web app polls for', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'ok' });
  });

  it('answers /api/status with a boolean install flag, whatever its value', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/status' });

    expect(res.statusCode).toBe(200);
    // Value differs by environment (true on a dev box, false in CI); only the
    // shape is a contract.
    expect(typeof res.json().suiInstalled).toBe('boolean');
  });

  it('returns a structured JSON 404 for an unknown /api route', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/does-not-exist' });

    expect(res.statusCode).toBe(404);
    expect(res.json()).toMatchObject({ error: 'API route not found' });
  });
});

describe('CORS allowlist', () => {
  it('echoes a localhost origin rather than rejecting it', async () => {
    // The regression that once made every hosted asset a 500 was a dropped
    // allowlist entry; a loopback origin must always be allowed back.
    const res = await app.inject({
      method: 'GET',
      url: '/api/health',
      headers: { origin: 'http://localhost:5174' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5174');
  });

  it('denies an unknown origin without turning it into a 500', async () => {
    // An access decision is not a server fault: the request still succeeds, it
    // just gets no allow-origin header back for the browser to honour.
    const res = await app.inject({
      method: 'GET',
      url: '/api/health',
      headers: { origin: 'https://evil.example.com' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('devstack routes are wired through the real stack', () => {
  it('rejects a capabilities request with no dir', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/devstack/capabilities' });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ success: false });
  });

  it('rejects an attach request with no dir', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/devstack/attach',
      payload: {},
    });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ success: false });
  });

  it('refuses a path outside the home tree with a structured error, not a crash', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/devstack/capabilities?dir=/etc',
    });

    // The point is that the process is still answering: a rejected path is a
    // handled error, never an unhandled throw that would take the server down.
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
    expect(res.json().success).toBe(false);
  });

  it('answers 503 on a hosted deployment instead of inspecting a shared container', async () => {
    // isHostedDeployment() reads this per-request, so setting it here exercises
    // the guard without rebuilding the server.
    process.env.RAILWAY_SERVICE_ID = 'test-service';
    try {
      const res = await app.inject({
        method: 'GET',
        url: '/api/devstack/capabilities?dir=/tmp/whatever',
      });
      expect(res.statusCode).toBe(503);
    } finally {
      delete process.env.RAILWAY_SERVICE_ID;
    }
  });
});
