#!/usr/bin/env bash
# LinguaFlow build script:  syntax check → dictionary → unit tests → (optional) web-ext lint → ZIP packages.
#
#   bash build.sh                 full build (needs Node ≥ 18; installs jsdom for the DOM tests on first run)
#   bash build.sh --skip-tests    package only
#   bash build.sh --lint          also run `npx web-ext lint` (downloads web-ext once)
#
# Needs only Node.js (no `zip` / `unzip`).
# Output:  dist/linguaflow-<version>.zip          ← the extension (manifest.json at the zip root; load/sign this)
#          dist/linguaflow-<version>-source.zip   ← full project (sources, tests, scripts, README)
set -euo pipefail
cd "$(dirname "$0")"

SKIP_TESTS=0; LINT=0
for a in "$@"; do
  case "$a" in
    --skip-tests) SKIP_TESTS=1 ;;
    --lint) LINT=1 ;;
    -h|--help) sed -n '2,11p' "$0"; exit 0 ;;
    *) echo "unknown option: $a" >&2; exit 2 ;;
  esac
done
command -v node >/dev/null || { echo "Node.js is required (https://nodejs.org)" >&2; exit 1; }
VERSION="$(node -p "require('./manifest.json').version")"

echo "==> 1/5 syntax check";      node scripts/check-syntax.js
echo "==> 2/5 dictionary";        node scripts/build-dictionary.js

if [ "$SKIP_TESTS" = 0 ]; then
  echo "==> 3/5 unit tests"
  [ -d node_modules/jsdom ] || npm install --no-audit --no-fund --loglevel=error
  node scripts/run-tests.js
else
  echo "==> 3/5 unit tests (skipped)"
fi

mkdir -p dist
EXT="dist/linguaflow-${VERSION}.zip"
SRC="dist/linguaflow-${VERSION}-source.zip"
rm -f "$EXT" "$SRC"

echo "==> 4/5 package extension → $EXT"
STAGE=""
if [ "$LINT" = 1 ]; then STAGE="$(mktemp -d)"; node scripts/make-zip.js extension "$EXT" --stage "$STAGE"; else node scripts/make-zip.js extension "$EXT"; fi

if [ "$LINT" = 1 ]; then
  echo "==> web-ext lint"
  npx --yes web-ext lint --source-dir "$STAGE" || { rm -rf "$STAGE"; exit 1; }
  rm -rf "$STAGE"
fi

echo "==> 5/5 package source → $SRC"
node scripts/make-zip.js source "$SRC"

echo; echo "Built:"; ls -l "$EXT" "$SRC" | awk '{print "  " $5 " bytes  " $9}'
echo "Load in Firefox: about:debugging#/runtime/this-firefox → Load Temporary Add-on → pick manifest.json (or the .zip)"
