import { describe, it, expect } from 'vitest';
import { aggregateBatch } from '../src/aggregate.js';
import { AgentResult } from '../src/types.js';

describe('Batch Aggregator (aggregateBatch)', () => {
    it('should count success, exhausted, and fatal results correctly', () => {
        const results: AgentResult[] = [
            {
                role: 'security',
                status: 'success',
                provider: 'openai',
                model: 'gpt-4o',
                attempts: 1,
                latency_ms: 4000,
                findings: [{ type: 'vulnerability', severity: 'high' }],
                overall_confidence: 0.8
            },
            {
                role: 'linter',
                status: 'exhausted',
                attempted: [
                    { model: 'deepseek', provider: 'openrouter', attempts: 2, last_error: '429' }
                ],
                retryable: true,
                latency_ms: 14000
            },
            {
                role: 'architecture_reviewer',
                status: 'fatal_error',
                provider: 'anthropic',
                model: 'claude-3',
                error_type: 'invalid_api_key',
                message: 'Unauthorized',
                retryable: false
            }
        ];

        const batch = aggregateBatch(results);

        expect(batch.total_agents).toBe(3);
        expect(batch.successful).toBe(1);
        expect(batch.exhausted).toBe(1);
        expect(batch.fatal).toBe(1);
        expect(batch.failed_roles).toEqual(['linter', 'architecture_reviewer']);
        expect(batch.results).toHaveLength(3);
    });

    it('should handle all-success batches', () => {
        const results: AgentResult[] = [
            {
                role: 'security',
                status: 'success',
                provider: 'openai',
                model: 'gpt-4o',
                attempts: 1,
                latency_ms: 3000,
                findings: [],
                overall_confidence: 0.5
            }
        ];

        const batch = aggregateBatch(results);

        expect(batch.successful).toBe(1);
        expect(batch.exhausted).toBe(0);
        expect(batch.fatal).toBe(0);
        expect(batch.failed_roles).toEqual([]);
    });

    it('should handle empty batches', () => {
        const batch = aggregateBatch([]);

        expect(batch.total_agents).toBe(0);
        expect(batch.successful).toBe(0);
        expect(batch.failed_roles).toEqual([]);
    });
});
