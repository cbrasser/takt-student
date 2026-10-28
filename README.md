# Takt for students

**Install it:** [app.cbratest.ch/installieren](https://app.cbratest.ch/installieren) (German, with the one-time approval on macOS and Windows), or use it in the browser at [app.cbratest.ch](https://app.cbratest.ch).

Students sign in and see their lesson: the one on now opens by itself, with today's topic and goals, where the class stands, the homework, links to the materials and what happened last lesson. A desktop app for Windows and macOS, built with Tauri 2 and Svelte 5, with the same app on the web as a fallback. The teacher plans in [Takt](https://github.com/cbrasser/teaching-assistant); what students see is a filtered copy that `cbra-platform` builds in the `takt_student` schema, so a teacher's cues and notes never reach this app.

Tickets live in the [teaching-assistant tracker](https://github.com/cbrasser/teaching-assistant/issues) (`Repo: takt-student`); the design brief is `briefs/student-app.md` there.

## Run

The app talks to the local Supabase stack of [cbra-platform](https://github.com/cbrasser/cbra-platform), checked out next to this repo (or at `$CBRA_PLATFORM_DIR`):

```bash
cd ../cbra-platform && pnpm db:start
```

In the browser:

```bash
npm install
npm run dev
```

Then open http://localhost:1430 and sign in as `lea@seed.test` (a student in the seeded course INF-3a) or `liam@seed.test` (no Takt course), password `devpassword`. The seed puts a lesson "now"; `pnpm db:seed` in cbra-platform moves it to the present again.

As the desktop app (needs Rust: https://rustup.rs):

```bash
npm run tauri dev
```

Every local build talks to a local stack only: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` at build time, defaulting to `http://127.0.0.1:54321` and its anon key; anything that isn't localhost is refused. "Passwort vergessen" and "Konto erstellen" open the account site, `VITE_ACCOUNT_URL`, by default the local one (`pnpm dev` in `cbra-platform/apps/account`, port 3100). Only the release build talks to production (below).

## Release

The release build (`npm run build:release`, Vite's `release` mode) talks to the production project and `accounts.cbratest.ch`, whatever the environment says; it is the only one that looks for updates.

- **Installers:** push a tag `v<version>` (`git tag v0.2.0 && git push origin v0.2.0`). [`release.yml`](.github/workflows/release.yml) builds an ad-hoc-signed universal `.dmg` and a per-user NSIS installer, uploads them with the signed updater files under the same names in every release, writes `latest.json` (`scripts/release-manifest.ts`) and publishes the release. The tag is the version; `tauri.conf.json`'s is only for local builds. There's no minimum-version gate: schema changes stay additive.
- **Updates:** the app reads `releases/latest/download/latest.json` on start and every 6 hours, asks the student, then installs and restarts. The updater key (`scripts/updater-key.sh`, once) is the repo secrets `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`; its public half is in `src-tauri/tauri.conf.json`. Losing the private key means every student reinstalls by hand.
- **Web:** Vercel (fra1) builds `npm run build:release` from `main` for `app.cbratest.ch` ([`vercel.json`](vercel.json)), with the install page at `/installieren`. Only production builds; previews are skipped, since a preview would talk to production too.
- **Locally:** `npm run tauri:release` builds the release app (it needs the updater key in `TAURI_SIGNING_PRIVATE_KEY`); `npm run tauri build` builds a local one without updater files.

## Tests

- `npm run verify` runs every check that needs no setup: the unit tests (`node:test`), the type check, the web build and `cargo check`. The pre-push hook runs it.
- `npm run test:e2e` builds the web app against the local stack and runs the Playwright test in `e2e/`: Lea signs in and sees her current lesson without the teacher's cue, the session survives a restart and sign-out clears it, and a student without courses sees "Noch keine Lektionen"; Lea hands in an exit ticket, sees it again after a restart, edits it and sees it close; in the Verlauf Lea sees last week's seeded lesson with her status and ticket and a missed lesson, sees the seeded lesson from before check-in started without a status, and saves it as Markdown, Noah sees "Exit-Ticket fehlt" and Mia her excused ticket. In Demnächst Lea sees the seeded Prüfung and Abgabe on the overview and per course, opens both details pages (one full, one "Details folgen") and sees the badge on next week's lesson. Specs that need a lesson of their own plant it in the seeded course and remove it afterwards.

## How it works

- **Sign-in:** email and password of the student's account (the one they made on the account site for CBRATest). The session is kept in the app's own storage (the webview's local storage), not the OS keychain, so an unsigned update doesn't ask for keychain access again. Signing out clears it on this device.
- **Home:** the lesson from 10 minutes before its start until its end opens by itself; back to back, the later one. After its end it stays on while its exit ticket is open, and once that closes it stays on show (saying so) until the student goes to the overview or the next lesson opens. Otherwise the overview shows the next lesson of each course and the last one. "Übersicht" switches to it at any time.
- **Lesson:** date, time and course, the course's hue as the page; the topic as the title ("Noch kein Thema" until the teacher plans it); goals, "Wo wir stehen", homework and material links; "Letzte Lektion" with the previous lesson of the course. Material paths are joined to the course's published site URL; full URLs stay as they are; anything else isn't linked.
- **Check-in:** "Bereit" shows from 10 minutes before the start until the end, by the device's clock. The server decides (`takt_student.check_in()`): it stamps its own time and refuses a student who isn't enrolled or a time outside the window, and the app shows why. Once checked in, the button becomes "Eingecheckt 08:17 · pünktlich" or "· zu spät" (`takt_student.status()`, by the teacher's cutoff).
- **Exit ticket:** shown in the lesson from 10 minutes before the end, or from the teacher's early open (`exit_opened_at`), until 15 minutes after the end, by the device's clock. A line on top says who sees what. The private note ("Was haben wir gemacht?"), "Was war unklar?" with an "Alles klar" choice, and a 1–4 rating per goal, each optional, go to `takt_student.submit_exit_ticket()`, which stamps its time, refuses outside the window and keeps the first submission time on edits. The student can edit until it closes; then the lesson says it has closed, with the answers handed in.
- **Demnächst:** per course, from the overview's "Deine Kurse": the lessons that haven't ended and the Prüfungen and Abgaben still ahead (an Abgabe until its deadline, under today when it was dated earlier), by day and grouped by week, up to the end of the semester holding today (else the next one; all of them ahead without a school year or after its last semester, from the course summary's `semesters`). Lessons show only their topic. A Prüfung or Abgabe opens its details page: the covered pages as links, the goals, the practice link and the free text with its web addresses linked, or "Details folgen" with none of them; an Abgabe's deadline with a countdown ("noch 3 Tage", under a day "noch 5 Std. 20 Min.", then "abgelaufen"). The overview lists the next five across all courses (an Abgabe until its deadline). A lesson carries "Prüfung" or "Abgabe" badges for its course's assessments on its day, in Demnächst, Verlauf and the lesson view.
- **Verlauf:** per course, from the overview: the course's lessons that have ended, newest first, each with its topic, homework and materials, the student's own status (pünktlich, zu spät, entschuldigt, anwesend when the teacher marked them present by hand, or **verpasst** without a check-in, highlighted), and their own exit ticket, both parts. "Exit-Ticket fehlt" where they were present without one once it has closed, the same lessons the teacher's course view counts (the client copy of `takt_student.ticket_status()` in `src/lib/ticketStatus.ts`, pinned to cbra-platform's shared cases); "Exit-Ticket entschuldigt" where the teacher excused it. Lessons before the course's check-in start (`takt_student.check_in_start()`, the day of its first check-in or mark), such as those Takt backfilled for the school year, have no status: no "verpasst", no "Exit-Ticket fehlt", as Takt's course record doesn't count them; a course without check-ins has no status anywhere. "Als Markdown speichern" saves the student's own lessons, notes and tickets, oldest first: through the system's save dialog in the desktop app (`export_save` in `src-tauri`), as a download in the browser.
- **Notification:** the desktop app sends "Exit-Ticket ist offen" (`tauri-plugin-notification`) when its reading sees a lesson's exit ticket open, by itself or opened early by the teacher: once per lesson, also across restarts, never once handed in, and never while switched off under "Einstellungen". The switch and the lessons already seen open live in the app's own storage. The OS asks for permission the first time. It also reminds of Prüfungen and Abgaben: "in 7 Tagen" and "morgen" for every assessment and "Abgabe heute" on an Abgabe's deadline day (its date without a deadline, and not after the deadline has passed), each on the first reading from 07:00 that day, once per assessment and date (moving it re-arms the reminder, a new title doesn't), with a switch per type under "Einstellungen". The reminders sent live in the app's own storage too, pruned once their day has passed. The web app has neither the notifications nor the settings.
- **Freshness:** the lessons and check-ins are read again on start, when the window gets focus, every minute while a check-in window is open and every 15 minutes otherwise. Times are always Europe/Zurich.

## Where things live

- `src/lib/lessons.ts`: which lesson is current, next and last, the previous lesson, material URLs, course hues. Pure, tested in `tests/`.
- `src/lib/checkin.ts`: what the "Bereit" button shows, refusal reasons, when to re-read. Pure, tested in `tests/`.
- `src/lib/exitTicket.ts`: whether the exit ticket is open or closed, the form's draft and what it sends, refusal reasons. Pure, tested in `tests/`; the window itself is in `lessons.ts`.
- `src/lib/assessments.ts`: Prüfungen and Abgaben ahead: the countdown, Demnächst's weeks and the semester they run to, the overview's next ones, a lesson's badges, "Details folgen" and the free text's links. Pure, tested in `tests/`.
- `src/lib/history.ts`: the Verlauf of a course (the status and ticket per past lesson) and its Markdown export; `src/lib/ticketStatus.ts`: the ticket status. Pure, tested in `tests/` (`tests/fixtures/exit_ticket_status_cases.json` is a copy of cbra-platform's, compared with it when a checkout is next to this one).
- `src/lib/save.ts`: saving the export, through the save dialog or as a download.
- `src/lib/exitNotice.ts`: for which lessons "Exit-Ticket ist offen" fires, and its text; `src/lib/reminders.ts`: which reminders of Prüfungen and Abgaben are due on a reading, and their text. Pure, tested in `tests/`; `src/lib/notifications.ts` keeps their switches and what was sent, and sends them.
- `src/lib/supabase.ts`: the connection, sign-in, the reads from `takt_student` (with each course's `check_in_start()`), the check-in and handing in.
- `src/lib/config.ts`: which stack and which account site a build talks to, local or release.
- `src/lib/Update.svelte`: the update prompt of the release desktop app.
- `installieren.html`, `src/install.ts`, `src/install.css`: the install page.
- `scripts/release-manifest.ts`: the updater manifest of a release. Pure, tested in `tests/`.
- `.github/workflows/`: `ci.yml` runs `npm run verify`; `release.yml` publishes a tag.
- `src/lib/database.types.ts`: generated from the local stack with `npm run db:types`; don't edit.
- `src/app.css`: the design tokens, light and dark ([DESIGN.md](DESIGN.md)).
- `src-tauri/`: the desktop shell, one window; links open in the browser, it sends OS notifications, and `export_save` writes an export only where the save dialog says. `tauri.release.conf.json` is what the release build adds: the production CSP, the release frontend and the updater files.
