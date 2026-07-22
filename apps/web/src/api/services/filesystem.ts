/**
 * Filesystem browsing API
 * @module api/services/filesystem
 */

import { fetchApi } from '../core/request';

// Types
export interface DirectoryEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  isPackage?: boolean;
}

export interface BrowseResponse {
  currentPath: string;
  parentPath: string | null;
  entries: DirectoryEntry[];
}

export interface SuggestedDirectory {
  name: string;
  path: string;
}

export interface ScannedPackage {
  name: string;
  path: string;
  relativePath: string;
}

// API functions
export async function browseDirectory(path?: string) {
  const endpoint = path
    ? `/filesystem/browse?path=${encodeURIComponent(path)}`
    : '/filesystem/browse';
  return fetchApi<BrowseResponse>(endpoint);
}

export async function getSuggestedDirectories() {
  return fetchApi<{ directories: SuggestedDirectory[] }>('/filesystem/suggested');
}

export async function scanMovePackages(basePath?: string, maxDepth?: number) {
  const params = new URLSearchParams();
  if (basePath) params.append('path', basePath);
  if (maxDepth) params.append('maxDepth', String(maxDepth));
  const query = params.toString();
  return fetchApi<{ packages: ScannedPackage[] }>(`/filesystem/scan-packages${query ? `?${query}` : ''}`);
}
