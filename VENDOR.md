# Vendored engine

The `engine/` directory is vendored from
[phulin/tower-together](https://github.com/phulin/tower-together), an MIT-licensed
clean-room reimplementation of a SimTower-style simulation.

- **Pinned commit:** `073c0e4e4b78f440742d1f6ff8ea1ad8e7d52ccb`
- **Vendored on:** 2026-07-21
- **License:** MIT (c) 2026 Patrick Hulin — see `third_party/tower-together-LICENSE.md`

## Modifications applied for Senzall's Tower

Offline single-player additions are isolated so the upstream stays diffable:

1. **Trim** (`Task 2`): build scoped to `apps/client` + `apps/worker/src/sim`;
   worker/wrangler deploy dropped from the build pipeline. Vite `base: "./"`.
2. **Offline transport** (`Task 3`): `apps/client/src/local/LocalTowerSocket.ts`
   loopback replacing the multiplayer WebSocket.
3. **Local bootstrap** (`Task 4`): `apps/client/src/local/localBootstrap.ts`,
   gated by `VITE_LOCAL=1`; skips lobby, creates a local tower.
4. **VIP roster** (`Task 5`): `apps/client/src/local/vips.ts` (presentation only;
   no sim change).
5. **Native bridge** (`Task 7`): `apps/client/src/local/nativeBridge.ts`.

## Re-syncing upstream

Re-run the clone at a new commit, re-apply the `local/` additions and the
trim/Vite-base changes (all localized), update the pinned commit above.
