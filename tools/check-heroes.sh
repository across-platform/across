#!/usr/bin/env bash
# Quick check that each page contains a hero section
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
MISSING=0
for f in "$ROOT_DIR"/*.html; do
  if ! grep -q '<section class="hero"' "$f"; then
    echo "MISSING HERO: $(basename "$f")"
    MISSING=1
  else
    echo "OK: $(basename "$f")"
  fi
done
if [ $MISSING -ne 0 ]; then
  echo "One or more pages are missing a hero section." >&2
  exit 2
fi
echo "All pages contain a hero section."