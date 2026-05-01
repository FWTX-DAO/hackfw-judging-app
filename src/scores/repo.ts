import { db } from "../db/client";
import type { Score } from "../db/types";

export async function getScore(projectId: number, judgeId: number): Promise<Score | null> {
  const r = await db.execute({
    sql: "SELECT * FROM scores WHERE project_id = ? AND judge_id = ? LIMIT 1",
    args: [projectId, judgeId],
  });
  if (r.rows.length === 0) return null;
  return r.rows[0] as unknown as Score;
}

export async function upsertScore(fields: {
  project_id: number;
  judge_id: number;
  technical_decisions: number;
  product_viability: number;
  venture_scalability: number;
  demo_uniqueness: number;
  reindustrialization_impact: number;
  notes?: string;
}): Promise<void> {
  const notes = fields.notes ?? "";
  // INSERT lets the column DEFAULT (datetime('now')) populate created_at +
  // updated_at. UPDATE on conflict only refreshes updated_at — created_at
  // preserves the first-seen timestamp for audit purposes.
  await db.execute({
    sql: `INSERT INTO scores (
            project_id, judge_id,
            technical_decisions, product_viability, venture_scalability,
            demo_uniqueness, reindustrialization_impact, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(project_id, judge_id) DO UPDATE SET
            technical_decisions = excluded.technical_decisions,
            product_viability = excluded.product_viability,
            venture_scalability = excluded.venture_scalability,
            demo_uniqueness = excluded.demo_uniqueness,
            reindustrialization_impact = excluded.reindustrialization_impact,
            notes = excluded.notes,
            updated_at = datetime('now')`,
    args: [
      fields.project_id,
      fields.judge_id,
      fields.technical_decisions,
      fields.product_viability,
      fields.venture_scalability,
      fields.demo_uniqueness,
      fields.reindustrialization_impact,
      notes,
    ],
  });
}

export async function listScoresByProject(projectId: number): Promise<Score[]> {
  const r = await db.execute({
    sql: "SELECT * FROM scores WHERE project_id = ?",
    args: [projectId],
  });
  return r.rows as unknown as Score[];
}

export async function listScoresByProjectDetailed(
  projectId: number
): Promise<(Score & { judge_name: string; judge_email: string })[]> {
  const r = await db.execute({
    sql: `SELECT s.*, j.name AS judge_name, j.email AS judge_email
          FROM scores s
          JOIN judges j ON j.id = s.judge_id
          WHERE s.project_id = ?
          ORDER BY j.name`,
    args: [projectId],
  });
  return r.rows as unknown as (Score & { judge_name: string; judge_email: string })[];
}

export async function listAllScores(): Promise<Score[]> {
  const r = await db.execute("SELECT * FROM scores");
  return r.rows as unknown as Score[];
}
