#!/usr/bin/env bash
# Quick structural check:
# - index.html must contain a hero section
# - every HTML page must contain a main landmark
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
MISSING=0
for f in "$ROOT_DIR"/*.html; do
  base="$(basename "$f")"
  file_missing=0

  if ! grep -q '<main id="main">' "$f"; then
    echo "MISSING MAIN: $base"
    MISSING=1
    file_missing=1
  fi

  if [ "$base" = "index.html" ] && ! grep -q '<section class="hero' "$f"; then
    echo "MISSING HERO ON INDEX: $base"
    MISSING=1
    file_missing=1
  fi

  if [ $file_missing -eq 0 ]; then
    echo "OK: $base"
  fi
done
if [ $MISSING -ne 0 ]; then
  echo "One or more structural checks failed." >&2
  exit 2
fi
echo "All structural checks passed."