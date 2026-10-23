import React from "react";
import { Leaderboard } from "../components/Leaderboard";
import { useCriteria } from "../hooks/useQueries";
import { useSearchParams } from "react-router-dom";

export function LeaderboardPage() {
  const criteriaQ = useCriteria();
  const [params] = useSearchParams();
  return <Leaderboard criteria={criteriaQ.data ?? []} presentation={params.get("display") === "1"} />;
}
