import { listCriteriaWeights, updateCriteriaWeight } from "./repo";
import { broadcast } from "../realtime/ws";
import { requireAdmin } from "../auth/session";

export const routes = {
  "/api/criteria": {
    GET: async (_req: Request) => {
      const rows = await listCriteriaWeights();
      return Response.json(rows);
    },
  },
  "/api/criteria/:key": {
    PUT: async (req: Request & { params: { key: string } }) => {
      const guard = requireAdmin(req);
      if (guard instanceof Response) return guard;
      try {
        const body = (await req.json()) as { weight?: number };
        const weight = Number(body.weight);
        if (!Number.isFinite(weight) || weight < 0) {
          return Response.json({ error: "weight must be a non-negative number" }, { status: 400 });
        }
        await updateCriteriaWeight(req.params.key, weight);
        broadcast("criteria_updated");
        return Response.json({ ok: true });
      } catch (e: any) {
        return Response.json({ error: String(e?.message || e) }, { status: 500 });
      }
    },
  },
};
