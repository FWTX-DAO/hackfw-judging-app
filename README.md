# HackFW Judging App

Live, terminal-themed scoring panel for hackathons. Real-time leaderboard, weighted-criteria scoring, admin console for project intake. Single Bun process backed by SQLite. White-label any event by editing one config file.

- **Judges** sign in with their pre-authorized email and score each project on five weighted axes (1–10) with private notes.
- **Admins** log in with a PIN to authorize judges, add submissions (one-by-one or bulk Devpost JSON), mark "currently presenting," and tune criteria weights.
- **Observers** open `/leaderboard` — scores update live over WebSocket, no refresh needed.

> **Roster privacy.** Judge emails are not committed to this repo. After first deploy you log in as admin and onboard your judges through the UI. The DB on your persistent volume is the only place the roster lives.

## Run it locally

```bash
bun install
bun run dev
```

Opens Vite on <http://localhost:5173> with the API on `:3000`. Dev defaults seed `data/hackathon.db` with the FWTX judges and criteria. Admin PIN: `hackfw2026` (printed on boot).

## White-label your event

Edit `hackathon.config.ts` — branding, judges, criteria, theme. That's it.

```ts
const config: HackathonConfig = {
  branding: { name: "YourEvent", title_line: "...", tagline: "...", footer: "...",
              palette: { primary: "#F59E0B", primary_bright: "#FCD34D", accent: "#00E5A0" } },
  judges:   [{ name: "Alice", email: "alice@example.com" }, /* ... */],
  criteria: [{ key: "technical_decisions", label: "...", description: "...", weight: 20 }, /* ... */],
  requirements: { github: true, readme: true, video: true },
};
```

Criterion **labels and weights** are editable live in the Admin UI. Criterion **keys** are baked into the DB schema, so changing the five default keys requires a code change.

## Day-of-event flow

1. **First boot (admin)** — log in at `/` with the admin PIN, then **Authorize Judges** (name + email per judge). They can sign in immediately; no redeploy.
2. **Pre-event (admin)** — seed projects via single form or bulk Devpost JSON paste.
3. **During presentations (admin)** — toggle "Currently Presenting"; every judge gets a live banner with a "Grade Now" button.
4. **Judging** — slide each axis 1–10, add notes (auto-drafted to localStorage), submit. Re-submit any time.
5. **Live standings** — `/leaderboard` updates across every connected device in real time.

## Deploy

Full guide → [`DEPLOY.md`](./DEPLOY.md). Fly.io quickstart:

```bash
fly auth login
fly launch --copy-config --no-deploy
fly volumes create hackfw_data --region dfw --size 1
fly secrets set \
  SESSION_SECRET="$(openssl rand -hex 32)" \
  ADMIN_PIN="$(openssl rand -hex 6)"
fly deploy
```

`Dockerfile`, `fly.toml`, and `.env.example` are checked in. The app refuses to boot in production without `SESSION_SECRET` and `ADMIN_PIN`.

## Test

```bash
bun test
```

## Security

Stateless HMAC session tokens, http/https-only URL allow-list (defends against stored XSS via `javascript:` URLs), prod-secrets boot gate, defense-in-depth headers (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`). No application-layer rate limiting — front the app with a proxy (Cloudflare, Fly's edge) for that. Report vulnerabilities privately via email rather than public issues.
