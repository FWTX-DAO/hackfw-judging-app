# Deploying HackFW

The release runs **one Bun 1.4.4 process on one machine**, with API, WebSockets and the built frontend sharing a persistent SQLite database. The database and WebSocket subscribers are local to that machine. Do not scale horizontally or enable a second/spare machine for this deployment architecture.

`min_machines_running = 1` is a minimum, not a replica limit. Fly can create spare machines by default; use `--ha=false` and inspect the actual machine count. Fly does not copy database contents when it creates additional volumes. References: [deploy options](https://fly.io/docs/flyctl/deploy/), [volume scaling](https://fly.io/docs/launch/scale-count/).

## Verify the release locally

```bash
bun install --frozen-lockfile
bun run check
```

Then deploy with the Fly CLI below. `bun run smoke` and `bun scripts/container-smoke.ts IMAGE` are optional deeper checks for browser or Docker changes; they create disposable databases/volumes. Browser evidence is in `out/production-audit/`. This repository does not require a CI workflow to deploy.

## Required production settings

| Setting | Requirement |
|---|---|
| `NODE_ENV` | `production` (Docker/Fly config supplies it) |
| `SESSION_SECRET` | Random value of at least 32 characters; generate with `openssl rand -hex 32`. Keep stable across restarts. Rotation invalidates all sessions. |
| `ADMIN_PIN` | 8 random digits; preserve leading zeros and save privately. Existing random passwords of at least 12 characters remain supported. Do not use the dev PIN. |
| `DB_FILE` | Absolute path on the persistent volume: `/data/hackathon.db`. The volume must include WAL sidecars. |
| `PORT` | `3000` for the provided Docker/Fly configuration |
| `TRUST_PROXY` | `fly` only behind Fly Proxy; otherwise leave unset. Failed sign-ins use the socket IP by default. |

The server refuses production startup with missing/weak/default secrets, a relative DB path or no built frontend. It cannot prove that an absolute path is mounted persistently; the operator must inspect the volume. Use local SQLite for the supported single-machine deployment. Optional Turso sync is not covered by the deployment rehearsals and is not a substitute for a backup or shared WebSocket bus.

Generate an admin PIN with `bun -e 'console.log(require("node:crypto").randomInt(100_000_000).toString().padStart(8, "0"))'`. New judge codes contain six random digits and are stored with salted Argon2id hashes. Both are reusable event credentials, not expiring OTPs. Each judge account and the shared admin account allows 10 unsuccessful attempts per 15-minute window across all IP addresses. The counter survives restarts and clears on successful sign-in. Keep an authenticated admin session available during the event.

## Fly.io

`fly.toml` is a template with no fixed app target. Keep production overrides in an ignored copy:

```bash
cp fly.toml fly.production.toml
```

In `fly.production.toml`, set `app = "YOUR_APP"`, choose a region, and set the volume source to the intended persistent volume. Create/select the app in your Fly account. For an existing deployment, retain its authoritative database volume.

```bash
fly auth login
fly status --app YOUR_APP
fly machine list --app YOUR_APP
fly volumes list --app YOUR_APP
```

For a new app only, provision the volume matching the configured source and region:

```bash
fly volumes create hackfw_data --app YOUR_APP --region YOUR_REGION --size 1
```

Store both generated values in the operator's password manager, then supply them via environment variables (do not paste actual values into source or shell history):

```bash
fly secrets set --app YOUR_APP SESSION_SECRET="$SESSION_SECRET" ADMIN_PIN="$ADMIN_PIN"
fly config validate --config fly.production.toml
fly deploy --config fly.production.toml --ha=false
fly machine list --app YOUR_APP
fly volumes list --app YOUR_APP
fly checks list --app YOUR_APP
```

Verify exactly one application machine, the intended attached volume, healthy HTTP checks and a valid HTTPS endpoint. If multiple machines already exist, inspect which volume holds authoritative event data before any scale-down; `--ha=false` does not repair an existing split database. Do not destroy volumes to fix routing.

The config keeps the machine running, allows 15 seconds to shut down, and checks `/api/health` every 15 seconds. The health route performs a database read. See [Fly health check configuration](https://fly.io/docs/reference/configuration/#http_service-checks).

## Any Docker host

```bash
docker run -d --name hackfw --restart unless-stopped \
  -p 127.0.0.1:3000:3000 \
  -v hackfw_data:/data \
  -e SESSION_SECRET -e ADMIN_PIN \
  hackfw-judging:release
```

Use a TLS-terminating reverse proxy with WebSocket support. Do not cache `/api/*` or `/ws`. Keep `/api/auth` and `/api/admin/auth` protected by the app's throttling; if the proxy hides client IPs, apply per-client throttling at that proxy as well. The app limits failed sign-ins to 30 per client/endpoint per five minutes and does not charge successful sign-ins against that allowance.

## Upgrade behavior

Back up before deploying. Migration adds hashed judge access codes, session versions, and persistent sign-in attempt counters without removing existing scores. Judges upgrading from email-only sign-in need **Reset access code** before their next login. Previously issued longer codes remain valid and their hashes are upgraded on successful login; resetting a code issues six digits and revokes the judge's existing sessions. Unsupported legacy scoring schemas stop startup instead of deleting data and require a separately reviewed migration.

Team evidence edits still revoke relevant verification. Deleting a project deletes its scores after UI confirmation. Removing a judge who has scores is blocked. Use code reset to revoke access while retaining their grades.

## Backup and restore

Use the bundled Bun script; the runtime image does not depend on the `sqlite3` CLI. It creates a consistent snapshot including committed WAL data, runs integrity/foreign-key checks, refuses to overwrite an existing file and sets private file permissions. It uses SQLite's [VACUUM INTO](https://www.sqlite.org/lang_vacuum.html#vacuum_with_an_into_clause).

```bash
# Local or inside a container; choose a NEW filename each time.
DB_FILE=/data/hackathon.db bun scripts/backup.ts /data/pre-event-snapshot.db

# Fly: snapshot and download it off the machine.
fly ssh console --app YOUR_APP -C "bun /app/scripts/backup.ts /data/pre-event-snapshot.db"
fly ssh sftp get --app YOUR_APP /data/pre-event-snapshot.db ./pre-event-snapshot.db
chmod 600 ./pre-event-snapshot.db
shasum -a 256 ./pre-event-snapshot.db
```

Take an off-host backup before upgrades, before scoring, at scheduled breaks, and after the final grades. An on-volume snapshot alone does not recover a lost volume. Choose the backup frequency according to how much submitted scoring could be re-entered. Never copy only an active main DB file and assume it includes WAL writes.

Restore rehearsal (isolated copy, never over a running event database):

1. Copy the downloaded snapshot to a new directory/volume, preserving the original snapshot and failed database files. Run `PRAGMA integrity_check` and `PRAGMA foreign_key_check` with Bun's SQLite API; require `ok` and no FK violations.
2. Run the audited image against that copy as `/data/hackathon.db`. Use the intended production session secret; generate a different secret for an isolated rehearsal if required.
3. Verify project/judge/score counts, check-in flags, criteria weights and recorded scores. Use `/api/health`, admin sign-in, the private score endpoints and the public standings.
4. For actual recovery, pause traffic and stop the old writer first. Attach the restored volume to the single replacement machine. Do not overwrite a live DB or retain stale WAL sidecars beside a replacement DB. Retain the original failed volume for investigation.
5. Run the public acceptance checks before redirecting the room to the recovered host. Explain any grades lost since the chosen backup.

Code rollback: keep the last accepted image digest and deploy that image with `--ha=false` against the same volume only if its schema is compatible. Do not downgrade to the old email-only login release on a public host. Database restore is a separate operation and loses writes after the backup; do not perform it just to roll back application code.

## Public acceptance after deploy

```bash
curl --fail --silent --show-error https://YOUR_HOST/api/health
curl --fail --silent --show-error https://YOUR_HOST/api/config
curl --fail --silent --show-error https://YOUR_HOST/api/leaderboard
```

Check the deployed commit/image, HTTPS, machine count and volume; open admin, two judge devices and the room display; verify real credentials, all five gates, stage switching, explicit score submission, refresh recovery, public privacy and live display updates. Recreate/restart the machine once during rehearsal and verify persistence. A local build or a passing health check alone is not this public acceptance.

Before announcing final results, ask judges to stop editing, verify complete panel counts and take an off-host snapshot. **Pause Judging clears the stage selection; it does not lock scores.** Standings remain provisional until the organizers approve final awards.
