/**
 * React hook for Statsig feature flags
 *
 * TEMPORARILY DISABLED: Statsig SDK has __DEFINES__ error in dev mode.
 * All feature flags return false until Statsig is fixed.
 */

import { useState, useCallback } from 'react';

// Mock FeatureGates - temporarily defined here instead of statsig
export const FeatureGates = {
  ONBOARDING_FLOW_OPTIMIZATION: 'onboarding_flow_optimization',
  ENABLE_BETA_FEATURES: 'enable_beta_features',
  ENABLE_NEW_UI_FEATURES: 'enable_new_ui_features',
  ENABLE_ANALYTICS_TRACKING: 'enable_analytics_tracking',
} as const;

export type FeatureGateName = typeof FeatureGates[keyof typeof FeatureGates];

interface UseFeatureFlagsReturn {
  /** Check if a specific gate is enabled */
  isEnabled: (gateName: FeatureGateName) => boolean;
  /** All feature flags with their current status */
  flags: Record<FeatureGateName, boolean>;
  /** Loading state */
  isLoading: boolean;
  /** Refresh flags from Statsig */
  refresh: () => void;
}

/**
 * Hook to access Statsig feature flags
 * TEMPORARILY: Returns all flags as false
 */
export function useFeatureFlags(): UseFeatureFlagsReturn {
  const [flags] = useState<Record<FeatureGateName, boolean>>({
    [FeatureGates.ONBOARDING_FLOW_OPTIMIZATION]: false,
    [FeatureGates.ENABLE_BETA_FEATURES]: false,
    [FeatureGates.ENABLE_NEW_UI_FEATURES]: false,
    [FeatureGates.ENABLE_ANALYTICS_TRACKING]: true, // Allow analytics
  });

  const isEnabled = useCallback((_gateName: FeatureGateName): boolean => {
    return false; // All flags disabled in dev mode
  }, []);

  const refresh = useCallback(() => {
    // No-op - Statsig disabled
  }, []);

  return {
    isEnabled,
    flags,
    isLoading: false,
    refresh,
  };
}

/**
 * Convenience hook for checking a single feature flag
 */
export function useFeatureFlag(_gateName: FeatureGateName): boolean {
  return false; // All flags disabled in dev mode
}

/**
 * Hook to check if the current user is a member
 */
export function useIsMember(): boolean {
  return false; // Disabled in dev mode
}

/**
 * Hook to check if a specific feature is enabled
 */
export function useFeatureEnabled(_gateName: FeatureGateName): boolean {
  return false; // Disabled in dev mode
}
