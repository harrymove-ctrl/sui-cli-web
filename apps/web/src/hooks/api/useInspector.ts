/**
 * Inspector hooks - transaction inspection, replay, gas analysis, events
 * @module hooks/api/useInspector
 */

import { useState, useCallback } from 'react';
import { getApiBaseUrl } from '@/api/core/connection';
import { executePtb, type PtbCommand, type PtbOptions, type PtbResult } from '@/api/services/inspector';

interface InspectResult {
  success: boolean;
  results?: any;
  events?: any[];
  effects?: any;
  error?: string;
}

interface ReplayResult {
  success: boolean;
  output: string;
  error?: string;
}

interface GasAnalysisResult {
  success: boolean;
  breakdown?: {
    computationCost: string;
    storageCost: string;
    storageRebate: string;
    nonRefundableStorageFee: string;
    totalGasUsed: string;
    totalGasBudget: string;
    efficiency: number;
  };
  optimizations?: Array<{
    type: string;
    category: string;
    message: string;
    details?: string;
  }>;
  error?: string;
}

interface EventsResult {
  success: boolean;
  events?: Array<{
    type: string;
    packageId: string;
    module: string;
    eventName: string;
    parsedFields: Record<string, any>;
    rawData: string;
    sender?: string;
    timestamp?: string;
  }>;
  totalEvents?: number;
  error?: string;
}

/**
 * Hook for transaction inspector operations
 *
 * @example
 * const { inspect, replay, analyzeGas, queryEvents, loading, error } = useInspector();
 * const result = await inspect('digest123');
 */
export function useInspector() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inspect = useCallback(async (digest: string): Promise<InspectResult> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${getApiBaseUrl()}/inspector/inspect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txDigest: digest.trim() }),
      });

      const data = await response.json();

      if (response.status === 403 || data.error === 'MEMBERSHIP_REQUIRED') {
        const msg = data.message || '🔒 Transaction Inspector is a Member-Only Feature';
        setError(msg);
        return { success: false, error: msg };
      }

      if (data.success && data.data) {
        return {
          success: true,
          results: data.data.results,
          events: data.data.events,
          effects: data.data.effects,
        };
      }

      const errorMsg = data.error || 'Inspection failed';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError('Connection error: ' + msg);
      return { success: false, error: 'Connection error: ' + msg };
    } finally {
      setLoading(false);
    }
  }, []);

  const replay = useCallback(async (digest: string): Promise<ReplayResult> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${getApiBaseUrl()}/inspector/replay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txDigest: digest.trim() }),
      });

      const data = await response.json();

      if (response.status === 403 || data.error === 'MEMBERSHIP_REQUIRED') {
        const msg = data.message || '🔒 Transaction Inspector is a Member-Only Feature';
        setError(msg);
        return { success: false, output: '', error: msg };
      }

      if (data.success && data.data) {
        return { success: true, output: data.data.output };
      }

      const errorMsg = data.error || 'Replay failed';
      setError(errorMsg);
      return { success: false, output: '', error: errorMsg };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError('Connection error: ' + msg);
      return { success: false, output: '', error: 'Connection error: ' + msg };
    } finally {
      setLoading(false);
    }
  }, []);

  const analyzeGas = useCallback(async (digest: string): Promise<GasAnalysisResult> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${getApiBaseUrl()}/inspector/gas/analyze/${digest.trim()}`);
      const data = await response.json();

      if (data.success) {
        return {
          success: true,
          breakdown: data.breakdown,
          optimizations: data.optimizations,
        };
      }

      const errorMsg = data.error || 'Gas analysis failed';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError('Connection error: ' + msg);
      return { success: false, error: 'Connection error: ' + msg };
    } finally {
      setLoading(false);
    }
  }, []);

  const queryEvents = useCallback(async (digest: string): Promise<EventsResult> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${getApiBaseUrl()}/inspector/events/transaction/${digest.trim()}`);
      const data = await response.json();

      if (data.success) {
        return {
          success: true,
          events: data.events,
          totalEvents: data.totalEvents,
        };
      }

      const errorMsg = data.error || 'Events query failed';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError('Connection error: ' + msg);
      return { success: false, error: 'Connection error: ' + msg };
    } finally {
      setLoading(false);
    }
  }, []);

  const runPtb = useCallback(async (
    commands: PtbCommand[],
    options?: PtbOptions
  ): Promise<PtbResult & { success: boolean; error?: string }> => {
    setLoading(true);
    setError(null);

    try {
      const result = await executePtb(commands, options);
      return { success: true, ...result };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      return { success: false, error: msg };
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    // Operations
    inspect,
    replay,
    analyzeGas,
    queryEvents,
    runPtb,
    // State
    loading,
    error,
    clearError: useCallback(() => setError(null), []),
  };
}
