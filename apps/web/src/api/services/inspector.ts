/**
 * Transaction Inspector API (inspect, replay, PTB, parameters)
 * @module api/services/inspector
 */

import { fetchApi } from '../core/request';

// Types
export interface ParsedType {
  category: string;
  rawType: string;
  baseType: string;
  genericParams: string[];
  isMutable: boolean;
  isReference: boolean;
  isVector: boolean;
  isOption: boolean;
}

export interface ParameterSuggestion {
  type: 'object' | 'value' | 'address' | 'coin';
  label: string;
  value: string;
  metadata?: {
    objectId?: string;
    type?: string;
    version?: string;
    digest?: string;
    balance?: string;
    fields?: Record<string, unknown>;
  };
}

export interface AnalyzedParameter {
  name: string;
  type: string;
  parsedType: ParsedType;
  suggestions: ParameterSuggestion[];
  autoFilled?: {
    value: string;
    reason: 'only_one_option' | 'default_value' | 'user_preference';
  };
  examples: string[];
  validation?: {
    pattern?: string;
    min?: string;
    max?: string;
    message?: string;
  };
  helpText?: string;
}

export interface PtbCommand {
  type: 'split-coins' | 'merge-coins' | 'transfer-objects' | 'move-call' | 'assign' | 'make-move-vec';
  args: string[];
}

export interface PtbOptions {
  gasBudget?: number;
  gasPrice?: number;
  gasCoin?: string;
  gasSponsor?: string;
  dryRun?: boolean;
  devInspect?: boolean;
  preview?: boolean;
}

export interface PtbResult {
  output?: string;
  digest?: string;
  effects?: any;
  events?: any[];
  preview?: string;
}

// API functions
export async function analyzeParameters(
  packageId: string,
  module: string,
  functionName: string,
  userAddress: string
) {
  return fetchApi<{
    parameters: AnalyzedParameter[];
    function: { name: string; visibility: string };
  }>('/inspector/analyze-parameters', {
    method: 'POST',
    body: JSON.stringify({
      packageId,
      module,
      functionName,
      userAddress,
    }),
  });
}

export async function convertToVectorU8(value: string, format: 'string' | 'hex') {
  return fetchApi<{ result: string }>('/inspector/convert-to-vector-u8', {
    method: 'POST',
    body: JSON.stringify({ value, format }),
  });
}

export async function executePreSignedTransaction(txBytes: string, signatures: string[]) {
  return fetchApi<{
    digest?: string;
    effects?: any;
    events?: any[];
  }>('/inspector/execute-signed-tx', {
    method: 'POST',
    body: JSON.stringify({ txBytes, signatures }),
  });
}

export async function executeCombinedSignedTransaction(serializedSignedTx: string) {
  return fetchApi<{
    digest?: string;
    effects?: any;
    events?: any[];
  }>('/inspector/execute-combined-signed-tx', {
    method: 'POST',
    body: JSON.stringify({ serializedSignedTx }),
  });
}

export async function executePtb(commands: PtbCommand[], options?: PtbOptions) {
  return fetchApi<PtbResult>('/inspector/ptb', {
    method: 'POST',
    body: JSON.stringify({ commands, options }),
  });
}
