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
  const cachedToken = sessionStore.getToken();
  // Parsing the stored judge on every render creates a new object and makes
  // the verification effect set auth continuously, starving route effects.
  const cachedJudge = useMemo(() => sessionStore.getJudge(), [cachedToken]);

  const initial: AuthState = cachedToken
    ? cachedRole === "admin"
      ? { status: "admin" }
      : cachedRole === "judge" && cachedJudge
      ? { status: "judge", judge: cachedJudge }
      : { status: "loading" }
    : { status: "anon" };

  const [auth, setAuth] = useState<AuthState>(initial);

  useEffect(() => {
    const changed = () => {
      if (!sessionStore.getToken()) { setAuth({ status: "anon" }); qc.clear(); }
    };
    window.addEventListener("hackfw-session-changed", changed);
    window.addEventListener("storage", changed);
    return () => { window.removeEventListener("hackfw-session-changed", changed); window.removeEventListener("storage", changed); };
  }, [qc]);

  // Verify the stored token with the server on mount. This keeps us honest
  // if the token was revoked, expired, or signed with an old secret.
  const sessionQ = useQuery({
    queryKey: ["session", cachedToken],
    queryFn: () => api<SessionEnvelope>("/api/session"),
    enabled: !!cachedToken,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!cachedToken) {
      setAuth({ status: "anon" });
      return;
    }
    // A network outage is not evidence that the token expired.
    if (!sessionQ.isSuccess) return;
    const data = sessionQ.data;
    if (!data || !data.session) {
      sessionStore.clear({ preserveDrafts: true });
      setAuth({ status: "anon" });
      return;
    }
    if (data.session.type === "admin") {
      setAuth({ status: "admin" });
    } else {
      // Use cached judge info (name) enriched with server-verified id/email
      const merged: Judge = {
        id: data.session.judgeId,
        email: data.session.email,
        name: cachedJudge?.name ?? (data.session.email.split("@")[0] || "Judge"),
      };
      setAuth({ status: "judge", judge: merged });
    }
  }, [sessionQ.data, sessionQ.isSuccess, cachedToken, cachedJudge]);

  const setJudge = useCallback((judge: Judge, token: string) => {
    qc.clear();
    sessionStore.setJudge(judge, token);
    setAuth({ status: "judge", judge });
    qc.invalidateQueries();
  }, [qc]);

  const setAdmin = useCallback((token: string) => {
    qc.clear();
    sessionStore.setAdmin(token);
    setAuth({ status: "admin" });
    qc.invalidateQueries();
  }, [qc]);

  const logout = useCallback(async () => {
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
