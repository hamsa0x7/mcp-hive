import { describe, it, expect, vi, beforeEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { setupHandlers } from '../src/server.js';
import * as orchestrator from '../src/orchestrator.js';

describe('MCP Tool Registration (hive_swarm)', () => {
    let server: McpServer;

    beforeEach(() => {
        vi.restoreAllMocks();
        server = new McpServer({ name: 'mcp-hive', version: '1.0.0' });
        // Mock the tool method to capture the handler
        vi.spyOn(server, 'tool');
    });

    it('should register the hive_swarm tool', async () => {
        setupHandlers(server);

        expect(server.tool).toHaveBeenCalledWith(
            'hive_swarm',
            expect.any(String),
            expect.any(Object),
            expect.any(Function)
        );
    });

    it('should call the orchestrator when the tool handler is invoked', async () => {
        vi.spyOn(orchestrator, 'orchestrateSwarm').mockResolvedValue({
            total_agents: 1,
            successful: 1,
            exhausted: 0,
            fatal: 0,
            results: [{
                role: 'security_specialist',
                status: 'success' as const,
                provider: 'test',
                model: 'test-model',
                attempts: 1,
                latency_ms: 100,
                findings: [],
                overall_confidence: 0.8
            }],
            failed_roles: []
        });
        setupHandlers(server);

        // Extract the handler from the mock call
        const toolCall = (server.tool as any).mock.calls.find((call: any[]) => call[0] === 'hive_swarm');
        if (!toolCall || !toolCall[3] || typeof toolCall[3] !== 'function') {
            throw new Error('Handler not found or not a function');
        }
        const handler = toolCall[3];

        const result = await handler({
            tasks: [{ path: 'test.ts', role: 'security_specialist' }]
        });

        expect(orchestrator.orchestrateSwarm).toHaveBeenCalled();
        expect(result.content[0].text).toContain('success');
    });

    it('should forward workspace_root to orchestrator sandbox options', async () => {
        const spy = vi.spyOn(orchestrator, 'orchestrateSwarm').mockResolvedValue({
            total_agents: 0,
            successful: 0,
            exhausted: 0,
            fatal: 0,
            results: [],
            failed_roles: []
        });

        setupHandlers(server);
        const toolCall = (server.tool as any).mock.calls.find((call: any[]) => call[0] === 'hive_swarm');
        if (!toolCall || !toolCall[3] || typeof toolCall[3] !== 'function') {
            throw new Error('Handler not found or not a function');
        }
        const handler = toolCall[3];

        await handler({
            tasks: [{ path: 'test.ts', role: 'security_specialist' }],
            workspace_root: '/tmp/workspace'
        });

        expect(spy).toHaveBeenCalledWith(
            expect.any(Array),
            undefined,
            { workspaceRoot: '/tmp/workspace' }
        );
    });
});
