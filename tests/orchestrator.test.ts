import { describe, it, expect, vi, beforeEach } from 'vitest';
import { orchestrate } from '../src/orchestrator.js';
import * as routing from '../src/routing.js';
import * as budget from '../src/budget.js';
import * as executeAgentModule from '../src/execute_agent.js';
import * as resolver from '../src/resolver.js';

describe('Batch Orchestrator (orchestrate)', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('should throw an error if the batch exceeds the 15-agent cap', async () => {
        const diffChunks = Array(16).fill({ path: 'test.ts' });
        await expect(orchestrate(diffChunks, 'security')).rejects.toThrow('Batch size 16 exceeds maximum limit of 15');
    });

    it('should throw an error if the token budget is exceeded', async () => {
        vi.spyOn(routing, 'expandRoles').mockReturnValue([{ filePath: 'huge.ts', role: 'security', prompt: 'test' }]);
        vi.spyOn(budget, 'checkBatchBudget').mockReturnValue({ allowed: false, estimatedTokens: 5000, reason: 'Budget exceeded' });

        const diffChunks = [{ path: 'huge.ts' }];
        await expect(orchestrate(diffChunks, 'security')).rejects.toThrow('Budget exceeded');
    });

    it('should coordinate the full pipeline and return a typed BatchResponse', async () => {
        const mockTasks = [{ filePath: 'src/auth.ts', role: 'security', prompt: 'test' }];
        vi.spyOn(routing, 'expandRoles').mockReturnValue(mockTasks);
        vi.spyOn(budget, 'checkBatchBudget').mockReturnValue({ allowed: true, estimatedTokens: 100 });

        vi.spyOn(executeAgentModule, 'executeAgent').mockResolvedValue({
            role: 'security',
            status: 'success',
            provider: 'openai',
            model: 'gpt-4o',
            attempts: 1,
            latency_ms: 3000,
            findings: [{ type: 'vuln' }],
            overall_confidence: 0.8
        });

        const result = await orchestrate([{ path: 'src/auth.ts' }], 'security');

        expect(result.total_agents).toBe(1);
        expect(result.successful).toBe(1);
        expect(result.exhausted).toBe(0);
        expect(result.fatal).toBe(0);
        expect(result.failed_roles).toEqual([]);
        expect(result.results[0].status).toBe('success');
    });

    it('should report failed_roles when agents are exhausted', async () => {
        const mockTasks = [
            { filePath: 'src/a.ts', role: 'security', prompt: 'sec' },
            { filePath: 'src/b.ts', role: 'linter', prompt: 'lint' }
        ];
        vi.spyOn(routing, 'expandRoles').mockReturnValue(mockTasks);
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
});
