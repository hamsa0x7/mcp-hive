import * as fs from 'fs';
import * as path from 'path';

const MAX_CONTEXT_TIMEOUT_MS = 2000;
const MAX_LINES_PER_SNIPPET = 40;

/**
 * Helper to wrap a promise with a timeout
 */
async function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
    let timer: NodeJS.Timeout;
    const timeoutPromise = new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(fallback), ms);
    });
    return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
}

/**
 * Resolves neighboring context by identifying local imports and extracting snippets (Asynchronous).
 * 
 * @param filePath - Path to the file being analyzed
 * @returns A formatted string containing context from imported files
 */
export async function resolveContext(filePath: string): Promise<string> {
    try {
        await fs.promises.access(filePath);
    } catch {
        return '';
    }

    const logicPromise = async () => {
        try {
            const content = await fs.promises.readFile(filePath, 'utf8');

            // Match relative imports (ESM style)
            const importRegex = /from\s+['"](\.\.?\/.*?)['"]/g;
            const matches = [...content.matchAll(importRegex)];

            if (matches.length === 0) return '';

            const baseDir = path.dirname(filePath);
            let contextOutput = '### Neighboring Context\n\n';
            const resolvedPaths = new Set<string>();

            // We can process these sequentially or parallelize the child lookups,
            // but since it's already running in parallel per-file at the orchestrator level,
            // sequential here is fine to avoid spiking too many file descriptors per file.
            for (const match of matches) {
                let relativePath = match[1];
                let targetPath = path.resolve(baseDir, relativePath);

                try {
                    await fs.promises.access(targetPath);
                } catch {
                    try { await fs.promises.access(targetPath + '.ts'); targetPath += '.ts'; }
                    catch {
                        try { await fs.promises.access(targetPath + '.js'); targetPath += '.js'; }
                        catch {
                            try { await fs.promises.access(targetPath + '.tsx'); targetPath += '.tsx'; }
                            catch { continue; }
                        }
                    }
                }

                if (resolvedPaths.has(targetPath) || targetPath === filePath) continue;
                resolvedPaths.add(targetPath);

                try {
                    const stats = await fs.promises.stat(targetPath);
                    if (stats.isFile()) {
                        const fileContent = await fs.promises.readFile(targetPath, 'utf8');
                        const snippet = fileContent.split('\n').slice(0, MAX_LINES_PER_SNIPPET).join('\n');

                        contextOutput += `File: ${path.basename(targetPath)}\n`;
                        contextOutput += `\`\`\`typescript\n${snippet}\n\`\`\`\n\n`;
                    }
                } catch (err) {
                    continue; // Skip failed child reads
                }
            }

            return resolvedPaths.size > 0 ? contextOutput : '';
        } catch (error) {
            console.error(`Error resolving context for ${filePath}:`, error);
            return '';
        }
    };

    return withTimeout(logicPromise(), MAX_CONTEXT_TIMEOUT_MS, '');
}
