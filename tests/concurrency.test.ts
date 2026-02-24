import { describe, it, expect, vi } from 'vitest';
import { runConcurrent } from '../src/concurrency.js';

describe('Concurrency Engine (runConcurrent)', () => {
    it('should execute tasks and return results in the correct order', async () => {
        const tasks = [
            { key: 'A', task: async () => { await new Promise(r => setTimeout(r, 50)); return 1; } },
            { key: 'A', task: async () => { await new Promise(r => setTimeout(r, 10)); return 2; } },
            { key: 'A', task: async () => { await new Promise(r => setTimeout(r, 30)); return 3; } }
        ];

        const results = await runConcurrent(tasks, 2);
        expect(results).toEqual([
            { ok: true, value: 1 },
            { ok: true, value: 2 },
            { ok: true, value: 3 }
        ]);
    });

    it('should limit parallel execution based on concurrency limit per key', async () => {
        let activeCountA = 0;
        let maxActiveCountA = 0;

        const taskA = {
            key: 'A',
            task: async () => {
                activeCountA++;
                maxActiveCountA = Math.max(maxActiveCountA, activeCountA);
                await new Promise(r => setTimeout(r, 20));
                activeCountA--;
                return true;
            }
        };

        const tasks = Array(5).fill(null).map(() => taskA);

        await runConcurrent(tasks, 2);

        expect(maxActiveCountA).toBe(2);
    });

    it('should isolate queues by key and allow full capacity per key', async () => {
        let activeCountA = 0;
        let activeCountB = 0;
        let simultaneousMax = 0;

        const taskA = {
            key: 'A',
            task: async () => {
                activeCountA++;
                simultaneousMax = Math.max(simultaneousMax, activeCountA + activeCountB);
                await new Promise(r => setTimeout(r, 20));
                activeCountA--;
                return true;
            }
        };

        const taskB = {
            key: 'B',
            task: async () => {
                activeCountB++;
                simultaneousMax = Math.max(simultaneousMax, activeCountA + activeCountB);
                await new Promise(r => setTimeout(r, 20));
                activeCountB--;
                return true;
            }
        };

        const tasks = [
            ...Array(5).fill(null).map(() => taskA),
            ...Array(5).fill(null).map(() => taskB)
        ];

        await runConcurrent(tasks, 2);

        // Max concurrency should be 2 for A + 2 for B = 4
        expect(simultaneousMax).toBeGreaterThanOrEqual(3); // Should hit at least 3 or 4
    });

    it('should handle failures gracefully without stopping the queue', async () => {
        const tasks = [
            { key: 'A', task: async () => 1 },
            { key: 'A', task: async () => { throw new Error('Task Failed'); } },
            { key: 'A', task: async () => 3 }
        ];

        const results = await runConcurrent(tasks, 2);

        expect(results[0]).toEqual({ ok: true, value: 1 });
        expect(results[1].ok).toBe(false);
        if (!results[1].ok) {
            expect(results[1].error.message).toBe('Task Failed');
        }
        expect(results[2]).toEqual({ ok: true, value: 3 });
    });
});
