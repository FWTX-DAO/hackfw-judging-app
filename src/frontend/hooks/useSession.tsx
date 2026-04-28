import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { sessionStore } from "../lib/session";
import type { Judge } from "../lib/types";

type SessionEnvelope =
  | { session: null }
  | { session: { type: "judge"; judgeId: number; email: string; exp: number } }
  | { session: { type: "admin"; exp: number } };

export type AuthState =
  | { status: "loading" }
  | { status: "anon" }
  | { status: "judge"; judge: Judge }
  | { status: "admin" };

type Ctx = {
  auth: AuthState;
  /** After a successful /api/auth → stash the token and hydrate. */
  setJudge: (judge: Judge, token: string) => void;
  /** After a successful /api/admin/auth → stash the token. */
  setAdmin: (token: string) => void;
  /** Drop the session and notify the server (best-effort). */
  logout: () => Promise<void>;
};

const AuthContext = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient();
  // Hydrate initial state synchronously from localStorage for fast first paint.
  const cachedRole = sessionStore.getRole();
  const cachedJudge = sessionStore.getJudge();
  const cachedToken = sessionStore.getToken();

  const initial: AuthState = cachedToken
    ? cachedRole === "admin"
      ? { status: "admin" }
      : cachedRole === "judge" && cachedJudge
      ? { status: "judge", judge: cachedJudge }
      : { status: "loading" }
    : { status: "anon" };

  const [auth, setAuth] = useState<AuthState>(initial);

  // Verify the stored token with the server on mount. This keeps us honest
  // if the token was revoked, expired, or signed with an old secret.
  const sessionQ = useQuery({
    queryKey: ["session"],
    queryFn: () => api<SessionEnvelope>("/api/session"),
    enabled: !!cachedToken,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!cachedToken) {
      setAuth({ status: "anon" });
      return;
    }
    if (sessionQ.isLoading) return;
    const data = sessionQ.data;
    if (!data || !data.session) {
      sessionStore.clear();
      setAuth({ status: "anon" });
      return;
    }
    if (data.session.type === "admin") {
      setAuth({ status: "admin" });
    } else {
      // Use cached judge info (name) enriched with server-verified id/email
      const merged: Judge = cachedJudge ?? {
        id: data.session.judgeId,
        email: data.session.email,
        name: data.session.email.split("@")[0] || "Judge",
      };
      setAuth({ status: "judge", judge: merged });
    }
  }, [sessionQ.data, sessionQ.isLoading, cachedToken, cachedJudge]);

  const setJudge = useCallback((judge: Judge, token: string) => {
    sessionStore.setJudge(judge, token);
    setAuth({ status: "judge", judge });
    qc.invalidateQueries();
  }, [qc]);

  const setAdmin = useCallback((token: string) => {
    sessionStore.setAdmin(token);
    setAuth({ status: "admin" });
    qc.invalidateQueries();
  }, [qc]);

  const logout = useCallback(async () => {
    try { await api("/api/logout", { method: "POST" }); } catch { /* best-effort */ }
    sessionStore.clear();
    setAuth({ status: "anon" });
    qc.clear();
  }, [qc]);

  const value = useMemo<Ctx>(() => ({ auth, setJudge, setAdmin, logout }), [auth, setJudge, setAdmin, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): Ctx {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
