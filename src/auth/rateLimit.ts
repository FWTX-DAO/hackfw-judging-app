// Single-process deployment: bound failed sign-ins per client, without charging
// successful judges sharing the venue Wi-Fi against the same allowance.
export class LoginLimiter {
  private entries = new Map<string, { count: number; until: number }>();
  constructor(private limit = 30, private windowMs = 5 * 60_000) {}

  retryAfter(key: string, now = Date.now()): number {
    const entry = this.entries.get(key);
    if (entry && entry.until <= now) { this.entries.delete(key); return 0; }
    return entry && entry.count >= this.limit ? Math.ceil((entry.until - now) / 1000) : 0;
  }

  fail(key: string, now = Date.now()) {
    for (const [id, entry] of this.entries) if (entry.until <= now) this.entries.delete(id);
    const entry = this.entries.get(key) ?? { count: 0, until: now + this.windowMs };
    entry.count++;
    this.entries.set(key, entry);
    if (this.entries.size > 10_000) this.entries.delete(this.entries.keys().next().value!);
  }
}
