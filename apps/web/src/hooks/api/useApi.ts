/**
 * Generic API hook with loading, error, and data state management
 * @module hooks/api/useApi
 */

import { useState, useCallback, useEffect } from 'react';

export interface ApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export interface UseApiReturn<T, Args extends any[]> extends ApiState<T> {
  execute: (...args: Args) => Promise<T | null>;
  reset: () => void;
  setData: (data: T | null) => void;
}

/**
 * Generic hook for API calls with loading/error state management
 *
 * @example
 * const { data, loading, error, execute } = useApi(getAddresses);
 * // Later: await execute();
 */
export function useApi<T, Args extends any[] = []>(
  apiFunction: (...args: Args) => Promise<T>
): UseApiReturn<T, Args> {
  const [state, setState] = useState<ApiState<T>>({
    data: null,
    loading: false,
    error: null,
  });

  const execute = useCallback(async (...args: Args): Promise<T | null> => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const result = await apiFunction(...args);
      setState({ data: result, loading: false, error: null });
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An error occurred';
      setState(prev => ({ ...prev, loading: false, error: errorMessage }));
      return null;
    }
  }, [apiFunction]);

  const reset = useCallback(() => {
    setState({ data: null, loading: false, error: null });
  }, []);

  const setData = useCallback((data: T | null) => {
    setState(prev => ({ ...prev, data }));
  }, []);

  return {
    ...state,
    execute,
    reset,
    setData,
  };
}

/**
 * Hook for API calls that execute immediately on mount
 *
 * @example
 * const { data, loading, error, refetch } = useApiOnMount(getAddresses);
 */
export function useApiOnMount<T>(
  apiFunction: () => Promise<T>,
  deps: any[] = []
): ApiState<T> & { refetch: () => Promise<T | null> } {
  const { data, loading, error, execute } = useApi(apiFunction);

  // Execute on mount and whenever deps change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    execute();
  }, deps);

  return { data, loading, error, refetch: execute };
}
