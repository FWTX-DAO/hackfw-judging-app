import {
  listProjects,
  getProject,
  addProject,
  updateProject,
  deleteProject,
  setPresenting,
  clearPresenting,
} from "./repo";
import { listAllScores } from "../scores/repo";
import { listCriteriaWeights } from "../criteria/repo";
import {
  avgWeightedAcrossJudges,
  checkRequirements,
  weightsToMap,
} from "../scores/scoring";
import type { Project, Score, ProjectWithScore } from "../db/types";
import { broadcast } from "../realtime/ws";
import { requireAdmin } from "../auth/session";
import { sanitizeUrl } from "../util/url";

const URL_FIELDS = ["github_url", "readme_url", "video_url", "devpost_url"] as const;

function sanitizeUrlFieldsInPlace<T extends Partial<Project>>(patch: T): T {
  for (const f of URL_FIELDS) {
    if (patch[f] !== undefined) {
      (patch as any)[f] = sanitizeUrl(patch[f]);
    }
  }
  return patch;
}

export const routes = {
  "/api/projects": {
    GET: async (_req: Request) => {
      const [projects, scores, weights] = await Promise.all([
        listProjects(),
        listAllScores(),
        listCriteriaWeights(),
      ]);
      const wmap = weightsToMap(weights);
      const scoresByProject = new Map<number, Score[]>();
      for (const s of scores) {
        const arr = scoresByProject.get(s.project_id) || [];
        arr.push(s);
        scoresByProject.set(s.project_id, arr);
      }
      const enriched: ProjectWithScore[] = projects.map((p) => {
        const ps = scoresByProject.get(p.id) || [];
        const avg_weighted = avgWeightedAcrossJudges(ps, wmap);
        const req = checkRequirements(p);
        return {
          ...p,
          avg_weighted,
          score_count: ps.length,
          requirements_met: req.met,
          missing_requirements: req.missing,
        };
      });
      enriched.sort((a, b) => b.avg_weighted - a.avg_weighted);
      return Response.json(enriched);
    },
    POST: async (req: Request) => {
      const guard = requireAdmin(req);
      if (guard instanceof Response) return guard;
      try {
        const body = (await req.json()) as Partial<Project>;
        const name = (body.name || "").trim();
        const description = (body.description || "").trim();
        const team = (body.team || "").trim();
        if (!name || !description || !team) {
          return Response.json(
            { error: "name, description, team are required" },
            { status: 400 }
          );
        }
        const id = await addProject({
          name,
          description,
          team,
          github_url: sanitizeUrl(body.github_url),
          readme_url: sanitizeUrl(body.readme_url),
          video_url: sanitizeUrl(body.video_url),
          devpost_url: sanitizeUrl(body.devpost_url),
        });
        broadcast("projects_updated");
        return Response.json({ id }, { status: 201 });
      } catch (e: any) {
        return Response.json({ error: String(e?.message || e) }, { status: 500 });
      }
    },
  },
  "/api/projects/:id": {
    GET: async (req: Request & { params: { id: string } }) => {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) {
        return Response.json({ error: "invalid id" }, { status: 400 });
      }
      const p = await getProject(id);
      if (!p) return Response.json({ error: "not found" }, { status: 404 });
      return Response.json(p);
    },
    PUT: async (req: Request & { params: { id: string } }) => {
      const guard = requireAdmin(req);
      if (guard instanceof Response) return guard;
      try {
        const id = Number(req.params.id);
        if (!Number.isFinite(id)) {
          return Response.json({ error: "invalid id" }, { status: 400 });
        }
        const body = (await req.json()) as Partial<Project>;
        sanitizeUrlFieldsInPlace(body);
        await updateProject(id, body);
        broadcast("projects_updated");
        return Response.json({ ok: true });
      } catch (e: any) {
        return Response.json({ error: String(e?.message || e) }, { status: 500 });
      }
    },
    DELETE: async (req: Request & { params: { id: string } }) => {
      const guard = requireAdmin(req);
      if (guard instanceof Response) return guard;
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) {
        return Response.json({ error: "invalid id" }, { status: 400 });
      }
      await deleteProject(id);
      broadcast("projects_updated");
      return Response.json({ ok: true });
    },
  },
  "/api/projects/:id/present": {
    POST: async (req: Request & { params: { id: string } }) => {
      const guard = requireAdmin(req);
      if (guard instanceof Response) return guard;
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) {
        return Response.json({ error: "invalid id" }, { status: 400 });
      }
      await setPresenting(id);
      broadcast("projects_updated");
      return Response.json({ ok: true });
    },
  },
  "/api/projects/clear-presenting": {
    POST: async (req: Request) => {
      const guard = requireAdmin(req);
      if (guard instanceof Response) return guard;
      await clearPresenting();
      broadcast("projects_updated");
      return Response.json({ ok: true });
    },
  },
  "/api/projects/bulk": {
    POST: async (req: Request) => {
      const guard = requireAdmin(req);
      if (guard instanceof Response) return guard;
      try {
        const body = (await req.json()) as { items?: Partial<Project>[] };
        const items = Array.isArray(body.items) ? body.items : [];
        let created = 0;
        for (const it of items) {
          const name = (it.name || "").trim();
          const description = (it.description || "").trim();
          const team = Array.isArray(it.team)
            ? it.team.map((s) => String(s).trim()).filter(Boolean).join(", ")
            : (it.team || "").trim();
          if (!name || !description || !team) continue;
          await addProject({
            name,
            description,
            team,
            github_url: sanitizeUrl(it.github_url),
            readme_url: sanitizeUrl(it.readme_url),
            video_url: sanitizeUrl(it.video_url),
            devpost_url: sanitizeUrl(it.devpost_url),
          });
          created++;
        }
        if (created > 0) broadcast("projects_updated");
        return Response.json({ created, inserted: created });
      } catch (e: any) {
        return Response.json({ error: String(e?.message || e) }, { status: 500 });
      }
    },
  },
};
