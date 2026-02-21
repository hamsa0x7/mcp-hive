import fs from 'fs';
import path from 'path';
import { z } from 'zod';

const RoleSchema = z.record(z.string(), z.object({
    system_prompt: z.string(),
    required_strength: z.string().optional(),
    temperature: z.number().optional(),
    max_input_tokens: z.number().optional(),
    max_output_tokens: z.number().optional(),
    max_findings: z.number().optional(),
}));

type Roles = z.infer<typeof RoleSchema>;

let registry: Roles = {};

export function loadRoles(filePath: string): void {
    const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);

    if (!fs.existsSync(absolutePath)) {
        console.warn(`Role registry not found at ${absolutePath}`);
        registry = {};
        return;
    }

    const rawData = fs.readFileSync(absolutePath, 'utf-8');
    const jsonData = JSON.parse(rawData || '{}');

    // Validate with Zod
    const result = RoleSchema.safeParse(jsonData);

    if (!result.success) {
        throw new Error(`Invalid role registry format: ${result.error.message}`);
    }

    registry = result.data;
}

export function getRolePrompt(roleName: string): string | undefined {
    return registry[roleName]?.system_prompt;
}
