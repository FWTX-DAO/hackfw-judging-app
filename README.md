# HackFW Judging App

A public-facing realtime hackathon judging boilerplate, with HackFW: MADE Challenge as the example configuration. Includes team check-in, verified submissions, admin stage controls, weighted scoring, and public standings. A single Bun process serves the API, WebSockets and React frontend, backed by SQLite.

Keep this repository as the reusable base: production secrets, judge rosters, submissions, scores and deployment-specific configuration belong in the deployment environment or persistent database. The default judge roster is empty.

- **Judges** sign in with their pre-authorized email plus a private 6-digit code and score each project on five weighted axes (1–10) with private notes.
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
  judges:   [], // onboard judges privately through the admin UI
  criteria: [{ key: "technical_decisions", label: "...", description: "...", weight: 20 }, /* ... */],
  requirements: { problem_track: true, github: true, video: true, talent_registration: true, in_person_demo_day: true },
};
```

Criterion **weights** are editable live in the Admin UI. Labels, descriptions and default weights are seeded from the configuration when the database is first created; editing the configuration does not overwrite an existing panel's criteria. Criterion **keys** are baked into the DB schema, so changing the five default keys requires a code change.

## Day-of-event flow

1. **First boot (admin)** — log in at `/` with the admin PIN, then **Authorize Judges** (name + email per judge). Save each 6-digit code when it is displayed and share it privately with its judge. Judges reuse their code throughout the event until you reset it. Previously issued longer codes remain valid; use **Reset access code** to replace one with six digits. No redeploy is needed.
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

Grades and notes are drafted per judge and submission and restored after refresh. A draft is not a submitted score. Submitted grades show a persistent confirmation, edits unlock re-submission, and failed submissions retain the draft. Explicitly logging out clears both current and legacy drafts from that browser. Session expiry preserves them for the same judge after sign-in; a temporary network failure does not sign you out.

## Deploy

See [`DEPLOY.md`](./DEPLOY.md) for Docker/Fly setup, backup/restore and post-deploy checks. Copy `fly.toml` to ignored `fly.production.toml`, then set your own app name, region and volume there. Keep the tracked template deployment-neutral.

Production requires a random `SESSION_SECRET` (at least 32 characters), an 8-digit random `ADMIN_PIN` (existing random passwords of at least 12 characters also work), an absolute `DB_FILE` on persistent storage, and the built frontend. Run exactly one machine; SQLite state and WebSocket broadcasts are local to that process. Numeric codes are reusable event credentials, not expiring one-time passwords. Each account allows at most 10 unsuccessful sign-in attempts per 15-minute window, with limits preserved across restarts; successful sign-in clears its counter. Per-IP protection also applies.

## Test

```bash
bun run check                   # types, production build, unit/API/restore tests
bunx playwright install chromium
bun run smoke                   # desktop + mobile event rehearsal
bun audit                       # current dependency advisories
```

Use Bun **1.4.4**, pinned in `.bun-version`, `package.json` and Docker. Run `bun run check` locally, then deploy with the Fly CLI as described in [DEPLOY.md](./DEPLOY.md). Browser and container rehearsals are optional for changes affecting those flows. Rehearsals use disposable databases. Generated screenshots and reports are written to ignored `out/`; they are not repository source files.

## Security

Signed HMAC sessions; private randomly generated judge codes stored as hashes; database-backed session revocation on code reset/removal; failed-login throttling; HTTP/HTTPS link validation; production boot checks; CSP, HSTS and no-store API responses. Judge notes and participant emails are not public. Removing judges with submitted scores is blocked to preserve standings. Codes are displayed once to the admin and are never sent by email automatically. Report vulnerabilities privately rather than in public issues.
