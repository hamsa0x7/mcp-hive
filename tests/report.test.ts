import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildAccelerationReport, getReportTheme } from '../src/report.js';

describe('Report (Structured Data)', () => {
    beforeEach(() => {
        delete process.env.HIVE_REPORT_STYLE;
    });

    // ─── Theme Resolution ────────────────────────────────────────────────────

    it('should default to clinical when HIVE_REPORT_STYLE is unset', () => {
        expect(getReportTheme()).toBe('clinical');
    });

    it('should return hive when HIVE_REPORT_STYLE=hive', () => {
        process.env.HIVE_REPORT_STYLE = 'hive';
        expect(getReportTheme()).toBe('hive');
    });

    it('should fall back to clinical on invalid value', () => {
        process.env.HIVE_REPORT_STYLE = 'neon';
        expect(getReportTheme()).toBe('clinical');
    });

    // ─── Structured Report ───────────────────────────────────────────────────

    it('should return structured data with clinical theme', () => {
        const report = buildAccelerationReport({
            agents: 5,
            sequential_ms: 18000,
            parallel_ms: 6000,
            speedup: 3,
            time_saved_ms: 12000,
            parallel_efficiency: 0.91
        });

        expect(report.theme).toBe('clinical');
        expect(report.agents).toBe(5);
        expect(report.sequential_ms).toBe(18000);
        expect(report.parallel_ms).toBe(6000);
        expect(report.speedup).toBe(3);
        expect(report.time_saved_ms).toBe(12000);
        expect(report.parallel_efficiency).toBe(0.91);
    });

    it('should return structured data with hive theme', () => {
        process.env.HIVE_REPORT_STYLE = 'hive';

        const report = buildAccelerationReport({
            agents: 5,
            sequential_ms: 18000,
            parallel_ms: 6000,
            speedup: 3,
            time_saved_ms: 12000,
            parallel_efficiency: 0.91
        });

        // Same fields — only theme changes
        expect(report.theme).toBe('hive');
        expect(report.agents).toBe(5);
        expect(report.sequential_ms).toBe(18000);
        expect(report.parallel_ms).toBe(6000);
        expect(report.speedup).toBe(3);
    });

    it('should keep field names stable regardless of theme', () => {
        const clinical = buildAccelerationReport({
            agents: 3, sequential_ms: 9000, parallel_ms: 3000,
            speedup: 3, time_saved_ms: 6000, parallel_efficiency: 0.95
        });

        process.env.HIVE_REPORT_STYLE = 'hive';
        const hive = buildAccelerationReport({
            agents: 3, sequential_ms: 9000, parallel_ms: 3000,
            speedup: 3, time_saved_ms: 6000, parallel_efficiency: 0.95
        });

        // Same keys, same values — only theme differs
        expect(Object.keys(clinical).sort()).toEqual(Object.keys(hive).sort());
        expect(clinical.agents).toBe(hive.agents);
        expect(clinical.speedup).toBe(hive.speedup);
        expect(clinical.theme).toBe('clinical');
        expect(hive.theme).toBe('hive');
    });
});
