import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { GasCoin, SuiAddress } from '@sui-cli-web/shared';
import { z } from 'zod';
import { apiGet } from '../client.js';

function json(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

/** Read-only `wallet.*` tools - see docs/architecture/MCP_SERVER_DESIGN.md §3.
 * Write tools (`wallet_switch_active`/`create`/`remove`) and anything that can surface
 * a private key or recovery phrase (`wallet_export_private_key`, `wallet_import_key`)
 * are intentionally deferred - the latter per §4's explicit "ship last, opt-in only" rule. */
export function registerWalletTools(server: McpServer): void {
  server.registerTool(
    'wallet_list_addresses',
    {
      title: 'List wallet addresses',
      description:
        'List every address in the local Sui keystore, with alias, balance, object count, and which one is active.',
    },
    async () => json(await apiGet<SuiAddress[]>('/addresses'))
  );

  server.registerTool(
    'wallet_get_active_address',
    {
      title: 'Get active wallet address',
      description: 'Get the currently active Sui address.',
    },
    async () => json(await apiGet<{ address: string }>('/addresses/active'))
  );

  server.registerTool(
    'wallet_get_balance',
    {
      title: 'Get wallet SUI balance',
      description: 'Get the SUI balance for a given address.',
      inputSchema: { address: z.string().describe('The Sui address to look up, e.g. 0x...') },
    },
    async ({ address }) =>
      json(await apiGet<{ balance: string }>(`/addresses/${encodeURIComponent(address)}/balance`))
  );

  server.registerTool(
    'wallet_list_objects',
    {
      title: 'List objects owned by an address',
      description:
        'List objects owned by an address. Pass `type` (a Move type pattern) to filter to just objects of that type, otherwise every owned object is returned.',
      inputSchema: {
        address: z.string().describe('The Sui address to list objects for, e.g. 0x...'),
        type: z
          .string()
          .optional()
          .describe('Optional Move type pattern to filter by, e.g. 0x2::coin::Coin'),
      },
    },
    async ({ address, type }) => {
      const encoded = encodeURIComponent(address);
      const path = type
        ? `/addresses/${encoded}/objects/by-type?type=${encodeURIComponent(type)}`
        : `/addresses/${encoded}/objects`;
      return json(await apiGet<unknown[]>(path));
    }
  );

  server.registerTool(
    'wallet_list_gas_coins',
    {
      title: 'List gas coins for an address',
      description: 'List the SUI coin objects an address can use to pay gas, with balances.',
      inputSchema: {
        address: z.string().describe('The Sui address to list gas coins for, e.g. 0x...'),
      },
    },
    async ({ address }) =>
      json(await apiGet<GasCoin[]>(`/addresses/${encodeURIComponent(address)}/gas`))
  );
}
