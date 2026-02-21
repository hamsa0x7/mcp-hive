#!/usr/bin/env node
import { runServer } from './server.js';

runServer().catch((err) => {
    console.error('Fatal: MCP Hive failed to start', err);
    process.exit(1);
});
