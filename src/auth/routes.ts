import { authenticateJudge } from "../judges/repo";
import { getSession, issueToken } from "./session";

export const routes = {
  "/api/auth": {
    POST: async (req: Request) => {
      try {
        const body = (await req.json()) as { email?: string };
        const email = (body.email || "").trim().toLowerCase();
        if (!email) {
          return Response.json({ error: "email is required" }, { status: 400 });
        }
        const judge = await authenticateJudge(email);
        if (!judge) {
          return Response.json(
            { error: "Email not authorized. Contact the hackathon admin." },
            { status: 403 }
          );
        }
        const token = issueToken({
          type: "judge",
          judgeId: judge.id,
          email: judge.email,
        });
        return Response.json({ ...judge, token });
      } catch (e: any) {
        return Response.json({ error: String(e?.message || e) }, { status: 500 });
      }
    },
  },

  "/api/admin/auth": {
    POST: async (req: Request) => {
      try {
        const body = (await req.json()) as { pin?: string };
        const pin = (body.pin || "").trim();
        const expected = process.env.ADMIN_PIN || "hackfw2026";
        if (pin !== expected) {
          return Response.json({ error: "invalid pin" }, { status: 403 });
        }
        const token = issueToken({ type: "admin" });
        return Response.json({ ok: true, token });
      } catch (e: any) {
        return Response.json({ error: String(e?.message || e) }, { status: 500 });
      }
    },
  },

  // Called on app boot to verify a stored token and restore session.
  "/api/session": {
    GET: async (req: Request) => {
      const s = getSession(req);
      if (!s) return Response.json({ session: null }, { status: 200 });
      if (s.type === "judge") {
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
