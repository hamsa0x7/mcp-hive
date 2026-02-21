import { AgentResult, BatchResponse } from './types.js';

/**
 * Aggregates an array of typed AgentResult objects into a BatchResponse.
 *
 * Counts success/exhausted/fatal states and populates failed_roles.
 * No inference — every result has an explicit status.
 */
export function aggregateBatch(results: AgentResult[]): BatchResponse {
    const total = results.length;
    let successful = 0;
    let exhausted = 0;
    let fatal = 0;
    const failedRoles: string[] = [];

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
    }

    return {
        total_agents: total,
        successful,
        exhausted,
        fatal,
        results,
        failed_roles: failedRoles
    };
}
