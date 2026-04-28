import { QueryClient } from "@tanstack/react-query";

/**
 * Single shared QueryClient. WebSocket events invalidate these queries.
 * Keep staleTime loose — realtime push handles freshness; polling is a
 * fallback, not the primary signal.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: true,
      retry: 1,
    },
    mutations: {
      retry: 0,
    },
  },
});

/** Stable query keys — import to avoid typos across files. */
export const qk = {
  config:     ["config"] as const,
  projects:   ["projects"] as const,
  criteria:   ["criteria"] as const,
  judges:     ["judges"] as const,
  leaderboard:["leaderboard"] as const,
  score:      (projectId: number, judgeId: number) => ["score", projectId, judgeId] as const,
  projectScores: (projectId: number) => ["projectScores", projectId] as const,
};
