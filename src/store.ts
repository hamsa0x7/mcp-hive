import { Finding } from './types.js';

export interface SwarmResult {
    role: string;
    filePath: string;
    status: 'success' | 'exhausted' | 'fatal_error';
    findings: Finding[];
}

export interface SwarmState {
    id: string;
    status: 'processing' | 'completed' | 'failed';
    results: SwarmResult[];
    total_tasks: number;
    completed_tasks: number;
    delegated_tasks: any[]; // Queen-delegated tasks
    createdAt: number;
}

import { getDb } from './db.js';

/**
 * Persistence layer for asynchronous swarms.
 * Uses SQLite to ensure durability across server restarts.
 */
export const SwarmStore = {
    create(id: string, total_tasks: number, delegated_tasks: any[]): SwarmState {
        const db = getDb();
        if (!db) throw new Error('Database not initialized');

        // Auto-reap stale swarms on every new creation
        this.cleanup();

        const state: SwarmState = {
            id,
            status: 'processing',
            results: [],
            total_tasks,
            completed_tasks: 0,
            delegated_tasks,
            createdAt: Date.now()
        };

        const stmt = db.prepare(`
            INSERT INTO swarms (id, status, total_tasks, completed_tasks, delegated_tasks_json, results_json, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        stmt.run(
            id,
            state.status,
            state.total_tasks,
            state.completed_tasks,
            JSON.stringify(delegated_tasks),
            JSON.stringify([]),
            state.createdAt
        );

        return state;
    },

    get(id: string): SwarmState | undefined {
        const db = getDb();
        if (!db) return undefined;

        const row = db.prepare('SELECT * FROM swarms WHERE id = ?').get(id) as any;
        if (!row) return undefined;

        return {
            id: row.id,
            status: row.status as any,
            total_tasks: row.total_tasks,
            completed_tasks: row.completed_tasks,
            delegated_tasks: JSON.parse(row.delegated_tasks_json),
            results: JSON.parse(row.results_json),
            createdAt: row.created_at
        };
    },

    /**
     * Atomic append-and-increment. Avoids the O(n^2) read-modify-write race
     * by using a single SQL transaction with JSON concatenation.
     */
    updateTask(id: string, result: SwarmResult) {
        const db = getDb();
        if (!db) return;

        db.transaction(() => {
            // Atomically append the result and increment the counter
            db.prepare(`
                UPDATE swarms 
                SET results_json = json_insert(
                    results_json,
                    '$[#]',
                    json(?)
                ),
                completed_tasks = completed_tasks + 1
                WHERE id = ?
            `).run(JSON.stringify(result), id);

            // Check if all tasks are complete and update status
            const row = db.prepare('SELECT completed_tasks, total_tasks FROM swarms WHERE id = ?').get(id) as any;
            if (row && row.completed_tasks >= row.total_tasks) {
                db.prepare("UPDATE swarms SET status = 'completed' WHERE id = ?").run(id);
            }
        })();
    },

    failSwarm(id: string) {
        const db = getDb();
        if (!db) return;

        const stmt = db.prepare('UPDATE swarms SET status = ? WHERE id = ?');
        stmt.run('failed', id);
    },

    cleanup() {
        const db = getDb();
        if (!db) return;

        const oneHourAgo = Date.now() - (60 * 60 * 1000);
        const stmt = db.prepare('DELETE FROM swarms WHERE created_at < ?');
        stmt.run(oneHourAgo);
    }
};
