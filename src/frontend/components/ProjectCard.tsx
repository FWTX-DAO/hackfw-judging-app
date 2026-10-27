import React, { forwardRef, useEffect, useId, useImperativeHandle, useState } from "react";
import type { CriteriaWeight, Judge, Project, ScoreData } from "../lib/types";
import { buildDefaultScore } from "../lib/types";
import { useJudgeScore, useUpsertScore } from "../hooks/useQueries";
import { notesDraftKey, parseScoreDraft, scoreDraftKey } from "../lib/drafts";
import { ScoreSlider } from "./ScoreSlider";
import { VERIFICATION_ITEMS } from "../../shared/submissions";

export type ProjectCardHandle = { expand: () => void };

export const ProjectCard = forwardRef<ProjectCardHandle, {
  project: Project;
  judge: Judge;
  criteria: CriteriaWeight[];
  highlight?: boolean;
  focused?: boolean;
  onFocusProject: () => void;
}>(function ProjectCard({ project, judge, criteria, highlight, focused = false, onFocusProject }, ref) {
  const [expanded, setExpanded] = useState(focused);
  const [score, setScore] = useState<ScoreData>(() => buildDefaultScore(criteria));
  const [dirty, setDirty] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [storageProblem, setStorageProblem] = useState(false);
  const notesId = useId();
  const scoreQ = useJudgeScore(project.id, judge.id, expanded && focused);
  const upsert = useUpsertScore();
  const criteriaKeys = criteria.map((criterion) => criterion.key).join("|");

  useImperativeHandle(ref, () => ({ expand: () => setExpanded(true) }));
  useEffect(() => { if (focused) setExpanded(true); }, [focused]);

  // Hydrate a saved grade, then overlay the device draft. Weight-only changes
  // do not reset edits; full drafts also preserve grades across refresh/navigation.
  useEffect(() => {
    if (!focused || !expanded || !scoreQ.isSuccess) return;
    // Keep in-memory edits through background refetches even if localStorage
    // is blocked or full. Only successful submission releases this draft.
    if (hydrated && dirty) return;
    let next = buildDefaultScore(criteria);
    if (scoreQ.data) {
      for (const criterion of criteria) {
        const value = scoreQ.data[criterion.key];
        if (typeof value === "number") next[criterion.key] = value;
      }
      next.notes = scoreQ.data.notes || "";
    }
    let hasDraft = false;
    try {
      const draft = parseScoreDraft(localStorage.getItem(scoreDraftKey(project.id, judge.id)), criteria);
      const legacyNotes = localStorage.getItem(notesDraftKey(project.id, judge.id));
      if (draft) { next = draft; hasDraft = true; }
      else if (legacyNotes !== null && legacyNotes !== next.notes) { next.notes = legacyNotes; hasDraft = true; }
    } catch { /* Storage may be unavailable; the in-memory grade still works. */ }
    setScore(next);
    setDirty(hasDraft);
    setHydrated(true);
    // Only criterion keys affect the score shape, never their weights.
  }, [focused, expanded, scoreQ.isSuccess, scoreQ.data, project.id, judge.id, criteriaKeys]);

  const updateDraft = (next: ScoreData) => {
    setScore(next);
    setDirty(true);
    try {
      localStorage.setItem(scoreDraftKey(project.id, judge.id), JSON.stringify({ version: 1, score: next }));
      setStorageProblem(false);
    } catch { setStorageProblem(true); }
  };

  const totalWeight = criteria.reduce((sum, criterion) => sum + criterion.weight, 0);
  const weightedTotal = totalWeight ? criteria.reduce((sum, criterion) => sum + Number(score[criterion.key] ?? 5) * criterion.weight, 0) / totalWeight : 0;
  const complete = project.requirements_met;
  const ready = hydrated && scoreQ.isSuccess;
  const submitted = !!scoreQ.data && !dirty;
  const isLive = project.presenting === 1 || highlight;
  const status = dirty
    ? storageProblem ? "Unsaved changes. Keep this page open." : "Draft saved on this device"
    : submitted ? "✓ Score submitted" : "Not submitted yet";

  const submit = async () => {
    if (!complete || !ready || upsert.isPending) return;
    try {
      await upsert.mutateAsync({ project_id: project.id, judge_id: judge.id, ...score });
      try {
        localStorage.removeItem(scoreDraftKey(project.id, judge.id));
        localStorage.removeItem(notesDraftKey(project.id, judge.id));
      } catch {}
      setDirty(false);
      setStorageProblem(false);
    } catch { /* Keep the draft intact; render the server error with retry. */ }
  };

  return (
    <article className={`card-glow judge-project-card ${isLive ? "card-glow--live" : ""} ${focused ? "judge-project-card--focused" : ""}`}>
      <button type="button" onClick={() => { if (!focused) { setExpanded(true); onFocusProject(); } else setExpanded(!expanded); }} aria-expanded={focused && expanded}
        className="judge-project-heading" aria-label={`${focused && expanded ? "Collapse" : "Open"} scoring for ${project.name}`}>
        <div style={{ minWidth: 0 }}>
          <div className="judge-project-tags">
            <span>{project.team}</span>
            {project.presenting === 1 && <span className="judge-live-label">On stage</span>}
            <span className={complete ? "judge-verified-label" : "judge-pending-label"}>{complete ? "✓ Verified & checked in" : "Verification pending"}</span>
          </div>
          <h2>{project.name}</h2>
          {project.problem_track && <p>{project.problem_track}</p>}
        </div>
        <span aria-hidden="true" className="judge-expand-mark">{focused && expanded ? "−" : "+"}</span>
      </button>

      {expanded && <form hidden={!focused} className="judge-scoring-form" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
        <details className="judge-evidence" open={!complete}>
          <summary>{complete ? "✓ 5/5 requirements verified · View submission" : `${5 - project.missing_requirements.length}/5 verified · Review requirements`}</summary>
          <p>{project.description}</p>
          <div className="judge-evidence-links">
            {project.github_url && <EvidenceLink href={project.github_url}>GitHub</EvidenceLink>}
            {project.readme_url && <EvidenceLink href={project.readme_url}>README</EvidenceLink>}
            {project.video_url && <EvidenceLink href={project.video_url}>Demo video</EvidenceLink>}
            {project.devpost_url && <EvidenceLink href={project.devpost_url}>Devpost</EvidenceLink>}
          </div>
          <ul>{VERIFICATION_ITEMS.map(({ key, label }) => <li key={key}>
            {project.missing_requirements.includes(key) ? "○ Pending:" : "✓"} {label}
          </li>)}</ul>
          {!complete && <p>Scoring unlocks after admin verification and morning check-in.</p>}
        </details>

        {!ready && <div role={scoreQ.isError ? "alert" : "status"} className="judge-score-loading">
          {scoreQ.isError ? <><p>Unable to load your saved grade. Your draft is still on this device.</p><button type="button" className="btn-secondary" onClick={() => scoreQ.refetch()}>Retry loading grade</button></> : "Loading your saved grade…"}
        </div>}
        <fieldset disabled={!ready || upsert.isPending || !complete} className="judge-score-fields">
          <legend className="sr-only">Grade each criterion from 1 to 10</legend>
          {criteria.map((criterion) => <ScoreSlider key={criterion.key} criterion={criterion}
            value={Number(score[criterion.key] ?? 5)} onChange={(value) => updateDraft({ ...score, [criterion.key]: value })} />)}
          <div className="judge-notes">
            <label htmlFor={notesId}>Judge notes <span>(optional)</span></label>
            <textarea id={notesId} value={score.notes} onChange={(event) => updateDraft({ ...score, notes: event.target.value })}
              rows={3} maxLength={10000} className="input-field" placeholder="Strengths, risks and questions for the team" />
            <p>Visible to you and the admin. Included when you submit your score.</p>
          </div>
        </fieldset>
        {upsert.isError && <p role="alert" className="judge-submit-error">Unable to submit: {(upsert.error as Error).message}. Your draft is kept. Try again.</p>}
        <div className="judge-submit-bar">
          <div className="judge-total"><span>Your score</span><strong>{weightedTotal.toFixed(1)}<small>/10</small></strong></div>
          <button type="submit" className="btn-primary" disabled={!complete || !ready || upsert.isPending || submitted}>
            {!complete ? "Awaiting verification" : !ready ? "Loading grade…" : upsert.isPending ? "Submitting…" : submitted ? "✓ Submitted" : "Submit Score"}
          </button>
          <p role="status" className={submitted ? "judge-submitted-status" : "judge-draft-status"}>{status}</p>
        </div>
      </form>}
    </article>
  );
});

function EvidenceLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <a href={href} target="_blank" rel="noreferrer">{children} ↗</a>;
}
