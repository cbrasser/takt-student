#!/bin/sh
# The one check: what the pre-push hook and CI run. Stops at the first failure.
#
#   npm run verify
#
# The end-to-end test (npm run test:e2e) needs the local Supabase and stays
# out; see README.md.

set -eu

# Run from a git hook, git exports where the repository is; clear it so
# nothing below writes into this one by accident.
unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE GIT_COMMON_DIR GIT_PREFIX

cd "$(dirname "$0")/.."
[ -f "$HOME/.cargo/env" ] && . "$HOME/.cargo/env"

step() { printf '\n== %s\n' "$1"; }

# npm writes node_modules/.package-lock.json on every install: older than the
# lockfile means the dependencies changed since.
if [ ! -f node_modules/.package-lock.json ] || [ package-lock.json -nt node_modules/.package-lock.json ]; then
  step "npm install (package-lock.json changed)"
  npm install
  touch node_modules/.package-lock.json
fi

step "npm test"
npm test
step "npm run check"
npm run check
step "npm run build"
npm run build
step "cargo check"
(cd src-tauri && cargo check)

printf '\nverify: all green\n'
