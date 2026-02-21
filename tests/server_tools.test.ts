import { describe, it, expect, vi, beforeEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { setupHandlers } from '../src/server.js';
import * as orchestrator from '../src/orchestrator.js';

describe('MCP Tool Registration (spawn_parallel_agents)', () => {
    let server: McpServer;

    beforeEach(() => {
        vi.restoreAllMocks();
        server = new McpServer({ name: 'mcp-hive', version: '1.0.0' });
        // Mock the tool method to capture the handler
        vi.spyOn(server, 'tool');
    });

    it('should register the spawn_parallel_agents tool', async () => {
        setupHandlers(server);

        expect(server.tool).toHaveBeenCalledWith(
            'spawn_parallel_agents',
            expect.any(Object),
            expect.any(Function)
        );
    });

    it('should call the orchestrator when the tool handler is invoked', async () => {
        vi.spyOn(orchestrator, 'orchestrate').mockResolvedValue({
            summary: { total_agents: 1, success_count: 1, error_count: 0 },
            results: [{ result: 'success' }]
        });
        setupHandlers(server);

        // Extract the handler from the mock call
        const toolCall = (server.tool as any).mock.calls.find((call: any[]) => call[0] === 'spawn_parallel_agents');
        const handler = toolCall[2];

        const result = await handler({
            role: 'security',
            diff_chunks: [{ path: 'test.ts' }]
        });

        expect(orchestrator.orchestrate).toHaveBeenCalledWith([{ path: 'test.ts' }], 'security');
        expect(result.content[0].text).toContain('success');
        expect(result.content[0].text).toContain('total_agents');
    });
});
