import { describe, it, expect } from 'vitest';
import { getProviderConfig } from '../src/providers.js';

describe('Provider Strategy (getProviderConfig)', () => {
    it('should resolve OpenRouter config from environment', () => {
        process.env.OPENROUTER_API_KEY = 'sk-or-test';
        const config = getProviderConfig('openrouter');
        expect(config.name).toBe('openrouter');
        expect(config.apiKey).toBe('sk-or-test');
        expect(config.baseUrl).toContain('openrouter.ai');
    });

    it('should resolve Groq config from environment', () => {
        process.env.GROQ_API_KEY = 'gsk-test';
        const config = getProviderConfig('groq');
        expect(config.name).toBe('groq');
        expect(config.apiKey).toBe('gsk-test');
        expect(config.baseUrl).toContain('groq.com');
    });

    it('should throw an error for unsupported providers', () => {
        expect(() => getProviderConfig('unsupported')).toThrow('Unsupported provider: unsupported');
    });

    it('should throw an error for supported providers missing API keys', () => {
        delete process.env.ANTHROPIC_API_KEY;
        expect(() => getProviderConfig('anthropic')).toThrow('API key missing for provider: anthropic');
    });
});
