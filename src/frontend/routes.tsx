import React from "react";
import { createBrowserRouter, Navigate, Outlet } from "react-router-dom";
import { AppShell } from "./AppShell";
import { LoginPage } from "./pages/LoginPage";
import { JudgePage } from "./pages/JudgePage";
import { LeaderboardPage } from "./pages/LeaderboardPage";
import { AdminPage } from "./pages/AdminPage";
import { useAuth } from "./hooks/useSession";

function RequireJudge() {
  const { auth } = useAuth();
  if (auth.status === "loading") return null;
  if (auth.status !== "judge") return <Navigate to="/" replace />;
  return <Outlet />;
}

function RequireAdmin() {
  const { auth } = useAuth();
  if (auth.status === "loading") return null;
  if (auth.status !== "admin") return <Navigate to="/" replace />;
  return <Outlet />;
}

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: <LoginPage /> },
      { path: "leaderboard", element: <LeaderboardPage /> },
      {
        element: <RequireJudge />,
        children: [{ path: "judge", element: <JudgePage /> }],
      },
      {
        element: <RequireAdmin />,
        children: [{ path: "admin", element: <AdminPage /> }],
      },
    ],
  },
]);
