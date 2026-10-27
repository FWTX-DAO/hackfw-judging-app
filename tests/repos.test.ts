import { test, expect, describe, beforeAll, afterAll } from "bun:test";
import { rmSync } from "node:fs";

const TEST_DB = `test-hackathon-${Date.now()}.db`;
process.env.DB_FILE = TEST_DB;
// Never inherit production replication credentials into a disposable test DB.
process.env.TURSO_SYNC_URL = "";
process.env.TURSO_AUTH_TOKEN = "";

// Import AFTER setting env so the client uses the test file
const { bootstrapDb } = await import("../src/db");
const projectsRepo = await import("../src/projects/repo");
const judgesRepo = await import("../src/judges/repo");
const scoresRepo = await import("../src/scores/repo");
const criteriaRepo = await import("../src/criteria/repo");

// Leaderboard repo is optional — may be provided by another agent.
let leaderboardRepo: any = null;
try {
  leaderboardRepo = await import("../src/leaderboard/repo");
} catch {
  leaderboardRepo = null;
}

import { CRITERIA_KEYS } from "../src/db/types";
import { weightsToMap, avgWeightedAcrossJudges } from "../src/scores/scoring";

const TEST_JUDGES = [
  { name: "Test Judge A", email: "judge-a@test.local" },
  { name: "Test Judge B", email: "judge-b@test.local" },
];

beforeAll(async () => {
  await bootstrapDb();
  // Tests do their own onboarding — the production seed list is empty.
  for (const j of TEST_JUDGES) await judgesRepo.addJudge(j.name, j.email);
});

afterAll(() => {
  try {
    rmSync(TEST_DB, { force: true });
  } catch {}
  try {
    rmSync(TEST_DB + "-shm", { force: true });
  } catch {}
  try {
    rmSync(TEST_DB + "-wal", { force: true });
  } catch {}
});

describe("judges repo", () => {
  test("default seed inserts no judges (admin onboards via UI)", async () => {
    // We've explicitly added TEST_JUDGES in beforeAll. Anything else is
    // accidental seed leakage from config.
    const judges = await judgesRepo.listJudges();
    const emails = new Set(judges.map((j) => j.email.toLowerCase()));
    for (const j of TEST_JUDGES) {
      expect(emails.has(j.email.toLowerCase())).toBe(true);
    }
    expect(judges.length).toBe(TEST_JUDGES.length);
  });

  test("findJudgeByEmail is case-insensitive", async () => {
    const found = await judgesRepo.findJudgeByEmail("JUDGE-A@TEST.LOCAL");
    expect(found).not.toBeNull();
    expect(found!.email.toLowerCase()).toBe("judge-a@test.local");
  });

  test("findJudgeByEmail returns null for unknown email", async () => {
    const found = await judgesRepo.findJudgeByEmail("nobody@example.com");
    expect(found).toBeNull();
  });
});

describe("criteria repo", () => {
  test("seeded criteria weights expose 5 new keys", async () => {
    const weights = await criteriaRepo.listCriteriaWeights();
    expect(weights.length).toBe(5);
    const keys = weights.map((w) => w.key).sort();
    const expected = [...CRITERIA_KEYS].sort();
    expect(keys).toEqual(expected);
  });
});

