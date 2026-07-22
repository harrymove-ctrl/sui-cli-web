import { useState, useCallback } from 'react';

export interface NetworkError {
  type: 'timeout' | 'server_disconnected' | 'network_error' | 'unknown';
  message: string;
  retryCount: number;
  isRetrying: boolean;
}

/**
 * Hook for handling network errors with exponential backoff retry
 * Detects different types of network issues and provides retry logic
 */
export function useNetworkRetry(maxRetries = 3) {
  const [error, setError] = useState<NetworkError | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const getErrorType = (err: unknown): NetworkError['type'] => {
    if (err instanceof Error) {
      if (err.message.includes('timed out') || err.message.includes('timeout')) {
        return 'timeout';
      }
      if (err.message.includes('server') || err.message.includes('running')) {
        return 'server_disconnected';
      }
      if (err.message.includes('fetch') || err.message.includes('network')) {
        return 'network_error';
      }
    }
    return 'unknown';
  };

  const handleError = useCallback((err: unknown) => {
    const type = getErrorType(err);
    const message = err instanceof Error ? err.message : String(err);

    setError({
      type,
      message,
      retryCount,
      isRetrying: false,
    });
  }, [retryCount]);

  const retry = useCallback(async (fn: () => Promise<void>) => {
    if (retryCount >= maxRetries) {
      setError((prev) =>
        prev ? { ...prev, message: `Failed after ${maxRetries} retries. ${prev.message}` } : null
      );
      return;
    }

    setError((prev) => (prev ? { ...prev, isRetrying: true } : null));

    // Exponential backoff: 1s, 2s, 4s
    const delay = Math.pow(2, retryCount) * 1000;
    await new Promise((resolve) => setTimeout(resolve, delay));

    try {
      await fn();
      setError(null);
      setRetryCount(0);
    } catch (err) {
      setRetryCount((prev) => prev + 1);
      handleError(err);
    }
  }, [retryCount, maxRetries, handleError]);

  const clearError = useCallback(() => {
    setError(null);
    setRetryCount(0);
  }, []);

  return {
    error,
    retryCount,
    handleError,
    retry,
    clearError,
  };
}
