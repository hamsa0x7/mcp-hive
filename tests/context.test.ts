import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveContext } from '../src/context.js';
import * as fs from 'fs';

vi.mock('fs');

describe('Context Injection (resolveContext)', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('should identify local imports in a file', async () => {
        const mainFileContent = `
            import { utils } from './utils.js';
            import { Service } from '../services/api.js';
            import path from 'path'; // External, should be ignored
            
            console.log(utils);
        `;

        const utilsContent = `export function utils() { return "util"; }`;
        const serviceContent = `export class Service {}`;

        vi.spyOn(fs, 'readFileSync').mockImplementation((path: any) => {
            if (path.includes('main.ts')) return mainFileContent;
            if (path.includes('utils.js')) return utilsContent;
            if (path.includes('api.js')) return serviceContent;
            throw new Error('File not found');
        });

        vi.spyOn(fs, 'existsSync').mockReturnValue(true);
        vi.spyOn(fs, 'statSync').mockReturnValue({ isFile: () => true } as any);

        const context = await resolveContext('/absolute/path/main.ts');

        expect(context).toContain('utils.js');
        expect(context).toContain('api.js');
        expect(context).not.toContain('path'); // External
        expect(context).toContain('export function utils');
    });

    it('should return empty string if no local imports exist', async () => {
        vi.spyOn(fs, 'readFileSync').mockReturnValue('console.log("hello");');
        const context = await resolveContext('/absolute/path/main.ts');
        expect(context).toBe('');
    });
});
