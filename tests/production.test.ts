import { test, expect } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Database } from "bun:sqlite";
import { startServer, root, testPin, testSecret } from "./server-harness";
import { LoginLimiter } from "../src/auth/rateLimit";

test("failed-login allowance expires and isolates clients", () => {
  const limiter = new LoginLimiter(2, 1000);
  limiter.fail("a", 0); limiter.fail("a", 0);
  expect(limiter.retryAfter("a", 10)).toBe(1);
  expect(limiter.retryAfter("b", 10)).toBe(0);
  expect(limiter.retryAfter("a", 1000)).toBe(0);
});

test("production refuses missing/default secrets and nonpersistent paths", async () => {
  const proc = Bun.spawn([Bun.which("bun")!, "src/server/index.ts"], { cwd: root, env: {
    ...process.env, NODE_ENV: "production", SESSION_SECRET: "hackfw-dev-secret-do-not-use-in-prod", ADMIN_PIN: "hackfw2026", DB_FILE: "relative.db",
  }, stdout: "pipe", stderr: "pipe" });
  expect(await proc.exited).not.toBe(0);
  const error = await new Response(proc.stderr).text();
  expect(error).toContain("REFUSING TO START");
  expect(error).toContain("DB_FILE");
});

test("production rehearsal: auth, privacy, scoring, realtime, backup, restart and revocation", async () => {
  const directory = mkdtempSync(join(tmpdir(), "hackfw-production-"));
  const database = join(directory, "event.db");
  let server = await startServer(database);
  let socket: WebSocket | undefined;
  const request = (path: string, method = "GET", body?: unknown, token?: string) => fetch(`${server.url}${path}`, {
    method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  try {
    const health = await request("/api/health");
    expect(health.status).toBe(200);
    expect(health.headers.get("cache-control")).toBe("no-store");
    expect(health.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
    expect((await request("/api/missing")).status).toBe(404);
    expect((await request("/assets/missing.js")).status).toBe(404);
    expect((await request("/src/auth/session.ts")).status).toBe(404);
    expect((await request("/judge")).status).toBe(200);
    expect((await request("/api/judges")).status).toBe(401);
    expect((await request("/api/projects", "POST", {})).status).toBe(401);
    expect((await request("/api/admin/auth", "POST", { pin: "wrong" })).status).toBe(403);
    const admin = (await (await request("/api/admin/auth", "POST", { pin: testPin })).json()).token;
    expect(typeof admin).toBe("string");
    const created = await request("/api/judges", "POST", { name: "Rehearsal Judge", email: "judge@example.test" }, admin);
    expect(created.status).toBe(201);
    const judge = await created.json();
    expect(judge.code).toHaveLength(16);
    expect((await request("/api/auth", "POST", { email: "judge@example.test" })).status).toBe(400);
    expect((await request("/api/auth", "POST", { email: "judge@example.test", code: "wrong" })).status).toBe(403);
    const login = await (await request("/api/auth", "POST", { email: "JUDGE@example.test", code: judge.code })).json();
    let token = login.token;
    const roster = await (await request("/api/judges", "GET", undefined, admin)).text();
    expect(roster).not.toContain("access_code_hash");
    expect(roster).not.toContain(judge.code);
    expect((await request("/api/judges", "GET", undefined, token)).status).toBe(401);

    socket = new WebSocket(server.url.replace("http:", "ws:") + "/ws");
    const messages: string[] = [];
    socket.addEventListener("message", (event) => messages.push(String(event.data)));
    await new Promise<void>((resolve, reject) => { socket!.onopen = () => resolve(); socket!.onerror = reject; });
    socket.send("ping");
    const project = await (await request("/api/projects", "POST", { name: "Factory Vision", team: "Forge", description: "Demo rehearsal",
      problem_track: "AI for Manufacturing", team_members: [{ name: "Builder", email: "private@example.test" }],
      github_url: "https://github.com/example/demo", video_url: "https://example.test/video" }, admin)).json();
    const score = { project_id: project.id, judge_id: judge.id, technical_decisions: 8, product_viability: 7, venture_scalability: 6, demo_uniqueness: 9, reindustrialization_impact: 10, notes: "Private judge notes" };
    expect((await request("/api/scores", "POST", score, token)).status).toBe(409);
    expect((await request(`/api/projects/${project.id}/present`, "POST", {}, admin)).status).toBe(409);
    expect((await request(`/api/projects/${project.id}`, "PUT", { track_verified: 1, github_verified: 1, video_verified: 1, talent_verified: 1, attendance_verified: 1 }, admin)).status).toBe(200);
    expect((await request(`/api/projects/${project.id}/present`, "POST", {}, admin)).status).toBe(200);
    expect((await request("/api/scores", "POST", { ...score, judge_id: judge.id + 1 }, token)).status).toBe(403);
    expect((await request("/api/scores", "POST", { ...score, technical_decisions: true }, token)).status).toBe(400);
    expect((await request("/api/scores", "POST", score, token)).status).toBe(200);
    expect((await request("/api/scores", "POST", score, token)).status).toBe(200);
    const publicProjects = await (await request("/api/projects")).text();
    expect(publicProjects).not.toContain("private@example.test");
    expect(publicProjects).not.toContain("Private judge notes");
    const standings = await (await request("/api/leaderboard")).json();
    expect(standings[0].judge_count).toBe(1);
    expect(standings[0].avg_weighted).toBe(8);
    expect((await request(`/api/projects/${project.id}/scores`)).status).toBe(401);
    expect((await request(`/api/judges/${judge.id}`, "DELETE", undefined, admin)).status).toBe(409);
    expect((await request("/api/criteria/unknown", "PUT", { weight: 20 }, admin)).status).toBe(400);
    expect((await request("/api/criteria/technical_decisions", "PUT", { weight: 1e308 }, admin)).status).toBe(400);
    await Bun.sleep(150);
    expect(messages).toContain("pong");
    expect(messages.some((message) => message.includes("projects_updated"))).toBe(true);
    expect(messages.some((message) => message.includes("scores_updated"))).toBe(true);

    const backupFile = join(directory, "snapshot.db");
    const backup = Bun.spawn([Bun.which("bun")!, "scripts/backup.ts", backupFile], { cwd: root, env: { ...process.env, DB_FILE: database }, stdout: "pipe", stderr: "pipe" });
    expect(await backup.exited).toBe(0);
    const snapshot = new Database(backupFile, { readonly: true });
    expect(snapshot.query("SELECT COUNT(*) AS count FROM scores").get()).toEqual({ count: 1 });
    snapshot.close();
    socket.close();
    await server.stop();
    // Restore rehearsal uses the backup itself as a separate deployment DB.
    server = await startServer(backupFile);
    expect((await (await request(`/api/scores/${project.id}/${judge.id}`, "GET", undefined, token)).json()).notes).toBe("Private judge notes");
    expect((await (await request("/api/leaderboard")).json())[0].avg_weighted).toBe(8);
    const reset = await (await request(`/api/judges/${judge.id}/access-code`, "POST", {}, admin)).json();
    expect((await request("/api/scores", "POST", score, token)).status).toBe(401);
    expect((await (await request("/api/session", "GET", undefined, token)).json()).session).toBeNull();
    expect((await request("/api/auth", "POST", { email: login.email, code: judge.code })).status).toBe(403);
    token = (await (await request("/api/auth", "POST", { email: login.email, code: reset.code })).json()).token;
    expect((await request("/api/scores", "POST", score, token)).status).toBe(200);
    const panel = await Promise.all(Array.from({ length: 24 }, async (_, index) => {
      const email = `panel-${index}@example.test`;
      const created = await (await request("/api/judges", "POST", { name: `Panel ${index}`, email }, admin)).json();
      const signedIn = await (await request("/api/auth", "POST", { email, code: created.code })).json();
      return { id: created.id, token: signedIn.token };
    }));
    const submissions = await Promise.all(panel.map((judge) => request("/api/scores", "POST", { ...score, judge_id: judge.id }, judge.token)));
    expect(submissions.every((response) => response.status === 200)).toBe(true);
    const fullPanel = (await (await request("/api/leaderboard")).json())[0];
    expect(fullPanel.judge_count).toBe(25);
    expect(fullPanel.total_judges).toBe(25);
    expect(fullPanel.avg_weighted).toBe(8);
    for (let attempt = 0; attempt < 30; attempt++) await request("/api/admin/auth", "POST", { pin: "wrong" });
    const limited = await request("/api/admin/auth", "POST", { pin: "wrong" });
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get("retry-after"))).toBeGreaterThan(0);
  } finally {
    socket?.close();
    await server.stop();
    rmSync(directory, { recursive: true, force: true });
  }
}, 30_000);

test("legacy schema startup preserves historical scores", async () => {
  const directory = mkdtempSync(join(tmpdir(), "hackfw-legacy-"));
  try {
    const path = join(directory, "legacy.db");
    const legacy = new Database(path);
    legacy.exec("CREATE TABLE criteria_weights (key TEXT PRIMARY KEY); INSERT INTO criteria_weights VALUES ('novelty'); CREATE TABLE scores (id INTEGER PRIMARY KEY, notes TEXT); INSERT INTO scores VALUES (1, 'historical score')");
    legacy.close();
    const proc = Bun.spawn([Bun.which("bun")!, "src/server/index.ts"], { cwd: root, env: { ...process.env, NODE_ENV: "production", DB_FILE: path, SESSION_SECRET: testSecret, ADMIN_PIN: testPin, TURSO_SYNC_URL: "" }, stdout: "pipe", stderr: "pipe" });
    expect(await proc.exited).not.toBe(0);
    expect(await new Response(proc.stderr).text()).toContain("Legacy scoring schema");
    const preserved = new Database(path, { readonly: true });
    expect(preserved.query("SELECT notes FROM scores").get()).toEqual({ notes: "historical score" });
    preserved.close();
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
