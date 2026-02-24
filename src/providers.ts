import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

export type ProviderName = string;
export type ProviderProtocol =
    | 'openai_compatible'
    | 'anthropic_messages'
    | 'google_gemini'
    | 'cohere_chat_v2'
    | 'azure_openai';

export interface ProviderConfig {
    name: ProviderName;
    apiKey: string;
    baseUrl: string;
    protocol: ProviderProtocol;
}

export interface ProviderRequest {
    url: string;
    method: 'GET' | 'POST';
    headers: Record<string, string>;
    body?: Record<string, any>;
}

export interface ProviderDefinition {
    envKey: string;
    baseUrl: string;
    protocol: ProviderProtocol;
    envBaseUrlKey?: string;
    optionalAuth?: boolean;
    enabledFlagEnv?: string;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_REGISTRY_PATH = path.resolve(__dirname, '../providers.registry.json');

const BUILTIN_PROVIDER_MAP: Record<string, ProviderDefinition> = {
    openai: { envKey: 'OPENAI_API_KEY', baseUrl: 'https://api.openai.com/v1', protocol: 'openai_compatible' },
    anthropic: { envKey: 'ANTHROPIC_API_KEY', baseUrl: 'https://api.anthropic.com/v1', protocol: 'anthropic_messages' },
    google: { envKey: 'GOOGLE_API_KEY', baseUrl: 'https://generativelanguage.googleapis.com/v1beta', protocol: 'google_gemini' },
    openrouter: { envKey: 'OPENROUTER_API_KEY', baseUrl: 'https://api.openrouter.ai/api/v1', protocol: 'openai_compatible' },
    groq: { envKey: 'GROQ_API_KEY', baseUrl: 'https://api.groq.com/openai/v1', protocol: 'openai_compatible' },
    together: { envKey: 'TOGETHER_API_KEY', baseUrl: 'https://api.together.xyz/v1', protocol: 'openai_compatible' },
    mistral: { envKey: 'MISTRAL_API_KEY', baseUrl: 'https://api.mistral.ai/v1', protocol: 'openai_compatible' },
    fireworks: { envKey: 'FIREWORKS_API_KEY', baseUrl: 'https://api.fireworks.ai/inference/v1', protocol: 'openai_compatible' },
    cohere: { envKey: 'COHERE_API_KEY', baseUrl: 'https://api.cohere.com/v2', protocol: 'cohere_chat_v2' },
    xai: { envKey: 'XAI_API_KEY', baseUrl: 'https://api.x.ai/v1', protocol: 'openai_compatible' },
    perplexity: { envKey: 'PERPLEXITY_API_KEY', baseUrl: 'https://api.perplexity.ai', protocol: 'openai_compatible' },
    deepinfra: { envKey: 'DEEPINFRA_API_KEY', baseUrl: 'https://api.deepinfra.com/v1/openai', protocol: 'openai_compatible' },
    cerebras: { envKey: 'CEREBRAS_API_KEY', baseUrl: 'https://api.cerebras.ai/v1', protocol: 'openai_compatible' },
    sambanova: { envKey: 'SAMBANOVA_API_KEY', baseUrl: 'https://api.sambanova.ai/v1', protocol: 'openai_compatible' },
    nvidia: { envKey: 'NVIDIA_API_KEY', baseUrl: 'https://integrate.api.nvidia.com/v1', protocol: 'openai_compatible' },
    novita: { envKey: 'NOVITA_API_KEY', baseUrl: 'https://api.novita.ai/v3/openai', protocol: 'openai_compatible' },
    hyperbolic: { envKey: 'HYPERBOLIC_API_KEY', baseUrl: 'https://api.hyperbolic.xyz/v1', protocol: 'openai_compatible' },
    azure_openai: {
        envKey: 'AZURE_OPENAI_API_KEY',
        baseUrl: '',
        envBaseUrlKey: 'AZURE_OPENAI_ENDPOINT',
        protocol: 'azure_openai'
    },
    ollama: {
        envKey: 'OLLAMA_API_KEY',
        baseUrl: 'http://localhost:11434/v1',
        envBaseUrlKey: 'OLLAMA_BASE_URL',
        protocol: 'openai_compatible',
        optionalAuth: true,
        enabledFlagEnv: 'OLLAMA_ENABLED'
    },
    llm7: { envKey: 'LLM7_API_KEY', baseUrl: 'https://api.llm7.io/v1', protocol: 'openai_compatible' }
};

function toBool(v: string | undefined): boolean {
    return (v || '').trim().toLowerCase() === 'true';
}

function normalizeProviderName(name: string): string {
    return name.trim().toLowerCase();
}

function loadCustomProviderMap(): Record<string, ProviderDefinition> {
    const registryPath = process.env.HIVE_PROVIDER_REGISTRY_PATH || DEFAULT_REGISTRY_PATH;
    if (!fs.existsSync(registryPath)) {
        return {};
    }

    try {
        const parsed = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
        if (!parsed || typeof parsed !== 'object') {
            return {};
        }

        const normalized: Record<string, ProviderDefinition> = {};
        for (const [rawName, rawDef] of Object.entries(parsed as Record<string, any>)) {
            const name = normalizeProviderName(rawName);
            if (!name || typeof rawDef !== 'object' || rawDef === null) {
                continue;
            }

            const protocol = rawDef.protocol as ProviderProtocol;
            if (!protocol) {
                continue;
            }

            normalized[name] = {
                envKey: String(rawDef.envKey || `${name.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}_API_KEY`),
                baseUrl: String(rawDef.baseUrl || ''),
                protocol,
                envBaseUrlKey: rawDef.envBaseUrlKey ? String(rawDef.envBaseUrlKey) : undefined,
                optionalAuth: rawDef.optionalAuth === true,
                enabledFlagEnv: rawDef.enabledFlagEnv ? String(rawDef.enabledFlagEnv) : undefined
            };
        }

        return normalized;
    } catch {
        return {};
    }
}

export function getProviderDefinitions(): Record<string, ProviderDefinition> {
    return {
        ...BUILTIN_PROVIDER_MAP,
        ...loadCustomProviderMap()
    };
}

function resolveBaseUrl(def: ProviderDefinition): string {
    const override = def.envBaseUrlKey ? process.env[def.envBaseUrlKey] : undefined;
    return (override || def.baseUrl || '').trim();
}

function resolveApiKey(def: ProviderDefinition): string {
    const key = (process.env[def.envKey] || '').trim();
    // Reject placeholders like <OPENAI_API_KEY> or <..._API_KEY>
    if (key.startsWith('<') && key.endsWith('_API_KEY>')) {
        return '';
    }
    return key;
}

export function isProviderConfigured(providerName: string): boolean {
    const defs = getProviderDefinitions();
    const def = defs[normalizeProviderName(providerName)];
    if (!def) return false;

    const baseUrl = resolveBaseUrl(def);
    if (!baseUrl) return false;

    const key = resolveApiKey(def);
    if (key) return true;

    if (def.optionalAuth) {
        if (def.enabledFlagEnv) {
            return toBool(process.env[def.enabledFlagEnv]);
        }
        return true;
    }

    return false;
}

export function getConfiguredProviders(): ProviderName[] {
    const defs = getProviderDefinitions();
    return Object.keys(defs).filter(isProviderConfigured);
}

/**
 * Priority order for candidate dispatch. Built-ins are explicit; custom providers append after.
 */
export function getProviderPriority(): ProviderName[] {
    const preferred = [
        'groq',
        'openai',
        'anthropic',
        'google',
        'openrouter',
        'together',
        'mistral',
        'fireworks',
        'cohere',
        'xai',
        'perplexity',
        'deepinfra',
        'cerebras',
        'sambanova',
        'nvidia',
        'novita',
        'hyperbolic',
        'azure_openai',
        'ollama',
        'llm7'
    ];

    const defs = getProviderDefinitions();
    const custom = Object.keys(defs).filter(p => !preferred.includes(p)).sort();
    return [...preferred.filter(p => p in defs), ...custom];
}

/**
 * Resolves the configuration for a given provider from environment variables.
 *
 * @param providerName - Name of the provider (e.g., 'openrouter', 'groq')
 * @returns Resolved ProviderConfig
 * @throws Error if provider is unsupported or required config is missing
 */
export function getProviderConfig(providerName: string): ProviderConfig {
    const defs = getProviderDefinitions();
    const normalized = normalizeProviderName(providerName);
    const provider = defs[normalized];

    if (!provider) {
        throw new Error(`Unsupported provider: ${providerName}`);
    }

    const baseUrl = resolveBaseUrl(provider);
    if (!baseUrl) {
        throw new Error(`Base URL missing for provider: ${providerName}`);
    }

    const apiKey = resolveApiKey(provider);
    if (!apiKey && !provider.optionalAuth) {
        throw new Error(`API key missing for provider: ${providerName}`);
    }

    if (!apiKey && provider.optionalAuth && provider.enabledFlagEnv && !toBool(process.env[provider.enabledFlagEnv])) {
        throw new Error(`Provider ${providerName} requires ${provider.enabledFlagEnv}=true when no API key is provided`);
    }

    return {
        name: normalized,
        apiKey,
        baseUrl,
        protocol: provider.protocol
    };
}

/**
 * Builds provider-specific inference request payload.
 */
export function buildProviderRequest(
    config: ProviderConfig,
    systemPrompt: string,
    userPrompt: string,
    model: string,
    maxOutputTokens: number
): ProviderRequest {
    switch (config.protocol) {
        case 'openai_compatible': {
            const headers: Record<string, string> = {
                'Content-Type': 'application/json'
            };
            if (config.apiKey) {
                headers['Authorization'] = `Bearer ${config.apiKey}`;
            }

            return {
                url: `${config.baseUrl}/chat/completions`,
                method: 'POST',
                headers,
                body: {
                    model,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userPrompt }
                    ],
                    max_tokens: maxOutputTokens
                }
            };
        }

