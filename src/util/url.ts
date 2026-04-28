/**
 * URL sanitization for fields that flow into anchor `href` attributes.
 *
 * Anything other than http: / https: is dropped — `javascript:`, `data:`,
 * `file:`, custom schemes, etc. all become empty strings. Returning "" is
 * deliberate: the project's existing requirements UI already treats blank
 * URL fields as "missing", so an admin pasting a malicious link sees the
 * same warning as a forgotten one.
 */
const ALLOWED_URL_SCHEMES = new Set(["http:", "https:"]);

export function sanitizeUrl(input: unknown): string {
  if (typeof input !== "string") return "";
  const trimmed = input.trim();
  if (!trimmed) return "";
  try {
    const u = new URL(trimmed);
    if (!ALLOWED_URL_SCHEMES.has(u.protocol)) return "";
    return trimmed;
  } catch {
    return "";
  }
}
