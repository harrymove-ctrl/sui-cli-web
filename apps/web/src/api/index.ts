/**
 * Sui CLI Web API Client
 *
 * Modular API structure:
 * - api/core/       - Connection management, request utilities
 * - api/services/   - Domain-specific API modules
 *
 * @module api
 */

// Core utilities
export {
  getApiBaseUrl,
  getServerPort,
  getConnectionStatus,
  getLastConnectionError,
  checkConnection,
} from './core';

export { fetchApi, apiClient } from './core';

// Re-export all services for backward compatibility
export * from './services';

// Re-export types
export type {
  // Filesystem types
  DirectoryEntry,
  BrowseResponse,
  SuggestedDirectory,
  ScannedPackage,
} from './services/filesystem';

export type {
  // Inspector types
  ParsedType,
  ParameterSuggestion,
  AnalyzedParameter,
  PtbCommand,
  PtbOptions,
  PtbResult,
} from './services/inspector';

export type {
  // Package types
  PublishedPackageInfo,
} from './services/packages';

export type {
  // Keytool types
  SampleTxType,
} from './services/keytool';
