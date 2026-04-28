import React, { useEffect, useState } from "react";
import { useCriteria } from "../hooks/useQueries";

const STORAGE_KEY = "hackfw_briefing_collapsed";

/**
 * Inline operator manual for the judging flow. Collapsible — state
 * persisted in localStorage so experienced judges aren't nagged.
 */
export function JudgingBriefing() {
  const { data: criteria = [] } = useCriteria();
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem(STORAGE_KEY) === "1"; } catch { return false; }
  });

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0"); } catch {}
  }, [collapsed]);

  const totalWeight = criteria.reduce((s, c) => s + c.weight, 0) || 1;

  return (
    <div className="plate plate--riveted mb-4" style={{ padding: 0, overflow: "hidden" }}>
      {/* Header row — clickable */}
      <button
        onClick={() => setCollapsed((v) => !v)}
        aria-expanded={!collapsed}
        aria-label={collapsed ? "Expand judge briefing" : "Collapse judge briefing"}
        className="w-full flex items-center justify-between"
        style={{
          background: "transparent",
          border: "none",
          padding: "14px 14px 14px 18px",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <div className="flex items-center gap-3 flex-wrap" style={{ minWidth: 0 }}>
          <span className="tag-square" style={{ background: "var(--color-cyber)", boxShadow: "0 0 6px var(--glow-cyber)" }} />
          <span className="stencil" style={{ fontSize: 15, color: "var(--color-bone)", letterSpacing: "0.12em" }}>
            Judge Briefing
          </span>
          <span className="serial" style={{ fontSize: 10 }}>How judging works</span>
        </div>

        {/* Industrial-style toggle knob — large tap target */}
        <span
          className="briefing-toggle"
          data-open={!collapsed}
          aria-hidden
        >
          <span className="briefing-toggle__label">
            {collapsed ? "Expand" : "Collapse"}
          </span>
          <span className="briefing-toggle__chevron">
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden>
              <path
                d="M5 7.5L10 12.5L15 7.5"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="square"
                strokeLinejoin="miter"
              />
            </svg>
          </span>
        </span>
      </button>

      {!collapsed && (
        <div
          className="animate-in"
          style={{
            padding: "4px 18px 20px",
            borderTop: "1px solid var(--color-border-strong)",
            display: "flex",
            flexDirection: "column",
            gap: 18,
          }}
        >
          {/* ─── Flow ─── */}
          <section>
            <SectionLabel>// The Flow</SectionLabel>
            <ol style={{ paddingLeft: 22, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
              <Step n={1}>
                Watch for the <Live>Live</Live> banner at the top — the admin marks each project as it
                takes the stage, and it syncs to every judge in realtime.
              </Step>
              <Step n={2}>
                Tap <Em>Grade Now</Em> (or open that project's card directly) to reveal the scoring panel.
              </Step>
              <Step n={3}>
                For each of the {criteria.length || 5} axes below, drag the slider 1–10. Use the full range —
                nothing prevents a 2 or a 10 when warranted.
              </Step>
              <Step n={4}>
                Add short notes (optional but helpful for ties and post-event feedback) and hit
                <Em> Submit Score</Em>. You can revise anytime; the latest submission wins.
              </Step>
              <Step n={5}>
                The <Em>Leaderboard</Em> tab updates live as you and other judges score. No need to refresh.
              </Step>
            </ol>
          </section>

          {/* ─── Scale anchors ─── */}
          <section>
            <SectionLabel>// The 1–10 Scale</SectionLabel>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: 8,
              }}
            >
              <Anchor range="1–3" label="Needs Work" color="var(--color-rust)"
                desc="Incomplete, unclear, or not functional yet" />
              <Anchor range="4–6" label="Average" color="var(--color-amber)"
                desc="Meets the bar; nothing that stands out" />
              <Anchor range="7–8" label="Strong" color="var(--color-amber-bright)"
                desc="Above average, memorable, well executed" />
              <Anchor range="9–10" label="Exceptional" color="var(--color-phosphor)"
                desc="Top-tier; would invest / hire / ship immediately" />
            </div>
          </section>

          {/* ─── Criteria live from API ─── */}
          <section>
            <SectionLabel>// The {criteria.length || 5} Criteria — weighted matrix</SectionLabel>
            <p className="serial mb-3" style={{ fontSize: 10, color: "var(--color-text-secondary)" }}>
              Your weighted score per project = Σ (axis × weight) ÷ Σ weights, normalized back to 1–10.
              The leaderboard averages the weighted score across all judges.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {criteria.map((c) => {
                const pct = Math.round((c.weight / totalWeight) * 100);
                return (
                  <div
                    key={c.key}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "auto 1fr auto",
                      alignItems: "center",
                      gap: 12,
                      padding: "10px 12px",
                      background: "var(--color-ink)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 2,
                    }}
                  >
                    <span className="readout-amber" style={{ fontSize: 14, minWidth: 40, textAlign: "right" }}>
                      {pct}%
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div className="stencil" style={{ fontSize: 14, color: "var(--color-bone)", lineHeight: 1.1 }}>
                        {c.label}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 2 }}>
                        {c.description}
                      </div>
                    </div>
                    <div
                      style={{
                        width: 80,
                        height: 6,
                        background: "#0A0A0C",
                        border: "1px solid rgba(0,0,0,0.8)",
                        borderRadius: 1,
                        position: "relative",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${pct}%`,
                          height: "100%",
                          background: "linear-gradient(180deg, var(--color-amber-bright) 0%, var(--color-amber) 70%, var(--color-amber-deep) 100%)",
                          boxShadow: "0 0 6px var(--glow-amber)",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* ─── Submission requirements ─── */}
          <section>
            <SectionLabel>// Submission Must-Haves</SectionLabel>
            <div className="flex flex-wrap gap-2">
              <span className="chip chip--ok">✓ GITHUB / GITLAB</span>
              <span className="chip chip--ok">✓ README</span>
              <span className="chip chip--ok">✓ VIDEO DEMO</span>
            </div>
            <p className="serial mt-2" style={{ fontSize: 10, color: "var(--color-text-secondary)", lineHeight: 1.6 }}>
              Submissions missing any of these show an{" "}
              <span style={{ color: "var(--color-amber-bright)" }}>⚠ Incomplete</span> chip.
              You can still score them — consider completeness in your evaluation.
            </p>
          </section>

          <div className="serial" style={{ fontSize: 10, textAlign: "right", color: "var(--color-text-tertiary)" }}>
            Dismiss this briefing? Tap the header to collapse · it stays hidden across sessions.
          </div>
        </div>
      )}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <span style={{ width: 4, height: 4, background: "var(--color-amber)", boxShadow: "0 0 4px var(--glow-amber)" }} />
      <span className="serial" style={{ fontSize: 10, color: "var(--color-amber)" }}>
        {children}
      </span>
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li style={{ fontSize: 13, color: "var(--color-text-primary)", lineHeight: 1.55 }}>
      <span
        className="readout-amber"
        style={{ fontSize: 12, marginRight: 8, fontWeight: 700 }}
      >
        {String(n).padStart(2, "0")}
      </span>
      {children}
    </li>
  );
}

function Em({ children }: { children: React.ReactNode }) {
  return <span style={{ color: "var(--color-amber-bright)", fontWeight: 600 }}>{children}</span>;
}

function Live({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="flicker"
      style={{
        display: "inline-block",
        padding: "1px 6px",
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.2em",
        color: "var(--color-phosphor)",
        background: "rgba(160, 240, 0, 0.12)",
        border: "1px solid rgba(160, 240, 0, 0.4)",
        borderRadius: 2,
        verticalAlign: "baseline",
      }}
    >
      {children}
    </span>
  );
}

function Anchor({
  range,
  label,
  desc,
  color,
}: {
  range: string;
  label: string;
  desc: string;
  color: string;
}) {
  return (
    <div
      style={{
        padding: "10px 12px",
        background: "var(--color-ink)",
        border: "1px solid var(--color-border)",
        borderLeft: `3px solid ${color}`,
        borderRadius: 2,
      }}
    >
      <div className="flex items-baseline gap-2">
        <span className="readout-amber" style={{ fontSize: 16, color, textShadow: `0 0 8px ${color}` }}>
          {range}
        </span>
        <span className="stencil" style={{ fontSize: 12, color: "var(--color-bone)", letterSpacing: "0.1em" }}>
          {label}
        </span>
      </div>
      <p style={{ fontSize: 11, color: "var(--color-text-secondary)", margin: "4px 0 0", lineHeight: 1.45 }}>
        {desc}
      </p>
    </div>
  );
}
