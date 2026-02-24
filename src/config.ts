import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { getConfiguredProviders } from './providers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env into process.env once at module initialization
const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
}

/**
 * Validates that provider configuration is present.
 * Minimum providers can be configured with MIN_PROVIDER_KEYS (default: 1).
 * Returns a list of active provider names.
 */
export function validateAndConfigure(): string[] {
    const availableProviders = getConfiguredProviders();
    const requiredMin = Math.max(1, parseInt(process.env.MIN_PROVIDER_KEYS || '1', 10) || 1);
    const recommendedMin = Math.max(requiredMin, parseInt(process.env.RECOMMENDED_PROVIDER_KEYS || '2', 10) || 2);

    if (availableProviders.length < requiredMin) {
        throw new Error(
            `Insufficient redundancy: Found ${availableProviders.length} provider keys (${availableProviders.join(', ')}). ` +
            `At least ${requiredMin} configured provider(s) required.`
        );
    }

    // Soft guidance: keep onboarding easy (min=1) while nudging resilience.
    // This warns once per process if users run with fewer than recommended providers.
    if (availableProviders.length < recommendedMin && !warnedRecommendedProviders) {
        const delta = recommendedMin - availableProviders.length;
        console.error(
            `[Hive Config] Resilience recommendation: add ${delta} more provider key(s) ` +
            `(current: ${availableProviders.length}, recommended: ${recommendedMin}). ` +
            `Reason: failover during outages, better rate-limit tolerance, and steadier swarm throughput.`
        );
        warnedRecommendedProviders = true;
    }

    return availableProviders;
}

let warnedRecommendedProviders = false;
