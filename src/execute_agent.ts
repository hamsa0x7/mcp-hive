import { callModel } from './proxy.js';
import { resolveCandidates, resolveRequiredStrength } from './resolver.js';
import { isRetryableError, classifyError } from './errors.js';
import {
    AgentResult,
    AttemptLog,
    AGENT_HARD_TIMEOUT_MS,
    MAX_RETRIES_PER_CANDIDATE
} from './types.js';
import { isCircuitOpen, recordSuccess, recordFailure } from './circuit_breaker.js';

/**
 * Production execution engine for a single agent role.
 *
 * Implements the 3-tier retry strategy:
 *   Tier 1: Local retry (same model + same provider, up to MAX_RETRIES_PER_CANDIDATE)
 *   Tier 2: Provider escalation (same model, next provider in candidate list)
 *   Tier 3: Model escalation (next model that satisfies role strength)
 *
 * Enforces AGENT_HARD_TIMEOUT_MS as an absolute time boundary.
 * Returns a typed AgentResult  never throws.
 */
export async function executeAgent(
    role: string,
    batchId: string,
    systemPrompt: string,
    userPrompt: string,
    assignedProvider?: string,
    assignedModel?: string,
    requiredStrength?: string
): Promise<AgentResult> {
    const startTime = Date.now();
    const attempted: AttemptLog[] = [];
    const effectiveStrength = resolveRequiredStrength(role, requiredStrength);

    // Resolve full candidate ladder for this role
    let candidates;
    try {
        candidates = resolveCandidates(effectiveStrength).candidates;
    } catch (err: any) {
        return {
            role,
            status: 'fatal_error',
            provider: 'none',
            model: 'none',
            error_type: 'no_candidates',
            message: err.message ?? `Failed to resolve candidates for strength: ${effectiveStrength}`,
            retryable: false,
            findings: [{
                type: "orchestrator_intervention",
                description: `No worker bees available for role: ${role} (strength: ${effectiveStrength}). Orchestrator intervention required.`,
                severity: "critical",
                location: null
            }]
        };
    }

    // If a specific provider was load-balanced to this task, prioritize it
    if (assignedProvider && assignedModel) {
        const assignedIndex = candidates.findIndex(
            (c: any) => c.provider === assignedProvider && c.modelString === assignedModel
        );

        if (assignedIndex > -1) {
            // Remove it from the standard position and push to the very front
            const [assignedCandidate] = candidates.splice(assignedIndex, 1);
            candidates.unshift(assignedCandidate);
        }
    }

    // Escalation loop through all candidates
    for (const candidate of candidates) {
        const { logicalModelName, modelString, provider, reasoning } = candidate;
        let providerAttempts = 0;
        let lastError: any = null;

        const currentAgentHardTimeout = reasoning ? 300_000 : AGENT_HARD_TIMEOUT_MS;

        // Tier 1: Local retry loop for this candidate
        while (providerAttempts < MAX_RETRIES_PER_CANDIDATE) {
            // Check circuit breaker first
            if (isCircuitOpen(provider, modelString)) {
                attempted.push({
                    model: logicalModelName,
                    provider,
                    attempts: providerAttempts,
                    last_error: 'circuit_breaker_open'
                });
                console.warn(`[Circuit Breaker] Skipping ${provider}/${modelString} because circuit is OPEN.`);
                break; // Break loop to escalate to next candidate immediately
            }

            // Hard timeout check
            if (Date.now() - startTime > currentAgentHardTimeout) {
                attempted.push({
                    model: logicalModelName,
                    provider,
                    attempts: providerAttempts,
                    last_error: 'agent_timeout'
                });
                return {
                    role,
                    status: 'exhausted',
                    attempted,
                    retryable: true,
                    latency_ms: Date.now() - startTime,
                    findings: [{
                        type: "orchestrator_intervention",
                        description: `Worker bee exhausted retries (Timeout). Orchestrator intervention required.`,
                        severity: "critical",
                        location: null
                    }]
                };
            }

            providerAttempts++;

            try {
                const result = await callModel(
                    batchId,
                    systemPrompt,
                    userPrompt,
                    provider,
                    modelString,
                    reasoning
                );

                // SUCCESS  extract findings
                const findings = Array.isArray(result) ? result : [];
                recordSuccess(provider, modelString);

                // Derive confidence from finding severity distribution
                const severityWeights: Record<string, number> = { critical: 0.3, high: 0.5, medium: 0.7, low: 0.9 };
                const confidence = findings.length > 0
                    ? parseFloat((findings.reduce((sum: number, f: any) => sum + (severityWeights[f.severity] ?? 0.8), 0) / findings.length).toFixed(2))
                    : 0.5;

                return {
                    role,
                    status: 'success',
                    provider,
                    model: logicalModelName,
                    attempts: providerAttempts,
                    latency_ms: Date.now() - startTime,
                    findings,
                    overall_confidence: confidence,
                    attempted
                };
            } catch (err: any) {
                lastError = err;

                // Fatal error  stop immediately
                if (!isRetryableError(err)) {
                    attempted.push({
                        model: logicalModelName,
                        provider,
                        attempts: providerAttempts,
                        last_error: err?.code || err?.status?.toString() || err?.message || 'unknown_fatal'
                    });

                    return {
                        role,
                        status: 'fatal_error',
                        provider,
                        model: logicalModelName,
                        error_type: classifyError(err),
                        message: err.message ?? 'Unknown error',
                        retryable: false,
                        attempted,
                        findings: [{
                            type: "orchestrator_intervention",
                            description: `Worker bee failed (${classifyError(err)}). Orchestrator intervention required.`,
                            severity: "critical",
                            location: null
                        }]
                    };
                }

                // Retryable  log and apply exponential backoff with FULL JITTER
                // Jitter prevents "thundering herd" API slamming in highly concurrent swarms
                recordFailure(provider, modelString);

                const baseBackoff = Math.min(1000 * Math.pow(2, providerAttempts - 1), 8000);
                const backoffMs = Math.floor(Math.random() * baseBackoff); // Full Jitter: [0, baseBackoff]
                console.error(` Transient error from ${provider}/${modelString} (attempt ${providerAttempts}/${MAX_RETRIES_PER_CANDIDATE}): ${err.message}. Backing off ${backoffMs}ms with Jitter.`);
                await new Promise(r => setTimeout(r, backoffMs));
            }
        }

        // Tier 2/3: This candidate exhausted  log and escalate to next
        attempted.push({
            model: logicalModelName,
            provider,
            attempts: providerAttempts,
            last_error: lastError?.code || lastError?.status?.toString() || lastError?.message || 'unknown'
        });

        console.error(` Exhausted ${provider}/${modelString}. Escalating to next candidate (${candidates.length - attempted.length} remaining).`);
    }

    // All candidates exhausted
    return {
        role,
        status: 'exhausted',
        attempted,
        retryable: true,
        latency_ms: Date.now() - startTime,
        findings: [{
            type: "orchestrator_intervention",
            description: `Worker bee exhausted all providers. Orchestrator intervention required.`,
            severity: "critical",
            location: null
        }]
    };
}
