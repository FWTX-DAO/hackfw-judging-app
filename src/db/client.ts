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
//
// IMPORTANT — multi-machine caveat: this app uses an in-process Set of
// WebSocket clients (src/realtime/ws.ts) for live broadcasts. If you scale
// past ONE machine (Fly.toml currently pins to one via single-volume), each
// machine has its own broadcast set, so a score submitted to machine A is
// only pushed to clients connected to machine A. To run multi-machine,
// you'd need to:
//   1. enable TURSO_SYNC_URL so writes are visible cross-machine, AND
//   2. replace the in-process broadcast Set with a shared event bus
//      (Redis pub/sub, NATS, libSQL change feed, etc.) so events fan out.
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
