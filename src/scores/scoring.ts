import { CRITERIA_KEYS, type CriteriaKey, type CriteriaWeight, type Score } from "../db/types";
export { checkSubmissionRequirements as checkRequirements } from "../shared/submissions";

export type WeightMap = Partial<Record<CriteriaKey, number>>;

export function weightsToMap(weights: CriteriaWeight[]): WeightMap {
  const map: WeightMap = {};
  for (const w of weights) {
    if ((CRITERIA_KEYS as readonly string[]).includes(w.key)) {
      map[w.key as CriteriaKey] = w.weight;
    }
  }
  return map;
}

/**
 * Matrix-weighted score for a single judge's scorecard.
 *
 * score vector: s = [s_1 .. s_n], each s_i ∈ [1, 10]
 * weight vector: w = [w_1 .. w_n], each w_i >= 0
 * weighted = (w · s) / Σw  →  normalized back onto the 1-10 scale.
 */
export function calcWeightedScore(score: Score, weights: WeightMap): number {
  const totalWeight = CRITERIA_KEYS.reduce((sum, k) => sum + (weights[k] || 0), 0);
  if (totalWeight === 0) return 0;
  const raw = CRITERIA_KEYS.reduce((sum, k) => sum + score[k] * (weights[k] || 0), 0);
  return raw / totalWeight;
}

/** Average weighted score across N judges. Returns 0 if none. */
export function avgWeightedAcrossJudges(scores: Score[], weights: WeightMap): number {
  if (scores.length === 0) return 0;
  const total = scores.reduce((sum, s) => sum + calcWeightedScore(s, weights), 0);
  return +(total / scores.length).toFixed(2);
}

/** Per-criterion average across all judges (1-decimal). */
export function perCriterionAverages(scores: Score[]): Record<`avg_${CriteriaKey}`, number> {
  const out = {} as Record<`avg_${CriteriaKey}`, number>;
  for (const k of CRITERIA_KEYS) {
    out[`avg_${k}`] = scores.length
      ? +(scores.reduce((sum, s) => sum + s[k], 0) / scores.length).toFixed(1)
      : 0;
  }
  return out;
}
