// LocalTowerSocket — an offline, single-player transport with the same shape as
// lib/socket.ts `TowerSocket`, but backed by an in-process LocalGameHost instead
// of a WebSocket. It never touches the network. The host's ServerMessages are
// delivered synchronously to onMessage listeners.

import type { SimSnapshot } from "../../../worker/src/sim/index";
import type { GameSocket } from "../lib/socket";
import type { ClientMessage, ConnectionStatus, ServerMessage } from "../types";
import { LocalGameHost } from "./LocalGameHost";

type MessageListener = (msg: ServerMessage) => void;
type StatusListener = (status: ConnectionStatus) => void;

export interface LocalTowerSocketOptions {
	towerId: string;
	name: string;
	/** Optional saved snapshot to resume from. */
	snapshot?: SimSnapshot | null;
}

export class LocalTowerSocket implements GameSocket {
	private readonly options: LocalTowerSocketOptions;
	private host: LocalGameHost | null = null;
	private status: ConnectionStatus = "disconnected";
	private readonly messageListeners = new Set<MessageListener>();
	private readonly statusListeners = new Set<StatusListener>();

	constructor(options: LocalTowerSocketOptions) {
		this.options = options;
	}

	connect(_towerId: string): void {
		this.host = new LocalGameHost({
			towerId: this.options.towerId,
			name: this.options.name,
			snapshot: this.options.snapshot ?? null,
			emit: (msg) => this.deliver(msg),
		});
		this.setStatus("connected");
	}

	disconnect(): void {
		this.host?.dispose();
		this.host = null;
		this.setStatus("disconnected");
	}

	reconnect(): void {
		// Offline: reconnect is a no-op if already connected.
		if (this.status !== "connected") this.connect(this.options.towerId);
	}

	getStatus(): ConnectionStatus {
		return this.status;
	}

	setActive(_active: boolean): void {
		// Single player is always active.
	}

	send(msg: ClientMessage): void {
		this.host?.handle(msg);
	}

	onMessage(listener: MessageListener): () => void {
		this.messageListeners.add(listener);
		return () => this.messageListeners.delete(listener);
	}

	onStatus(listener: StatusListener): () => void {
		this.statusListeners.add(listener);
		// The real WebSocket transitions to "connected" asynchronously, after
		// the controller has subscribed. Offline we connect synchronously, so
		// replay the current status to each new subscriber — otherwise the
		// controller misses the "connected" edge and never sends join_tower.
		listener(this.status);
		return () => this.statusListeners.delete(listener);
	}

	/** Current authoritative snapshot for saving via the native bridge. */
	getSnapshot(): SimSnapshot | null {
		return this.host?.getSnapshot() ?? null;
	}

	// ── Cheats (single-player only) ─────────────────────────────────────────────
	grantCash(amount: number): void {
		this.host?.grantCash(amount);
	}

	summonVip(): void {
		this.host?.summonVip();
	}

	private deliver(msg: ServerMessage): void {
		for (const listener of this.messageListeners) listener(msg);
	}

	private setStatus(status: ConnectionStatus): void {
		this.status = status;
		for (const listener of this.statusListeners) listener(status);
	}
}
