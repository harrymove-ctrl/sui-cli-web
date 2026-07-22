/**
 * Core API utilities
 * @module api/core
 */

export {
  getApiBaseUrl,
  getServerPort,
  getConnectionStatus,
  setConnectionStatus,
  getLastConnectionError,
  checkConnection,
} from './connection';

export { fetchApi, apiClient } from './request';
