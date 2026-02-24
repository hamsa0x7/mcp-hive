import * as path from 'path';
import { fileURLToPath } from 'url';
import * as fs from 'fs';
import { initializeDb, closeDb } from '../src/db.js';
import { validateAndConfigure } from '../src/config.js';
import { orchestrateSwarm, harvestSwarm } from '../src/orchestrator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function runRealtimeTest() {
    console.log("=== STARTING REAL-TIME HIVE TEST ===");

    try {
        const providers = validateAndConfigure();
        console.log(`[Config] Available providers: ${providers.join(', ')}`);

        const dbPath = path.resolve(__dirname, 'test_hive.db');
        try { fs.unlinkSync(dbPath) } catch (e) { }
        try { fs.unlinkSync(dbPath + '-wal') } catch (e) { }
        try { fs.unlinkSync(dbPath + '-shm') } catch (e) { }

        initializeDb(dbPath);
        console.log(`[DB] Initialize SQLite shared board at ${dbPath}`);

        const packageJsonPath = path.resolve(__dirname, '../package.json');

        const tasks = [
            { path: packageJsonPath, role: 'security_auditor', customPrompt: 'Analyze this package.json for any outdated dependencies or known vulnerabilities. You must return valid JSON matching the exact expected format.' },
            { path: packageJsonPath, role: 'linter', customPrompt: 'Check this package.json for missing standard fields like author or license. You must return valid JSON matching the exact expected format.' }
        ];

        console.log(`[Swarm] Dispatching ${tasks.length} tasks in background...`);
        const batchId = 'realtime-test-' + Date.now();
        const initialBatch = await orchestrateSwarm(tasks, batchId);

        console.log(`[Swarm] Background process initiated (ID: ${batchId}). Waiting for completion...`);

        // Poll for completion
        let result: any = { status: 'processing' };
        let polls = 0;

        while (result.status === 'processing' && polls < 30) {
            await sleep(2000);
            result = await harvestSwarm(batchId);
            process.stdout.write(".");
            polls++;
        }

        console.log("\n\n=== FINAL SWARM RESULTS ===");
        console.log(JSON.stringify(result, null, 2));

    } catch (err: any) {
        console.error("\n[CRITICAL ERROR] The test crashed entirely.");
        console.error(err);
    } finally {
        console.log("\n[DB] Closing connection...");
        // Give background promises a tiny bit of time to settle if crash occurred
        await sleep(500);
        closeDb();
    }
}

runRealtimeTest();
