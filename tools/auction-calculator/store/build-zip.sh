#!/usr/bin/env bash
# Builds the Chrome Web Store upload ZIP (manifest.json at the top level).
# Usage: bash tools/auction-calculator/store/build-zip.sh
set -euo pipefail
cd "$(dirname "$0")/.."
version=$(python3 -c "import json;print(json.load(open('manifest.json'))['version'])")
out="../dist/auction-calculator-${version}.zip"
mkdir -p ../dist
rm -f "$out"
zip -X -r "$out" manifest.json background.js content.js icons >/dev/null
echo "Built tools/dist/auction-calculator-${version}.zip"
