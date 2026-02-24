import { logExecution } from './db.js';
import {
    getProviderConfig,
    ProviderConfig,
    ProviderName,
    buildProviderRequest,
    extractAssistantContent,
    extractTokenUsage
} from './providers.js';
import { PER_ATTEMPT_TIMEOUT_MS, FindingsArraySchema } from './types.js';
import { repairJson, structuralRepair } from './repair.js';

const MAX_OUTPUT_TOKENS = parseInt(process.env.MAX_OUTPUT_TOKENS || '1200');

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
    model: string,
    isReasoning: boolean
): Promise<any> {
    const request = buildProviderRequest(config, systemPrompt, userPrompt, model, MAX_OUTPUT_TOKENS);
    const controller = new AbortController();
    const timeoutMs = isReasoning ? 120_000 : PER_ATTEMPT_TIMEOUT_MS;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(request.url, {
            method: request.method,
            headers: request.headers,
            body: request.body ? JSON.stringify(request.body) : undefined,
            signal: controller.signal
        });

        if (!response.ok) {
            let providerCode: string | undefined = undefined;
            try {
                const errorPayload = await response.json() as any;
                providerCode = errorPayload?.error?.type || errorPayload?.error?.code || errorPayload?.code;
            } catch (_err) {
                // Best-effort extraction only
            }
            throw new ModelCallError(
                `HTTP ${response.status} from ${config.name}/${model}`,
                response.status,
                providerCode
            );
        }

        const data: any = await response.json();
        return data;
    } catch (err: any) {
        if (err instanceof ModelCallError) throw err;

        // AbortController timeout or network error
        if (err.name === 'AbortError') {
            const abortErr = new ModelCallError(`Timeout after ${timeoutMs}ms on ${config.name}/${model}`, 0, 'ABORT_ERR');
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
 * Does NOT retry  retry logic lives in executeAgent().
 * Throws ModelCallError on any failure for the caller to classify.
 */
export async function callModel(
    batchId: string,
    systemPrompt: string,
    userPrompt: string,
    providerName: ProviderName,
    modelString: string,
    isReasoning: boolean = false
): Promise<any> {
    const config = getProviderConfig(providerName);
    const start = Date.now();

    const data = await executeRequest(config, systemPrompt, userPrompt, modelString, isReasoning);

    const durationMs = Date.now() - start;
    const content = extractAssistantContent(config, data);

    let parsedResult: any;
    let findingsCount = 0;

    let preParsed: any;
    try {
        preParsed = JSON.parse(content);
    } catch {
        // Tier 1 Repair: Syntax/Markdown Patch
        const repaired = repairJson(content);
        try {
            preParsed = JSON.parse(repaired);
        } catch {
            throw new ModelCallError('JSON Structure was fundamentally invalid and unrepairable by local engine.', 422, 'VALIDATION_ERROR');
        }
    }

    // Tier 2 Repair: Structural coercion
    const coerced = structuralRepair(preParsed);
    const validationResult = FindingsArraySchema.safeParse(coerced);

    if (!validationResult.success) {
        throw new ModelCallError(`JSON Structure violated schema: ${validationResult.error.message}`, 422, 'VALIDATION_ERROR');
    }

    parsedResult = validationResult.data;
    findingsCount = parsedResult.length;

    const usage = extractTokenUsage(config, data);
    const tokens = usage.promptTokens + usage.completionTokens;
    logExecution(batchId, tokens, findingsCount, durationMs);

    return parsedResult;
}
