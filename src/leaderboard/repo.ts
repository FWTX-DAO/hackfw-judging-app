import { listProjects } from "../projects/repo";
import { listAllScores } from "../scores/repo";
import { listCriteriaWeights } from "../criteria/repo";
import { countJudges } from "../judges/repo";
import {
  avgWeightedAcrossJudges,
  checkRequirements,
  perCriterionAverages,
  weightsToMap,
} from "../scores/scoring";
import type { LeaderboardEntry, Score } from "../db/types";

export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  const [projects, scores, weights, total_judges] = await Promise.all([
    listProjects(),
    listAllScores(),
    listCriteriaWeights(),
    countJudges(),
  ]);
  const wmap = weightsToMap(weights);
  const byProject = new Map<number, Score[]>();
  for (const s of scores) {
    const arr = byProject.get(s.project_id) || [];
    arr.push(s);
    byProject.set(s.project_id, arr);
  }
  const rows: LeaderboardEntry[] = projects.map((p) => {
    const ps = byProject.get(p.id) || [];
    const avg_weighted = avgWeightedAcrossJudges(ps, wmap);
    const perCrit = perCriterionAverages(ps);
    const req = checkRequirements(p);
    return {
      ...p,
      ...perCrit,
      avg_weighted,
      judge_count: ps.length,
      total_judges,
      requirements_met: req.met,
      missing_requirements: req.missing,
    };
  });
  // Sort by weighted score desc, with deterministic tiebreakers so ties
  // don't flicker on the live display when scores nudge near each other.
  rows.sort((a, b) => {
    if (b.avg_weighted !== a.avg_weighted) return b.avg_weighted - a.avg_weighted;
    if (b.judge_count !== a.judge_count) return b.judge_count - a.judge_count;
    return a.id - b.id;
  });
  return rows;
}
