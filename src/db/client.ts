import { createClient, type Client } from "@libsql/client";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

// Default lives under ./data/ so the DB + WAL files stay together in one
// directory you can mount as a volume in production. Override with DB_FILE.
const DB_FILE = process.env.DB_FILE || "data/hackathon.db";

// Ensure the parent directory exists before libSQL opens the file.
try {
  mkdirSync(dirname(resolve(DB_FILE)), { recursive: true });
} catch {
  // Best-effort — libSQL will surface a clearer error if we truly can't write.
}

export const DB_PATH = resolve(DB_FILE);

// libSQL embedded replica: local file, optional Turso sync.
// If TURSO_SYNC_URL + TURSO_AUTH_TOKEN are set, the local file becomes an
// embedded replica that syncs with the remote Turso DB.
const syncUrl = process.env.TURSO_SYNC_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

export const db: Client = syncUrl
  ? createClient({
      url: `file:${DB_FILE}`,
      syncUrl,
      authToken,
      syncInterval: Number(process.env.TURSO_SYNC_INTERVAL || 60),
    })
  : createClient({ url: `file:${DB_FILE}` });

export async function initPragmas() {
  await db.execute("PRAGMA journal_mode = WAL");
  await db.execute("PRAGMA foreign_keys = ON");
}

/** Optional one-shot sync trigger (no-op without syncUrl). */
export async function syncNow() {
  if (!syncUrl) return;
  try {
    await db.sync();
  } catch (e) {
    console.error("libsql sync failed:", e);
  }
}
