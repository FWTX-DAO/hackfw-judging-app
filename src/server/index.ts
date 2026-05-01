import { bootstrapDb, syncNow, DB_PATH } from "../db";
import { onOpen, onMessage, onClose } from "../realtime/ws";

import { routes as authRoutes } from "../auth/routes";
import { routes as judgeRoutes } from "../judges/routes";
import { routes as projectRoutes } from "../projects/routes";
import { routes as scoreRoutes } from "../scores/routes";
import { routes as criteriaRoutes } from "../criteria/routes";
import { routes as leaderboardRoutes } from "../leaderboard/routes";
import { routes as configRoutes } from "../config/routes";

import { join } from "node:path";
import { existsSync } from "node:fs";

const isProd = process.env.NODE_ENV === "production";

// In prod, refuse to boot with the dev defaults — those would let anyone with
// the source mint admin tokens or guess the PIN.
if (isProd) {
  const missing: string[] = [];
  if (!process.env.SESSION_SECRET) missing.push("SESSION_SECRET");
  if (!process.env.ADMIN_PIN) missing.push("ADMIN_PIN");
  if (missing.length > 0) {
    console.error(
      `✖  REFUSING TO START — missing required env vars in production: ${missing.join(", ")}`
    );
    console.error(
      "   Set SESSION_SECRET to a long random string and ADMIN_PIN to a non-default value."
    );
    process.exit(1);
  }
}

await bootstrapDb();

// Background sync tick for libSQL embedded replica (no-op unless TURSO_SYNC_URL set)
const SYNC_TICK_MS = Number(process.env.TURSO_SYNC_TICK_MS || 30_000);
setInterval(() => { syncNow(); }, SYNC_TICK_MS);

// Defense-in-depth headers — even though our edge proxy (Fly) terminates TLS
// and may set HSTS, these protect against clickjacking, MIME-sniffing, and
// referrer leakage if someone deploys without a smart proxy in front.
const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
};

function withSecurityHeaders(res: Response): Response {
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) headers.set(k, v);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

type Handler = (req: Request) => Response | Promise<Response>;
function wrapHandler(h: Handler): Handler {
  return async (req) => {
    const out = await h(req);
    return out instanceof Response ? withSecurityHeaders(out) : out;
  };
}

function wrapRoutes(routes: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [path, value] of Object.entries(routes)) {
    if (typeof value === "function") {
      out[path] = wrapHandler(value as Handler);
    } else if (value && typeof value === "object") {
      const verbs: Record<string, any> = {};
      for (const [verb, h] of Object.entries(value)) {
        verbs[verb] = typeof h === "function" ? wrapHandler(h as Handler) : h;
      }
      out[path] = verbs;
    } else {
      out[path] = value;
    }
  }
  return out;
}

const apiRoutes = wrapRoutes({
  ...configRoutes,
  ...authRoutes,
  ...judgeRoutes,
  ...projectRoutes,
  ...scoreRoutes,
  ...criteriaRoutes,
  ...leaderboardRoutes,
});

const port = Number(process.env.PORT || 3000);

// Prod: serve Vite's built static assets from ./dist
// Dev: Vite owns the frontend on :5173 with /api + /ws proxied here
const DIST_DIR = join(import.meta.dir, "..", "..", "dist");
const distExists = existsSync(DIST_DIR);

Bun.serve({
  port,
  routes: apiRoutes,

  async fetch(req, server) {
    // WebSocket upgrade
    if (server.upgrade(req)) return undefined;

    // Serve built static files in prod
    if (distExists) {
      const url = new URL(req.url);
      const path = url.pathname === "/" ? "/index.html" : url.pathname;
      const file = Bun.file(join(DIST_DIR, path));
      if (await file.exists()) {
        return withSecurityHeaders(new Response(file));
      }
      // SPA fallback
      const index = Bun.file(join(DIST_DIR, "index.html"));
      if (await index.exists()) return withSecurityHeaders(new Response(index));
    }

    return withSecurityHeaders(new Response(
      "API server. In dev, open the Vite frontend at http://localhost:5173",
      { status: 404, headers: { "content-type": "text/plain" } }
    ));
  },

  websocket: {
    open(ws) { onOpen(ws); },
    message(ws, msg) { onMessage(ws, msg); },
    close(ws) { onClose(ws); },
  },
});

console.log(`⚙  API ready      → http://localhost:${port}`);
if (distExists) {
  console.log(`◼  Static /dist   → serving built frontend`);
} else {
  console.log(`◼  Frontend (dev) → http://localhost:5173  (run: bun run dev:web)`);
}
console.log(`◼  Database       → ${DB_PATH}`);
// Only echo the PIN in dev — prod operators set it from a secret manager.
if (!isProd) {
  console.log(`◼  Admin PIN      → ${process.env.ADMIN_PIN || "hackfw2026"}  (dev default; set ADMIN_PIN for prod)`);
}
if (process.env.TURSO_SYNC_URL) {
  console.log(`◼  libSQL sync    → ${process.env.TURSO_SYNC_URL}`);
}

// Graceful shutdown — flush WAL on rolling deploys.
for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, () => {
    console.log(`◼  ${sig} received → shutting down`);
    process.exit(0);
  });
}
