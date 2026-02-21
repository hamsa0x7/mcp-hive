// ─── Report Style ────────────────────────────────────────────────────────────

export type ReportTheme = 'clinical' | 'hive';

const ALLOWED_THEMES: ReportTheme[] = ['clinical', 'hive'];

/**
 * Resolves the report theme from HIVE_REPORT_STYLE env var.
 * Default: 'clinical'.
 */
export function getReportTheme(): ReportTheme {
    const raw = process.env.HIVE_REPORT_STYLE || '';
    return ALLOWED_THEMES.includes(raw as ReportTheme)
        ? (raw as ReportTheme)
        : 'clinical';
}

// ─── Structured Acceleration Report ──────────────────────────────────────────

/**
 * Stable, schema-safe acceleration report payload.
 * Field names never change — only `theme` tells Antigravity how to render.
 * Hive returns this object. Antigravity owns all display logic.
 */
export interface AccelerationReport {
    theme: ReportTheme;
    agents: number;
    sequential_ms: number;
    parallel_ms: number;
    speedup: number;
    time_saved_ms: number;
    parallel_efficiency: number;
}

/**
 * Builds the structured acceleration report.
 * Pure data — no formatting, no console output.
 */
export function buildAccelerationReport(data: {
    agents: number;
    sequential_ms: number;
    parallel_ms: number;
    speedup: number;
    time_saved_ms: number;
    parallel_efficiency: number;
}): AccelerationReport {
    return {
        theme: getReportTheme(),
        agents: data.agents,
        sequential_ms: data.sequential_ms,
        parallel_ms: data.parallel_ms,
        speedup: data.speedup,
        time_saved_ms: data.time_saved_ms,
        parallel_efficiency: data.parallel_efficiency
    };
}
