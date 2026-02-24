import path from 'path';
import fs from 'fs';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB hard limit for text/code chunks

export interface SecurityValidation {
    valid: boolean;
    reason?: string;
    normalizedPath?: string;
}

function getAllowlistRoot(overrideRoot?: string): string {
    const rawRoot = (overrideRoot || process.env.HIVE_ALLOWLIST_ROOT || process.cwd()).trim();
    return path.resolve(rawRoot);
}

function isPathInsideRoot(root: string, target: string): boolean {
    const relative = path.relative(root, target);
    return !(relative.startsWith('..') || path.isAbsolute(relative));
}

export function validateTaskPath(targetPath: string, workspaceRoot?: string): SecurityValidation {
    try {
        const allowlistRoot = getAllowlistRoot(workspaceRoot);
        const candidatePath = path.isAbsolute(targetPath)
            ? targetPath
            : path.resolve(allowlistRoot, targetPath);
        const normalized = path.resolve(candidatePath);

        // 1. Directory Traversal check
        // Check relative offset from the strict allowlist root
        if (!isPathInsideRoot(allowlistRoot, normalized)) {
            return { valid: false, reason: `Path escapes the allowed workspace root: ${allowlistRoot}` };
        }

        // 2. Existence verification
        if (!fs.existsSync(normalized)) {
            return { valid: false, reason: `File does not exist: ${normalized}` };
        }

        // 3. OS Stat check (preventing block devices or directory reads)
        const stat = fs.statSync(normalized);
        if (!stat.isFile()) {
            return { valid: false, reason: `Target is not a standard file: ${normalized}` };
        }

        // 4. Symlink escape protection (real target must stay in the same root)
        const realPath = fs.realpathSync(normalized);
        if (!isPathInsideRoot(allowlistRoot, realPath)) {
            return { valid: false, reason: `Symlink target escapes the allowed workspace root: ${allowlistRoot}` };
        }

        // 5. Memory/Size protection
        if (stat.size > MAX_FILE_SIZE_BYTES) {
            return { valid: false, reason: `File size ${stat.size} exceeds safety limit of ${MAX_FILE_SIZE_BYTES} bytes` };
        }

        return { valid: true, normalizedPath: normalized };
    } catch (e: any) {
        return { valid: false, reason: e.message || 'Unknown path validation error' };
    }
}
