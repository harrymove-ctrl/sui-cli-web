import fs from 'fs';
import path from 'path';
import os from 'os';
import yaml from 'js-yaml';

export interface SuiConfigEnv {
  alias: string;
  rpc: string;
  ws?: string | null;
}

export interface SuiConfig {
  active_env: string;
  active_address: string;
  envs: SuiConfigEnv[];
  keystore: {
    File: string;
  };
}

export class ConfigParser {
  private static instance: ConfigParser;
  private configPath: string;

  private constructor() {
    this.configPath = path.join(os.homedir(), '.sui', 'sui_config', 'client.yaml');
  }

  public static getInstance(): ConfigParser {
    if (!ConfigParser.instance) {
      ConfigParser.instance = new ConfigParser();
    }
    return ConfigParser.instance;
  }

  public getConfigPath(): string {
    return this.configPath;
  }

  public async getConfig(): Promise<SuiConfig | null> {
    try {
      if (!fs.existsSync(this.configPath)) {
        return null;
      }
      const fileContents = await fs.promises.readFile(this.configPath, 'utf8');
      const config = yaml.load(fileContents) as any;

      return {
        active_env: config.active_env,
        active_address: config.active_address,
        envs: config.envs || [],
        keystore: config.keystore,
      };
    } catch (error) {
      console.error('Failed to parse Sui config:', error);
      return null;
    }
  }

  public async saveConfig(updates: Partial<SuiConfig>): Promise<void> {
    try {
      const currentContent = await fs.promises.readFile(this.configPath, 'utf8');
      const currentConfig = yaml.load(currentContent) as any;

      if (updates.active_env !== undefined) {
        currentConfig.active_env = updates.active_env;
      }
      if (updates.active_address !== undefined) {
        currentConfig.active_address = updates.active_address;
      }
      if (updates.envs !== undefined) {
        currentConfig.envs = updates.envs;
      }

      const newContent = yaml.dump(currentConfig);
      await fs.promises.writeFile(this.configPath, newContent, 'utf8');
    } catch (error) {
      throw new Error(`Failed to save Sui config: ${error}`);
    }
  }

  public async addEnvironment(alias: string, rpc: string, ws?: string): Promise<void> {
    const config = await this.getConfig();
    if (!config) {
      throw new Error('Sui config not found');
    }

    const exists = config.envs.some((e) => e.alias === alias);
    if (exists) {
      throw new Error(`Environment "${alias}" already exists`);
    }

    config.envs.push({ alias, rpc, ws: ws || null });
    await this.saveConfig({ envs: config.envs });
  }

  public async removeEnvironment(alias: string): Promise<void> {
    const config = await this.getConfig();
    if (!config) {
      throw new Error('Sui config not found');
    }

    if (config.active_env === alias) {
      throw new Error('Cannot remove active environment');
    }

    config.envs = config.envs.filter((e) => e.alias !== alias);
    await this.saveConfig({ envs: config.envs });
  }
}
