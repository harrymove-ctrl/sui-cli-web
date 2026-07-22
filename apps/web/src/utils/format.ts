/**
 * Formatting utilities for consistent display across the application
 */

const MIST_PER_SUI = 1_000_000_000;

/**
 * Format a balance string from MIST to SUI
 * @param balance - Balance in MIST as a string
 * @param decimals - Number of decimal places (default: 4)
 * @returns Formatted balance in SUI
 */
export function formatBalance(balance: string, decimals = 4): string {
  const balanceNum = parseInt(balance, 10);
  if (isNaN(balanceNum)) return '0';
  const suiBalance = balanceNum / MIST_PER_SUI;
  return suiBalance.toFixed(decimals);
}

/**
 * Convert MIST to SUI
 * @param mist - Amount in MIST
 * @returns Amount in SUI as a number
 */
export function mistToSui(mist: number): number {
  return mist / MIST_PER_SUI;
}

/**
 * Convert SUI to MIST
 * @param sui - Amount in SUI
 * @returns Amount in MIST as a number
 */
export function suiToMist(sui: number): number {
  return Math.floor(sui * MIST_PER_SUI);
}

/**
 * Format MIST to SUI with proper precision
 * @param mist - Amount in MIST
 * @param decimals - Number of decimal places (default: 4)
 * @returns Formatted string
 */
export function formatMistToSui(mist: number, decimals = 4): string {
  return mistToSui(mist).toFixed(decimals);
}

/**
 * Truncate an address for display
 * @param address - Full address string
 * @param startChars - Number of characters to show at start (default: 6)
 * @param endChars - Number of characters to show at end (default: 4)
 * @returns Truncated address with ellipsis
 */
export function truncateAddress(address: string, startChars = 6, endChars = 4): string {
  if (!address) return '';
  if (address.length <= startChars + endChars) return address;
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
}

/**
 * Shorten an address (alias for truncateAddress with common defaults)
 * @param address - Full address string
 * @returns Shortened address
 */
export function shortenAddress(address: string): string {
  return truncateAddress(address, 6, 4);
}

/**
 * Format a number with thousands separators
 * @param num - Number to format
 * @returns Formatted string with commas
 */
export function formatNumber(num: number): string {
  return num.toLocaleString('en-US');
}

/**
 * Format bytes to human readable string
 * @param bytes - Number of bytes
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted string (e.g., "1.5 KB")
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
}

/**
 * Format a timestamp to relative time
 * @param timestamp - Unix timestamp in milliseconds
 * @returns Relative time string (e.g., "2 minutes ago")
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'just now';
}
