#!/usr/bin/env bash
# Build the offline engine bundle into engine/apps/client/dist.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/engine"
if [ ! -d node_modules ]; then
  npm ci
fi
npm --workspace apps/client run build:local
echo "engine dist -> $ROOT/engine/apps/client/dist"
