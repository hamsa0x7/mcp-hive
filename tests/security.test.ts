import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import { validateTaskPath } from '../src/security.js';

describe('Security path sandbox', () => {
    const originalAllowlist = process.env.HIVE_ALLOWLIST_ROOT;

    beforeEach(() => {
        delete process.env.HIVE_ALLOWLIST_ROOT;
    });

    afterEach(() => {
        if (originalAllowlist === undefined) {
            delete process.env.HIVE_ALLOWLIST_ROOT;
        } else {
            process.env.HIVE_ALLOWLIST_ROOT = originalAllowlist;
        }
    });

    it('falls back to process.cwd() when HIVE_ALLOWLIST_ROOT is not set', () => {
        const target = path.resolve(process.cwd(), 'src', 'index.ts');
        const result = validateTaskPath(target);
        expect(result.valid).toBe(true);
        expect(result.normalizedPath).toContain(path.join('src', 'index.ts'));
    });

    it('rejects files that escape the workspace root override', () => {
        const workspaceRoot = process.cwd();
        const outsidePath = path.resolve(process.cwd(), '..', 'outside-root.ts');

        const result = validateTaskPath(outsidePath, workspaceRoot);
        expect(result.valid).toBe(false);
        expect(result.reason).toMatch(/Path escapes the allowed workspace root/);
    });
});
