import { db } from "../db/client";
import type { CriteriaWeight } from "../db/types";

export async function listCriteriaWeights(): Promise<CriteriaWeight[]> {
  const r = await db.execute("SELECT * FROM criteria_weights ORDER BY key");
  return r.rows as unknown as CriteriaWeight[];
}

export async function updateCriteriaWeight(key: string, weight: number): Promise<void> {
  await db.execute({
    sql: "UPDATE criteria_weights SET weight = ? WHERE key = ?",
    args: [weight, key],
  });
}
