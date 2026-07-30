import { getApiBaseUrl, getConnectionStatus, getServerPort } from '@/api/client';

/**
 * Builds the payload behind every "Copy for AI" menu.
 *
 * These used to be pre-written questions ("summarise my portfolio and flag
 * anything worth attention"), which assumed one intent and read badly when the
 * page was empty. This hands the model context instead - live state, the API
 * actually serving this page, and the domain rules that make an answer correct -
 * and leaves the request to whoever pasted it.
 */

export type ApiEndpoint = {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  body?: string;
  effect: string;
  /** Signs and/or broadcasts. Surfaces a warning and is called out in the table. */
  mutating?: boolean;
};

export interface AiContextInput {
  /** e.g. "Sui wallet portfolio" */
  title: string;
  /** One or two lines on what the page is doing. */
  intro: string[];
  /** Serialised page state - pass the same JSON the "Copy as JSON" item uses. */
  stateJson: string;
  endpoints: ApiEndpoint[];
  /** Domain facts an LLM otherwise gets wrong. */
  rules: string[];
  /** Suggestions, phrased as options - never as an instruction to follow. */
  examples: string[];
  /** Optional extra markdown appended before the handoff (tables, listings). */
  extra?: string;
}

export function buildAiContext({
  title,
  intro,
  stateJson,
  endpoints,
  rules,
  examples,
  extra,
}: AiContextInput): string {
  const base = getApiBaseUrl();
  const port = getServerPort();
  const connected = getConnectionStatus();
  const hasMutating = endpoints.some((e) => e.mutating);
  const readPath = endpoints.find((e) => e.method === 'GET')?.path;

  return [
    `# ${title} - working context`,
    '',
    ...intro,
    '',
    '## State',
    '```json',
    stateJson,
    '```',
    '',
    ...(extra ? [extra, ''] : []),
    '## Live API',
    '',
    // The UI may be served from anywhere (a deployed host, a dev server); the
    // API is always a LOCAL process, because it shells out to the user's own
    // Sui CLI and keypair. The client finds it by scanning localhost ports, so
    // the base below is whatever it discovered on this machine - not the
    // origin this page happens to be served from.
    "The `sui-cli-web` server is a local process that wraps the user's own Sui",
    "CLI and keypair. It is not this page's origin - the UI can be served from",
    'anywhere and still talks to localhost.',
    '',
    connected
      ? `Discovered on this machine at \`${base}\`${port ? ` (port ${port})` : ''}.`
      : `Not currently reachable. Last known base: \`${base}\`. Start it with \`npx sui-cli-web\` and re-check \`/health\`.`,
    '',
    'An agent running on this same machine (terminal, IDE) can call it directly.',
    'The port is discovered per machine and per run - do not hardcode it; read it',
    'from this block or probe `/health` across the common ports',
    '(3001-3005, 4001, 4002, 8001, 8080).',
    '',
    'All bodies are JSON.',
    '',
    '| Method | Endpoint | Body | Effect |',
    '|---|---|---|---|',
    ...endpoints.map(
      (e) =>
        `| ${e.method} | \`${e.path}\` | ${e.body ? `\`${e.body}\`` : '-'} | ${
          e.mutating ? '**' : ''
        }${e.effect}${e.mutating ? '**' : ''} |`
    ),
    '',
    ...(readPath ? ['```bash', `curl -s ${base}${readPath}`, '```', ''] : []),
    ...(hasMutating
      ? [
          '> The bolded endpoints sign with the active local keypair and broadcast',
          '> immediately - there is no confirmation step. Dry-run first where one',
          '> exists, and do not call them unless the user explicitly asked for that',
          '> action.',
          '',
        ]
      : []),
    '## Rules that constrain a correct answer',
    ...rules.map((r) => `- ${r}`),
    '',
    '---',
    '',
    `State your request below (e.g. ${examples.join('; ')}).`,
  ].join('\n');
}
