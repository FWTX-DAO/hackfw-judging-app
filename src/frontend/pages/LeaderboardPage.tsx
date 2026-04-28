import React from "react";
import { Leaderboard } from "../components/Leaderboard";
import { useCriteria } from "../hooks/useQueries";

export function LeaderboardPage() {
  const criteriaQ = useCriteria();
  return <Leaderboard criteria={criteriaQ.data ?? []} />;
}
