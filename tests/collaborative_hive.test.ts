import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { initializeDb, getDb } from '../src/db.js';
import { postInsight, spawnSubtask, getInsights } from '../src/worker_api.js';
import { v4 as uuidv4 } from 'uuid';

describe('Collaborative Hive Reasoning', () => {
    const swarmId = 'test-swarm-' + Date.now();

    beforeEach(() => {
        initializeDb(':memory:');
        const db = getDb();
        // Create parent swarm record to satisfy FKs
        db?.prepare('INSERT INTO swarms (id, status, total_tasks, completed_tasks, delegated_tasks_json, results_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
            .run(swarmId, 'active', 0, 0, '[]', '[]', Date.now());
    });

    it('should allow agents to post and retrieve insights', async () => {
        await postInsight({
            swarm_id: swarmId,
            type: 'discovery',
            content: { note: 'Found an anomaly in the login flow' },
            source_agent: 'security_bee'
        });

        const insights = await getInsights(swarmId);
        expect(insights.length).toBe(1);
        expect(insights[0].insight_type).toBe('discovery');
        expect(insights[0].content.note).toContain('anomaly');
        expect(insights[0].source_agent).toBe('security_bee');
    });

    it('should allow agents to spawn autonomous subtasks', async () => {
        const taskId = uuidv4();
        const db = getDb();

        // Manual insertion of a task on the board to simulate an active job
        db?.prepare('INSERT INTO hive_board (id, swarm_id, task_type, context_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
            .run(taskId, swarmId, 'explorer', '{}', Date.now(), Date.now());

        const result = await spawnSubtask({
            swarm_id: swarmId,
            parent_task_id: taskId,
            task_type: 'sql_expert',
            context: { table: 'users', issue: 'Possible SQLi found' }
        });

        expect(result.task_id).toBeDefined();

        const board = db?.prepare("SELECT * FROM hive_board WHERE task_type = 'sql_expert'").get() as any;
        expect(board).toBeDefined();
        expect(board.swarm_id).toBe(swarmId);
        const ctx = JSON.parse(board.context_json);
        expect(ctx.parent_id).toBe(taskId);
        expect(ctx.table).toBe('users');
    });
});
