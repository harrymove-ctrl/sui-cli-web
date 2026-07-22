/**
 * Replay Output Parser
 * Parses the raw terminal output from `sui replay` command
 */

export interface ReplayObject {
  id: string;
  owner: string;
  version: string;
  digest: string;
}

export interface ReplayGasInfo {
  computationCost: number;
  storageCost: number;
  storageRebate: number;
  nonRefundableStorageFee: number;
  gasUsed: number;
  gasBudget: number;
  gasPrice: number;
}

export interface ReplayParsedData {
  digest: string;
  status: 'Success' | 'Failed';
  executedEpoch: string;
  createdObjects: ReplayObject[];
  mutatedObjects: ReplayObject[];
  gasObject?: ReplayObject;
  gasInfo: ReplayGasInfo;
  dependencies: string[];
  rawOutput: string;
}

/**
 * Parse replay output text
 */
export function parseReplayOutput(output: string): ReplayParsedData {
  const result: ReplayParsedData = {
    digest: '',
    status: 'Success',
    executedEpoch: '',
    createdObjects: [],
    mutatedObjects: [],
    gasInfo: {
      computationCost: 0,
      storageCost: 0,
      storageRebate: 0,
      nonRefundableStorageFee: 0,
      gasUsed: 0,
      gasBudget: 0,
      gasPrice: 0,
    },
    dependencies: [],
    rawOutput: output,
  };

  // Extract digest
  const digestMatch = output.match(/Digest:\s+([A-Za-z0-9]+)/);
  if (digestMatch) {
    result.digest = digestMatch[1];
  }

  // Extract status
  const statusMatch = output.match(/Status:\s+(\w+)/);
  if (statusMatch) {
    result.status = statusMatch[1] as 'Success' | 'Failed';
  }

  // Extract epoch
  const epochMatch = output.match(/Executed Epoch:\s+(\d+)/);
  if (epochMatch) {
    result.executedEpoch = epochMatch[1];
  }

  // Extract created objects
  const createdSection = output.match(/Created Objects:[\s\S]*?(?=Mutated Objects:|Gas Object:|$)/);
  if (createdSection) {
    const objectBlocks = extractObjectBlocks(createdSection[0]);
    result.createdObjects = objectBlocks;
  }

  // Extract mutated objects
  const mutatedSection = output.match(/Mutated Objects:[\s\S]*?(?=Gas Object:|Gas Cost Summary:|$)/);
  if (mutatedSection) {
    const objectBlocks = extractObjectBlocks(mutatedSection[0]);
    result.mutatedObjects = objectBlocks;
  }

  // Extract gas object
  const gasObjectSection = output.match(/Gas Object:[\s\S]*?(?=Gas Cost Summary:|Transaction Dependencies:|$)/);
  if (gasObjectSection) {
    const objectBlocks = extractObjectBlocks(gasObjectSection[0]);
    if (objectBlocks.length > 0) {
      result.gasObject = objectBlocks[0];
    }
  }

  // Extract gas costs
  const computationMatch = output.match(/Computation Cost[:\s│]+(\d+)/);
  if (computationMatch) {
    result.gasInfo.computationCost = parseInt(computationMatch[1]);
  }

  const storageMatch = output.match(/Storage Cost[:\s│]+(\d+)/);
  if (storageMatch) {
    result.gasInfo.storageCost = parseInt(storageMatch[1]);
  }

  const rebateMatch = output.match(/Storage Rebate[:\s│]+(\d+)/);
  if (rebateMatch) {
    result.gasInfo.storageRebate = parseInt(rebateMatch[1]);
  }

  const nonRefundableMatch = output.match(/Non-?Refundable Storage Fee[:\s│]+(\d+)/);
  if (nonRefundableMatch) {
    result.gasInfo.nonRefundableStorageFee = parseInt(nonRefundableMatch[1]);
  }

  const gasUsedMatch = output.match(/Gas Used[:\s│]+(\d+)/);
  if (gasUsedMatch) {
    result.gasInfo.gasUsed = parseInt(gasUsedMatch[1]);
  }

  const gasBudgetMatch = output.match(/Gas Budget[:\s│]+(\d+)/);
  if (gasBudgetMatch) {
    result.gasInfo.gasBudget = parseInt(gasBudgetMatch[1]);
  }

  const gasPriceMatch = output.match(/Gas Price[:\s│]+(\d+)/);
  if (gasPriceMatch) {
    result.gasInfo.gasPrice = parseInt(gasPriceMatch[1]);
  }

  // Extract dependencies
  const depsSection = output.match(/Transaction Dependencies:[\s\S]*?(?=╰|Transaction Gas Report|$)/);
  if (depsSection) {
    const depMatches = depsSection[0].matchAll(/([A-Za-z0-9]{40,})/g);
    for (const match of depMatches) {
      if (!result.dependencies.includes(match[1])) {
        result.dependencies.push(match[1]);
      }
    }
  }

  return result;
}

/**
 * Extract object blocks from a section of text
 */
function extractObjectBlocks(text: string): ReplayObject[] {
  const objects: ReplayObject[] = [];

  // Find all object IDs
  const idMatches = [...text.matchAll(/ID:\s+(0x[a-f0-9]{64})/g)];

  for (const idMatch of idMatches) {
    const id = idMatch[1];
    const startIndex = idMatch.index || 0;

    // Find the end of this object block (next "┌──" or end of section)
    let endIndex = text.indexOf('┌──', startIndex + 1);
    if (endIndex === -1) endIndex = text.length;

    const objectBlock = text.substring(startIndex, endIndex);

    // Extract owner
    let owner = 'Unknown';
    const ownerMatch = objectBlock.match(/Owner:\s+Account Address\s+\(\s*(0x[a-f0-9]{64})\s*\)/);
    if (ownerMatch) {
      owner = ownerMatch[1];
    }

    // Extract version
    let version = 'Unknown';
    const versionMatch = objectBlock.match(/Version:\s+(\d+)/);
    if (versionMatch) {
      version = versionMatch[1];
    }

    // Extract digest
    let digest = 'Unknown';
    const digestMatch = objectBlock.match(/Digest:\s+([A-Za-z0-9]+)/);
    if (digestMatch) {
      digest = digestMatch[1];
    }

    objects.push({ id, owner, version, digest });
  }

  return objects;
}

/**
 * Format MIST to SUI
 */
export function formatMistToSui(mist: number): string {
  const sui = mist / 1_000_000_000;
  if (sui < 0.001) {
    return sui.toExponential(2);
  }
  return sui.toFixed(4);
}

/**
 * Shorten address for display
 */
export function shortenAddress(address: string): string {
  if (!address || address === 'Unknown') return address;
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
