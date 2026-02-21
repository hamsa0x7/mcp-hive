import { describe, it, expect } from 'vitest';
import {
    computeSwarmMetrics,
    computeComparison,
    SwarmTimestamps
} from '../src/telemetry.js';
import { AgentResult } from '../src/types.js';

describe('Swarm Telemetry (computeSwarmMetrics)', () => {
    it('should compute timing breakdown from timestamps', () => {
        const ts: SwarmTimestamps = {
            swarm_start: 1000,
            after_decomposition: 1030,
            after_context_boost: 1100,
            after_dispatch: 1110,
            after_inference: 10110,
            after_aggregation: 10160
        };

        const results: AgentResult[] = [
            { role: 'security', status: 'success', provider: 'openai', model: 'gpt-4o', attempts: 1, latency_ms: 8900, findings: [], overall_confidence: 0.8 },
            { role: 'linter', status: 'success', provider: 'groq', model: 'qwen', attempts: 2, latency_ms: 5200, findings: [], overall_confidence: 0.7 }
        ];

        const m = computeSwarmMetrics('sw_001', ts, results);

        expect(m.swarm_id).toBe('sw_001');
        expect(m.decomposition_ms).toBe(30);
        expect(m.context_boost_ms).toBe(70);
        expect(m.dispatch_overhead_ms).toBe(10);
        expect(m.inference_wall_time_ms).toBe(9000);
        expect(m.aggregation_ms).toBe(50);
        expect(m.total_wall_time_ms).toBe(9160);
        expect(m.max_agent_latency_ms).toBe(8900);
        expect(m.parallel_efficiency).toBeGreaterThan(0.9);
        expect(m.total_retries).toBe(1); // linter had 2 attempts = 1 retry
    });

    it('should compute parallel efficiency correctly', () => {
        const ts: SwarmTimestamps = {
            swarm_start: 0,
            after_decomposition: 10,
            after_context_boost: 20,
            after_dispatch: 30,
            after_inference: 10030,
            after_aggregation: 10050
        };

        const results: AgentResult[] = [
            { role: 'a', status: 'success', provider: 'openai', model: 'gpt', attempts: 1, latency_ms: 10000, findings: [], overall_confidence: 0.8 },
            { role: 'b', status: 'success', provider: 'openai', model: 'gpt', attempts: 1, latency_ms: 5000, findings: [], overall_confidence: 0.8 }
        ];

        const m = computeSwarmMetrics('sw_002', ts, results);
        expect(m.parallel_efficiency).toBeGreaterThan(0.99);
    });

    it('should count retries and escalations from exhausted results', () => {
        const ts: SwarmTimestamps = {
            swarm_start: 0,
            after_decomposition: 5,
            after_context_boost: 10,
            after_dispatch: 15,
            after_inference: 30000,
            after_aggregation: 30010
        };

        const results: AgentResult[] = [{
            role: 'security',
            status: 'exhausted',
            attempted: [
                { model: 'gpt-4o', provider: 'openai', attempts: 2, last_error: '429' },
                { model: 'claude-3', provider: 'anthropic', attempts: 2, last_error: '503' }
            ],
            retryable: true,
            latency_ms: 29000
        }];

        const m = computeSwarmMetrics('sw_003', ts, results);
        expect(m.total_retries).toBe(2);
        expect(m.provider_switches).toBe(1);
        expect(m.model_escalations).toBe(1);
    });

    it('should compute sequential estimate and speedup factor', () => {
        const ts: SwarmTimestamps = {
            swarm_start: 0,
            after_decomposition: 10,
            after_context_boost: 20,
            after_dispatch: 30,
            after_inference: 6030,
            after_aggregation: 6050
        };

        const results: AgentResult[] = [
            { role: 'security', status: 'success', provider: 'openai', model: 'gpt', attempts: 1, latency_ms: 4000, findings: [], overall_confidence: 0.8 },
            { role: 'linter', status: 'success', provider: 'groq', model: 'qwen', attempts: 1, latency_ms: 5000, findings: [], overall_confidence: 0.7 },
            { role: 'arch', status: 'success', provider: 'anthropic', model: 'claude', attempts: 1, latency_ms: 3000, findings: [], overall_confidence: 0.9 },
            { role: 'perf', status: 'success', provider: 'openai', model: 'gpt', attempts: 1, latency_ms: 4000, findings: [], overall_confidence: 0.6 },
            { role: 'naming', status: 'success', provider: 'groq', model: 'qwen', attempts: 1, latency_ms: 2000, findings: [], overall_confidence: 0.5 }
        ];

        const m = computeSwarmMetrics('sw_004', ts, results);

        // Sequential estimate = 4000 + 5000 + 3000 + 4000 + 2000 = 18000ms
        expect(m.sequential_estimate_ms).toBe(18000);
        // Wall time = 6050ms
        expect(m.total_wall_time_ms).toBe(6050);
        // Speedup = 18000 / 6050 ≈ 2.98x
        expect(m.speedup_factor).toBeGreaterThan(2.5);
        expect(m.speedup_factor).toBeLessThan(3.5);
        // Time saved = 18000 - 6050 = 11950ms
        expect(m.time_saved_ms).toBe(11950);
    });

    it('should include structured acceleration report', () => {
        const ts: SwarmTimestamps = {
            swarm_start: 0,
            after_decomposition: 10,
            after_context_boost: 20,
            after_dispatch: 30,
            after_inference: 6030,
            after_aggregation: 6050
        };

        const results: AgentResult[] = [
            { role: 'security', status: 'success', provider: 'openai', model: 'gpt', attempts: 1, latency_ms: 5000, findings: [], overall_confidence: 0.8 },
            { role: 'linter', status: 'success', provider: 'groq', model: 'qwen', attempts: 1, latency_ms: 3000, findings: [], overall_confidence: 0.7 }
        ];

        const m = computeSwarmMetrics('sw_005', ts, results);

        expect(m.acceleration_report.agents).toBe(2);
        expect(m.acceleration_report.sequential_ms).toBe(8000);
        expect(m.acceleration_report.parallel_ms).toBe(6050);
        expect(m.acceleration_report.speedup).toBeGreaterThan(1);
        expect(m.acceleration_report.time_saved_ms).toBe(1950);
        expect(m.acceleration_report.parallel_efficiency).toBeGreaterThan(0.8);
        expect(typeof m.acceleration_report.theme).toBe('string');
    });

    it('should include acceleration report for single agent', () => {
        const ts: SwarmTimestamps = {
            swarm_start: 0,
            after_decomposition: 5,
            after_context_boost: 10,
            after_dispatch: 12,
            after_inference: 4012,
            after_aggregation: 4020
        };

        const results: AgentResult[] = [
            { role: 'security', status: 'success', provider: 'openai', model: 'gpt', attempts: 1, latency_ms: 4000, findings: [], overall_confidence: 0.8 }
        ];

        const m = computeSwarmMetrics('sw_006', ts, results);

        expect(m.acceleration_report.agents).toBe(1);
        expect(m.acceleration_report.sequential_ms).toBe(4000);
    });

    it('STRESS: 1 agent hard-timeout (45s) + 4 fast agents (5s each) → speedup ≈ 1.4x (not inflated)', () => {
        // Scenario:
        //   security agent retried across all candidates, hit 45s hard timeout → exhausted
        //   4 other agents finished in ~5s each
        //   Sequential would be: 45 + 5 + 5 + 5 + 5 = 65s
        //   Parallel wall time ≈ 45s (bottlenecked by the slow agent)
        //   Speedup = 65 / 45 ≈ 1.44x — modest, honest gain

        const ts: SwarmTimestamps = {
            swarm_start: 0,
            after_decomposition: 20,
            after_context_boost: 50,
            after_dispatch: 60,
            after_inference: 45060,
            after_aggregation: 45100
        };

        const results: AgentResult[] = [
            // Agent 1: exhausted after 45s hard timeout (full retry ladder)
            {
                role: 'security_specialist',
                status: 'exhausted',
                attempted: [
                    { model: 'deepseek-v3', provider: 'openrouter', attempts: 2, last_error: '429' },
                    { model: 'gpt-4o', provider: 'openai', attempts: 2, last_error: '503' },
                    { model: 'claude-3.5', provider: 'anthropic', attempts: 2, last_error: 'agent_timeout' }
                ],
                retryable: true,
                latency_ms: 45000
            },
            // Agents 2-5: fast successes
            { role: 'linter', status: 'success', provider: 'groq', model: 'qwen', attempts: 1, latency_ms: 5000, findings: [{ type: 'naming' }], overall_confidence: 0.7 },
            { role: 'complexity_analyzer', status: 'success', provider: 'openai', model: 'gpt-4o-mini', attempts: 1, latency_ms: 5000, findings: [], overall_confidence: 0.5 },
            { role: 'dead_code_detector', status: 'success', provider: 'groq', model: 'qwen', attempts: 1, latency_ms: 5000, findings: [{ type: 'unused_import' }], overall_confidence: 0.6 },
            { role: 'error_handling_auditor', status: 'success', provider: 'openai', model: 'gpt-4o', attempts: 1, latency_ms: 5000, findings: [], overall_confidence: 0.5 }
        ];

        const m = computeSwarmMetrics('sw_stress_001', ts, results);

        // Sequential estimate = 45000 + 5000 + 5000 + 5000 + 5000 = 65000ms
        expect(m.sequential_estimate_ms).toBe(65000);

        // Wall time ≈ 45100ms (bottlenecked by exhausted agent)
        expect(m.total_wall_time_ms).toBe(45100);

        // Speedup = 65000 / 45100 ≈ 1.44x — NOT inflated
        expect(m.speedup_factor).toBeGreaterThan(1.3);
        expect(m.speedup_factor).toBeLessThan(1.6);

        // Time saved = 65000 - 45100 = 19900ms
        expect(m.time_saved_ms).toBe(19900);

        // Max agent latency = 45000 (the exhausted one)
        expect(m.max_agent_latency_ms).toBe(45000);

        // Parallel efficiency: 45000 / 45100 ≈ 0.998 (almost perfect — wall time ≈ slowest agent)
        expect(m.parallel_efficiency).toBeGreaterThan(0.99);

        // Retry count: 3 candidates × (2 attempts - 1 retry each) = 3 retries
        expect(m.total_retries).toBe(3);

        // Provider switches: openrouter, openai, anthropic = 2 switches
        expect(m.provider_switches).toBe(2);

        // Model escalations: deepseek-v3, gpt-4o, claude-3.5 = 2 escalations
        expect(m.model_escalations).toBe(2);

        // Report object should reflect honest numbers
        expect(m.acceleration_report.agents).toBe(5);
        expect(m.acceleration_report.sequential_ms).toBe(65000);
        expect(m.acceleration_report.speedup).toBeGreaterThan(1.3);
        expect(m.acceleration_report.speedup).toBeLessThan(1.6);
    });
});

describe('Benchmark Comparison (computeComparison)', () => {
    it('should compute speedup factor correctly', () => {
        const c = computeComparison(5, 18000, 6000);

        expect(c.agents).toBe(5);
        expect(c.baseline_sequential_ms).toBe(18000);
        expect(c.hive_parallel_ms).toBe(6000);
        expect(c.speedup_factor).toBe(3);
        expect(c.parallel_gain_ms).toBe(12000);
        expect(c.relative_gain).toBe(0.667);
    });

    it('should handle zero parallel time gracefully', () => {
        const c = computeComparison(1, 5000, 0);
        expect(c.speedup_factor).toBe(0);
    });

    it('should handle equal times', () => {
        const c = computeComparison(1, 4000, 4000);
        expect(c.speedup_factor).toBe(1);
        expect(c.parallel_gain_ms).toBe(0);
        expect(c.relative_gain).toBe(0);
    });
});
