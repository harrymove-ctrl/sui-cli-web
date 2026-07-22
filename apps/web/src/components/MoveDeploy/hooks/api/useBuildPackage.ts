/**
 * Hook for building Move packages
 */

import { useCallback } from 'react';
import { useMoveDevStore, selectBuildState } from '../state/useMoveDevState';
import type { BuildRequest } from '../../types';

export function useBuildPackage() {
  const buildState = useMoveDevStore(selectBuildState);
  const executeBuild = useMoveDevStore((state) => state.executeBuild);
  const currentPackage = useMoveDevStore((state) => state.currentPackage);

  const build = useCallback(
    async (options?: Partial<BuildRequest>) => {
      if (!currentPackage?.path) {
        throw new Error('No package selected');
      }

      const request: BuildRequest = {
        packagePath: currentPackage.path,
        network: options?.network,
        skipFetchLatest: options?.skipFetchLatest ?? false,
        withUnpublished: options?.withUnpublished ?? false,
      };

      return executeBuild(request);
    },
    [currentPackage, executeBuild]
  );

  return {
    build,
    loading: buildState.status === 'loading',
    success: buildState.status === 'success',
    error: buildState.error,
    data: buildState.data,
    canBuild: !!currentPackage?.path && buildState.status !== 'loading',
  };
}
