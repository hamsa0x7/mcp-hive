import { describe, it, vi, afterAll, beforeEach } from 'vitest';
import { orchestrate } from '../src/orchestrator.js';
import * as dotenv from 'dotenv';
import path from 'path';
import * as health from '../src/health.js';
import * as config from '../src/config.js';

// Load .env
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const validSchemaMock = JSON.stringify([
    {
        type: "vulnerability",
        description: "Mocked finding for structural integrity",
        severity: "low",
        location: "src/mock.ts:1"
    }
]);

// Mock fetch globally for the diagnostic to prevent live external calls hitting rate limits or missing keys.
global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
        choices: [{ message: { content: validSchemaMock } }],
        usage: { prompt_tokens: 100, completion_tokens: 50 }
    })
}) as any;

describe('Hive Diagnostic (E2E)', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        vi.spyOn(config, 'validateAndConfigure').mockReturnValue(['openai', 'anthropic']);
        vi.spyOn(health, 'verifyHiveHealth').mockResolvedValue(new Map([['openai' as any, true]]));
    });

    afterAll(() => {
        vi.restoreAllMocks();
    });

    it('should complete a live or mocked orchestration batch', async () => {
        console.log(' Starting MCP Hive Diagnostic...\n');

        // 1. Check for API Keys
        const providers = ['OPENROUTER_API_KEY', 'GROQ_API_KEY', 'GOOGLE_API_KEY', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY'];
        const foundKeys = providers.filter(key => process.env[key]);

        if (foundKeys.length === 0) {
            console.warn(' Warning: No API keys found in .env. Real LLM calls will fail.');
        } else {
            console.log(' Found API keys for:', foundKeys.map(k => k.replace('_API_KEY', '')).join(', '));
        }

        // 2. Simulate a Batch Request
        console.log('\n Simulating Batch Request...');
        const mockDiffs = [
            { path: 'src/proxy.ts' },
            { path: 'src/orchestrator.ts' }
        ];

        console.log('  -> Dispatching 2 subagents (security & linting)...');
        const start = Date.now();
        const batch = await orchestrate(mockDiffs, 'security_specialist');
        const duration = Date.now() - start;

        console.log(` Batch completed in ${duration}ms`);
        console.log('\n Summary:');
        console.log(`  - Total Agents: ${batch.total_agents}`);
        console.log(`  - Successful: ${batch.successful}`);
        console.log(`  - Exhausted: ${batch.exhausted}`);
        console.log(`  - Fatal: ${batch.fatal}`);

        if (batch.failed_roles.length > 0) {
            console.log(`\n Failed roles: ${batch.failed_roles.join(', ')}`);
            const firstFailed = batch.results.find(r => r.status !== 'success');
            if (firstFailed) {
                console.log(JSON.stringify(firstFailed, null, 2));
            }
        }
    });
});
