import { describe, expect, test } from "bun:test";
import { parseScoreDraft, scoreDraftKey } from "../src/frontend/lib/drafts";

const criteria = [{ key: "technical_decisions", label: "Technical decisions", weight: 100, description: "" }];
describe("mobile score drafts", () => {
  test("restores full grades and notes without accepting unrelated fields", () => {
    expect(parseScoreDraft(JSON.stringify({ version: 1, score: { technical_decisions: 8, notes: "Strong demo", judge_id: 999 } }), criteria))
      .toEqual({ technical_decisions: 8, notes: "Strong demo" });
  });
  test("rejects incomplete, invalid and incompatible drafts", () => {
    for (const raw of [null, "broken", '{"version":2}', JSON.stringify({ version: 1, score: { notes: "Missing grade" } }), ...[0, 11, 4.5, "8"].map((value) => JSON.stringify({ version: 1, score: { technical_decisions: value, notes: "" } }))]) {
      expect(parseScoreDraft(raw, criteria)).toBeNull();
    }
  });
  test("drafts are scoped to both judge and submission", () => {
    expect(scoreDraftKey(1, 2)).not.toBe(scoreDraftKey(2, 2));
    expect(scoreDraftKey(1, 2)).not.toBe(scoreDraftKey(1, 3));
  });
});
