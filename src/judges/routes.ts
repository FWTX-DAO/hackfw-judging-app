import { listJudges, addJudge, deleteJudge } from "./repo";
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
        const body = (await req.json()) as { name?: string; email?: string };
        const name = (body.name || "").trim();
        const email = (body.email || "").trim().toLowerCase();
        if (!name || !email) {
          return Response.json({ error: "name and email are required" }, { status: 400 });
        }
        try {
          const id = await addJudge(name, email);
          // Notify other admin tabs + bumps leaderboard total_judges denominator
          broadcast("judges_updated");
          return Response.json({ id }, { status: 201 });
        } catch (e: any) {
          const msg = String(e?.message || e);
          if (msg.includes("UNIQUE") || msg.includes("unique")) {
            return Response.json({ error: "email already exists" }, { status: 409 });
          }
          throw e;
        }
      } catch (e: any) {
        return Response.json({ error: String(e?.message || e) }, { status: 500 });
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
      await deleteJudge(id);
      broadcast("judges_updated");
      return Response.json({ ok: true });
    },
  },
};
