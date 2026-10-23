/**
 * White-labelable hackathon config.
 *
 * Copy this file, edit the values, and the app rebrands end-to-end:
 * login title, tagline, footer, authorized judges, scoring criteria,
 * theme palette. Nothing else needs to change.
 */

export type HackathonCriterion = {
  key: string;
  label: string;
  description: string;
  weight: number; // default % (auto-normalized)
};

export type HackathonBranding = {
  /** Short all-caps wordmark (shown on login + header). */
  name: string;
  /** Tagline under the title (e.g. "Judging Panel // Fort Worth DAO"). */
  title_line: string;
  /** Sub-tagline (e.g. "Convergent Technology // Accelerating Reindustrialization"). */
  tagline: string;
  /** Footer text. */
  footer: string;
  /** Gradient stops for title + highlights (amber glow by default). */
  palette: {
    primary: string;        // amber
    primary_bright: string; // amber-bright
    accent: string;         // cyber green
  };
};

export type HackathonConfig = {
  branding: HackathonBranding;
  judges: { name: string; email: string }[];
  criteria: HackathonCriterion[];
  /** Must-have submission requirements gate. */
  requirements: { problem_track: boolean; github: boolean; video: boolean; talent_registration: boolean; in_person_demo_day: boolean };
};

const config: HackathonConfig = {
  branding: {
    name: "HackFW",
    title_line: "MADE Challenge // Demo Day",
    tagline: "Rebuilding System Density",
    footer: "Fort Worth DAO + MADE // 2026",
    palette: {
      primary: "#E2673D",
      primary_bright: "#F48A5F",
      accent: "#E7ECE5",
    },
  },

  // Judges are NOT seeded from this file by default — onboard them
  // via the Admin UI (PIN-gated) after first deploy. Keeping emails
  // out of source means a public/forked repo never leaks the roster.
  //
  // If you want a deploy to seed automatically, drop a `judges` array
  // here in a private fork or via env-var bootstrap. The default ships
  // empty.
  judges: [],

  criteria: [
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
  ],

  requirements: {
    problem_track: true,
    github: true,
    video: true,
    talent_registration: true,
    in_person_demo_day: true,
  },
};

export default config;
