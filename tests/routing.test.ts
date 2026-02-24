import { describe, it, expect, beforeEach, vi } from 'vitest';
import { expandSwarm } from '../src/routing.js';


import * as resolver from '../src/resolver.js';

describe('Context Routing (expandSwarm)', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('should expand a list of files into tasks for a valid role', () => {
        // Mock the registry resolver
        vi.spyOn(resolver, 'resolveCandidates').mockReturnValue({
            candidates: [{ provider: 'openai', modelString: 'gpt-4o', logicalModelName: 'gpt-4o' }],
            providerCandidatesMap: new Map(),
            availableProviders: ['openai']
        } as any);

        const files = ['src/index.ts', 'src/db.ts'];
        const role = 'Security Auditor';

        const tasks = expandSwarm(files.map(path => ({ path, role })));

        expect(tasks).toHaveLength(2);

        const task0 = tasks[0];
        expect(task0.filePath).toBe('src/index.ts');
        expect(task0.role).toBe('Security Auditor');
        expect(task0.prompt).toContain('You are a Security Auditor.');
        expect(task0.prompt).toContain('CRITICAL: Output ONLY valid, parsable JSON');
        expect(task0.prompt).toContain('"type": "string');
        expect(task0.assignedProvider).toBe('openai');
        expect(task0.assignedModel).toBe('gpt-4o');
        expect(task0.customPrompt).toBeUndefined();
    });

    it('should generate a dynamic structured prompt from the customPrompt if provided', () => {
        vi.spyOn(resolver, 'resolveCandidates').mockReturnValue({
            candidates: [{ provider: 'openai', modelString: 'gpt-4o', logicalModelName: 'gpt-4o' }],
            providerCandidatesMap: new Map(),
            availableProviders: ['openai']
        } as any);

        const files = ['src/index.ts'];
        const role = 'unknown_role';

        const tasks = expandSwarm(files.map(path => ({ path, role })));

        expect(tasks[0].role).toBe('unknown_role');
        expect(tasks[0].prompt).toContain('You are a Unknown Role.');
        expect(tasks[0].prompt).toContain('CRITICAL: Output ONLY valid, parsable JSON');
    });

    it('should return an empty array if no files are provided', () => {
        const tasks = expandSwarm([]);
        expect(tasks).toEqual([]);
    });

});
