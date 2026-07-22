// LocalGameHost — an in-process, single-player port of the authoritative
// server (apps/worker/src/durable-objects/TowerRoom). It reuses the SAME sim
// and lockstep helpers the real server uses, so offline behavior is faithful
// tick-for-tick. All Cloudflare/WebSocket/session machinery is dropped: there
// is exactly one local player, always present and active.
//
// Messages are delivered in-process via the `emit` callback instead of a
// WebSocket. See LocalTowerSocket for the transport shim that adapts this to
// the TowerSessionController's socket interface.

import {
	getInputDelayTicks,
	type QueuedInputBatch,
	resolveQueuedInputBatches,
	shouldEmitCheckpoint,
} from "../../../worker/src/durable-objects/lockstep";
import type { SimSnapshot } from "../../../worker/src/sim/index";
import { TowerSim } from "../../../worker/src/sim/index";
import {
	getTileStarRequirement,
	STARTING_CASH,
} from "../../../worker/src/sim/resources";
import { createInitialSnapshot } from "../../../worker/src/sim/snapshot";
import type {
	ClientMessage,
	ResolvedInputBatch,
	ServerMessage,
} from "../types";

const CHECKPOINT_INTERVAL_TICKS = 500;
const LOCAL_PLAYER_FALLBACK = "local";

type Emit = (msg: ServerMessage) => void;

export interface LocalGameHostOptions {
	towerId: string;
	name: string;
	/** Resume from a saved snapshot; otherwise a fresh tower is created. */
	snapshot?: SimSnapshot | null;
	emit: Emit;
}

export class LocalGameHost {
	private readonly emit: Emit;
	private sim: TowerSim;
	private tickTimer: ReturnType<typeof setInterval> | null = null;
	private speedMultiplier: 1 | 3 | 10 = 1;
	private freeBuild = false;
	private isRunning = false;
	private isPaused = false;
	private playerId = LOCAL_PLAYER_FALLBACK;
	private readonly queuedInputs = new Map<number, QueuedInputBatch[]>();

	constructor(options: LocalGameHostOptions) {
		this.emit = options.emit;
		const snapshot =
			options.snapshot ??
			createInitialSnapshot(options.towerId, options.name, STARTING_CASH);
		this.sim = TowerSim.fromSnapshot(snapshot);
	}

	/** Current authoritative snapshot — used by the native save bridge. */
	getSnapshot(): SimSnapshot {
		return this.sim.saveState();
	}

	// ── Cheats (single-player only) ─────────────────────────────────────────────

	/** Add cash to the balance (capped at the sim's 99,999,999 cap). */
	grantCash(amount: number): void {
		const snap = this.sim.saveState();
		const CAP = 99_999_999;
		snap.ledger.cashBalance = Math.min(CAP, snap.ledger.cashBalance + amount);
		this.sim = TowerSim.fromSnapshot(snap);
		this.sim.freeBuild = this.freeBuild;
		this.broadcastCheckpoint();
	}

	/** Announce a VIP visit immediately (roster naming happens client-side). */
	summonVip(): void {
		this.emit({ type: "notification", kind: "vip", message: "summon" });
	}

	dispose(): void {
		this.stopTick();
	}

	handle(msg: ClientMessage): void {
		switch (msg.type) {
			case "join_tower":
				this.playerId = msg.playerId || LOCAL_PLAYER_FALLBACK;
				this.emitInitState();
				this.isRunning = true;
				this.isPaused = false;
				this.startTick();
				return;
			case "ping":
				this.emit({ type: "pong" });
				return;
			case "set_active":
				// Single player is always active; nothing to pause on focus loss.
				return;
			case "set_speed":
				this.speedMultiplier = msg.multiplier;
				if (this.isRunning && !this.isPaused) this.restartTick();
				this.broadcastSessionSettings();
				return;
			case "set_paused":
				this.isPaused = msg.paused;
				if (this.isPaused) this.stopTick();
				else if (this.isRunning) this.startTick();
				this.broadcastSessionSettings();
				return;
			case "set_star_count":
				this.sim.setStarCount(msg.starCount);
				this.broadcastCheckpoint();
				return;
			case "set_free_build":
				this.freeBuild = msg.enabled;
				this.sim.freeBuild = msg.enabled;
				this.broadcastSessionSettings();
				return;
			case "query_cell": {
				const info = this.sim.queryCell(msg.x, msg.y);
				this.emit({
					type: "cell_info",
					x: msg.x,
					y: msg.y,
					anchorX: info.anchorX,
					tileType: info.tileType,
					objectInfo: info.objectInfo,
					cinemaInfo: info.cinemaInfo,
					carrierInfo: info.carrierInfo,
				});
				return;
			}
			case "input_batch": {
				if (msg.inputs.length === 0) return;
				const targetTick = Math.max(this.sim.simTime + 1, msg.targetTick);
				this.enqueue(targetTick, {
					playerId: this.playerId,
					clientSeq: msg.clientSeq,
					inputs: msg.inputs,
				});
				return;
			}
			default: {
				// Command-style messages (set_rent_level, add/remove_elevator_car,
				// set_cinema_movie_pool, prompt_response) — schedule as a batch.
				const command = commandFromMessage(msg);
				if (!command) return;
				const targetTick =
					this.sim.simTime + getInputDelayTicks(this.speedMultiplier);
				this.enqueue(targetTick, {
					playerId: this.playerId,
					clientSeq: localSeq(),
					inputs: [command],
				});
			}
		}
	}

	// ─── Tick loop (mirrors TowerRoom.tick) ─────────────────────────────────────

