import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { qk } from "../lib/queryClient";
import type {
  AppConfig,
  CriteriaWeight,
  Judge,
  LeaderboardEntry,
  Project,
  ScoreData,
} from "../lib/types";

// ─── Queries ────────────────────────────────────────────────

export function useAppConfig() {
  return useQuery({
    queryKey: qk.config,
    queryFn: () => api<AppConfig>("/api/config"),
    staleTime: 60 * 60_000, // config rarely changes
  });
}

export function useProjects() {
  return useQuery({
    queryKey: qk.projects,
    queryFn: () => api<Project[]>("/api/projects"),
  });
}

export function useCriteria() {
  return useQuery({
    queryKey: qk.criteria,
    queryFn: () => api<CriteriaWeight[]>("/api/criteria"),
  });
}

export function useJudges() {
  return useQuery({
    queryKey: qk.judges,
    queryFn: () => api<Judge[]>("/api/judges"),
  });
}

export function useLeaderboard() {
  return useQuery({
    queryKey: qk.leaderboard,
    queryFn: () => api<LeaderboardEntry[]>("/api/leaderboard"),
  });
}

export function useJudgeScore(projectId: number, judgeId: number, enabled = true) {
  return useQuery({
    queryKey: qk.score(projectId, judgeId),
    queryFn: () => api<ScoreData | null>(`/api/scores/${projectId}/${judgeId}`),
    enabled,
  });
}

// ─── Mutations ──────────────────────────────────────────────

export function useAuthJudge() {
  return useMutation({
    mutationFn: (email: string) =>
      api<Judge & { token: string }>("/api/auth", {
        method: "POST",
        body: JSON.stringify({ email }),
      }),
  });
}

export function useAuthAdmin() {
  return useMutation({
    mutationFn: (pin: string) =>
      api<{ ok: true; token: string }>("/api/admin/auth", {
        method: "POST",
        body: JSON.stringify({ pin }),
      }),
  });
}

export function useUpsertScore() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      project_id: number;
      judge_id: number;
      notes?: string;
      [criterion: string]: any;
    }) => api("/api/scores", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: qk.score(vars.project_id, vars.judge_id) });
      qc.invalidateQueries({ queryKey: qk.projects });
      qc.invalidateQueries({ queryKey: qk.leaderboard });
    },
  });
}

export function useAddProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<Project> & { name: string; description: string; team: string }) =>
      api<{ id: number }>("/api/projects", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.projects });
      qc.invalidateQueries({ queryKey: qk.leaderboard });
    },
  });
}

export function useBulkProjects() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (items: any[]) =>
      api<{ created: number; inserted: number }>("/api/projects/bulk", {
        method: "POST",
        body: JSON.stringify({ items }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.projects });
      qc.invalidateQueries({ queryKey: qk.leaderboard });
    },
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api(`/api/projects/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.projects });
      qc.invalidateQueries({ queryKey: qk.leaderboard });
    },
  });
}

export function useSetPresenting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api(`/api/projects/${id}/present`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.projects });
      qc.invalidateQueries({ queryKey: qk.leaderboard });
    },
  });
}

export function useClearPresenting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api(`/api/projects/clear-presenting`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.projects });
      qc.invalidateQueries({ queryKey: qk.leaderboard });
    },
  });
}

export function useAddJudge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; email: string }) =>
      api<{ id: number }>("/api/judges", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.judges }),
  });
}

export function useDeleteJudge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api(`/api/judges/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.judges }),
  });
}

export function useUpdateCriteriaWeight() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ key, weight }: { key: string; weight: number }) =>
      api(`/api/criteria/${key}`, { method: "PUT", body: JSON.stringify({ weight }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.criteria });
      qc.invalidateQueries({ queryKey: qk.projects });
      qc.invalidateQueries({ queryKey: qk.leaderboard });
    },
  });
}
