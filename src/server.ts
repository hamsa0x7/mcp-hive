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
        'hive_swarm',
        {
            tasks: z.array(z.object({
                path: z.string().describe('Absolute or relative path to the file'),
                role: z.string().optional().describe('Optional: Preset role ID (e.g., discovery_agent, security_specialist)'),
                custom_prompt: z.string().optional().describe('Optional: Custom system prompt to override/ignore the role registry')
            })).max(15).describe('List of file-role pairs for the swarm')
        },
        async ({ tasks }) => {
            try {
                const { orchestrateSwarm } = await import('./orchestrator.js');
                const mappedTasks = tasks.map(t => ({
                    path: t.path,
                    role: t.role,
                    customPrompt: t.custom_prompt
                }));
                const results = await orchestrateSwarm(mappedTasks);
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
