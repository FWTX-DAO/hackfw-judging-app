import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Stateless session tokens: `<payload_b64url>.<hmac_b64url>`.
 * Payload is a small JSON blob — no DB lookup needed on every request.
 *
 * Judges log in with email → get a judge token.
 * Admin logs in with PIN → gets an admin token.
 * Tokens carry an `exp` timestamp (ms since epoch).
 */

const SECRET =
  process.env.SESSION_SECRET ||
  // Deterministic fallback so dev restarts don't invalidate sessions,
  // but warn loudly. Set SESSION_SECRET in prod.
  "hackfw-dev-secret-do-not-use-in-prod";

if (SECRET === "hackfw-dev-secret-do-not-use-in-prod") {
  console.warn("◼  WARN: SESSION_SECRET not set — using dev default. Set it in prod.");
}

const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export type JudgeSession = { type: "judge"; judgeId: number; email: string; exp: number };
export type AdminSession = { type: "admin"; exp: number };
export type Session = JudgeSession | AdminSession;

function b64urlEncode(buf: Buffer | Uint8Array): string {
  return Buffer.from(buf).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function b64urlDecode(s: string): Buffer {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

function sign(payload: string): string {
  return b64urlEncode(createHmac("sha256", SECRET).update(payload).digest());
}

export function issueToken(body: Omit<JudgeSession, "exp"> | Omit<AdminSession, "exp">, ttlMs = DEFAULT_TTL_MS): string {
  const full: Session = { ...body, exp: Date.now() + ttlMs } as Session;
  const payload = b64urlEncode(Buffer.from(JSON.stringify(full), "utf8"));
  const sig = sign(payload);
  return `${payload}.${sig}`;
}

export function verifyToken(token: string | null | undefined): Session | null {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  if (!payload || !sig) return null;

  // Constant-time signature compare
  const expected = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  if (!timingSafeEqual(a, b)) return null;

  try {
    const parsed = JSON.parse(b64urlDecode(payload).toString("utf8")) as Session;
    if (!parsed || typeof parsed !== "object") return null;
    if (typeof parsed.exp !== "number" || parsed.exp < Date.now()) return null;
    if (parsed.type !== "judge" && parsed.type !== "admin") return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Extract token from Authorization header: `Bearer <token>`. */
export function extractToken(req: Request): string | null {
  const h = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!h) return null;
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() || null;
}

export function getSession(req: Request): Session | null {
  return verifyToken(extractToken(req));
}

/** Route guards — return a Response if unauthorized, else null. */
export function requireJudge(req: Request): { session: JudgeSession } | Response {
  const s = getSession(req);
  if (!s || s.type !== "judge") {
    return Response.json({ error: "judge session required" }, { status: 401 });
  }
  return { session: s };
}

export function requireAdmin(req: Request): { session: AdminSession } | Response {
  const s = getSession(req);
  if (!s || s.type !== "admin") {
    return Response.json({ error: "admin session required" }, { status: 401 });
  }
  return { session: s };
}
