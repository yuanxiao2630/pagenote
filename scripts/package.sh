#!/usr/bin/env bash
# Build the installable Chrome extension zip.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION="$(sed -n 's/.*"version": "[^"]*"/&/p' "$ROOT/manifest.json" | head -1 | sed -E 's/.*"version": "([^"]+)".*/\1/')"
OUT_DIR="$ROOT/dist"
OUT_FILE="$OUT_DIR/pagenote-v${VERSION}.zip"

if [ -z "$VERSION" ]; then
  echo "Could not read version from manifest.json" >&2
  exit 1
fi

mkdir -p "$OUT_DIR"
rm -f "$OUT_FILE"

cd "$ROOT"
zip -r -X "$OUT_FILE" . \
  -x '.git/*' \
  -x '.github/*' \
  -x '.gitignore' \
  -x 'dist/*' \
  -x 'test/*' \
  -x 'scripts/*' \
  -x '*.DS_Store' \
  -x '.DS_Store' \
  -x '*.zip'

echo
echo "Built: $OUT_FILE"
if command -v shasum >/dev/null 2>&1; then
  shasum -a 256 "$OUT_FILE"
elif command -v sha256sum >/dev/null 2>&1; then
  sha256sum "$OUT_FILE"
fi
