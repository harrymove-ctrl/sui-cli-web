import { SuiCliExecutor } from '../../cli/SuiCliExecutor';
import { sanitizeErrorMessage } from '../../utils/errorHandler';
import path from 'path';
import fs from 'fs/promises';

export interface PublishResult {
    success: boolean;
    packageId?: string;
    digest?: string;
    createdObjects?: any[];
    output?: string; // Raw JSON output from publish command
    error?: string;
}

export interface UpgradeResult {
    success: boolean;
    packageId?: string;
    digest?: string;
    error?: string;
}

export interface PackageInfo {
    success: boolean;
    data?: any;
    objectId?: string;
    type?: string;
    owner?: string;
    error?: string;
}

/**
 * Decode a raw `0x2::package::UpgradeCap { id: UID, package: ID, version: u64, policy: u8 }`
 * from its BCS-encoded `contents` byte array (the current `sui client objects --json`
 * output returns raw bytes here, not decoded struct fields).
 */
function decodeUpgradeCapContents(
    contents: number[]
): { upgradeCapId: string; packageId: string; version: string; policy: number } | null {
    if (contents.length < 73) return null;
    const toHex = (bytes: number[]) => '0x' + Buffer.from(bytes).toString('hex');
    const upgradeCapId = toHex(contents.slice(0, 32));
    const packageId = toHex(contents.slice(32, 64));
    const versionBytes = contents.slice(64, 72);
    let version = BigInt(0);
    for (let i = 7; i >= 0; i--) {
        version = (version << BigInt(8)) | BigInt(versionBytes[i]);
    }
    const policy = contents[72];
    return { upgradeCapId, packageId, version: version.toString(), policy };
}

export interface CallFunctionResult {
    success: boolean;
    digest?: string;
    effects?: any;
    events?: any[];
    gasUsed?: string;
    objectChanges?: any[];
    error?: string;
}

export interface PublishedPackageInfo {
    packageId: string;
    upgradeCapId: string;
    version: string;
    policy: number;
}

export interface GetPublishedPackagesResult {
    success: boolean;
    packages?: PublishedPackageInfo[];
    error?: string;
}

export class PackageService {
    private executor: SuiCliExecutor;

    constructor() {
        this.executor = SuiCliExecutor.getInstance();
    }

    /**
     * Publish a Move package
     * @param packagePath Path to the Move package
     * @param gasBudget Gas budget (default: 100000000)
     * @param skipDependencyVerification Skip dependency verification
     */
    public async publishPackage(
        packagePath: string,
        gasBudget: string = '100000000',
        skipDependencyVerification: boolean = false
    ): Promise<PublishResult> {
        try {
            // Validate path
            await fs.access(path.join(packagePath, 'Move.toml'));

            const args = [
                'client',
                'publish',
                '--gas-budget',
                gasBudget,
            ];

            if (skipDependencyVerification) {
                args.push('--skip-dependency-verification');
            }

            // Execute publish
            const output = await this.executor.execute(args, { cwd: packagePath, json: true });
            const data = JSON.parse(output);

            // Extract package ID from created objects
            const objectChanges = data.objectChanges || [];
            const publishedPackage = objectChanges.find((change: any) => change.type === 'published');

            return {
                success: true,
                packageId: publishedPackage?.packageId,
                digest: data.digest,
                createdObjects: objectChanges,
                output, // Include raw JSON output for debugging/display
            };
        } catch (error: any) {
            console.error('[PackageService] Publish failed:', error);
            return {
                success: false,
                error: sanitizeErrorMessage(error),
            };
        }
    }

    /**
     * Upgrade a Move package
     * @param packagePath Path to the Move package
     * @param upgradeCapId ID of the UpgradeCap object
     * @param gasBudget Gas budget
     */
    public async upgradePackage(
        packagePath: string,
        upgradeCapId: string,
        gasBudget: string = '100000000'
    ): Promise<UpgradeResult> {
        try {
            await fs.access(path.join(packagePath, 'Move.toml'));

            const args = [
                'client',
                'upgrade',
                '--upgrade-capability',
                upgradeCapId,
                '--gas-budget',
                gasBudget,
            ];

            const output = await this.executor.execute(args, { cwd: packagePath, json: true });
            const data = JSON.parse(output);

            return {
                success: true,
                digest: data.digest,
                packageId: data.packageId, // Note: Upgrade might return new package ID
            };
        } catch (error: any) {
            console.error('[PackageService] Upgrade failed:', error);
            return {
                success: false,
                error: sanitizeErrorMessage(error),
            };
        }
    }

