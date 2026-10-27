import React from "react";
import { requirementLabel } from "../../shared/submissions";
import { ordinal, rankStandings } from "../../shared/standings";
import type { CriteriaWeight, LeaderboardEntry } from "../lib/types";
import { useLeaderboard } from "../hooks/useQueries";

type Standing = { entry: LeaderboardEntry; place: number | null };
type CardProps = Standing & { criteria: CriteriaWeight[]; totalJudges: number; presentation: boolean };

/** Bar fill as a 0–1 fraction of the 10-point scale. */
const fill = (score: number) => ({ "--fill": Math.min(Math.max(score / 10, 0), 1) }) as React.CSSProperties;

export function Leaderboard({ criteria, presentation = false }: { criteria: CriteriaWeight[]; presentation?: boolean }) {
  const { data, isPending, isError, error, refetch } = useLeaderboard();
  const entries = rankStandings(data ?? []);
  const totalJudges = data?.[0]?.total_judges ?? 0;
  const active = data?.find((entry) => entry.presenting === 1);
  // Ties can put more than three entries on the podium; the grid absorbs them.
  const podium = entries.filter(({ place }) => place !== null && place <= 3);
  const field = entries.filter(({ place }) => place !== null && place > 3);
  const unranked = entries.filter(({ place }) => place === null);
  const card = (standing: Standing) => (
    <StandingCard key={standing.entry.id} {...standing} criteria={criteria} totalJudges={totalJudges} presentation={presentation} />
  );

  return (
    <section className={`standings ${presentation ? "standings--display" : ""}`} aria-labelledby="standings-title">
      <div className="standings-heading">
        <div>
          <h1 id="standings-title">Live standings</h1>
          <p className="standings-summary">
            <span className="standings-pulse" aria-hidden="true" />
            Live · {entries.length} submission{entries.length === 1 ? "" : "s"} · {totalJudges} judge{totalJudges === 1 ? "" : "s"} · Provisional until judging closes; ties share a place
          </p>
        </div>
        {active && <p className="standings-onstage"><span className="standings-pulse" aria-hidden="true" /> On stage <strong>{active.name}</strong></p>}
      </div>

      {isPending && <p role="status" className="standings-empty">Loading standings…</p>}
      {isError && <div role="alert" className="standings-empty">
        <p>Unable to load standings: {(error as Error).message}</p>
        <button onClick={() => refetch()} className="btn-secondary">Retry</button>
      </div>}
      {!isPending && !isError && !entries.length && <p className="standings-empty">Teams will appear here when submissions are added.</p>}
      {!isPending && !isError && entries.length > 0 && <>
        {podium.length > 0 && <ol className="standings-podium" aria-label="Top places">{podium.map(card)}</ol>}
        {field.length > 0 && <ol className="standings-grid" aria-label="Remaining places">{field.map(card)}</ol>}
        {unranked.length > 0 && <>
          <p id="standings-unranked" className="standings-group">Not yet ranked · {unranked.length}</p>
          <ul className="standings-grid" aria-labelledby="standings-unranked">{unranked.map(card)}</ul>
        </>}
      </>}
    </section>
  );
}

function StandingCard({ entry, place, criteria, totalJudges, presentation }: CardProps) {
  const className = [
    "standings-card",
    place && place <= 3 ? `standings-card--${place}` : "",
    place ? "" : "standings-card--unranked",
    entry.presenting === 1 ? "standings-card--live" : "",
  ].filter(Boolean).join(" ");
  const meta = `${entry.team}${entry.problem_track ? ` · ${entry.problem_track}` : ""}`;

  // <summary> only allows phrasing + heading content, so the card body is built from spans.
  const main = <>
    <span className="standings-rank" aria-label={place ? `${ordinal(place)} place` : "Not ranked"}>
      {place ? <>{place <= 3 && <span aria-hidden="true">✦</span>}{ordinal(place)}</> : "—"}
    </span>
    <span className="standings-team">
      <span className="standings-name">
        <h2>{entry.name}</h2>
        {entry.presenting === 1 && <span className="standings-tag standings-tag--live">On stage</span>}
      </span>
      <span className="standings-meta" title={meta}>{meta}</span>
    </span>
    <span className="standings-score">
      {place ? <span className="standings-points">
        <strong aria-label={`Weighted score ${entry.avg_weighted.toFixed(2)} out of 10`}>{entry.avg_weighted.toFixed(2)}</strong>
        <span aria-hidden="true">/10</span>
      </span> : entry.requirements_met
        ? <span className="standings-tag">Awaiting scores</span>
        : <span className="standings-tag standings-tag--pending" title={entry.missing_requirements.map(requirementLabel).join(", ")}>Verification pending</span>}
      <small>{entry.judge_count}/{totalJudges} judged{!presentation && <span className="standings-caret" aria-hidden="true">▾</span>}</small>
    </span>
    {place && <span className="standings-bar" aria-hidden="true"><span style={fill(entry.avg_weighted)} /></span>}
  </>;

  if (presentation) return <li className={className}><div className="standings-card-main">{main}</div></li>;

  return (
    <li className={className}>
      <details>
        <summary className="standings-card-main">{main}</summary>
        <div className="standings-details">
          {entry.judge_count > 0 && <dl>{criteria.map((criterion) => {
            const value = (entry as unknown as Record<string, unknown>)[`avg_${criterion.key}`];
            return typeof value === "number" ? <div key={criterion.key}>
              <dt>{criterion.label}</dt>
              <dd><span className="standings-minibar" aria-hidden="true"><span style={fill(value)} /></span>{value.toFixed(1)}</dd>
            </div> : null;
          })}</dl>}
          <div className="standings-links">
            {entry.github_url && <a href={entry.github_url} target="_blank" rel="noreferrer">GitHub ↗</a>}
            {entry.video_url && <a href={entry.video_url} target="_blank" rel="noreferrer">Demo video ↗</a>}
            {entry.devpost_url && <a href={entry.devpost_url} target="_blank" rel="noreferrer">Devpost ↗</a>}
          </div>
        </div>
      </details>
    </li>
  );
}
