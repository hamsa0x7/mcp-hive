import { z } from 'zod';
import { getDb } from './db.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Zod Schemas for the Worker Bee Cooperative Toolkit
 */

export const InsightTypeSchema = z.enum(['discovery', 'deduplication', 'blocker', 'recommendation']);

export const PostInsightSchema = z.object({
    swarm_id: z.string(),
    task_id: z.string().optional(),
    type: InsightTypeSchema,
    content: z.record(z.string(), z.any()),
    source_agent: z.string()
});

export const SpawnSubtaskSchema = z.object({
    swarm_id: z.string(),
    parent_task_id: z.string(),
    task_type: z.string(),
    context: z.record(z.string(), z.any()),
    requested_strength: z.string().optional()
});

/**
 * Implementation Handlers for the SQLite Shared Board
 */

export async function postInsight(data: z.infer<typeof PostInsightSchema>) {
    const db = getDb();
    if (!db) throw new Error('DB not initialized');

    const id = uuidv4();
    const now = Date.now();

    const stmt = db.prepare(`
    INSERT INTO hive_insights (id, swarm_id, task_id, insight_type, content_json, source_agent, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

    stmt.run(
        id,
        data.swarm_id,
        data.task_id || null,
        data.type,
        JSON.stringify(data.content),
        data.source_agent,
        now
    );

    return { insight_id: id };
}

export async function spawnSubtask(data: z.infer<typeof SpawnSubtaskSchema>) {
    const db = getDb();
    if (!db) throw new Error('DB not initialized');

    const id = uuidv4();
    const now = Date.now();

    const stmt = db.prepare(`
    INSERT INTO hive_board (id, swarm_id, task_type, context_json, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'pending', ?, ?)
  `);

    stmt.run(
        id,
        data.swarm_id,
        data.task_type,
        JSON.stringify({ ...data.context, parent_id: data.parent_task_id, requested_strength: data.requested_strength }),
        now,
        now
    );

    return { task_id: id };
}

/**
 * Allows a Worker Bee to see what others have found so far
 */
export async function getInsights(swarmId: string) {
    const db = getDb();
    if (!db) throw new Error('DB not initialized');

    const stmt = db.prepare(`
    SELECT insight_type, content_json, source_agent, created_at 
    FROM hive_insights 
    WHERE swarm_id = ? 
    ORDER BY created_at DESC
  `);

    const rows = stmt.all(swarmId);
    return rows.map((r: any) => ({
        ...r,
        content: JSON.parse(r.content_json)
    }));
}
