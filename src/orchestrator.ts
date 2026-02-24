import { BatchResponse, AgentResult } from './types.js';
import { createTimestamps, computeSwarmMetrics } from './telemetry.js';
import { validateAndConfigure } from './config.js';
import { expandSwarm } from './routing.js';
import { checkBatchBudget } from './budget.js';
import { resolveContext } from './context.js';
import { executeAgent } from './execute_agent.js';
import { runConcurrent } from './concurrency.js';
import { aggregateBatch } from './aggregate.js';
import { SwarmStore } from './store.js';
import { verifyHiveHealth } from './health.js';
import { fractureFile } from './chunker.js';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from './db.js';
import { validateTaskPath } from './security.js';

const MAX_AGENTS_PER_BATCH = 15;
const DEFAULT_BATCH_TOKEN_LIMIT = parseInt(process.env.MAX_BATCH_TOKENS || '100000', 10);

// Swarm-level concurrency: Maximum number of active API calls per provider for this specific swarm batch.
// This is bounded by the GLOBAL_CONCURRENCY_CAP in concurrency.ts (50).
const SWARM_DISPATCH_CONCURRENCY = 5;

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
    batchId: string = Date.now().toString(),
    customPrompt?: string,
    requestedStrength?: string,
    workspaceRoot?: string
): Promise<BatchResponse> {
    const ts = createTimestamps();

    // Enforce redundancy and load config (Local validation first)
    const availableProviders = validateAndConfigure();

    // 1. Enforce batch scale cap
    if (diffChunks.length > MAX_AGENTS_PER_BATCH) {
        throw new Error(`Batch size ${diffChunks.length} exceeds maximum limit of ${MAX_AGENTS_PER_BATCH}`);
    }

    // 2. Gate 0: Health Check (Proactive)
    const healthMap = await verifyHiveHealth(availableProviders as any);
    const activeProviders = Array.from(healthMap.entries())
        .filter(([_, isUp]) => isUp)
        .map(([p]) => p);

    if (activeProviders.length === 0) {
        throw new Error('No healthy providers available to service the batch.');
    }

    // 3. Expand roles into tasks (decomposition) & Security Sandboxing
    const taskInput = [];
    const directFatalResults: AgentResult[] = [];

    for (const chunk of diffChunks) {
        const secCheck = validateTaskPath(chunk.path, workspaceRoot);
        if (!secCheck.valid) {
            directFatalResults.push({
                role,
                status: 'fatal_error',
                provider: 'none',
                model: 'none',
                error_type: 'security_violation',
                message: secCheck.reason || 'Invalid path',
                retryable: false,
                attempts: 1,
                latency_ms: 0,
                overall_confidence: 1.0,
                findings: [{
                    type: 'orchestrator_intervention',
                    description: `Security Sandbox blocked file access: ${secCheck.reason}`,
                    severity: 'critical',
                    location: chunk.path
                }],
                attempted: []
            } as AgentResult);
        } else {
            taskInput.push({
                path: secCheck.normalizedPath!,
                role,
                customPrompt,
                requestedStrength
            });
        }
    }

    const tasks = expandSwarm(taskInput, activeProviders as string[]);

    // 4. Check batch token budget (dynamically scaled by provider count)
    const budgetCheck = checkBatchBudget(tasks, activeProviders.length, DEFAULT_BATCH_TOKEN_LIMIT);
    if (!budgetCheck.allowed) {
        throw new Error(budgetCheck.reason || 'Token budget exceeded');
    }

    ts.after_decomposition = Date.now();

    // 4. Resolve context for all tasks concurrently (context boost phase)
    const contextMap = new Map<string, string>();
    const contextIoTasks = tasks.map(task => ({
        key: 'io_context',
        task: async () => {
            const ctx = await resolveContext(task.filePath);
            return { filePath: task.filePath, ctx };
        }
    }));

    const ctxResults = await runConcurrent(contextIoTasks, 8); // Max 8 concurrent disk reads
    for (const res of ctxResults) {
        if (res.ok && res.value.ctx) {
            contextMap.set(res.value.filePath, res.value.ctx);
        } else if (!res.ok) {
            console.warn(`[Orchestrator] IO Context fail for one node: ${res.error.message}`);
        }
    }

    ts.after_context_boost = Date.now();

    // 5. Build concurrent task wrappers (dispatch phase)
    const concurrentTasks = tasks.map(task => {
        return {
            key: task.assignedProvider || 'default',
            task: async (): Promise<AgentResult> => {
                const context = contextMap.get(task.filePath);
                const userPrompt = context
                    ? `${context}\n\nAnalyze file: ${task.filePath}`
                    : `Analyze file: ${task.filePath}`;

                return executeAgent(
                    task.role,
                    batchId,
                    task.prompt,
                    userPrompt,
                    task.assignedProvider,
                    task.assignedModel,
                    task.requiredStrength
                );
            }
        };
    });

    ts.after_dispatch = Date.now();

    // 6. Run concurrent execution (limit: 5)  inference phase
    const concurrentResults = await runConcurrent(concurrentTasks, SWARM_DISPATCH_CONCURRENCY);
    const results: AgentResult[] = concurrentResults.map((result, idx) => {
        if (result.ok) {
            return result.value;
        }

        const failedTask = tasks[idx];
        return {
            role: failedTask.role,
            status: 'fatal_error',
            provider: failedTask.assignedProvider || 'none',
            model: failedTask.assignedModel || 'none',
            error_type: 'runtime_task_error',
            message: result.error.message || 'Unhandled execution failure',
            retryable: false,
            findings: [{
                type: 'orchestrator_intervention',
                description: `Worker bee crashed at runtime: ${result.error.message}`,
                severity: 'critical',
                location: failedTask.filePath
            }]
        };
    });

    ts.after_inference = Date.now();

    // 7. Aggregate into BatchResponse
    const finalResults = [...results, ...directFatalResults];
    const batch = aggregateBatch(finalResults);

    ts.after_aggregation = Date.now();

    // 8. Compute and attach swarm metrics
    batch.metrics = await computeSwarmMetrics(batchId, ts, results);

    return batch;
}

