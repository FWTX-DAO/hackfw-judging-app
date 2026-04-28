# Deploying HackFW

The app is a single Bun process: API + WebSocket realtime layer + statically-served React frontend, backed by a libSQL/SQLite file. Anything that runs Docker and gives you a persistent volume will work; Fly.io is the documented happy path because volumes + WebSockets + always-on machines are first-class there.

## Required environment variables

| Var | Purpose | Notes |
|---|---|---|
| `SESSION_SECRET` | HMAC key used to sign judge/admin tokens. | **Must** be set in production; the server refuses to boot otherwise. Use a long random string (`openssl rand -hex 32`). Rotating invalidates every existing session. |
| `ADMIN_PIN` | PIN that unlocks `/admin`. | **Must** be set in production. Treat like a password — long, random, not the dev default. |
| `PORT` | HTTP listen port. | Defaults to `3000`. |
| `DB_FILE` | Path to the SQLite file. | Defaults to `data/hackathon.db`. In Docker / Fly we point this at the mounted volume. |
| `TURSO_SYNC_URL` + `TURSO_AUTH_TOKEN` | *(optional)* Turso embedded-replica sync. | Only set if you want remote replication. The local file remains the primary source of truth. |

## Persistent state

Everything stateful is in `$DB_FILE` plus its WAL sidecars (`<file>-shm`, `<file>-wal`). Whatever directory holds them must survive container restarts. In our Dockerfile we hardcode `/data/hackathon.db`; mount a volume at `/data`.

## Quickstart: Fly.io

```bash
# one-time
fly auth login
fly launch --copy-config --no-deploy   # picks app name + region; reuses fly.toml
fly volumes create hackfw_data --region dfw --size 1
fly secrets set \
  SESSION_SECRET="$(openssl rand -hex 32)" \
  ADMIN_PIN="$(openssl rand -hex 6)"

# deploy
fly deploy

# inspect
fly logs
fly ssh console -C "ls -la /data"
```

`fly.toml` already pins:
- `min_machines_running = 1` so live judging never cold-starts mid-event
- `force_https = true`
- `/data` volume mount
- WebSocket-friendly concurrency limits

## Quickstart: any Docker host

```bash
docker build -t hackfw-judging .

docker run -d --name hackfw \
  -p 3000:3000 \
  -v hackfw_data:/data \
  -e SESSION_SECRET="$(openssl rand -hex 32)" \
  -e ADMIN_PIN="$(openssl rand -hex 6)" \
  hackfw-judging
```

Front it with a TLS-terminating reverse proxy (Caddy, nginx, Cloudflare Tunnel, ALB) — the Bun server itself listens HTTP-only.

## Realtime / WebSocket notes

- The frontend opens **one** WebSocket to `/ws` (same origin). It pings every 25 s, so any L7 proxy with a 60 s idle timeout will keep the connection alive.
- On reconnect after a disconnect the client invalidates `projects`, `leaderboard`, and `criteria` queries to catch up on missed events.
- If you front this with Cloudflare, leave WebSockets enabled (default) and don't aggressively cache `/api/*` or `/ws`.

## Backups

WAL is checkpointed automatically. For a quick offsite backup:

```bash
fly ssh console -C "sqlite3 /data/hackathon.db '.backup /data/snapshot.db'"
fly ssh sftp get /data/snapshot.db ./hackfw-$(date +%F).db
```

## Smoke after deploy

```bash
curl -sS https://<host>/api/config | jq .branding.name        # → "HackFW"
curl -sS https://<host>/api/leaderboard | jq 'length'         # → 0+
# WebSocket
websocat wss://<host>/ws &                                    # leave open
curl -sS -X POST https://<host>/api/admin/auth \
  -H 'content-type: application/json' \
  -d "{\"pin\":\"$ADMIN_PIN\"}"                               # → token
# (Add a project as admin and watch `projects_updated` arrive on the ws line.)
```
