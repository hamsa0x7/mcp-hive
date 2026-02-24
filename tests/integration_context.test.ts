import { describe, it, expect, vi, beforeEach } from 'vitest';
import { orchestrate } from '../src/orchestrator.js';
import * as routing from '../src/routing.js';
import * as budget from '../src/budget.js';
import * as executeAgentModule from '../src/execute_agent.js';
import * as context from '../src/context.js';
import * as health from '../src/health.js';
import * as config from '../src/config.js';
import { initializeDb } from '../src/db.js';

describe('Context Injection Integration', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        initializeDb(':memory:');
        vi.spyOn(config, 'validateAndConfigure').mockReturnValue(['openai', 'anthropic']);
        vi.spyOn(health, 'verifyHiveHealth').mockResolvedValue(new Map([['openai' as any, true]]));
    });

    it('should pass resolved context through to executeAgent via the orchestration pipeline', async () => {
        const mockTasks = [{ filePath: 'src/auth.ts', role: 'security', prompt: 'test' }];
        vi.spyOn(routing, 'expandSwarm').mockReturnValue(mockTasks);
        vi.spyOn(budget, 'checkBatchBudget').mockReturnValue({ allowed: true, estimatedTokens: 100 });

        // Mock context resolution
        vi.spyOn(context, 'resolveContext').mockResolvedValue('MOCK CONTEXT CONTENT');

        // Mock executeAgent and capture the userPrompt argument
        const executeAgentSpy = vi.spyOn(executeAgentModule, 'executeAgent').mockResolvedValue({
            role: 'security',
            status: 'success',
            provider: 'openai',
            model: 'gpt-4o',
            attempts: 1,
            latency_ms: 3000,
            findings: [],
            overall_confidence: 0.5
        });

        await orchestrate([{ path: 'src/auth.ts' }], 'security');

        // Verify executeAgent was called with context-augmented prompt
        expect(executeAgentSpy).toHaveBeenCalledWith(
            'security',
            expect.any(String),
            'test',
            expect.stringContaining('MOCK CONTEXT CONTENT'),
            undefined,
            undefined,
            undefined
        );
        expect(executeAgentSpy).toHaveBeenCalledWith(
            'security',
            expect.any(String),
            'test',
            expect.stringContaining('Analyze file: src/auth.ts'),
            undefined,
            undefined,
            undefined
        );
    });
});
