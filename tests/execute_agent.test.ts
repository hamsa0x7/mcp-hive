import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeAgent } from '../src/execute_agent.js';
import * as proxy from '../src/proxy.js';
import * as resolver from '../src/resolver.js';
import { ModelCallError } from '../src/proxy.js';
import { resetBreakers } from '../src/circuit_breaker.js';

describe('executeAgent  3-Tier Retry Engine', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        resetBreakers();
    });

    it('should return success on first attempt', async () => {
        vi.spyOn(resolver, 'resolveCandidates').mockReturnValue({
            candidates: [
                { provider: 'openai', modelString: 'gpt-4o', logicalModelName: 'gpt-4o' }
            ]
        } as any);
        vi.spyOn(proxy, 'callModel').mockResolvedValue([{ type: 'vuln', severity: 'high' }]);

        const result = await executeAgent('security', 'batch-1', 'sys', 'user');

        expect(result.status).toBe('success');
        if (result.status === 'success') {
            expect(result.provider).toBe('openai');
            expect(result.model).toBe('gpt-4o');
            expect(result.attempts).toBe(1);
            expect(result.findings).toHaveLength(1);
        }
    });

    it('should retry on transient error and succeed on second attempt', async () => {
        vi.spyOn(resolver, 'resolveCandidates').mockReturnValue({
            candidates: [
                { provider: 'openai', modelString: 'gpt-4o', logicalModelName: 'gpt-4o' }
            ]
        } as any);

        const callSpy = vi.spyOn(proxy, 'callModel')
            .mockRejectedValueOnce(new ModelCallError('Rate limited', 429))
            .mockResolvedValueOnce([{ type: 'vuln' }]);

        const result = await executeAgent('security', 'batch-1', 'sys', 'user');

        expect(result.status).toBe('success');
        if (result.status === 'success') {
            expect(result.attempts).toBe(2);
        }
        expect(callSpy).toHaveBeenCalledTimes(2);
    });

    it('should escalate to next candidate after exhausting retries', async () => {
        vi.spyOn(resolver, 'resolveCandidates').mockReturnValue({
            candidates: [
                { provider: 'openai', modelString: 'gpt-4o', logicalModelName: 'gpt-4o' },
                { provider: 'anthropic', modelString: 'claude-3', logicalModelName: 'claude-3' }
            ]
        } as any);

        const callSpy = vi.spyOn(proxy, 'callModel')
            // First candidate: 2 retryable failures
            .mockRejectedValueOnce(new ModelCallError('Rate limited', 429))
            .mockRejectedValueOnce(new ModelCallError('Rate limited', 429))
            // Second candidate: success
            .mockResolvedValueOnce([{ type: 'finding' }]);

        const result = await executeAgent('security', 'batch-1', 'sys', 'user');

        expect(result.status).toBe('success');
        if (result.status === 'success') {
            expect(result.provider).toBe('anthropic');
            expect(result.model).toBe('claude-3');
        }
        expect(callSpy).toHaveBeenCalledTimes(3);
    });

    it('should return fatal_error immediately on non-retryable error', async () => {
        vi.spyOn(resolver, 'resolveCandidates').mockReturnValue({
            candidates: [
                { provider: 'openai', modelString: 'gpt-4o', logicalModelName: 'gpt-4o' },
                { provider: 'anthropic', modelString: 'claude-3', logicalModelName: 'claude-3' }
            ]
        } as any);

        vi.spyOn(proxy, 'callModel').mockRejectedValue(
            new ModelCallError('Unauthorized', 401)
        );

        const result = await executeAgent('security', 'batch-1', 'sys', 'user');

        expect(result.status).toBe('fatal_error');
        if (result.status === 'fatal_error') {
            expect(result.error_type).toBe('invalid_api_key');
            expect(result.retryable).toBe(false);
            expect(result.provider).toBe('openai');
        }
    });

    it('should return exhausted after all candidates fail with retryable errors', { timeout: 15000 }, async () => {
        vi.spyOn(resolver, 'resolveCandidates').mockReturnValue({
            candidates: [
                { provider: 'openai', modelString: 'gpt-4o', logicalModelName: 'gpt-4o' },
                { provider: 'anthropic', modelString: 'claude-3', logicalModelName: 'claude-3' }
            ]
        } as any);

        vi.spyOn(proxy, 'callModel').mockRejectedValue(
            new ModelCallError('Service unavailable', 503)
        );

        const result = await executeAgent('security', 'batch-1', 'sys', 'user');

        expect(result.status).toBe('exhausted');
        if (result.status === 'exhausted') {
            expect(result.retryable).toBe(true);
            expect(result.attempted).toHaveLength(2);
            expect(result.attempted[0].provider).toBe('openai');
            expect(result.attempted[0].attempts).toBe(2);
            expect(result.attempted[1].provider).toBe('anthropic');
            expect(result.attempted[1].attempts).toBe(2);
        }
    });

    it('should return fatal_error if no candidates can be resolved', async () => {
        vi.spyOn(resolver, 'resolveCandidates').mockImplementation(() => {
            throw new Error('No available provider found in pool');
        });

        const result = await executeAgent('unknown_role', 'batch-1', 'sys', 'user');

        expect(result.status).toBe('fatal_error');
        if (result.status === 'fatal_error') {
            expect(result.error_type).toBe('no_candidates');
        }
    });
});
