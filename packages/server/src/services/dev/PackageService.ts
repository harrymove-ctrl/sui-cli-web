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

            // Filter for UpgradeCap objects and extract package info
            const packages: PublishedPackageInfo[] = [];

            for (const obj of objects) {
                const data = obj.data || obj;
                const type = data.type || data.content?.type;

                // Check if this is an UpgradeCap
                if (type === '0x2::package::UpgradeCap') {
                    const fields = data.content?.fields || data.fields;
                    if (fields?.package) {
                        packages.push({
                            packageId: fields.package,
                            upgradeCapId: data.objectId,
                            version: fields.version || '1',
                            policy: fields.policy || 0,
                        });
                    }
                }
            }

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
