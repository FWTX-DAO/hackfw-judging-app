export { db, syncNow, initPragmas, DB_PATH } from "./client";
export { migrate, seed } from "./schema";
export * from "./types";

import { initPragmas } from "./client";
import { migrate, seed } from "./schema";

export async function bootstrapDb() {
  await initPragmas();
  await migrate();
  await seed();
}
