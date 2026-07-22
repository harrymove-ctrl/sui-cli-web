import { ConfigParser } from '../cli/ConfigParser';
import { SuiCliExecutor } from '../cli/SuiCliExecutor';
import type { SuiEnvironment } from '@sui-cli-web/shared';

export interface ChainIdentifierResult {
  chainId: string;
  network?: string; // mainnet, testnet, devnet, localnet, custom
}

export class EnvironmentService {
  private configParser: ConfigParser;
  private executor: SuiCliExecutor;

  constructor() {
    this.configParser = ConfigParser.getInstance();
    this.executor = SuiCliExecutor.getInstance();
  }

  public async getActiveEnvironment(): Promise<string | null> {
    const config = await this.configParser.getConfig();
    return config?.active_env || null;
  }

  /**
   * Get the chain identifier from the current RPC endpoint
   * Uses `sui client chain-identifier` command
   */
  public async getChainIdentifier(): Promise<ChainIdentifierResult> {
    const output = await this.executor.execute(['client', 'chain-identifier']);
    const chainId = output.trim();

    // Try to detect network from chain ID
    let network: string | undefined;
    if (chainId === '35834a8a') {
      network = 'mainnet';
    } else if (chainId === '4c78adac') {
      network = 'testnet';
    } else if (chainId === '59c26c17') {
      network = 'devnet';
    } else if (chainId.length === 8) {
      // Likely localnet or custom network
      network = 'custom';
    }

    return { chainId, network };
  }

  public async getEnvironments(): Promise<SuiEnvironment[]> {
    const config = await this.configParser.getConfig();
    if (!config) return [];

    return config.envs.map((env) => ({
      alias: env.alias,
      rpc: env.rpc,
      ws: env.ws || undefined,
      isActive: env.alias === config.active_env,
    }));
  }

  public async switchEnvironment(alias: string): Promise<void> {
    await this.executor.execute(['client', 'switch', '--env', alias]);
  }

  public async addEnvironment(alias: string, rpc: string, ws?: string): Promise<void> {
    const args = ['client', 'new-env', '--alias', alias, '--rpc', rpc];
    if (ws) {
      args.push('--ws', ws);
    }
    await this.executor.execute(args);
  }

  public async removeEnvironment(alias: string): Promise<void> {
    await this.configParser.removeEnvironment(alias);
  }
}
