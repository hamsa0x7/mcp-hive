/**
 * Utility for fracturing large files into micro-chunks to saturate Hive concurrency.
 */
export interface FileChunk {
    filePath: string;
    content: string;
    startLine: number;
    endLine: number;
}

export function fractureFile(filePath: string, content: string, maxTokensPerChunk: number = 25000): FileChunk[] {
    const lines = content.split('\n');
    const chunks: FileChunk[] = [];

    // Heuristic: ~4 characters per token
    const maxChars = maxTokensPerChunk * 4;

    let currentLines: string[] = [];
    let currentChars = 0;
    let startLine = 1;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (currentChars + line.length > maxChars && currentLines.length > 0) {
            chunks.push({
                filePath,
                content: currentLines.join('\n'),
                startLine,
                endLine: i
            });

            // Overlap for context (last 5 lines)
            const overlap = currentLines.slice(-5);
            currentLines = [...overlap, line];
            currentChars = overlap.join('').length + line.length;
            startLine = Math.max(1, i - 4);
        } else {
            currentLines.push(line);
            currentChars += line.length;
        }
    }

    if (currentLines.length > 0) {
        chunks.push({
            filePath,
            content: currentLines.join('\n'),
            startLine,
            endLine: lines.length
        });
    }

    return chunks;
}
