import { describe, it, expect, beforeEach } from 'vitest';
import { loadRoles, getRolePrompt } from '../src/roles.js';
import fs from 'fs';
import path from 'path';

describe('Role Registry', () => {
    const tempRolesPath = path.join(process.cwd(), 'tests', 'temp_roles.json');

    beforeEach(() => {
        if (fs.existsSync(tempRolesPath)) {
            fs.unlinkSync(tempRolesPath);
        }
    });

    it('should load valid roles successfully', () => {
        const roles = {
            "Security Auditor": { system_prompt: "You are a security expert..." },
            "Code Reviewer": { system_prompt: "You are a senior dev..." }
        };
        fs.writeFileSync(tempRolesPath, JSON.stringify(roles));

        loadRoles(tempRolesPath);
        expect(getRolePrompt("Security Auditor")).toBe(roles["Security Auditor"].system_prompt);
    });

    it('should throw error for malformed roles (missing prompt string)', () => {
        const malformed = {
            "Broken Role": 123 // Should be a string
        };
        fs.writeFileSync(tempRolesPath, JSON.stringify(malformed));

        expect(() => loadRoles(tempRolesPath)).toThrow();
    });

    it('should return undefined for unknown roles', () => {
        fs.writeFileSync(tempRolesPath, JSON.stringify({}));
        loadRoles(tempRolesPath);
        expect(getRolePrompt("NonExistent")).toBeUndefined();
    });
});
