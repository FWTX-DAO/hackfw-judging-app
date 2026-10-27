import { listJudges, addJudge, deleteJudge, generateJudgeCode, resetJudgeCode } from "./repo";
import { requireAdmin } from "../auth/session";
import { broadcast } from "../realtime/ws";

export const routes = {
  "/api/judges": {
    // Private — roster is internal. Only admin can read the list.
    GET: async (req: Request) => {
      const guard = requireAdmin(req);
      if (guard instanceof Response) return guard;
      const judges = await listJudges();
      return Response.json(judges);
    },
    POST: async (req: Request) => {
      const guard = requireAdmin(req);
      if (guard instanceof Response) return guard;
      try {
        const body = await req.json();
        const name = typeof body?.name === "string" ? body.name.trim() : "";
        const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
        if (!name || name.length > 120 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          return Response.json({ error: "A name (up to 120 characters) and valid email are required" }, { status: 400 });
        }
        try {
          const code = generateJudgeCode();
          const id = await addJudge(name, email, code);
          // Notify other admin tabs + bumps leaderboard total_judges denominator
          broadcast("judges_updated");
          return Response.json({ id, code }, { status: 201 });
        } catch (e: any) {
          const msg = String(e?.message || e);
          if (msg.includes("UNIQUE") || msg.includes("unique")) {
            return Response.json({ error: "email already exists" }, { status: 409 });
          }
          throw e;
        }
      } catch (e: any) {
        return Response.json({ error: "Unable to authorize judge" }, { status: e instanceof SyntaxError ? 400 : 500 });
      }
    },
  },
  "/api/judges/:id": {
    DELETE: async (req: Request & { params: { id: string } }) => {
      const guard = requireAdmin(req);
      if (guard instanceof Response) return guard;
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) {
        return Response.json({ error: "invalid id" }, { status: 400 });
      }
      if (!await deleteJudge(id)) return Response.json({ error: "Judge not found or already has scores. Reset their access code to revoke access without deleting grades." }, { status: 409 });
      broadcast("judges_updated");
      return Response.json({ ok: true });
    },
  },
  "/api/judges/:id/access-code": {
    POST: async (req: Request & { params: { id: string } }) => {
      const guard = requireAdmin(req);
      if (guard instanceof Response) return guard;
      const id = Number(req.params.id);
      if (!Number.isSafeInteger(id) || id <= 0) return Response.json({ error: "invalid id" }, { status: 400 });
      const code = await resetJudgeCode(id);
      if (!code) return Response.json({ error: "Judge not found" }, { status: 404 });
      broadcast("judges_updated");
      return Response.json({ code });
    },
  },
};
