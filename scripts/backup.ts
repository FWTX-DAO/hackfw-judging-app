import { Database } from "bun:sqlite";
import { chmodSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const source = resolve(process.env.DB_FILE || "data/hackathon.db");
const destination = process.argv[2] && resolve(process.argv[2]);
if (!destination || destination === source || existsSync(destination)) throw new Error("Provide a new backup path: bun run backup /safe/path/snapshot.db");
if (!existsSync(source)) throw new Error("Source DB_FILE does not exist");
mkdirSync(dirname(destination), { recursive: true, mode: 0o700 });
process.umask(0o077);
const db = new Database(source, { readonly: true });
try {
  db.exec("PRAGMA busy_timeout = 10000");
  // VACUUM INTO produces a consistent standalone snapshot, including committed WAL data.
  db.query("VACUUM INTO ?").run(destination);
} finally { db.close(); }
chmodSync(destination, 0o600);
const snapshot = new Database(destination, { readonly: true });
try {
  const integrity = snapshot.query("PRAGMA integrity_check").all() as { integrity_check: string }[];
  if (integrity.length !== 1 || integrity[0]?.integrity_check !== "ok") throw new Error("Backup integrity check failed");
  if (snapshot.query("PRAGMA foreign_key_check").all().length) throw new Error("Backup foreign-key check failed");
} finally { snapshot.close(); }
console.log(`Verified backup: ${destination}`);
