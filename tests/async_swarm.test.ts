import { describe, it, expect, vi, beforeEach } from 'vitest';
import { orchestrateSwarm, harvestSwarm } from '../src/orchestrator.js';
import { SwarmStore } from '../src/store.js';
import * as health from '../src/health.js';
import * as executeAgentModule from '../src/execute_agent.js';
import * as config from '../src/config.js';
import { initializeDb } from '../src/db.js';
import fs from 'fs';

// Top-level mocks for internal Hive segment dependencies
vi.mock('../src/roles.js', () => ({
    loadRoles: vi.fn(),
    getRolePrompt: vi.fn().mockReturnValue('You are a helpful bee.')
}));

vi.mock('../src/resolver.js', () => ({
    resolveCandidates: vi.fn().mockReturnValue({
        candidates: [{ provider: 'openai', modelString: 'gpt-4', logicalModelName: 'gpt-4' }],
        availableProviders: ['openai'],
        providerCandidatesMap: new Map([['openai', [{ provider: 'openai', modelString: 'gpt-4', logicalModelName: 'gpt-4' }]]])
    }),
    resolveRequiredStrength: vi.fn().mockReturnValue('architecture_analysis')
}));

vi.mock('../src/security.js', () => ({
    validateTaskPath: vi.fn().mockImplementation((p: string) => ({ valid: true, normalizedPath: p }))
}));

describe('Asynchronous Hive Swarm', () => {
    beforeEach(() => {
        initializeDb(':memory:');
        vi.restoreAllMocks();
        // Reset Store
        (SwarmStore as any).swarms?.clear?.();
    });

    it('should return immediately with queen delegation for spillover tasks', async () => {
        vi.spyOn(config, 'validateAndConfigure').mockReturnValue(['openai', 'anthropic']);
        vi.spyOn(health, 'verifyHiveHealth').mockResolvedValue(new Map([['openai' as any, true]]));

        vi.spyOn(fs, 'readFileSync').mockImplementation((path: any) => {
            if (path.toString().includes('test_task.ts')) return 'content for bee';
            // Return dummy JSON for anything else that might be read during init
            return '{}';
        });
        vi.spyOn(fs, 'existsSync').mockReturnValue(true);

        vi.spyOn(executeAgentModule, 'executeAgent').mockResolvedValue({
            role: 'coder',
            status: 'success',
            provider: 'openai',
            model: 'gpt-4',
            findings: [],
            attempts: 1,
            overall_confidence: 0.9,
            latency_ms: 100
        });

        const tasks = Array(20).fill({ path: 'test_task.ts', role: 'coder' });
        const response = await orchestrateSwarm(tasks, 'swarm_123');

        expect(response.swarm_id).toBe('swarm_123');
        expect(response.total_agents).toBeGreaterThanOrEqual(20);
        expect((response.results[0] as any).error_type).toBe('queen_delegation');
    });

    it('should harvest background results when they complete', async () => {
        vi.spyOn(config, 'validateAndConfigure').mockReturnValue(['openai']);
        vi.spyOn(health, 'verifyHiveHealth').mockResolvedValue(new Map([['openai' as any, true]]));
        vi.spyOn(fs, 'readFileSync').mockReturnValue('content');
        vi.spyOn(fs, 'existsSync').mockReturnValue(true);

        vi.spyOn(executeAgentModule, 'executeAgent').mockResolvedValue({
            role: 'coder',
            status: 'success',
            provider: 'openai',
            model: 'gpt-4',
            findings: [{ type: 'info', description: 'Done' } as any],
            attempts: 1,
            overall_confidence: 0.9,
            latency_ms: 100
        });

        const tasks = [{ path: 'test_task.ts', role: 'coder' }];
        await orchestrateSwarm(tasks, 'harvest_test');

        await new Promise(resolve => setTimeout(resolve, 200));
        const harvest = await harvestSwarm('harvest_test');

        if ('status' in harvest) throw new Error('Harvest should be completed');
        if (harvest.successful !== 1) console.log(JSON.stringify(harvest, null, 2));
        expect(harvest.successful).toBe(1);
        expect(harvest.results[0].findings[0].description).toBe('Done');
    });

    it('should delegate failed bees back to the queen upon harvest', async () => {
        vi.spyOn(config, 'validateAndConfigure').mockReturnValue(['openai']);
        vi.spyOn(health, 'verifyHiveHealth').mockResolvedValue(new Map([['openai' as any, true]]));
        vi.spyOn(fs, 'readFileSync').mockReturnValue('content');
        vi.spyOn(fs, 'existsSync').mockReturnValue(true);

        vi.spyOn(executeAgentModule, 'executeAgent').mockRejectedValue(new Error('Network Crash'));

        const tasks = [{ path: 'test_task.ts', role: 'coder' }];
        await orchestrateSwarm(tasks, 'fail_test');

        await new Promise(resolve => setTimeout(resolve, 500));
        const harvest = await harvestSwarm('fail_test');

        if ('status' in harvest) throw new Error('Harvest should be completed');
        expect(harvest.fatal).toBe(1);
        expect(harvest.results[0].findings[0].type).toBe('queen_delegation');
    });
});
