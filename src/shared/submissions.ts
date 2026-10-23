export const PROBLEM_TRACKS = [
  "AI for Manufacturing",
  "Supplier Relationship Management",
  "AI for Transportation",
  "Tokenized Industrial Real Estate",
  "Open Forum",
] as const;

export const VERIFICATION_ITEMS = [
  { key: "track", field: "track_verified", label: "Problem track", description: "The submission names one of the five challenge tracks." },
  { key: "github", field: "github_verified", label: "Public GitHub repository", description: "Open the repository and confirm the working solution is publicly accessible." },
  { key: "video", field: "video_verified", label: "End-to-end demo video", description: "Watch the recording and confirm it shows the system running end to end." },
  { key: "talent", field: "talent_verified", label: "Talent registration", description: "Confirm every listed participant is registered at talent.fwtx.city." },
  { key: "attendance", field: "attendance_verified", label: "In-person Demo Day check-in", description: "Check the team in on Demo Day morning before judging begins." },
] as const;

export type VerificationField = (typeof VERIFICATION_ITEMS)[number]["field"];
export type TeamMember = { name: string; email?: string };

/** Canonical roster shape, with compatibility for earlier newline imports. */
export function parseTeamMembers(input: unknown): TeamMember[] {
  if (typeof input === "string") {
    const text = input.trim();
    input = text.startsWith("[") ? JSON.parse(text) : text.split("\n").map((name) => name.trim()).filter(Boolean).map((name) => ({ name }));
  }
  if (!Array.isArray(input)) throw new Error("team_members must be an array of participant objects");
  return input.map((member) => {
    if (!member || typeof member !== "object" || Array.isArray(member) || typeof member.name !== "string" || !member.name.trim()) {
      throw new Error("Every participant needs a name");
    }
    if (member.email !== undefined && typeof member.email !== "string") throw new Error("Participant email must be text");
    const email = member.email?.trim().toLowerCase();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid participant email");
    return { name: member.name.trim(), ...(email ? { email } : {}) };
  });
}

export function publicTeamMembers(members: TeamMember[]): TeamMember[] {
  return members.map(({ name }) => ({ name }));
}

export type SubmissionDetails = {
  problem_track: string;
  team_members: TeamMember[];
  track_verified: number;
  github_verified: number;
  video_verified: number;
  talent_verified: number;
  attendance_verified: number;
  checked_in_at: string | null;
};

export function isProblemTrack(value: string): boolean {
  return (PROBLEM_TRACKS as readonly string[]).includes(value);
}

export function isGithubRepository(value: string): boolean {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol)
      && ["github.com", "www.github.com"].includes(url.hostname)
      && url.pathname.split("/").filter(Boolean).length >= 2;
  } catch { return false; }
}

/** A populated link is evidence to review, never an automatic verification. */
export function checkSubmissionRequirements(project: Partial<SubmissionDetails> & { github_url?: string; video_url?: string }) {
  const missing: string[] = [];
  if (!isProblemTrack(project.problem_track ?? "") || project.track_verified !== 1) missing.push("track");
  if (!isGithubRepository(project.github_url ?? "") || project.github_verified !== 1) missing.push("github");
  if (!project.video_url?.trim() || project.video_verified !== 1) missing.push("video");
  if (!project.team_members?.length || project.talent_verified !== 1) missing.push("talent");
  if (!project.team_members?.length || project.attendance_verified !== 1 || !project.checked_in_at) missing.push("attendance");
  return { met: missing.length === 0, missing };
}

export function requirementLabel(key: string): string {
  return VERIFICATION_ITEMS.find((item) => item.key === key)?.label ?? key;
}
