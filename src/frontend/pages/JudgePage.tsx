import React, { useCallback, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useCriteria, useProjects } from "../hooks/useQueries";
import { useAuth } from "../hooks/useSession";
import { ProjectCard, type ProjectCardHandle } from "../components/ProjectCard";
import { PresentingBanner } from "../components/PresentingBanner";
import { JudgingBriefing } from "../components/JudgingBriefing";

export function JudgePage() {
  const { auth } = useAuth();
  const nav = useNavigate();
  const params = useParams<{ projectId?: string }>();

  const projectsQ = useProjects();
  const criteriaQ = useCriteria();
  const projects = projectsQ.data ?? [];
  const criteria = criteriaQ.data ?? [];
  const isLoading = projectsQ.isPending || criteriaQ.isPending;
  const isError = projectsQ.isError || criteriaQ.isError;
  const errorMsg = (projectsQ.error || criteriaQ.error) as Error | undefined;

  const cardRefs = useRef<Map<number, ProjectCardHandle | null>>(new Map());

  const presenting = projects.find((p) => p.presenting === 1) || null;

  const gradeNow = useCallback((projectId: number) => {
    nav(`/judge?focus=${projectId}`, { replace: true });
    setTimeout(() => {
      cardRefs.current.get(projectId)?.expand();
      document.getElementById(`project-card-${projectId}`)?.scrollIntoView({
        behavior: "smooth", block: "start",
      });
    }, 80);
  }, [nav]);

  if (auth.status !== "judge") return null;

  return (
    <div className="flex flex-col gap-3">
      {presenting && <PresentingBanner project={presenting} onGradeNow={gradeNow} />}
      <JudgingBriefing />
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
      {projects.map((p) => (
        <div key={p.id} id={`project-card-${p.id}`}>
          <ProjectCard
            ref={(h) => {
              if (h) cardRefs.current.set(p.id, h);
              else cardRefs.current.delete(p.id);
            }}
            project={p}
            judge={auth.judge}
            criteria={criteria}
            highlight={p.presenting === 1}
          />
        </div>
      ))}
    </div>
  );
}
