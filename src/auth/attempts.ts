import { db } from "../db/client";

// Keys are limited to existing judge IDs and the single admin account.
// Reserve before verification so simultaneous guesses share the same limit.
export async function reserveSignInAttempt(account: string, now = Date.now()): Promise<number> {
  const windowEnd = now + 15 * 60_000;
  const result = await db.execute({
    sql: `INSERT INTO sign_in_attempts (account, attempts, window_end) VALUES (?, 1, ?)
      ON CONFLICT(account) DO UPDATE SET
        attempts = CASE WHEN window_end <= ? THEN 1 ELSE attempts + 1 END,
        window_end = CASE WHEN window_end <= ? THEN ? ELSE window_end END
      WHERE window_end <= ? OR attempts < 10
      RETURNING account`,
    args: [account, windowEnd, now, now, windowEnd, now],
  });
  if (result.rows.length) return 0;
  const current = await db.execute({ sql: "SELECT window_end FROM sign_in_attempts WHERE account = ?", args: [account] });
  return Math.max(1, Math.ceil((Number(current.rows[0]?.window_end ?? windowEnd) - now) / 1000));
}

export async function clearSignInAttempts(account: string) {
  await db.execute({ sql: "DELETE FROM sign_in_attempts WHERE account = ?", args: [account] });
}

export function signInLimited(retryAfter: number) {
  return Response.json({ error: "Too many sign-in attempts. Please try again in 15 minutes." }, {
    status: 429, headers: { "Retry-After": String(retryAfter) },
  });
}
