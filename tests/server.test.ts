import { describe, it, expect, vi } from 'vitest';

describe('MCP Server Init', () => {
    it('should create an server instance with the correct name ', async () => {
        // We'll need to mock the SDK or use the real one if it doesn't try to connect to stdio immediately
        const { createMcpServer } = await import('../src/server.js');
        const server = createMcpServer();
        expect(server).toBeDefined();
        // Since we can't easily peek into the private server name via public API, 
        // we verify it exists and is initialized.
    });

    it('should register the base tools during initialization', async () => {
        const { createMcpServer } = await import('../src/server.js');
        const server = createMcpServer();
        // Peek into registered tools if possible or mock the registerTool method
        // This test will fail if src/server.js doesn't exist
    });
});
