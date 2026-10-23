# HackFW Judging App

Live judging for HackFW: MADE Challenge Demo Day. Includes team check-in, verified submissions, admin stage controls, weighted scoring, and a public standings display. Single Bun process backed by SQLite.

- **Judges** sign in with their pre-authorized email and score each project on five weighted axes (1–10) with private notes.
- **Admins** log in with a PIN to authorize judges, create/edit/delete submissions and team rosters, verify requirements, check teams in, steer the live judging queue, and tune criteria weights.
- **Observers** open `/leaderboard` for compact live standings, or `/leaderboard?display=1` for the room display. Eligible scored teams receive gold/silver/bronze place treatments; ties share a place and results remain provisional.

> **Roster privacy.** Judge emails are not committed to this repo. After first deploy you log in as admin and onboard your judges through the UI. The DB on your persistent volume is the only place the roster lives.

## Run it locally

```bash
bun install
bun run dev
```

Opens Vite on <http://localhost:5173> with the API on `:3000`. Dev defaults seed `data/hackathon.db` with the criteria and an empty judge roster. Admin PIN: `hackfw2026` (printed on boot).

## White-label your event

Edit `hackathon.config.ts` for branding, judge bootstrap, criteria, and theme. The five HackFW verification rules are implemented in `src/shared/submissions.ts`.

```ts
const config: HackathonConfig = {
  branding: { name: "YourEvent", title_line: "...", tagline: "...", footer: "...",
              palette: { primary: "#F59E0B", primary_bright: "#FCD34D", accent: "#00E5A0" } },
  judges:   [{ name: "Alice", email: "alice@example.com" }, /* ... */],
  criteria: [{ key: "technical_decisions", label: "...", description: "...", weight: 20 }, /* ... */],
  requirements: { problem_track: true, github: true, video: true, talent_registration: true, in_person_demo_day: true },
};
```

Criterion **labels and weights** are editable live in the Admin UI. Criterion **keys** are baked into the DB schema, so changing the five default keys requires a code change.

## Day-of-event flow

1. **First boot (admin)** — log in at `/` with the admin PIN, then **Authorize Judges** (name + email per judge). They can sign in immediately; no redeploy.
2. **Pre-event (admin)** — add submissions in **Submissions & team check-in**, or import Devpost JSON. Edit each submission’s name, team, participant roster (name and optional admin-only email), description, problem track, GitHub, demo video, README, and Devpost links. Review the evidence and check off the track, public GitHub repository, end-to-end video, and talent registration for every participant.
3. **Demo Day morning (admin)** — check each team in using **In-person Demo Day check-in**. The app records the timestamp. All five checks must be complete before going live or submitting a score; both API endpoints enforce this.
4. **At each team transition (admin)** — use **Live Judging Control** to **Start Judging**, move to the **Next Submission** or **Previous Submission**, or select any team directly. Submissions follow the order they were added. Connected judges automatically switch to **Live Judging** and the team's scoring panel opens, including judges viewing the leaderboard. "Grade Now" returns them to that panel. **Pause Judging** clears the live selection between presentations and leaves judges able to finish their grades.
5. **Judging** — slide each axis 1–10, add notes (the full grade and notes are saved as a device draft), then select **Submit Score**. Switching teams does not submit a grade. Re-submit any time.
6. **Live standings** — `/leaderboard` updates across every connected device in real time.

Bulk import accepts a JSON array or one object per line. Participant records use an array of objects; email is optional and is excluded from judge/public project responses and the public leaderboard. Earlier newline-separated name strings are still accepted and normalized.

```json
[
  {
    "name": "Factory Vision",
    "team": "Forge Team",
    "description": "Edge AI that detects assembly defects.",
    "problem_track": "AI for Manufacturing",
    "team_members": [
      { "name": "Avery Smith", "email": "avery@example.com" },
      { "name": "Jordan Lee" }
    ],
    "github_url": "https://github.com/YOUR_ORG/factory-vision",
    "readme_url": "",
    "video_url": "https://example.com/factory-vision-demo",
    "devpost_url": ""
  }
]
```

Replace sample names and URLs before importing. The importer also includes expandable example team objects.

Existing and imported submissions start unverified. Changing a track, repository, or video resets its confirmation. Changing the team name or participant roster resets talent and attendance checks. An edit that makes a team ineligible also pauses its live judging; previous scores are retained. Deleting a submission requires confirmation in the UI and deletes its scores.

The schema migration is additive and runs on boot. It preserves submissions and scores, adds verification fields with unchecked defaults, and clears an old live selection on the first migration. Review and check in existing teams before starting judging.

## Mobile judging

The judge workspace uses a compact sticky header, one focused submission at a time, 44px grading controls with precise minus/plus buttons, 16px notes input, and a sticky Submit Score bar with a safe-area inset. Evidence and the judge guide expand on demand. Submissions returns to the compact list; selecting a team opens its focused form. Admin transitions open the new active team automatically.

Grades and notes are drafted per judge and submission and restored after refresh. A draft is not a submitted score. Submitted grades show a persistent confirmation, edits unlock re-submission, and failed submissions retain the draft. Logging out clears both current and legacy drafts from that browser.

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
