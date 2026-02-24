import { describe, it, expect } from 'vitest';
import {
    getProviderConfig,
    buildProviderRequest,
    extractAssistantContent,
    extractTokenUsage,
    buildHealthCheckRequest,
    getConfiguredProviders
} from '../src/providers.js';

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

    it('should build anthropic message requests with provider-specific headers', () => {
        process.env.ANTHROPIC_API_KEY = 'sk-ant';
        const config = getProviderConfig('anthropic');
        const req = buildProviderRequest(config, 'sys', 'user', 'claude-3-5-sonnet-20241022', 1200);

        expect(req.url).toContain('/v1/messages');
        expect(req.headers['x-api-key']).toBe('sk-ant');
        expect(req.headers['anthropic-version']).toBeDefined();
    });

    it('should build google generateContent requests with key query param', () => {
        process.env.GOOGLE_API_KEY = 'g-key';
        const config = getProviderConfig('google');
        const req = buildProviderRequest(config, 'sys', 'user', 'gemini-1.5-flash', 900);

        expect(req.url).toContain('/models/gemini-1.5-flash:generateContent?key=');
        expect(req.body?.generationConfig?.maxOutputTokens).toBe(900);
    });

    it('should parse anthropic and google assistant content + usage', () => {
        process.env.ANTHROPIC_API_KEY = 'sk-ant';
        process.env.GOOGLE_API_KEY = 'g-key';

        const anthropic = getProviderConfig('anthropic');
        const google = getProviderConfig('google');

        expect(extractAssistantContent(anthropic, {
            content: [{ type: 'text', text: '[{"type":"task","description":"a"}]' }],
            usage: { input_tokens: 11, output_tokens: 22 }
        })).toContain('"type":"task"');

        expect(extractTokenUsage(anthropic, { usage: { input_tokens: 11, output_tokens: 22 } }))
            .toEqual({ promptTokens: 11, completionTokens: 22 });

        expect(extractAssistantContent(google, {
            candidates: [{ content: { parts: [{ text: '[{"type":"task","description":"b"}]' }] } }],
            usageMetadata: { promptTokenCount: 7, candidatesTokenCount: 13 }
        })).toContain('"description":"b"');

        expect(extractTokenUsage(google, { usageMetadata: { promptTokenCount: 7, candidatesTokenCount: 13 } }))
            .toEqual({ promptTokens: 7, completionTokens: 13 });
    });

    it('should build provider-specific health checks', () => {
        process.env.GOOGLE_API_KEY = 'g-key';
        const google = getProviderConfig('google');
        const healthReq = buildHealthCheckRequest(google);
        expect(healthReq.url).toContain('/models?key=');
        expect(healthReq.method).toBe('GET');
    });

    it('should build cohere adapter requests and parse usage', () => {
        process.env.COHERE_API_KEY = 'coh-test';
        const cohere = getProviderConfig('cohere');
        const req = buildProviderRequest(cohere, 'sys', 'user', 'command-r-plus', 600);
        expect(req.url).toContain('/v2/chat');
        expect(req.headers.Authorization).toBe('Bearer coh-test');

        const content = extractAssistantContent(cohere, {
            message: { content: [{ text: '[{"type":"task","description":"cohere"}]' }] },
            usage: { tokens: { input_tokens: 5, output_tokens: 9 } }
        });
        expect(content).toContain('"cohere"');
        expect(extractTokenUsage(cohere, {
            usage: { tokens: { input_tokens: 5, output_tokens: 9 } }
        })).toEqual({ promptTokens: 5, completionTokens: 9 });
    });

    it('should build azure_openai adapter request format', () => {
        process.env.AZURE_OPENAI_API_KEY = 'az-key';
        process.env.AZURE_OPENAI_ENDPOINT = 'https://example.openai.azure.com';
        const azure = getProviderConfig('azure_openai');
        const req = buildProviderRequest(azure, 'sys', 'user', 'my-deployment', 300);
        expect(req.url).toContain('/openai/deployments/my-deployment/chat/completions?api-version=');
        expect(req.headers['api-key']).toBe('az-key');
    });

    it('should include optional-auth provider only when enabled', () => {
        delete process.env.OLLAMA_API_KEY;
        process.env.OLLAMA_ENABLED = 'false';
        let configured = getConfiguredProviders();
        expect(configured.includes('ollama')).toBe(false);

        process.env.OLLAMA_ENABLED = 'true';
        configured = getConfiguredProviders();
        expect(configured.includes('ollama')).toBe(true);
    });
});
