#!/usr/bin/env bash
# Builds dist/investor-simulator-itch.zip for uploading to itch.io (Kind of project: HTML).
# index.html ends up at the top level of the zip, as itch.io requires.
set -euo pipefail
cd "$(dirname "$0")/.."
FILES=(index.html online.html style.css online.css game.js online.js i18n.js sounds.js companies.js minigames.js lang assets)
mkdir -p dist
OUT="dist/investor-simulator-itch.zip"
rm -f "$OUT"
if command -v zip >/dev/null 2>&1; then
  zip -qr -X "$OUT" "${FILES[@]}"
else
  python3 - "$OUT" "${FILES[@]}" <<'PY'
import os, sys, zipfile
out, items = sys.argv[1], sys.argv[2:]
with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
    for it in items:
        for root, _, files in (os.walk(it) if os.path.isdir(it) else [("", [], [it])]):
            for f in sorted(files):
                p = os.path.join(root, f)
                z.write(p, p)
PY
fi
echo "Created $OUT ($(du -h "$OUT" | cut -f1))"
