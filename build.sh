#!/usr/bin/env bash
# LinguaFlow build script:  syntax check → dictionary → unit tests → (optional) web-ext lint → ZIP packages.
#
#   bash build.sh                 full build (needs Node ≥ 18; installs jsdom for the DOM tests on first run)
#   bash build.sh --skip-tests    package only
#   bash build.sh --lint          also run `npx web-ext lint` (downloads web-ext once)
#
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
  node --test "tests/**/*.test.js"
else
  echo "==> 3/5 unit tests (skipped)"
fi

mkdir -p dist
EXT="dist/linguaflow-${VERSION}.zip"
SRC="dist/linguaflow-${VERSION}-source.zip"
rm -f "$EXT" "$SRC"

echo "==> 4/5 package extension → $EXT"
zip -q -r -X "$EXT" manifest.json LICENSE README.md icons src data/korean/dictionary.json -x '*.DS_Store'

if [ "$LINT" = 1 ]; then
  echo "==> web-ext lint"
  TMP="$(mktemp -d)"; unzip -q "$EXT" -d "$TMP"
  npx --yes web-ext lint --source-dir "$TMP" || { rm -rf "$TMP"; exit 1; }
  rm -rf "$TMP"
fi

echo "==> 5/5 package source → $SRC"
zip -q -r -X "$SRC" . -x 'node_modules/*' 'dist/*' '.git/*' '*.DS_Store'

echo; echo "Built:"; ls -l "$EXT" "$SRC" | awk '{print "  " $5 " bytes  " $9}'
echo "Load in Firefox: about:debugging#/runtime/this-firefox → Load Temporary Add-on → pick manifest.json (or the .zip)"
