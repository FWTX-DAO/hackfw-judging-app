import { db } from "../db/client";
import type { Project } from "../db/types";
import { checkSubmissionRequirements, isGithubRepository, isProblemTrack, parseTeamMembers } from "../shared/submissions";
import { ProjectInputError } from "./validation";

const SAFE_FIELDS = [
  "name",
  "description",
  "team",
  "github_url",
  "readme_url",
  "video_url",
  "devpost_url",
  "presenting",
  "problem_track",
  "team_members",
  "track_verified",
  "github_verified",
  "video_verified",
  "talent_verified",
  "attendance_verified",
  "checked_in_at",
] as const;

type SafeField = (typeof SAFE_FIELDS)[number];

function decodeProject(row: unknown): Project {
  const project = row as Project;
  return { ...project, team_members: parseTeamMembers(project.team_members ?? []) };
}

export async function listProjects(): Promise<Project[]> {
  const r = await db.execute("SELECT * FROM projects ORDER BY created_at DESC, id DESC");
  return r.rows.map(decodeProject);
}

export async function getProject(id: number): Promise<Project | null> {
  const r = await db.execute({
    sql: "SELECT * FROM projects WHERE id = ? LIMIT 1",
    args: [id],
  });
  if (r.rows.length === 0) return null;
  return decodeProject(r.rows[0]);
}

export async function addProject(
  data: Partial<Project> & { name: string; description: string; team: string }
): Promise<number> {
  const r = await db.execute({
    sql: `INSERT INTO projects (name, description, team, github_url, readme_url, video_url, devpost_url, problem_track, team_members)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      data.name,
      data.description,
      data.team,
      data.github_url || "",
      data.readme_url || "",
      data.video_url || "",
      data.devpost_url || "",
      data.problem_track || "",
      JSON.stringify(data.team_members ?? []),
    ],
  });
  return Number(r.lastInsertRowid);
}

export async function updateProject(id: number, input: Partial<Project>): Promise<boolean> {
  const transaction = await db.transaction("write");
  try {
    const result = await transaction.execute({ sql: "SELECT * FROM projects WHERE id = ?", args: [id] });
    const current = result.rows[0] ? decodeProject(result.rows[0]) : undefined;
    if (!current) return false;
    const patch = { ...input };
    const changed = (field: keyof Project) => patch[field] !== undefined && JSON.stringify(patch[field]) !== JSON.stringify(current[field]);
    if (changed("problem_track")) patch.track_verified = 0;
    if (changed("github_url")) patch.github_verified = 0;
    if (changed("video_url")) patch.video_verified = 0;
    if (changed("team") || changed("team_members")) {
      patch.talent_verified = 0;
      patch.attendance_verified = 0;
    }
    const next = { ...current, ...patch };
    if (next.track_verified === 1 && !isProblemTrack(next.problem_track)) throw new ProjectInputError("Select a problem track before verifying it");
    if (next.github_verified === 1 && !isGithubRepository(next.github_url)) throw new ProjectInputError("Add a GitHub repository URL before verifying public access");
    if (next.video_verified === 1 && !next.video_url) throw new ProjectInputError("Add the demo video URL before verifying it");
    if ((next.talent_verified === 1 || next.attendance_verified === 1) && !next.team_members.length) throw new ProjectInputError("Add the participant roster before confirming registration or check-in");
    if (patch.attendance_verified !== undefined) {
      patch.checked_in_at = next.attendance_verified === 1 ? current.checked_in_at ?? new Date().toISOString() : null;
      next.checked_in_at = patch.checked_in_at;
    }
    // An edit that invalidates verification also takes that team off stage.
    if (!checkSubmissionRequirements(next).met) patch.presenting = 0;
    const fields = SAFE_FIELDS.filter((key) => patch[key] !== undefined);
    if (fields.length) {
      await transaction.execute({
        sql: `UPDATE projects SET ${fields.map((key) => `${key} = ?`).join(", ")} WHERE id = ?`,
        args: [...fields.map((key) => key === "team_members" ? JSON.stringify(patch.team_members) : patch[key] as string | number | null), id],
      });
    }
    await transaction.commit();
    return true;
  } finally { transaction.close(); }
}

export async function deleteProject(id: number): Promise<void> {
  await db.execute({
    sql: "DELETE FROM projects WHERE id = ?",
    args: [id],
  });
}

export async function setPresenting(id: number): Promise<void> {
  // Atomic single-statement swap so concurrent admin actions can't observe
  // a window with zero or two presenters.
  await db.execute({
    sql: "UPDATE projects SET presenting = CASE WHEN id = ? THEN 1 ELSE 0 END",
    args: [id],
  });
}

export async function clearPresenting(): Promise<void> {
  await db.execute("UPDATE projects SET presenting = 0 WHERE presenting = 1");
}
