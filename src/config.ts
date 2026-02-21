import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

const PROVIDER_KEYS = [
    'OPENAI_API_KEY',
    'ANTHROPIC_API_KEY',
    'GROQ_API_KEY',
    'OPENROUTER_API_KEY',
    'GOOGLE_API_KEY',
    'TOGETHER_API_KEY',
    'MISTRAL_API_KEY',
    'FIREWORKS_API_KEY'
];

/**
 * Validates that at least two provider keys are present.
 * Automatically configures PRIMARY_PROVIDER and FALLBACK_PROVIDER if needed.
 */
export function validateAndConfigure(): void {
    const envPath = path.join(process.cwd(), '.env');

    // Check if .env exists
    if (!fs.existsSync(envPath)) {
        throw new Error('.env file missing. Run initial setup first.');
    }

    // Refresh env variables from file to ensure we have the latest
    const envConfig = dotenv.parse(fs.readFileSync(envPath));

    const availableProviders = PROVIDER_KEYS
        .filter(key => envConfig[key] && envConfig[key].trim() !== '')
        .map(key => key.replace('_API_KEY', '').toLowerCase());

    if (availableProviders.length < 2) {
        throw new Error(
            `Insufficient redundancy: Found ${availableProviders.length} provider keys (${availableProviders.join(', ')}). ` +
            `At least two keys are required for multimodal swarm processes.`
        );
    }
}
