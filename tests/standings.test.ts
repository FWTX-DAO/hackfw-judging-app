import { describe, expect, test } from "bun:test";
import { ordinal, rankStandings } from "../src/shared/standings";

describe("public standings", () => {
  test("unverified or unscored submissions do not take medal places", () => {
    const rows = rankStandings([
      { id: 1, avg_weighted: 10, judge_count: 2, requirements_met: false },
      { id: 2, avg_weighted: 0, judge_count: 0, requirements_met: true },
      { id: 3, avg_weighted: 8, judge_count: 2, requirements_met: true },
      { id: 4, avg_weighted: 9, judge_count: 1, requirements_met: true },
    ]);
    expect(rows.map(({ entry, place }) => [entry.id, place])).toEqual([[4, 1], [3, 2], [1, null], [2, null]]);
  });
  test("tied scores share a place with deterministic order", () => {
    const rows = rankStandings([3, 2, 1].map((id) => ({ id, avg_weighted: id === 3 ? 7 : 8, judge_count: 1, requirements_met: true })));
    expect(rows.map(({ entry, place }) => [entry.id, place])).toEqual([[1, 1], [2, 1], [3, 3]]);
  });
  test("place suffixes include teen exceptions", () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21].map(ordinal)).toEqual(["1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st"]);
  });
});
