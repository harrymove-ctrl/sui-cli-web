/**
 * Pairing token for routes that move funds or export key material.
 *
 * This server has no login system - anyone who can reach it can drive it.
 * CORS trusts the hosted UI's origin so that page can talk to a user's local
 * install, which means an HTTP endpoint reachable by this server is reachable
 * by that origin too. A pairing token only closes anything if it is NEVER
 * served over HTTP: the one channel the hosted origin cannot read is this
 * process's own stdout, so that is the only place the token is ever shown.
 */

import { randomBytes, timingSafeEqual } from 'crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const TOKEN_DIR = join(homedir(), '.sui-cli-web');
const TOKEN_PATH = join(TOKEN_DIR, 'auth-token');

let cachedToken: string | null = null;

/**
 * Reads the persisted token, generating and storing one on first run.
 * Cached in memory so repeated calls within a process don't re-read the file.
 */
export function getOrCreateAuthToken(): string {
  if (cachedToken) return cachedToken;

  if (existsSync(TOKEN_PATH)) {
    const existing = readFileSync(TOKEN_PATH, 'utf-8').trim();
    if (existing) {
      cachedToken = existing;
      return existing;
    }
  }

  const token = randomBytes(32).toString('hex');
  mkdirSync(TOKEN_DIR, { recursive: true });
  writeFileSync(TOKEN_PATH, token, { mode: 0o600 });
  try {
    chmodSync(TOKEN_PATH, 0o600);
  } catch {
    // Best-effort - chmod semantics differ on Windows.
  }
  cachedToken = token;
  return token;
}

function extractBearerToken(header: string | string[] | undefined): string | null {
  const value = Array.isArray(header) ? header[0] : header;
  if (!value) return null;
  const match = value.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

/** Constant-time comparison so a wrong guess can't be narrowed down via response timing. */
function tokensMatch(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Fastify preHandler for routes that move funds or export key material.
 * Requires `Authorization: Bearer <token>` matching the token printed in
 * this server's own startup banner - pairing a browser means copying that
 * value from the terminal, not fetching it from anywhere over the network.
 */
export async function requireAuthToken(request: FastifyRequest, reply: FastifyReply) {
  const provided = extractBearerToken(request.headers.authorization);
  const expected = getOrCreateAuthToken();

  if (!provided || !tokensMatch(provided, expected)) {
    reply.status(401);
    return reply.send({
      success: false,
      error:
        'This action requires pairing. Copy the token from your terminal and enter it when prompted.',
      code: 'PAIRING_REQUIRED',
    });
  }
}
