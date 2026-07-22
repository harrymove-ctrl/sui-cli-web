/**
 * Generic hook for API operations with loading states, error handling, and retries
 */

import { useState, useCallback, useRef } from 'react';
import type { OperationError } from '../../types';

interface UseApiOperationOptions<TRequest, TResult> {
  operation: (request: TRequest) => Promise<TResult>;
  onSuccess?: (result: TResult) => void;
  onError?: (error: OperationError) => void;
  retryCount?: number;
  retryDelay?: number;
}

interface UseApiOperationReturn<TRequest, TResult> {
  execute: (request: TRequest) => Promise<TResult>;
  loading: boolean;
  error: OperationError | null;
  data: TResult | null;
  reset: () => void;
  retry: () => Promise<void>;
}

export function useApiOperation<TRequest, TResult>({
  operation,
  onSuccess,
  onError,
  retryCount = 0,
  retryDelay = 1000,
}: UseApiOperationOptions<TRequest, TResult>): UseApiOperationReturn<TRequest, TResult> {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<OperationError | null>(null);
  const [data, setData] = useState<TResult | null>(null);
  const lastRequestRef = useRef<TRequest | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const execute = useCallback(
    async (request: TRequest, attempt = 0): Promise<TResult> => {
      // Store last request for retry
      lastRequestRef.current = request;

      // Cancel previous request if still running
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      setLoading(true);
      setError(null);

      try {
        const result = await operation(request);
        setData(result);
        setLoading(false);
        onSuccess?.(result);
        return result;
      } catch (err) {
        // Handle abort
        if (err instanceof Error && err.name === 'AbortError') {
          setLoading(false);
          throw err;
        }

        // Convert to OperationError
        const operationError: OperationError = {
          type: 'unknown',
          message: err instanceof Error ? err.message : 'Operation failed',
          recoverable: true,
          ...(err && typeof err === 'object' && 'type' in err ? err : {}),
        };

        // Retry logic
        if (operationError.recoverable && attempt < retryCount) {
          await new Promise((resolve) => setTimeout(resolve, retryDelay * (attempt + 1)));
          return execute(request, attempt + 1);
        }

        setError(operationError);
        setLoading(false);
        onError?.(operationError);
        throw operationError;
      }
    },
    [operation, onSuccess, onError, retryCount, retryDelay]
  );

  const retry = useCallback(async () => {
    if (lastRequestRef.current) {
      await execute(lastRequestRef.current);
    }
  }, [execute]);

  const reset = useCallback(() => {
    setLoading(false);
    setError(null);
    setData(null);
    lastRequestRef.current = null;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  return {
    execute,
    loading,
    error,
    data,
    reset,
    retry,
  };
}
