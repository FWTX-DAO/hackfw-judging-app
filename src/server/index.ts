import { isProd, DIST_DIR } from "./environment";
import { bootstrapDb, syncNow, DB_PATH, db } from "../db";
import { onOpen, onMessage, onClose, closeClients } from "../realtime/ws";
import { routes as authRoutes } from "../auth/routes";
import { routes as judgeRoutes } from "../judges/routes";
import { routes as projectRoutes } from "../projects/routes";
import { routes as scoreRoutes } from "../scores/routes";
import { routes as criteriaRoutes } from "../criteria/routes";
import { routes as leaderboardRoutes } from "../leaderboard/routes";
import { routes as configRoutes } from "../config/routes";
import { LoginLimiter } from "../auth/rateLimit";
import { join, resolve, sep } from "node:path";
import { existsSync } from "node:fs";

await bootstrapDb();

const syncTimer = setInterval(() => { void syncNow(); }, Number(process.env.TURSO_SYNC_TICK_MS || 30_000));
const loginLimiter = new LoginLimiter();
let shuttingDown = false;

const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'",
};

function secure(res: Response, cache = "no-store"): Response {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) res.headers.set(key, value);
  res.headers.set("Cache-Control", cache);
  res.headers.set("Vary", "Authorization");
  if (isProd) res.headers.set("Strict-Transport-Security", "max-age=31536000");
  return res;
}

type Handler = (req: Request, server: Bun.Server<unknown>) => Response | Promise<Response>;
function wrapHandler(handler: Handler): Handler {
  return async (req, server) => {
    if (shuttingDown) return secure(Response.json({ error: "Server restarting" }, { status: 503 }));
    const path = new URL(req.url).pathname;
    const login = path === "/api/auth" || path === "/api/admin/auth";
    // Trust Fly's overwritten client-IP header only when explicitly configured.
    const ip = (process.env.TRUST_PROXY === "fly" ? req.headers.get("fly-client-ip") : null) || server.requestIP(req)?.address || "unknown";
    const key = `${path}:${ip}`;
    if (login) {
      const retry = loginLimiter.retryAfter(key);
      if (retry) return secure(Response.json({ error: "Too many sign-in attempts. Please try again shortly." }, { status: 429, headers: { "Retry-After": String(retry) } }));
    }
    try {
      const response = await handler(req, server);
      if (login && response.status >= 400 && response.status < 500) loginLimiter.fail(key);
      if (response.status >= 500) {
        console.error(`Request failed: ${req.method} ${path} (${response.status})`);
        return secure(Response.json({ error: "Unable to complete request. Please try again." }, { status: response.status }));
      }
      return secure(response);
    } catch (error) {
      console.error(`Request failed: ${req.method} ${path}`, error);
      return secure(Response.json({ error: error instanceof SyntaxError ? "Invalid JSON" : "Unable to complete request. Please try again." }, { status: error instanceof SyntaxError ? 400 : 500 }));
    }
  };
}

function wrapRoutes(routes: Record<string, any>): Record<string, any> {
  return Object.fromEntries(Object.entries(routes).map(([path, value]) => [path,
    typeof value === "function" ? wrapHandler(value) : Object.fromEntries(Object.entries(value).map(([verb, handler]) => [verb, wrapHandler(handler as Handler)])),
  ]));
}

const distExists = existsSync(join(DIST_DIR, "index.html"));
const server = Bun.serve<unknown>({
  port: Number(process.env.PORT || 3000),
  hostname: process.env.HOST || "0.0.0.0",
  development: false,
  maxRequestBodySize: 1024 * 1024,
  routes: wrapRoutes({
    ...configRoutes, ...authRoutes, ...judgeRoutes, ...projectRoutes,
    ...scoreRoutes, ...criteriaRoutes, ...leaderboardRoutes,
    "/api/health": { GET: async () => {
      await db.execute("SELECT key FROM criteria_weights LIMIT 1");
      return Response.json({ status: "ok" });
    } },
  }),
  async fetch(req, server) {
    const url = new URL(req.url);
    if (url.pathname === "/ws") {
      const origin = req.headers.get("origin");
      if (origin && new URL(origin).host !== url.host) return secure(new Response("Forbidden", { status: 403 }));
      if (!shuttingDown && server.upgrade(req, { data: null })) return undefined;
      return secure(new Response("WebSocket upgrade required", { status: 426 }));
    }
    if (url.pathname.startsWith("/api/")) return secure(Response.json({ error: "Not found" }, { status: 404 }));
    if (!["GET", "HEAD"].includes(req.method)) return secure(new Response("Method not allowed", { status: 405 }));
    if (distExists) {
      if (["/", "/index.html", "/judge", "/admin", "/leaderboard"].includes(url.pathname)) {
        return secure(new Response(Bun.file(join(DIST_DIR, "index.html"))), "no-cache");
      }
      if (url.pathname.startsWith("/assets/")) {
        let path: string;
        try { path = resolve(DIST_DIR, `.${decodeURIComponent(url.pathname)}`); } catch { return secure(new Response("Bad path", { status: 400 })); }
        if (path.startsWith(`${DIST_DIR}${sep}assets${sep}`) && !path.endsWith(".map")) {
          const file = Bun.file(path);
          if (await file.exists()) return secure(new Response(file), "public, max-age=31536000, immutable");
        }
      }
    }
    return secure(new Response("Not found", { status: 404 }));
  },
  error(error) {
    console.error("HTTP server error", error);
    return secure(Response.json({ error: "Unable to complete request" }, { status: 500 }));
  },
  websocket: {
    maxPayloadLength: 1024,
    idleTimeout: 90,
    open: onOpen,
    message: onMessage,
    close: onClose,
  },
});

console.log(`API ready → http://localhost:${server.port}`);
console.log(`Database → ${DB_PATH}`);
if (!isProd) console.log(`Admin PIN → ${process.env.ADMIN_PIN || "hackfw2026"} (development only)`);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    clearInterval(syncTimer);
    const timeout = setTimeout(() => process.exit(1), 10_000);
    timeout.unref();
    closeClients();
    await server.stop();
    try { await syncNow(); await db.execute("PRAGMA wal_checkpoint(TRUNCATE)"); }
    finally { db.close(); }
    clearTimeout(timeout);
    process.exit(0);
  });
}
