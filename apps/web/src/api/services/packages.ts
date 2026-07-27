/**
 * Package management API (publish, upgrade, inspect)
 * @module api/services/packages
 */

import { fetchApi } from '../core/request';

// Types
export interface PublishedPackageInfo {
  packageId: string;
  upgradeCapId: string;
  version: string;
  policy: number;
}

export interface MoveField {
  name: string;
  type: string;
}

export interface MoveDatatype {
  name: string;
  kind: string; // 'struct' | 'enum'
  abilities: string[];
  typeParameters: string[];
  fields: MoveField[];
  variants?: { name: string; fields: MoveField[] }[];
}

export interface MoveFunction {
  name: string;
  visibility: string; // 'public' | 'private' | 'public(friend)'
  isEntry: boolean;
  typeParameters: string[];
  parameters: string[];
  returns: string[];
}

export interface MoveModule {
  name: string;
  functions: MoveFunction[];
  datatypes: MoveDatatype[];
}

export interface PackageModules {
  storageId: string;
  originalId: string;
  version: string;
  modules: MoveModule[];
}

/** Fetch a package's normalized modules (functions + datatypes) for the explorer. */
export async function explorePackage(packageId: string) {
  return fetchApi<PackageModules>(`/packages/${encodeURIComponent(packageId)}/explore`);
}

// API functions
export async function getPackageSummary(packageId: string) {
  return fetchApi<Record<string, unknown>>(`/packages/${packageId}/summary`);
}

export async function getPublishedPackages(address?: string) {
  const endpoint = address
    ? `/packages/published?address=${encodeURIComponent(address)}`
    : '/packages/published';
  return fetchApi<{ packages: PublishedPackageInfo[] }>(endpoint);
}

export async function publishPackage(
  packagePath: string,
  gasBudget: string,
  skipDependencyVerification: boolean
) {
  return fetchApi<{
    packageId?: string;
    digest?: string;
    createdObjects?: any[];
  }>('/packages/publish', {
    method: 'POST',
    body: JSON.stringify({ packagePath, gasBudget, skipDependencyVerification }),
  });
}

export async function upgradePackage(
  packagePath: string,
  upgradeCapId: string,
  gasBudget: string
) {
  return fetchApi<{
    packageId?: string;
    digest?: string;
  }>('/packages/upgrade', {
    method: 'POST',
    body: JSON.stringify({ packagePath, upgradeCapId, gasBudget }),
  });
}

export async function inspectPackage(packageId: string) {
  return fetchApi<{
    packageId: string;
    modules: any[];
  }>(`/inspector/package/${packageId}`);
}

export async function callPackageFunction(
  packageId: string,
  module: string,
  functionName: string,
  args: string[],
  typeArgs: string[],
  gasBudget: string
) {
  return fetchApi<{
    digest?: string;
    effects?: any;
    events?: any[];
    gasUsed?: string;
    objectChanges?: any[];
  }>(`/packages/${packageId}/call`, {
    method: 'POST',
    body: JSON.stringify({
      module,
      function: functionName,
      args,
      typeArgs,
      gasBudget,
    }),
  });
}
