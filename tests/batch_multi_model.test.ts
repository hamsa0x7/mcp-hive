import { describe, it, expect, vi, beforeEach } from 'vitest';
import { orchestrate } from '../src/orchestrator.js';
import * as routing from '../src/routing.js';
import * as budget from '../src/budget.js';
import * as concurrency from '../src/concurrency.js';
import * as executeAgentModule from '../src/execute_agent.js';

describe('Multi-Model Batch Execution', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('should dispatch different models for different tasks in the same batch', async () => {
        const mockTasks = [
            { filePath: 'src/api.ts', role: 'security', prompt: 'sec-prompt' },
            { filePath: 'src/utils.ts', role: 'linter', prompt: 'lint-prompt' }
        ];
        vi.spyOn(routing, 'expandRoles').mockReturnValue(mockTasks);
        vi.spyOn(budget, 'checkBatchBudget').mockReturnValue({ allowed: true, estimatedTokens: 500 });

        // Mock executeAgent to return different providers per role
        vi.spyOn(executeAgentModule, 'executeAgent').mockImplementation(async (role) => {
            if (role === 'security') return {
                role: 'security',
                status: 'success' as const,
                provider: 'openai',
                model: 'gpt-4o',
                attempts: 1,
                latency_ms: 3000,
                findings: [],
                overall_confidence: 0.8
            };
            return {
                role: 'linter',
                status: 'success' as const,
                provider: 'anthropic',
                model: 'claude-haiku',
                attempts: 1,
                latency_ms: 2000,
                findings: [],
                overall_confidence: 0.7
            };
        });

        const result = await orchestrate([
            { path: 'src/api.ts' },
            { path: 'src/utils.ts' }
        ], 'multi-role');

        expect(result.total_agents).toBe(2);
        expect(result.successful).toBe(2);

        // Verify different models were used
        const providers = result.results.map(r => r.status === 'success' ? r.provider : null);
        expect(providers).toContain('openai');
        expect(providers).toContain('anthropic');
    });
});
