import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useProjects } from "../hooks/useQueries";

/** Keep signed-in judges with the stage, including judges viewing standings. */
export function LiveJudgingSync() {
  const projectsQ = useProjects();
  const navigate = useNavigate();
  const presentingId = projectsQ.data?.find((project) => project.presenting === 1)?.id ?? null;
  const previousId = useRef<number | null>(null);

  useEffect(() => {
    if (!projectsQ.isSuccess) return;
    const changed = previousId.current !== presentingId;
    previousId.current = presentingId;
    if (changed && presentingId !== null) {
      navigate(`/judge?focus=${presentingId}`, { replace: true });
    }
  }, [presentingId, projectsQ.isSuccess, navigate]);

  return null;
}
