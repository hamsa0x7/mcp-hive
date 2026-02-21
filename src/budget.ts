import fs from 'fs';
import { AgentTask } from './routing.js';

export interface BudgetResult {
    allowed: boolean;
    estimatedTokens: number;
    reason?: string;
}

/**
 * Estimates the token budget needed for a batch of tasks and checks it against a limit.
 * 
 * @param tasks - The list of agent tasks to evaluate
 * @param maxTokens - The maximum token limit for the batch
 * @returns BudgetResult indicating if the batch is allowed and the estimated token count
 */
export function checkBatchBudget(tasks: AgentTask[], maxTokens: number): BudgetResult {
    let totalTokens = 0;

    for (const task of tasks) {
        if (fs.existsSync(task.filePath)) {
            try {
                const content = fs.readFileSync(task.filePath, 'utf-8');
                // Heuristic: 4 characters per token
                totalTokens += Math.ceil(content.length / 4);
            } catch (error) {
                // If file can't be read, we skip its token count contribution
            }
        }
    }

    if (totalTokens > maxTokens) {
        return {
            allowed: false,
            estimatedTokens: totalTokens,
            reason: `Batch estimation of ${totalTokens} tokens exceeds limit of ${maxTokens}`
        };
    }

    return {
        allowed: true,
        estimatedTokens: totalTokens
    };
}
