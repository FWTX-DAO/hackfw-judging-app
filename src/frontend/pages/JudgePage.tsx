import React, { useCallback, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useCriteria, useProjects } from "../hooks/useQueries";
import { useAuth } from "../hooks/useSession";
import { ProjectCard, type ProjectCardHandle } from "../components/ProjectCard";
import { JudgingBriefing } from "../components/JudgingBriefing";

export function JudgePage() {
  const { auth } = useAuth();
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const focusedProjectId = Number(searchParams.get("focus"));

  const projectsQ = useProjects();
  const criteriaQ = useCriteria();
  const projects = projectsQ.data ?? [];
  const criteria = criteriaQ.data ?? [];
  const isLoading = projectsQ.isPending || criteriaQ.isPending;
  const isError = projectsQ.isError || criteriaQ.isError;
  const errorMsg = (projectsQ.error || criteriaQ.error) as Error | undefined;

  const cardRefs = useRef<Map<number, ProjectCardHandle | null>>(new Map());

  const presenting = projects.find((p) => p.presenting === 1) || null;
  const focusedProject = projects.find((p) => p.id === focusedProjectId) ?? null;

  const openProject = useCallback((projectId: number) => {
    cardRefs.current.get(projectId)?.expand();
    const card = document.getElementById(`project-card-${projectId}`);
    card?.focus({ preventScroll: true });
    card?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
      block: "start",
    });
  }, []);

  useEffect(() => {
    if (!focusedProjectId || isLoading || isError) return;
    const frame = window.requestAnimationFrame(() => openProject(focusedProjectId));
    return () => window.cancelAnimationFrame(frame);
  }, [focusedProjectId, isLoading, isError, openProject]);

  const gradeNow = useCallback((projectId: number) => {
    nav(`/judge?focus=${projectId}`, { replace: true });
    openProject(projectId);
  }, [nav, openProject]);

  if (auth.status !== "judge") return null;

  return (
    <div className="judge-page">
      <div className="judge-page-heading">
        <h1>{focusedProject ? "Score submission" : "Judge submissions"}</h1>
        {focusedProject && <button className="btn-secondary" onClick={() => { nav("/judge?view=all"); window.scrollTo({ top: 0, behavior: "instant" }); }}>All submissions</button>}
      </div>
      <p role="status" className="judge-stage-status">
        {focusedProject ? `Scoring: ${focusedProject.name}` : presenting ? `On stage: ${presenting.name}` : "Waiting for the next team. You can finish previous grades below."}
      </p>
      <details className="judge-transition-note">
        <summary>How team transitions work</summary>
        <p>
          When the admin brings a team on stage, your view switches to its scoring panel automatically.
          Grade each criterion, add notes, then select <strong>Submit Score</strong>.
          Switching teams does not submit your score.
        </p>
      </details>
      {!focusedProject && presenting && <div className="judge-live-shortcut">
        <div><span>On stage now</span><strong>{presenting.name}</strong></div>
        <button className="btn-primary" onClick={() => gradeNow(presenting.id)}>Score live team</button>
      </div>}
      {isLoading && (
        <p className="text-center py-12" style={{ color: "var(--color-text-tertiary)" }}>
          // Loading submissions…
        </p>
      )}
      {!isLoading && isError && (
        <p className="text-center py-12" style={{ color: "var(--color-rust)" }}>
          // Failed to load: {errorMsg?.message || "unknown error"}
        </p>
      )}
      {!isLoading && !isError && projects.length === 0 && (
        <p className="text-center py-12" style={{ color: "var(--color-text-tertiary)" }}>
          // No submissions to score yet
        </p>
      )}
      {criteria.length > 0 && projects.map((p) => (
        <div key={p.id} id={`project-card-${p.id}`} className="judge-project-region" hidden={!!focusedProject && p.id !== focusedProject.id} role="region" aria-label={`${p.name} scoring`} tabIndex={-1}>
          <ProjectCard
            ref={(h) => {
              if (h) cardRefs.current.set(p.id, h);
              else cardRefs.current.delete(p.id);
            }}
            project={p}
            judge={auth.judge}
            criteria={criteria}
            highlight={p.presenting === 1}
            focused={p.id === focusedProjectId}
            onFocusProject={() => nav(`/judge?focus=${p.id}`)}
          />
        </div>
      ))}
      <div id="judge-guide" style={{ scrollMarginTop: 16 }}><JudgingBriefing /></div>
    </div>
  );
}
