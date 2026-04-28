import { sessionStore } from "./session";

/**
 * JSON fetch wrapper used by TanStack Query hooks.
 * Automatically attaches Bearer token from sessionStore, if present.
 * A 401 response clears the stored session so the UI can redirect to login.
 */
export async function api<T>(url: string, opts?: RequestInit): Promise<T> {
  const token = sessionStore.getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(opts?.headers as Record<string, string> | undefined),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(url, { ...opts, headers });
  if (res.status === 401) {
    sessionStore.clear();
  }
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(err?.error || `${res.status} ${res.statusText}`);
  }
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) return undefined as T;
  return (await res.json()) as T;
}
