/**
 * Thin HTTP client for the local `sui-cli-web-server` Fastify API. Every MCP
 * tool goes through this - never shells out to `sui` directly (see
 * docs/architecture/MCP_SERVER_DESIGN.md §1/§2 for why: input validation,
 * rate limiting, and the "keys never leave the machine" guarantee all live
 * server-side already, and re-implementing them here would just recreate the
 * problem this package exists to avoid).
 */

import { COMMON_SERVER_PORTS, DEFAULT_SERVER_PORT } from '@sui-cli-web/shared';

/**
 * How long to wait for one port before moving to the next. Short on purpose:
 * a closed port refuses immediately, so this only bounds the pathological
 * case where something is listening but not answering.
 */
const PROBE_TIMEOUT_MS = 1500;

function normalizeBase(value: string): string {
  const withScheme = /^https?:\/\//.test(value) ? value : `http://${value}`;
  return withScheme.replace(/\/+$/, '');
}

/**
 * Explicit configuration, if any. `SUI_CLI_WEB_SERVER_URL` takes a full URL;
 * `SUI_CLI_WEB_PORT` takes just a port, for the common case of "I started the
 * server on a different port". Either one disables discovery entirely - if you
 * said where it is, a scan finding something else would be worse than failing.
 */
function configuredBase(): string | null {
  const url = process.env.SUI_CLI_WEB_SERVER_URL?.trim();
  if (url) return normalizeBase(url);

  const port = process.env.SUI_CLI_WEB_PORT?.trim();
  if (port) {
    const parsed = Number(port);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
      throw new Error(`SUI_CLI_WEB_PORT is not a valid port: ${port}`);
    }
    return `http://127.0.0.1:${parsed}`;
  }

  return null;
}

/**
 * Identify a candidate as *this* server, not merely as something alive.
 *
 * `/health` reports `service`, `/api/health` does not - it returns only
 * `{ status, timestamp, port }`. Probing the latter means any app on a scanned
 * port that answers `{"status":"ok"}` is accepted, and 3001 is a popular port.
 * Connecting an agent with wallet tools to the wrong process is not a failure
 * mode worth leaving open for the sake of one field.
 */
async function isOurServer(base: string): Promise<boolean> {
  try {
    const response = await fetch(`${base}/health`, {
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    if (!response.ok) return false;
    const body = (await response.json()) as { status?: string; service?: string };
    return body.status === 'ok' && body.service === 'sui-cli-web-server';
  } catch {
    return false;
  }
}

/**
 * Resolved once and reused. Discovery is a scan, and re-running it on every
 * tool call would put a burst of connection attempts in front of every request
 * for no benefit - the server does not move while the MCP process is alive.
 */
let resolved: string | null = null;
let resolving: Promise<string> | null = null;

async function discover(): Promise<string> {
  // Ports are probed in order and sequentially rather than in parallel: the
  // first healthy one wins, and racing them would make which server you get
  // depend on scheduling when more than one is running.
  for (const port of COMMON_SERVER_PORTS) {
    const base = `http://127.0.0.1:${port}`;
    if (await isOurServer(base)) return base;
  }
  throw new Error(
    `Could not find sui-cli-web-server on any of ports ${COMMON_SERVER_PORTS.join(', ')}. ` +
      'Start it with `npx sui-cli-web-server`, or set SUI_CLI_WEB_PORT / ' +
      'SUI_CLI_WEB_SERVER_URL if it is running somewhere else.'
  );
}

/** The server's base URL, discovering it on first use. */
export async function resolveBaseUrl(): Promise<string> {
  if (resolved) return resolved;

  const configured = configuredBase();
  if (configured) {
    resolved = configured;
    return resolved;
  }

  // Share one in-flight discovery between concurrent callers.
  if (!resolving) {
    resolving = discover()
      .then((base) => {
        resolved = base;
        return base;
      })
      .finally(() => {
        resolving = null;
      });
  }
  return resolving;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/** GET a `/api/...` route and unwrap its `ApiResponse<T>` envelope. Throws a
 * plain Error (the server's own `error` message) on `success: false` or a
 * network failure - callers don't need to know about the envelope shape. */
export async function apiGet<T>(path: string): Promise<T> {
  const base = await resolveBaseUrl();
  const url = `${base}/api${path}`;
  let response: Response;
  try {
    response = await fetch(url);
  } catch (error) {
    throw new Error(
      `Could not reach sui-cli-web-server at ${base} (${error instanceof Error ? error.message : String(error)}). Is it running?`
    );
  }

  const body = (await response.json().catch(() => null)) as ApiResponse<T> | null;
  if (!body || !body.success) {
    throw new Error(body?.error ?? `Request to ${path} failed with status ${response.status}`);
  }
  return body.data as T;
}

/** `/api/health` returns a raw, unwrapped shape (not `ApiResponse`) - used
 * only for the startup gate, not as a general-purpose tool. Resolving the base
 * URL is itself the health check when discovery is in play. */
export async function checkHealth(): Promise<boolean> {
  try {
    const base = await resolveBaseUrl();
    // A configured base has not been probed yet; a discovered one already has.
    return configuredBase() ? await isOurServer(base) : true;
  } catch {
    return false;
  }
}

/**
 * Where the client is pointing, for error messages. Returns the resolved base
 * once known, the configured one if set, and otherwise a description of what
 * will be searched - never a single hardcoded port that may be wrong.
 */
export function describeTarget(): string {
  if (resolved) return resolved;
  try {
    const configured = configuredBase();
    if (configured) return configured;
  } catch {
    // Fall through to the port list; the invalid value is reported elsewhere.
  }
  return `ports ${COMMON_SERVER_PORTS.join(', ')} on 127.0.0.1`;
}

/** @deprecated Use {@link resolveBaseUrl} (async) or {@link describeTarget}. */
export function getBaseUrl(): string {
  return resolved ?? `http://127.0.0.1:${DEFAULT_SERVER_PORT}`;
}
