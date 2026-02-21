import { describe, it, expect } from 'vitest';
import { isRetryableError, classifyError } from '../src/errors.js';

describe('Error Classification (isRetryableError)', () => {
    it('should classify 429 as retryable', () => {
        expect(isRetryableError({ status: 429 })).toBe(true);
    });

    it('should classify 503 as retryable', () => {
        expect(isRetryableError({ status: 503 })).toBe(true);
    });

    it('should classify 504 as retryable', () => {
        expect(isRetryableError({ status: 504 })).toBe(true);
    });

    it('should classify ETIMEDOUT as retryable', () => {
        expect(isRetryableError({ code: 'ETIMEDOUT' })).toBe(true);
    });

    it('should classify ECONNRESET as retryable', () => {
        expect(isRetryableError({ code: 'ECONNRESET' })).toBe(true);
    });

    it('should classify AbortError as retryable', () => {
        expect(isRetryableError({ name: 'AbortError' })).toBe(true);
    });

    it('should classify 400 as NOT retryable', () => {
        expect(isRetryableError({ status: 400 })).toBe(false);
    });

    it('should classify 401 as NOT retryable', () => {
        expect(isRetryableError({ status: 401 })).toBe(false);
    });

    it('should classify 404 as NOT retryable', () => {
        expect(isRetryableError({ status: 404 })).toBe(false);
    });
});

describe('Error Classification (classifyError)', () => {
    it('should classify 401 as invalid_api_key', () => {
        expect(classifyError({ status: 401 })).toBe('invalid_api_key');
    });

    it('should classify 403 as invalid_api_key', () => {
        expect(classifyError({ status: 403 })).toBe('invalid_api_key');
    });

    it('should classify 400 as invalid_request', () => {
        expect(classifyError({ status: 400 })).toBe('invalid_request');
    });

    it('should classify 404 as model_not_found', () => {
        expect(classifyError({ status: 404 })).toBe('model_not_found');
    });

    it('should classify 413 as prompt_too_large', () => {
        expect(classifyError({ status: 413 })).toBe('prompt_too_large');
    });

    it('should classify unknown status as unknown_error', () => {
        expect(classifyError({ status: 999 })).toBe('unknown_error');
    });
});
