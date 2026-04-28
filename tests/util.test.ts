import { test, expect, describe } from "bun:test";
import { sanitizeUrl } from "../src/util/url";

describe("sanitizeUrl", () => {
  test("allows https URLs", () => {
    expect(sanitizeUrl("https://github.com/x/y")).toBe("https://github.com/x/y");
  });

  test("allows http URLs", () => {
    expect(sanitizeUrl("http://example.com/")).toBe("http://example.com/");
  });

  test("strips javascript: scheme", () => {
    expect(sanitizeUrl("javascript:alert(1)")).toBe("");
    expect(sanitizeUrl("JaVaScRiPt:alert(1)")).toBe("");
  });

  test("strips data: scheme", () => {
    expect(sanitizeUrl("data:text/html,<script>alert(1)</script>")).toBe("");
  });

  test("strips file: scheme", () => {
    expect(sanitizeUrl("file:///etc/passwd")).toBe("");
  });

  test("strips vbscript: and other custom schemes", () => {
    expect(sanitizeUrl("vbscript:msgbox(1)")).toBe("");
    expect(sanitizeUrl("ftp://x.com")).toBe("");
  });

  test("returns empty for non-URL strings", () => {
    expect(sanitizeUrl("not a url")).toBe("");
    expect(sanitizeUrl("github.com/x/y")).toBe(""); // no scheme
  });

  test("returns empty for blank input", () => {
    expect(sanitizeUrl("")).toBe("");
    expect(sanitizeUrl("   ")).toBe("");
  });

  test("returns empty for non-strings", () => {
    expect(sanitizeUrl(null)).toBe("");
    expect(sanitizeUrl(undefined)).toBe("");
    expect(sanitizeUrl(123)).toBe("");
    expect(sanitizeUrl({})).toBe("");
  });

  test("trims surrounding whitespace", () => {
    expect(sanitizeUrl("  https://x.com  ")).toBe("https://x.com");
  });
});
