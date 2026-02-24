import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { validateAndConfigure } from '../src/config.js';
import { getProviderDefinitions } from '../src/providers.js';
import fs from 'fs';
import path from 'path';

describe('Dynamic Configuration', () => {
    const tempEnvPath = path.join(process.cwd(), '.env');
    const backupEnvPath = path.join(process.cwd(), '.env.backup');

    beforeEach(() => {
        // Backup existing .env if it exists
        if (fs.existsSync(tempEnvPath)) {
            fs.renameSync(tempEnvPath, backupEnvPath);
        }

        const defs = getProviderDefinitions();
        for (const def of Object.values(defs)) {
            delete process.env[def.envKey];
            if (def.envBaseUrlKey) delete process.env[def.envBaseUrlKey];
            if (def.enabledFlagEnv) delete process.env[def.enabledFlagEnv];
        }
        delete process.env.MIN_PROVIDER_KEYS;
    });

    afterEach(() => {
        // Restore .env
        if (fs.existsSync(tempEnvPath)) {
            fs.unlinkSync(tempEnvPath);
        }
        if (fs.existsSync(backupEnvPath)) {
            fs.renameSync(backupEnvPath, tempEnvPath);
        }
    });

    it('should throw error if fewer than required configured providers are present', () => {
        process.env.MIN_PROVIDER_KEYS = '2';
        process.env.OPENAI_API_KEY = 'sk-test';
        expect(() => validateAndConfigure()).toThrow(/Insufficient redundancy/);
    });

    it('should pass when minimum configured providers is met', () => {
        process.env.MIN_PROVIDER_KEYS = '2';
        process.env.OPENAI_API_KEY = 'sk-openai';
        process.env.ANTHROPIC_API_KEY = 'sk-ant';

        // Should not throw
        validateAndConfigure();
    });

    it('should pass with a single provider by default', () => {
        process.env.OPENAI_API_KEY = 'sk-openai';
        validateAndConfigure();
    });
});