describe("projects repo", () => {
  test("addProject then listProjects returns it", async () => {
    const id = await projectsRepo.addProject({
      name: "Test Alpha",
      description: "desc",
      team: "team",
    });
    const all = await projectsRepo.listProjects();
    const match = all.find((p) => p.id === id);
    expect(match).toBeDefined();
    expect(match!.name).toBe("Test Alpha");
  });

  test("evidence needs explicit verification and morning check-in", async () => {
    const { checkRequirements } = await import("../src/scores/scoring");
    const id = await projectsRepo.addProject({ name: "Requirements", description: "d", team: "t",
      problem_track: "AI for Manufacturing", team_members: [{ name: "Avery" }], github_url: "https://github.com/x/y", video_url: "https://youtu.be/abc" });
    expect(checkRequirements((await projectsRepo.getProject(id))!).met).toBe(false);
    await projectsRepo.updateProject(id, { track_verified: 1, github_verified: 1, video_verified: 1, talent_verified: 1, attendance_verified: 1 });
    const verified = (await projectsRepo.getProject(id))!;
    expect(checkRequirements(verified).met).toBe(true);
    expect(verified.checked_in_at).toBeTruthy();
    await projectsRepo.setPresenting(id);
    await projectsRepo.updateProject(id, { github_url: "https://github.com/x/revised" });
    const revised = (await projectsRepo.getProject(id))!;
    expect(revised.github_verified).toBe(0);
    expect(revised.presenting).toBe(0);
    expect(revised.attendance_verified).toBe(1);
    await projectsRepo.updateProject(id, { team_members: [{ name: "Avery", email: "avery@example.test" }, { name: "Jordan" }] });
    const changedTeam = (await projectsRepo.getProject(id))!;
    expect(changedTeam.talent_verified).toBe(0);
    expect(changedTeam.attendance_verified).toBe(0);
    expect(changedTeam.checked_in_at).toBeNull();
  });

  test("setPresenting only marks the latest as presenting", async () => {
    const p1 = await projectsRepo.addProject({
      name: "Pres A",
      description: "d",
      team: "t",
    });
    const p2 = await projectsRepo.addProject({
      name: "Pres B",
      description: "d",
      team: "t",
    });
    await projectsRepo.setPresenting(p1);
    await projectsRepo.setPresenting(p2);
    const a = await projectsRepo.getProject(p1);
    const b = await projectsRepo.getProject(p2);
    expect(Number(a!.presenting)).toBe(0);
    expect(Number(b!.presenting)).toBe(1);
  });
});

describe("scores repo", () => {
  test("upsertScore then getScore round-trip; second upsert updates (no duplicate)", async () => {
    const projectId = await projectsRepo.addProject({
      name: "Scored",
      description: "d",
      team: "t",
    });
    const judges = await judgesRepo.listJudges();
    const judgeId = judges[0]!.id;

    await scoresRepo.upsertScore({
      project_id: projectId,
      judge_id: judgeId,
      technical_decisions: 5,
      product_viability: 5,
      venture_scalability: 5,
      demo_uniqueness: 5,
      reindustrialization_impact: 5,
      notes: "first",
    });

    let s = await scoresRepo.getScore(projectId, judgeId);
    expect(s).not.toBeNull();
    expect(s!.technical_decisions).toBe(5);
    expect(s!.notes).toBe("first");

    await scoresRepo.upsertScore({
      project_id: projectId,
      judge_id: judgeId,
      technical_decisions: 9,
      product_viability: 8,
      venture_scalability: 7,
      demo_uniqueness: 6,
      reindustrialization_impact: 5,
      notes: "updated",
    });

    s = await scoresRepo.getScore(projectId, judgeId);
    expect(s!.technical_decisions).toBe(9);
    expect(s!.notes).toBe("updated");

    // Ensure exactly one row for this (project,judge)
    const all = await scoresRepo.listScoresByProject(projectId);
    const rowsForJudge = all.filter((r) => r.judge_id === judgeId);
    expect(rowsForJudge.length).toBe(1);
  });

  test("upsertScore preserves created_at across updates; bumps updated_at", async () => {
    const projectId = await projectsRepo.addProject({
      name: "Timestamps",
      description: "d",
      team: "t",
    });
    const judges = await judgesRepo.listJudges();
    const judgeId = judges[0]!.id;

    await scoresRepo.upsertScore({
      project_id: projectId,
      judge_id: judgeId,
      technical_decisions: 5,
      product_viability: 5,
      venture_scalability: 5,
      demo_uniqueness: 5,
      reindustrialization_impact: 5,
      notes: "v1",
    });
    const first = await scoresRepo.getScore(projectId, judgeId);
    expect(first).not.toBeNull();
    const firstCreated = first!.created_at;
    expect(firstCreated).toBeTruthy();

    // Sleep enough for datetime('now') (second resolution) to advance
    await new Promise((r) => setTimeout(r, 1100));

    await scoresRepo.upsertScore({
      project_id: projectId,
      judge_id: judgeId,
      technical_decisions: 9,
      product_viability: 9,
      venture_scalability: 9,
      demo_uniqueness: 9,
      reindustrialization_impact: 9,
      notes: "v2",
    });
    const second = await scoresRepo.getScore(projectId, judgeId);
    expect(second!.created_at).toBe(firstCreated);
    // updated_at should be later (or at least not the same as v1's, which
    // was set to the same instant as created_at on insert)
    expect(second!.updated_at).not.toBe(firstCreated);
  });

  test("listScoresByProjectDetailed includes judge_name + judge_email", async () => {
    const projectId = await projectsRepo.addProject({
      name: "Detailed",
      description: "d",
      team: "t",
    });
    const judges = await judgesRepo.listJudges();
    const j = judges[0]!;
    await scoresRepo.upsertScore({
      project_id: projectId,
      judge_id: j.id,
      technical_decisions: 7,
      product_viability: 7,
      venture_scalability: 7,
      demo_uniqueness: 7,
      reindustrialization_impact: 7,
      notes: "",
    });
    const rows = await scoresRepo.listScoresByProjectDetailed(projectId);
    expect(rows.length).toBe(1);
    expect(rows[0]!.judge_name).toBe(j.name);
    expect(rows[0]!.judge_email.toLowerCase()).toBe(j.email.toLowerCase());
  });
});

