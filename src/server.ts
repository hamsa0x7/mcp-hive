import dotenv from 'dotenv';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Route all console.log traffic to console.error to prevent JSON-RPC stdout corruption
const _log = console.log;
console.log = function (...args: any[]) {
    console.error(...args);
};

// Force dotenv to load from the project root rather than the IDE's execution cwd
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
(dotenv.config as any)({ path: resolve(__dirname, '../.env'), quiet: true });

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { orchestrate, orchestrateSwarm, harvestSwarm } from './orchestrator.js';
import { initializeDb } from './db.js';

/**
 * High-level MCP Server initialization.
 */
export function createMcpServer() {
    const server = new McpServer({
        name: 'mcp-hive',
        version: '1.0.0',
    });

    setupHandlers(server);
    return server;
}

/**
 * Registers tools and handlers for the server.
 */
export function setupHandlers(server: McpServer) {
    // 1. Swarm Tool (Asynchronous)
    server.tool(
        'hive_swarm',
        'Spawns a background swarm of parallel AI subagents to execute arbitrary tasks simultaneously.',
        {
            tasks: z.array(z.object({
                path: z.string().describe('Absolute or relative path to the file'),
                role: z.string().optional().describe('Optional: A brief title or name for the role (e.g., "security_auditor")'),
                custom_prompt: z.string().optional().describe('Optional: The highly specific, dynamic system prompt for the agent.'),
                requested_strength: z.string().optional().describe('Optional: Explicit model capability to route against (e.g., "security_detection").')
            })).max(15).describe('List of file-role pairs for the swarm'),
            workspace_root: z.string().optional().describe('Optional: Per-request workspace root for path sandboxing (Queen-managed).')
        },
        async ({ tasks, workspace_root }) => {
            try {
                const mappedTasks = tasks.map(t => ({
                    path: t.path,
                    role: t.role,
                    customPrompt: t.custom_prompt,
                    requestedStrength: t.requested_strength
                }));
                const results = await orchestrateSwarm(mappedTasks, undefined, {
                    workspaceRoot: workspace_root
                });
                return {
                    content: [{ type: 'text' as const, text: JSON.stringify(results, null, 2) }]
                };
            } catch (error: any) {
                const synthesizedBatch = {
                    swarm_id: 'error',
                    total_agents: tasks.length,
                    successful: 0,
                    exhausted: 0,
                    fatal: tasks.length,
                    results: tasks.map(t => ({
                        role: t.role || 'custom',
                        status: 'fatal_error' as const,
                        provider: 'none',
                        model: 'none',
                        error_type: 'orchestration_aborted',
                        message: error.message,
                        retryable: false as const,
                        findings: [{
                            type: 'queen_delegation',
                            description: `MCP pre-flight failed (${error.message}).`,
                            severity: 'critical',
                            location: null
                        }]
                    })),
                    failed_roles: tasks.map(t => t.role || 'custom')
                };

                return {
                    content: [{ type: 'text' as const, text: JSON.stringify(synthesizedBatch, null, 2) }]
                };
            }
        }
    );

    // 2. Harvest Tool
    server.tool(
        'hive_harvest',
        'Collects results from a previously launched background swarm.',
        {
            swarm_id: z.string().describe('The ID of the background swarm to harvest')
        },
        async ({ swarm_id }) => {
            try {
                const results = await harvestSwarm(swarm_id);
                return {
                    content: [{ type: 'text' as const, text: JSON.stringify(results, null, 2) }]
                };
            } catch (error: any) {
                return {
                    content: [{ type: 'text' as const, text: `Harvest Error: ${error.message}` }],
                    isError: true
                };
            }
        }
    );



    // 4. Post Insight Tool (Worker Collaboration)
    server.tool(
        'hive_post_insight',
        'Allows a Worker Bee to share a discovery or blocker with the rest of the swarm in real-time.',
        {
            swarm_id: z.string().describe('The active swarm ID'),
            task_id: z.string().optional().describe('The specific task ID being worked on'),
            type: z.enum(['discovery', 'deduplication', 'blocker', 'recommendation']),
            content: z.record(z.string(), z.any()).describe('The content of the insight'),
            source_agent: z.string().describe('The identifier of the reporting bee')
        },
        async (data) => {
            try {
                const result = await postInsight(data as any);
                return {
                    content: [{ type: 'text' as const, text: `Insight ${result.insight_id} posted to board.` }]
                };
            } catch (error: any) {
                return {
                    content: [{ type: 'text' as const, text: `Insight Error: ${error.message}` }],
                    isError: true
                };
            }
        }
    );

    // 5. Spawn Subtask Tool (Recursive Autonomy)
    server.tool(
        'hive_spawn_subtask',
        'Allows a Worker Bee to request a new specialized persona to handle a sub-problem discovered during analysis.',
        {
            swarm_id: z.string(),
            parent_task_id: z.string(),
            task_type: z.string().describe('The role needed (e.g. "sql_expert")'),
            context: z.record(z.string(), z.any()).describe('Context for the new specialist'),
            requested_strength: z.string().optional()
        },
        async (data) => {
            try {
                const result = await spawnSubtask(data as any);
                return {
                    content: [{ type: 'text' as const, text: `Subtask ${result.task_id} added to queue.` }]
                };
            } catch (error: any) {
                return {
                    content: [{ type: 'text' as const, text: `Spawn Error: ${error.message}` }],
                    isError: true
                };
            }
        }
    );
}

import { SwarmStore } from './store.js';
import { postInsight, spawnSubtask } from './worker_api.js';

/**
 * Main entry point to run the server on stdio.
 */
export async function runServer() {
    // Initialize database for telemetry and persistence
    const dbPath = process.env.DB_PATH || 'telemetry.db';
    initializeDb(dbPath);

    // Initialize the TTL "Reaper" (Hygiene)
    // Clears swarms older than 1 hour, runs once per hour.
    setInterval(() => {
        try {
            SwarmStore.cleanup();
        } catch (e) {
            console.error('Reaper Error:', e);
        }
    }, 60 * 60 * 1000);

    const server = createMcpServer();
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('MCP Hive server running on stdio');
}
