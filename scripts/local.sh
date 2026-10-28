#!/usr/bin/env bash
# Run a command against the LOCAL Supabase stack (cbra-platform's):
#
#     sh scripts/local.sh playwright test
#
# The connection details go into the environment: the build reads the VITE_*
# ones, the end-to-end test the service-role key for its fixtures.
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
PLATFORM="$("$HERE/scripts/platform.sh")"

if ! out=$("$PLATFORM/scripts/db/supabase.sh" status -o env 2>/dev/null); then
  echo "the local Supabase stack is not running -- start it with: pnpm db:start  (in $PLATFORM)" >&2
  exit 1
fi
eval "$out"

export VITE_SUPABASE_URL="$API_URL"
export VITE_SUPABASE_ANON_KEY="$ANON_KEY"
export SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY"

cd "$HERE"
exec npx "$@"
