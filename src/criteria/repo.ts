import { db } from "../db/client";
import type { CriteriaWeight } from "../db/types";
import { CRITERIA_KEYS } from "../db/types";

export async function listCriteriaWeights(): Promise<CriteriaWeight[]> {
  const r = await db.execute("SELECT * FROM criteria_weights ORDER BY key");
  return r.rows as unknown as CriteriaWeight[];
}

export async function updateCriteriaWeight(key: string, weight: number): Promise<void> {
  if (!(CRITERIA_KEYS as readonly string[]).includes(key) || !Number.isFinite(weight) || weight < 0 || weight > 100) throw new RangeError("Choose a valid criterion and a weight from 0 to 100");
  const tx = await db.transaction("write");
  try {
    const result = await tx.execute({ sql: "SELECT COALESCE(SUM(weight), 0) AS total FROM criteria_weights WHERE key != ?", args: [key] });
    if (Number(result.rows[0]!.total) + weight <= 0) throw new RangeError("At least one criterion must have a positive weight");
    await tx.execute({ sql: "UPDATE criteria_weights SET weight = ? WHERE key = ?", args: [weight, key] });
    await tx.commit();
  } finally { tx.close(); }
}
