import { resolveCandidates, resolveRequiredStrength } from './resolver.js';

export interface AgentTask {
    filePath: string;
    role: string;
    requiredStrength: string;
    prompt: string;
    customPrompt?: string;
    assignedProvider?: string;
    assignedModel?: string;
}

/**
 * Expands a list of file-role pairs into a set of agent tasks, 
 * distributing tasks across available providers to maximize parallelism and avoid 429 errors.
 * 
 * @param tasks - Array of objects with path, optional role, and optional customPrompt
 * @param allowedProviders - Optional list of healthy providers to filter candidates
 * @returns Array of AgentTask objects with balanced provider assignments
 */
export function expandSwarm(
    tasks: { path: string, role?: string, customPrompt?: string, requestedStrength?: string }[],
    allowedProviders?: string[]
): AgentTask[] {
    const expandedTasks = tasks.map(t => {
        let prompt = t.customPrompt;
        const requiredStrength = resolveRequiredStrength(t.role, t.requestedStrength);

        // If the agent requested a dynamic role that doesn't exist in roles.json, and didn't provide a custom prompt,
        // we can dynamically build one right here so it doesn't crash.
        if (!prompt && t.role) {
            const humanRole = t.role.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
            prompt = `You are a ${humanRole}. Analyze the provided code and context based on your expertise. Output only strict JSON.`;
        }

        if (!prompt) {
            prompt = `You are an expert AI software engineer. Analyze the provided code and fulfill the task objectives. Output only strict JSON.`;
        }

        // HARD JSON ENFORCEMENT
        // Ensure absolutely every single agent is subjected to brutal JSON-only constraints.
        // Even if Antigravity hallucinates a bad custom prompt, this acts as the final guard.
        if (!prompt.includes("CRITICAL: Output ONLY valid, parsable JSON")) {
            prompt += `\n\nCRITICAL: Output ONLY valid, parsable JSON. Do not include markdown code block backticks (\`\`\`) or any conversational text. ` +
                `\nYou MUST return a JSON Array of objects strictly matching this schema:` +
                `\n[{` +
                `\n  "type": "string (e.g., 'vulnerability', 'task', 'insight')",` +
                `\n  "description": "string (Detailed explanation)",` +
                `\n  "severity": "string ('low', 'medium', 'high', 'critical') or null",` +
                `\n  "location": "string (file path/line) or null"` +
                `\n}]`;
        }

        return {
            filePath: t.path,
            role: t.role || 'custom',
            requiredStrength,
            prompt,
            customPrompt: t.customPrompt
        };
    });

    // Group tasks by role+strength to keep assignment deterministic
    const tasksByGroup = expandedTasks.reduce((groups: Record<string, any[]>, task) => {
        const groupKey = `${task.role || 'custom'}|${task.requiredStrength}`;
        if (!groups[groupKey]) {
            groups[groupKey] = [];
        }
        groups[groupKey].push(task);
        return groups;
    }, {});

    // For each role, resolve candidates and distribute across providers
    const finalTasks: AgentTask[] = [];

    for (const [groupKey, roleTasks] of Object.entries(tasksByGroup)) {
        const [role, strength] = groupKey.split('|');
        let resolved;
        try {
            resolved = resolveCandidates(strength);
        } catch (err: any) {
            // Resolver throws if the required_strength mapping entirely fails
            throw new Error(`No model candidates for role "${role}" with strength "${strength}": ${err.message}`);
        }

        let { candidates, availableProviders } = resolved;

        // Apply real-time health filter if provided
        if (allowedProviders) {
            candidates = candidates.filter(c => allowedProviders.includes(c.provider));
            availableProviders = availableProviders.filter(p => allowedProviders.includes(p));
        }

        if (candidates.length === 0) {
            throw new Error(`No available healthy provider found for role: ${role} (strength: ${strength})`);
        }

        // Distribute tasks across available providers
        roleTasks.forEach((task: AgentTask, index: number) => {
            const providerIndex = index % availableProviders.length;
            const selectedProvider = availableProviders[providerIndex];
            const selectedCandidate = candidates.find(c => c.provider === selectedProvider);

            if (selectedCandidate) {
                finalTasks.push({
                    ...task,
                    assignedProvider: selectedProvider,
                    assignedModel: selectedCandidate.modelString
                });
            } else {
                // Fallback to first available candidate (should rarely happen given availableProviders derivation)
                const fallbackCandidate = candidates[0];
                finalTasks.push({
                    ...task,
                    assignedProvider: fallbackCandidate.provider,
                    assignedModel: fallbackCandidate.modelString
                });
            }
        });
    }

    return finalTasks;
}
