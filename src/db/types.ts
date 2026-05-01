export type Project = {
  id: number;
  name: string;
  description: string;
  team: string;
  github_url: string;
  readme_url: string;
  video_url: string;
  devpost_url: string;
  presenting: number; // 0/1 — admin marks currently presenting
  created_at: string;
};

export type ProjectWithScore = Project & {
  avg_weighted: number;
  score_count: number;
  requirements_met: boolean;
  missing_requirements: string[];
};

export type Judge = {
  id: number;
  name: string;
  email: string;
  created_at: string;
};

export type Score = {
  id: number;
  project_id: number;
  judge_id: number;
  technical_decisions: number;
  product_viability: number;
  venture_scalability: number;
  demo_uniqueness: number;
  reindustrialization_impact: number;
  notes: string;
  created_at: string;
  updated_at: string | null;
};

export type CriteriaWeight = {
  key: string;
  label: string;
  description: string;
  weight: number;
};

export type LeaderboardEntry = Project & {
  avg_technical_decisions: number;
  avg_product_viability: number;
  avg_venture_scalability: number;
  avg_demo_uniqueness: number;
  avg_reindustrialization_impact: number;
  avg_weighted: number;
  judge_count: number;
  /** Total authorized judges on the panel — same value across all rows. */
  total_judges: number;
  requirements_met: boolean;
  missing_requirements: string[];
};

export const CRITERIA_KEYS = [
  "technical_decisions",
  "product_viability",
  "venture_scalability",
  "demo_uniqueness",
  "reindustrialization_impact",
] as const;

export type CriteriaKey = (typeof CRITERIA_KEYS)[number];

export const DEFAULT_CRITERIA: { key: CriteriaKey; label: string; description: string; weight: number }[] = [
  {
    key: "technical_decisions",
    label: "Technical Decisions",
    description: "Quality of architecture, stack choices, engineering rigor, and execution",
    weight: 20,
  },
  {
    key: "product_viability",
    label: "Product / Solution Viability",
    description: "Does it solve a real problem well? Usability, feasibility, market fit",
    weight: 20,
  },
  {
    key: "venture_scalability",
    label: "Venture & Scalability",
    description: "Can this become a business? GTM, unit economics, scale potential",
    weight: 20,
  },
  {
    key: "demo_uniqueness",
    label: "Demo Functionality & Uniqueness",
    description: "Working demo that shows differentiation from existing solutions",
    weight: 20,
  },
  {
    key: "reindustrialization_impact",
    label: "Reindustrialization Impact",
    description: "How well does this accelerate Fort Worth / US reindustrialization",
    weight: 20,
  },
];

// Judges are NOT seeded by default — admin onboards them via the UI.
// Kept as an empty export so legacy fallback logic compiles cleanly.
export const SEED_JUDGES: { name: string; email: string }[] = [];
