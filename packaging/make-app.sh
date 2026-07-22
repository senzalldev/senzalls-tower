#!/usr/bin/env bash
# Build SenzallsTower.app (Release, unsigned) and embed the engine bundle into
# Contents/Resources/engine. Prints APP=<path> on the last line.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DERIVED="$ROOT/build/DerivedData"

cd "$ROOT/app"
xcodegen generate >/dev/null

APP_VERSION="${APP_VERSION:-$(tr -d '[:space:]' < "$ROOT/VERSION" 2>/dev/null || echo 1.0.0)}"
BUILD_NUMBER="${BUILD_NUMBER:-$(printf '%s' "$APP_VERSION" | tr -d '.')}"
xcodebuild -project SenzallsTower.xcodeproj -scheme SenzallsTower \
  -configuration Release -derivedDataPath "$DERIVED" \
  MARKETING_VERSION="$APP_VERSION" CURRENT_PROJECT_VERSION="$BUILD_NUMBER" \
  CODE_SIGNING_ALLOWED=NO build >/dev/null

APP="$DERIVED/Build/Products/Release/SenzallsTower.app"
if [ ! -d "$APP" ]; then
  echo "error: app not built at $APP" >&2
  exit 1
fi

DIST="$ROOT/engine/apps/client/dist"
if [ ! -f "$DIST/index.html" ]; then
  echo "error: engine bundle missing at $DIST — run build-engine.sh first" >&2
  exit 1
fi

rm -rf "$APP/Contents/Resources/engine"
mkdir -p "$APP/Contents/Resources/engine"
cp -R "$DIST/." "$APP/Contents/Resources/engine/"

echo "APP=$APP"
