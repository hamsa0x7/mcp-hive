import { describe, it, expect, vi } from 'vitest';
import { runConcurrent } from '../src/concurrency.js';

describe('Concurrency Engine (runConcurrent)', () => {
    it('should execute tasks and return results in the correct order', async () => {
        const tasks = [
            async () => { await new Promise(r => setTimeout(r, 50)); return 1; },
            async () => { await new Promise(r => setTimeout(r, 10)); return 2; },
            async () => { await new Promise(r => setTimeout(r, 30)); return 3; }
        ];

        const results = await runConcurrent(tasks, 2);
        expect(results).toEqual([1, 2, 3]);
    });

    it('should limit parallel execution based on concurrency limit', async () => {
        let activeCount = 0;
        let maxActiveCount = 0;

        const task = async () => {
            activeCount++;
            maxActiveCount = Math.max(maxActiveCount, activeCount);
            await new Promise(r => setTimeout(r, 20));
            activeCount--;
            return true;
        };

        const tasks = Array(5).fill(null).map(() => task);

        await runConcurrent(tasks, 2);

        expect(maxActiveCount).toBe(2);
    });

    it('should handle failures gracefully without stopping the queue', async () => {
        const tasks = [
            async () => 1,
            async () => { throw new Error('Task Failed'); },
            async () => 3
        ];

        const results = await runConcurrent(tasks, 2);

        expect(results[0]).toBe(1);
        expect(results[1]).toBeInstanceOf(Error);
        expect(results[1].message).toBe('Task Failed');
        expect(results[2]).toBe(3);
    });
});
