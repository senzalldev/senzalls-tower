import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LocalTowerSocket } from "./LocalTowerSocket";
import type { ClientMessage, ServerMessage } from "../types";

function joinMsg(): ClientMessage {
	return { type: "join_tower", playerId: "p1", displayName: "Player One" };
}

describe("LocalTowerSocket (offline single-player)", () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	it("reports connected synchronously on connect", () => {
		const s = new LocalTowerSocket({ towerId: "t", name: "Test Tower" });
		const statuses: string[] = [];
		s.onStatus((st) => statuses.push(st));
		s.connect("t");
		expect(s.getStatus()).toBe("connected");
		expect(statuses).toContain("connected");
	});

	it("emits init_state with a snapshot after join_tower", () => {
		const s = new LocalTowerSocket({ towerId: "t", name: "Test Tower" });
		const seen: ServerMessage[] = [];
		s.onMessage((m) => seen.push(m));
		s.connect("t");
		s.send(joinMsg());
		const init = seen.find((m) => m.type === "init_state");
		expect(init).toBeDefined();
		expect(init && "snapshot" in init && init.snapshot).toBeTruthy();
		expect(init && "name" in init && init.name).toBe("Test Tower");
	});

	it("answers query_cell with cell_info", () => {
		const s = new LocalTowerSocket({ towerId: "t", name: "Test Tower" });
		const seen: ServerMessage[] = [];
		s.onMessage((m) => seen.push(m));
		s.connect("t");
		s.send(joinMsg());
		s.send({ type: "query_cell", x: 100, y: 0 });
		const info = seen.find((m) => m.type === "cell_info");
		expect(info).toBeDefined();
	});

	it("broadcasts session_settings on set_speed", () => {
		const s = new LocalTowerSocket({ towerId: "t", name: "Test Tower" });
		const seen: ServerMessage[] = [];
		s.onMessage((m) => seen.push(m));
		s.connect("t");
		s.send(joinMsg());
		seen.length = 0;
		s.send({ type: "set_speed", multiplier: 3 });
		const settings = seen.find((m) => m.type === "session_settings");
		expect(settings && "speedMultiplier" in settings && settings.speedMultiplier).toBe(3);
	});

	it("advances the sim on its own timer and confirms inputs (authoritative_batch)", () => {
		const s = new LocalTowerSocket({ towerId: "t", name: "Test Tower" });
		const seen: ServerMessage[] = [];
		s.onMessage((m) => seen.push(m));
		s.connect("t");
		s.send(joinMsg());
		// Place a lobby far in the future tick; input_batch targetTick is clamped
		// to at least simTime+1, so a large delay lands within our tick budget.
		s.send({
			type: "input_batch",
			clientSeq: 1,
			targetTick: 6,
			inputs: [{ type: "place_tile", x: 100, y: 0, tileType: "lobby" }],
		});
		vi.advanceTimersByTime(50 * 20); // 20 ticks at 1x
		const auth = seen.find((m) => m.type === "authoritative_batch");
		expect(auth).toBeDefined();
	});

	it("never uses fetch or WebSocket", () => {
		const fetchSpy = vi.spyOn(globalThis, "fetch");
		const s = new LocalTowerSocket({ towerId: "t", name: "Test Tower" });
		s.connect("t");
		s.send(joinMsg());
		s.send({ type: "set_paused", paused: true });
		vi.advanceTimersByTime(500);
		expect(fetchSpy).not.toHaveBeenCalled();
	});
});
