import { listProjects } from "../projects/repo";
import { listAllScores } from "../scores/repo";
import { listCriteriaWeights } from "../criteria/repo";
import {
  avgWeightedAcrossJudges,
  checkRequirements,
  perCriterionAverages,
  weightsToMap,
} from "../scores/scoring";
import type { LeaderboardEntry, Score } from "../db/types";

export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  const [projects, scores, weights] = await Promise.all([
    listProjects(),
    listAllScores(),
    listCriteriaWeights(),
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
      requirements_met: req.met,
      missing_requirements: req.missing,
    };
  });
  rows.sort((a, b) => b.avg_weighted - a.avg_weighted);
  return rows;
}
