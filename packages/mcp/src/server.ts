#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { checkHealth, describeTarget, resolveBaseUrl } from './client.js';
import { registerEnvironmentTools } from './tools/environments.js';
import { registerWalletTools } from './tools/wallets.js';

async function main() {
  // Never fall back to shelling out to `sui` if the server isn't reachable - that would
  // recreate the exact problem this package exists to avoid (see
  // docs/architecture/MCP_SERVER_DESIGN.md §1/§2). Fail fast with a clear message instead.
  const healthy = await checkHealth();
  if (!healthy) {
    console.error(
      `sui-cli-web-server is not reachable (looked at ${describeTarget()}) - start it with ` +
        '`npx sui-cli-web-server`, or set SUI_CLI_WEB_PORT / SUI_CLI_WEB_SERVER_URL if it is ' +
        'running somewhere this does not scan.'
    );
    process.exit(1);
  }

  // Report where it landed: with discovery in play, "which server am I talking
  // to" is no longer obvious from the config, and stderr is the only channel a
  // stdio MCP server has.
  console.error(`sui-cli-web-mcp connected to ${await resolveBaseUrl()}`);

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
