import type { Judge } from "./types";

const TOKEN_KEY = "hackfw_session_token";
const JUDGE_KEY = "hackfw_session_judge";
const ROLE_KEY  = "hackfw_session_role";

export type Role = "judge" | "admin";

/**
 * Client-side session store — thin wrapper over localStorage.
 * The token itself is the source of truth (server-verifiable). The
 * cached judge object is just for fast UI bootstrap before /api/session
 * confirms the token.
 */
export const sessionStore = {
  getToken(): string | null {
    try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
  },

  getRole(): Role | null {
    try { return (localStorage.getItem(ROLE_KEY) as Role | null) || null; } catch { return null; }
  },

  getJudge(): Judge | null {
    try {
      const s = localStorage.getItem(JUDGE_KEY);
      return s ? (JSON.parse(s) as Judge) : null;
    } catch { return null; }
  },

  setJudge(judge: Judge, token: string) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(ROLE_KEY, "judge");
    localStorage.setItem(JUDGE_KEY, JSON.stringify({ id: judge.id, name: judge.name, email: judge.email }));
  },

  setAdmin(token: string) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(ROLE_KEY, "admin");
    localStorage.removeItem(JUDGE_KEY);
  },

  clear() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ROLE_KEY);
    localStorage.removeItem(JUDGE_KEY);
    // Don't leave per-judge draft notes from the previous session on disk —
    // they're scoped to the previous judgeId but a different login on the
    // same browser shouldn't carry that history.
    try {
      const stale: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith("hackfw_draft_notes_")) stale.push(k);
      }
      for (const k of stale) localStorage.removeItem(k);
    } catch {
      // localStorage may be disabled — best effort
    }
  },
};
