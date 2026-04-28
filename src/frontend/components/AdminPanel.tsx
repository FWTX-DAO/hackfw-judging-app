import React, { useState } from "react";
import {
  useAddJudge,
  useAddProject,
  useClearPresenting,
  useCriteria,
  useDeleteJudge,
  useDeleteProject,
  useJudges,
  useProjects,
  useSetPresenting,
  useUpdateCriteriaWeight,
} from "../hooks/useQueries";
import { DevpostImport } from "./DevpostImport";

export function AdminPanel() {
  const judgesQ = useJudges();
  const projectsQ = useProjects();
  const criteriaQ = useCriteria();

  const addJudge = useAddJudge();
  const deleteJudge = useDeleteJudge();
  const addProject = useAddProject();
  const deleteProject = useDeleteProject();
  const setPresenting = useSetPresenting();
  const clearPresenting = useClearPresenting();
  const updateWeight = useUpdateCriteriaWeight();

  const judges = judgesQ.data ?? [];
  const projects = projectsQ.data ?? [];
  const criteria = criteriaQ.data ?? [];

  const [jName, setJName] = useState("");
  const [jEmail, setJEmail] = useState("");
  const [pName, setPName] = useState("");
  const [pTeam, setPTeam] = useState("");
  const [pDesc, setPDesc] = useState("");
  const [pGithub, setPGithub] = useState("");
  const [pReadme, setPReadme] = useState("");
  const [pVideo, setPVideo] = useState("");
  const [pDevpost, setPDevpost] = useState("");

  const submitJudge = async (e: React.FormEvent) => {
    e.preventDefault();
    await addJudge.mutateAsync({ name: jName, email: jEmail });
    setJName("");
    setJEmail("");
  };

  const submitProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pName || !pDesc || !pTeam) return;
    await addProject.mutateAsync({
      name: pName, description: pDesc, team: pTeam,
      github_url: pGithub, readme_url: pReadme, video_url: pVideo, devpost_url: pDevpost,
    });
    setPName(""); setPTeam(""); setPDesc("");
    setPGithub(""); setPReadme(""); setPVideo(""); setPDevpost("");
  };

  const currentlyPresenting = projects.find((p) => p.presenting === 1) || null;
  const error = addJudge.error || addProject.error;

  return (
    <div className="animate-in" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {error && (
        <div className="chip chip--danger" style={{ padding: "8px 12px" }}>
          ⚠ {(error as Error).message}
        </div>
      )}

      {/* ─── Currently Presenting ─── */}
      <Section title="Currently Presenting" accent="amber" action={currentlyPresenting ? (
        <button onClick={() => clearPresenting.mutate()} className="btn-secondary">
          Clear
        </button>
      ) : null}>
        {projects.length === 0 ? (
          <p className="serial">// Add submissions first</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {projects.map((p) => {
              const isLive = p.presenting === 1;
              return (
                <label
                  key={p.id}
                  className="flex items-center gap-3 cursor-pointer"
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
                    onChange={() => setPresenting.mutate(p.id)}
                    style={{ accentColor: "var(--color-amber)" }}
                  />
                  <span className="stencil" style={{ fontSize: 15, color: "var(--color-bone)" }}>
                    {p.name}
                  </span>
                  <span className="chip chip--team">{p.team}</span>
                  {isLive && <span className="serial-plate serial-plate--live flicker"><span className="dot" />Live</span>}
                </label>
              );
            })}
          </div>
        )}
      </Section>

      {/* ─── Authorize judges ─── */}
      <Section title="Authorize Judges">
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
              <button onClick={() => deleteJudge.mutate(j.id)} className="btn-danger">Remove</button>
            </div>
          ))}
          {judges.length === 0 && <p className="serial">// No judges yet</p>}
        </div>
      </Section>

      {/* ─── Devpost import ─── */}
      <DevpostImport />

      {/* ─── Single submission ─── */}
      <Section title="Add Single Submission">
        <form onSubmit={submitProject} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="flex flex-wrap gap-2">
            <input value={pName} onChange={(e) => setPName(e.target.value)} placeholder="project name" required className="input-field" style={{ flex: 1, minWidth: 140 }} />
            <input value={pTeam} onChange={(e) => setPTeam(e.target.value)} placeholder="team name" required className="input-field" style={{ flex: 1, minWidth: 140 }} />
          </div>
          <textarea value={pDesc} onChange={(e) => setPDesc(e.target.value)} placeholder="project description" required rows={2} className="input-field" style={{ resize: "none" }} />
          <input value={pGithub} onChange={(e) => setPGithub(e.target.value)} placeholder="github url" className="input-field" />
          <input value={pReadme} onChange={(e) => setPReadme(e.target.value)} placeholder="readme url" className="input-field" />
          <input value={pVideo} onChange={(e) => setPVideo(e.target.value)} placeholder="video url" className="input-field" />
          <input value={pDevpost} onChange={(e) => setPDevpost(e.target.value)} placeholder="devpost url (optional)" className="input-field" />
          <button type="submit" disabled={addProject.isPending} className="btn-primary">
            {addProject.isPending ? "Adding…" : "Add Submission"}
          </button>
        </form>
      </Section>

      {/* ─── Alignment check ─── */}
      <Section title="Submission Alignment Check">
        {projects.length === 0 ? (
          <p className="serial">// No submissions yet</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {projects.map((p) => {
              const hasGithub = !!p.github_url;
              const hasReadme = !!p.readme_url || !!p.github_url;
              const hasVideo = !!p.video_url;
              return (
                <div
                  key={p.id}
                  className="flex items-center justify-between flex-wrap gap-3"
                  style={{ padding: "10px 12px", background: "var(--color-ink)", border: "1px solid var(--color-border)", borderRadius: 2 }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="stencil" style={{ fontSize: 14, color: "var(--color-bone)" }}>{p.name}</span>
                      <span className="chip chip--team">{p.team}</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className={hasGithub ? "chip chip--ok" : "chip chip--danger"}>{hasGithub ? "✓" : "✗"} GITHUB</span>
                      <span className={hasReadme ? "chip chip--ok" : "chip chip--danger"}>{hasReadme ? "✓" : "✗"} README</span>
                      <span className={hasVideo ? "chip chip--ok" : "chip chip--danger"}>{hasVideo ? "✓" : "✗"} VIDEO</span>
                    </div>
                  </div>
                  <button onClick={() => deleteProject.mutate(p.id)} className="btn-danger">Delete</button>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {/* ─── Criteria weights ─── */}
      <Section title="Criteria Weights">
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {criteria.map((c) => (
            <div key={c.key} className="flex items-center flex-wrap" style={{ gap: 10 }}>
              <label className="serial" style={{ width: 170, flexShrink: 0, fontSize: 10 }} title={c.description}>
                {c.label}
              </label>
              <input
                type="range" min={1} max={100} value={c.weight}
                onChange={(e) => updateWeight.mutate({ key: c.key, weight: Number(e.target.value) })}
                style={{ flex: 1, minWidth: 140 }}
              />
              <span className="readout-amber" style={{ width: 56, textAlign: "right", fontSize: 14 }}>
                {c.weight}%
              </span>
            </div>
          ))}
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
