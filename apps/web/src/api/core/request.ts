/**
 * HTTP request utilities - fetchApi wrapper with error handling
 * @module api/core/request
 */

import type { ApiResponse } from '@/types';
import { getApiBaseUrl, setConnectionStatus } from './connection';

// Request timeout (30 seconds)
const REQUEST_TIMEOUT_MS = 30000;

/**
 * Main fetch wrapper with error handling and connection state management
 */
export async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit & { timeoutMs?: number }
): Promise<T> {
  const { timeoutMs, ...fetchOptions } = options ?? {};
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs ?? REQUEST_TIMEOUT_MS);
  const API_BASE = getApiBaseUrl();

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
      },
      ...fetchOptions,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      setConnectionStatus(response.status < 500);

      try {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const errorData = await response.json();
          if (errorData.error) {
            throw new Error(errorData.error);
          }
        }
      } catch (parseError) {
        if (parseError instanceof Error && !parseError.message.includes('Server error')) {
          throw parseError;
        }
      }

      throw new Error(`Server error: ${response.status} ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      setConnectionStatus(false);
      throw new Error('Server returned non-JSON response. Is the server running?');
    }

    const text = await response.text();
    if (!text) {
      setConnectionStatus(false);
      throw new Error('Server returned empty response. Is the server running?');
    }

    const data: ApiResponse<T> = JSON.parse(text);
    setConnectionStatus(true);

    if (!data.success) {
      throw new Error(data.error || 'Unknown error');
    }

    return data.data as T;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error && error.name === 'AbortError') {
      setConnectionStatus(false);
      throw new Error('Request timed out. Please try again.');
    }
    if (error instanceof TypeError && error.message.includes('fetch')) {
      setConnectionStatus(false);
      throw new Error('Cannot connect to local server. Make sure the server is running (npx sui-cli-web-server).');
    }
    if (error instanceof SyntaxError && error.message.includes('JSON')) {
      setConnectionStatus(false);
      throw new Error('Invalid server response. Is the server running correctly?');
    }
    throw error;
  }
}

/**
 * Raw fetch that returns JSON without throwing on 4xx errors
 * Used for APIs that return { success: false, error: "..." } with 4xx status
 */
async function fetchApiRaw<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const API_BASE = getApiBaseUrl();

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      throw new Error('Server returned non-JSON response');
    }

    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * Generic API client for making requests to the server
 * Used by new feature components that need more flexibility
 */
export const apiClient = {
  async get<T = any>(endpoint: string): Promise<T & { success: boolean; error?: string }> {
    try {
      const data = await fetchApiRaw<T & { success?: boolean; error?: string }>(endpoint);
      if ('success' in data) {
        return data as T & { success: boolean; error?: string };
      }
      return { success: true, ...data } as T & { success: boolean };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Request failed',
      } as T & { success: boolean; error?: string };
    }
  },

  async post<T = any>(endpoint: string, body?: any): Promise<T & { success: boolean; error?: string }> {
    try {
      const data = await fetchApiRaw<T & { success?: boolean; error?: string }>(endpoint, {
        method: 'POST',
        body: body ? JSON.stringify(body) : undefined,
      });
      if ('success' in data) {
        return data as T & { success: boolean; error?: string };
      }
      return { success: true, ...data } as T & { success: boolean };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Request failed',
      } as T & { success: boolean; error?: string };
    }
  },

  async delete<T = any>(endpoint: string): Promise<T & { success: boolean; error?: string }> {
    try {
      const data = await fetchApiRaw<T & { success?: boolean; error?: string }>(endpoint, { method: 'DELETE' });
      if ('success' in data) {
        return data as T & { success: boolean; error?: string };
      }
      return { success: true, ...data } as T & { success: boolean };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Request failed',
      } as T & { success: boolean; error?: string };
    }
  },
};
