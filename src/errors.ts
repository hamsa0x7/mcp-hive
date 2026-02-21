/**
 * Error classification utilities for the MCP execution layer.
 *
 * These functions determine whether an error is transient (retryable)
 * or fatal (hard-stop), and categorize fatal errors for structured reporting.
 */

const RETRYABLE_STATUS_CODES = new Set([429, 503, 504]);
const RETRYABLE_ERROR_CODES = new Set(['ETIMEDOUT', 'ECONNRESET', 'UND_ERR_CONNECT_TIMEOUT', 'ABORT_ERR']);

/**
 * Determines if an error is transient and safe to retry.
 *
 * Retryable: 429 (rate limit), 503 (service unavailable), 504 (gateway timeout),
 *            network timeouts, connection resets, AbortController timeouts.
 *
 * NOT retryable: 400, 401, 403, 404, prompt errors, schema failures.
 */
export function isRetryableError(err: any): boolean {
    if (err?.status && RETRYABLE_STATUS_CODES.has(err.status)) return true;
    if (err?.code && RETRYABLE_ERROR_CODES.has(err.code)) return true;
    if (err?.name === 'AbortError') return true;
    return false;
}

/**
 * Classifies a non-retryable error into a machine-readable category.
 */
export function classifyError(err: any): string {
    const status = err?.status;
    if (status === 401 || status === 403) return 'invalid_api_key';
    if (status === 400) return 'invalid_request';
    if (status === 404) return 'model_not_found';
    if (status === 413) return 'prompt_too_large';
    return 'unknown_error';
}
