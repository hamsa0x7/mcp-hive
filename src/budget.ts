import fs from 'fs';
import { AgentTask } from './routing.js';

export interface BudgetResult {
    allowed: boolean;
    estimatedTokens: number;
    reason?: string;
}

const SAFETY_HEADROOM_MULTIPLIER = 1.25;
const MAX_TOKENS_PER_AGENT = 32000; // Hard cap per file context to prevent HTTP 413 Payload Too Large

/**
 * Heuristic density mapping by provider tokenizer.
 */
export function estimateTokens(content: string, provider?: string): number {
    const chars = content.length;
    if (provider === 'anthropic') return Math.ceil(chars / 3.5);
    if (provider === 'ollama' || provider === 'lmstudio') return Math.ceil(chars / 4.2);
    return Math.ceil(chars / 4.0); // OpenAI / Default
}

/**
 * Estimates the token budget needed for a batch of tasks and checks it against a limit.
 * Implements a strict +25% headroom buffer and a 32,000 token hard cap per individual agent.
 * 
 * @param tasks - The list of agent tasks to evaluate
 * @param providerCount - Number of available providers to spread load across
 * @param thresholdPerProvider - Default 100k per provider
 * @returns BudgetResult indicating if the batch is allowed and the estimated token count
 */
export function checkBatchBudget(tasks: AgentTask[], providerCount: number, thresholdPerProvider: number = 100000): BudgetResult {
    let totalTokens = 0;
    const maxCapacity = providerCount * thresholdPerProvider;

    for (const task of tasks) {
        if (fs.existsSync(task.filePath)) {
            try {
                const content = fs.readFileSync(task.filePath, 'utf-8');
                const agentBaseTokens = estimateTokens(content, task.assignedProvider);
                const agentTokensWithHeadroom = agentBaseTokens * SAFETY_HEADROOM_MULTIPLIER;

                if (agentTokensWithHeadroom > MAX_TOKENS_PER_AGENT) {
                    return {
                        allowed: false,
                        estimatedTokens: totalTokens + agentTokensWithHeadroom,
                        reason: `Single task (${task.filePath}) requires ~${Math.ceil(agentTokensWithHeadroom)} tokens (with headroom), exceeding maximum hard cap of ${MAX_TOKENS_PER_AGENT} tokens per agent.`
                    };
                }

                totalTokens += agentTokensWithHeadroom;
            } catch (error) {
                // If file can't be read, we skip
            }
        }
    }

    if (totalTokens > maxCapacity) {
        return {
            allowed: false,
            estimatedTokens: Math.ceil(totalTokens),
            reason: `Batch estimation of ${Math.ceil(totalTokens)} tokens (including +25% headroom) exceeds dynamic capacity of ${maxCapacity} across ${providerCount} providers.`
        };
    }

    return {
        allowed: true,
        estimatedTokens: Math.ceil(totalTokens)
    };
}
