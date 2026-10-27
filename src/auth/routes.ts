import { authenticateJudge, findJudgeByEmail } from "../judges/repo";
import { getSession, issueToken, requireJudge } from "./session";
import { timingSafeEqual, createHash } from "node:crypto";
import { reserveSignInAttempt, clearSignInAttempts, signInLimited } from "./attempts";

export const routes = {
  "/api/auth": {
    POST: async (req: Request) => {
      try {
        const body = await req.json();
        if (typeof body?.email !== "string" || typeof body?.code !== "string" || body.email.length > 254 || body.code.length > 128) {
          return Response.json({ error: "Email and judge access code are required" }, { status: 400 });
        }
        const account = await findJudgeByEmail(body.email);
        if (account) {
          const retry = await reserveSignInAttempt(`judge:${account.id}`);
          if (retry) return signInLimited(retry);
        }
        const judge = account ? await authenticateJudge(body.email, body.code) : null;
        if (!judge) {
          return Response.json(
            { error: "Invalid email or access code. Contact the event admin." },
            { status: 403 }
          );
        }
        await clearSignInAttempts(`judge:${judge.id}`);
        const token = issueToken({
          type: "judge",
          judgeId: judge.id,
          email: judge.email,
          sessionVersion: judge.session_version,
        });
        return Response.json({ id: judge.id, name: judge.name, email: judge.email, token });
      } catch (e: any) {
        return Response.json({ error: "Unable to sign in" }, { status: e instanceof SyntaxError ? 400 : 500 });
      }
    },
  },

  "/api/admin/auth": {
    POST: async (req: Request) => {
      try {
        const body = await req.json();
        if (typeof body?.pin !== "string" || body.pin.length > 256) return Response.json({ error: "Admin PIN is required" }, { status: 400 });
        const retry = await reserveSignInAttempt("admin");
        if (retry) return signInLimited(retry);
        const supplied = body.pin.trim();
        const pin = /^[\d\s]+$/.test(supplied) ? supplied.replace(/\s/g, "") : supplied;
        const expected = process.env.ADMIN_PIN?.trim() || "hackfw2026";
        const digest = (value: string) => createHash("sha256").update(value).digest();
        if (!timingSafeEqual(digest(pin), digest(expected))) {
          return Response.json({ error: "invalid pin" }, { status: 403 });
        }
        await clearSignInAttempts("admin");
        const token = issueToken({ type: "admin" });
        return Response.json({ ok: true, token });
      } catch (e: any) {
        return Response.json({ error: "Unable to sign in" }, { status: e instanceof SyntaxError ? 400 : 500 });
      }
    },
  },

  // Called on app boot to verify a stored token and restore session.
  "/api/session": {
    GET: async (req: Request) => {
      const s = getSession(req);
      if (!s) return Response.json({ session: null }, { status: 200 });
      if (s.type === "judge") {
        if (await requireJudge(req) instanceof Response) return Response.json({ session: null });
        return Response.json({
          session: { type: "judge", judgeId: s.judgeId, email: s.email, exp: s.exp },
        });
      }
      return Response.json({ session: { type: "admin", exp: s.exp } });
    },
  },

  // Client-initiated logout is stateless (just drops the token), but we
  // expose this so the UI can "confirm" the session is gone.
  "/api/logout": {
    POST: async () => Response.json({ ok: true }),
  },
};
