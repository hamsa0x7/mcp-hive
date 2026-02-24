import { orchestrate } from '../src/orchestrator.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Use a file from the codebase as the test subject
const testFile = path.resolve(__dirname, '../src/health.ts');

async function runRealtimeTest() {
    console.log('🚀 Starting Real-time Resilience Test...');
    console.log(`📂 Testing with file: ${testFile}`);

    try {
        const result = await orchestrate(
            [{ path: testFile }],
            'security_specialist',
            'realtime-test-' + Date.now(),
            'Analyze this file for any security weaknesses in its new health check logic.'
        );

        console.log('\n✅ Swarm Results Received:');
        console.log(`Total Agents: ${result.total_agents}`);
        console.log(`Successful: ${result.successful}`);
        console.log(`Failed Roles: ${JSON.stringify(result.failed_roles)}`);

        if (result.results.length > 0) {
            console.log('\n🔍 First Agent Findings:');
            const firstAgent = result.results[0];
            console.log(`Status: ${firstAgent.status}`);
            console.log(`Provider: ${firstAgent.provider}`);
            console.log(`Model: ${firstAgent.model}`);

            if (firstAgent.findings) {
                firstAgent.findings.forEach((f: any) => {
                    console.log(`  - [${f.severity}] ${f.type}: ${f.description}`);
                });
            }
        }

        if (result.metrics) {
            console.log('\n📊 Swarm Metrics:');
            console.log(`  Wall Time: ${result.metrics.total_wall_time_ms}ms`);
            console.log(`  Circuit Breaker States: ${JSON.stringify(result.metrics.circuit_breakers)}`);
            console.log(`  Queue Depth: ${JSON.stringify(result.metrics.global_queue)}`);
            console.log(`  Health Metrics: ${JSON.stringify(result.metrics.health_metrics)}`);
        }

    } catch (error: any) {
        console.error('\n❌ Real-time Test Failed:');
        console.error(error.message);
        if (error.stack) console.error(error.stack);
    }
}

runRealtimeTest();
