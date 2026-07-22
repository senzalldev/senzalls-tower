# Senzall's Tower

A native, **offline single-player** tower-building simulation game for macOS —
build a skyscraper of offices, condos, hotels, shops, restaurants, and
elevators, and keep your tenants happy without going bankrupt. Watch for VIP
guests like **Senzall**.

Signed with a Developer ID and notarized by Apple, so it opens cleanly on modern
Macs with no Gatekeeper warnings.

## Install

**Homebrew:**

```bash
brew install --cask senzalldev/tap/senzalls-tower
```

**Or** download the DMG from the [latest release](https://github.com/senzalldev/senzalls-tower/releases/latest)
(also linked from [senzall.com](https://senzall.com)), open it, and drag
**Senzall's Tower** to Applications.

Requires macOS 14 (Sonoma) or later. Fully offline — no account, no network.

## Play

- **Build** from the panel on the right: Lobby, Stairs, Elevator, Office, Condo,
  Fast Food, and more as your tower earns stars.
- **Menus:** New Tower (⌘N), Save (⌘S), Load (⌘O), Pause (⌘P), Speed Normal/Fast/Ultra
  (⌘1/⌘2/⌘3). The game autosaves every minute; saves live in
  `~/Library/Application Support/Senzall's Tower/`.

## Build from source

```bash
make app        # build a local (unsigned) SenzallsTower.app with the engine embedded
make dev        # run the engine in a browser dev server
make test       # engine + app unit tests
./release.sh     # signed + notarized DMG + senzalldev publish (needs the
                 # 'apple-notary' Keychain profile; DRY_RUN=1 to skip notarize)
```

- `app/` — native macOS shell (SwiftUI/AppKit + WKWebView, XcodeGen project).
- `engine/` — the game engine and simulation, run locally in-process.
- `packaging/`, `release.sh` — build, sign, notarize, DMG, and publish.

## Credits & license

The simulation engine is vendored from
[phulin/tower-together](https://github.com/phulin/tower-together), an MIT-licensed
clean-room reimplementation © 2026 Patrick Hulin — see `NOTICE` and
`third_party/tower-together-LICENSE.md`. No original SimTower / Yoot Tower assets
or code are included; "SimTower" and "Yoot Tower" are trademarks of their
respective owners. Senzall's Tower is an independent product.