	private startTick(): void {
		if (this.tickTimer !== null) return;
		const interval = Math.max(1, Math.round(50 / this.speedMultiplier));
		this.tickTimer = setInterval(() => this.tick(), interval);
	}

	private restartTick(): void {
		this.stopTick();
		this.startTick();
	}

	private stopTick(): void {
		if (this.tickTimer !== null) {
			clearInterval(this.tickTimer);
			this.tickTimer = null;
		}
	}

	private tick(): void {
		if (!this.isRunning) return;
		const nextTick = this.sim.simTime + 1;
		const batches = this.queuedInputs.get(nextTick) ?? [];
		if (batches.length > 0) this.queuedInputs.delete(nextTick);
		const resolved = this.applyQueuedInputs(batches);
		const result = this.sim.step();
		if (resolved.length > 0) {
			this.emit({
				type: "authoritative_batch",
				serverTick: result.simTime,
				batches: resolved,
			});
		}
		this.broadcastEffects(result);
		if (shouldEmitCheckpoint(result.simTime, CHECKPOINT_INTERVAL_TICKS)) {
			this.broadcastCheckpoint();
		}
	}

	// ─── Helpers (mirror TowerRoom) ─────────────────────────────────────────────

	private enqueue(tick: number, batch: QueuedInputBatch): void {
		const queue = this.queuedInputs.get(tick);
		if (queue) queue.push(batch);
		else this.queuedInputs.set(tick, [batch]);
	}

	private getPlacementRejectionReason(tileType: string): string | null {
		if (this.freeBuild) return null;
		const requiredStars = getTileStarRequirement(tileType);
		if (this.sim.starCount >= requiredStars) return null;
		return `Requires ${requiredStars} star${requiredStars === 1 ? "" : "s"}`;
	}

	private applyQueuedInputs(batches: QueuedInputBatch[]): ResolvedInputBatch[] {
		if (batches.length === 0) return [];
		return resolveQueuedInputBatches(this.sim, batches, {
			freeBuild: this.freeBuild,
			getPlacementRejectionReason: (tileType) =>
				this.getPlacementRejectionReason(tileType),
			onPromptDismissed: (promptId) =>
				this.emit({ type: "prompt_dismissed", promptId }),
		});
	}

	private broadcastEffects(result: {
		notifications: Array<{ kind: string; message: string }>;
		prompts: Array<{
			promptId: string;
			promptKind: "bomb_ransom" | "fire_rescue" | "carrier_edit_confirmation";
			message: string;
			cost?: number;
		}>;
	}): void {
		for (const n of result.notifications) {
			this.emit({ type: "notification", kind: n.kind, message: n.message });
		}
		for (const p of result.prompts) {
			if (p.promptKind === "carrier_edit_confirmation") {
				// Single-player: auto-confirm removing an elevator car that still has
				// traffic (the server would show a modal; offline we just complete it
				// on the next tick so the action never silently stalls).
				this.enqueue(this.sim.simTime + 1, {
					playerId: this.playerId,
					clientSeq: localSeq(),
					inputs: [
						{ type: "prompt_response", promptId: p.promptId, accepted: true },
					],
				});
				continue;
			}
			this.emit({
				type: "prompt",
				promptId: p.promptId,
				promptKind: p.promptKind,
				message: p.message,
				cost: p.cost,
			});
		}
	}

	private emitInitState(): void {
		this.emit({
			type: "init_state",
			towerId: this.sim.towerId,
			name: this.sim.name,
			simTime: this.sim.simTime,
			snapshot: this.sim.saveState(),
			speedMultiplier: this.speedMultiplier,
			freeBuild: this.freeBuild,
			paused: this.isPaused,
			cash: this.sim.cash,
			population: this.sim.currentPopulation,
			starCount: this.sim.starCount,
			width: this.sim.width,
			height: this.sim.height,
		});
		this.emit({ type: "presence_update", playerCount: 1, activeCount: 1 });
	}

	private broadcastSessionSettings(): void {
		this.emit({
			type: "session_settings",
			speedMultiplier: this.speedMultiplier,
			freeBuild: this.freeBuild,
			paused: this.isPaused,
		});
	}

	private broadcastCheckpoint(): void {
		this.emit({
			type: "checkpoint",
			serverTick: this.sim.simTime,
			snapshot: this.sim.saveState(),
			speedMultiplier: this.speedMultiplier,
			freeBuild: this.freeBuild,
		});
	}
}

let seqCounter = 0;
function localSeq(): number {
	seqCounter += 1;
	return seqCounter;
}

// Local equivalent of worker/src/protocol.ts `toSimCommand` for the
// command-style ClientMessages. Kept here so the offline layer does not import
// worker transport code.
function commandFromMessage(msg: ClientMessage) {
	switch (msg.type) {
		case "prompt_response":
			return {
				type: "prompt_response",
				promptId: msg.promptId,
				accepted: msg.accepted,
			} as const;
		case "set_rent_level":
			return {
				type: "set_rent_level",
				x: msg.x,
				y: msg.y,
				rentLevel: msg.rentLevel,
			} as const;
		case "add_elevator_car":
			return { type: "add_elevator_car", x: msg.x, y: msg.y } as const;
		case "remove_elevator_car":
			return { type: "remove_elevator_car", x: msg.x, y: msg.y } as const;
		case "set_cinema_movie_pool":
			return {
				type: "set_cinema_movie_pool",
				x: msg.x,
				y: msg.y,
				pool: msg.pool,
			} as const;
		default:
			return null;
	}
}
