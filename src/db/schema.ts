import { db } from "./client";
import { DEFAULT_CRITERIA, SEED_JUDGES } from "./types";
import hackathonConfig from "../../hackathon.config";

export async function migrate() {
  await db.execute(`CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    team TEXT NOT NULL,
    github_url TEXT NOT NULL DEFAULT '',
    readme_url TEXT NOT NULL DEFAULT '',
    video_url TEXT NOT NULL DEFAULT '',
    devpost_url TEXT NOT NULL DEFAULT '',
    presenting INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  )`);

  await db.execute(`CREATE TABLE IF NOT EXISTS judges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    created_at TEXT DEFAULT (datetime('now'))
  )`);

  await db.execute(`CREATE TABLE IF NOT EXISTS scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    judge_id INTEGER NOT NULL REFERENCES judges(id) ON DELETE CASCADE,
    technical_decisions INTEGER NOT NULL CHECK(technical_decisions BETWEEN 1 AND 10),
    product_viability INTEGER NOT NULL CHECK(product_viability BETWEEN 1 AND 10),
    venture_scalability INTEGER NOT NULL CHECK(venture_scalability BETWEEN 1 AND 10),
    demo_uniqueness INTEGER NOT NULL CHECK(demo_uniqueness BETWEEN 1 AND 10),
    reindustrialization_impact INTEGER NOT NULL CHECK(reindustrialization_impact BETWEEN 1 AND 10),
    notes TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(project_id, judge_id)
  )`);

  await db.execute(`CREATE TABLE IF NOT EXISTS criteria_weights (
    key TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    description TEXT NOT NULL,
    weight REAL NOT NULL DEFAULT 20
  )`);

  // Legacy schema migration: drop stale tables if old criteria keys present
  const legacyCheck = await db.execute({
    sql: "SELECT key FROM criteria_weights WHERE key IN ('technical_readiness','novelty','tech_debt','design_patterns') LIMIT 1",
  });
  if (legacyCheck.rows.length > 0) {
    // Dump old scores/criteria — incompatible columns
    await db.execute("DROP TABLE IF EXISTS scores");
    await db.execute("DELETE FROM criteria_weights");
    await db.execute(`CREATE TABLE IF NOT EXISTS scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      judge_id INTEGER NOT NULL REFERENCES judges(id) ON DELETE CASCADE,
      technical_decisions INTEGER NOT NULL CHECK(technical_decisions BETWEEN 1 AND 10),
      product_viability INTEGER NOT NULL CHECK(product_viability BETWEEN 1 AND 10),
      venture_scalability INTEGER NOT NULL CHECK(venture_scalability BETWEEN 1 AND 10),
      demo_uniqueness INTEGER NOT NULL CHECK(demo_uniqueness BETWEEN 1 AND 10),
      reindustrialization_impact INTEGER NOT NULL CHECK(reindustrialization_impact BETWEEN 1 AND 10),
      notes TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(project_id, judge_id)
    )`);
  }

  // Backfill missing columns on older project rows (idempotent best-effort)
  await addColumnIfMissing("projects", "readme_url", "TEXT NOT NULL DEFAULT ''");
  await addColumnIfMissing("projects", "devpost_url", "TEXT NOT NULL DEFAULT ''");
  await addColumnIfMissing("projects", "presenting", "INTEGER NOT NULL DEFAULT 0");
}

async function addColumnIfMissing(table: string, column: string, def: string) {
  const info = await db.execute({ sql: `PRAGMA table_info(${table})` });
  const exists = info.rows.some((r: any) => r.name === column);
  if (!exists) {
    await db.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${def}`);
  }
}

export async function seed() {
  // Seed criteria from hackathon.config.ts (fall back to built-in defaults)
  const criteria = hackathonConfig.criteria?.length ? hackathonConfig.criteria : DEFAULT_CRITERIA;

  const weightRow = await db.execute("SELECT COUNT(*) as count FROM criteria_weights");
  const weightCount = Number((weightRow.rows[0] as any).count);
  if (weightCount === 0) {
    for (const c of criteria) {
      await db.execute({
        sql: "INSERT INTO criteria_weights (key, label, description, weight) VALUES (?, ?, ?, ?)",
        args: [c.key, c.label, c.description, c.weight],
      });
    }
  }

  // Seed authorized judges from hackathon.config.ts (idempotent).
  // The default config ships an empty list — admin onboards via the UI.
  const judges = hackathonConfig.judges ?? [];
  for (const j of judges) {
    await db.execute({
      sql: "INSERT OR IGNORE INTO judges (name, email) VALUES (?, ?)",
      args: [j.name, j.email.toLowerCase().trim()],
    });
  }
}
