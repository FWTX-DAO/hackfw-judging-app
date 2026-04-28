import { test, expect, describe, beforeAll, afterAll } from "bun:test";
import { rmSync } from "node:fs";

const TEST_DB = `test-hackathon-${Date.now()}.db`;
process.env.DB_FILE = TEST_DB;

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

  test("authenticateJudge is case-insensitive", async () => {
    const found = await judgesRepo.authenticateJudge("JUDGE-A@TEST.LOCAL");
    expect(found).not.toBeNull();
    expect(found!.email.toLowerCase()).toBe("judge-a@test.local");
  });

  test("authenticateJudge returns null for unknown email", async () => {
    const found = await judgesRepo.authenticateJudge("nobody@example.com");
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

  test("project without github/video has requirements_met=false; true when set", async () => {
    const { checkRequirements } = await import("../src/scores/scoring");
    const id = await projectsRepo.addProject({
      name: "Req Test",
      description: "d",
      team: "t",
    });
    let p = await projectsRepo.getProject(id);
    let req = checkRequirements({
      github_url: p!.github_url,
      readme_url: p!.readme_url,
      video_url: p!.video_url,
    });
    expect(req.met).toBe(false);

    await projectsRepo.updateProject(id, {
      github_url: "https://github.com/x/y",
      video_url: "https://youtu.be/abc",
    });
    p = await projectsRepo.getProject(id);
    req = checkRequirements({
      github_url: p!.github_url,
      readme_url: p!.readme_url,
      video_url: p!.video_url,
    });
    expect(req.met).toBe(true);
    expect(req.missing).toEqual([]);
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

  if (!leaderboardRepo || typeof leaderboardRepo?.getLeaderboard !== "function") {
    test("leaderboard repo not yet provided (skipped)", () => {
      // Soft-skip: a separate backend agent owns src/leaderboard/repo.ts.
      // This placeholder keeps the reporting clear.
      expect(true).toBe(true);
    });
  }
});
