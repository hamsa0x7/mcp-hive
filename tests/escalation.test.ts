import { describe, it, expect, vi, beforeEach } from 'vitest';
import { callModel, ModelCallError } from '../src/proxy.js';

vi.mock('../src/db.js', () => ({
    logExecution: vi.fn()
}));

describe('Proxy callModel — AbortController & Structured Errors', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        process.env.OPENAI_API_KEY = 'sk-test';
        process.env.MAX_OUTPUT_TOKENS = '1200';
    });

    it('should return parsed result on successful call', async () => {
        global.fetch = vi.fn().mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: () => Promise.resolve({
                choices: [{ message: { content: '{"status": "ok"}' } }],
                usage: { prompt_tokens: 10, completion_tokens: 20 }
            })
        });

        const result = await callModel('batch-1', 'sys', 'user', 'openai', 'gpt-4o');
        expect(result).toEqual({ status: 'ok' });
    });

    it('should throw ModelCallError with status on HTTP error', async () => {
        global.fetch = vi.fn().mockResolvedValueOnce({
            ok: false,
            status: 429
        });

        try {
            await callModel('batch-1', 'sys', 'user', 'openai', 'gpt-4o');
            expect.fail('Should have thrown');
        } catch (err: any) {
            expect(err).toBeInstanceOf(ModelCallError);
            expect(err.status).toBe(429);
        }
    });

    it('should throw ModelCallError with status 401 for unauthorized', async () => {
        global.fetch = vi.fn().mockResolvedValueOnce({
            ok: false,
            status: 401
        });

        try {
            await callModel('batch-1', 'sys', 'user', 'openai', 'gpt-4o');
            expect.fail('Should have thrown');
        } catch (err: any) {
            expect(err).toBeInstanceOf(ModelCallError);
            expect(err.status).toBe(401);
        }
    });

    it('should not retry internally (single call only)', async () => {
        const fetchSpy = vi.fn().mockResolvedValue({
            ok: false,
            status: 503
        });
        global.fetch = fetchSpy;

        try {
            await callModel('batch-1', 'sys', 'user', 'openai', 'gpt-4o');
        } catch {
            // expected
        }

        // callModel no longer retries — that's executeAgent's job
        expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
});
