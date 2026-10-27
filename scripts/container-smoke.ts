// Exercise the exact built image and a disposable persistent Docker volume.
const image = process.argv[2] || "hackfw-judging:production-audit";
const name = `hackfw-rehearsal-${crypto.randomUUID().slice(0, 8)}`;
const volume = `${name}-data`;
async function docker(...args: string[]) {
  const child = Bun.spawn(["docker", ...args], { stdout: "pipe", stderr: "pipe" });
  const [stdout, stderr, status] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
  if (status !== 0) throw new Error(`docker ${args[0]} failed: ${stderr}`);
  return stdout.trim();
}
const launch = () => docker("run", "-d", "--name", name, "--mount", `type=volume,source=${volume},target=/data`,
  "-e", "SESSION_SECRET=container-rehearsal-random-fixture-32-characters", "-e", "ADMIN_PIN=container-rehearsal-pin", image);
async function healthy() {
  for (let attempt = 0; attempt < 40; attempt++) {
    if (await docker("inspect", "--format", "{{.State.Health.Status}}", name) === "healthy") return;
    await Bun.sleep(500);
  }
  throw new Error("Container did not become healthy");
}
await docker("volume", "create", volume);
try {
  await launch(); await healthy();
  await docker("exec", name, "bun", "-e", `
    const base = "http://localhost:3000";
    const auth = await (await fetch(base + "/api/admin/auth", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ pin: process.env.ADMIN_PIN }) })).json();
    const response = await fetch(base + "/api/projects", { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer " + auth.token }, body: JSON.stringify({ name: "Persistence rehearsal", team: "Fixture", description: "Disposable container test" }) });
    if (response.status !== 201) throw new Error("Project creation failed");
  `);
  await docker("exec", name, "bun", "scripts/backup.ts", "/data/rehearsal-snapshot.db");
  await docker("stop", "--time", "15", name);
  if (await docker("inspect", "--format", "{{.State.ExitCode}}", name) !== "0") throw new Error("Container failed graceful shutdown");
  await docker("rm", name);
  await launch(); await healthy();
  await docker("exec", name, "bun", "-e", `
    const projects = await (await fetch("http://localhost:3000/api/projects")).json();
    if (projects.length !== 1 || projects[0].name !== "Persistence rehearsal") throw new Error("Persistent volume data lost");
    if (!await Bun.file("/data/rehearsal-snapshot.db").exists()) throw new Error("Backup missing");
  `);
  console.log("Container rehearsal passed: healthy startup, authenticated write, verified backup, graceful shutdown, volume persistence after recreation.");
} finally {
  await docker("rm", "-f", name).catch(() => {});
  await docker("volume", "rm", volume);
}
