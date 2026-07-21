// Offline single-player bootstrap. Enabled at build time with VITE_LOCAL=1
// (see apps/client/package.json `build:local`). When enabled, App.tsx skips the
// guest + lobby screens and drops straight into a local tower backed by
// LocalTowerSocket / LocalGameHost — no server, no account.

import { LocalTowerSocket } from "./LocalTowerSocket";
import type { SimSnapshot } from "../../../worker/src/sim/index";

export const IS_LOCAL = import.meta.env.VITE_LOCAL === "1";

export const LOCAL_TOWER_ID = "senzalls-tower";
export const LOCAL_TOWER_NAME = "Senzall's Tower";
export const LOCAL_PLAYER_ID = "senzall";
export const LOCAL_PLAYER_NAME = "Senzall";

export function createLocalSocket(snapshot?: SimSnapshot | null): LocalTowerSocket {
	return new LocalTowerSocket({
		towerId: LOCAL_TOWER_ID,
		name: LOCAL_TOWER_NAME,
		snapshot: snapshot ?? null,
	});
}
