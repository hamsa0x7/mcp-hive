import * as fs from 'fs';
import * as path from 'path';

/**
 * Resolves neighboring context by identifying local imports and extracting snippets.
 * 
 * @param filePath - Path to the file being analyzed
 * @returns A formatted string containing context from imported files
 */
export async function resolveContext(filePath: string): Promise<string> {
    if (!fs.existsSync(filePath)) return '';

    try {
        const content = fs.readFileSync(filePath, 'utf8');

        // Match relative imports (ESM style)
        // matches things like: import { x } from './y'; or import x from '../z';
        const importRegex = /from\s+['"](\.\.?\/.*?)['"]/g;
        const matches = [...content.matchAll(importRegex)];

        if (matches.length === 0) return '';

        const baseDir = path.dirname(filePath);
        let contextOutput = '### Neighboring Context\n\n';
        const resolvedPaths = new Set<string>();

        for (const match of matches) {
            let relativePath = match[1];

            // Basic extension resolving (.js, .ts)
            let targetPath = path.resolve(baseDir, relativePath);

            if (!fs.existsSync(targetPath)) {
                if (fs.existsSync(targetPath + '.ts')) targetPath += '.ts';
                else if (fs.existsSync(targetPath + '.js')) targetPath += '.js';
                else if (fs.existsSync(targetPath + '.tsx')) targetPath += '.tsx';
                else continue;
            }

            // Avoid duplicates and self-imports
            if (resolvedPaths.has(targetPath) || targetPath === filePath) continue;
            resolvedPaths.add(targetPath);

            const stats = fs.statSync(targetPath);
            if (stats.isFile()) {
                const fileContent = fs.readFileSync(targetPath, 'utf8');
                // Extract the first 40 lines of the imported file to avoid bloating context
                const snippet = fileContent.split('\n').slice(0, 40).join('\n');

                contextOutput += `File: ${path.basename(targetPath)}\n`;
                contextOutput += `\`\`\`typescript\n${snippet}\n\`\`\`\n\n`;
            }
        }

        return resolvedPaths.size > 0 ? contextOutput : '';
    } catch (error) {
        console.error(`Error resolving context for ${filePath}:`, error);
        return '';
    }
}
