/**
 * Microsoft Clarity Analytics Integration
 *
 * Provides heatmaps, session recordings, and user behavior analytics.
 * Only active in production environment.
 *
 * @see https://clarity.microsoft.com
 */

// Check if we're in production BEFORE importing
const isProduction = import.meta.env.PROD;

// Clarity Project ID
const CLARITY_PROJECT_ID = 'uilx4655e6';

// Track initialization state
let isInitialized = false;

// Store the Clarity module (any type to avoid importing the type)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let ClarityModule: any = null;

/**
 * Initialize Microsoft Clarity
 * Only runs in production to avoid polluting analytics with dev data
 */
export async function initClarity(): Promise<void> {
  if (!isProduction) {
    console.log('[Clarity] Skipped - not in production');
    return;
  }

  if (isInitialized) {
    console.log('[Clarity] Already initialized');
    return;
  }

  try {
    // Dynamic import only in production
    ClarityModule = await import('@microsoft/clarity');
    ClarityModule.default.init(CLARITY_PROJECT_ID);
    isInitialized = true;
    console.log('[Clarity] Initialized successfully');
  } catch (error) {
    console.error('[Clarity] Failed to initialize:', error);
  }
}

/**
 * Identify user with wallet address
 */
export function identifyUser(address: string, customData?: Record<string, string>): void {
  if (!isProduction || !isInitialized || !ClarityModule) return;

  try {
    const shortAddress = `${address.slice(0, 6)}...${address.slice(-4)}`;
    ClarityModule.default.identify(address, undefined, undefined, shortAddress);

    if (customData) {
      Object.entries(customData).forEach(([key, value]) => {
        ClarityModule?.default.setTag(key, value);
      });
    }
  } catch (error) {
    console.error('[Clarity] Failed to identify user:', error);
  }
}

/**
 * Track custom event
 */
export function trackEvent(eventName: string): void {
  if (!isProduction || !isInitialized || !ClarityModule) return;

  try {
    ClarityModule.default.event(eventName);
  } catch (error) {
    console.error('[Clarity] Failed to track event:', error);
  }
}

/**
 * Set custom tag for session
 */
export function setTag(key: string, value: string): void {
  if (!isProduction || !isInitialized || !ClarityModule) return;

  try {
    ClarityModule.default.setTag(key, value);
  } catch (error) {
    console.error('[Clarity] Failed to set tag:', error);
  }
}

/**
 * Upgrade session priority
 */
export function upgradeSession(reason: string): void {
  if (!isProduction || !isInitialized || !ClarityModule) return;

  try {
    ClarityModule.default.upgrade(reason);
  } catch (error) {
    console.error('[Clarity] Failed to upgrade session:', error);
  }
}

// Pre-defined events for consistent tracking
export const ClarityEvents = {
  SERVER_CONNECTED: 'server_connected',
  SERVER_DISCONNECTED: 'server_disconnected',
  ADDRESS_SWITCHED: 'address_switched',
  ADDRESS_CREATED: 'address_created',
  ENVIRONMENT_SWITCHED: 'environment_switched',
  FAUCET_REQUESTED: 'faucet_requested',
  TRANSFER_COMPLETED: 'transfer_completed',
  TRANSFER_FAILED: 'transfer_failed',
  PACKAGE_BUILT: 'package_built',
  PACKAGE_PUBLISHED: 'package_published',
  FUNCTION_CALLED: 'function_called',
  TRANSACTION_INSPECTED: 'transaction_inspected',
  TRANSACTION_REPLAYED: 'transaction_replayed',
} as const;

export type ClarityEventName = typeof ClarityEvents[keyof typeof ClarityEvents];
