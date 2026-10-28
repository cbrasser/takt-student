# takt-student

Takt for students: a small desktop app (Tauri, Windows and macOS) with a web fallback, in which students sign in and see their current lesson. `README.md` has the layout and how to run it; `DESIGN.md` the look. Reviews apply `CODING_STANDARDS.md`.

## Conventions

- **The data comes from `cbra-platform`'s `takt_student` schema**, built there from Takt's lessons and plans. Schema changes happen there; run `npm run db:types` here afterwards.
- **One local Supabase stack at a time**: `cbra-platform`'s, from `$CBRA_PLATFORM_DIR` or a sibling `../cbra-platform` (`pnpm db:start` there).
- **`npm run verify`** is the check the pre-push hook runs; **`npm run test:e2e`** runs the Playwright test against the local stack.
- **Only the release build reaches production**: `npm run build:release` (Vite's `release` mode, `src/lib/config.ts`), which the installers and the Vercel deployment use. A `v*` tag publishes the installers (`.github/workflows/release.yml`); ask before pushing one.

## Agent skills

### Issue tracker

GitHub Issues on `cbrasser/teaching-assistant`, via `gh`, for tickets worked here too (their body starts with `Repo: takt-student`). See `docs/agents/issue-tracker.md` in teaching-assistant.

### Triage labels

The default five: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md` in teaching-assistant.

### Domain docs

Single-context, shared with teaching-assistant: its `GLOSSARY.md` and `docs/adr/`. See `docs/agents/domain.md` there. The student app's design brief is `briefs/student-app.md` there.
