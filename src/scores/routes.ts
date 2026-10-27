import { getScore, upsertScore, listScoresByProjectDetailed } from "./repo";
import { broadcast } from "../realtime/ws";
import { CRITERIA_KEYS } from "../db/types";
import { getSession, requireAdmin, requireJudge } from "../auth/session";
import { getProject } from "../projects/repo";
import { checkSubmissionRequirements } from "../shared/submissions";

function validateCriterion(v: any): number | null {
  const n = typeof v === "number" ? v : NaN;
  if (!Number.isFinite(n) || n < 1 || n > 10 || !Number.isInteger(n)) return null;
  return n;
}

export const routes = {
  "/api/scores": {
    POST: async (req: Request) => {
      const guard = await requireJudge(req);
      if (guard instanceof Response) return guard;
      try {
        const body = (await req.json()) as any;
        if (!body || typeof body !== "object" || Array.isArray(body)) return Response.json({ error: "Expected a score object" }, { status: 400 });
        const project_id = Number(body.project_id);
        const judge_id = Number(body.judge_id);
        if (!Number.isSafeInteger(project_id) || project_id <= 0 || !Number.isSafeInteger(judge_id) || judge_id <= 0) {
          return Response.json({ error: "project_id and judge_id required" }, { status: 400 });
        }
        // A judge may only post scores as themselves.
        if (judge_id !== guard.session.judgeId) {
          return Response.json(
            { error: "judge_id does not match authenticated session" },
            { status: 403 }
          );
        }

        const project = await getProject(project_id);
        if (!project) return Response.json({ error: "submission not found" }, { status: 404 });
        const requirements = checkSubmissionRequirements(project);
        if (!requirements.met) {
          return Response.json({ error: "Admin verification and Demo Day check-in are required before scoring", missing: requirements.missing }, { status: 409 });
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

        if (body.notes !== undefined && (typeof body.notes !== "string" || body.notes.length > 10000)) return Response.json({ error: "Notes must be text of at most 10,000 characters" }, { status: 400 });
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
        console.error("Score submission failed", e);
        return Response.json({ error: e instanceof SyntaxError ? "Invalid JSON" : "Unable to save score. Try again." }, { status: e instanceof SyntaxError ? 400 : 500 });
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
      if (session.type === "judge") {
        const guard = await requireJudge(req);
        if (guard instanceof Response) return guard;
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
