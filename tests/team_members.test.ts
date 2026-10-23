import { describe, expect, test } from "bun:test";
import { parseTeamMembers } from "../src/shared/submissions";
import { parseProjectInput } from "../src/projects/validation";

describe("structured participant roster", () => {
  test("normalizes objects and optional emails", () => {
    expect(parseTeamMembers([{ name: " Avery ", email: " AVERY@EXAMPLE.COM " }, { name: "Jordan" }]))
      .toEqual([{ name: "Avery", email: "avery@example.com" }, { name: "Jordan" }]);
  });
  test("older newline imports and stored JSON both normalize to objects", () => {
    expect(parseProjectInput({ team_members: "Avery\nJordan" }, true).team_members).toEqual([{ name: "Avery" }, { name: "Jordan" }]);
    expect(parseTeamMembers('[{"name":"Avery"}]')).toEqual([{ name: "Avery" }]);
    expect(parseTeamMembers("")).toEqual([]);
  });
  test("rejects absent names, wrong types and malformed email", () => {
    for (const input of [["Avery"], [{}], [{ name: "" }], [{ name: "Avery", email: "bad" }], { name: "Avery" }]) {
      expect(() => parseProjectInput({ team_members: input }, true)).toThrow();
    }
  });
});