describe("leaderboard repo", () => {
  test.if(!!leaderboardRepo && typeof leaderboardRepo?.getLeaderboard === "function")(
    "avg_weighted matches manual calc; judge_count=2",
    async () => {
      const projectId = await projectsRepo.addProject({
        name: "Leader Proj",
        description: "d",
        team: "t",
        github_url: "https://github.com/x/y",
        video_url: "https://youtu.be/abc",
      });
      const judges = await judgesRepo.listJudges();
      const [j1, j2] = judges;

      const scoreA = {
        project_id: projectId,
        judge_id: j1!.id,
        technical_decisions: 8,
        product_viability: 7,
        venture_scalability: 6,
        demo_uniqueness: 9,
        reindustrialization_impact: 5,
        notes: "",
      };
      const scoreB = {
        project_id: projectId,
        judge_id: j2!.id,
        technical_decisions: 6,
        product_viability: 9,
        venture_scalability: 8,
        demo_uniqueness: 7,
        reindustrialization_impact: 7,
      };
      await scoresRepo.upsertScore(scoreA);
      await scoresRepo.upsertScore(scoreB);

      const weights = await criteriaRepo.listCriteriaWeights();
      const wmap = weightsToMap(weights);

      // Manually build the Score objects with the fields scoring cares about
      const expected = avgWeightedAcrossJudges(
        [
          { ...scoreA, id: 0, notes: "", created_at: "" } as any,
          { ...scoreB, id: 0, notes: "", created_at: "" } as any,
        ],
        wmap
      );

      const lb = await leaderboardRepo.getLeaderboard();
      const entry = lb.find((e: any) => e.id === projectId);
      expect(entry).toBeDefined();
      expect(entry.judge_count).toBe(2);
      expect(entry.avg_weighted).toBeCloseTo(expected, 2);
    }
  );

  test.if(!!leaderboardRepo && typeof leaderboardRepo?.getLeaderboard === "function")(
    "tied avg_weighted breaks by judge_count desc, then id asc",
    async () => {
      // Two projects, both scored by the same set of judges with identical
      // values → identical avg_weighted. Tiebreaker should be deterministic.
      const judges = await judgesRepo.listJudges();
      const [j1, j2] = judges;

      const pA = await projectsRepo.addProject({ name: "TieA", description: "d", team: "t" });
      const pB = await projectsRepo.addProject({ name: "TieB", description: "d", team: "t" });

      const sameScore = {
        technical_decisions: 5,
        product_viability: 5,
        venture_scalability: 5,
        demo_uniqueness: 5,
        reindustrialization_impact: 5,
      };
      await scoresRepo.upsertScore({ project_id: pA, judge_id: j1!.id, ...sameScore });
      await scoresRepo.upsertScore({ project_id: pA, judge_id: j2!.id, ...sameScore });
      await scoresRepo.upsertScore({ project_id: pB, judge_id: j1!.id, ...sameScore });
      // pB only has 1 judge → should rank below pA in the tiebreak

      const lb = await leaderboardRepo.getLeaderboard();
      const idxA = lb.findIndex((e: any) => e.id === pA);
      const idxB = lb.findIndex((e: any) => e.id === pB);
      expect(idxA).toBeGreaterThanOrEqual(0);
      expect(idxB).toBeGreaterThanOrEqual(0);
      expect(idxA).toBeLessThan(idxB);
    }
  );

  test.if(!!leaderboardRepo && typeof leaderboardRepo?.getLeaderboard === "function")(
    "every entry exposes total_judges = panel size",
    async () => {
      const judges = await judgesRepo.listJudges();
      const lb = await leaderboardRepo.getLeaderboard();
      for (const entry of lb) {
        expect(entry.total_judges).toBe(judges.length);
      }
    }
  );

  if (!leaderboardRepo || typeof leaderboardRepo?.getLeaderboard !== "function") {
    test("leaderboard repo not yet provided (skipped)", () => {
      expect(true).toBe(true);
    });
  }
});

