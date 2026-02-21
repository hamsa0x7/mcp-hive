import { describe, it } from 'vitest';
import { orchestrate } from '../src/orchestrator.js';
import * as dotenv from 'dotenv';
import path from 'path';

// Load .env
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

describe('Hive Diagnostic (E2E)', () => {
    it('should complete a live or mocked orchestration batch', async () => {
        console.log('🚀 Starting MCP Hive Diagnostic...\n');

        // 1. Check for API Keys
        const providers = ['OPENROUTER_API_KEY', 'GROQ_API_KEY', 'GOOGLE_API_KEY', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY'];
        const foundKeys = providers.filter(key => process.env[key]);

        if (foundKeys.length === 0) {
            console.warn('⚠️ Warning: No API keys found in .env. Real LLM calls will fail.');
        } else {
            console.log('✅ Found API keys for:', foundKeys.map(k => k.replace('_API_KEY', '')).join(', '));
        }

        // 2. Simulate a Batch Request
        console.log('\n📦 Simulating Batch Request...');
        const mockDiffs = [
            { path: 'src/proxy.ts' },
            { path: 'src/orchestrator.ts' }
        ];

        console.log('  -> Dispatching 2 subagents (security & linting)...');
        const start = Date.now();
        const batch = await orchestrate(mockDiffs, 'security_specialist');
        const duration = Date.now() - start;

        console.log(`✅ Batch completed in ${duration}ms`);
        console.log('\n📊 Summary:');
        console.log(`  - Total Agents: ${batch.total_agents}`);
        console.log(`  - Successful: ${batch.successful}`);
        console.log(`  - Exhausted: ${batch.exhausted}`);
        console.log(`  - Fatal: ${batch.fatal}`);

        if (batch.failed_roles.length > 0) {
            console.log(`\n❌ Failed roles: ${batch.failed_roles.join(', ')}`);
            const firstFailed = batch.results.find(r => r.status !== 'success');
            if (firstFailed) {
                console.log(JSON.stringify(firstFailed, null, 2));
            }
        }
    });
});
