import React, { useId } from "react";
import type { CriteriaWeight } from "../lib/types";

export function ScoreSlider({ criterion, value, onChange }: {
  criterion: CriteriaWeight;
  value: number;
  onChange: (value: number) => void;
}) {
  const id = useId();
  return (
    <div className="judge-score-control">
      <div className="judge-score-label">
        <label htmlFor={id}>{criterion.label}<span>{criterion.weight}% weight</span></label>
        <output htmlFor={id}>{value}<small>/10</small></output>
      </div>
      <p id={`${id}-description`}>{criterion.description}</p>
      <div className="judge-score-inputs">
        <button type="button" aria-label={`Decrease ${criterion.label}`} disabled={value <= 1} onClick={() => onChange(Math.max(1, value - 1))}>−</button>
        <input id={id} type="range" min={1} max={10} step={1} value={value}
          aria-describedby={`${id}-description`} aria-valuetext={`${value} out of 10`}
          onChange={(event) => onChange(Number(event.target.value))} />
        <button type="button" aria-label={`Increase ${criterion.label}`} disabled={value >= 10} onClick={() => onChange(Math.min(10, value + 1))}>+</button>
      </div>
      <div className="judge-score-scale" aria-hidden="true"><span>1 · Needs work</span><span>10 · Exceptional</span></div>
    </div>
  );
}
