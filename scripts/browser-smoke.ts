import { chromium, expect, type Page } from "@playwright/test";
import { mkdtempSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { startServer, testPin } from "../tests/server-harness";

const directory = mkdtempSync(join(tmpdir(), "hackfw-browser-"));
const out = resolve("out/production-audit");
mkdirSync(out, { recursive: true });
const server = await startServer(join(directory, "event.db"));
const browser = await chromium.launch().catch(async (error) => {
  await server.stop(); rmSync(directory, { recursive: true, force: true }); throw error;
});
const runtimeErrors: string[] = [];
const assertions: string[] = [];
const observe = (page: Page) => { page.setDefaultTimeout(10_000); page.on("pageerror", (error) => runtimeErrors.push(error.message)); };
expect.configure({ timeout: 10_000 });

try {
  const adminContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const admin = await adminContext.newPage(); observe(admin);
  await admin.goto(server.url);
  await admin.getByRole("button", { name: /Admin\ Console/i }).click();
  await expect(admin.getByLabel(/^Admin\ PIN$/i, { exact: true })).toHaveAttribute("inputmode", "numeric");
  await admin.getByLabel(/^Admin\ PIN$/i, { exact: true }).fill(testPin);
  await admin.getByRole("button", { name: /Unlock\ Console/i }).click();
  await expect(admin).toHaveURL(/\/admin$/);
  await admin.getByPlaceholder("judge name", { exact: true }).fill("Demo Judge");
  await admin.getByPlaceholder("judge@email.com", { exact: true }).fill("judge@example.test");
  await admin.getByRole("button", { name: /Authorize/i, exact: true }).click();
  const codeElement = admin.locator("code");
  await expect(codeElement).toBeVisible();
  const code = (await codeElement.textContent())!;
  expect(code).toMatch(/^\d{6}$/);
  await admin.getByRole("button", { name: /Dismiss\ code/i }).click();
  const token = await admin.evaluate(() => localStorage.getItem("hackfw_session_token"));
  const api = async (path: string, body?: unknown, method = "POST") => {
    const response = await fetch(server.url + path, { method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    if (!response.ok) throw new Error(`${path}: ${response.status} ${await response.text()}`);
    return response.json();
  };
  // Exercise the actual admin submission form and verification controls.
  await admin.getByRole("button", { name: /Add\ Submission/i, exact: true }).click();
  await admin.getByLabel(/^Submission\ name$/i, { exact: true }).fill("Factory Vision");
  await admin.getByLabel(/^Team\ name$/i, { exact: true }).fill("Forge Team");
  await admin.getByLabel(/^Public\ GitHub\ repository$/i, { exact: true }).fill("https://github.com/example/factory");
  await admin.getByLabel(/^End\-to\-end\ demo\ video$/i, { exact: true }).fill("https://example.test/video");
  await admin.getByRole("combobox", { name: /Problem track/i }).selectOption("AI for Manufacturing");
  await admin.getByLabel(/^Participant\ 1\ name$/i, { exact: true }).fill("Avery Builder");
  await admin.getByLabel(/^Participant\ 1\ email\ \(optional\)$/i, { exact: true }).fill("private@example.test");
  await admin.getByLabel(/^Submission\ description$/i, { exact: true }).fill("Live production rehearsal for Demo Day.");
  await admin.getByRole("button", { name: /Add\ Submission/i, exact: true }).last().click();
  for (const name of ["Problem track", "Public GitHub repository", "End-to-end demo video", "Talent registration", "In-person Demo Day check-in"]) {
    const checkbox = admin.getByRole("checkbox", { name: new RegExp(name, "i") });
    await checkbox.click();
    await expect(checkbox).toBeChecked();
    await expect(checkbox).toBeEnabled();
  }
  await expect(admin.getByRole("button", { name: /Start\ Judging/i, exact: true })).toBeEnabled();
  const projects = await api("/api/projects", undefined, "GET");
  const firstId = projects[0].id;
  const second = await api("/api/projects", { name: "Supply Bridge", team: "Foundry Team", description: "Second demo", problem_track: "Supplier Relationship Management", github_url: "https://github.com/example/supply", video_url: "https://example.test/video", team_members: [{ name: "Jordan" }] });
  await api(`/api/projects/${second.id}`, { track_verified: 1, github_verified: 1, video_verified: 1, talent_verified: 1, attendance_verified: 1 }, "PUT");

  const mobileContext = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  const judge = await mobileContext.newPage(); observe(judge);
  const signIn = async () => {
    await judge.getByRole("button", { name: /Judge\ Access/i }).click();
    await judge.getByRole("textbox", { name: /Judge\ email/i }).fill("judge@example.test");
    await expect(judge.getByLabel(/^Judge\ access\ code$/i, { exact: true })).toHaveAttribute("inputmode", "numeric");
    await judge.getByLabel(/^Judge\ access\ code$/i, { exact: true }).fill(code);
    await judge.getByRole("button", { name: /Start\ Judging/i }).click();
    await expect(judge).toHaveURL(/\/judge/);
  };
  await judge.goto(server.url); await signIn();
  await admin.getByRole("button", { name: /Start\ Judging/i, exact: true }).click();
  await expect(judge).toHaveURL(new RegExp(`focus=${firstId}$`));
  const notes = judge.getByRole("textbox", { name: /Judge\ notes/i });
  await notes.fill("Draft survives refresh and team transitions");
  await judge.getByRole("button", { name: /Increase Technical Decisions/ }).click();
  await judge.reload();
  await expect(notes).toHaveValue("Draft survives refresh and team transitions");
  await judge.getByRole("link", { name: /Standings/i, exact: true }).click();
  await expect(judge).toHaveURL(/\/leaderboard$/);
  await expect(judge.getByRole("heading", { name: /Live\ standings/i })).toBeVisible();
  await admin.getByRole("button", { name: /Next\ Submission/i }).click();
  await expect(judge).toHaveURL(new RegExp(`focus=${second.id}$`));
  await judge.getByRole("button", { name: /All\ submissions/i }).click();
  await judge.getByRole("button", { name: /Open\ scoring\ for\ Factory\ Vision/i }).click();
  await expect(notes).toHaveValue("Draft survives refresh and team transitions");
  const judgeInfo = await judge.evaluate(() => JSON.parse(localStorage.getItem("hackfw_session_judge")!));
  const judgeToken = await judge.evaluate(() => localStorage.getItem("hackfw_session_token"));
  const saved = await fetch(`${server.url}/api/scores/${firstId}/${judgeInfo.id}`, { headers: { Authorization: `Bearer ${judgeToken}` } });
  expect(await saved.json()).toBeNull();
  assertions.push("Admin onboarding, submission form, five checks, live transitions, standings navigation and unsent draft restoration");

  // A server/network failure must leave the draft recoverable.
  await judge.route("**/api/scores", (route) => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Rehearsal outage" }) }));
  await judge.getByRole("button", { name: /Submit\ Score/i, exact: true }).click();
  await expect(judge.getByRole("alert")).toContainText("Your draft is kept");
  await expect(notes).toHaveValue("Draft survives refresh and team transitions");
  await judge.unroute("**/api/scores");

  // An expired credential sends the judge back to login without deleting drafts.
  await judge.evaluate(() => localStorage.setItem("hackfw_session_token", "expired-token"));
  await judge.getByRole("button", { name: /Submit\ Score/i, exact: true }).click();
  await expect(judge).toHaveURL(server.url + "/");
  await signIn();
  await judge.getByRole("button", { name: /All\ submissions/i }).click();
  await judge.getByRole("button", { name: /Open\ scoring\ for\ Factory\ Vision/i }).click();
  await expect(notes).toHaveValue("Draft survives refresh and team transitions");
  await judge.getByRole("button", { name: /Submit\ Score/i, exact: true }).click();
  await expect(judge.getByRole("button", { name: /✓\ Submitted/i, exact: true })).toBeVisible();
  await expect(judge.getByRole("button", { name: /✓\ Submitted/i, exact: true })).toBeDisabled();
  await judge.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (key.startsWith("hackfw_draft_")) throw new DOMException("Storage full", "QuotaExceededError");
      return original.call(this, key, value);
    };
  });
  await notes.fill("In-memory draft survives refetch when storage is full");
  await expect(judge.getByText("Unsaved changes. Keep this page open.")).toBeVisible();
  const refetched = judge.waitForResponse((response) => response.url().includes(`/api/scores/${firstId}/${judgeInfo.id}`) && response.request().method() === "GET");
  const externalUpdate = await fetch(server.url + "/api/scores", {
    method: "POST", headers: { Authorization: `Bearer ${judgeToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ project_id: firstId, judge_id: judgeInfo.id, technical_decisions: 6, product_viability: 5, venture_scalability: 5, demo_uniqueness: 5, reindustrialization_impact: 5, notes: "Server update during draft" }),
  });
  expect(externalUpdate.status).toBe(200);
  await refetched;
  await expect(notes).toHaveValue("In-memory draft survives refetch when storage is full");
  await judge.getByRole("button", { name: /Submit Score/i, exact: true }).click();
  await expect(judge.getByRole("button", { name: /✓ Submitted/i, exact: true })).toBeDisabled();
  await judge.screenshot({ path: join(out, "judge-375.png"), fullPage: true });
  await judge.setViewportSize({ width: 320, height: 812 });
  expect(await judge.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await judge.screenshot({ path: join(out, "judge-320.png"), fullPage: true });
  assertions.push("Failed submission and expired session preserve drafts; full browser storage does not overwrite in-memory edits; explicit submission persists; 320px and 375px layouts fit");

  const display = await browser.newPage({ viewport: { width: 1920, height: 1080 } }); observe(display);
  await display.goto(server.url + "/leaderboard?display=1");
  await expect(display.getByText("1st", { exact: false }).first()).toBeVisible();
  await display.screenshot({ path: join(out, "standings-1920.png"), fullPage: true });
  expect(await display.locator("body").innerText()).not.toContain("private@example.test");
  await admin.screenshot({ path: join(out, "admin-1280.png"), fullPage: true });

  // Venue network blocks WebSockets: HTTP polling must still move the stage.
  const fallbackContext = await browser.newContext({ viewport: { width: 375, height: 812 } });
  await fallbackContext.routeWebSocket("**/ws", (socket) => socket.close());
  const fallback = await fallbackContext.newPage(); observe(fallback);
  await fallback.goto(server.url + "/leaderboard");
  await expect(fallback.getByText("Reconnecting to live updates", { exact: false })).toBeVisible();
  await api(`/api/projects/${firstId}/present`, {});
  await expect(fallback.locator(".standings-onstage")).toContainText("Factory Vision", { timeout: 20_000 });
  assertions.push("Public room display renders results; blocked WebSocket falls back to polling");
  expect(runtimeErrors).toEqual([]);
  await Bun.write(join(out, "browser-report.json"), JSON.stringify({ checked_at: new Date().toISOString(), assertions, runtimeErrors }, null, 2));
  console.log(`Browser rehearsal passed (${assertions.length} groups). Evidence: ${out}`);
} catch (error) {
  let index = 0;
  for (const context of browser.contexts()) for (const page of context.pages()) {
    await page.screenshot({ path: join(out, `failure-${index}.png`), fullPage: true });
    await Bun.write(join(out, `failure-${index++}.txt`), `${page.url()}\n${await page.locator("body").innerText()}`);
  }
  console.error("Browser runtime errors:", runtimeErrors);
  throw error;
} finally {
  await browser.close();
  await server.stop();
  rmSync(directory, { recursive: true, force: true });
}
