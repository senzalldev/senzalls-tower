#!/bin/bash
# release.sh — local one-shot release for Senzall's Tower.
# Build engine + app → sign → DMG → notarize → staple → (publish).
# Mirrors ~/dev/pounceterm/release.sh (same Developer ID + notary profile).
#
#   ./release.sh                 # version from VERSION file
#   ./release.sh 1.0.1           # override + rewrite VERSION
#   DRY_RUN=1 ./release.sh       # build + sign + DMG only (no notarize/publish)
#   SKIP_PUBLISH=1 ./release.sh  # everything except GitHub release + cask
set -euo pipefail
cd "$(dirname "$0")"

VERSION="${1:-$(tr -d '[:space:]' < VERSION)}"
printf '%s' "$VERSION" > VERSION
NOTARY_PROFILE="${NOTARY_PROFILE:-apple-notary}"
SIGN_ID="Developer ID Application: Steven Scott Sparks (DF8R99VKQL)"
ENTITLEMENTS="app/SenzallsTower/SenzallsTower.entitlements"
RELEASE_REPO="${RELEASE_REPO:-senzalldev/senzalls-tower}"
TAP_REPO="${TAP_REPO:-senzalldev/homebrew-tap}"
DMG_NAME="Senzalls-Tower-${VERSION}.dmg"
DMG_PATH="release/${DMG_NAME}"
TAG="v${VERSION}"

echo "▸ Senzall's Tower ${VERSION}"

# 1. build engine + app (unsigned). make-app.sh prints APP=<path>.
./packaging/build-engine.sh
APP="$(./packaging/make-app.sh | sed -n 's/^APP=//p' | tail -1)"
[ -d "$APP" ] || { echo "app build failed"; exit 1; }

# 2. codesign (hardened runtime + entitlements)
codesign --deep --force --options runtime --entitlements "$ENTITLEMENTS" \
    --sign "$SIGN_ID" --timestamp "$APP"
codesign --verify --deep --strict "$APP"
echo "✓ signed"

# 3. DMG (headless-safe hdiutil: app + /Applications symlink)
mkdir -p release
STAGE="$(mktemp -d)"; cp -R "$APP" "$STAGE/SenzallsTower.app"; ln -s /Applications "$STAGE/Applications"
rm -f "$DMG_PATH"
hdiutil create -volname "Senzall's Tower" -srcfolder "$STAGE" -ov -format UDZO "$DMG_PATH"
rm -rf "$STAGE"
codesign --sign "$SIGN_ID" --timestamp "$DMG_PATH"
echo "✓ DMG: $DMG_PATH"

[ "${DRY_RUN:-0}" = "1" ] && { echo "DRY_RUN — stop before notarize"; exit 0; }

# 4. notarize app + DMG, staple
ZIP="$(mktemp -d)/SenzallsTower.zip"; ditto -c -k --keepParent "$APP" "$ZIP"
xcrun notarytool submit "$ZIP" --keychain-profile "$NOTARY_PROFILE" --wait
xcrun stapler staple "$APP"
xcrun notarytool submit "$DMG_PATH" --keychain-profile "$NOTARY_PROFILE" --wait
xcrun stapler staple "$DMG_PATH"
spctl --assess --type open --context context:primary-signature -v "$DMG_PATH" || true
echo "✓ notarized + stapled: $DMG_PATH"

[ "${SKIP_PUBLISH:-0}" = "1" ] && { echo "SKIP_PUBLISH — DMG ready at $DMG_PATH"; exit 0; }

# 5. GitHub Release on senzalldev (gaming persona — NOT pounceapps)
if gh release view "$TAG" --repo "$RELEASE_REPO" >/dev/null 2>&1; then
  gh release upload "$TAG" "$DMG_PATH" --repo "$RELEASE_REPO" --clobber
else
  gh release create "$TAG" "$DMG_PATH" --repo "$RELEASE_REPO" \
      --title "Senzall's Tower v${VERSION}" \
      --notes "Senzall's Tower ${VERSION} — offline single-player tower sim. Download the DMG below, or: brew install --cask senzalldev/tap/senzalls-tower"
fi
ASSET_URL="https://github.com/${RELEASE_REPO}/releases/download/${TAG}/${DMG_NAME}"
echo "✓ published release ${TAG} to ${RELEASE_REPO}"

# 6. Homebrew cask in senzalldev/homebrew-tap
SHA256="$(shasum -a 256 "$DMG_PATH" | awk '{print $1}')"
TAP_DIR="$(mktemp -d)"
git clone --depth 1 "https://github.com/${TAP_REPO}.git" "$TAP_DIR"
mkdir -p "$TAP_DIR/Casks"
cat > "$TAP_DIR/Casks/senzalls-tower.rb" <<CASK
cask "senzalls-tower" do
  version "${VERSION}"
  sha256 "${SHA256}"
  url "${ASSET_URL}"
  name "Senzall's Tower"
  desc "Offline single-player tower-building simulation game"
  homepage "https://senzall.com"
  app "SenzallsTower.app"
end
CASK
git -C "$TAP_DIR" add Casks/senzalls-tower.rb
if git -C "$TAP_DIR" diff --cached --quiet; then
  echo "= tap already at ${VERSION}"
else
  git -C "$TAP_DIR" -c user.name="senzalldev" -c user.email="stevesparks@wustl.edu" \
      commit -m "senzalls-tower: update to ${VERSION}"
  git -C "$TAP_DIR" push
  echo "✓ ${TAP_REPO} cask updated"
fi
echo
echo "▸ Done. Install with:  brew install --cask senzalldev/tap/senzalls-tower"
