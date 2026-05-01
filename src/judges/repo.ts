import { db } from "../db/client";
import type { Judge } from "../db/types";

export async function listJudges(): Promise<Judge[]> {
  const r = await db.execute("SELECT * FROM judges ORDER BY name");
  return r.rows as unknown as Judge[];
}

export async function addJudge(name: string, email: string): Promise<number> {
  const r = await db.execute({
    sql: "INSERT INTO judges (name, email) VALUES (?, ?)",
    args: [name.trim(), email.toLowerCase().trim()],
  });
  return Number(r.lastInsertRowid);
}

export async function deleteJudge(id: number): Promise<void> {
  await db.execute({
    sql: "DELETE FROM judges WHERE id = ?",
    args: [id],
  });
}

export async function countJudges(): Promise<number> {
  const r = await db.execute("SELECT COUNT(*) AS c FROM judges");
  return Number((r.rows[0] as any).c);
}

export async function authenticateJudge(email: string): Promise<Judge | null> {
  const r = await db.execute({
    sql: "SELECT * FROM judges WHERE email = ? COLLATE NOCASE LIMIT 1",
    args: [email.toLowerCase().trim()],
  });
  if (r.rows.length === 0) return null;
  return r.rows[0] as unknown as Judge;
}
