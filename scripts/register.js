import fs from 'fs';
import path from 'path';
import os from 'os';

const configPath = path.join(os.homedir(), '.gemini', 'antigravity', 'mcp_config.json');
const currentDir = process.cwd();
const entryPoint = 'dist/index.js'; // Use relative entry point

console.log('🐝 Registering MCP Hive...');

try {
    if (!fs.existsSync(configPath)) {
        console.error(`❌ Antigravity config not found at: ${configPath}`);
        process.exit(1);
    }

    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

    if (!config.mcpServers) {
        config.mcpServers = {};
    }

    // Register with relative entry point and absolute CWD
    // This allows the command to be 'node dist/index.js' 
    // run from the project root.
    config.mcpServers.hive = {
        command: 'node',
        args: [entryPoint],
        cwd: currentDir,
        env: {
            NODE_OPTIONS: "--no-warnings"
        }
    };

    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

    console.log('✅ Success! MCP Hive is registered.');
    console.log(`📂 Working Directory: ${currentDir}`);
    console.log('💡 Restart Antigravity to apply.');
} catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
}
