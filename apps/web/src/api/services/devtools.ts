/**
 * DevTools API (coverage, disassemble, summary)
 * @module api/services/devtools
 */

import { fetchApi } from '../core/request';

export async function getPackageModules(packagePath: string) {
  return fetchApi<{ modules: string[]; packagePath: string }>(`/devtools/modules?packagePath=${encodeURIComponent(packagePath)}`);
}

export async function runCoverage(packagePath: string, mode: string = 'summary', moduleName?: string) {
  return fetchApi<{ output: string; mode: string; moduleName?: string }>('/devtools/coverage', {
    method: 'POST',
    body: JSON.stringify({ packagePath, mode, moduleName }),
  });
}

export async function disassembleModule(modulePath: string, showDebug?: boolean, showBytecodeMap?: boolean) {
  return fetchApi<{ output: string; modulePath: string }>('/devtools/disassemble', {
    method: 'POST',
    body: JSON.stringify({ modulePath, showDebug, showBytecodeMap }),
  });
}

export async function generatePackageSummary(packagePath?: string, packageId?: string, format: string = 'json') {
  return fetchApi<{ summary: any; format: string }>('/devtools/summary', {
    method: 'POST',
    body: JSON.stringify({ packagePath, packageId, format }),
  });
}
