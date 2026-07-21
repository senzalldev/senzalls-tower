# Senzall's Tower — Design Spec

- **Date:** 2026-07-21
- **Owner:** Steven Scott Sparks (Apple Developer team DF8R99VKQL)
- **Status:** Draft for review

## 1. Summary

Senzall's Tower is a **native macOS application** that packages a clean-room,
open-source recreation of the 1993 tower-building simulation (SimTower) as a
signed, notarized, offline, single-player game the user can add to a personal
collection and share with others via a DMG.

It is built as a **native SwiftUI/AppKit shell hosting a `WKWebView`** that runs
the vendored, MIT-licensed game engine from
[`phulin/tower-together`](https://github.com/phulin/tower-together) entirely
locally, with the multiplayer/server layer removed.

### Why this approach

- The engine's simulation (`worker/src/sim/`, ~23k lines of pure TypeScript with
  zero I/O) **already runs client-side** via `TowerLockstepSession`
  (`TowerSim.fromSnapshot`, `sim.step()`, `sim.saveState()`). The Cloudflare
  Worker is only an authoritative arbiter for multiplayer inputs and
  persistence, so single-player offline is a clean detach, not a rewrite.
- Reusing the tick-accurate sim (with its existing test suite) yields a
  genuinely working, faithful game now. A from-scratch Swift/Metal rewrite would
  discard that and take months, with high risk of an incomplete result.
- The result is still a real, native, signed `.app`: native window, menu bar,
  full-screen, dock icon, native save dialogs, no browser chrome, no network.

### Non-goals (YAGNI)

- No multiplayer / online co-op (explicitly out of scope; may be revisited
  later, but the architecture does not pre-build for it).
- No from-scratch native rendering engine.
- No App Store distribution (Developer ID + notarized DMG only).
- No bundling of any original SimTower/Yoot Tower copyrighted assets or code.

## 2. Legal & naming

- Base engine is **MIT licensed, © 2026 Patrick Hulin**, a clean-room
  reimplementation shipping **none** of the original game's assets or code. Its
  art is original redrawn SVG/PNG.
- "SimTower" and "Yoot Tower" are trademarks; the shippable app uses the
  original name **"Senzall's Tower"**.
- The upstream `LICENSE.md` and attribution are preserved verbatim in the new
  repo under `third_party/` (or `NOTICE`), and the app's About box credits the
  upstream project.
- The `YootTowerManagement/YootTower` repo (an archival drop of proprietary
  source with trademarked content) is **not used** — legally risky and not
  playable.

## 3. Repository layout

```
senzalls-tower/            (repo root: /Users/steve/dev/simtower/senzalls-tower)
├── app/                   Native macOS app (Swift)
│   ├── SenzallsTower/      SwiftUI/AppKit sources
│   │   ├── SenzallsTowerApp.swift   @main, app lifecycle
│   │   ├── GameWindow.swift          NSWindow + WKWebView host
│   │   ├── GameWebView.swift         WKWebView config, offline loader
│   │   ├── Bridge.swift              WKScriptMessageHandler ⇄ JS contract
│   │   ├── SaveStore.swift           JSON save/load in Application Support
│   │   ├── AppMenu.swift             Native menu bar wiring
│   │   └── Assets.xcassets           App icon, etc.
│   ├── SenzallsTower.entitlements    Hardened runtime, minimal entitlements
│   └── project.yml or .xcodeproj     Xcode project (XcodeGen or committed proj)
├── engine/                Vendored + patched tower-together (single-player)
│   ├── src/               Client (React + Phaser) + sim (pure TS)
│   ├── local/             Offline additions (LocalTowerSocket, bootstrap)
│   ├── dist/              Static build output (git-ignored; produced at build)
│   └── package.json       Trimmed to client + sim only (no worker/wrangler)
├── packaging/
│   ├── build-engine.sh    npm ci && vite build -> engine/dist
│   ├── make-app.sh        Assemble .app, copy engine/dist into Resources
│   ├── sign.sh            codesign (Developer ID) + entitlements
│   ├── notarize.sh        notarytool submit --wait + stapler staple
│   ├── make-dmg.sh        create-dmg / hdiutil -> Senzall's Tower.dmg
│   └── verify.sh          codesign --verify + spctl -a assessment
├── Makefile               `make dev`, `make app`, `make dmg`, `make verify`
├── third_party/tower-together-LICENSE.md   Upstream MIT license
├── NOTICE                 Attribution
├── LICENSE                Repo license (MIT)
└── README.md
```

