/**
 * Interface for model provider configuration.
 */
export type ProviderName =
    | "openrouter"
    | "openai"
    | "anthropic"
    | "google"
    | "groq"
    | "together"
    | "mistral"
    | "fireworks";

export interface ProviderConfig {
    name: string;
    apiKey: string;
    baseUrl: string;
}

const PROVIDER_MAP: Record<string, { envKey: string, baseUrl: string }> = {
    openrouter: { envKey: 'OPENROUTER_API_KEY', baseUrl: 'https://api.openrouter.ai/api/v1' },
    openai: { envKey: 'OPENAI_API_KEY', baseUrl: 'https://api.openai.com/v1' },
    anthropic: { envKey: 'ANTHROPIC_API_KEY', baseUrl: 'https://api.anthropic.com/v1' },
    google: { envKey: 'GOOGLE_API_KEY', baseUrl: 'https://generativelanguage.googleapis.com/v1beta' },
    groq: { envKey: 'GROQ_API_KEY', baseUrl: 'https://api.groq.com/openai/v1' },
    together: { envKey: 'TOGETHER_API_KEY', baseUrl: 'https://api.together.xyz/v1' },
    mistral: { envKey: 'MISTRAL_API_KEY', baseUrl: 'https://api.mistral.ai/v1' },
    fireworks: { envKey: 'FIREWORKS_API_KEY', baseUrl: 'https://api.fireworks.ai/inference/v1' }
};

/**
 * Resolves the configuration for a given provider from environment variables.
 * 
 * @param providerName - Name of the provider (e.g., 'openrouter', 'groq')
 * @returns Resolved ProviderConfig
 * @throws Error if provider is unsupported or API key is missing
 */
export function getProviderConfig(providerName: string): ProviderConfig {
    const provider = PROVIDER_MAP[providerName.toLowerCase()];

    if (!provider) {
        throw new Error(`Unsupported provider: ${providerName}`);
    }

    const apiKey = process.env[provider.envKey];

    if (!apiKey) {
        throw new Error(`API key missing for provider: ${providerName}`);
    }

    return {
        name: providerName.toLowerCase(),
        apiKey,
        baseUrl: provider.baseUrl
    };
}
