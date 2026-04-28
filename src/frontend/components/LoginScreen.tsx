import React, { useMemo, useState } from "react";
import type { Branding, Judge } from "../lib/types";
import { DEFAULT_BRANDING } from "../lib/types";
import { useAuthAdmin, useAuthJudge } from "../hooks/useQueries";

export function LoginScreen({
  branding = DEFAULT_BRANDING,
  onJudgeLogin,
  onAdminLogin,
  onViewLeaderboard,
}: {
  branding?: Branding;
  onJudgeLogin: (judge: Judge, token: string) => void;
  onAdminLogin: (token: string) => void;
  onViewLeaderboard: () => void;
}) {
  const [mode, setMode] = useState<"choose" | "judge" | "admin">("choose");
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");

  const judgeAuth = useAuthJudge();
  const adminAuth = useAuthAdmin();
  const error = judgeAuth.error || adminAuth.error;

  const serial = useMemo(() => {
    const hex = Math.floor(Math.random() * 0xffff).toString(16).padStart(4, "0").toUpperCase();
    return `SN-${hex}-FWTX`;
  }, []);

  const loginJudge = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await judgeAuth.mutateAsync(email).catch(() => null);
    if (res) {
      const { token, ...judge } = res;
      onJudgeLogin(judge as Judge, token);
    }
  };

  const loginAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await adminAuth.mutateAsync(pin).catch(() => null);
    if (res?.token) onAdminLogin(res.token);
  };

  const loading = judgeAuth.isPending || adminAuth.isPending;

  return (
    <div
      className="mx-auto px-4"
      style={{
        maxWidth: 520,
        paddingTop: "clamp(48px, 10vh, 96px)",
        paddingBottom: "64px",
      }}
    >
      {/* Stencil wordmark */}
      <div className="text-center boot">
        <div className="boot-line flex items-center justify-center gap-3 mb-5">
          <span className="serial-plate">
            <span className="dot" />
            {serial}
          </span>
          <span className="serial-plate serial-plate--cyber">
            <span className="dot" />
            REV 2026.04
          </span>
        </div>

        <h1
          className="wordmark boot-line"
          style={{
            fontSize: "clamp(4.5rem, 16vw, 8rem)",
            margin: 0,
          }}
        >
          {branding.name.toUpperCase()}
        </h1>

        <div className="boot-line mt-4" style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 14 }}>
          <span style={{ width: 20, height: 1, background: "var(--color-border-strong)" }} />
          <span className="serial">// {branding.title_line}</span>
          <span style={{ width: 20, height: 1, background: "var(--color-border-strong)" }} />
        </div>

        <p
          className="boot-line mt-4 stencil"
          style={{
            fontSize: 12,
            color: "var(--color-text-tertiary)",
            letterSpacing: "0.22em",
            lineHeight: 1.5,
          }}
        >
          {branding.tagline}
        </p>
      </div>

      {/* Hazard strip separator */}
      <div className="hazard-stripes" style={{ height: 6, margin: "40px 0 28px", borderRadius: 1 }} />

      {/* Boot log — gives context, reinforces terminal identity */}
      {mode === "choose" && (
        <div className="plate plate--ruled plate--riveted boot animate-in" style={{ padding: "26px 22px 22px" }}>
          <pre
            className="boot-line"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: "var(--color-text-secondary)",
              margin: 0,
              lineHeight: 1.7,
              whiteSpace: "pre-wrap",
            }}
          >
{`> linking.........  [ `}<span className="readout">OK</span>{` ]
> criteria.load... [ `}<span className="readout">OK</span>{` ]
> judges.sync..... [ `}<span className="readout">OK</span>{` ]
> access.mode..... awaiting operator`}<span className="caret" />
          </pre>

          <div className="divider-measure" />

          <div className="boot-line" style={{ display: "grid", gap: 10 }}>
            <button onClick={() => setMode("judge")} className="btn-primary" style={{ justifyContent: "space-between" }}>
              <span>Judge Access</span>
              <span style={{ fontSize: 14, opacity: 0.7 }}>→</span>
            </button>
            <button onClick={() => setMode("admin")} className="btn-secondary" style={{ justifyContent: "space-between", display: "inline-flex", alignItems: "center" }}>
              <span>Admin Console</span>
              <span style={{ fontSize: 14, opacity: 0.7 }}>→</span>
            </button>
            <button onClick={onViewLeaderboard} className="btn-secondary" style={{ justifyContent: "space-between", display: "inline-flex", alignItems: "center" }}>
              <span>Public Standings</span>
              <span style={{ fontSize: 14, opacity: 0.7 }}>→</span>
            </button>
          </div>

          <p className="serial boot-line mt-5" style={{ textAlign: "center" }}>
            Authorized operators only · terminal access logged
          </p>
        </div>
      )}

      {mode === "judge" && (
        <div className="plate plate--riveted animate-in" style={{ padding: "26px 22px" }}>
          <div className="flex items-center gap-2 mb-4">
            <span className="tag-square" />
            <span className="serial">Input // Authorized Email</span>
          </div>
          <form onSubmit={loginJudge} className="space-y-4">
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              placeholder="operator@domain.tld"
              required
              autoFocus
              className="input-field"
            />
            {error && (
              <div className="chip chip--danger" style={{ padding: "6px 10px" }}>
                ⚠ {(error as Error).message}
              </div>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setMode("choose"); judgeAuth.reset(); adminAuth.reset(); }}
                className="btn-secondary"
                style={{ flex: "0 0 auto" }}
              >
                ← Back
              </button>
              <button
                type="submit"
                disabled={loading}
                className="btn-primary"
                style={{ flex: 1, justifyContent: "center" }}
              >
                {loading ? "Verifying…" : "Engage"}
              </button>
            </div>
          </form>

          <p className="serial mt-5" style={{ lineHeight: 1.7 }}>
            Pre-authorized operators only · access requests via admin
          </p>
        </div>
      )}

      {mode === "admin" && (
        <div className="plate plate--riveted animate-in" style={{ padding: "26px 22px" }}>
          <div className="flex items-center gap-2 mb-4">
            <span className="tag-square" style={{ background: "var(--color-rust)", boxShadow: "0 0 6px var(--glow-rust)" }} />
            <span className="serial">Input // Admin PIN</span>
          </div>
          <form onSubmit={loginAdmin} className="space-y-4">
            <input
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              type="password"
              placeholder="••••••••"
              required
              autoFocus
              className="input-field"
            />
            {error && (
              <div className="chip chip--danger" style={{ padding: "6px 10px" }}>
                ⚠ {(error as Error).message}
              </div>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setMode("choose"); judgeAuth.reset(); adminAuth.reset(); }}
                className="btn-secondary"
              >
                ← Back
              </button>
              <button
                type="submit"
                disabled={loading}
                className="btn-primary"
                style={{ flex: 1, justifyContent: "center" }}
              >
                {loading ? "Verifying…" : "Unlock Console"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Foot note */}
      <div className="mt-10 text-center">
        <span className="serial">◼ {branding.footer}</span>
      </div>
    </div>
  );
}