## 4. Component design

### 4.1 Engine (offline detach)

The engine is vendored from tower-together and trimmed to the two workspaces the
game actually needs at runtime: the client (`apps/client`) and the sim
(`apps/worker/src/sim/`). The worker/Durable-Object/wrangler code is dropped.
The sim directory is relocated so client imports resolve without the worker
workspace (e.g. `engine/src/sim/`), updating the relative import paths.

**Offline transport.** The client depends on a small `TowerSocket` interface:
`connect`, `disconnect`, `reconnect`, `send(ClientMessage)`, `onMessage`,
`onStatus`, `getStatus`, `setActive`. We introduce a **`LocalTowerSocket`** with
the identical shape that:

- Reports status `connected` immediately on `connect`.
- On `send` of a player input batch, **echoes it back synchronously as an
  authoritative batch** (server tick == predicted tick), so the client's local
  `TowerLockstepSession` promotes its own prediction to authoritative with zero
  latency. Lockstep already handles the "authoritative batch confirms
  prediction" path; locally that path is always a no-op reconciliation.
- Handles `query_cell` / alias / settings messages locally (echo or ignore).
- Never opens a network connection.

**Bootstrap.** `App.tsx` currently calls `/api/resolve/:slug` then
`socket.connect(towerId)`. Offline replaces this with a **local session
bootstrap**: skip the guest/lobby screens, create (or load) a single local
tower by constructing a fresh `SimSnapshot` via `TowerSim.create(...)`, and wire
the `LocalTowerSocket`. A build-time flag (`VITE_LOCAL=1`) selects the offline
path so the upstream code stays diffable.

**Result:** the tick-accurate sim runs unchanged; only transport + bootstrap are
swapped.

### 4.2 Native shell

- **`SenzallsTowerApp`** — `@main` AppKit/SwiftUI app; single primary window.
- **`GameWebView`** — a `WKWebView` configured for offline: loads
  `file://…/Resources/engine/index.html` via `loadFileURL(_:allowingReadAccessTo:)`
  (or a `WKURLSchemeHandler` app-scheme if `file://` relative-path loading of the
  Vite bundle proves fragile). JavaScript enabled; no network needed; developer
  extras behind a debug flag only.
- **`Bridge`** — a `WKScriptMessageHandler` exposing a minimal, versioned
  contract. JS → native: `save(slot, stateJson)`, `load(slot)`, `listSaves()`,
  `autosave(stateJson)`, `ready()`. Native → JS: `evaluateJavaScript` calls for
  menu actions (`newTower`, `save`, `load`, `setSpeed`, `pause`, `toggleFullScreen`).
- **`SaveStore`** — reads/writes JSON under
  `~/Library/Application Support/Senzall's Tower/saves/`. Named slots + a
  rolling autosave. Atomic writes (temp file + rename).
- **`AppMenu`** — native menu bar: File (New Tower, Open…, Save, Save As…),
  Game (Pause, Speed 1×/3×/10×), View (Enter Full Screen), Help/About.

### 4.3 Data flow

- Every tick executes entirely inside the WebView (local sim). No native
  round-trip per tick.
- Native touches disk only on explicit Save/Load and periodic autosave, both
  driven through the `Bridge`.
- Window frame + last session persisted via `NSWindow` autosave + `UserDefaults`.

## 4.4 Personalization: "Senzall" the VIP

The engine already models VIPs — a binary-verified VIP visitor event
(`sim/events.ts: tickVipSpecialVisitor`) and VIP-designated hotel suites
(`vipFlag` on records, `world.gateFlags.vipSuiteFloor`). Per user request, the
tower's VIP is named **"Senzall."**

This is implemented **purely in the presentation layer** (client UI + local
notification/label mapping), **not** in the sim, so the tick-accurate
deterministic simulation and its tests remain untouched:

- When the sim emits a VIP-related notification (or a guest occupies the VIP
  suite / a record carries `vipFlag`), the client labels that guest **"Senzall"**
  in the toast (e.g. "Senzall (VIP) has arrived") and in the cell-inspection
  dialog.
- The name lives in a small client-side constant/label map (e.g.
  `engine/local/vip.ts` → `VIP_NAME = "Senzall"`), trivially changeable later.
- No change to RNG, ticks, snapshots, or command handling — determinism
  preserved.

## 5. Signing & notarization pipeline

`make dmg` runs, in order:

