import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { validateAndConfigure } from '../src/config.js';
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

    it('should throw error if fewer than 2 keys are provided', () => {
        fs.writeFileSync(tempEnvPath, 'OPENAI_API_KEY=sk-test\n');

        expect(() => validateAndConfigure()).toThrow(/Insufficient redundancy/);
    });

    it('should pass if 2 or more keys are provided', () => {
        fs.writeFileSync(tempEnvPath, 'OPENAI_API_KEY=sk-openai\nANTHROPIC_API_KEY=sk-ant\n');

        // Should not throw
        validateAndConfigure();
    });
});