    /**
     * Get package information using sui client object
     * @param packageId Package object ID
     */
    public async getPackageInfo(packageId: string): Promise<PackageInfo> {
        try {
            const args = ['client', 'object', packageId];

            const output = await this.executor.execute(args, { json: true });
            const data = JSON.parse(output);

            return {
                success: true,
                data,
                objectId: data.objectId || packageId,
                type: data.type || data.data?.type,
                owner: data.owner || data.data?.owner,
            };
        } catch (error: any) {
            console.error('[PackageService] Get package info failed:', error);
            return {
                success: false,
                error: sanitizeErrorMessage(error),
            };
        }
    }

    /**
     * Call a package function (Move contract interaction)
     * @param packageId Package ID
     * @param module Module name
     * @param functionName Function name
     * @param args Function arguments as strings
     * @param typeArgs Optional type arguments for generics
     * @param gasBudget Gas budget
     */
    /**
     * Get all published packages owned by an address by querying UpgradeCap objects
     * Each UpgradeCap represents a package that was published
     * @param address Owner address (optional, defaults to active address)
     */
    /**
     * Filter a raw `sui client objects --json` array for UpgradeCap objects and extract
     * package info. Factored out so callers that already fetched the raw objects list for
     * another purpose (e.g. object counts) can derive published packages from it instead of
     * spawning a second, redundant `sui client objects` subprocess - see
     * AddressService.getRawObjects + the combined /addresses/:address/summary route.
     */
    public extractPublishedPackages(objects: any[]): PublishedPackageInfo[] {
        const packages: PublishedPackageInfo[] = [];

        for (const obj of objects) {
            const data = obj.data || obj;

            // Older JSON-RPC-shaped output: decoded fields directly available.
            const flatType = data.type || data.content?.type;
            if (flatType === '0x2::package::UpgradeCap') {
                const fields = data.content?.fields || data.fields;
                if (fields?.package) {
                    packages.push({
                        packageId: fields.package,
                        upgradeCapId: data.objectId,
                        version: fields.version || '1',
                        policy: fields.policy || 0,
                    });
                }
                continue;
            }

            // Current CLI shape: type is a struct descriptor, contents are raw BCS bytes.
            const moveType = data.Move?.type_;
            const isUpgradeCap =
                moveType &&
                typeof moveType === 'object' &&
                moveType.Other?.module === 'package' &&
                moveType.Other?.name === 'UpgradeCap';
            if (isUpgradeCap && Array.isArray(data.Move?.contents)) {
                const decoded = decodeUpgradeCapContents(data.Move.contents);
                if (decoded) {
                    packages.push(decoded);
                }
            }
        }

        return packages;
    }

    public async getPublishedPackages(address?: string): Promise<GetPublishedPackagesResult> {
        try {
            // Get objects owned by address, filtering for UpgradeCap type
            const args = ['client', 'objects'];
            if (address) {
                args.push(address);
            }
            args.push('--json');

            const output = await this.executor.execute(args);
            const objects = JSON.parse(output);
            const packages = this.extractPublishedPackages(objects);

            console.log(`[PackageService] Found ${packages.length} published packages for ${address || 'active address'}`);

            return {
                success: true,
                packages,
            };
        } catch (error: any) {
            console.error('[PackageService] Get published packages failed:', error);
            return {
                success: false,
                error: sanitizeErrorMessage(error),
            };
        }
    }

    public async callPackageFunction(
        packageId: string,
        module: string,
        functionName: string,
        args: string[] = [],
        typeArgs: string[] = [],
        gasBudget: string = '100000000'
    ): Promise<CallFunctionResult> {
        try {
            // Build the function identifier: package::module::function
            const functionId = `${packageId}::${module}::${functionName}`;

            const cliArgs = [
                'client',
                'call',
                '--package',
                packageId,
                '--module',
                module,
                '--function',
                functionName,
                '--gas-budget',
                gasBudget,
            ];

            // Add type arguments if provided
            if (typeArgs && typeArgs.length > 0) {
                cliArgs.push('--type-args');
                typeArgs.forEach(typeArg => cliArgs.push(typeArg));
            }

            // Add function arguments if provided
            if (args && args.length > 0) {
                cliArgs.push('--args');
                args.forEach(arg => cliArgs.push(arg));
            }

            const output = await this.executor.execute(cliArgs, { json: true });
            const data = JSON.parse(output);

            // Extract gas used
            const gasUsed =
                data.effects?.gasUsed?.computationCost ||
                data.gasUsed?.computationCost ||
                data.effects?.gasUsed ||
                data.gasUsed;

            return {
                success: true,
                digest: data.digest || data.txDigest,
                effects: data.effects,
                events: data.events || [],
                gasUsed: gasUsed ? String(gasUsed) : undefined,
                objectChanges: data.objectChanges || [],
            };
        } catch (error: any) {
            console.error('[PackageService] Call function failed:', error);
            return {
                success: false,
                error: sanitizeErrorMessage(error),
            };
        }
    }
}
