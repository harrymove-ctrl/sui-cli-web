/**
 * Core API utilities
 * @module api/core
 */

export {
  COMMON_PORTS,
  checkConnection,
  getApiBaseUrl,
  getConnectionStatus,
  getLastConnectionError,
  getServerPort,
  setConnectionStatus,
} from './connection';

export { apiClient, fetchApi } from './request';
