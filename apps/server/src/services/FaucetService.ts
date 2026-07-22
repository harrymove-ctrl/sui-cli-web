import { SuiCliExecutor } from '../cli/SuiCliExecutor';
import type { FaucetResponse } from '@sui-cli-web/shared';
import { NETWORKS } from '@sui-cli-web/shared';

// Faucet API response types
interface FaucetApiResponse {
  transferredGasObjects?: Array<{ transferTxDigest?: string }>;
  task?: string;
  txDigests?: string[];
}

export class FaucetService {
  private executor: SuiCliExecutor;

  constructor() {
    this.executor = SuiCliExecutor.getInstance();
  }

  public async requestTokens(
    network: 'testnet' | 'devnet' | 'localnet',
    address?: string
  ): Promise<FaucetResponse> {
    const targetAddress = address || (await this.executor.execute(['client', 'active-address'])).trim();

    const faucetUrl = NETWORKS[network].faucet;
    if (!faucetUrl) {
      return {
        success: false,
        message: `No faucet available for ${network}`,
        error: 'Faucet not available',
      };
    }

    try {
      const response = await fetch(faucetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          FixedAmountRequest: {
            recipient: targetAddress,
          },
        }),
      });

      // Get response text first to check for rate limiting
      const responseText = await response.text();

      // Check for rate limiting (can come as text even with 200 status)
      if (responseText.includes('Too Many Requests') || response.status === 429) {
        // Extract wait time if available
        const waitMatch = responseText.match(/Wait for (\d+)/);
        const waitTime = waitMatch ? waitMatch[1] : 'a few minutes';
        return {
          success: false,
          message: `Rate limited! Please wait ${waitTime}s or use an alternative faucet.`,
          error: responseText,
        };
      }

      if (!response.ok) {
        return {
          success: false,
          message: `Faucet request failed: ${response.status} ${response.statusText}`,
          error: responseText,
        };
      }

      // Try to parse JSON response
      let data: FaucetApiResponse;
      try {
        data = JSON.parse(responseText) as FaucetApiResponse;
      } catch {
        return {
          success: false,
          message: 'Invalid response from faucet',
          error: responseText,
        };
      }

      // Extract transaction digest if available (handle both v1 and v2 response formats)
      let txDigest: string | undefined;
      if (data.transferredGasObjects) {
        // v1 format
        txDigest = data.transferredGasObjects[0]?.transferTxDigest;
      } else if (data.task) {
        // v2 format - task ID
        txDigest = data.task;
      } else if (data.txDigests && data.txDigests.length > 0) {
        // Alternative v2 format
        txDigest = data.txDigests[0];
      }

      return {
        success: true,
        message: `Successfully requested tokens for ${targetAddress}`,
        txDigest,
      };
    } catch (error) {
      // Better error messages
      const errorMessage = error instanceof Error ? error.message : String(error);

      if (errorMessage.includes('fetch') || errorMessage.includes('ECONNREFUSED')) {
        return {
          success: false,
          message: `Cannot connect to faucet. The network might be unavailable.`,
          error: errorMessage,
        };
      }

      return {
        success: false,
        message: `Failed to request tokens from ${faucetUrl}`,
        error: errorMessage,
      };
    }
  }

}
