import { z } from 'zod';
import { ProviderName } from './providers.js';
import type { SwarmMetrics } from './telemetry.js';

//  Universal Subagent Data Contract 
export const FindingSchema = z.object({
    type: z.string(),
    description: z.string(),
    severity: z.string().nullable().optional(),
    location: z.string().nullable().optional()
});

export const FindingsArraySchema = z.array(FindingSchema);
export type Finding = z.infer<typeof FindingSchema>;

//  Execution Constants  

/** Max time (ms) for a single fetch call before AbortController fires. */
export const PER_ATTEMPT_TIMEOUT_MS = 15_000;

/** Max time (ms) for an entire agent (all candidates, all retries). */
export const AGENT_HARD_TIMEOUT_MS = 45_000;

/** Max retry attempts per individual model+provider candidate. */
export const MAX_RETRIES_PER_CANDIDATE = 2;

//  Attempt Log 

export interface AttemptLog {
    model: string;
    provider: string;
    attempts: number;
    last_error: string;
}

//  Agent Result (Discriminated Union) 

export interface SuccessResult {
    role: string;
    status: 'success';
    provider: string;
    model: string;
    attempts: number;
    latency_ms: number;
    findings: Finding[];
    overall_confidence: number;
    attempted?: AttemptLog[];
}

export interface ExhaustedResult {
    role: string;
    status: 'exhausted';
    attempted: AttemptLog[];
    retryable: true;
    latency_ms: number;
    findings: Finding[];
}

export interface FatalErrorResult {
    role: string;
    status: 'fatal_error';
    provider: string;
    model: string;
    error_type: string;
    message: string;
    retryable: false;
    attempted?: AttemptLog[];
    findings: Finding[];
}

export type AgentResult = SuccessResult | ExhaustedResult | FatalErrorResult;

//  Batch Response 

export interface BatchResponse {
    swarm_id?: string;
    total_agents: number;
    successful: number;
    exhausted: number;
    fatal: number;
    results: (SuccessResult | ExhaustedResult | FatalErrorResult)[];
    failed_roles: string[];
    metrics?: SwarmMetrics;
    diagnostics?: Record<string, string[]>;
}

export interface SwarmSyncResponse {
    swarm_id: string;
    total_bees: number;
    delegated_tasks: Finding[];
    status: 'processing';
}
