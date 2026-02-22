import { getRolePrompt } from './roles.js';

export interface AgentTask {
    filePath: string;
    role: string;
    prompt: string;
    customPrompt?: string;
}

/**
 * Expands a list of file-role pairs into a set of agent tasks.
 * 
 * @param tasks - Array of objects with path, optional role, and optional customPrompt
 * @returns Array of AgentTask objects
 */
export function expandSwarm(tasks: { path: string, role?: string, customPrompt?: string }[]): AgentTask[] {
    return tasks.map(t => {
        const prompt = t.customPrompt || (t.role ? getRolePrompt(t.role) : undefined);
        if (!prompt) {
            throw new Error(`Task for "${t.path}" must provide either a valid "role" or a "customPrompt"`);
        }
        return {
            filePath: t.path,
            role: t.role || 'custom',
            prompt,
            customPrompt: t.customPrompt
        };
    });
}
