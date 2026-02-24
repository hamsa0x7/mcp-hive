import { executeAgent } from './execute_agent.js';
import { resolveCandidates } from './resolver.js';
import { AgentResult } from './types.js';
import { computeComparison, BenchmarkComparison } from './telemetry.js';

/**
 * Runs agents sequentially (no concurrency) to establish a baseline.
 * Uses the same models, payloads, and retry logic as Hive 
 * the only difference is sequential vs parallel execution.
 */
export async function benchmarkSequential(
    tasks: { role: string; batchId: string; systemPrompt: string; userPrompt: string }[]
): Promise<{ results: AgentResult[]; total_ms: number }> {
    const start = Date.now();
    const results: AgentResult[] = [];

    for (const task of tasks) {
        const result = await executeAgent(task.role, task.batchId, task.systemPrompt, task.userPrompt);
        results.push(result);
    }

    return {
        results,
        total_ms: Date.now() - start
    };
}

/**
 * Runs the same tasks through Hive's concurrent engine and compares
 * against a sequential baseline.
 *
 * Returns a BenchmarkComparison with speedup factor and parallel gain.
 */
export async function runComparison(
    tasks: { role: string; batchId: string; systemPrompt: string; userPrompt: string }[],
    hiveMs: number
): Promise<BenchmarkComparison> {
    const sequential = await benchmarkSequential(tasks);
    return computeComparison(tasks.length, sequential.total_ms, hiveMs);
}
