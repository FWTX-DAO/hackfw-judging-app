import { existsSync } from "node:fs";
import { isAbsolute, join } from "node:path";

export const isProd = process.env.NODE_ENV === "production";
export const DIST_DIR = join(import.meta.dir, "..", "..", "dist");

if (isProd) {
  const problems: string[] = [];
  const secret = process.env.SESSION_SECRET?.trim() ?? "";
  const pin = process.env.ADMIN_PIN?.trim() ?? "";
  if (secret.length < 32 || secret === "hackfw-dev-secret-do-not-use-in-prod") problems.push("SESSION_SECRET must be a random value of at least 32 characters");
  if (pin.length < 12 || pin === "hackfw2026") problems.push("ADMIN_PIN must be a random value of at least 12 characters");
  if (!process.env.DB_FILE || !isAbsolute(process.env.DB_FILE)) problems.push("DB_FILE must be an absolute path on persistent storage");
  if (!existsSync(join(DIST_DIR, "index.html"))) problems.push("Built frontend missing; run bun run build");
  if (problems.length) throw new Error(`REFUSING TO START: ${problems.join("; ")}`);
}
