import { AgentResult } from './types.js';
import { buildAccelerationReport, AccelerationReport } from './report.js';

//  Swarm-Level Metrics 

export interface SwarmMetrics {
    swarm_id: string;
    total_wall_time_ms: number;
    decomposition_ms: number;
    context_boost_ms: number;
    dispatch_overhead_ms: number;
    inference_wall_time_ms: number;
    aggregation_ms: number;
    max_agent_latency_ms: number;
    parallel_efficiency: number;
    total_retries: number;
    provider_switches: number;
    model_escalations: number;
    sequential_estimate_ms: number;
    speedup_factor: number;
    time_saved_ms: number;
    acceleration_report: AccelerationReport;
    // Phase 6: Collaborative Reasoning metrics
    insights_posted: number;
    subtasks_spawned: number;
    deduplication_hits: number;
    // Phase 9: Circuit Breaker, Queue & Health metrics
    circuit_breakers: Record<string, { state: string, failures: number }>;
    global_queue: { active: number, queued: number };
    health_metrics: Record<string, { status: string, latency: number }>;
}

//  Timing Capture 

export interface SwarmTimestamps {
    swarm_start: number;
    after_decomposition: number;
    after_context_boost: number;
    after_dispatch: number;
    after_inference: number;
    after_aggregation: number;
}

/**
 * Creates a fresh timestamps object anchored at swarm start.
 */
export function createTimestamps(): SwarmTimestamps {
    const now = Date.now();
    return {
        swarm_start: now,
        after_decomposition: now,
        after_context_boost: now,
        after_dispatch: now,
        after_inference: now,
        after_aggregation: now
    };
}

/**
 * Extracts per-agent latency from any AgentResult status.
 */
function getAgentLatencies(results: AgentResult[]): number[] {
    return results.map(r => {
        if (r.status === 'success') return r.latency_ms;
        if (r.status === 'exhausted') return r.latency_ms;
        return 0;
    });
}

/**
 * Computes swarm metrics from timestamps and agent results.
 * Returns structured data  Antigravity owns all rendering.
 */
