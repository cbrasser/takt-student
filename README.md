# Takt for students

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

Every build talks to a local stack only: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` at build time, defaulting to `http://127.0.0.1:54321` and its anon key; anything that isn't localhost is refused. "Passwort vergessen" and "Konto erstellen" open the account site, `VITE_ACCOUNT_URL`, by default the local one (`pnpm dev` in `cbra-platform/apps/account`, port 3100). Release builds, the updater and the web deployment come with #31.

## Tests

- `npm run verify` runs every check that needs no setup: the unit tests (`node:test`), the type check, the web build and `cargo check`. The pre-push hook runs it.
- `npm run test:e2e` builds the web app against the local stack and runs the Playwright test in `e2e/`: Lea signs in and sees her current lesson without the teacher's cue, the session survives a restart and sign-out clears it, and a student without courses sees "Noch keine Lektionen". It plants its own lesson in the seeded course and removes it afterwards.

## How it works

- **Sign-in:** email and password of the student's account (the one they made on the account site for CBRATest). The session is kept in the app's own storage (the webview's local storage), not the OS keychain, so an unsigned update doesn't ask for keychain access again. Signing out clears it on this device.
- **Home:** the lesson from 10 minutes before its start until its end opens by itself; back to back, the later one. Otherwise the overview shows the next lesson of each course and the last one. "Übersicht" switches to it at any time.
- **Lesson:** date, time and course, the course's hue as the page; the topic as the title ("Noch kein Thema" until the teacher plans it); goals, "Wo wir stehen", homework and material links; "Letzte Lektion" with the previous lesson of the course. Material paths are joined to the course's published site URL; full URLs stay as they are; anything else isn't linked.
- **Freshness:** the lessons are read again on start, when the window gets focus, and every 15 minutes. Times are always Europe/Zurich.

## Where things live

- `src/lib/lessons.ts`: which lesson is current, next and last, the previous lesson, material URLs, course hues. Pure, tested in `tests/`.
- `src/lib/supabase.ts`: the connection, sign-in and the reads from `takt_student`.
- `src/lib/config.ts`: which stack and which account site a build talks to.
- `src/lib/database.types.ts`: generated from the local stack with `npm run db:types`; don't edit.
- `src/app.css`: the design tokens, light and dark ([DESIGN.md](DESIGN.md)).
- `src-tauri/`: the desktop shell, one window; links open in the browser.
