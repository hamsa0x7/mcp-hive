import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { ProviderName, getProviderPriority, isProviderConfigured } from './providers.js';

// File cache with 60-second TTL to avoid blocking I/O per call
const fileCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL_MS = 60_000;

function cachedRead(filePath: string): any {
    const now = Date.now();
    const cached = fileCache.get(filePath);
    if (cached && (now - cached.timestamp) < CACHE_TTL_MS) {
        return cached.data;
    }
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    fileCache.set(filePath, { data, timestamp: now });
    return data;
}

export function clearRegistryCache() {
    fileCache.clear();
}

export interface ModelCandidate {
    provider: ProviderName;
    modelString: string;
    logicalModelName: string;
    reasoning: boolean;
}

export interface ResolvedCandidates {
    candidates: ModelCandidate[];
    providerCandidatesMap: Map<ProviderName, ModelCandidate[]>;
    availableProviders: ProviderName[];
}

const ROLE_TO_STRENGTH: Record<string, string> = {
    security: 'security_detection',
    security_auditor: 'security_detection',
    security_specialist: 'security_detection',
    architecture: 'architecture_analysis',
    architect: 'architecture_analysis',
    architecture_reviewer: 'architecture_analysis',
    performance: 'performance_analysis',
    perf: 'performance_analysis',
    performance_auditor: 'performance_analysis',
    api: 'api_analysis',
    api_reviewer: 'api_analysis',
    api_specialist: 'api_analysis',
    errors: 'error_analysis',
    error_handling: 'error_analysis',
    error_handling_auditor: 'error_analysis',
    lint: 'linting',
    linter: 'linting',
    complexity_analyzer: 'complexity_analysis',
    dead_code_detector: 'dead_code_detection',
    test_reviewer: 'test_analysis',
    test_specialist: 'test_analysis',
    dependency_auditor: 'dependency_analysis',
    concurrency_specialist: 'concurrency_analysis',
    breaking_change_detector: 'breaking_change_detection',
    planner: 'strategic_planning',
    strategist: 'strategic_planning',
    qa: 'quality_assurance',
    qa_reviewer: 'quality_assurance'
};

function normalizeStrengthKey(value: string): string {
    return value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
}

function getSupportedStrengths(modelRegistry: Record<string, any>): Set<string> {
    const strengths = new Set<string>();
    for (const meta of Object.values(modelRegistry) as any[]) {
        const modelStrengths = Array.isArray(meta?.strengths) ? meta.strengths : [];
        for (const s of modelStrengths) {
            if (typeof s === 'string') strengths.add(normalizeStrengthKey(s));
        }
    }
    return strengths;
}

/**
 * Resolves a deterministic model strength from optional requested strength and role.
 * Priority:
 *   1. Explicit requested strength if supported
 *   2. Role if it directly matches a supported strength
 *   3. Role alias map
 *   4. architecture_analysis fallback (or first supported strength)
 */
export function resolveRequiredStrength(role?: string, requestedStrength?: string): string {
    const registryPath = path.resolve(__dirname, '../modelRegistry.json');
    const modelRegistry = cachedRead(registryPath);
    const supported = getSupportedStrengths(modelRegistry);

    const explicit = requestedStrength ? normalizeStrengthKey(requestedStrength) : '';
    if (explicit && supported.has(explicit)) {
        return explicit;
    }

    const normalizedRole = role ? normalizeStrengthKey(role) : '';
    if (normalizedRole && supported.has(normalizedRole)) {
        return normalizedRole;
    }

    if (normalizedRole) {
        const mapped = ROLE_TO_STRENGTH[normalizedRole];
        if (mapped && supported.has(mapped)) {
            return mapped;
        }
    }

    if (supported.has('architecture_analysis')) {
        return 'architecture_analysis';
    }

    return Array.from(supported)[0] || 'architecture_analysis';
}

/**
 * Checks whether a provider is configured and usable.
 */
function hasProviderKey(provider: ProviderName): boolean {
    return isProviderConfigured(provider);
}

/**
 * Resolve all available model/provider candidates for a given role from provider pool.
 * Candidates are prioritized: first by model strength/order in registry, then by provider.
 */
export function resolveCandidates(requiredStrength: string = 'architecture_analysis'): ResolvedCandidates {
    // Load config files with caching (60s TTL)
    const registryPath = path.resolve(__dirname, '../modelRegistry.json');
    const modelRegistry = cachedRead(registryPath);
    const normalizedStrength = normalizeStrengthKey(requiredStrength);

    // Step 1: Find models that match required strength
    const matchingModels = Object.entries(modelRegistry).filter(
        ([_, modelMeta]: any) => (modelMeta.strengths || []).map((s: string) => normalizeStrengthKey(s)).includes(normalizedStrength)
    );

    if (matchingModels.length === 0) {
        throw new Error(`No model supports required strength: ${normalizedStrength}`);
    }

    const candidates: ModelCandidate[] = [];

    // Step 2: Build a prioritized list of candidates
    // First collect all possible candidates
    const allCandidates: ModelCandidate[] = [];
    for (const [logicalModelName, modelMeta] of matchingModels as any[]) {
        const providers = Object.entries(modelMeta.providers) as [ProviderName, string][];

        for (const [pName, mString] of providers) {
            if (hasProviderKey(pName)) {
                allCandidates.push({
                    provider: pName,
                    modelString: mString,
                    logicalModelName,
                    reasoning: modelMeta.reasoning === true
                });
            }
        }
    }

    // Step 3: Sort candidates by provider availability priority
    // Priority order: providers with API keys first, then by model order
    const providerPriority: ProviderName[] = getProviderPriority();

    // Create a map of providers to their candidates for quick lookup
    const providerCandidatesMap = new Map<ProviderName, ModelCandidate[]>();

    for (const provider of providerPriority) {
        const providerCandidates = allCandidates.filter(c => c.provider === provider);
        if (providerCandidates.length > 0) {
            providerCandidatesMap.set(provider, providerCandidates);
            candidates.push(...providerCandidates);
        }
    }

    // Return all available candidates, organized for parallel execution
    // The orchestrator can now pick from different providers simultaneously
    return {
        candidates,
        providerCandidatesMap,
        availableProviders: Array.from(providerCandidatesMap.keys())
    };
}
