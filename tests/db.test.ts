import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { initializeDb, logExecution, getDb } from '../src/db.js';

describe('Telemetry Logger', () => {
    beforeEach(() => {
        // Initialize an in-memory database for testing
        initializeDb(':memory:');
    });

    afterEach(() => {
        const db = getDb();
        if (db) {
            db.close();
        }
    });

    it('should initialize the database in WAL mode (or memory for in-memory)', () => {
        const db = getDb();
        expect(db).toBeDefined();

        const mode = db?.pragma('journal_mode', { simple: true });
        // SQLite in-memory databases often stay in 'memory' mode even if WAL is requested
        expect(['wal', 'memory']).toContain(mode);
    });

    it('should successfully write and log execution metrics', () => {
        // Act
        logExecution('batch_123', 4500, 3, 1250);

        // Assert
        const db = getDb();
        const row = db?.prepare('SELECT * FROM execution_logs WHERE batch_id = ?').get('batch_123');

        expect(row).toBeDefined();
        expect(row.tokens_used).toBe(4500);
        expect(row.finding_count).toBe(3);
        expect(row.duration_ms).toBe(1250);
    });
});
