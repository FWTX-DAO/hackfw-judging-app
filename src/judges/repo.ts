import { db } from "../db/client";
import type { Judge } from "../db/types";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const generateJudgeCode = () => randomBytes(8).toString("hex");
const hashCode = (code: string) => createHash("sha256").update(code.trim().toLowerCase()).digest("hex");

export async function listJudges(): Promise<Judge[]> {
  const r = await db.execute("SELECT id, name, email, created_at FROM judges ORDER BY name");
  return r.rows as unknown as Judge[];
}

export async function addJudge(name: string, email: string, code = generateJudgeCode()): Promise<number> {
  const r = await db.execute({
    sql: "INSERT INTO judges (name, email, access_code_hash) VALUES (?, ?, ?)",
    args: [name.trim(), email.toLowerCase().trim(), hashCode(code)],
  });
  return Number(r.lastInsertRowid);
}

export async function deleteJudge(id: number): Promise<boolean> {
  const result = await db.execute({
    sql: "DELETE FROM judges WHERE id = ? AND NOT EXISTS (SELECT 1 FROM scores WHERE judge_id = judges.id)",
    args: [id],
  });
  return result.rowsAffected > 0;
}

export async function countJudges(): Promise<number> {
  const r = await db.execute("SELECT COUNT(*) AS c FROM judges");
  return Number((r.rows[0] as any).c);
}

export async function findJudgeByEmail(email: string): Promise<Judge | null> {
  const r = await db.execute({
    sql: "SELECT id, name, email, created_at FROM judges WHERE email = ? COLLATE NOCASE LIMIT 1",
    args: [email.toLowerCase().trim()],
  });
  if (r.rows.length === 0) return null;
  return r.rows[0] as unknown as Judge;
}

export async function authenticateJudge(email: string, code: string): Promise<(Judge & { session_version: number }) | null> {
  const result = await db.execute({ sql: "SELECT * FROM judges WHERE email = ? COLLATE NOCASE", args: [email.trim().toLowerCase()] });
  const row = result.rows[0];
  const expected = String(row?.access_code_hash ?? "0".repeat(64));
  const matches = timingSafeEqual(Buffer.from(hashCode(code)), Buffer.from(expected));
  if (!row?.access_code_hash || !matches) return null;
  return { id: Number(row.id), name: String(row.name), email: String(row.email), created_at: String(row.created_at), session_version: Number(row.session_version) };
}

export async function resetJudgeCode(id: number): Promise<string | null> {
  const code = generateJudgeCode();
  const result = await db.execute({
    sql: "UPDATE judges SET access_code_hash = ?, session_version = session_version + 1 WHERE id = ?",
    args: [hashCode(code), id],
  });
  return result.rowsAffected ? code : null;
}

export async function isCurrentJudge(id: number, email: string, version: number): Promise<boolean> {
  const result = await db.execute({ sql: "SELECT id FROM judges WHERE id = ? AND email = ? AND session_version = ?", args: [id, email, version] });
  return result.rows.length === 1;
}
