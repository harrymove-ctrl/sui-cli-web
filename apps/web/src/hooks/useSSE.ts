/**
 * useSSE - Hook for Server-Sent Events streaming
 */

import { useState, useEffect, useCallback, useRef } from 'react';

export type SSEStatus = 'idle' | 'connecting' | 'connected' | 'error' | 'complete';

export interface SSEMessage<T = unknown> {
  data: T;
  event?: string;
  id?: string;
}

export interface UseSSEOptions<T> {
  onMessage?: (data: T) => void;
  onError?: (error: Event) => void;
  onComplete?: () => void;
  autoConnect?: boolean;
}

export interface UseSSEReturn<T> {
  data: T[];
  status: SSEStatus;
  error: string | null;
  connect: () => void;
  disconnect: () => void;
  clear: () => void;
}

export function useSSE<T = unknown>(
  url: string | null,
  options: UseSSEOptions<T> = {}
): UseSSEReturn<T> {
  const [data, setData] = useState<T[]>([]);
  const [status, setStatus] = useState<SSEStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const { onMessage, onError, onComplete, autoConnect = true } = options;

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    if (!url) return;

    disconnect();
    setStatus('connecting');
    setError(null);

    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setStatus('connected');
    };

    eventSource.onmessage = (e) => {
      try {
        const parsed = JSON.parse(e.data) as T;
        setData(prev => [...prev, parsed]);
        onMessage?.(parsed);
      } catch {
        // Non-JSON message, store as-is
        setData(prev => [...prev, e.data as unknown as T]);
      }
    };

    eventSource.addEventListener('complete', () => {
      setStatus('complete');
      onComplete?.();
      disconnect();
    });

    eventSource.addEventListener('error', (e) => {
      if ((e as any).data) {
        try {
          const errorData = JSON.parse((e as any).data);
          setError(errorData.error || 'Unknown error');
        } catch {
          setError('Stream error');
        }
      }
    });

    eventSource.onerror = (e) => {
      // Don't set error status if we're completing normally
      if (status !== 'complete') {
        setStatus('error');
        setError('Connection error');
        onError?.(e);
      }
      disconnect();
    };
  }, [url, onMessage, onError, onComplete, disconnect, status]);

  const clear = useCallback(() => {
    setData([]);
    setError(null);
  }, []);

  useEffect(() => {
    if (autoConnect && url) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [url, autoConnect, connect, disconnect]);

  return {
    data,
    status,
    error,
    connect,
    disconnect,
    clear,
  };
}

/**
 * useProcessOutput - Specialized hook for process output streaming
 */
export interface ProcessOutput {
  type: 'stdout' | 'stderr' | 'exit' | 'error' | 'status';
  data?: string;
  line?: string;
  stream?: string;
  code?: number;
  message?: string;
}

export interface UseProcessOutputReturn {
  lines: string[];
  status: SSEStatus;
  exitCode: number | null;
  error: string | null;
  connect: () => void;
  disconnect: () => void;
  clear: () => void;
}

export function useProcessOutput(
  processId: string | null,
  baseUrl: string = ''
): UseProcessOutputReturn {
  const [lines, setLines] = useState<string[]>([]);
  const [exitCode, setExitCode] = useState<number | null>(null);

  const url = processId ? `${baseUrl}/api/network/stream/${processId}` : null;

  const handleMessage = useCallback((output: ProcessOutput) => {
    if (output.type === 'stdout' || output.type === 'stderr') {
      const line = output.line || output.data || '';
      if (line) {
        setLines(prev => [...prev.slice(-999), line]); // Keep last 1000 lines
      }
    } else if (output.type === 'exit') {
      setExitCode(output.code ?? null);
    } else if (output.type === 'status' && output.message) {
      setLines(prev => [...prev, `[STATUS] ${output.message}`]);
    }
  }, []);

  const { status, error, connect, disconnect, clear: clearSSE } = useSSE<ProcessOutput>(url, {
    onMessage: handleMessage,
    autoConnect: true,
  });

  const clear = useCallback(() => {
    setLines([]);
    setExitCode(null);
    clearSSE();
  }, [clearSSE]);

  return {
    lines,
    status,
    exitCode,
    error,
    connect,
    disconnect,
    clear,
  };
}
