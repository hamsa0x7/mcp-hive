import { describe, it, expect, vi } from 'vitest';
import { checkBatchBudget } from '../src/budget.js';
import fs from 'fs';

describe('Budget Estimator', () => {
    it('should allow a batch within the token budget', () => {
        // Mock a few tasks. In a real scenario, these would point to files.
        // We'll mock the internal file reading or just pass mock tasks that look like they have content.
        const tasks = [
            { filePath: 'file1.ts', role: 'test', prompt: 'test' },
            { filePath: 'file2.ts', role: 'test', prompt: 'test' }
        ];

        // Heuristic: ~4 chars per token.
        // Let's mock fs.readFileSync to return 400 chars each -> 100 tokens.
        vi.spyOn(fs, 'readFileSync').mockReturnValue('A'.repeat(400));
        vi.spyOn(fs, 'existsSync').mockReturnValue(true);

        const result = checkBatchBudget(tasks, 1000);
        expect(result.allowed).toBe(true);
        expect(result.estimatedTokens).toBeGreaterThan(0);
    });

    it('should block a batch exceeding the token budget', () => {
        const tasks = [
            { filePath: 'huge.ts', role: 'test', prompt: 'test' }
        ];

        // 8000 chars -> ~2000 tokens
        vi.spyOn(fs, 'readFileSync').mockReturnValue('A'.repeat(8000));
        vi.spyOn(fs, 'existsSync').mockReturnValue(true);

        const result = checkBatchBudget(tasks, 1000);
        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('exceeds limit');
    });

    it('should default to 0 tokens for non-existent files', () => {
        const tasks = [{ filePath: 'ghost.ts', role: 'test', prompt: 'test' }];
        vi.spyOn(fs, 'existsSync').mockReturnValue(false);

        const result = checkBatchBudget(tasks, 1000);
        expect(result.estimatedTokens).toBe(0);
    });
});
