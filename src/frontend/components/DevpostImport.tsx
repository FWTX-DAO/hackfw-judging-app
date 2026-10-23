import React, { useState } from "react";
import { useBulkProjects } from "../hooks/useQueries";
import type { TeamMember } from "../../shared/submissions";

const EXAMPLE_TEAMS = JSON.stringify([
  {
    name: "Factory Vision", team: "Forge Team", description: "Edge AI that detects assembly defects.",
    problem_track: "AI for Manufacturing",
    team_members: [{ name: "Avery Smith", email: "avery@example.com" }, { name: "Jordan Lee" }],
    github_url: "https://github.com/YOUR_ORG/factory-vision", readme_url: "",
    video_url: "https://example.com/factory-vision-demo", devpost_url: "",
  },
  {
    name: "Supplier Graph", team: "Foundry Team", description: "A shared view of supplier readiness and order status.",
    problem_track: "Supplier Relationship Management",
    team_members: [{ name: "Taylor Garcia", email: "taylor@example.com" }, { name: "Morgan Chen" }],
    github_url: "https://github.com/YOUR_ORG/supplier-graph", readme_url: "",
    video_url: "https://example.com/supplier-graph-demo", devpost_url: "",
  },
], null, 2);

type ImportRow = {
  name?: string;
  team?: string;
  description?: string;
  github_url?: string;
  readme_url?: string;
  video_url?: string;
  devpost_url?: string;
  problem_track?: string;
  team_members?: TeamMember[] | string;
};

function parseInput(raw: string): ImportRow[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith("[")) {
    const arr = JSON.parse(trimmed);
    if (!Array.isArray(arr)) throw new Error("Expected a JSON array");
    return arr;
  }
  if (trimmed.startsWith("{") && !trimmed.includes("\n{")) {
    try {
      return [JSON.parse(trimmed)];
    } catch {
      // fall through
    }
  }
  const rows: ImportRow[] = [];
  for (const line of trimmed.split("\n").map((l) => l.trim()).filter(Boolean)) {
    rows.push(JSON.parse(line));
  }
  return rows;
}

export function DevpostImport() {
  const [text, setText] = useState("");
  const [parseError, setParseError] = useState("");
  const [status, setStatus] = useState("");
  const bulk = useBulkProjects();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setParseError("");
    setStatus("");
    let rows: ImportRow[];
    try {
      rows = parseInput(text);
    } catch (err: any) {
      setParseError(`Parse error: ${err.message}`);
      return;
    }
    if (rows.length === 0) {
      setParseError("No rows to import");
      return;
    }
    try {
      const res = await bulk.mutateAsync(rows);
      setStatus(`Imported ${res.created} submission(s).`);
      setText("");
    } catch {
      // error surfaced via bulk.error
    }
  };

  return (
    <div className="plate plate--riveted" style={{ padding: "20px 22px 22px" }}>
      <div className="flex items-center gap-2 mb-2">
        <span className="tag-square" style={{ background: "var(--color-cyber)", boxShadow: "0 0 6px var(--glow-cyber)" }} />
        <span className="serial" style={{ fontSize: 10 }}>// Devpost Bulk Import</span>
      </div>
      <p className="serial mb-3" style={{ lineHeight: 1.6 }}>
        Paste a JSON array OR one JSON object per line · fields:
        name, team, description, problem_track, team_members (array of objects with name and optional email), github_url, readme_url, video_url, devpost_url.
        Imported submissions need admin verification and morning check-in before judging.
      </p>
      <details style={{ marginBottom: 16, fontSize: 12 }}>
        <summary style={{ cursor: "pointer", padding: "6px 0" }}>Example team objects</summary>
        <p>Example teams only. Replace the names and URLs before importing. Participant emails stay admin-only.</p>
        <pre style={{ overflowX: "auto", maxWidth: "100%", padding: 12, background: "var(--color-ink)" }}>{EXAMPLE_TEAMS}</pre>
      </details>
      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          className="input-field"
          style={{ resize: "vertical", fontSize: 12 }}
          placeholder={EXAMPLE_TEAMS}
        />
        {parseError && <span className="chip chip--danger">{parseError}</span>}
        {bulk.error && <span className="chip chip--danger">{(bulk.error as Error).message}</span>}
        {status && <span className="chip chip--ok">✓ {status}</span>}
        <div>
          <button type="submit" disabled={bulk.isPending} className="btn-primary">
            {bulk.isPending ? "Importing…" : "Import Submissions"}
          </button>
        </div>
      </form>
    </div>
  );
}
