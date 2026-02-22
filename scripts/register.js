import fs from 'fs';
import path from 'path';
import os from 'os';

const configPath = path.join(os.homedir(), '.gemini', 'antigravity', 'mcp_config.json');
const currentDir = process.cwd();
const entryPoint = path.join(currentDir, 'dist', 'index.js');

console.log('🐝 Registering MCP Hive...');

try {
    if (!fs.existsSync(configPath)) {
        console.error(`❌ Antigravity config not found at: ${configPath}`);
        console.log('Please ensure Antigravity is installed and you have run it at least once.');
        process.exit(1);
    }

    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

    if (!config.mcpServers) {
        config.mcpServers = {};
    }

    // Add or update hive configuration
    config.mcpServers.hive = {
        command: 'node',
        args: [entryPoint],
        cwd: currentDir,
        env: {
            NODE_OPTIONS: "--no-warnings"
        }
    };

    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

    console.log('✅ Success! MCP Hive is now registered in your Antigravity config.');
    console.log(`📂 Location: ${currentDir}`);
    console.log('💡 Restart Antigravity to apply changes.');
} catch (error) {
    console.error('❌ Error during registration:', error.message);
    process.exit(1);
}
