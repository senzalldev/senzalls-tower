# Senzall's Tower Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a native, signed, notarized macOS app ("Senzall's Tower") that runs the clean-room `tower-together` tower-sim engine fully offline as a single-player game, distributable as a shareable DMG.

**Architecture:** A SwiftUI/AppKit shell hosts a `WKWebView` that loads a static, offline build of the vendored `tower-together` engine. The engine's simulation already runs client-side; we replace its multiplayer `TowerSocket` with a `LocalTowerSocket` loopback and its `/api` bootstrap with a local tower factory. Native ⇄ JS bridge handles save/load and menu actions. Packaging scripts codesign (Developer ID), notarize (notarytool), and build the DMG.

**Tech Stack:** Swift 6 / SwiftUI / AppKit / WKWebView (Xcode 26.6), TypeScript / React / Phaser 4 / Vite (engine), Node 20+, bash packaging scripts, `codesign` / `notarytool` / `stapler` / `create-dmg`.

## Global Constraints

- Repo root: `/Users/steve/dev/simtower/senzalls-tower`.
- App display name: **Senzall's Tower**. Bundle ID: `com.sparks.SenzallsTower`. Repo/product slug: `senzalls-tower`.
- Signing identity: `Developer ID Application: Steven Scott Sparks (DF8R99VKQL)`. Team ID: `DF8R99VKQL`.
- Minimum macOS: 14.0 (Sonoma). Target/build machine: macOS 26, Xcode 26.6.
- Fully offline: **no** network entitlement, **no** outbound requests at runtime. Hardened runtime enabled.
- Do **not** bundle any original SimTower/Yoot Tower assets or code. Only the MIT clean-room engine (© 2026 Patrick Hulin) is vendored; preserve its `LICENSE.md` and attribution.
- Engine is vendored from a **pinned commit** of `phulin/tower-together`; offline-only additions live under `engine/local/` behind a `VITE_LOCAL` flag, keeping upstream diffable.
- "Senzall" is the VIP name — implemented in the presentation layer only; never alter sim determinism (RNG, ticks, snapshots, commands).
- Node 20+, npm 10+.

---

## Phase 1 — Vendor & trim the engine

### Task 1: Vendor tower-together at a pinned commit

**Files:**
- Create: `engine/` (vendored subtree), `third_party/tower-together-LICENSE.md`, `NOTICE`, `VENDOR.md`

**Interfaces:**
- Produces: `engine/` containing at minimum `apps/client/` and `apps/worker/src/sim/`, plus root `package.json`, `package-lock.json`, `biome.json`, `turbo.json`, `tsconfig*`.

- [ ] **Step 1: Clone pinned commit and record it**

```bash
cd /Users/steve/dev/simtower/senzalls-tower
TT_COMMIT=$(git ls-remote https://github.com/phulin/tower-together HEAD | cut -f1)
echo "$TT_COMMIT" > /tmp/tt_commit.txt
git clone https://github.com/phulin/tower-together /tmp/tt-src
git -C /tmp/tt-src checkout "$TT_COMMIT"
```

