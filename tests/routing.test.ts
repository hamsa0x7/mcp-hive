import { describe, it, expect, beforeEach, vi } from 'vitest';
import { expandRoles } from '../src/routing.js';
import * as roles from '../src/roles.js';

describe('Context Routing (expandRoles)', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('should expand a list of files into tasks for a valid role', () => {
        // Mock the registry to return a prompt
        vi.spyOn(roles, 'getRolePrompt').mockReturnValue('You are a security expert.');

        const files = ['src/index.ts', 'src/db.ts'];
        const role = 'Security Auditor';

        const tasks = expandRoles(files, role);

        expect(tasks).toHaveLength(2);
        expect(tasks[0]).toEqual({
            filePath: 'src/index.ts',
            role: 'Security Auditor',
            prompt: 'You are a security expert.'
        });
    });

    it('should throw an error if the role is not found in the registry', () => {
        vi.spyOn(roles, 'getRolePrompt').mockReturnValue(undefined);

        const files = ['src/index.ts'];
        const role = 'Unknown Role';

        expect(() => expandRoles(files, role)).toThrow('Role "Unknown Role" not found in registry');
    });

    it('should return an empty array if no files are provided', () => {
        vi.spyOn(roles, 'getRolePrompt').mockReturnValue('Prompt');

        const tasks = expandRoles([], 'Any Role');
        expect(tasks).toEqual([]);
    });
});
