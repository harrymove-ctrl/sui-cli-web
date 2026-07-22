/**
 * Connection management - port scanning, health checks, connection state
 * @module api/core/connection
 */

// In production (deployed UI), connect to localhost server
// In development (vite dev), use proxy
const isDev = import.meta.env.DEV;

// Common ports to scan for server
const COMMON_PORTS = [3001, 3002, 3003, 3004, 3005, 4001, 4002, 8001, 8080];

// Connection timeout for port scanning
const PORT_SCAN_TIMEOUT_MS = 2000;

// Connection state
let API_BASE = isDev ? '/api' : (import.meta.env.VITE_API_URL || 'http://localhost:3001/api');
let currentServerPort: number | null = null;
let isServerConnected = false;
let lastConnectionError: string | null = null;

// Debug logging (only in development or when explicitly enabled)
const DEBUG_CONNECTION = !isDev;

function logDebug(message: string, ...args: unknown[]) {
  if (DEBUG_CONNECTION) {
    console.log(`[SuiCLI] ${message}`, ...args);
  }
}

// Build localhost URLs for all common ports
function buildLocalhostUrls(port: number): string[] {
  return [
    `http://localhost:${port}/api`,
    `http://127.0.0.1:${port}/api`,
  ];
}

// Get saved port from localStorage or URL param
function getSavedPort(): number | null {
  if (typeof window !== 'undefined') {
    const urlParams = new URLSearchParams(window.location.search);
    const portParam = urlParams.get('port');
    if (portParam) {
      const port = parseInt(portParam, 10);
      if (port >= 1 && port <= 65535) {
        return port;
      }
    }

    const savedPort = localStorage.getItem('sui-cli-server-port');
    if (savedPort) {
      const port = parseInt(savedPort, 10);
      if (port >= 1 && port <= 65535) {
        return port;
      }
    }
  }
  return null;
}

// Save discovered port to localStorage
function savePort(port: number): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('sui-cli-server-port', String(port));
  }
}

// Get all ports to try (saved port first, then common ports)
function getPortsToTry(): number[] {
  const savedPort = getSavedPort();
  const ports = [...COMMON_PORTS];

  if (savedPort && !ports.includes(savedPort)) {
    ports.unshift(savedPort);
  } else if (savedPort) {
    const idx = ports.indexOf(savedPort);
    if (idx > 0) {
      ports.splice(idx, 1);
      ports.unshift(savedPort);
    }
  }

  return ports;
}

// Try to connect to a single URL
async function tryConnect(url: string, port: number): Promise<{ success: boolean; url: string; port: number; error?: string }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PORT_SCAN_TIMEOUT_MS);

    const response = await fetch(`${url}/health`, {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      return { success: false, url, port, error: `HTTP ${response.status}` };
    }

    try {
      const data = await response.json();
      if (data.port) {
        return { success: true, url, port: data.port };
      }
    } catch {
      // Ignore JSON parse error
    }

    return { success: true, url, port };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    const errorName = error instanceof Error ? error.name : 'Error';
    return { success: false, url, port, error: `${errorName} - ${errorMsg}` };
  }
}

// ============ Exported Functions ============

export function getApiBaseUrl(): string {
  return API_BASE;
}

export function getServerPort(): number | null {
  return currentServerPort;
}

export function getConnectionStatus(): boolean {
  return isServerConnected;
}

export function setConnectionStatus(status: boolean): void {
  isServerConnected = status;
}

export function getLastConnectionError(): string | null {
  return lastConnectionError;
}

// Check server connection - scans multiple ports in PARALLEL for fast detection
export async function checkConnection(): Promise<boolean> {
  logDebug('Starting connection check...');
  lastConnectionError = null;

  if (isDev) {
    try {
      const response = await fetch(`${API_BASE}/health`, { method: 'GET' });
      const data = await response.json();
      if (data.port) {
        currentServerPort = data.port;
      }
      isServerConnected = true;
      logDebug('Dev mode: Connected successfully');
      return true;
    } catch (error) {
      isServerConnected = false;
      lastConnectionError = error instanceof Error ? error.message : 'Unknown error';
      logDebug('Dev mode: Connection failed', lastConnectionError);
      return false;
    }
  }

  // In production, scan ALL ports in PARALLEL for fast detection
  const portsToTry = getPortsToTry();
  logDebug('Scanning ports in parallel:', portsToTry);

  const allAttempts: Array<{ url: string; port: number }> = [];
  for (const port of portsToTry) {
    const urls = buildLocalhostUrls(port);
    for (const url of urls) {
      allAttempts.push({ url, port });
    }
  }

  const results = await Promise.all(
    allAttempts.map(({ url, port }) => tryConnect(url, port))
  );

  const successResult = results.find(r => r.success);
  if (successResult) {
    API_BASE = successResult.url;
    currentServerPort = successResult.port;
    savePort(currentServerPort);
    isServerConnected = true;
    logDebug('Connected successfully to', successResult.url);
    return true;
  }

  const errors = results
    .filter(r => !r.success && r.error)
    .map(r => `${r.url}: ${r.error}`);

  isServerConnected = false;
  lastConnectionError = errors.length > 0 ? errors.slice(0, 5).join('; ') + (errors.length > 5 ? '...' : '') : 'No server found';
  logDebug('All connection attempts failed');
  return false;
}
