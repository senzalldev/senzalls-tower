# Senzall's Tower

**A native, offline single-player tower-building simulation for the Mac.**

Build a skyscraper floor by floor — offices, condos, hotels, shops, restaurants,
elevators, and more. Keep tenants happy, the elevators moving, and the books in
the black as you grow from a one-star building into a five-star tower. Watch for
VIP guests like **Senzall**.

Runs entirely on your Mac — no account, no server, no network. Signed with a
Developer ID and notarized by Apple, so it opens cleanly on modern Macs.

> **This is a fork.** The game itself — its simulation, rules, and art — is the
> work of **Patrick Hulin**, who created the open-source engine
> [tower-together](https://github.com/phulin/tower-together). Senzall's Tower
> packages that engine as an offline, single-player macOS app. See
> [Credits & Thanks](#credits--thanks).

---

## Install

**Homebrew (recommended):**

```bash
brew install --cask senzalldev/tap/senzalls-tower
```

**Or** download the latest `.dmg` from the
[Releases page](https://github.com/senzalldev/senzalls-tower/releases/latest),
open it, and drag **Senzall's Tower** to your Applications folder.

Requires macOS 14 (Sonoma) or later.

## How to play

1. Place a **Lobby** across the ground floor — it's the entrance everyone uses.
2. Add **Offices** on the floors above, and connect them with **Stairs** or an
   **Elevator**.
3. Unpause and watch tenants move in. Grow your population and income to earn
   more stars, which unlock condos, hotels, shops, entertainment, and more.

A full in-app guide is available any time from the **?** button, the **Guide**
button on the build panel, or **Help → Senzall's Tower Guide** (⌘?).

**Handy shortcuts:** New ⌘N · Save ⌘S · Load ⌘O · Pause ⌘P ·
Speed ⌘1 / ⌘2 / ⌘3 · Settings ⌘, · Guide ⌘?

## Features

- Faithful, tick-accurate tower simulation, running fully offline.
- Native macOS app: menus, Save/Load, full-screen, app icon, Developer-ID signed
  and notarized.
- **Settings** (⌘,) with interface scaling for readability, launch speed, and
  start-muted.
- **Sound** menu to toggle individual effect groups on/off.
- **Cheats** for sandbox play (grant cash, free build, max stars, summon a VIP).
- A named VIP roster and an in-app guide with a What's New changelog.

---

## Credits & Thanks

### The game & its author

The heart of this project — the entire simulation and its artwork — is
**[Patrick Hulin](https://github.com/phulin)**, creator of
**[tower-together](https://github.com/phulin/tower-together)** (MIT licensed).
This is his game; Senzall's Tower simply wraps it for the Mac. Thank you,
Patrick, for building it and sharing it openly.

- Engine: **tower-together** — https://github.com/phulin/tower-together
- Author: **Patrick Hulin** — https://github.com/phulin
- Contributors: https://github.com/phulin/tower-together/graphs/contributors

`tower-together` is a **clean-room reimplementation** and ships none of any
original game's assets or code.

### Inspired by a classic

The tower-building genre was defined by **SimTower** ("The Tower", 1994),
created by **Yoot Saito** and **OPeNBook**, published by **Maxis** — and its
sequel **Yoot Tower** (1998). Deep thanks to Yoot Saito for the games that
inspired all of this, and for supporting their open-sourcing.

### Preservation & open-sourcing

Enormous thanks to **[Don Hopkins](https://github.com/SimHacker)**, who — working
directly with Yoot Saito — is leading the effort to open-source and preserve the
original Yoot Tower / SimTower sources for archival and academic study. That
work, and the broader preservation community, is why projects like this can exist.

- Yoot Tower preservation: https://github.com/YootTowerManagement/YootTower
- Don Hopkins — https://github.com/SimHacker
- MicropolisCore (open-source SimCity): https://github.com/SimHacker/MicropolisCore
- With preservation support from the
  [Video Game History Foundation](https://gamehistory.org).

Senzall's Tower is **not affiliated with, endorsed by, or derived from** the code
or assets of those games — it packages the independent, clean-room
`tower-together` engine. "SimTower" and "Yoot Tower" are trademarks of their
respective owners.

### Built with

Thanks to the open-source projects this app is built on:

- [Phaser](https://github.com/phaserjs/phaser) — the 2D game renderer
- [React](https://github.com/facebook/react) — UI
- [Vite](https://github.com/vitejs/vite) — build tooling
- [TypeScript](https://github.com/microsoft/TypeScript)
- [lucide](https://github.com/lucide-icons/lucide) — icons (`lucide-react`)
- [XcodeGen](https://github.com/yonaskolb/XcodeGen) — the macOS project
- Apple's SwiftUI & WebKit — the native shell

### A note from the maker

SimTower and Yoot Tower are among my favorite games of all time. I built this
version for myself — to play my favorite game — and I wanted to share it with
anyone who'd like to play it too. The credit for the game belongs to its author,
**Patrick Hulin**; I just packaged it for the Mac, working with **Claude** using
modern AI tools.

## License

Senzall's Tower is released under the MIT License. The vendored `tower-together`
engine is MIT © 2026 Patrick Hulin — its license is preserved in
[`third_party/tower-together-LICENSE.md`](third_party/tower-together-LICENSE.md),
and attribution is in [`NOTICE`](NOTICE).

## Building from source

```bash
make app         # build a local (unsigned) app with the engine embedded
make dev         # run the engine in a browser dev server
make test        # run the engine + app unit tests
./release.sh      # signed + notarized DMG (needs the author's Developer ID)
```

See [`docs/superpowers/`](docs/superpowers) for the design spec and plan.
