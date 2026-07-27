/**
 * Devstack bridge - read a local devstack project and point the app at it.
 * @module api/services/devstack
 */

import type {
  DevstackAttachResult,
  DevstackCapabilities,
  DevstackDeployment,
} from '@sui-cli-web/shared';
import { fetchApi } from '../core/request';

/**
 * Whether devstack can be used from `dir`, and if not, why. `installed: false`
 * is the expected answer for most people and is not an error.
 */
export async function getDevstackCapabilities(dir: string) {
  return fetchApi<DevstackCapabilities>(`/devstack/capabilities?dir=${encodeURIComponent(dir)}`);
}

/** The stack's endpoints, packages and funded accounts; null when never booted. */
export async function getDevstackDeployment(dir: string) {
  return fetchApi<DevstackDeployment | null>(
    `/devstack/deployment?dir=${encodeURIComponent(dir)}`
  );
}

/** Register the stack's RPC as a `sui client` env and switch to it. */
export async function attachDevstack(dir: string, network?: string) {
  return fetchApi<DevstackAttachResult>('/devstack/attach', {
    method: 'POST',
    body: JSON.stringify({ dir, network }),
  });
}
