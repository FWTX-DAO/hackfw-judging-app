import React from "react";
import type { Project } from "../lib/types";

export function PresentingBanner({
  project,
  onGradeNow,
}: {
  project: Project | null;
  onGradeNow?: (projectId: number) => void;
}) {
  if (!project) return null;

  return (
    <div className="animate-in mb-6" style={{ position: "relative" }}>
      {/* Hazard strip along the top */}
      <div
        className="hazard-stripes--phosphor"
        style={{
          height: "10px",
          width: "100%",
          borderTopLeftRadius: 3,
          borderTopRightRadius: 3,
          boxShadow: "0 2px 16px rgba(160, 240, 0, 0.25)",
        }}
      />
      <div
        className="plate plate--riveted"
        style={{
          borderTopLeftRadius: 0,
          borderTopRightRadius: 0,
          padding: "18px 20px",
          display: "flex",
          alignItems: "center",
          gap: 20,
          flexWrap: "wrap",
        }}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2" style={{ flexWrap: "wrap" }}>
            <span className="serial-plate serial-plate--live flicker">
              <span className="dot" />
              Live // On Stage
            </span>
            <span className="chip chip--team">{project.team}</span>
            {!project.requirements_met && (
              <span className="chip chip--danger">
                ⚠ Missing: {project.missing_requirements.join(" / ")}
              </span>
            )}
          </div>
          <h2
            className="stencil"
            style={{
              fontSize: "clamp(1.75rem, 4.5vw, 2.6rem)",
              color: "var(--color-bone)",
              lineHeight: 0.95,
              textShadow: "0 2px 0 rgba(0,0,0,0.6)",
            }}
          >
            {project.name}
          </h2>
          <p
            className="mt-2"
            style={{
              fontSize: 12,
              color: "var(--color-text-secondary)",
              letterSpacing: "0.04em",
              maxWidth: 560,
            }}
          >
            {project.description}
          </p>
        </div>
        {onGradeNow && (
          <button
            onClick={() => onGradeNow(project.id)}
            className="btn-primary"
            style={{ whiteSpace: "nowrap" }}
          >
            Grade Now
          </button>
        )}
      </div>
    </div>
  );
}
