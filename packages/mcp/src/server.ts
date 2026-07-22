#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { checkHealth, getBaseUrl } from './client.js';
import { registerEnvironmentTools } from './tools/environments.js';
import { registerWalletTools } from './tools/wallets.js';

async function main() {
  // Never fall back to shelling out to `sui` if the server isn't reachable - that would
  // recreate the exact problem this package exists to avoid (see
  // docs/architecture/MCP_SERVER_DESIGN.md §1/§2). Fail fast with a clear message instead.
  const healthy = await checkHealth();
  if (!healthy) {
    console.error(
      `sui-cli-web-server is not running at ${getBaseUrl()} - start it first with \`npx sui-cli-web\`, ` +
        `or set SUI_CLI_WEB_SERVER_URL if it's running on a different host/port.`
    );
    process.exit(1);
  }

  const server = new McpServer({ name: 'sui-cli-web-mcp', version: '0.1.0' });
  registerEnvironmentTools(server);
  registerWalletTools(server);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error('sui-cli-web-mcp failed to start:', error);
  process.exit(1);
});
