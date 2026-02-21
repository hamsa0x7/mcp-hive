import * as fs from 'fs';
import * as path from 'path';

import { ProviderName } from './providers.js';

export interface ModelCandidate {
    provider: ProviderName;
    modelString: string;
    logicalModelName: string;
}

/**
 * Checks whether a provider API key exists in env.
 */
function hasProviderKey(provider: ProviderName): boolean {
    const keyMap: Record<string, string | undefined> = {
        openrouter: process.env.OPENROUTER_API_KEY,
        openai: process.env.OPENAI_API_KEY,
        anthropic: process.env.ANTHROPIC_API_KEY,
        google: process.env.GOOGLE_API_KEY,
        groq: process.env.GROQ_API_KEY,
        together: process.env.TOGETHER_API_KEY,
        mistral: process.env.MISTRAL_API_KEY,
        fireworks: process.env.FIREWORKS_API_KEY
    };

    return !!keyMap[provider];
}

/**
 * Resolve all available model/provider candidates for a given role from the provider pool.
 * Candidates are prioritized: first by model strength/order in registry, then by provider.
 */
export function resolveCandidates(role: string): ModelCandidate[] {
    // Load config files
    const rolesPath = path.join(process.cwd(), 'roles.json');
    const registryPath = path.join(process.cwd(), 'modelRegistry.json');

    const roles = JSON.parse(fs.readFileSync(rolesPath, 'utf8'));
    const modelRegistry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));

    const roleConfig = roles[role];
    if (!roleConfig) {
        throw new Error(`Unknown role: ${role}`);
    }

    const requiredStrength = roleConfig.required_strength;

    // Step 1: Find models that match required strength
    const matchingModels = Object.entries(modelRegistry).filter(
        ([_, modelMeta]: any) => modelMeta.strengths.includes(requiredStrength)
    );

    if (matchingModels.length === 0) {
        throw new Error(`No model supports required strength: ${requiredStrength} for role: ${role}`);
    }

    const candidates: ModelCandidate[] = [];

    // Step 2: Build a prioritized list of candidates
    for (const [logicalModelName, modelMeta] of matchingModels as any[]) {
        const providers = Object.entries(modelMeta.providers) as [ProviderName, string][];

        for (const [pName, mString] of providers) {
            if (hasProviderKey(pName)) {
                candidates.push({
                    provider: pName,
                    modelString: mString,
                    logicalModelName
                });
            }
        }
    }

    if (candidates.length === 0) {
        throw new Error(
            `No available provider found in pool for role: ${role} (required strength: ${requiredStrength}).`
        );
    }

    return candidates;
}