export async function computeSwarmMetrics(
    swarmId: string,
    ts: SwarmTimestamps,
    results: AgentResult[]
): Promise<SwarmMetrics> {
    const totalWall = ts.after_aggregation - ts.swarm_start;

    const agentLatencies = getAgentLatencies(results);

    const maxAgentLatency = agentLatencies.length > 0
        ? Math.max(...agentLatencies)
        : 0;

    const sequentialEstimate = agentLatencies.reduce((a, b) => a + b, 0);

    const parallelEfficiency = totalWall > 0 && maxAgentLatency > 0
        ? parseFloat((maxAgentLatency / totalWall).toFixed(3))
        : 0;

    const speedup = totalWall > 0 && sequentialEstimate > 0
        ? parseFloat((sequentialEstimate / totalWall).toFixed(2))
        : 1;

    const timeSaved = sequentialEstimate - totalWall;

    // Count retries and escalations
    let totalRetries = 0;
    let providerSwitches = 0;
    let modelEscalations = 0;

    for (const r of results) {
        if (r.status === 'success') {
            totalRetries += r.attempts - 1;
        }
        if (r.status === 'exhausted') {
            for (const a of r.attempted) {
                totalRetries += a.attempts - 1;
            }
            if (r.attempted.length > 1) {
                const uniqueModels = new Set(r.attempted.map(a => a.model));
                const uniqueProviders = new Set(r.attempted.map(a => a.provider));
                providerSwitches += uniqueProviders.size - 1;
                modelEscalations += uniqueModels.size - 1;
            }
        }
    }

    // Build structured report payload (no rendering  data only)
    const report = buildAccelerationReport({
        agents: results.length,
        sequential_ms: sequentialEstimate,
        parallel_ms: totalWall,
        speedup,
        time_saved_ms: timeSaved,
        parallel_efficiency: parallelEfficiency
    });

    // Query Phase 6 board for collaborative metrics
    let insightsPosted = 0;
    let subtasksSpawned = 0;
    let deduplicationHits = 0;
    try {
        const { getDb } = await import('./db.js');
        const db = getDb();
        if (db) {
            const insightRow = db.prepare('SELECT COUNT(*) as cnt FROM hive_insights WHERE swarm_id = ?').get(swarmId) as any;
            insightsPosted = insightRow?.cnt ?? 0;

            const subtaskRow = db.prepare("SELECT COUNT(*) as cnt FROM hive_board WHERE swarm_id = ? AND task_type != 'original'").get(swarmId) as any;
            subtasksSpawned = subtaskRow?.cnt ?? 0;

            const dedupRow = db.prepare("SELECT COUNT(*) as cnt FROM hive_insights WHERE swarm_id = ? AND insight_type = 'deduplication'").get(swarmId) as any;
            deduplicationHits = dedupRow?.cnt ?? 0;
        }
    } catch (_e) { /* DB not available, metrics default to 0 */ }

    // Query Phase 9 Circuit Breaker state
    let cbMetrics = {};
    try {
        const { getBreakerMetrics } = await import('./circuit_breaker.js');
        cbMetrics = getBreakerMetrics();
    } catch (_e) { /* Best-effort import */ }

    // Query Phase 9 Queue state
    let queueMetrics = { active: 0, queued: 0 };
    try {
        const { getGlobalQueueDepth } = await import('./concurrency.js');
        queueMetrics = getGlobalQueueDepth();
    } catch (_e) { /* Best-effort import */ }

    // Query Phase 9 Health state
    let healthMetrics = {};
    try {
        const { getHealthMetrics } = await import('./health.js');
        healthMetrics = getHealthMetrics();
    } catch (_e) { /* Best-effort import */ }

    return {
        swarm_id: swarmId,
        total_wall_time_ms: totalWall,
        decomposition_ms: ts.after_decomposition - ts.swarm_start,
        context_boost_ms: ts.after_context_boost - ts.after_decomposition,
        dispatch_overhead_ms: ts.after_dispatch - ts.after_context_boost,
        inference_wall_time_ms: ts.after_inference - ts.after_dispatch,
        aggregation_ms: ts.after_aggregation - ts.after_inference,
        max_agent_latency_ms: maxAgentLatency,
        parallel_efficiency: parallelEfficiency,
        total_retries: totalRetries,
        provider_switches: providerSwitches,
        model_escalations: modelEscalations,
        sequential_estimate_ms: sequentialEstimate,
        speedup_factor: speedup,
        time_saved_ms: timeSaved,
        acceleration_report: report,
        insights_posted: insightsPosted,
        subtasks_spawned: subtasksSpawned,
        deduplication_hits: deduplicationHits,
        circuit_breakers: cbMetrics,
        global_queue: queueMetrics,
        health_metrics: healthMetrics
    };
}

//  Comparison (With vs Without Hive) 

export interface BenchmarkComparison {
    agents: number;
    baseline_sequential_ms: number;
    hive_parallel_ms: number;
    speedup_factor: number;
    parallel_gain_ms: number;
    relative_gain: number;
}

/**
 * Computes the with-vs-without-Hive comparison metric.
 */
export function computeComparison(
    agentCount: number,
    sequentialMs: number,
    parallelMs: number
): BenchmarkComparison {
    const speedup = parallelMs > 0
        ? parseFloat((sequentialMs / parallelMs).toFixed(2))
        : 0;
    const gain = sequentialMs - parallelMs;
    const relativeGain = sequentialMs > 0
        ? parseFloat((gain / sequentialMs).toFixed(3))
        : 0;

    return {
        agents: agentCount,
        baseline_sequential_ms: sequentialMs,
        hive_parallel_ms: parallelMs,
        speedup_factor: speedup,
        parallel_gain_ms: gain,
        relative_gain: relativeGain
    };
}
