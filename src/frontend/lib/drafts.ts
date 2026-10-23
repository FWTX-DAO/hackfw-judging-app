import type { CriteriaWeight, ScoreData } from "./types";

export const scoreDraftKey = (projectId: number, judgeId: number) => `hackfw_draft_score_${projectId}_${judgeId}`;
export const notesDraftKey = (projectId: number, judgeId: number) => `hackfw_draft_notes_${projectId}_${judgeId}`;

export function parseScoreDraft(raw: string | null, criteria: CriteriaWeight[]): ScoreData | null {
  if (!raw) return null;
  try {
    const draft = JSON.parse(raw);
    if (draft?.version !== 1 || typeof draft.score?.notes !== "string") return null;
    const score: ScoreData = { notes: draft.score.notes };
    for (const criterion of criteria) {
      const value = draft.score[criterion.key];
      if (!Number.isInteger(value) || value < 1 || value > 10) return null;
      score[criterion.key] = value;
    }
    return score;
  } catch { return null; }
}
