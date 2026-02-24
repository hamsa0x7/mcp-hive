import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const configPath = path.join(os.homedir(), '.gemini', 'antigravity', 'mcp_config.json');
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const installRoot = path.resolve(__dirname, '..');
const entryPoint = path.resolve(installRoot, 'dist', 'index.js');

const PROVIDER_KEY_FIELDS = [
    'OPENAI_API_KEY',
    'ANTHROPIC_API_KEY',
    'GOOGLE_API_KEY',
    'OPENROUTER_API_KEY',
    'GROQ_API_KEY',
    'TOGETHER_API_KEY',
    'MISTRAL_API_KEY',
    'FIREWORKS_API_KEY',
    'COHERE_API_KEY',
    'XAI_API_KEY',
    'PERPLEXITY_API_KEY',
    'DEEPINFRA_API_KEY',
    'CEREBRAS_API_KEY',
    'SAMBANOVA_API_KEY',
    'NVIDIA_API_KEY',
    'NOVITA_API_KEY',
    'HYPERBOLIC_API_KEY',
    'AZURE_OPENAI_API_KEY',
    'LLM7_API_KEY',
    'OLLAMA_API_KEY'
];

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

    const previousHive = (config.mcpServers.hive && typeof config.mcpServers.hive === 'object')
        ? config.mcpServers.hive
        : {};
    const previousEnv = (previousHive.env && typeof previousHive.env === 'object')
        ? previousHive.env
        : {};

    const env = {
        ...previousEnv,
        NODE_OPTIONS: previousEnv.NODE_OPTIONS || '--no-warnings',
        HIVE_ALLOWLIST_ROOT: installRoot
    };

    for (const key of PROVIDER_KEY_FIELDS) {
        if (!env[key]) {
            env[key] = `<${key}>`;
        }
    }

    // Installer-managed runtime paths: users only fill key values.
    config.mcpServers.hive = {
        command: 'node',
        args: [entryPoint],
        cwd: installRoot,
        env
    };

    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

    console.log('✅ Success! MCP Hive is registered.');
    console.log(`📂 Working Directory: ${installRoot}`);
    console.log(`🔒 Allowlist Root: ${installRoot}`);
    console.log('🧩 Next step: replace <..._API_KEY> placeholders with your real keys.');
    console.log('💡 Restart Antigravity to apply.');
} catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
}
