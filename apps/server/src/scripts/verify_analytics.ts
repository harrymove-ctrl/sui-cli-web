import { SuiCliExecutor } from '../cli/SuiCliExecutor';
import { AnalyticsService } from '../services/core/AnalyticsService';

async function verifyAnalytics() {
    console.log('Starting Analytics Verification...');

    const executor = SuiCliExecutor.getInstance();
    const analytics = AnalyticsService.getInstance();

    try {
        // 1. Run a successful command
        console.log('\n1. Running successful command...');
        await executor.execute(['client', 'active-address']);

        // 2. Run a failing command
        console.log('\n2. Running failing command...');
        try {
            await executor.execute(['client', 'invalid-command']);
        } catch {
            console.log('Command failed as expected');
        }

        // 3. Check logs
        console.log('\n3. Checking analytics logs...');
        // Give a moment for async file write
        await new Promise(resolve => setTimeout(resolve, 1000));

        const events = await analytics.getRecentEvents(5);
        console.log('Recent Events:', JSON.stringify(events, null, 2));

        const hasSuccess = events.some(e => e.type === 'command_success' && e.command === 'client');
        const hasError = events.some(e => e.type === 'command_error' && e.command === 'client');

        if (hasSuccess && hasError) {
            console.log('\n✅ Analytics Verification PASSED');
        } else {
            console.error('\n❌ Analytics Verification FAILED: Missing expected events');
            console.log('Has Success:', hasSuccess);
            console.log('Has Error:', hasError);
        }

    } catch (error) {
        console.error('Verification failed:', error);
    }
}

verifyAnalytics();
