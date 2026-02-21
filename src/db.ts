import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import type { SwarmMetrics } from './telemetry.js';

let db: ReturnType<typeof Database> | null = null;

export function initializeDb(dbPath: string = ':memory:'): void {
  if (dbPath !== ':memory:') {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS execution_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id TEXT NOT NULL,
      tokens_used INTEGER NOT NULL,
      finding_count INTEGER NOT NULL,
      duration_ms INTEGER NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS swarm_metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      swarm_id TEXT NOT NULL,
      total_wall_time_ms INTEGER NOT NULL,
      decomposition_ms INTEGER NOT NULL,
      context_boost_ms INTEGER NOT NULL,
      dispatch_overhead_ms INTEGER NOT NULL,
      inference_wall_time_ms INTEGER NOT NULL,
      aggregation_ms INTEGER NOT NULL,
      max_agent_latency_ms INTEGER NOT NULL,
      parallel_efficiency REAL NOT NULL,
      total_retries INTEGER NOT NULL,
      provider_switches INTEGER NOT NULL,
      model_escalations INTEGER NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

export function logExecution(batchId: string, tokens: number, findings: number, durationMs: number): void {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDb first.');
  }

  const stmt = db.prepare(`
    INSERT INTO execution_logs (batch_id, tokens_used, finding_count, duration_ms)
    VALUES (?, ?, ?, ?)
  `);

  stmt.run(batchId, tokens, findings, durationMs);
}
export function logSwarmMetrics(metrics: SwarmMetrics): void {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDb first.');
  }

  const stmt = db.prepare(`
    INSERT INTO swarm_metrics (
      swarm_id, total_wall_time_ms, decomposition_ms, context_boost_ms,
      dispatch_overhead_ms, inference_wall_time_ms, aggregation_ms,
      max_agent_latency_ms, parallel_efficiency, total_retries,
      provider_switches, model_escalations
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    metrics.swarm_id,
    metrics.total_wall_time_ms,
    metrics.decomposition_ms,
    metrics.context_boost_ms,
    metrics.dispatch_overhead_ms,
    metrics.inference_wall_time_ms,
    metrics.aggregation_ms,
    metrics.max_agent_latency_ms,
    metrics.parallel_efficiency,
    metrics.total_retries,
    metrics.provider_switches,
    metrics.model_escalations
  );
}

export function getDb() {
  return db;
}
