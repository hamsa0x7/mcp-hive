import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as routing from '../src/routing.js';
import * as budget from '../src/budget.js';
import * as executeAgentModule from '../src/execute_agent.js';
import * as resolver from '../src/resolver.js';

// Aggressive module-level mocks to bypass ESM cache issues
vi.mock('../src/health.js', () => ({
    verifyHiveHealth: vi.fn().mockResolvedValue(new Map([['openai', true], ['anthropic', true]]))
}));

vi.mock('../src/config.js', () => ({
    validateAndConfigure: vi.fn().mockReturnValue(['openai', 'anthropic'])
}));

vi.mock('../src/security.js', () => ({
    validateTaskPath: vi.fn().mockImplementation((p: string) => ({ valid: true, normalizedPath: p }))
}));

// We import orchestrate AFTER the mocks
import { orchestrate } from '../src/orchestrator.js';
import * as health from '../src/health.js';
import * as config from '../src/config.js';

describe('Batch Orchestrator (orchestrate)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Setup defaults
        vi.mocked(health.verifyHiveHealth).mockResolvedValue(new Map([['openai' as any, true], ['anthropic' as any, true]]));
        vi.mocked(config.validateAndConfigure).mockReturnValue(['openai', 'anthropic']);
    });

    it('should throw an error if the batch exceeds the 15-agent cap', async () => {
        const diffChunks = Array(16).fill({ path: 'test.ts' });
        await expect(orchestrate(diffChunks, 'security')).rejects.toThrow('Batch size 16 exceeds maximum limit of 15');
    });

    it('should throw an error if the token budget is exceeded', async () => {
        vi.spyOn(routing, 'expandSwarm').mockReturnValue([{ filePath: 'huge.ts', role: 'security', prompt: 'test' }] as any);
        vi.spyOn(budget, 'checkBatchBudget').mockReturnValue({ allowed: false, estimatedTokens: 5000, reason: 'Budget exceeded' });

        const diffChunks = [{ path: 'huge.ts' }];
        await expect(orchestrate(diffChunks, 'security')).rejects.toThrow('Budget exceeded');
    });

    it('should coordinate the full pipeline and return a typed BatchResponse', async () => {
        const mockTasks = [{ filePath: 'src/auth.ts', role: 'security', prompt: 'test' }];
        vi.spyOn(routing, 'expandSwarm').mockReturnValue(mockTasks as any);
        vi.spyOn(budget, 'checkBatchBudget').mockReturnValue({ allowed: true, estimatedTokens: 100 });

        vi.spyOn(executeAgentModule, 'executeAgent').mockResolvedValue({
            role: 'security',
            status: 'success',
            provider: 'openai',
            model: 'gpt-4o',
            attempts: 1,
            latency_ms: 3000,
            findings: [{ type: 'vuln', description: 'test', severity: 'high', location: null }],
            overall_confidence: 0.8
        });

        const result = await orchestrate([{ path: 'src/auth.ts' }], 'security');

        expect(result.total_agents).toBe(1);
        expect(result.successful).toBe(1);
        expect(result.results[0].status).toBe('success');
    });

    it('should report failed_roles when agents are exhausted', async () => {
        const mockTasks = [
            { filePath: 'src/a.ts', role: 'security', prompt: 'sec' },
            { filePath: 'src/b.ts', role: 'linter', prompt: 'lint' }
        ];
        vi.spyOn(routing, 'expandSwarm').mockReturnValue(mockTasks as any);
        vi.spyOn(budget, 'checkBatchBudget').mockReturnValue({ allowed: true, estimatedTokens: 200 });

        vi.spyOn(executeAgentModule, 'executeAgent')
            .mockResolvedValueOnce({
                role: 'security',
                status: 'success',
                provider: 'openai',
                model: 'gpt-4o',
                attempts: 1,
                latency_ms: 2000,
                findings: [],
                overall_confidence: 0.5
            })
            .mockResolvedValueOnce({
                role: 'linter',
                status: 'exhausted',
                findings: [],
                attempted: [{ model: 'deepseek', provider: 'openrouter', attempts: 2, last_error: '429' }],
                retryable: true,
                latency_ms: 14000
            });

        const result = await orchestrate([{ path: 'src/a.ts' }, { path: 'src/b.ts' }], 'multi');

        expect(result.total_agents).toBe(2);
        expect(result.successful).toBe(1);
        expect(result.exhausted).toBe(1);
        expect(result.failed_roles).toEqual(['linter']);
    });

    it('should normalize unexpected runtime task crashes into fatal_error results', async () => {
        const mockTasks = [{ filePath: 'src/auth.ts', role: 'security', prompt: 'test', requiredStrength: 'security_detection' }];
        vi.spyOn(routing, 'expandSwarm').mockReturnValue(mockTasks as any);
        vi.spyOn(budget, 'checkBatchBudget').mockReturnValue({ allowed: true, estimatedTokens: 100 });
        vi.spyOn(executeAgentModule, 'executeAgent').mockRejectedValue(new Error('boom'));

        const result = await orchestrate([{ path: 'src/auth.ts' }], 'security');

        expect(result.fatal).toBe(1);
        expect(result.results[0].status).toBe('fatal_error');
        if (result.results[0].status === 'fatal_error') {
            expect(result.results[0].error_type).toBe('runtime_task_error');
            expect(result.results[0].message).toContain('boom');
        }
    });
});
