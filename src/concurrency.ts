import PQueue from 'p-queue';
import pThrottle from 'p-throttle';

export interface KeyedTask<T> {
    key: string;
    task: () => Promise<T>;
}

export type TaskRunResult<T> =
    | { ok: true; value: T }
    | { ok: false; error: Error };

// Global concurrency cap: Absolute maximum number of active external requests across the entire Node process.
// This prevents total network socket exhaustion and OS file handle limits during massive swarm spikes.
const GLOBAL_CONCURRENCY_CAP = 50;
const globalQueue = new PQueue({ concurrency: GLOBAL_CONCURRENCY_CAP });

// Dedicated per-provider concurrent tracking
const providerQueues = new Map<string, PQueue>();

// Strict API QPS Throttlers for rigid platforms (e.g., Anthropic which rapidly hard-rate-limits on burst)
const strictThrottlers = new Map<string, ReturnType<typeof pThrottle>>();

// Example: Anthropic at 5 QPS to prevent brutal 429s (Cloudflare/Anthropic edge protections)
strictThrottlers.set('anthropic', pThrottle({
    limit: 5,
    interval: 1000
}));

/**
 * Global telemetry hook for process visibility.
 */
export function getGlobalQueueDepth() {
    return {
        active: globalQueue.pending,
        queued: globalQueue.size
    };
}

/**
 * Executes a list of asynchronous tasks concurrently, isolated by key.
 * Now globally governed to prevent total network socket exhaustion, 
 * and actively QPS-throttled for rigid destination APIs.
 * 
 * @param tasks - Array of KeyedTasks containing a key and a Promise-returning function
 * @param concurrencyLimitPerKey - Maximum number of tasks to run in parallel per key
 * @returns Array of results or Error objects in the original order
 */
export async function runConcurrent<T>(
    tasks: KeyedTask<T>[],
    concurrencyLimitPerKey: number = 5
): Promise<TaskRunResult<T>[]> {
    const wrappedTasks = tasks.map(({ key, task }) => {
        if (!providerQueues.has(key)) {
            providerQueues.set(key, new PQueue({ concurrency: concurrencyLimitPerKey }));
        }
        const queue = providerQueues.get(key)!;

        // Bypassing network rules if processing local disk IO (e.g. parallel context resolution)
        const isApiNode = key !== 'io_context';

        return queue.add(async () => {
            const executeRaw = async () => {
                try {
                    const value = await task();
                    return { ok: true, value } as const;
                } catch (error) {
                    return {
                        ok: false,
                        error: error instanceof Error ? error : new Error(String(error))
                    } as const;
                }
            };

            if (isApiNode) {
                // Intercept with Explicit Provider Throttler if configured
                const specificThrottler = strictThrottlers.get(key);
                const boundedExecution = specificThrottler ? specificThrottler(executeRaw) : executeRaw;

                // Push explicitly through the Global Pool
                return globalQueue.add(() => boundedExecution());
            } else {
                // Direct local queue bypass
                return executeRaw();
            }
        });
    });

    return Promise.all(wrappedTasks);
}
