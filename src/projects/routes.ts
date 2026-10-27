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
import { getSession, requireAdmin } from "../auth/session";
import { publicTeamMembers } from "../shared/submissions";
import { parseProjectInput, ProjectInputError } from "./validation";

export const routes = {
  "/api/projects": {
    GET: async (req: Request) => {
      const isAdmin = getSession(req)?.type === "admin";
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
          team_members: isAdmin ? p.team_members : publicTeamMembers(p.team_members),
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
        const body = parseProjectInput(await req.json());
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
          github_url: body.github_url,
          readme_url: body.readme_url,
          video_url: body.video_url,
          devpost_url: body.devpost_url,
          problem_track: body.problem_track,
          team_members: body.team_members,
        });
        broadcast("projects_updated");
        return Response.json({ id }, { status: 201 });
      } catch (e: any) {
        return Response.json({ error: String(e?.message || e) }, { status: e instanceof ProjectInputError || e instanceof SyntaxError ? 400 : 500 });
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
      return Response.json({ ...p, team_members: getSession(req)?.type === "admin" ? p.team_members : publicTeamMembers(p.team_members) });
    },
    PUT: async (req: Request & { params: { id: string } }) => {
      const guard = requireAdmin(req);
      if (guard instanceof Response) return guard;
      try {
        const id = Number(req.params.id);
        if (!Number.isFinite(id)) {
          return Response.json({ error: "invalid id" }, { status: 400 });
        }
        const body = parseProjectInput(await req.json(), true);
        if (!await updateProject(id, body)) return Response.json({ error: "not found" }, { status: 404 });
        broadcast("projects_updated");
        return Response.json({ ok: true });
      } catch (e: any) {
        return Response.json({ error: String(e?.message || e) }, { status: e instanceof ProjectInputError || e instanceof SyntaxError ? 400 : 500 });
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
      const project = await getProject(id);
      if (!project) return Response.json({ error: "not found" }, { status: 404 });
      const requirements = checkRequirements(project);
      if (!requirements.met) return Response.json({ error: "Verify all five requirements before starting judging", missing: requirements.missing }, { status: 409 });
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
        if (!Array.isArray(body?.items) || !body.items.length) throw new ProjectInputError("Provide at least one submission in items");
        const submissions = body.items.map((item, index) => {
          try {
            if (!item || typeof item !== "object" || Array.isArray(item)) throw new ProjectInputError("Each imported submission must be an object");
            return parseProjectInput({ ...item, team: Array.isArray(item.team) ? item.team.join(", ") : item.team });
          } catch (error) { throw new ProjectInputError(`Submission ${index + 1}: ${(error as Error).message}`); }
        });
        let created = 0;
        for (const submission of submissions) {
          await addProject(submission as Partial<Project> & { name: string; description: string; team: string });
          created++;
        }
        if (created > 0) broadcast("projects_updated");
        return Response.json({ created, inserted: created });
      } catch (e: any) {
        return Response.json({ error: String(e?.message || e) }, { status: e instanceof ProjectInputError || e instanceof SyntaxError ? 400 : 500 });
      }
    },
  },
};
