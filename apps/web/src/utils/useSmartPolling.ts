import { useEffect, useRef } from 'react';

interface SmartPollingOptions {
  /**
   * Callback function to execute on each poll
   */
  onPoll: () => Promise<void> | void;

  /**
   * Initial interval (ms). Default: 10000 (10s)
   */
  initialInterval?: number;

  /**
   * Maximum interval when app is backgrounded (ms). Default: 60000 (60s)
   */
  maxInterval?: number;

  /**
   * Minimum interval (ms). Default: 5000 (5s)
   */
  minInterval?: number;

  /**
   * Whether polling is enabled. Default: true
   */
  enabled?: boolean;
}

/**
 * Smart polling hook with:
 * - Adaptive intervals based on visibility
 * - Immediate fetch when tab becomes visible
 * - Background throttling to save resources
 */
export function useSmartPolling({
  onPoll,
  initialInterval = 10000,
  maxInterval = 60000,
  minInterval = 5000,
  enabled = true,
}: SmartPollingOptions) {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const currentIntervalRef = useRef(initialInterval);
  const isPollingRef = useRef(false);

  useEffect(() => {
    if (!enabled) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Initial fetch on mount
    onPoll();

    const startPolling = (interval: number) => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }

      currentIntervalRef.current = interval;
      intervalRef.current = setInterval(async () => {
        // Prevent overlapping polls
        if (isPollingRef.current) return;

        isPollingRef.current = true;
        try {
          await onPoll();
        } finally {
          isPollingRef.current = false;
        }
      }, interval);
    };

    // Handle visibility change for adaptive polling
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Tab hidden - slow down polling
        startPolling(maxInterval);
      } else {
        // Tab visible - speed up polling and fetch immediately
        if (currentIntervalRef.current !== initialInterval) {
          onPoll(); // Immediate fetch on tab focus
        }
        startPolling(initialInterval);
      }
    };

    // Start initial polling
    startPolling(initialInterval);

    // Listen for visibility changes
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Cleanup
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled, onPoll, initialInterval, maxInterval]);
}
