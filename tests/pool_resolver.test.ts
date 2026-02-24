import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { resolveCandidates, clearRegistryCache } from '../src/resolver.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// The resolver resolves relative to its own __dirname/../, which is the project root
const projectRoot = path.resolve(__dirname, '..');

describe('Provider Pool Resolver (Escalation Ladder)', () => {
    const registryPath = path.join(projectRoot, 'modelRegistry.json');
    let originalRegistry: string;

    beforeEach(() => {
        originalRegistry = fs.readFileSync(registryPath, 'utf8');

        // Setup mock environment
        process.env.OPENROUTER_API_KEY = '';
        process.env.ANTHROPIC_API_KEY = '';
        process.env.OPENAI_API_KEY = '';
    });

    afterEach(() => {
        fs.writeFileSync(registryPath, originalRegistry);
        clearRegistryCache();
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

        const { candidates: results } = resolveCandidates('linting');

        // Expected order matches provider priority: openai -> anthropic -> openrouter
        // 1. gpt-3.5 @ openai
        // 2. haiku @ anthropic
        // 3. haiku @ openrouter
        // 4. gpt-3.5 @ openrouter

        expect(results).toHaveLength(4);
        expect(results[0].provider).toBe('openai');
        expect(results[0].logicalModelName).toBe('gpt-3.5-turbo');
        expect(results[1].provider).toBe('anthropic');
        expect(results[1].logicalModelName).toBe('claude-3-haiku');
        expect(results[2].provider).toBe('openrouter');
        expect(results[2].logicalModelName).toBe('claude-3-haiku');
        expect(results[3].provider).toBe('openrouter');
        expect(results[3].logicalModelName).toBe('gpt-3.5-turbo');
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

        const { candidates: results } = resolveCandidates('linting');

        expect(results).toHaveLength(1);
        expect(results[0].provider).toBe('openrouter');
        expect(results[0].logicalModelName).toBe('claude-3-haiku');
    });

    it('should fallback to defaults when an undocumented strength is requested', () => {
        const customRegistry = {
            "gpt-4o": {
                "strengths": ["architecture_analysis"],
                "providers": {
                    "openai": "gpt-4o"
                }
            }
        };
        fs.writeFileSync(registryPath, JSON.stringify(customRegistry));

        process.env.OPENAI_API_KEY = 'sk-oa';
        process.env.ANTHROPIC_API_KEY = 'sk-ant';

        const { candidates: results } = resolveCandidates('architecture_analysis');

        // It should match the default architecture_analysis model
        expect(results).toHaveLength(1);
        expect(results[0].provider).toBe('openai');
        expect(results[0].logicalModelName).toBe('gpt-4o');
    });
});
