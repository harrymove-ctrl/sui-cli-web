// Pairing token for the routes that move funds or export key material (see
// apps/server/src/utils/authToken.ts). Stored per-browser in localStorage -
// there is no server endpoint that returns this value, so the only way to
// set it is to copy it from the server's own terminal output.

const STORAGE_KEY = 'sui-cli-web-pairing-token';

export function getPairingToken(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setPairingToken(token: string): void {
  localStorage.setItem(STORAGE_KEY, token.trim());
}

export function clearPairingToken(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function isPaired(): boolean {
  return !!getPairingToken();
}

/** Header object to spread into a fetch call - empty when unpaired. */
export function pairingHeader(): Record<string, string> {
  const token = getPairingToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
