#!/usr/bin/env bash
# Make the updater's signing key, once, and hand it to the release workflow:
#
#     sh scripts/updater-key.sh
#
# - The private key goes to ~/.tauri/takt-student.key (never into the repo),
#   its random password next to it (.password); neither is printed.
# - Both become the repo secrets TAURI_SIGNING_PRIVATE_KEY and
#   TAURI_SIGNING_PRIVATE_KEY_PASSWORD (gh secret set).
# - The public key goes into src-tauri/tauri.conf.json; commit that.
#
# Keep the key file and the password in a password manager: GitHub can't hand
# them back, and without them no installed app accepts another update.
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
REPO=cbrasser/takt-student
KEY="$HOME/.tauri/takt-student.key"

if [ -e "$KEY" ]; then
  echo "$KEY exists already; a new key would lock out every installed app. Remove it by hand if you really mean to." >&2
  exit 1
fi
mkdir -p "$(dirname "$KEY")"

(umask 077 && openssl rand -base64 32 | tr -d '\n' > "$KEY.password")
cd "$HERE"
npx tauri signer generate --ci -w "$KEY" -p "$(cat "$KEY.password")" >/dev/null
chmod 600 "$KEY"

gh secret set TAURI_SIGNING_PRIVATE_KEY -R "$REPO" < "$KEY"
gh secret set TAURI_SIGNING_PRIVATE_KEY_PASSWORD -R "$REPO" < "$KEY.password"

node -e '
  const fs = require("fs");
  const [conf, pub] = process.argv.slice(1);
  const text = fs.readFileSync(conf, "utf8");
  const key = fs.readFileSync(pub, "utf8").trim();
  const next = text.replace(/("pubkey": )"[^"]*"/, (_, k) => k + JSON.stringify(key));
  if (next === text) throw new Error("no pubkey in " + conf);
  fs.writeFileSync(conf, next);
' src-tauri/tauri.conf.json "$KEY.pub"

cat <<EOF
Done.
- Secrets set on $REPO: TAURI_SIGNING_PRIVATE_KEY, TAURI_SIGNING_PRIVATE_KEY_PASSWORD.
- Public key written to src-tauri/tauri.conf.json: commit it.
- Put both files into your password manager now:
    $KEY
    $KEY.password
EOF
