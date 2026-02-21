import "dotenv/config";
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { orchestrate } from './orchestrator.js';

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
    server.tool(
        'spawn_parallel_agents',
        {
            role: z.string().describe('The role (ID) from roles.json to apply to the swarm'),
            diff_chunks: z.array(z.object({
                path: z.string().describe('Absolute or relative path to the file')
            })).max(15).describe('Mapping of files to be analyzed by subagents (max 15)')
        },
        async ({ role, diff_chunks }) => {
            try {
                const results = await orchestrate(diff_chunks as { path: string }[], role);
                return {
                    content: [{ type: 'text' as const, text: JSON.stringify(results, null, 2) }]
                };
            } catch (error) {
                return {
                    content: [{ type: 'text' as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
                    isError: true
                };
            }
        }
    );
}

/**
 * Main entry point to run the server on stdio.
 */
export async function runServer() {
    const server = createMcpServer();
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('MCP Hive server running on stdio');
}
