import React from "react";
import type { CriteriaWeight } from "../lib/types";

export function ScoreSlider({
  criterion,
  value,
  onChange,
}: {
  criterion: CriteriaWeight;
  value: number;
  onChange: (v: number) => void;
}) {
  const pct = ((value - 1) / 9) * 100;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <div>
          <label
            className="text-xs font-medium uppercase tracking-wider"
            style={{ color: "var(--color-text-secondary)" }}
          >
            {criterion.label}
          </label>
          <span
            className="text-xs ml-2 px-1.5 py-0.5 rounded"
            style={{
              color: "var(--color-cyber)",
              background: "var(--color-cyber-dim)",
              fontSize: "0.6rem",
            }}
          >
            {criterion.weight}%
          </span>
        </div>
        <span
          className="w-8 text-right font-bold text-lg"
          style={{
            fontFamily: "var(--font-heading)",
            color:
              value >= 8
                ? "var(--color-cyber)"
                : value >= 5
                ? "var(--color-amber-bright)"
                : "var(--color-text-tertiary)",
            textShadow:
              value >= 8
                ? "0 0 8px rgba(0,229,160,0.3)"
                : value >= 5
                ? "0 0 8px var(--color-amber-glow)"
                : "none",
          }}
        >
          {value}
        </span>
      </div>
      <p
        className="text-xs"
        style={{ color: "var(--color-text-tertiary)", fontSize: "0.65rem", marginBottom: "4px" }}
      >
        {criterion.description}
      </p>
      <div className="relative">
        <input
          type="range"
          min={1}
          max={10}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full"
        />
        <div
          className="absolute top-1/2 left-0 h-1 rounded-full pointer-events-none -translate-y-1/2"
          style={{
            width: `${pct}%`,
            background: `linear-gradient(90deg, var(--color-amber), var(--color-amber-bright))`,
            opacity: 0.6,
          }}
        />
      </div>
    </div>
  );
}
