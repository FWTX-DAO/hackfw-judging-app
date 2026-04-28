// Frontend-local type aliases. Keep in sync with backend (src/db/types.ts).

export type Project = {
  id: number;
  name: string;
  description: string;
  team: string;
  github_url: string;
  readme_url: string;
  video_url: string;
  devpost_url: string;
  presenting: number; // 0 or 1
  avg_weighted: number;
  score_count: number;
  requirements_met: boolean;
  missing_requirements: string[];
};

export type Judge = {
  id: number;
  name: string;
  email: string;
};

export type CriteriaWeight = {
  key: string;
  label: string;
  description: string;
  weight: number;
};

export type ScoreData = {
  notes: string;
  [criterion: string]: number | string;
};

export type LeaderboardEntry = Project & {
  avg_technical_decisions: number;
  avg_product_viability: number;
  avg_venture_scalability: number;
  avg_demo_uniqueness: number;
  avg_reindustrialization_impact: number;
  judge_count: number;
};

export type Branding = {
  name: string;
  title_line: string;
  tagline: string;
  footer: string;
  palette: { primary: string; primary_bright: string; accent: string };
};

export type AppConfig = {
  branding: Branding;
  requirements: { github: boolean; readme: boolean; video: boolean };
};

export const DEFAULT_BRANDING: Branding = {
  name: "HackFW",
  title_line: "Scaling Fort Worth Builders",
  tagline: "Convergent Technology // Accelerating Reindustrialization",
  footer: "FWTX DAO // Convergent Technology // 2026",
  palette: { primary: "#F59E0B", primary_bright: "#FCD34D", accent: "#00E5A0" },
};

export function buildDefaultScore(criteria: CriteriaWeight[]): ScoreData {
  const s: ScoreData = { notes: "" } as ScoreData;
  for (const c of criteria) s[c.key] = 5;
  return s;
}
