/**
 * Blazing-fast local JSON repair pass to salvage expensive LLM responses
 * that are subtly malformed or wrapped in markdown bloat.
 */
export function repairJson(raw: string): string {
    let content = raw.trim();

    // 1. Remove Markdown Wrappers (```json ... ``` or ``` ...)
    const mdRegex = /```(?:json)?\s*([\s\S]*?)\s*```/g;
    const match = mdRegex.exec(content);
    if (match && match[1]) {
        content = match[1].trim();
    } else {
        // Fallback: search for the first { or [ and last } or ]
        const firstBracket = content.indexOf('[');
        const firstBrace = content.indexOf('{');
        const start = (firstBracket !== -1 && (firstBrace === -1 || firstBracket < firstBrace)) ? firstBracket : firstBrace;

        if (start !== -1) {
            const lastBracket = content.lastIndexOf(']');
            const lastBrace = content.lastIndexOf('}');
            const end = Math.max(lastBracket, lastBrace);

            if (end > start) {
                content = content.substring(start, end + 1);
            }
        }
    }

    // 2. Fix Trailing Commas in arrays and objects
    // Match a comma followed by closing ] or }
    content = content.replace(/,\s*([\]}])/g, '$1');

    // 3. Handle truncated responses (very basic)
    // If it ends with a comma or open element, try to close it if it's simple
    // (This is risky, keeping it minimal for now)

    return content;
}

/**
 * Higher-level repair that attempts to coerce the structure into the expected schema.
 * e.g. wrapping a single object in an array.
 */
export function structuralRepair(parsed: any): any {
    // If the schema expects an array but we got a single object, wrap it
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        // Check if it looks like a finding object (duck typing)
        if ('type' in parsed || 'severity' in parsed) {
            return [parsed];
        }
    }

    return parsed;
}