        case 'anthropic_messages':
            return {
                url: `${config.baseUrl}/messages`,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': config.apiKey,
                    'anthropic-version': '2023-06-01'
                },
                body: {
                    model,
                    system: systemPrompt,
                    messages: [{ role: 'user', content: userPrompt }],
                    max_tokens: maxOutputTokens
                }
            };

        case 'google_gemini':
            return {
                url: `${config.baseUrl}/models/${model}:generateContent?key=${encodeURIComponent(config.apiKey)}`,
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: {
                    systemInstruction: {
                        parts: [{ text: systemPrompt }]
                    },
                    contents: [{
                        role: 'user',
                        parts: [{ text: userPrompt }]
                    }],
                    generationConfig: {
                        maxOutputTokens
                    }
                }
            };

        case 'cohere_chat_v2':
            return {
                url: `${config.baseUrl}/chat`,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${config.apiKey}`
                },
                body: {
                    model,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userPrompt }
                    ],
                    max_tokens: maxOutputTokens
                }
            };

        case 'azure_openai': {
            const apiVersion = process.env.AZURE_OPENAI_API_VERSION || '2024-06-01';
            return {
                url: `${config.baseUrl}/openai/deployments/${encodeURIComponent(model)}/chat/completions?api-version=${encodeURIComponent(apiVersion)}`,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'api-key': config.apiKey
                },
                body: {
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userPrompt }
                    ],
                    max_tokens: maxOutputTokens
                }
            };
        }

        default:
            throw new Error(`Unsupported provider protocol: ${(config as any).protocol}`);
    }
}

/**
 * Extracts assistant content string from provider-specific responses.
 */
export function extractAssistantContent(config: ProviderConfig, data: any): string {
    switch (config.protocol) {
        case 'openai_compatible':
        case 'azure_openai':
            return data?.choices?.[0]?.message?.content ?? '';

        case 'anthropic_messages': {
            const parts = Array.isArray(data?.content) ? data.content : [];
            const textPart = parts.find((p: any) => p?.type === 'text');
            return textPart?.text ?? '';
        }

        case 'google_gemini': {
            const parts = data?.candidates?.[0]?.content?.parts;
            if (!Array.isArray(parts)) return '';
            return parts
                .map((p: any) => (typeof p?.text === 'string' ? p.text : ''))
                .join('');
        }

        case 'cohere_chat_v2': {
            const contentParts = data?.message?.content;
            if (Array.isArray(contentParts)) {
                return contentParts
                    .map((p: any) => p?.text || '')
                    .join('');
            }
            return data?.text || '';
        }

        default:
            return '';
    }
}

/**
 * Extracts token usage in a normalized shape.
 */
export function extractTokenUsage(config: ProviderConfig, data: any): { promptTokens: number; completionTokens: number } {
    switch (config.protocol) {
        case 'openai_compatible':
        case 'azure_openai':
            return {
                promptTokens: data?.usage?.prompt_tokens || 0,
                completionTokens: data?.usage?.completion_tokens || 0
            };

        case 'anthropic_messages':
            return {
                promptTokens: data?.usage?.input_tokens || 0,
                completionTokens: data?.usage?.output_tokens || 0
            };

        case 'google_gemini':
            return {
                promptTokens: data?.usageMetadata?.promptTokenCount || 0,
                completionTokens: data?.usageMetadata?.candidatesTokenCount || 0
            };

        case 'cohere_chat_v2':
            return {
                promptTokens: data?.usage?.tokens?.input_tokens || data?.meta?.billed_units?.input_tokens || 0,
                completionTokens: data?.usage?.tokens?.output_tokens || data?.meta?.billed_units?.output_tokens || 0
            };

        default:
            return { promptTokens: 0, completionTokens: 0 };
    }
}

/**
 * Builds provider-specific health check request.
 */
export function buildHealthCheckRequest(config: ProviderConfig): ProviderRequest {
    switch (config.protocol) {
        case 'openai_compatible': {
            const headers: Record<string, string> = {};
            if (config.apiKey) {
                headers['Authorization'] = `Bearer ${config.apiKey}`;
            }
            return {
                url: `${config.baseUrl}/models`,
                method: 'GET',
                headers
            };
        }

        case 'anthropic_messages':
            return {
                url: `${config.baseUrl}/models`,
                method: 'GET',
                headers: {
                    'x-api-key': config.apiKey,
                    'anthropic-version': '2023-06-01'
                }
            };

        case 'google_gemini':
            return {
                url: `${config.baseUrl}/models?key=${encodeURIComponent(config.apiKey)}`,
                method: 'GET',
                headers: {}
            };

        case 'cohere_chat_v2':
            return {
                url: `${config.baseUrl}/models`,
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${config.apiKey}`
                }
            };

        case 'azure_openai': {
            const apiVersion = process.env.AZURE_OPENAI_API_VERSION || '2024-06-01';
            return {
                url: `${config.baseUrl}/openai/models?api-version=${encodeURIComponent(apiVersion)}`,
                method: 'GET',
                headers: {
                    'api-key': config.apiKey
                }
            };
        }

        default:
            throw new Error(`Unsupported provider protocol: ${(config as any).protocol}`);
    }
}
