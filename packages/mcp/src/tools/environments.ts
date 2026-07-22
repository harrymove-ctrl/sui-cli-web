import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { SuiEnvironment } from '@sui-cli-web/shared';
import { apiGet } from '../client.js';

interface ChainIdentifierResult {
  chainId: string;
  network?: string;
}

function json(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

/** Read-only `environment.*` tools - see docs/architecture/MCP_SERVER_DESIGN.md §3.
 * Write tools (`environment_switch`/`add`/`remove`) are intentionally deferred to a
 * later pass, once the confirmation-token flow from §4 exists. */
export function registerEnvironmentTools(server: McpServer): void {
  server.registerTool(
    'environment_list',
    {
      title: 'List Sui environments',
      description:
        'List every Sui RPC environment (network) configured on this machine - alias, RPC URL, optional websocket URL, and which one is active.',
    },
    async () => json(await apiGet<SuiEnvironment[]>('/environments'))
  );

  server.registerTool(
    'environment_get_active',
    {
      title: 'Get active Sui environment',
      description:
        'Get the alias of the currently active Sui environment (network), or null if none is set.',
    },
    async () => json(await apiGet<{ alias: string | null }>('/environments/active'))
  );

  server.registerTool(
    'environment_get_chain_id',
    {
      title: 'Get Sui chain identifier',
      description:
        'Get the chain identifier of the active environment and which known network it maps to (mainnet/testnet/devnet/custom) - use this to confirm you are on the network you expect before reasoning about anything else.',
    },
    async () => json(await apiGet<ChainIdentifierResult>('/environments/chain-id'))
  );
}
