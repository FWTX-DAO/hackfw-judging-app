import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { LoginScreen } from "../components/LoginScreen";
import { DEFAULT_BRANDING } from "../lib/types";
import { useAppConfig } from "../hooks/useQueries";
import { useAuth } from "../hooks/useSession";

export function LoginPage() {
  const nav = useNavigate();
  const configQ = useAppConfig();
  const branding = configQ.data?.branding ?? DEFAULT_BRANDING;
  const { auth, setJudge, setAdmin } = useAuth();

  // Auto-redirect if already authenticated
  useEffect(() => {
    if (auth.status === "judge") nav("/judge", { replace: true });
    if (auth.status === "admin") nav("/admin", { replace: true });
  }, [auth.status, nav]);

  return (
    <LoginScreen
      branding={branding}
      onJudgeLogin={(judge, token) => {
        setJudge(judge, token);
        nav("/judge", { replace: true });
      }}
      onAdminLogin={(token) => {
        setAdmin(token);
        nav("/admin", { replace: true });
      }}
      onViewLeaderboard={() => nav("/leaderboard")}
    />
  );
}
