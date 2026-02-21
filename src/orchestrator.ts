import { expandRoles } from './routing.js';
import { checkBatchBudget } from './budget.js';
import { runConcurrent } from './concurrency.js';
import { executeAgent } from './execute_agent.js';
import { resolveContext } from './context.js';
import { aggregateBatch } from './aggregate.js';
import { loadRoles } from './roles.js';
import { validateAndConfigure } from './config.js';
import { AgentResult, BatchResponse } from './types.js';
import { createTimestamps, computeSwarmMetrics } from './telemetry.js';

// Load roles on module load
loadRoles('roles.json');

const MAX_AGENTS_PER_BATCH = 15;
const DEFAULT_BATCH_TOKEN_LIMIT = 100000;

/**
 * Coordinates the full batch execution pipeline with timing instrumentation.
 *
 * @param diffChunks - Array of objects containing file paths
 * @param role - The role to assign to subagents
 * @param batchId - Optional batch identifier (default: epoch timestamp)
 * @returns Structured BatchResponse with typed AgentResult per agent and SwarmMetrics
 */
export async function orchestrate(
    diffChunks: { path: string }[],
    role: string,
    batchId: string = Date.now().toString()
): Promise<BatchResponse> {
    const ts = createTimestamps();

    // Enforce redundancy
    validateAndConfigure();

    // 1. Enforce batch scale cap
    if (diffChunks.length > MAX_AGENTS_PER_BATCH) {
        throw new Error(`Batch size ${diffChunks.length} exceeds maximum limit of ${MAX_AGENTS_PER_BATCH}`);
    }

    // 2. Expand roles into tasks (decomposition)
    const files = diffChunks.map(chunk => chunk.path);
    const tasks = expandRoles(files, role);

    // 3. Check batch token budget
    const budgetCheck = checkBatchBudget(tasks, DEFAULT_BATCH_TOKEN_LIMIT);
    if (!budgetCheck.allowed) {
        throw new Error(budgetCheck.reason || 'Token budget exceeded');
    }

    ts.after_decomposition = Date.now();

    // 4. Resolve context for all tasks (context boost phase)
    const contextMap = new Map<string, string>();
    for (const task of tasks) {
        const ctx = await resolveContext(task.filePath);
        if (ctx) contextMap.set(task.filePath, ctx);
    }

    ts.after_context_boost = Date.now();

    // 5. Build concurrent task wrappers (dispatch phase)
    const concurrentTasks = tasks.map(task => {
        return async (): Promise<AgentResult> => {
            const context = contextMap.get(task.filePath);
            const userPrompt = context
                ? `${context}\n\nAnalyze file: ${task.filePath}`
                : `Analyze file: ${task.filePath}`;

            return executeAgent(task.role, batchId, task.prompt, userPrompt);
        };
    });

    ts.after_dispatch = Date.now();

    // 6. Run concurrent execution (limit: 5) — inference phase
    const results = await runConcurrent(concurrentTasks, 5) as AgentResult[];

    ts.after_inference = Date.now();

    // 7. Aggregate into BatchResponse
    const batch = aggregateBatch(results);

    ts.after_aggregation = Date.now();

    // 8. Compute and attach swarm metrics
    batch.metrics = computeSwarmMetrics(batchId, ts, results);

    return batch;
}
