import PQueue from 'p-queue';

/**
 * Executes a list of asynchronous tasks concurrently with a limit.
 * 
 * @param tasks - Array of functions that return a Promise
 * @param concurrencyLimit - Maximum number of tasks to run in parallel
 * @returns Array of results or Error objects in the original order
 */
export async function runConcurrent<T>(
    tasks: (() => Promise<T>)[],
    concurrencyLimit: number = 5
): Promise<(T | Error)[]> {
    const queue = new PQueue({ concurrency: concurrencyLimit });

    const wrappedTasks = tasks.map(task => {
        return queue.add(async () => {
            try {
                return await task();
            } catch (error) {
                return error instanceof Error ? error : new Error(String(error));
            }
        });
    });

    // queue.add returns a promise that resolves when the task is done.
    // We await all of them to get the final results array.
    return Promise.all(wrappedTasks) as Promise<(T | Error)[]>;
}
