/**
 * Thin HTTP client for the local `sui-cli-web-server` Fastify API. Every MCP
 * tool goes through this - never shells out to `sui` directly (see
 * docs/architecture/MCP_SERVER_DESIGN.md §1/§2 for why: input validation,
 * rate limiting, and the "keys never leave the machine" guarantee all live
 * server-side already, and re-implementing them here would just recreate the
 * problem this package exists to avoid).
 */

const BASE_URL = process.env.SUI_CLI_WEB_SERVER_URL ?? 'http://127.0.0.1:3001';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/** GET a `/api/...` route and unwrap its `ApiResponse<T>` envelope. Throws a
 * plain Error (the server's own `error` message) on `success: false` or a
 * network failure - callers don't need to know about the envelope shape. */
export async function apiGet<T>(path: string): Promise<T> {
  const url = `${BASE_URL}/api${path}`;
  let response: Response;
  try {
    response = await fetch(url);
  } catch (error) {
    throw new Error(
      `Could not reach sui-cli-web-server at ${BASE_URL} (${error instanceof Error ? error.message : String(error)}). Is it running?`
    );
  }

  const body = (await response.json().catch(() => null)) as ApiResponse<T> | null;
  if (!body || !body.success) {
    throw new Error(body?.error ?? `Request to ${path} failed with status ${response.status}`);
  }
  return body.data as T;
}

/** `/api/health` returns a raw, unwrapped shape (not `ApiResponse`) - used
 * only for the startup gate, not as a general-purpose tool. */
export async function checkHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${BASE_URL}/api/health`);
    if (!response.ok) return false;
    const body = (await response.json()) as { status?: string };
    return body.status === 'ok';
  } catch {
    return false;
  }
}

export function getBaseUrl(): string {
  return BASE_URL;
}
