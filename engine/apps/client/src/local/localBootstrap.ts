// Offline single-player bootstrap. Enabled at build time with VITE_LOCAL=1
// (see apps/client/package.json `build:local`). When enabled, App.tsx skips the
// guest + lobby screens and drops straight into a local tower backed by
// LocalTowerSocket / LocalGameHost — no server, no account.

import type { SimSnapshot } from "../../../worker/src/sim/index";
import { LocalTowerSocket } from "./LocalTowerSocket";

export const IS_LOCAL = import.meta.env.VITE_LOCAL === "1";

export const LOCAL_TOWER_ID = "senzalls-tower";
export const LOCAL_TOWER_NAME = "Senzall's Tower";
export const LOCAL_PLAYER_ID = "senzall";
export const LOCAL_PLAYER_NAME = "Senzall";

/** Launch preferences injected by the native shell (Settings window). */
export interface LaunchSettings {
	speed: 1 | 3 | 10;
	muted: boolean;
}

export function launchSettings(): LaunchSettings {
	const raw = (
		window as unknown as { __SENZALL_LAUNCH?: Partial<LaunchSettings> }
	).__SENZALL_LAUNCH;
	const speed = raw?.speed === 3 || raw?.speed === 10 ? raw.speed : 1;
	return { speed, muted: raw?.muted === true };
}

export function createLocalSocket(
	snapshot?: SimSnapshot | null,
): LocalTowerSocket {
	return new LocalTowerSocket({
		towerId: LOCAL_TOWER_ID,
		name: LOCAL_TOWER_NAME,
		snapshot: snapshot ?? null,
		speed: launchSettings().speed,
	});
}
