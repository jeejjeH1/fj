#!/usr/bin/env bash
# Builds both install files from ../x-auto-liker:
#   x-auto-liker.zip  -> "Load unpacked" (desktop) after extracting
#   x-auto-liker.crx  -> installed INSIDE the browser (mobile Chromium forks keep it; a zip is unpacked into a cache
#                        folder that Android can clear, which removes the extension)
# The same key.pem must be used every time, so the extension keeps the same ID and updates in place.
set -euo pipefail
cd "$(dirname "$0")/.."
rm -f x-auto-liker.zip x-auto-liker.crx
zip -qr x-auto-liker.zip x-auto-liker
npx --yes crx3 -p x-auto-liker-release/key.pem -o x-auto-liker.crx x-auto-liker >/dev/null
ls -la x-auto-liker.zip x-auto-liker.crx
