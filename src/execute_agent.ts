import { callModel } from './proxy.js';
import { resolveCandidates } from './resolver.js';
import { isRetryableError, classifyError } from './errors.js';
import {
    AgentResult,
    AttemptLog,
    AGENT_HARD_TIMEOUT_MS,
    MAX_RETRIES_PER_CANDIDATE
} from './types.js';

/**
 * Production execution engine for a single agent role.
 *
 * Implements the 3-tier retry strategy:
 *   Tier 1: Local retry (same model + same provider, up to MAX_RETRIES_PER_CANDIDATE)
 *   Tier 2: Provider escalation (same model, next provider in candidate list)
 *   Tier 3: Model escalation (next model that satisfies role strength)
 *
 * Enforces AGENT_HARD_TIMEOUT_MS as an absolute time boundary.
 * Returns a typed AgentResult — never throws.
 */
export async function executeAgent(
    role: string,
    batchId: string,
    systemPrompt: string,
    userPrompt: string
): Promise<AgentResult> {
    const startTime = Date.now();
    const attempted: AttemptLog[] = [];

    // Resolve full candidate ladder for this role
    let candidates;
    try {
        candidates = resolveCandidates(role);
    } catch (err: any) {
        return {
            role,
            status: 'fatal_error',
            provider: 'none',
            model: 'none',
            error_type: 'no_candidates',
            message: err.message ?? 'Failed to resolve candidates',
            retryable: false
        };
    }

    // Escalation loop through all candidates
    for (const candidate of candidates) {
        const { logicalModelName, modelString, provider } = candidate;
        let providerAttempts = 0;
        let lastError: any = null;

        // Tier 1: Local retry loop for this candidate
        while (providerAttempts < MAX_RETRIES_PER_CANDIDATE) {
            // Hard timeout check
            if (Date.now() - startTime > AGENT_HARD_TIMEOUT_MS) {
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
                    latency_ms: Date.now() - startTime
                };
            }

            providerAttempts++;

            try {
                const result = await callModel(
                    batchId,
                    systemPrompt,
                    userPrompt,
                    provider,
                    modelString
                );

                // SUCCESS — extract findings
                const findings = Array.isArray(result) ? result : [];
                const confidence = findings.length > 0 ? 0.8 : 0.5;

                return {
                    role,
                    status: 'success',
                    provider,
                    model: logicalModelName,
                    attempts: providerAttempts,
                    latency_ms: Date.now() - startTime,
                    findings,
                    overall_confidence: confidence
                };
            } catch (err: any) {
                lastError = err;

                // Fatal error — stop immediately
                if (!isRetryableError(err)) {
                    return {
                        role,
                        status: 'fatal_error',
                        provider,
                        model: logicalModelName,
                        error_type: classifyError(err),
                        message: err.message ?? 'Unknown error',
                        retryable: false
                    };
                }

                // Retryable — log and continue loop
                console.log(`⚠️ Transient error from ${provider}/${modelString} (attempt ${providerAttempts}/${MAX_RETRIES_PER_CANDIDATE}): ${err.message}`);
            }
        }

        // Tier 2/3: This candidate exhausted — log and escalate to next
        attempted.push({
            model: logicalModelName,
            provider,
            attempts: providerAttempts,
            last_error: lastError?.code || lastError?.status?.toString() || lastError?.message || 'unknown'
        });

        console.log(`❌ Exhausted ${provider}/${modelString}. Escalating to next candidate (${candidates.length - attempted.length} remaining).`);
    }

    // All candidates exhausted
    return {
        role,
        status: 'exhausted',
        attempted,
        retryable: true,
        latency_ms: Date.now() - startTime
    };
}
