#!/usr/bin/env bash
# Print the cbra-platform checkout that owns the database: $CBRA_PLATFORM_DIR,
# else a sibling checkout (../cbra-platform), as in Takt and CBRATest.
set -euo pipefail
DIR="${CBRA_PLATFORM_DIR:-$(cd "$(dirname "$0")/../.." && pwd)/cbra-platform}"
if [ ! -x "$DIR/scripts/db/supabase.sh" ]; then
  echo "no cbra-platform checkout at $DIR -- clone it next to this repo or set CBRA_PLATFORM_DIR" >&2
  exit 1
fi
echo "$DIR"
