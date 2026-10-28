# Coding standards

Judgement rules for reviewing a change. `npm run verify` covers what a machine can check; these cover what it can't. Apply every rule to every change and name the rule a finding breaks.

## DESIGN.md travels with the interface

`DESIGN.md` is the record of the interface. A change to a view or a shared style updates `DESIGN.md` in the same change, so the record never trails the code.

## Colours and sizes are tokens

Every colour, radius, shadow and space is a CSS variable in `src/app.css`, redefined for the dark theme there. A component never holds a hex value. A course hue is a ground or a fill, never text, and a course is always named next to its hue.

## Decisions live in pure modules, tested with `node:test`

Which lesson is current, next or last, and what a material path links to, are decided in `src/lib/lessons.ts` from plain data and a time passed in; what the "Bereit" button shows and when the app re-reads, in `src/lib/checkin.ts`; whether the exit ticket is open and what it sends, in `src/lib/exitTicket.ts`. A view never compares times or builds a URL itself. A new rule of that kind lands in a pure module with its test.

## Data goes through `src/lib/supabase.ts`

Views get plain `Lesson` and `Course` values; only `src/lib/supabase.ts` talks to Supabase. The app reads `takt_student` only, never `takt`, and writes only through `takt_student.check_in()` and `takt_student.submit_exit_ticket()`, which stamp the server's time: row-level security is the guard, and the app never relies on its own filtering to hide another class.

## Only the release build talks to production

A local build reaches only a local stack (`http://127.0.0.1:54321` by default, `src/lib/config.ts`); anything else is refused. The release build (Vite's `release` mode) reaches the production project and nothing else, whatever the environment says. Nothing else may give a build a way there, and each CSP (`src-tauri/tauri.conf.json` for local, `src-tauri/tauri.release.conf.json` and `vercel.json` for release) allows only its build's project.

## The session stays in the app's own storage

The login is kept in the webview's local storage, never the OS keychain: unsigned builds would ask for keychain access after every update. Signing out removes it from this device.

## Times are Swiss

Every date and time on screen goes through `src/lib/format.ts`, which formats in Europe/Zurich, so a laptop set to another zone shows the school's clock.

## German with Swiss spelling

Every string a student reads is German, with "ss" for "ß", and speaks to the student as "du".
