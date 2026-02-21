import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { resolveCandidates } from '../src/resolver.js';
import fs from 'node:fs';
import path from 'node:path';

describe('Provider Pool Resolver (Escalation Ladder)', () => {
    const registryPath = path.join(process.cwd(), 'modelRegistry.json');
    const rolesPath = path.join(process.cwd(), 'roles.json');
    let originalRegistry: string;
    let originalRoles: string;

    beforeEach(() => {
        originalRegistry = fs.readFileSync(registryPath, 'utf8');
        originalRoles = fs.readFileSync(rolesPath, 'utf8');

        // Setup mock environment
        process.env.OPENROUTER_API_KEY = '';
        process.env.ANTHROPIC_API_KEY = '';
        process.env.OPENAI_API_KEY = '';
    });

    afterEach(() => {
        fs.writeFileSync(registryPath, originalRegistry);
        fs.writeFileSync(rolesPath, originalRoles);
    });

    it('should resolve a flattened ladder of candidates prioritized by model strength', () => {
        const customRegistry = {
            "claude-3-haiku": {
                "strengths": ["linting"],
                "providers": {
                    "anthropic": "claude-3-haiku-20240307",
                    "openrouter": "anthropic/claude-3-haiku"
                }
            },
            "gpt-3.5-turbo": {
                "strengths": ["linting"],
                "providers": {
                    "openai": "gpt-3.5-turbo",
                    "openrouter": "openai/gpt-3.5-turbo"
                }
            }
        };
        fs.writeFileSync(registryPath, JSON.stringify(customRegistry));

        process.env.ANTHROPIC_API_KEY = 'sk-ant';
        process.env.OPENROUTER_API_KEY = 'sk-or';
        process.env.OPENAI_API_KEY = 'sk-oa';

        const results = resolveCandidates('linter');

        // Expected order: 
        // 1. haiku @ anthropic
        // 2. haiku @ openrouter
        // 3. gpt-3.5 @ openai
        // 4. gpt-3.5 @ openrouter

        expect(results).toHaveLength(4);
        expect(results[0].provider).toBe('anthropic');
        expect(results[0].logicalModelName).toBe('claude-3-haiku');
        expect(results[1].provider).toBe('openrouter');
        expect(results[1].logicalModelName).toBe('claude-3-haiku');
        expect(results[2].provider).toBe('openai');
        expect(results[2].logicalModelName).toBe('gpt-3.5-turbo');
    });

    it('should only include candidates with available API keys', () => {
        const customRegistry = {
            "claude-3-haiku": {
                "strengths": ["linting"],
                "providers": {
                    "anthropic": "claude-3-haiku-20240307",
                    "openrouter": "anthropic/claude-3-haiku"
                }
            }
        };
        fs.writeFileSync(registryPath, JSON.stringify(customRegistry));

        process.env.OPENROUTER_API_KEY = 'sk-or';

        const results = resolveCandidates('linter');

        expect(results).toHaveLength(1);
        expect(results[0].provider).toBe('openrouter');
        expect(results[0].logicalModelName).toBe('claude-3-haiku');
    });

    it('should throw error if role is unknown', () => {
        const results = () => resolveCandidates('non-existent-role');
        expect(results).toThrow(/Unknown role/);
    });
});
