import { getRolePrompt } from './roles.js';

export interface AgentTask {
    filePath: string;
    role: string;
    prompt: string;
}

/**
 * Expands a list of files into a set of agent tasks for a given role.
 * 
 * @param files - Array of file paths to analyze
 * @param role - The role to assign to each agent
 * @returns Array of AgentTask objects
 * @throws Error if the role is not found in the registry
 */
export function expandRoles(files: string[], role: string): AgentTask[] {
    const prompt = getRolePrompt(role);

    if (!prompt) {
        throw new Error(`Role "${role}" not found in registry`);
    }

    return files.map(filePath => ({
        filePath,
        role,
        prompt
    }));
}
