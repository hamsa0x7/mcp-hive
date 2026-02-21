import { logExecution } from './db.js';
import { getProviderConfig, ProviderConfig, ProviderName } from './providers.js';
import { PER_ATTEMPT_TIMEOUT_MS } from './types.js';

/**
 * Structured error thrown by callModel with HTTP status attached.
 * Allows isRetryableError/classifyError to inspect it.
 */
export class ModelCallError extends Error {
    status: number;
    code?: string;

    constructor(message: string, status: number, code?: string) {
        super(message);
        this.name = 'ModelCallError';
        this.status = status;
        this.code = code;
    }
}

/**
 * Core request executor with per-attempt AbortController timeout.
 */
async function executeRequest(
    config: ProviderConfig,
    systemPrompt: string,
    userPrompt: string,
    model: string
): Promise<any> {
    const url = `${config.baseUrl}/chat/completions`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PER_ATTEMPT_TIMEOUT_MS);

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.apiKey}`
            },
            body: JSON.stringify({
                model: model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                max_tokens: parseInt(process.env.MAX_OUTPUT_TOKENS || '1200')
            }),
            signal: controller.signal
        });

        if (!response.ok) {
            throw new ModelCallError(
                `HTTP ${response.status} from ${config.name}/${model}`,
                response.status
            );
        }

        const data: any = await response.json();
        return data;
    } catch (err: any) {
        if (err instanceof ModelCallError) throw err;

        // AbortController timeout or network error
        if (err.name === 'AbortError') {
            const abortErr = new ModelCallError(`Timeout after ${PER_ATTEMPT_TIMEOUT_MS}ms on ${config.name}/${model}`, 0, 'ABORT_ERR');
            abortErr.name = 'AbortError';
            throw abortErr;
        }

        // Network-level errors (ETIMEDOUT, ECONNRESET, etc.)
        throw new ModelCallError(
            err.message || 'Network error',
            0,
            err.code || 'UNKNOWN'
        );
    } finally {
        clearTimeout(timeout);
    }
}

/**
 * Single-candidate model executor.
 *
 * Executes one request against one provider/model pair.
 * Does NOT retry — retry logic lives in executeAgent().
 * Throws ModelCallError on any failure for the caller to classify.
 */
export async function callModel(
    batchId: string,
    systemPrompt: string,
    userPrompt: string,
    providerName: ProviderName,
    modelString: string
): Promise<any> {
    const config = getProviderConfig(providerName);
    const start = Date.now();

    const data = await executeRequest(config, systemPrompt, userPrompt, modelString);

    const durationMs = Date.now() - start;
    const content = data.choices?.[0]?.message?.content ?? '';

    let parsedResult: any;
    let findingsCount = 0;

    try {
        parsedResult = JSON.parse(content);
        findingsCount = Array.isArray(parsedResult) ? parsedResult.length : 0;
    } catch {
        parsedResult = content;
    }

    const tokens = (data.usage?.prompt_tokens || 0) + (data.usage?.completion_tokens || 0);
    logExecution(batchId, tokens, findingsCount, durationMs);

    return parsedResult;
}
