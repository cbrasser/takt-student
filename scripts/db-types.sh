#!/usr/bin/env bash
# Regenerate src/lib/database.types.ts (`takt` and `takt_student`) with
# cbra-platform's `db:types`, from the local stack. Run after a migration there
# changes `takt_student`.
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
"$("$HERE/scripts/platform.sh")/scripts/db/types.sh" "$HERE/src/lib/database.types.ts"
