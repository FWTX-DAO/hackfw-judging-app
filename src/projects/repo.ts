import { db } from "../db/client";
import type { Project } from "../db/types";

const SAFE_FIELDS = [
  "name",
  "description",
  "team",
  "github_url",
  "readme_url",
  "video_url",
  "devpost_url",
  "presenting",
] as const;

type SafeField = (typeof SAFE_FIELDS)[number];

export async function listProjects(): Promise<Project[]> {
  const r = await db.execute("SELECT * FROM projects ORDER BY created_at DESC, id DESC");
  return r.rows as unknown as Project[];
}

export async function getProject(id: number): Promise<Project | null> {
  const r = await db.execute({
    sql: "SELECT * FROM projects WHERE id = ? LIMIT 1",
    args: [id],
  });
  if (r.rows.length === 0) return null;
  return r.rows[0] as unknown as Project;
}

export async function addProject(
  data: Partial<Project> & { name: string; description: string; team: string }
): Promise<number> {
  const r = await db.execute({
    sql: `INSERT INTO projects (name, description, team, github_url, readme_url, video_url, devpost_url, presenting)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      data.name,
      data.description,
      data.team,
      data.github_url || "",
      data.readme_url || "",
      data.video_url || "",
      data.devpost_url || "",
      data.presenting ? 1 : 0,
    ],
  });
  return Number(r.lastInsertRowid);
}

export async function updateProject(id: number, patch: Partial<Project>): Promise<void> {
  const sets: string[] = [];
  const args: any[] = [];
  for (const key of SAFE_FIELDS) {
    if (patch[key] !== undefined) {
      sets.push(`${key} = ?`);
      if (key === "presenting") {
        args.push(patch[key] ? 1 : 0);
      } else {
        args.push(patch[key]);
      }
    }
  }
  if (sets.length === 0) return;
  args.push(id);
  await db.execute({
    sql: `UPDATE projects SET ${sets.join(", ")} WHERE id = ?`,
    args,
  });
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
