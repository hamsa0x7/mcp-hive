import { getProviderConfig, ProviderName, buildHealthCheckRequest } from './providers.js';

export type HealthStatus = 'HEALTHY' | 'DEGRADED' | 'DEAD';

export interface HealthScore {
    isUp: boolean;
    latency: number;
    lastChecked: number;
    failures: number;
    status: HealthStatus;
}

const HEALTH_CACHE_TTL_MS = 60000; // Cache health checks for 60 seconds
const DEGRADED_FAILURE_THRESHOLD = 2; // Failures before transitioning to DEAD

// Export for testing mock resets
export const healthCache = new Map<ProviderName, HealthScore>();

export function resetHealthCache() {
    healthCache.clear();
}

/**
 * Global telemetry hook for process visibility.
 */
export function getHealthMetrics() {
    const metrics: Record<ProviderName, { status: HealthStatus, latency: number }> = {};
    for (const [p, score] of healthCache.entries()) {
        metrics[p] = {
            status: score.status,
            latency: score.latency
        };
    }
    return metrics;
}

/**
 * Proactive Health Guard for the Hive fleet.
 * Performs real network pings to ensure Worker Bees are reachable.
 * Implements a stateful TTL cache and transient jitter tolerance (`DEGRADED` state).
 */
export async function verifyHiveHealth(providers: ProviderName[]): Promise<Map<ProviderName, boolean>> {
    const healthMap = new Map<ProviderName, boolean>();
    const now = Date.now();

    const checks = providers.map(async (p) => {
        let cached = healthCache.get(p);

        // If cache is fresh, trust it avoiding redundant TLS handshakes
        if (cached && (now - cached.lastChecked < HEALTH_CACHE_TTL_MS)) {
            healthMap.set(p, cached.status !== 'DEAD');
            return;
        }

        if (!cached) {
            cached = { isUp: true, latency: 0, lastChecked: 0, failures: 0, status: 'HEALTHY' };
        }

        let pingSuccess = false;
        let pingLatency = 0;
        const pingStart = Date.now();

        try {
            const config = getProviderConfig(p);
            const request = buildHealthCheckRequest(config);

            const response = await fetch(request.url, {
                method: request.method,
                headers: request.headers,
                signal: AbortSignal.timeout(1500) // Generous 1.5s boundary to avoid transient false-positives
            });

            pingSuccess = response.ok;
            pingLatency = Date.now() - pingStart;
        } catch (e) {
            pingSuccess = false;
        }

        cached.lastChecked = Date.now();

        if (pingSuccess) {
            cached.failures = 0;
            cached.isUp = true;
            cached.latency = pingLatency;
            // High latency pushes to DEGRADED but keeps it active for routing
            cached.status = pingLatency > 1000 ? 'DEGRADED' : 'HEALTHY';
        } else {
            cached.failures += 1;
            cached.isUp = false;
            // Transitional degradation before marking hard DEAD
            cached.status = cached.failures >= DEGRADED_FAILURE_THRESHOLD ? 'DEAD' : 'DEGRADED';
        }

        healthCache.set(p, cached);
        // Only explicitly exclude from swarm routing if completely DEAD
        healthMap.set(p, cached.status !== 'DEAD');
    });

    await Promise.all(checks);
    return healthMap;
}
