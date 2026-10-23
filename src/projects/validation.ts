import type { Project } from "../db/types";
import { isProblemTrack, parseTeamMembers, VERIFICATION_ITEMS } from "../shared/submissions";
import { sanitizeUrl } from "../util/url";

export class ProjectInputError extends Error {}

export function parseProjectInput(input: unknown, partial = false): Partial<Project> {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new ProjectInputError("Expected a submission object");
  const body = input as Record<string, unknown>;
  const patch: Partial<Project> = {};
  for (const field of ["name", "description", "team", "problem_track"] as const) {
    if (body[field] === undefined) continue;
    if (typeof body[field] !== "string") throw new ProjectInputError(`${field} must be text`);
    patch[field] = body[field].trim();
  }
  if (body.team_members !== undefined) {
    try { patch.team_members = parseTeamMembers(body.team_members); }
    catch (error) { throw new ProjectInputError((error as Error).message); }
  }
  for (const field of ["name", "description", "team"] as const) {
    if ((!partial || field in patch) && !patch[field]) throw new ProjectInputError(`${field} is required`);
  }
  if (patch.problem_track && !isProblemTrack(patch.problem_track)) throw new ProjectInputError("Choose one of the five problem tracks");
  for (const field of ["github_url", "readme_url", "video_url", "devpost_url"] as const) {
    if (body[field] === undefined) continue;
    if (typeof body[field] !== "string") throw new ProjectInputError(`${field} must be a URL`);
    patch[field] = sanitizeUrl(body[field]);
    if (body[field].trim() && !patch[field]) throw new ProjectInputError(`${field} must use http or https`);
  }
  for (const { field } of VERIFICATION_ITEMS) {
    if (body[field] === undefined) continue;
    if (![true, false, 0, 1].includes(body[field] as boolean | number)) throw new ProjectInputError(`${field} must be a checkbox value`);
    patch[field] = body[field] === true || body[field] === 1 ? 1 : 0;
  }
  return patch;
}