describe("submission HTTP workflow", () => {
  test("bulk import preserves participant objects, starts unverified and rejects invalid batches before writes", async () => {
    const { routes } = await import("../src/projects/routes");
    const { issueToken } = await import("../src/auth/session");
    const token = issueToken({ type: "admin" });
    const request = (items: unknown[]) => new Request("http://test.local/api/projects/bulk", {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ items }),
    });
    const item = { name: "Bulk array", team: "Bulk Team", description: "Working system", problem_track: "Open Forum",
      team_members: [{ name: "Avery", email: "avery@example.test" }, { name: "Jordan" }], attendance_verified: 1 };
    const before = (await projectsRepo.listProjects()).length;
    const invalid = await routes["/api/projects/bulk"].POST(request([item, { ...item, team_members: [{}] }]));
    expect(invalid.status).toBe(400);
    expect((await invalid.json()).error).toContain("Submission 2");
    expect((await projectsRepo.listProjects()).length).toBe(before);
    const imported = await routes["/api/projects/bulk"].POST(request([item, { ...item, name: "Bulk newline", team_members: "Legacy One\nLegacy Two" }]));
    expect(imported.status).toBe(200);
    expect((await imported.json()).created).toBe(2);
    const rows = await projectsRepo.listProjects();
    const canonical = rows.find((row) => row.name === "Bulk array")!;
    expect(canonical.team_members).toEqual(item.team_members);
    expect(canonical.attendance_verified).toBe(0);
    expect(canonical.checked_in_at).toBeNull();
    expect(rows.find((row) => row.name === "Bulk newline")!.team_members).toEqual([{ name: "Legacy One" }, { name: "Legacy Two" }]);
  });

  test("admin CRUD, five checks, check-in, judging gates and revocation", async () => {
    const { routes: projectRoutes } = await import("../src/projects/routes");
    const { routes: scoreRoutes } = await import("../src/scores/routes");
    const { issueToken } = await import("../src/auth/session");
    const judge = (await judgesRepo.listJudges())[0]!;
    const admin = issueToken({ type: "admin" });
    const judgeToken = issueToken({ type: "judge", judgeId: judge.id, email: judge.email, sessionVersion: 0 });
    const request = (method: string, token: string, body?: unknown, id?: number) => Object.assign(new Request("http://test.local/api/projects", {
      method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    }), { params: { id: String(id) } });
    const submission = { name: "HTTP workflow", team: "Team HTTP", description: "Working demo",
      problem_track: "AI for Manufacturing", team_members: [{ name: "Avery", email: "avery@example.test" }, { name: "Jordan" }],
      github_url: "https://github.com/example/demo", video_url: "https://example.test/demo" };
    expect((await projectRoutes["/api/projects"].POST(request("POST", judgeToken, submission))).status).toBe(401);
    const created = await projectRoutes["/api/projects"].POST(request("POST", admin, { ...submission, github_verified: 1 }));
    expect(created.status).toBe(201);
    const { id } = await created.json() as { id: number };
    expect((await projectsRepo.getProject(id))!.github_verified).toBe(0);
    expect((await projectRoutes["/api/projects/:id"].PUT(request("PUT", judgeToken, { attendance_verified: 1 }, id))).status).toBe(401);
    expect((await projectRoutes["/api/projects/:id/present"].POST(request("POST", admin, undefined, id))).status).toBe(409);
    const grade = { project_id: id, judge_id: judge.id, ...Object.fromEntries(CRITERIA_KEYS.map((key) => [key, 8])), notes: "Verified demo" };
    expect((await scoreRoutes["/api/scores"].POST(request("POST", judgeToken, grade))).status).toBe(409);
    const verified = await projectRoutes["/api/projects/:id"].PUT(request("PUT", admin, {
      track_verified: 1, github_verified: 1, video_verified: 1, talent_verified: 1, attendance_verified: 1,
    }, id));
    expect(verified.status).toBe(200);
    const checkedIn = (await projectsRepo.getProject(id))!;
    expect(checkedIn.checked_in_at).toBeTruthy();
    const adminProject = await projectRoutes["/api/projects/:id"].GET(request("GET", admin, undefined, id)).then((res) => res.json());
    const publicProject = await projectRoutes["/api/projects/:id"].GET(request("GET", "", undefined, id)).then((res) => res.json());
    const publicList = await projectRoutes["/api/projects"].GET(request("GET", "")).then((res) => res.json());
    const publicBoard = await leaderboardRepo.getLeaderboard();
    expect(adminProject.team_members[0].email).toBe("avery@example.test");
    expect(publicProject.team_members[0]).toEqual({ name: "Avery" });
    expect(publicList.find((row: any) => row.id === id).team_members[0]).toEqual({ name: "Avery" });
    expect(publicBoard.find((row: any) => row.id === id).team_members[0]).toEqual({ name: "Avery" });
    const { migrate } = await import("../src/db/schema");
    await migrate();
    expect((await projectsRepo.getProject(id))!.checked_in_at).toBe(checkedIn.checked_in_at);
    expect((await projectRoutes["/api/projects/:id/present"].POST(request("POST", admin, undefined, id))).status).toBe(200);
    expect((await scoreRoutes["/api/scores"].POST(request("POST", judgeToken, grade))).status).toBe(200);
    await projectRoutes["/api/projects/:id"].PUT(request("PUT", admin, { name: "Edited submission", team: "Edited team" }, id));
    const edited = (await projectsRepo.getProject(id))!;
    expect(edited.name).toBe("Edited submission");
    expect(edited.team).toBe("Edited team");
    expect(edited.talent_verified).toBe(0);
    expect(edited.attendance_verified).toBe(0);
    expect(edited.presenting).toBe(0);
    expect((await scoreRoutes["/api/scores"].POST(request("POST", judgeToken, grade))).status).toBe(409);
    expect((await scoresRepo.getScore(id, judge.id))!.technical_decisions).toBe(8);
    expect((await projectRoutes["/api/projects/:id"].DELETE(request("DELETE", admin, undefined, id))).status).toBe(200);
    expect(await projectsRepo.getProject(id)).toBeNull();
    expect(await scoresRepo.getScore(id, judge.id)).toBeNull();
    expect((await projectRoutes["/api/projects/:id"].PUT(request("PUT", admin, { name: "missing" }, id))).status).toBe(404);
    expect((await projectRoutes["/api/projects/:id/present"].POST(request("POST", admin, undefined, id))).status).toBe(404);
  });

  test("invalid verification or evidence edits fail without partial writes", async () => {
    const { parseProjectInput } = await import("../src/projects/validation");
    expect(() => parseProjectInput({ track_verified: "false" }, true)).toThrow();
    expect(() => parseProjectInput({ problem_track: "Bogus" }, true)).toThrow();
    expect(() => parseProjectInput({ video_url: "javascript:alert(1)" }, true)).toThrow();
    expect(() => parseProjectInput({ team: "" }, true)).toThrow();
    const id = await projectsRepo.addProject({ name: "Atomic validation", team: "Original", description: "d" });
    await expect(projectsRepo.updateProject(id, { name: "Should roll back", github_verified: 1 })).rejects.toThrow("GitHub");
    expect((await projectsRepo.getProject(id))!.name).toBe("Atomic validation");
    await expect(projectsRepo.updateProject(id, { attendance_verified: 1 })).rejects.toThrow("roster");
  });
});
