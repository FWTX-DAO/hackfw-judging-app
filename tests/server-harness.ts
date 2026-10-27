import { resolve } from "node:path";

export const testPin = "04819372";
export const testSecret = "local-rehearsal-secret-32-characters-minimum";
export const root = resolve(import.meta.dir, "..");

export async function startServer(dbFile: string, trustProxy = "") {
  const child = Bun.spawn([Bun.which("bun")!, "src/server/index.ts"], {
    cwd: root,
    env: { ...process.env, NODE_ENV: "production", HOST: "127.0.0.1", PORT: "0", DB_FILE: dbFile, SESSION_SECRET: testSecret, ADMIN_PIN: testPin, TURSO_SYNC_URL: "", TURSO_AUTH_TOKEN: "", TRUST_PROXY: trustProxy },
    stdout: "pipe", stderr: "pipe",
  });
  let logs = "";
  let resolveReady: (url: string) => void;
  const ready = new Promise<string>((resolve) => { resolveReady = resolve; });
  const collect = async () => {
    for await (const chunk of child.stdout) {
      logs += new TextDecoder().decode(chunk);
      const match = logs.match(/API ready → (http:\/\/localhost:\d+)/);
      if (match) resolveReady!(match[1]!.replace("localhost", "127.0.0.1"));
    }
  };
  void collect();
  const errors = new Response(child.stderr).text();
  let timer: ReturnType<typeof setTimeout>;
  try {
    const url = await Promise.race([
      ready,
      child.exited.then(async (code) => { throw new Error(`Server exited ${code}: ${await errors}`); }),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(`Server startup timed out: ${logs}`)), 10_000); }),
    ]);
    return { url, process: child, async stop() { child.kill("SIGTERM"); const code = await child.exited; if (code !== 0) throw new Error(`Server exit ${code}: ${await errors}`); } };
  } catch (error) { child.kill(); throw error; }
  finally { clearTimeout(timer!); }
}