/**
 * Orchestrates a swarm where each file can have a different assigned role.
 * Becomes asynchronous: Returns instant spillover while Bees run in background.
 */
export async function orchestrateSwarm(
    swarmTasks: { path: string, role?: string, customPrompt?: string, requestedStrength?: string }[],
    batchId: string = Date.now().toString(),
    options?: { workspaceRoot?: string }
): Promise<BatchResponse> {
    const ts = createTimestamps();
    const availableProviders = validateAndConfigure();

    // 1. Gate 0: Health Check
    const healthMap = await verifyHiveHealth(availableProviders as any);
    const activeProviders = Array.from(healthMap.entries())
        .filter(([_, isUp]) => isUp)
        .map(([p]) => p);

    if (activeProviders.length === 0) {
        throw new Error('No healthy providers available to service the swarm.');
    }

    // 2. Gate 1: Security Sandbox & Fracture (Saturate the Hive)
    const microTasks: any[] = [];
    const directFatalResults: any[] = [];

    for (const st of swarmTasks) {
        const secCheck = validateTaskPath(st.path, options?.workspaceRoot);
        if (!secCheck.valid) {
            directFatalResults.push({
                role: st.role || 'custom',
                status: 'fatal_error',
                provider: 'none',
                model: 'none',
                error_type: 'security_violation',
                message: secCheck.reason || 'Invalid path',
                retryable: false,
                findings: [{
                    type: 'orchestrator_intervention',
                    description: `Security Sandbox blocked file access: ${secCheck.reason}`,
                    severity: 'critical',
                    location: st.path
                }]
            });
            continue;
        }

        const normalizedPath = secCheck.normalizedPath!;
        if (fs.existsSync(normalizedPath)) {
            const content = fs.readFileSync(normalizedPath, 'utf8');
            const chunks = fractureFile(normalizedPath, content);
            chunks.forEach((c, i) => {
                microTasks.push({
                    path: normalizedPath,
                    role: st.role || 'custom',
                    customPrompt: st.customPrompt,
                    requestedStrength: st.requestedStrength,
                    chunk: c,
                    index: i
                });
            });
        }
    }

    // 3. Hive Assignment (Slots 1-15: Workers, 16+: Overload)
    const beeTasks = microTasks.slice(0, MAX_AGENTS_PER_BATCH);
    const overloadTasks = microTasks.slice(MAX_AGENTS_PER_BATCH);

    // 4. Initial Persistence
    SwarmStore.create(batchId, beeTasks.length, overloadTasks);

    // 5. Parallel Background Launch (Non-blocking)
    const expandedBees = expandSwarm(beeTasks.map(b => ({
        path: b.path,
        role: b.role,
        customPrompt: b.customPrompt,
        requestedStrength: b.requestedStrength
    })), activeProviders as string[]);

    // 6. Collaborative Task Initialization (The Board)
    const db = getDb();
    if (db) {
        const now = Date.now();
        const stmt = db.prepare(`
            INSERT INTO hive_board (id, swarm_id, task_type, context_json, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, 'pending', ?, ?)
        `);

        beeTasks.forEach((bt, i) => {
            const taskId = uuidv4();
            bt.internal_task_id = taskId; // Track for the loop
            stmt.run(
                taskId,
                batchId,
                bt.role,
                JSON.stringify({ path: bt.path, chunk: bt.chunk }),
                now,
                now
            );
        });
    }

    // Start background cooperative loop
    (async () => {
        for (let i = 0; i < expandedBees.length; i++) {
            const task = expandedBees[i];
            const bt = beeTasks[i];
            const taskId = bt.internal_task_id;

            try {
                // Mark as claimed
                if (db && taskId) {
                    db.prepare("UPDATE hive_board SET status = 'claimed', assignee = ?, updated_at = ? WHERE id = ?")
                        .run(`${task.assignedProvider}/${task.assignedModel}`, Date.now(), taskId);
                }

                executeAgent(
                    task.role,
                    batchId,
                    task.prompt,
                    `Analyzing chunk of ${task.filePath}. [SWARM_ID: ${batchId}, TASK_ID: ${taskId}]
                    
                    YOU ARE PART OF A COOPERATIVE SWARM.
                    - Use 'hive_post_insight' to share discoveries (e.g., duplicated patterns) so other bees can see them.
                    - Use 'hive_spawn_subtask' if you find a problem that requires a different specialist role.`,
                    task.assignedProvider,
                    task.assignedModel,
                    task.requiredStrength
                ).then(res => {
                    // Update board status
                    try {
                        if (db && taskId) {
                            db.prepare("UPDATE hive_board SET status = 'completed', result_json = ?, updated_at = ? WHERE id = ?")
                                .run(JSON.stringify(res.findings), Date.now(), taskId);
                        }
                    } catch (_dbErr) { /* Best-effort */ }

                    SwarmStore.updateTask(batchId, {
                        role: task.role,
                        filePath: task.filePath,
                        status: res.status,
                        findings: res.findings
                    });
                }).catch(err => {
                    try {
                        if (db && taskId) {
                            db.prepare("UPDATE hive_board SET status = 'failed', updated_at = ? WHERE id = ?")
                                .run(Date.now(), taskId);
                        }
                    } catch (_dbErr) { /* Board update is best-effort */ }

                    SwarmStore.updateTask(batchId, {
                        role: task.role,
                        filePath: task.filePath,
                        status: 'fatal_error',
                        findings: [{
                            type: 'orchestrator_intervention',
                            description: `Background worker failed: ${err.message}`,
                            severity: 'critical',
                            location: null
                        }]
                    });
                });
            } catch (syncErr: any) {
                SwarmStore.updateTask(batchId, {
                    role: task.role,
                    filePath: task.filePath,
                    status: 'fatal_error',
                    findings: [{
                        type: 'orchestrator_intervention',
                        description: `Background worker setup failed: ${syncErr.message}`,
                        severity: 'critical',
                        location: null
                    }]
                });
            }
        }
    })().catch(err => {
        console.error(`Critical: background swarm loop crashed for batch ${batchId}:`, err.message);
    });

    // 6. Instant Spillover Return (Fast Path)
    // Package overload tasks as intervention findings immediately
    const delegatedResults = overloadTasks.map(qt => ({
        role: qt.role,
        status: 'fatal_error' as const,
        provider: 'none',
        model: 'none',
        error_type: 'orchestrator_intervention',
        message: `Capacity exhausted. Primary Orchestrator intervention required for chunk ${qt.index + 1} of ${qt.path}.`,
        retryable: false as const,
        findings: [{
            type: 'orchestrator_intervention',
            description: `Agent limit hit. Orchestrator must process ${qt.path} lines ${qt.chunk.startLine}-${qt.chunk.endLine}.`,
            severity: 'medium',
            location: `${qt.path}:${qt.chunk.startLine}`
        }]
    }));

    const finalImmediateResults = [...delegatedResults, ...directFatalResults];

    return {
        swarm_id: batchId,
        total_agents: microTasks.length + directFatalResults.length,
        successful: 0,
        exhausted: 0,
        fatal: finalImmediateResults.length,
        results: finalImmediateResults,
        failed_roles: finalImmediateResults.map(r => r.role)
    };
}

/**
 * Collects results from a background swarm.
 */
export async function harvestSwarm(swarmId: string): Promise<BatchResponse | { status: 'processing' }> {
    const swarm = SwarmStore.get(swarmId);
    if (!swarm) throw new Error(`Swarm ${swarmId} not found.`);

    if (swarm.status === 'processing') {
        return { status: 'processing' };
    }

    // Convert SwarmResults to AgentResults for aggregation
    const agentResults = swarm.results.map(r => ({
        role: r.role,
        status: r.status,
        provider: 'bg_worker',
        model: 'bg_model',
        findings: r.findings,
        attempts: 1,
        total_tokens: 0,
        duration_ms: 0,
        latency_ms: 0,
        overall_confidence: 1.0
    })) as any[];

    const batch = aggregateBatch(agentResults);
    batch.swarm_id = swarmId;
    return batch;
}
