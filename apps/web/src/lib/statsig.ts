/**
 * Statsig Analytics Integration
 *
 * Provides session replay, auto-capture analytics, and feature flags.
 * Uses environment variable for client SDK key.
 *
 * @see https://docs.statsig.com/client/javascript-sdk
 */

import { StatsigClient } from '@statsig/js-client';
import { StatsigSessionReplayPlugin } from '@statsig/session-replay';
import { StatsigAutoCapturePlugin } from '@statsig/web-analytics';

// Get client SDK key from environment variable
const STATSIG_CLIENT_KEY = import.meta.env.VITE_STATSIG_CLIENT_KEY || '';

// Check if we're in production
const isProduction = import.meta.env.PROD;

// Track initialization state
let statsigClient: StatsigClient | null = null;
let isInitialized = false;

/**
 * Generate anonymous user ID for tracking
 * Persists across sessions using localStorage
 */
function getAnonymousUserId(): string {
  const storageKey = 'statsig_anonymous_id';
  let userId = localStorage.getItem(storageKey);

  if (!userId) {
    // Generate a random ID
    userId = `anon_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    localStorage.setItem(storageKey, userId);
  }

  return userId;
}

/**
 * Initialize Statsig with session replay and auto-capture
 * Only runs in production environment
 */
export async function initStatsig(): Promise<void> {
  if (!isProduction) {
    console.log('[Statsig] Skipped - not in production');
    return;
  }

  if (!STATSIG_CLIENT_KEY) {
    console.log('[Statsig] Skipped - no SDK key configured');
    return;
  }

  if (isInitialized) {
    console.log('[Statsig] Already initialized');
    return;
  }

  try {
    const userId = getAnonymousUserId();

    statsigClient = new StatsigClient(
      STATSIG_CLIENT_KEY,
      { userID: userId },
      {
        plugins: [
          new StatsigSessionReplayPlugin(),
          new StatsigAutoCapturePlugin(),
        ],
      }
    );

    await statsigClient.initializeAsync();
    isInitialized = true;
    console.log('[Statsig] Initialized successfully');
  } catch (error) {
    console.error('[Statsig] Failed to initialize:', error);
  }
}

/**
 * Update user identity with wallet address
 * Call when user connects a wallet
 */
export async function identifyStatsigUser(
  walletAddress: string,
  customData?: Record<string, string | number | boolean>
): Promise<void> {
  if (!statsigClient || !isInitialized) return;

  try {
    const shortAddress = `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;

    await statsigClient.updateUserAsync({
      userID: walletAddress,
      custom: {
        shortAddress,
        ...customData,
      },
    });
  } catch (error) {
    console.error('[Statsig] Failed to identify user:', error);
  }
}

/**
 * Log custom event
 */
export function logStatsigEvent(
  eventName: string,
  value?: string | number,
  metadata?: Record<string, string>
): void {
  if (!statsigClient || !isInitialized) return;

  try {
    statsigClient.logEvent(eventName, value, metadata);
  } catch (error) {
    console.error('[Statsig] Failed to log event:', error);
  }
}

/**
 * Check if a feature gate is enabled
 */
export function checkGate(gateName: string): boolean {
  if (!statsigClient || !isInitialized) return false;

  try {
    return statsigClient.checkGate(gateName);
  } catch (error) {
    console.error('[Statsig] Failed to check gate:', error);
    return false;
  }
}

/**
 * Get experiment/dynamic config
 */
export function getExperiment(experimentName: string): Record<string, unknown> {
  if (!statsigClient || !isInitialized) return {};

  try {
    return statsigClient.getExperiment(experimentName).value;
  } catch (error) {
    console.error('[Statsig] Failed to get experiment:', error);
    return {};
  }
}

/**
 * Get Statsig client instance
 * Useful for advanced usage
 */
export function getStatsigClient(): StatsigClient | null {
  return statsigClient;
}

/**
 * Feature Gates (Feature Flags)
 * These map to gates created in Statsig dashboard
 */
export const FeatureGates = {
  // Onboarding
  ONBOARDING_FLOW_OPTIMIZATION: 'onboarding_flow_optimization',

  // Beta features
  ENABLE_BETA_FEATURES: 'enable_beta_features',

  // New UI features
  ENABLE_NEW_UI_FEATURES: 'enable_new_ui_features',

  // Analytics
  ENABLE_ANALYTICS_TRACKING: 'enable_analytics_tracking',
} as const;

export type FeatureGateName = typeof FeatureGates[keyof typeof FeatureGates];

/**
 * Check multiple gates at once
 */
export function checkGates(gateNames: FeatureGateName[]): Record<FeatureGateName, boolean> {
  const results: Record<string, boolean> = {};
  for (const gate of gateNames) {
    results[gate] = checkGate(gate);
  }
  return results as Record<FeatureGateName, boolean>;
}

/**
 * Get all feature flags status
 */
export function getAllFeatureFlags(): Record<FeatureGateName, boolean> {
  return checkGates(Object.values(FeatureGates) as FeatureGateName[]);
}

// Pre-defined events for consistent tracking
export const StatsigEvents = {
  // Connection
  SERVER_CONNECTED: 'server_connected',
  SERVER_DISCONNECTED: 'server_disconnected',

  // Wallet
  ADDRESS_SWITCHED: 'address_switched',
  ADDRESS_CREATED: 'address_created',
  WALLET_CONNECTED: 'wallet_connected',

  // Network
  ENVIRONMENT_SWITCHED: 'environment_switched',

  // Transactions
  FAUCET_REQUESTED: 'faucet_requested',
  TRANSFER_COMPLETED: 'transfer_completed',
  TRANSFER_FAILED: 'transfer_failed',

  // Development
  PACKAGE_BUILT: 'package_built',
  PACKAGE_PUBLISHED: 'package_published',
  FUNCTION_CALLED: 'function_called',
  FILE_BROWSER_OPENED: 'file_browser_opened',
  PACKAGE_SCANNED: 'package_scanned',

  // Inspector
  TRANSACTION_INSPECTED: 'transaction_inspected',
  TRANSACTION_REPLAYED: 'transaction_replayed',

  // Navigation
  PAGE_VIEWED: 'page_viewed',
  FEATURE_USED: 'feature_used',
} as const;

export type StatsigEventName = typeof StatsigEvents[keyof typeof StatsigEvents];
