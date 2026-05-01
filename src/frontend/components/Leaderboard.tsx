import React from "react";
import type { CriteriaWeight } from "../lib/types";
import { useLeaderboard } from "../hooks/useQueries";

export function Leaderboard({ criteria }: { criteria: CriteriaWeight[] }) {
  const { data, isPending, isError, error, refetch } = useLeaderboard();
  const entries = data ?? [];

  const rankClass = (i: number, hasScores: boolean) => {
    if (!hasScores) return "";
    if (i === 0) return "rank-gold";
    if (i === 1) return "rank-silver";
    if (i === 2) return "rank-bronze";
    return "";
  };

  const shortLabel = (label: string) => {
    if (label.length <= 14) return label;
    return label
      .split(/[^a-zA-Z]+/)
      .filter(Boolean)
      .map((w) => w[0])
      .join("")
      .toUpperCase();
  };

  // Server reports the panel size on every row; fall back to "max judges
  // who scored any one project" only if the field is absent (older payload).
  const totalJudges =
    entries[0]?.total_judges ??
    entries.reduce((s, e) => Math.max(s, e.judge_count), 0);

  return (
    <div className="animate-in">
      {/* Header bar — like a control panel caption */}
      <div className="flex items-end justify-between mb-4 flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="tag-square" />
            <span className="serial">Display // Rack 01</span>
          </div>
          <h2 className="stencil" style={{ fontSize: "clamp(1.8rem, 4vw, 2.4rem)", color: "var(--color-bone)", lineHeight: 1 }}>
            Live Standings
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="serial-plate"><span className="dot" />Entries · {entries.length}</span>
          {totalJudges > 0 && (
            <span className="serial-plate serial-plate--cyber"><span className="dot" />Max Judges · {totalJudges}</span>
          )}
        </div>
      </div>

      <div className="hazard-stripes" style={{ height: 3, marginBottom: 16, borderRadius: 1, opacity: 0.55 }} />

      {isPending && (
        <div className="plate plate--ruled plate--riveted text-center" style={{ padding: "48px 20px" }}>
          <p className="serial" style={{ fontSize: 11 }}>// Loading standings…</p>
        </div>
      )}

      {!isPending && isError && (
        <div className="plate plate--ruled plate--riveted text-center" style={{ padding: "48px 20px" }}>
          <p className="serial" style={{ fontSize: 11, color: "var(--color-rust)" }}>
            // Failed to load: {(error as Error)?.message || "unknown error"}
          </p>
          <button onClick={() => refetch()} className="btn-secondary" style={{ marginTop: 12 }}>
            Retry
          </button>
        </div>
      )}

      {!isPending && !isError && entries.length === 0 && (
        <div className="plate plate--ruled plate--riveted text-center" style={{ padding: "48px 20px" }}>
          <p className="serial" style={{ fontSize: 11 }}>// No submissions loaded yet</p>
        </div>
      )}

      <div style={{ display: "grid", gap: 10 }}>
        {entries.map((entry, i) => {
          const hasScores = entry.judge_count > 0;
          const isLeader = i === 0 && hasScores;
          const isLive = entry.presenting === 1;
          return (
            <div
              key={entry.id}
              className={`card-glow ${isLive ? "card-glow--live" : ""}`}
              style={{
                display: "flex",
                alignItems: "stretch",
                gap: 0,
                padding: 0,
                overflow: "hidden",
              }}
            >
              {/* Slot plate */}
              <div
                className={`rank-plate ${rankClass(i, hasScores)}`}
                style={{
                  borderRadius: 0,
                  borderTop: "none",
                  borderLeft: "none",
                  borderBottom: "none",
                  minWidth: 64,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                }}
              >
                {hasScores ? String(i + 1).padStart(2, "0") : "—"}
              </div>

              {/* Body */}
              <div style={{ flex: 1, padding: "16px 18px", minWidth: 0 }}>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  {isLive && (
                    <span className="serial-plate serial-plate--live flicker">
                      <span className="dot" />Live
                    </span>
                  )}
                  {isLeader && (
                    <span className="serial-plate" style={{ color: "var(--color-amber-bright)", borderColor: "var(--color-border-amber)" }}>
                      <span className="dot" />Leader
                    </span>
                  )}
                  <span className="chip chip--team">{entry.team}</span>
                  {!entry.requirements_met && (
                    <span className="chip chip--danger">⚠ Missing · {entry.missing_requirements.join("/")}</span>
                  )}
                </div>

                <h3
                  className="stencil"
                  style={{
                    fontSize: "clamp(1.2rem, 2.6vw, 1.55rem)",
                    color: "var(--color-bone)",
                    lineHeight: 1.05,
                  }}
                >
                  {entry.name}
                </h3>

                {hasScores && (
                  <div className="mt-3" style={{ display: "grid", gap: 5 }}>
                    {criteria.map((c) => {
                      const avg = (entry as any)[`avg_${c.key}`] as number | undefined;
                      if (typeof avg !== "number") return null;
                      const barPct = ((avg - 1) / 9) * 100;
                      return (
                        <div key={c.key} className="flex items-center" style={{ gap: 10 }}>
                          <span
                            className="serial"
                            style={{ width: 110, flexShrink: 0, fontSize: 9 }}
                            title={c.label}
                          >
                            {shortLabel(c.label)}
                          </span>
                          <div
                            style={{
                              flex: 1,
                              height: 8,
                              background:
                                "repeating-linear-gradient(90deg, transparent 0 calc(10% - 1px), rgba(239,231,214,0.12) calc(10% - 1px) 10%), #0A0A0C",
                              border: "1px solid rgba(0,0,0,0.8)",
                              boxShadow: "inset 0 1px 2px rgba(0,0,0,0.6)",
                              position: "relative",
                              borderRadius: 1,
                            }}
                          >
                            <div
                              style={{
                                width: `${Math.max(0, Math.min(100, barPct))}%`,
                                height: "100%",
                                background: "linear-gradient(180deg, var(--color-amber-bright) 0%, var(--color-amber) 70%, var(--color-amber-deep) 100%)",
                                boxShadow: "0 0 8px var(--glow-amber)",
                              }}
                            />
                          </div>
                          <span className="readout-amber" style={{ fontSize: 12, width: 32, textAlign: "right" }}>
                            {avg.toFixed(1)}
                          </span>
                          <span className="serial" style={{ fontSize: 9, width: 32, textAlign: "right" }}>
                            ×{c.weight}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {(entry.github_url || entry.video_url || entry.readme_url || entry.devpost_url) && (
                  <div className="flex gap-4 mt-3 flex-wrap" style={{ fontSize: 10 }}>
                    {entry.github_url && <LinkChip href={entry.github_url} label="GITHUB" />}
                    {entry.readme_url && <LinkChip href={entry.readme_url} label="README" />}
                    {entry.video_url && <LinkChip href={entry.video_url} label="VIDEO" />}
                    {entry.devpost_url && <LinkChip href={entry.devpost_url} label="DEVPOST" />}
                  </div>
                )}
              </div>

              {/* Right gauge panel */}
              <div
                style={{
                  borderLeft: "1px solid var(--color-border-strong)",
                  padding: "16px 20px",
                  minWidth: 120,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-end",
                  justifyContent: "center",
                  background: "linear-gradient(180deg, rgba(0,0,0,0.2), transparent)",
                }}
              >
                <span className="serial" style={{ fontSize: 9 }}>Weighted</span>
                <div className={`score-badge ${isLeader ? "score-badge--amber" : ""}`} style={{ fontSize: "2.6rem", lineHeight: 1, marginTop: 2 }}>
                  {hasScores ? entry.avg_weighted.toFixed(1) : "—.—"}
                </div>
                <span className="serial" style={{ fontSize: 9, marginTop: 4 }}>
                  {totalJudges > 0
                    ? `${entry.judge_count} / ${totalJudges} Judges`
                    : `${entry.judge_count} Judges`}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LinkChip({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        fontFamily: "var(--font-mono)",
        fontWeight: 600,
        letterSpacing: "0.22em",
        color: "var(--color-amber)",
        textDecoration: "none",
        borderBottom: "1px dashed rgba(255, 184, 0, 0.35)",
        paddingBottom: 1,
      }}
      onMouseEnter={(e) => ((e.currentTarget.style.color = "var(--color-amber-bright)"))}
      onMouseLeave={(e) => ((e.currentTarget.style.color = "var(--color-amber)"))}
    >
      ↗ {label}
    </a>
  );
}