1. `build-engine.sh` — `npm ci` + `vite build` → `engine/dist/`.
2. `make-app.sh` — assemble `Senzall's Tower.app`, copy `engine/dist` into
   `Contents/Resources/engine/`, set Info.plist (bundle id
   `com.sparks.SenzallsTower`, version, category, min macOS).
3. `sign.sh` — `codesign --deep --options runtime --entitlements … --sign
   "Developer ID Application: Steven Scott Sparks (DF8R99VKQL)"` (sign nested
   frameworks/helpers first, then the app).
4. `notarize.sh` — zip the app, `xcrun notarytool submit --wait` using a
   Keychain profile (created once from an **app-specific password** or an App
   Store Connect API key), then `xcrun stapler staple` the app.
5. `make-dmg.sh` — build `Senzall's Tower.dmg` (background + Applications
   symlink), codesign the DMG, notarize + staple the DMG.
6. `verify.sh` — assert `codesign --verify --deep --strict`, `spctl -a -t exec`
   (app) and `spctl -a -t open --context context:primary-signature` (DMG) both
   pass ("accepted").

**Entitlements:** hardened runtime enabled; **no** network entitlement; JIT only
if WKWebView requires it (`com.apple.security.cs.allow-jit` — verify need). App
Sandbox optional (not required for Developer ID); if enabled, add
user-selected-file read/write for save export only.

**Credentials the user must provide once** (documented in README):
- An **app-specific password** for the Apple ID (appleid.apple.com → Sign-In &
  Security → App-Specific Passwords), OR an App Store Connect API key.
- Stored via `xcrun notarytool store-credentials "senzall-notary"` into the
  login Keychain. **Never committed.** Team ID `DF8R99VKQL`.

## 6. Testing & verification

- **Sim tests:** run the vendored TS simulation test suite after the offline
  detach to prove the sim is byte-for-byte unaffected (`npm test` in engine).
- **Offline smoke test:** headless boot of the built `.app` (or the Vite preview
  of `engine/dist` with `VITE_LOCAL=1`) that confirms the app loads, a tower is
  created, a facility can be placed, and the sim advances N ticks without a
  network call. Assert (e.g. via Playwright over the file bundle) that no
  outbound request is attempted.
- **Save/load test:** round-trip a `SimSnapshot` through `SaveStore` and confirm
  `TowerSim.fromSnapshot` restores identical state.
- **Signature/Gatekeeper test:** `verify.sh` must report "accepted" for both the
  app and the DMG on a clean machine simulation (`spctl`, `codesign`).
- **Definition of done:** double-clicking the notarized DMG on a modern Mac
  (macOS 26) with no dev tools installed opens the app with no Gatekeeper
  warning, and the game is playable offline.

## 7. Risks & mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| Vite bundle uses absolute `/` paths that break under `file://` | Medium | Set `base: "./"` in Vite config; if still fragile, serve via a `WKURLSchemeHandler` `app://` scheme (fully offline, in-process). |
| Client has more server round-trips than the input-batch path (e.g. cell queries, aliases) | Low | `LocalTowerSocket` handles/echoes all `ClientMessage` variants; enumerate `ClientMessage` union and cover each. |
| Lockstep expects periodic authoritative checkpoints from server | Low | Local socket emits self-checkpoints from the client's own snapshot on the same cadence; reconciliation is a no-op. |
| WKWebView needs JIT entitlement under hardened runtime | Medium | Add `com.apple.security.cs.allow-jit` only if verified necessary; re-run notarization. |
| Phaser/WebGL performance in WKWebView | Low | WKWebView supports WebGL/Metal-backed canvas; engine already has a `webglFallback`. |
| Upstream engine updates diverge from our fork | Low | Vendor a pinned commit; keep offline changes isolated in `engine/local/` and behind `VITE_LOCAL`. |

## 8. Implementation phasing (for the plan)

1. **Vendor & trim** engine to client + sim; get it building standalone.
2. **Offline detach:** `LocalTowerSocket` + local bootstrap behind `VITE_LOCAL`;
   playable in a browser via `vite preview` with no server.
3. **Native shell:** WKWebView host loading the offline bundle; window + menus.
4. **Bridge + SaveStore:** save/load/autosave; native menu actions.
5. **Packaging:** build/sign/notarize/dmg/verify scripts + Makefile.
6. **Icon & polish:** app icon, About box, DMG background, first-run.
7. **Verification:** all tests green; clean-machine Gatekeeper check.
