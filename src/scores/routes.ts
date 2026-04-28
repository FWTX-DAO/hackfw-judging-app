import { getScore, upsertScore, listScoresByProjectDetailed } from "./repo";
import { broadcast } from "../realtime/ws";
import { CRITERIA_KEYS } from "../db/types";
import { getSession, requireAdmin, requireJudge } from "../auth/session";

function validateCriterion(v: any): number | null {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 1 || n > 10 || !Number.isInteger(n)) return null;
  return n;
}

export const routes = {
  "/api/scores": {
    POST: async (req: Request) => {
      const guard = requireJudge(req);
      if (guard instanceof Response) return guard;
      try {
        const body = (await req.json()) as any;
        const project_id = Number(body.project_id);
        const judge_id = Number(body.judge_id);
        if (!Number.isFinite(project_id) || !Number.isFinite(judge_id)) {
          return Response.json({ error: "project_id and judge_id required" }, { status: 400 });
        }
        // A judge may only post scores as themselves.
        if (judge_id !== guard.session.judgeId) {
          return Response.json(
            { error: "judge_id does not match authenticated session" },
            { status: 403 }
          );
        }

        const parsed: Record<string, number> = {};
        for (const k of CRITERIA_KEYS) {
          const v = validateCriterion(body[k]);
          if (v === null) {
            return Response.json(
              { error: `${k} must be an integer between 1 and 10` },
              { status: 400 }
            );
          }
          parsed[k] = v;
        }

        await upsertScore({
          project_id,
          judge_id,
          technical_decisions: parsed.technical_decisions!,
          product_viability: parsed.product_viability!,
          venture_scalability: parsed.venture_scalability!,
          demo_uniqueness: parsed.demo_uniqueness!,
          reindustrialization_impact: parsed.reindustrialization_impact!,
          notes: typeof body.notes === "string" ? body.notes : "",
        });

        broadcast("scores_updated", { project_id });
        return Response.json({ ok: true });
      } catch (e: any) {
        return Response.json({ error: String(e?.message || e) }, { status: 500 });
      }
    },
  },
  "/api/scores/:projectId/:judgeId": {
    // A judge can read their own score; admin can read any.
    GET: async (req: Request & { params: { projectId: string; judgeId: string } }) => {
      const session = getSession(req);
      const projectId = Number(req.params.projectId);
      const judgeId = Number(req.params.judgeId);
      if (!Number.isFinite(projectId) || !Number.isFinite(judgeId)) {
        return Response.json({ error: "invalid ids" }, { status: 400 });
      }
      if (!session) {
        return Response.json({ error: "session required" }, { status: 401 });
      }
      if (session.type === "judge" && session.judgeId !== judgeId) {
        return Response.json({ error: "forbidden" }, { status: 403 });
      }
      const score = await getScore(projectId, judgeId);
      return Response.json(score);
    },
  },
  "/api/projects/:id/scores": {
    GET: async (req: Request & { params: { id: string } }) => {
      // Detailed per-judge breakdown is admin-only.
      const guard = requireAdmin(req);
      if (guard instanceof Response) return guard;
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) {
        return Response.json({ error: "invalid id" }, { status: 400 });
      }
      const rows = await listScoresByProjectDetailed(id);
      return Response.json(rows);
    },
  },
};
