import { MoveService } from '../services/dev/MoveService';
import { PackageService } from '../services/dev/PackageService';
import path from 'path';
import os from 'os';
import fs from 'fs/promises';

async function verify() {
    console.log('Starting verification...');

    const moveService = new MoveService();
    const packageService = new PackageService();

    const tempDir = path.join(os.tmpdir(), `sui-verify-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });

    try {
        // 1. Test New Project
        console.log('\n1. Testing New Project...');
        const projectName = 'demo_package';
        const newResult = await moveService.createNewPackage(projectName, tempDir);
        console.log('New Project Result:', newResult);

        if (!newResult.success || !newResult.path) {
            throw new Error('Failed to create new project');
        }

        const projectPath = newResult.path;

        // 2. Test Build
        console.log('\n2. Testing Build...');
        const buildResult = await moveService.buildPackage(projectPath);
        console.log('Build Result:', buildResult.success ? 'Success' : 'Failed');
        if (!buildResult.success) {
            console.error(buildResult.output);
        }

        // 3. Test Test (should fail as there are no tests in empty project, or pass with 0 tests)
        console.log('\n3. Testing Test...');
        const testResult = await moveService.runTests(projectPath);
        console.log('Test Result:', testResult);

        console.log('\nVerification completed!');

    } catch (error) {
        console.error('Verification failed:', error);
    } finally {
        // Cleanup
        try {
            await fs.rm(tempDir, { recursive: true, force: true });
        } catch { }
    }
}

verify();
