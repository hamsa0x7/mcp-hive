import { describe, it, expect, vi, beforeEach } from 'vitest';
import { benchmarkSequential } from '../src/benchmark.js';
import * as executeAgentModule from '../src/execute_agent.js';

describe('Benchmark Sequential Baseline', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('should run tasks sequentially and return total time', async () => {
        // Mock executeAgent with controlled delays
        vi.spyOn(executeAgentModule, 'executeAgent').mockImplementation(async (role) => {
            await new Promise(r => setTimeout(r, 50)); // 50ms per agent
            return {
                role,
                status: 'success' as const,
                provider: 'openai',
                model: 'gpt-4o',
                attempts: 1,
                latency_ms: 50,
                findings: [],
                overall_confidence: 0.8
            };
        });

        const tasks = [
            { role: 'security', batchId: 'b1', systemPrompt: 'sys', userPrompt: 'user' },
            { role: 'linter', batchId: 'b1', systemPrompt: 'sys', userPrompt: 'user' },
            { role: 'architecture_reviewer', batchId: 'b1', systemPrompt: 'sys', userPrompt: 'user' }
        ];

        const result = await benchmarkSequential(tasks);

        expect(result.results).toHaveLength(3);
        expect(result.results.every(r => r.status === 'success')).toBe(true);
        // Sequential: 3  50ms = ~150ms minimum
        expect(result.total_ms).toBeGreaterThanOrEqual(100); // allow some timing slack
    });

    it('should handle empty task list', async () => {
        const result = await benchmarkSequential([]);

        expect(result.results).toHaveLength(0);
        expect(result.total_ms).toBeLessThan(50);
    });
});
