import { test, expect, describe } from "bun:test";
import {
  calcWeightedScore,
  avgWeightedAcrossJudges,
  perCriterionAverages,
  checkRequirements,
  weightsToMap,
  type WeightMap,
} from "../src/scores/scoring";
import { CRITERIA_KEYS, type CriteriaWeight, type Score } from "../src/db/types";

function makeScore(
  values: Partial<Record<(typeof CRITERIA_KEYS)[number], number>>,
  extras: Partial<Score> = {}
): Score {
  return {
    id: extras.id ?? 1,
    project_id: extras.project_id ?? 1,
    judge_id: extras.judge_id ?? 1,
    technical_decisions: values.technical_decisions ?? 5,
    product_viability: values.product_viability ?? 5,
    venture_scalability: values.venture_scalability ?? 5,
    demo_uniqueness: values.demo_uniqueness ?? 5,
    reindustrialization_impact: values.reindustrialization_impact ?? 5,
    notes: extras.notes ?? "",
    created_at: extras.created_at ?? "2026-04-21T00:00:00Z",
    updated_at: extras.updated_at ?? null,
  };
}

const equalWeights: WeightMap = {
  technical_decisions: 20,
  product_viability: 20,
  venture_scalability: 20,
  demo_uniqueness: 20,
  reindustrialization_impact: 20,
};

describe("calcWeightedScore", () => {
  test("equal weights yields arithmetic mean", () => {
    const s = makeScore({
      technical_decisions: 10,
      product_viability: 8,
      venture_scalability: 6,
      demo_uniqueness: 4,
      reindustrialization_impact: 2,
    });
    // (10+8+6+4+2)/5 = 6
    expect(calcWeightedScore(s, equalWeights)).toBeCloseTo(6, 10);
  });

  test("unequal weights bias toward heavy axis", () => {
    const s = makeScore({
      technical_decisions: 10,
      product_viability: 2,
      venture_scalability: 2,
      demo_uniqueness: 2,
      reindustrialization_impact: 2,
    });
    // technical_decisions weight 50, rest 10 each; total = 90
    // raw = 10*50 + 2*10*4 = 500 + 80 = 580
    // 580/90 = 6.4444...
    const weights: WeightMap = {
      technical_decisions: 50,
      product_viability: 10,
      venture_scalability: 10,
      demo_uniqueness: 10,
      reindustrialization_impact: 10,
    };
    expect(calcWeightedScore(s, weights)).toBeCloseTo(580 / 90, 10);
  });

  test("all zero weights returns 0 with no division by zero", () => {
    const s = makeScore({
      technical_decisions: 10,
      product_viability: 10,
      venture_scalability: 10,
      demo_uniqueness: 10,
      reindustrialization_impact: 10,
    });
    const weights: WeightMap = {
      technical_decisions: 0,
      product_viability: 0,
      venture_scalability: 0,
      demo_uniqueness: 0,
      reindustrialization_impact: 0,
    };
    expect(calcWeightedScore(s, weights)).toBe(0);
  });
});

describe("avgWeightedAcrossJudges", () => {
  test("returns 0 for empty score list", () => {
    expect(avgWeightedAcrossJudges([], equalWeights)).toBe(0);
  });

  test("two identical scores returns same as single", () => {
    const s = makeScore({
      technical_decisions: 8,
      product_viability: 7,
      venture_scalability: 6,
      demo_uniqueness: 9,
      reindustrialization_impact: 5,
    });
    const single = calcWeightedScore(s, equalWeights);
    const avg = avgWeightedAcrossJudges([s, { ...s, id: 2, judge_id: 2 }], equalWeights);
    expect(avg).toBeCloseTo(+single.toFixed(2), 10);
  });
});

describe("perCriterionAverages", () => {
  test("returns zero per avg_<key> when empty", () => {
    const out = perCriterionAverages([]);
    for (const k of CRITERIA_KEYS) {
      expect(out[`avg_${k}`]).toBe(0);
    }
  });

  test("rounds to 1 decimal and yields all avg_<key> fields", () => {
    const a = makeScore({
      technical_decisions: 7,
      product_viability: 8,
      venture_scalability: 5,
      demo_uniqueness: 6,
      reindustrialization_impact: 9,
    });
    const b = makeScore(
      {
        technical_decisions: 8,
        product_viability: 7,
        venture_scalability: 6,
        demo_uniqueness: 7,
        reindustrialization_impact: 10,
      },
      { id: 2, judge_id: 2 }
    );
    const out = perCriterionAverages([a, b]);
    expect(out.avg_technical_decisions).toBe(7.5);
    expect(out.avg_product_viability).toBe(7.5);
    expect(out.avg_venture_scalability).toBe(5.5);
    expect(out.avg_demo_uniqueness).toBe(6.5);
    expect(out.avg_reindustrialization_impact).toBe(9.5);
    // All keys populated
    for (const k of CRITERIA_KEYS) {
      expect(Object.prototype.hasOwnProperty.call(out, `avg_${k}`)).toBe(true);
    }
  });

  test("rounding enforces 1-decimal output", () => {
    // Average that produces repeating decimal -> rounded to 1 decimal
    const a = makeScore({ technical_decisions: 1 });
    const b = makeScore({ technical_decisions: 2 }, { id: 2, judge_id: 2 });
    const c = makeScore({ technical_decisions: 2 }, { id: 3, judge_id: 3 });
    const out = perCriterionAverages([a, b, c]);
    // (1+2+2)/3 = 1.666... -> 1.7
    expect(out.avg_technical_decisions).toBe(1.7);
  });
});

describe("weightsToMap", () => {
  test("ignores unknown keys", () => {
    const weights: CriteriaWeight[] = [
      { key: "technical_decisions", label: "", description: "", weight: 30 },
      { key: "bogus_key", label: "", description: "", weight: 99 },
      { key: "product_viability", label: "", description: "", weight: 25 },
    ];
    const map = weightsToMap(weights);
    expect(map.technical_decisions).toBe(30);
    expect(map.product_viability).toBe(25);
    expect((map as any).bogus_key).toBeUndefined();
  });
});

describe("checkRequirements", () => {
  test("missing github is reported", () => {
    const r = checkRequirements({ github_url: "", readme_url: "", video_url: "https://v.co/x" });
    expect(r.met).toBe(false);
    expect(r.missing).toContain("github");
  });

  test("github present but no video", () => {
    const r = checkRequirements({
      github_url: "https://github.com/x/y",
      readme_url: "",
      video_url: "",
    });
    expect(r.met).toBe(false);
    expect(r.missing).toContain("video");
  });

  test("all three present -> met true, missing empty", () => {
    const r = checkRequirements({
      github_url: "https://github.com/x/y",
      readme_url: "https://github.com/x/y/readme",
      video_url: "https://youtu.be/abc",
    });
    expect(r.met).toBe(true);
    expect(r.missing).toEqual([]);
  });
});