- [ ] **Step 2: Copy engine sources (no .git) into engine/**

```bash
mkdir -p engine
rsync -a --exclude '.git' --exclude 'node_modules' --exclude 'dist' /tmp/tt-src/ engine/
cp engine/LICENSE.md third_party/tower-together-LICENSE.md
```

- [ ] **Step 3: Write NOTICE + VENDOR.md attribution**

`NOTICE`:
```
Senzall's Tower bundles the game engine from tower-together
(https://github.com/phulin/tower-together), a clean-room MIT-licensed
reimplementation (c) 2026 Patrick Hulin. See third_party/tower-together-LICENSE.md.
No original SimTower/Yoot Tower assets or code are included.
```

`VENDOR.md`: record the pinned commit SHA (from `/tmp/tt_commit.txt`), the date, and the trim steps applied in Task 2, so the vendor can be re-synced later.

- [ ] **Step 4: Verify engine builds as-shipped (baseline)**

Run:
```bash
cd engine && npm ci && npm run typecheck
```
Expected: typecheck passes (baseline before trimming).

- [ ] **Step 5: Commit**

```bash
cd /Users/steve/dev/simtower/senzalls-tower
git add -A && git commit -m "vendor: import tower-together engine at pinned commit"
```

### Task 2: Trim engine to client + sim (drop worker/multiplayer build)

**Files:**
- Modify: `engine/package.json`, `engine/turbo.json`, `engine/apps/client/vite.config.ts`
- Delete from build path: `engine/apps/worker` runtime/deploy config (keep `apps/worker/src/sim/` — it is imported by the client)

**Interfaces:**
- Consumes: vendored `engine/` from Task 1.
- Produces: `npm --workspace apps/client run build` succeeds and emits a static bundle to `engine/apps/client/dist/`; the sim (`apps/worker/src/sim/`) remains importable via existing relative paths.

- [ ] **Step 1: Confirm the client's sim imports and dist path**

Run:
```bash
cd engine
grep -rn "worker/src/sim" apps/client/src | wc -l   # expect > 0
grep -n '"build"' apps/client/package.json
cat apps/client/vite.config.ts | grep -n "base\|outDir" || true
```
Expected: client imports `worker/src/sim/*` (types + `TowerSim` value); note current `build` script and Vite `base`.

- [ ] **Step 2: Set Vite base to relative for file:// loading**

In `engine/apps/client/vite.config.ts`, ensure the config sets `base: "./"` so built asset URLs are relative (required for WKWebView `file://` loading). Add it inside `defineConfig({ ... })`:
```ts
base: "./",
```

- [ ] **Step 3: Remove worker from the default build pipeline**

In `engine/turbo.json`, scope build/dev to the client (leave the `apps/worker/src/sim` sources in place since the client imports them directly). Remove `deploy` tasks that invoke `wrangler`. In root `engine/package.json`, change scripts so `build` builds only the client:
```json
"scripts": {
  "build": "npm --workspace apps/client run build",
  "dev": "npm --workspace apps/client run dev",
  "typecheck": "npm --workspace apps/client run typecheck",
  "test": "npm --workspace apps/worker run test"
}
```
(The `test` script still runs the sim's own test suite, which lives in the worker workspace.)

- [ ] **Step 4: Verify client builds standalone**

Run:
```bash
cd engine && npm run build && ls apps/client/dist/index.html
```
Expected: `apps/client/dist/index.html` exists; build completes with no wrangler/worker step.

- [ ] **Step 5: Verify sim tests still pass (baseline integrity)**

Run:
```bash
cd engine && npm test
```
Expected: the vendored simulation test suite passes unchanged.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "engine: trim build to client + sim, relative Vite base"
```

---

## Phase 2 — Offline detach (playable with no server)

### Task 3: LocalTowerSocket loopback transport

**Files:**
- Read first: `engine/apps/client/src/lib/socket.ts`, `engine/apps/client/src/types.ts` (the `ClientMessage` / `ServerMessage` / `ConnectionStatus` unions), `engine/apps/client/src/lib/lockstepSession.ts`, `engine/apps/client/src/screens/towerSessionController.ts`
- Create: `engine/apps/client/src/local/LocalTowerSocket.ts`, `engine/apps/client/src/local/LocalTowerSocket.test.ts`

**Interfaces:**
- Consumes: the structural interface the controller relies on, from `socket.ts`:
  `connect(towerId: string): void`, `disconnect(): void`, `reconnect(): void`,
  `send(msg: ClientMessage): void`, `onMessage(l: (m: ServerMessage) => void): () => void`,
  `onStatus(l: (s: ConnectionStatus) => void): () => void`, `getStatus(): ConnectionStatus`,
  `setActive(active: boolean): void`.
- Produces: `class LocalTowerSocket` implementing that same shape; on `send` of a player-input batch it re-emits the batch as an authoritative `ServerMessage` on the same tick so lockstep promotes the local prediction with zero latency.

- [ ] **Step 1: Enumerate the ClientMessage/ServerMessage variants to handle**

Run:
```bash
cd engine
grep -n "type ClientMessage\|type ServerMessage\|type ConnectionStatus" apps/client/src/types.ts
sed -n '/type ClientMessage/,/;/p' apps/client/src/types.ts
sed -n '/type ServerMessage/,/;/p' apps/client/src/types.ts
```
Expected: a discriminated union with a `type` field (e.g. `queue_inputs`, `set_speed`, `set_paused`, `query_cell`, `set_active`, …) for client, and authoritative-batch / status / cell-result variants for server. Record each variant name — every client variant must be handled in Step 3.

- [ ] **Step 2: Write the failing test**

`engine/apps/client/src/local/LocalTowerSocket.test.ts` (use the actual variant names found in Step 1; the example below assumes `queue_inputs` in / `input_batch` out — adjust to match):
```ts
import { describe, expect, it, vi } from "vitest";
import { LocalTowerSocket } from "./LocalTowerSocket";

describe("LocalTowerSocket", () => {
  it("reports connected synchronously on connect", () => {
    const s = new LocalTowerSocket();
    const statuses: string[] = [];
    s.onStatus((st) => statuses.push(st));
    s.connect("local");
    expect(s.getStatus()).toBe("connected");
    expect(statuses).toContain("connected");
  });

  it("echoes queued inputs back as an authoritative batch on the same tick", () => {
    const s = new LocalTowerSocket();
    const seen: unknown[] = [];
    s.onMessage((m) => seen.push(m));
    s.connect("local");
    s.send({ type: "queue_inputs", clientSeq: 1, predictedTick: 42, inputs: [] } as never);
    // Expect one authoritative batch acknowledging seq 1 at tick 42.
    expect(seen.length).toBe(1);
  });

  it("never touches the network", () => {
    const spy = vi.spyOn(globalThis, "fetch");
    const s = new LocalTowerSocket();
    s.connect("local");
    s.send({ type: "set_paused", paused: true } as never);
    expect(spy).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd engine && npx vitest run apps/client/src/local/LocalTowerSocket.test.ts`
Expected: FAIL — "Cannot find module './LocalTowerSocket'".

- [ ] **Step 4: Implement LocalTowerSocket**

Create `engine/apps/client/src/local/LocalTowerSocket.ts`. Mirror the exact public shape of `TowerSocket` (from Step-1 reading) and the exact message variant names. Skeleton (fill variant names/fields from Step 1):
```ts
import type { ClientMessage, ConnectionStatus, ServerMessage } from "../types";

type MessageListener = (msg: ServerMessage) => void;
type StatusListener = (status: ConnectionStatus) => void;

export class LocalTowerSocket {
  private status: ConnectionStatus = "disconnected";
  private messageListeners = new Set<MessageListener>();
  private statusListeners = new Set<StatusListener>();

  connect(_towerId: string): void { this.setStatus("connected"); }
  disconnect(): void { this.setStatus("disconnected"); }
  reconnect(): void { this.setStatus("connected"); }
  getStatus(): ConnectionStatus { return this.status; }
  setActive(_active: boolean): void { /* single-player: always active, no-op */ }

  onMessage(l: MessageListener): () => void {
    this.messageListeners.add(l);
    return () => this.messageListeners.delete(l);
  }
  onStatus(l: StatusListener): () => void {
    this.statusListeners.add(l);
    return () => this.statusListeners.delete(l);
  }

  send(msg: ClientMessage): void {
    // Promote the client's own predicted input batch to authoritative,
    // same tick => lockstep reconciliation is a no-op. Adjust field/variant
    // names to the union discovered in Step 1.
    if (msg.type === "queue_inputs") {
      this.emit({
        type: "input_batch",
        serverTick: msg.predictedTick,
        clientSeq: msg.clientSeq,
        inputs: msg.inputs,
        authoritative: true,
      } as unknown as ServerMessage);
    }
    // set_speed / set_paused / set_active / query_cell: handled locally by the
    // client's own lockstep + UI; nothing to round-trip. If any variant expects
    // a server ACK, emit the minimal matching ServerMessage here.
  }

  private emit(msg: ServerMessage): void {
    for (const l of this.messageListeners) l(msg);
  }
  private setStatus(status: ConnectionStatus): void {
    this.status = status;
    for (const l of this.statusListeners) l(status);
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd engine && npx vitest run apps/client/src/local/LocalTowerSocket.test.ts`
Expected: PASS (all 3).

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "engine: add LocalTowerSocket offline loopback transport"
```

### Task 4: Local tower bootstrap behind VITE_LOCAL flag

**Files:**
- Read first: `engine/apps/client/src/App.tsx` (guest/lobby/enterTower flow, `resolveSlug`, `socket.connect`), `engine/apps/worker/src/sim/index.ts` (`TowerSim.create` signature)
- Create: `engine/apps/client/src/local/localBootstrap.ts`
- Modify: `engine/apps/client/src/App.tsx`, `engine/apps/client/src/main.tsx`

**Interfaces:**
- Consumes: `TowerSim.create(...)` / `TowerSim.fromSnapshot(...)` (from `sim/index.ts`), `LocalTowerSocket` (Task 3).
- Produces: when `import.meta.env.VITE_LOCAL === "1"`, the app skips guest+lobby, instantiates a `LocalTowerSocket`, creates a fresh local tower, and enters the game screen directly. `createLocalTowerSnapshot(): SimSnapshot`.

- [ ] **Step 1: Read TowerSim.create signature and initial snapshot needs**

Run:
```bash
cd engine
sed -n '81,140p' apps/worker/src/sim/index.ts
grep -rn "TowerSim.create\|fromSnapshot" apps/worker/src apps/client/src | head
```
Expected: exact params for `TowerSim.create` (seed/time/world/ledger defaults). Note how the worker constructs the very first snapshot for a new tower; replicate that locally.

- [ ] **Step 2: Implement createLocalTowerSnapshot + local session wiring**

Create `engine/apps/client/src/local/localBootstrap.ts`:
```ts
import { TowerSim } from "../../../worker/src/sim/index";
import type { SimSnapshot } from "../../../worker/src/sim/index";

// Build the initial snapshot for a brand-new single-player tower, matching
// how the worker seeds a fresh TowerRoom (see Step 1 findings).
export function createLocalTowerSnapshot(): SimSnapshot {
  return TowerSim.create(/* seed + defaults per Step 1 */).saveState();
}

export const LOCAL_TOWER_ID = "senzalls-tower";
export const IS_LOCAL = import.meta.env.VITE_LOCAL === "1";
```

- [ ] **Step 3: Branch App.tsx onto the local path**

In `App.tsx`: when `IS_LOCAL`, construct `new LocalTowerSocket()` instead of `new TowerSocket()`, skip the guest/lobby screens, and call `enterTower(LOCAL_TOWER_ID)` on mount. Replace the `/api/resolve` call and any `/api/towers` create with the local snapshot when `IS_LOCAL`. Keep the online path intact under the `else` branch so upstream stays diffable.

- [ ] **Step 4: Add local build/preview scripts**

In `engine/apps/client/package.json` add:
```json
"build:local": "VITE_LOCAL=1 vite build",
"preview:local": "VITE_LOCAL=1 vite preview --port 4321"
```

- [ ] **Step 5: Verify offline play in a browser**

Run:
```bash
cd engine && npm --workspace apps/client run build:local && npm --workspace apps/client run preview:local
```
Then load `http://localhost:4321`. Expected: the game screen opens directly (no lobby), a facility can be placed, the sim advances, cash/population update — with **no** network requests to any `/api` or `wss` endpoint (verify in devtools Network tab; only same-origin static assets load).

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "engine: local single-player bootstrap behind VITE_LOCAL"
```

### Task 5: Named VIP roster (presentation layer only)

**Files:**
- Read first: `engine/apps/worker/src/sim/events.ts` (VIP visitor), the client toast + cell-inspection code (`engine/apps/client/src/screens/GameToasts.tsx`, `CellInspectionDialog.tsx`), and where `vipFlag` / VIP notifications surface in the client.
- Create: `engine/apps/client/src/local/vips.ts`, `engine/apps/client/src/local/vips.test.ts`
- Modify: the client component(s) that render VIP notifications / VIP-suite occupancy labels

**Interfaces:**
- Consumes: existing VIP notification/`vipFlag` signals from the sim (no sim change).
- Produces: `VIP_ROSTER: Vip[]` and `vipForVisit(visitIndex: number): Vip` (deterministic, cycles the roster, Senzall at index 0). `interface Vip { name: string; characteristic: string }`.

- [ ] **Step 1: Locate where VIP is surfaced to the user**

Run:
```bash
cd engine
grep -rn "vip\|VIP" apps/client/src
grep -rn "pendingNotifications\|notification\|toast" apps/client/src | grep -i vip
```
Expected: the client render path for VIP-suite cells and/or a VIP notification message. If VIP is not yet surfaced in the client UI at all, the minimal change is to add a toast when a `vipFlag` cell becomes occupied. Also identify the display-only counter to key VIP identity off (e.g. count of VIP arrivals seen by the client so far) — it must be UI-side, never fed back into the sim.

- [ ] **Step 2: Write the failing test for deterministic roster selection**

`engine/apps/client/src/local/vips.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { VIP_ROSTER, vipForVisit } from "./vips";

describe("VIP roster", () => {
  it("has 12 named VIPs, Senzall first", () => {
    expect(VIP_ROSTER).toHaveLength(12);
    expect(VIP_ROSTER[0].name).toBe("Senzall");
  });
  it("selects deterministically and cycles", () => {
    expect(vipForVisit(0).name).toBe("Senzall");
    expect(vipForVisit(12).name).toBe("Senzall"); // wraps
    expect(vipForVisit(1).name).toBe("JetBlast");
  });
  it("every VIP has a non-empty characteristic", () => {
    for (const v of VIP_ROSTER) expect(v.characteristic.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd engine && npx vitest run apps/client/src/local/vips.test.ts`
Expected: FAIL — "Cannot find module './vips'".

- [ ] **Step 4: Implement the roster**

Create `engine/apps/client/src/local/vips.ts`:
```ts
export interface Vip { name: string; characteristic: string }

export const VIP_ROSTER: Vip[] = [
  { name: "Senzall",  characteristic: "the founder — always the first VIP to bless a new tower" },
  { name: "JetBlast", characteristic: "arrives fast; demands express elevators" },
  { name: "Dawn",     characteristic: "early riser — visits at daybreak" },
  { name: "Anabella", characteristic: "refined — rates hotel suites hardest" },
  { name: "Kathy",    characteristic: "foodie — heads straight for restaurants" },
  { name: "Andy",     characteristic: "deal-maker — loves busy office floors" },
  { name: "Nick",     characteristic: "night owl — turns up after dark" },
  { name: "Eric",     characteristic: "efficiency hawk — hates long elevator waits" },
  { name: "Josh",     characteristic: "crowd-pleaser — happiest in a packed lobby" },
  { name: "Stevie",   characteristic: "retail therapist — makes a beeline for shops" },
  { name: "Brian",    characteristic: "big spender — favors condos" },
  { name: "Dan",      characteristic: "closer — signs off on 5-star status" },
];

// Deterministic, display-only: pick VIP by how many VIP visits have occurred.
export function vipForVisit(visitIndex: number): Vip {
  const i = ((visitIndex % VIP_ROSTER.length) + VIP_ROSTER.length) % VIP_ROSTER.length;
  return VIP_ROSTER[i];
}

export function vipLabel(v: Vip): string { return `${v.name} (VIP)`; }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd engine && npx vitest run apps/client/src/local/vips.test.ts`
Expected: PASS (all 3).

- [ ] **Step 6: Use the roster in the VIP UI**

In the component found in Step 1, maintain a UI-side VIP-visit counter and, on each VIP arrival, resolve `const vip = vipForVisit(counter++)`. Render `` `${vipLabel(vip)} has arrived — ${vip.characteristic}` `` in the toast, and show `vip.name` + `vip.characteristic` in `CellInspectionDialog` for the VIP-suite occupant. Do **not** touch `apps/worker/src/sim/`.

- [ ] **Step 7: Verify no determinism impact**

Run: `cd engine && npm run typecheck && npm test`
Expected: typecheck passes; sim test suite unchanged/green. Manually confirm in the local preview that the first VIP reads "Senzall (VIP) … the founder" and subsequent VIPs cycle the roster.

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "engine: named VIP roster (Senzall + 11), presentation only"
```

---

## Phase 3 — Native macOS shell

### Task 6: Xcode app skeleton hosting a WKWebView

**Files:**
- Create: `app/project.yml` (XcodeGen spec), `app/SenzallsTower/SenzallsTowerApp.swift`, `app/SenzallsTower/GameWebView.swift`, `app/SenzallsTower/Info.plist`, `app/SenzallsTower/SenzallsTower.entitlements`

**Interfaces:**
- Produces: an `.app` target `SenzallsTower` (bundle id `com.sparks.SenzallsTower`) that loads `Contents/Resources/engine/index.html` in a full-window `WKWebView`.

- [ ] **Step 1: Ensure XcodeGen is available**

Run: `brew list xcodegen >/dev/null 2>&1 || brew install xcodegen`
Expected: `xcodegen` on PATH. (Alternative: commit a hand-made `.xcodeproj`; XcodeGen keeps the project diffable.)

- [ ] **Step 2: Write project.yml**

`app/project.yml`:
```yaml
name: SenzallsTower
options:
  bundleIdPrefix: com.sparks
  deploymentTarget:
    macOS: "14.0"
settings:
  base:
    PRODUCT_BUNDLE_IDENTIFIER: com.sparks.SenzallsTower
    MARKETING_VERSION: "1.0.0"
    CURRENT_PROJECT_VERSION: "1"
    DEVELOPMENT_TEAM: DF8R99VKQL
    CODE_SIGN_STYLE: Manual
    CODE_SIGN_IDENTITY: "Developer ID Application"
    ENABLE_HARDENED_RUNTIME: YES
    SWIFT_VERSION: "6.0"
targets:
  SenzallsTower:
    type: application
    platform: macOS
    sources: [SenzallsTower]
    info:
      path: SenzallsTower/Info.plist
      properties:
        CFBundleDisplayName: "Senzall's Tower"
        LSApplicationCategoryType: public.app-category.simulation-games
        NSHumanReadableCopyright: "Includes tower-together (MIT, (c) 2026 Patrick Hulin)"
    entitlements:
      path: SenzallsTower/SenzallsTower.entitlements
    settings:
      base:
        CODE_SIGN_ENTITLEMENTS: SenzallsTower/SenzallsTower.entitlements
```

- [ ] **Step 3: Write entitlements (offline, hardened)**

`app/SenzallsTower/SenzallsTower.entitlements`:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <!-- No network entitlement: fully offline. -->
  <!-- WKWebView JSC under hardened runtime may require JIT; add only if verified. -->
  <key>com.apple.security.cs.allow-jit</key>
  <true/>
</dict>
</plist>
```

- [ ] **Step 4: Write the app + web view**

`app/SenzallsTower/SenzallsTowerApp.swift`:
```swift
import SwiftUI

@main
struct SenzallsTowerApp: App {
    var body: some Scene {
        WindowGroup("Senzall's Tower") {
            GameWebView()
                .frame(minWidth: 1024, minHeight: 700)
                .ignoresSafeArea()
        }
        .windowStyle(.hiddenTitleBar)
    }
}
```

`app/SenzallsTower/GameWebView.swift`:
```swift
import SwiftUI
import WebKit

struct GameWebView: NSViewRepresentable {
    func makeNSView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.defaultWebpagePreferences.allowsContentJavaScript = true
        let webView = WKWebView(frame: .zero, configuration: config)
        webView.setValue(false, forKey: "drawsBackground") // avoid white flash
        if let root = Bundle.main.resourceURL?.appending(path: "engine"),
           case let index = root.appending(path: "index.html"),
           FileManager.default.fileExists(atPath: index.path) {
            webView.loadFileURL(index, allowingReadAccessTo: root)
        }
        return webView
    }
    func updateNSView(_ nsView: WKWebView, context: Context) {}
}
```

- [ ] **Step 5: Generate the project and build (engine bundle not required yet)**

Run:
```bash
cd app && xcodegen generate && xcodebuild -project SenzallsTower.xcodeproj -scheme SenzallsTower -configuration Debug build CODE_SIGNING_ALLOWED=NO 2>&1 | tail -5
```
Expected: `** BUILD SUCCEEDED **` (WebView will show blank until the engine bundle is copied in Phase 4/5; that is expected here).

- [ ] **Step 6: Commit**

```bash
cd /Users/steve/dev/simtower/senzalls-tower
git add -A && git commit -m "app: Xcode skeleton with WKWebView host (XcodeGen)"
```

### Task 7: Native ⇄ JS bridge and SaveStore

**Files:**
- Create: `app/SenzallsTower/Bridge.swift`, `app/SenzallsTower/SaveStore.swift`, `engine/apps/client/src/local/nativeBridge.ts`
- Modify: `app/SenzallsTower/GameWebView.swift` (register handler), `engine/apps/client/src/local/localBootstrap.ts` (call the bridge for save/load)

**Interfaces:**
- Produces (Swift): `WKScriptMessageHandler` on message name `senzall` handling `{action: "save"|"load"|"list"|"autosave"|"ready", slot?, state?}`; replies via `webView.evaluateJavaScript("window.senzall._resolve(id, payload)")`.
- Produces (TS): `window.senzall = { save(slot,state), load(slot), list(), autosave(state), onReady(cb) }` returning Promises.
- Consumes: `SaveStore` reads/writes `~/Library/Application Support/Senzall's Tower/saves/<slot>.json` atomically.

- [ ] **Step 1: Write SaveStore with a round-trip test**

`app/SenzallsTower/SaveStore.swift`:
```swift
import Foundation

struct SaveStore {
    static let dir: URL = {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        let d = base.appending(path: "Senzall's Tower/saves")
        try? FileManager.default.createDirectory(at: d, withIntermediateDirectories: true)
        return d
    }()
    static func url(_ slot: String) -> URL { dir.appending(path: "\(slot).json") }
    static func save(slot: String, state: String) throws {
        let tmp = url(slot).appendingPathExtension("tmp")
        try state.data(using: .utf8)!.write(to: tmp)
        _ = try FileManager.default.replaceItemAt(url(slot), withItemAt: tmp)
    }
    static func load(slot: String) -> String? { try? String(contentsOf: url(slot), encoding: .utf8) }
    static func list() -> [String] {
        (try? FileManager.default.contentsOfDirectory(atPath: dir.path))?
            .filter { $0.hasSuffix(".json") }.map { String($0.dropLast(5)) } ?? []
    }
}
```
Add a unit test target step: create `app/SenzallsTowerTests/SaveStoreTests.swift` asserting `save`→`load` round-trips an arbitrary JSON string.

- [ ] **Step 2: Run the SaveStore test to verify it fails then passes**

Run: `cd app && xcodegen generate && xcodebuild test -scheme SenzallsTower -destination 'platform=macOS' 2>&1 | tail -8`
Expected: after adding the test target to `project.yml`, the round-trip test PASSES.

- [ ] **Step 3: Implement Bridge.swift**

`app/SenzallsTower/Bridge.swift`:
```swift
import WebKit

final class Bridge: NSObject, WKScriptMessageHandler {
    weak var webView: WKWebView?
    func userContentController(_ c: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any],
              let action = body["action"] as? String,
              let id = body["id"] as? Int else { return }
        let slot = body["slot"] as? String ?? "autosave"
        switch action {
        case "save", "autosave":
            if let state = body["state"] as? String { try? SaveStore.save(slot: slot, state: state) }
            resolve(id, "null")
        case "load":
            let json = SaveStore.load(slot: slot).map { "\"\(($0 as NSString).replacingOccurrences(of: "\"", with: "\\\""))\"" } ?? "null"
            resolve(id, json)
        case "list":
            let arr = (try? JSONSerialization.data(withJSONObject: SaveStore.list())).flatMap { String(data: $0, encoding: .utf8) } ?? "[]"
            resolve(id, arr)
        default: resolve(id, "null")
        }
    }
    private func resolve(_ id: Int, _ jsonPayload: String) {
        webView?.evaluateJavaScript("window.senzall && window.senzall._resolve(\(id), \(jsonPayload))")
    }
}
```
Register it in `GameWebView.makeNSView`: `config.userContentController.add(bridge, name: "senzall")` and set `bridge.webView = webView`.

- [ ] **Step 4: Implement the TS side of the bridge**

`engine/apps/client/src/local/nativeBridge.ts`:
```ts
type Pending = (value: unknown) => void;
const pending = new Map<number, Pending>();
let seq = 0;
interface WK { messageHandlers: { senzall: { postMessage(m: unknown): void } } }
function post(action: string, extra: Record<string, unknown> = {}): Promise<unknown> {
  const wk = (window as unknown as { webkit?: WK }).webkit;
  if (!wk) return Promise.resolve(null); // browser dev: no native bridge
  const id = ++seq;
  return new Promise((resolve) => {
    pending.set(id, resolve);
    wk.messageHandlers.senzall.postMessage({ id, action, ...extra });
  });
}
export const senzall = {
  save: (slot: string, state: string) => post("save", { slot, state }),
  autosave: (state: string) => post("autosave", { slot: "autosave", state }),
  load: (slot: string) => post("load", { slot }) as Promise<string | null>,
  list: () => post("list") as Promise<string[]>,
  _resolve: (id: number, payload: unknown) => { pending.get(id)?.(payload); pending.delete(id); },
};
(window as unknown as { senzall: typeof senzall }).senzall = senzall;
```
Import this module in `main.tsx` so `window.senzall` exists early. In `localBootstrap.ts`, on new-tower vs load, call `senzall.load("autosave")` and use the returned snapshot when present.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "app: native<->JS bridge + atomic SaveStore"
```

### Task 8: Native menu bar (New/Save/Load/Pause/Speed/Full Screen)

**Files:**
- Create: `app/SenzallsTower/AppMenu.swift`
- Modify: `app/SenzallsTower/SenzallsTowerApp.swift` (`.commands { }`), `engine/apps/client/src/local/nativeBridge.ts` (expose menu-action callbacks JS registers)

**Interfaces:**
- Produces: menu items sending actions into JS via `webView.evaluateJavaScript("window.senzall._menu('<action>')")` for `newTower`, `save`, `load`, `pause`, `speed1`, `speed3`, `speed10`. The engine registers a handler `senzall._menu` that maps to `towerSessionController` methods (`setPaused`, `setSpeed`, save/load through the bridge).

- [ ] **Step 1: Add `_menu` dispatch on the TS side**

In `nativeBridge.ts`, add `let menuHandler: (a: string) => void = () => {};` plus `export function onMenu(cb: (a: string) => void) { menuHandler = cb; }` and `senzall._menu = (a: string) => menuHandler(a);`. In the game screen controller wiring, call `onMenu` to route `pause`/`speed*`/`save`/`load`/`newTower` to the existing controller methods (`setPaused`, `setSpeed(1|3|10)`) and bridge save/load.

- [ ] **Step 2: Add SwiftUI commands**

In `SenzallsTowerApp.swift`, add `.commands { CommandGroup(replacing: .newItem) { Button("New Tower") { NotificationCenter.default.post(name: .menuAction, object: "newTower") } .keyboardShortcut("n") } ... }` for each action (Save ⌘S, Open ⌘O, Pause ⌘P, Speed 1/3/10, plus the standard Enter Full Screen). `GameWebView` observes `.menuAction` and calls `webView.evaluateJavaScript("window.senzall._menu('\(action)')")`.

- [ ] **Step 3: Build and manually verify**

Run: `cd app && xcodegen generate && xcodebuild -scheme SenzallsTower -configuration Debug build CODE_SIGNING_ALLOWED=NO 2>&1 | tail -3`
Expected: BUILD SUCCEEDED; menu items appear (functional verification happens in Phase 4 once the engine bundle is embedded).

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "app: native menu bar wired to engine actions"
```

---

## Phase 4 — Assemble & run end-to-end (unsigned)

### Task 9: Embed the engine bundle and run the real app

**Files:**
- Create: `packaging/build-engine.sh`, `packaging/make-app.sh`, `Makefile`
- Modify: `app/project.yml` if a copy build phase is preferred over script embedding

**Interfaces:**
- Produces: a runnable `SenzallsTower.app` with `Contents/Resources/engine/` populated from `engine/apps/client/dist/` (local build).

- [ ] **Step 1: build-engine.sh**

`packaging/build-engine.sh`:
```bash
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../engine"
npm ci
npm --workspace apps/client run build:local
echo "engine dist -> engine/apps/client/dist"
```

- [ ] **Step 2: make-app.sh (build app, inject engine into Resources)**

`packaging/make-app.sh`:
```bash
#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/app" && xcodegen generate
DERIVED="$ROOT/build/DerivedData"
xcodebuild -project SenzallsTower.xcodeproj -scheme SenzallsTower \
  -configuration Release -derivedDataPath "$DERIVED" \
  CODE_SIGNING_ALLOWED=NO build
APP="$DERIVED/Build/Products/Release/SenzallsTower.app"
rm -rf "$APP/Contents/Resources/engine"
mkdir -p "$APP/Contents/Resources/engine"
cp -R "$ROOT/engine/apps/client/dist/." "$APP/Contents/Resources/engine/"
echo "APP=$APP"
```

- [ ] **Step 3: Makefile targets**

`Makefile`:
```make
.PHONY: engine app dev clean
engine: ; ./packaging/build-engine.sh
app: engine ; ./packaging/make-app.sh
dev: ; cd engine && npm --workspace apps/client run dev
clean: ; rm -rf build engine/apps/client/dist
```

- [ ] **Step 4: Build and launch end-to-end**

Run:
```bash
chmod +x packaging/*.sh
make app
open "$(make -s app 2>/dev/null | sed -n 's/^APP=//p' | tail -1)" || open build/DerivedData/Build/Products/Release/SenzallsTower.app
```
Expected: the app launches, the tower loads offline in the native window, you can place a facility, sim runs, Senzall appears as VIP when triggered, and ⌘S writes a save under `~/Library/Application Support/Senzall's Tower/saves/`.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "packaging: build engine + assemble runnable app (unsigned)"
```

---

## Phase 5 — Sign, notarize, DMG

### Task 10: Codesign, notarize, staple, and package the DMG

**Files:**
- Create: `packaging/sign.sh`, `packaging/notarize.sh`, `packaging/make-dmg.sh`, `packaging/verify.sh`, `README.md`
- Modify: `Makefile` (add `dmg`, `verify`)

**Interfaces:**
- Consumes: `SenzallsTower.app` from Task 9; a Keychain notary profile `senzall-notary`.
- Produces: a notarized, stapled `Senzall's Tower.dmg` that passes Gatekeeper on a clean Mac.

- [ ] **Step 1: Document the one-time credential setup in README**

`README.md` must instruct the user to create an app-specific password (appleid.apple.com → Sign-In & Security → App-Specific Passwords) and store it once:
```bash
xcrun notarytool store-credentials "senzall-notary" \
  --apple-id "stevesparks@wustl.edu" --team-id "DF8R99VKQL"
# paste the app-specific password when prompted
```
State clearly: the password is stored in the login Keychain and is **never** committed.

- [ ] **Step 2: sign.sh**

`packaging/sign.sh`:
```bash
#!/usr/bin/env bash
set -euo pipefail
APP="$1"; ID="Developer ID Application: Steven Scott Sparks (DF8R99VKQL)"
ENT="$(cd "$(dirname "$0")/.." && pwd)/app/SenzallsTower/SenzallsTower.entitlements"
# Sign nested code first, then the app bundle.
find "$APP/Contents/Frameworks" -type f \( -name "*.dylib" -o -name "*.framework" \) 2>/dev/null -print0 | \
  xargs -0 -I{} codesign --force --options runtime --timestamp --sign "$ID" {} || true
codesign --force --deep --options runtime --timestamp \
  --entitlements "$ENT" --sign "$ID" "$APP"
codesign --verify --deep --strict --verbose=2 "$APP"
```

- [ ] **Step 3: notarize.sh**

`packaging/notarize.sh`:
```bash
#!/usr/bin/env bash
set -euo pipefail
APP="$1"; ZIP="${APP%.app}.zip"
ditto -c -k --keepParent "$APP" "$ZIP"
xcrun notarytool submit "$ZIP" --keychain-profile "senzall-notary" --wait
xcrun stapler staple "$APP"
rm -f "$ZIP"
```

- [ ] **Step 4: make-dmg.sh**

`packaging/make-dmg.sh` (uses `create-dmg` if present, else `hdiutil`):
```bash
#!/usr/bin/env bash
set -euo pipefail
APP="$1"; OUT="$(cd "$(dirname "$0")/.." && pwd)/build/Senzall's Tower.dmg"
ID="Developer ID Application: Steven Scott Sparks (DF8R99VKQL)"
rm -f "$OUT"
if command -v create-dmg >/dev/null; then
  create-dmg --volname "Senzall's Tower" --app-drop-link 450 160 \
    --icon "SenzallsTower.app" 150 160 "$OUT" "$APP"
else
  STAGE="$(mktemp -d)"; cp -R "$APP" "$STAGE/"; ln -s /Applications "$STAGE/Applications"
  hdiutil create -volname "Senzall's Tower" -srcfolder "$STAGE" -ov -format UDZO "$OUT"
fi
codesign --force --sign "$ID" "$OUT"
xcrun notarytool submit "$OUT" --keychain-profile "senzall-notary" --wait
xcrun stapler staple "$OUT"
echo "DMG=$OUT"
```

- [ ] **Step 5: verify.sh + Makefile targets**

`packaging/verify.sh`:
```bash
#!/usr/bin/env bash
set -euo pipefail
APP="$1"; DMG="$2"
codesign --verify --deep --strict --verbose=2 "$APP"
spctl -a -t exec -vv "$APP"
spctl -a -t open --context context:primary-signature -vv "$DMG"
echo "Gatekeeper: accepted"
```
Add to `Makefile`:
```make
.PHONY: dmg verify
dmg: app
	APP=$$(./packaging/make-app.sh | sed -n 's/^APP=//p' | tail -1); \
	./packaging/sign.sh "$$APP"; ./packaging/notarize.sh "$$APP"; \
	./packaging/make-dmg.sh "$$APP"
verify:
	APP=build/DerivedData/Build/Products/Release/SenzallsTower.app; \
	./packaging/verify.sh "$$APP" "build/Senzall's Tower.dmg"
```

- [ ] **Step 6: Run the full pipeline and verify Gatekeeper**

Run:
```bash
chmod +x packaging/*.sh
make dmg
make verify
```
Expected: notarization returns `status: Accepted`; `spctl` reports `accepted` for both app and DMG. Definition of done: opening the stapled DMG on a Mac with no dev tools shows no Gatekeeper warning and the game is playable offline.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "packaging: sign + notarize + DMG + Gatekeeper verify"
```

---

## Self-Review Notes

- **Spec coverage:** §1 architecture → Tasks 6–9; §4.1 offline detach → Tasks 3–4; §4.2 shell → Tasks 6–8; §4.3 data flow → Tasks 7–8; §4.4 Senzall VIP → Task 5; §5 signing/notarization → Task 10; §6 testing → Tasks 2 (sim tests), 3 (LocalTowerSocket tests), 4 (offline smoke), 7 (SaveStore test), 10 (Gatekeeper verify); §2 legal/naming → Tasks 1 (NOTICE/LICENSE) + Global Constraints.
- **Known verify-during-implementation items** (flagged in spec §7): `file://` vs `app://` scheme (Task 6 Step 4 — fall back to a `WKURLSchemeHandler` if relative-path loading fails); JIT entitlement necessity (Task 6 Step 3); exact `ClientMessage`/`ServerMessage` variant names (Task 3 Step 1 must be read from source before finalizing Step 4); `TowerSim.create` signature (Task 4 Step 1).
- These are deliberately resolved by reading specific files at implementation time, not left as vague placeholders.
