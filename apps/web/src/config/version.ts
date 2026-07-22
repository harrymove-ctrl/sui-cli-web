/**
 * Application version configuration
 * Update this whenever you release a new version
 */

export const APP_VERSION = '1.3.3';
export const APP_VERSION_STATUS = 'Beta';
export const RELEASE_DATE = '2025-12-11';

/**
 * Upcoming features roadmap
 */
export const UPCOMING_FEATURES = [
  'Move Deploy',
  'Transaction Builder',
  'NFT Gallery',
  'DeFi Integration',
];

/**
 * Get formatted version string
 */
export function getVersionString(): string {
  return `v${APP_VERSION} ${APP_VERSION_STATUS}`;
}

/**
 * Get version with build info
 */
export function getFullVersionInfo(): string {
  return `${getVersionString()} (Released ${RELEASE_DATE})`;
}
