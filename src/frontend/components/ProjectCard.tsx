import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { CriteriaWeight, Judge, Project, ScoreData } from "../lib/types";
import { buildDefaultScore } from "../lib/types";
import { useJudgeScore, useUpsertScore } from "../hooks/useQueries";
import { ScoreSlider } from "./ScoreSlider";

export type ProjectCardHandle = { expand: () => void };

/** localStorage key for draft notes — survives refresh before score submission. */
const draftKey = (projectId: number, judgeId: number) =>
  `hackfw_draft_notes_${projectId}_${judgeId}`;

export const ProjectCard = forwardRef<
  ProjectCardHandle,
  {
    project: Project;
    judge: Judge;
    criteria: CriteriaWeight[];
    highlight?: boolean;
  }
>(function ProjectCard({ project, judge, criteria, highlight }, ref) {
  const [expanded, setExpanded] = useState(false);
  const [score, setScore] = useState<ScoreData>(() => buildDefaultScore(criteria));
  const [saved, setSaved] = useState(false);
  const [notesState, setNotesState] = useState<"synced" | "draft" | "saving">("synced");
  const draftTimer = useRef<number | null>(null);

  useImperativeHandle(ref, () => ({ expand: () => setExpanded(true) }));

  const scoreQ = useJudgeScore(project.id, judge.id, expanded);
  const upsert = useUpsertScore();

  // On expand: hydrate from server, then overlay any local draft notes
  useEffect(() => {
    if (!expanded) return;
    if (scoreQ.isSuccess) {
      const s = scoreQ.data as any;
      const next: ScoreData = { notes: "" } as ScoreData;
      for (const c of criteria) next[c.key] = 5;
      if (s && typeof s === "object") {
        for (const c of criteria) {
          next[c.key] = typeof s[c.key] === "number" ? s[c.key] : 5;
        }
        next.notes = s.notes || "";
      }
      // Prefer unsynced local draft if it differs from server
      try {
        const draft = localStorage.getItem(draftKey(project.id, judge.id));
        if (draft !== null && draft !== next.notes) {
          next.notes = draft;
          setNotesState("draft");
        } else {
          setNotesState("synced");
        }
      } catch {}
      setScore(next);
    }
  }, [expanded, scoreQ.isSuccess, scoreQ.data, criteria, project.id, judge.id]);

  const weightedTotal = (() => {
    const totalW = criteria.reduce((s, c) => s + c.weight, 0);
    if (totalW === 0) return 0;
    return criteria.reduce((s, c) => s + ((score[c.key] as number) || 0) * c.weight, 0) / totalW;
  })();

  const submit = async () => {
    const body: { project_id: number; judge_id: number; notes: string; [k: string]: any } = {
      project_id: project.id,
      judge_id: judge.id,
      notes: score.notes,
    };
    for (const c of criteria) body[c.key] = score[c.key];
    await upsert.mutateAsync(body);
    // Clear draft — it's now in the DB
    try { localStorage.removeItem(draftKey(project.id, judge.id)); } catch {}
    setNotesState("synced");
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  // Debounced local draft persistence (250ms) — notes survive refresh
  const onNotesChange = (val: string) => {
    setScore((prev) => ({ ...prev, notes: val }));
    setNotesState("draft");
    if (draftTimer.current) window.clearTimeout(draftTimer.current);
    draftTimer.current = window.setTimeout(() => {
      try { localStorage.setItem(draftKey(project.id, judge.id), val); } catch {}
    }, 250);
  };

  const complete = project.requirements_met;
  const isPresenting = project.presenting === 1;
  const isLive = isPresenting || highlight;

  return (
    <div className={`card-glow ${isLive ? "card-glow--live" : ""}`} style={{ overflow: "hidden" }}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left flex items-center justify-between"
        style={{ background: "transparent", border: "none", padding: 18, cursor: "pointer" }}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center flex-wrap gap-2 mb-1">
            <span className="chip chip--team">{project.team}</span>
            {isPresenting && (
              <span className="serial-plate serial-plate--live flicker">
                <span className="dot" />Live
              </span>
            )}
            {complete ? (
              <span className="chip chip--ok">✓ Complete</span>
            ) : (
              <span className="chip chip--warn" title={`Missing: ${project.missing_requirements.join(", ")}`}>
                ⚠ Incomplete
              </span>
            )}
          </div>
          <h3 className="stencil" style={{ fontSize: "1.4rem", color: "var(--color-bone)", lineHeight: 1.05 }}>
            {project.name}
          </h3>
          <p className="mt-2" style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>
            {project.description}
          </p>
          {(project.github_url || project.readme_url || project.video_url || project.devpost_url) && (
            <div className="flex flex-wrap mt-3" style={{ gap: 16, fontSize: 10 }}>
              {project.github_url && <LinkChip href={project.github_url} label="GITHUB" />}
              {project.readme_url && <LinkChip href={project.readme_url} label="README" />}
              {project.video_url && <LinkChip href={project.video_url} label="VIDEO" />}
              {project.devpost_url && <LinkChip href={project.devpost_url} label="DEVPOST" />}
            </div>
          )}
        </div>
        <div className="flex items-center" style={{ gap: 18, marginLeft: 16, flexShrink: 0 }}>
          {project.score_count > 0 && (
            <div style={{ textAlign: "right" }}>
              <span className="serial" style={{ fontSize: 9 }}>Weighted</span>
              <div className="score-badge" style={{ fontSize: "1.8rem", lineHeight: 1 }}>
                {project.avg_weighted.toFixed(1)}
              </div>
              <span className="serial" style={{ fontSize: 9 }}>
                {project.score_count} judge{project.score_count !== 1 ? "s" : ""}
              </span>
            </div>
          )}
          <svg
            style={{
              width: 14, height: 14,
              color: "var(--color-text-tertiary)",
              transform: expanded ? "rotate(180deg)" : undefined,
              transition: "transform 0.2s",
            }}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {expanded && (
        <div className="animate-in" style={{ borderTop: "1px solid var(--color-border-strong)", padding: 18, display: "flex", flexDirection: "column", gap: 16 }}>
          {!complete && (
            <div className="chip chip--warn" style={{ padding: "10px 12px", fontSize: 10 }}>
              ⚠ Missing required items: <strong>{project.missing_requirements.join(", ")}</strong>. Scoring still allowed.
            </div>
          )}
          {criteria.map((c) => (
            <ScoreSlider
              key={c.key}
              criterion={c}
              value={(score[c.key] as number) ?? 5}
              onChange={(v) => setScore((prev) => ({ ...prev, [c.key]: v }))}
            />
          ))}
          <div
            style={{
              padding: "12px 14px",
              background: "linear-gradient(180deg, var(--color-ink) 0%, #09090C 100%)",
              border: "1px solid var(--color-border-strong)",
              borderLeft: "3px solid var(--color-cyber)",
              borderRadius: 2,
            }}
          >
            <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
              <div className="flex items-center gap-2">
                <span
                  style={{
                    width: 6, height: 6, borderRadius: "50%",
                    background: "var(--color-cyber)", boxShadow: "0 0 6px var(--glow-cyber)",
                  }}
                />
                <span className="stencil" style={{ fontSize: 13, color: "var(--color-bone)", letterSpacing: "0.1em" }}>
                  Judge Notes
                </span>
                <span className="serial" style={{ fontSize: 10 }}>
                  Private // admin-visible
                </span>
              </div>
              <NotesStatus state={notesState} />
            </div>
            <textarea
              value={score.notes}
              onChange={(e) => onNotesChange(e.target.value)}
              rows={4}
              className="input-field"
              style={{ resize: "vertical", minHeight: 90, fontSize: 13, lineHeight: 1.55 }}
              placeholder="What stood out? What's the risk? Questions for Q&A? Ties you back to reindustrialization?"
            />
            <p className="serial mt-2" style={{ fontSize: 10, color: "var(--color-text-secondary)", lineHeight: 1.55 }}>
              Drafts auto-save locally as you type · fully persisted in the database when you submit the score.
              Visible only to admin and the submitting judge.
            </p>
          </div>
          <div className="flex items-center justify-between flex-wrap gap-3" style={{ paddingTop: 4 }}>
            <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
              <span className="serial" style={{ marginRight: 8 }}>Weighted</span>
              <span className="score-badge score-badge--amber" style={{ fontSize: "1.6rem", verticalAlign: "middle" }}>
                {weightedTotal.toFixed(1)}
              </span>
              <span className="serial" style={{ marginLeft: 6 }}>/ 10</span>
            </div>
            {upsert.isError && (
              <span className="chip chip--danger">{(upsert.error as Error).message}</span>
            )}
            <button onClick={submit} disabled={upsert.isPending} className="btn-primary">
              {upsert.isPending ? "Saving…" : saved ? "✓ Saved" : "Submit Score"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

function NotesStatus({ state }: { state: "synced" | "draft" | "saving" }) {
  if (state === "synced") {
    return <span className="chip chip--ok" style={{ padding: "2px 7px", fontSize: 9 }}>✓ Synced to DB</span>;
  }
  if (state === "saving") {
    return <span className="chip" style={{ padding: "2px 7px", fontSize: 9 }}>◌ Saving…</span>;
  }
  return (
    <span
      className="chip"
      style={{
        padding: "2px 7px", fontSize: 9,
        color: "var(--color-amber-bright)",
        borderColor: "var(--color-border-amber)",
        background: "var(--dim-amber)",
      }}
    >
      ● Draft (local)
    </span>
  );
}

function LinkChip({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      style={{
        fontFamily: "var(--font-mono)",
        fontWeight: 600,
        letterSpacing: "0.22em",
        color: "var(--color-amber)",
        textDecoration: "none",
        borderBottom: "1px dashed rgba(255, 184, 0, 0.35)",
        paddingBottom: 1,
      }}
      onMouseEnter={(e) => (e.currentTarget.style.color = "var(--color-amber-bright)")}
      onMouseLeave={(e) => (e.currentTarget.style.color = "var(--color-amber)")}
    >
      ↗ {label}
    </a>
  );
}
