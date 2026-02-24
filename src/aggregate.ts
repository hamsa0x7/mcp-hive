import { AgentResult, BatchResponse } from './types.js';

/**
 * Aggregates an array of typed AgentResult objects into a BatchResponse.
 *
 * Counts success/exhausted/fatal states and populates failed_roles.
 * No inference  every result has an explicit status.
 */
export function aggregateBatch(results: AgentResult[]): BatchResponse {
    const total = results.length;
    let successful = 0;
    let exhausted = 0;
    let fatal = 0;
    const failedRoles: string[] = [];
    const diagnosticsMap = new Map<string, Set<string>>();

    for (const r of results) {
        switch (r.status) {
            case 'success':
                successful++;
                break;
            case 'exhausted':
                exhausted++;
                failedRoles.push(r.role);
                break;
            case 'fatal_error':
                fatal++;
                failedRoles.push(r.role);
                break;
        }

        // Extract diagnostics from attempted logs
        if (r.attempted && Array.isArray(r.attempted)) {
            for (const attempt of r.attempted) {
                if (attempt.last_error && attempt.last_error !== 'unknown_fatal') {
                    if (!diagnosticsMap.has(attempt.provider)) {
                        diagnosticsMap.set(attempt.provider, new Set<string>());
                    }
                    diagnosticsMap.get(attempt.provider)!.add(attempt.last_error);
                }
            }
        }
    }

    const diagnostics: Record<string, string[]> = {};
    for (const [provider, errors] of diagnosticsMap.entries()) {
        if (errors.size > 0) {
            diagnostics[provider] = Array.from(errors);
        }
    }

    const response: BatchResponse = {
        total_agents: total,
        successful,
        exhausted,
        fatal,
        results,
        failed_roles: failedRoles
    };

    if (Object.keys(diagnostics).length > 0) {
        response.diagnostics = diagnostics;
    }

    return response;
}
