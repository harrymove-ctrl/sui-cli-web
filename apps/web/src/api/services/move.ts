/**
 * Move development API (build, test)
 * @module api/services/move
 */

import { fetchApi } from '../core/request';

export async function buildMovePackage(packagePath: string) {
  return fetchApi<{ output: string }>('/move/build', {
    method: 'POST',
    body: JSON.stringify({ packagePath }),
  });
}

export async function testMovePackage(packagePath: string, filter?: string) {
  return fetchApi<{ output: string; passed: number; failed: number }>('/move/test', {
    method: 'POST',
    body: JSON.stringify({ packagePath, filter }),
  });
}

export async function callFunction(
  packageId: string,
  module: string,
  functionName: string,
  typeArgs: string[] = [],
  args: string[] = [],
  gasBudget?: string
) {
  return fetchApi<Record<string, unknown>>('/call', {
    method: 'POST',
    body: JSON.stringify({
      packageId,
      module,
      function: functionName,
      typeArgs,
      args,
      gasBudget,
    }),
  });
}

export async function dryRunCall(
  packageId: string,
  module: string,
  functionName: string,
  typeArgs: string[] = [],
  args: string[] = [],
  gasBudget?: string
) {
  return fetchApi<Record<string, unknown>>('/call/dry-run', {
    method: 'POST',
    body: JSON.stringify({
      packageId,
      module,
      function: functionName,
      typeArgs,
      args,
      gasBudget,
    }),
  });
}
