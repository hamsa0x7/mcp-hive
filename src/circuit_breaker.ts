export type BreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface BreakerRecord {
    state: BreakerState;
    failures: number;
    firstFailureTime: number;
    nextAttemptTime: number;
    probeInFlight: boolean;
}

const FAILURE_THRESHOLD = 5; // Open after 5 failures in the window
const FAILURE_WINDOW_MS = 60000; // 60 seconds
const COOLDOWN_MS = 30000; // 30 seconds

const breakers = new Map<string, BreakerRecord>();

export function isCircuitOpen(provider: string, model: string): boolean {
    const key = `${provider}:${model}`;
    let record = breakers.get(key);

    if (!record) {
        // Initialize if first time checked
        record = { state: 'CLOSED', failures: 0, firstFailureTime: 0, nextAttemptTime: 0, probeInFlight: false };
        breakers.set(key, record);
        return false;
    }

    const now = Date.now();

    if (record.state === 'OPEN') {
        if (now >= record.nextAttemptTime) {
            // Cooldown finished, transition to HALF_OPEN to allow exactly 1 probe
            record.state = 'HALF_OPEN';
            record.probeInFlight = true;
            // Set a fallback next attempt time in case the probe hangs indefinitely
            record.nextAttemptTime = now + COOLDOWN_MS;
            console.log(`[Circuit Breaker] HALF_OPEN for ${key}. Allowing 1 probe.`);
            return false;
        }
        return true;
    }

    if (record.state === 'HALF_OPEN') {
        if (record.probeInFlight) {
            // Already probing, fast-fail subsequent requests
            return true;
        }
        // If probeInFlight is false but we are HALF_OPEN, allow a new probe
        record.probeInFlight = true;
        record.nextAttemptTime = now + COOLDOWN_MS;
        return false;
    }

    return false; // CLOSED state
}

export function recordSuccess(provider: string, model: string) {
    const key = `${provider}:${model}`;
    const record = breakers.get(key);
    if (record && (record.state === 'HALF_OPEN' || record.failures > 0)) {
        console.log(`[Circuit Breaker] CLOSED for ${key}. Recovered successfully.`);
        record.state = 'CLOSED';
        record.failures = 0;
        record.firstFailureTime = 0;
        record.nextAttemptTime = 0;
        record.probeInFlight = false;
    }
}

export function recordFailure(provider: string, model: string) {
    const key = `${provider}:${model}`;
    let record = breakers.get(key);
    const now = Date.now();

    if (!record) {
        record = { state: 'CLOSED', failures: 0, firstFailureTime: now, nextAttemptTime: 0, probeInFlight: false };
        breakers.set(key, record);
    }

    // Reset the sliding window if it's been a long time since the first failure
    if (record.state === 'CLOSED' && now - record.firstFailureTime > FAILURE_WINDOW_MS) {
        record.failures = 0;
        record.firstFailureTime = now;
    }

    record.failures += 1;

    // Open if threshold reached or if a probe failed during HALF_OPEN
    if (record.state === 'HALF_OPEN' || record.failures >= FAILURE_THRESHOLD) {
        record.state = 'OPEN';
        record.nextAttemptTime = now + COOLDOWN_MS;
        record.probeInFlight = false;
        console.error(`[Circuit Breaker] OPENED for ${key}. Fast-failing for ${COOLDOWN_MS}ms.`);
    } else {
        record.probeInFlight = false; // Just a normal failure in CLOSED state
    }
}

export function getBreakerMetrics(): Record<string, { state: string, failures: number }> {
    const metrics: Record<string, { state: string, failures: number }> = {};
    for (const [key, record] of breakers.entries()) {
        metrics[key] = {
            state: record.state,
            failures: record.failures
        };
    }
    return metrics;
}
export function resetBreakers() { breakers.clear(); }
