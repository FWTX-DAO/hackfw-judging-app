import React, { useRef, useState } from "react";
import {
  useAddJudge,
  useClearPresenting,
  useCriteria,
  useDeleteJudge,
  useJudges,
  useProjects,
  useSetPresenting,
  useUpdateCriteriaWeight,
  useResetJudgeCode,
} from "../hooks/useQueries";
import { DevpostImport } from "./DevpostImport";
import { SubmissionManager } from "./SubmissionManager";

export function AdminPanel() {
  const judgesQ = useJudges();
  const projectsQ = useProjects();
  const criteriaQ = useCriteria();

  const addJudge = useAddJudge();
  const deleteJudge = useDeleteJudge();
  const resetCode = useResetJudgeCode();
  const [issuedCode, setIssuedCode] = useState<{ email: string; code: string } | null>(null);
  const setPresenting = useSetPresenting();
  const clearPresenting = useClearPresenting();
  const updateWeight = useUpdateCriteriaWeight();

  const judges = judgesQ.data ?? [];
  const projects = projectsQ.data ?? [];
  const criteria = criteriaQ.data ?? [];

  const [jName, setJName] = useState("");
  const [jEmail, setJEmail] = useState("");
  // Local override for criteria sliders so drags update visually without
  // firing one mutation per drag tick. The mutation is debounced — we only
  // commit (and broadcast) after the admin stops moving the slider.
  const [localWeights, setLocalWeights] = useState<Record<string, number>>({});
  const weightTimers = useRef<Record<string, number>>({});
  const onWeightChange = (key: string, weight: number) => {
    setLocalWeights((prev) => ({ ...prev, [key]: weight }));
    const t = weightTimers.current[key];
    if (t) window.clearTimeout(t);
    weightTimers.current[key] = window.setTimeout(() => {
      updateWeight.mutate({ key, weight });
      delete weightTimers.current[key];
    }, 250);
  };

  const submitJudge = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const result = await addJudge.mutateAsync({ name: jName, email: jEmail });
      setIssuedCode({ email: jEmail, code: result.code });
      setJName("");
      setJEmail("");
    } catch { /* Mutation error is shown below. */ }
  };

  const currentlyPresenting = projects.find((p) => p.presenting === 1) || null;
  // Keep stage order stable as scores change and new submissions arrive.
  const presentationOrder = [...projects].sort((a, b) => a.id - b.id);
  const activeIndex = presentationOrder.findIndex((p) => p.id === currentlyPresenting?.id);
  const previousProject = presentationOrder[activeIndex - 1];
  const nextProject = presentationOrder[activeIndex + 1];
  const steeringPending = setPresenting.isPending || clearPresenting.isPending;
  const steeringError = setPresenting.error || clearPresenting.error;
  const activateProject = (id: number) => {
    clearPresenting.reset();
    setPresenting.mutate(id);
  };
  const error = addJudge.error || deleteJudge.error || resetCode.error || updateWeight.error || judgesQ.error || projectsQ.error || criteriaQ.error;

  return (
    <div className="animate-in" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {error && (
        <div className="chip chip--danger" style={{ padding: "8px 12px" }}>
          ⚠ {(error as Error).message}
        </div>
      )}

      {/* ─── Live judging control ─── */}
      <Section title="Live Judging Control" accent="amber" action={currentlyPresenting ? (
        <button onClick={() => { setPresenting.reset(); clearPresenting.mutate(); }} disabled={steeringPending} className="btn-secondary">
          Pause Judging
        </button>
      ) : null}>
        <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: "0 0 12px" }}>
          Verify and check in each team below, then use Previous and Next or select any ready team. Connected judges automatically switch to
          Live Judging with that team's scoring panel open. Judges still select Submit Score to save each grade.
          Pause judging between presentations so judges can finish their grades.
        </p>
        <p role="status" style={{ fontSize: 14, margin: "0 0 12px", color: "var(--color-bone)" }}>
          {currentlyPresenting
            ? `Active judging: ${currentlyPresenting.name} (${activeIndex + 1} of ${projects.length})`
            : "No active submission. Start judging or select a team to bring judges into its scoring panel."}
        </p>
        {steeringError && (
          <p role="alert" style={{ fontSize: 13, color: "var(--color-rust)", margin: "0 0 12px" }}>
            Unable to change the active submission: {(steeringError as Error).message}. Try again.
          </p>
        )}
        {projects.length === 0 ? (
          <p className="serial">// Add submissions first</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div className="flex flex-wrap gap-2 mb-3">
              {currentlyPresenting ? (
                <>
                  <button onClick={() => previousProject && activateProject(previousProject.id)} disabled={steeringPending || !previousProject?.requirements_met} className="btn-secondary">
                    ← Previous Submission
                  </button>
                  <button onClick={() => nextProject && activateProject(nextProject.id)} disabled={steeringPending || !nextProject?.requirements_met} className="btn-primary">
                    Next Submission →
                  </button>
                </>
              ) : (
                <button onClick={() => nextProject && activateProject(nextProject.id)} disabled={steeringPending || !nextProject?.requirements_met} className="btn-primary">
                  Start Judging
                </button>
              )}
            </div>
            {presentationOrder.map((p, index) => {
              const isLive = p.presenting === 1;
              return (
                <label
                  key={p.id}
                  className="flex flex-wrap items-center gap-3 cursor-pointer"
                  style={{
                    padding: "10px 12px",
                    background: isLive ? "var(--dim-amber)" : "transparent",
                    border: isLive ? "1px solid var(--color-border-amber)" : "1px solid transparent",
                    borderRadius: 2,
                  }}
                >
                  <input
                    type="radio"
                    name="presenting"
                    checked={isLive}
                    disabled={steeringPending || !p.requirements_met}
                    onChange={() => activateProject(p.id)}
                    style={{ accentColor: "var(--color-amber)" }}
                  />
                  <span className="stencil" style={{ fontSize: 15, color: "var(--color-bone)" }}>
                    {index + 1}. {p.name}
                  </span>
                  <span className="chip chip--team">{p.team}</span>
                  {!p.requirements_met && <span className="chip chip--warn">Verification pending</span>}
                  {isLive && <span className="serial-plate serial-plate--live flicker"><span className="dot" />Live</span>}
                </label>
              );
            })}
          </div>
        )}
      </Section>

      <SubmissionManager projects={presentationOrder} />

      {/* ─── Authorize judges ─── */}
      <Section title="Authorize Judges">
        <p className="serial mb-3">Share each private access code directly with its judge. Resetting a code signs that judge out and preserves their scores.</p>
        {issuedCode && <div role="status" className="plate mb-3" style={{ padding: 16, overflowWrap: "anywhere" }}>
          <p>Access code for {issuedCode.email}</p>
          <code style={{ fontSize: 20, userSelect: "all" }}>{issuedCode.code}</code>
          <p>Shown only here. Save it privately before dismissing.</p>
          <button type="button" className="btn-secondary" onClick={() => setIssuedCode(null)}>Dismiss code</button>
        </div>}
        <form onSubmit={submitJudge} className="flex flex-wrap gap-2">
          <input value={jName} onChange={(e) => setJName(e.target.value)} placeholder="judge name" required className="input-field" style={{ flex: 1, minWidth: 140 }} />
          <input value={jEmail} onChange={(e) => setJEmail(e.target.value)} placeholder="judge@email.com" required type="email" className="input-field" style={{ flex: 1, minWidth: 180 }} />
          <button type="submit" disabled={addJudge.isPending} className="btn-primary">
            {addJudge.isPending ? "Authorizing…" : "Authorize"}
          </button>
        </form>
        <div className="mt-3" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {judges.map((j) => (
            <div
              key={j.id}
              className="flex items-center justify-between flex-wrap gap-2"
              style={{ padding: "10px 12px", background: "var(--color-ink)", border: "1px solid var(--color-border)", borderRadius: 2 }}
            >
              <div className="flex items-center gap-3 flex-wrap">
                <span className="stencil" style={{ fontSize: 14, color: "var(--color-bone)" }}>{j.name}</span>
                <span className="serial">{j.email}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button disabled={resetCode.isPending} onClick={async () => {
                  if (!window.confirm(`Reset the access code for ${j.name}? Their current sessions will end. Scores are preserved.`)) return;
                  try { const result = await resetCode.mutateAsync(j.id); setIssuedCode({ email: j.email, code: result.code }); } catch {}
                }} className="btn-secondary">Reset access code</button>
                <button disabled={deleteJudge.isPending} onClick={() => {
                  if (window.confirm(`Remove ${j.name}? Judges with submitted scores cannot be removed.`)) deleteJudge.mutate(j.id);
                }} className="btn-danger">Remove</button>
              </div>
            </div>
          ))}
          {judges.length === 0 && <p className="serial">// No judges yet</p>}
        </div>
      </Section>

      {/* ─── Devpost import ─── */}
      <DevpostImport />

      {/* ─── Criteria weights ─── */}
      <Section title="Criteria Weights">
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {criteria.map((c) => {
            const displayed = localWeights[c.key] ?? c.weight;
            return (
              <div key={c.key} className="flex items-center flex-wrap" style={{ gap: 10 }}>
                <label className="serial" style={{ width: 170, flexShrink: 0, fontSize: 10 }} title={c.description}>
                  {c.label}
                </label>
                <input
                  type="range" min={1} max={100} value={displayed}
                  onChange={(e) => onWeightChange(c.key, Number(e.target.value))}
                  style={{ flex: 1, minWidth: 140 }}
                />
                <span className="readout-amber" style={{ width: 56, textAlign: "right", fontSize: 14 }}>
                  {displayed}%
                </span>
              </div>
            );
          })}
        </div>
        <p className="serial mt-3">// Weights are auto-normalized; need not sum to 100</p>
      </Section>
    </div>
  );
}

function Section({
  title,
  accent,
  action,
  children,
}: {
  title: string;
  accent?: "amber";
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      className="plate plate--riveted"
      style={{
        padding: "20px 22px 22px",
        borderColor: accent === "amber" ? "var(--color-border-amber)" : undefined,
      }}
    >
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <div className="flex items-center gap-2">
          <span className="tag-square" style={accent === "amber" ? undefined : { background: "var(--color-cyber)", boxShadow: "0 0 6px var(--glow-cyber)" }} />
          <span className="serial" style={{ fontSize: 10 }}>// {title}</span>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}
