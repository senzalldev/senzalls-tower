// Demo/screenshot tower builder. Not a real test — it constructs towers in the
// sim and writes snapshot JSON to /tmp/senzall-demo/ for screenshot capture.
// Run: npx vitest run apps/worker/src/sim/demo-build.test.ts
import { mkdirSync, writeFileSync } from "node:fs";
import { describe, it } from "vitest";
import { TowerSim } from "./index";
import { STARTING_CASH } from "./resources";
import { createInitialSnapshot } from "./snapshot";

const OUT = "/tmp/senzall-demo";
const GROUND = 109; // grid y for display floor 0
const yOf = (floor: number) => GROUND - floor; // display floor -> grid y

interface Placement {
	tile: string;
	x: number;
	floor: number;
}

function build(name: string, stars: 1 | 2 | 3 | 4 | 5, plan: Placement[], ticks: number) {
	const sim = TowerSim.fromSnapshot(
		createInitialSnapshot("demo", "Senzall's Tower", STARTING_CASH),
	);
	sim.freeBuild = true;
	let placed = 0;
	const reasons = new Map<string, number>();
	for (const p of plan) {
		const r = sim.submitCommand({
			type: "place_tile",
			x: p.x,
			y: yOf(p.floor),
			tileType: p.tile,
		} as never);
		if (r.accepted) placed++;
		else reasons.set(r.reason ?? "?", (reasons.get(r.reason ?? "?") ?? 0) + 1);
	}
	sim.setStarCount(stars);
	for (let i = 0; i < ticks; i++) sim.step();
	const snap = sim.saveState();
	writeFileSync(`${OUT}/${name}.json`, JSON.stringify(snap));
	writeFileSync(
		`${OUT}/${name}.stats.txt`,
		`stars=${stars} placed=${placed}/${plan.length} cash=${sim.cash} pop=${sim.currentPopulation} rejects=${JSON.stringify(Object.fromEntries(reasons))}`,
	);
}

// Layout: a lobby-wide span; an elevator on the left; floors laid bottom-up for
// structural support before rooms are placed on them.
function tower(stars: 1 | 2 | 3 | 4 | 5, floors: number): Placement[] {
	const p: Placement[] = [];
	const left = 130;
	const right = 250;
	const elevX = 132;
	const roomX = 138; // just right of the 4-wide elevator
	// Ground lobby.
	for (let x = left; x <= right; x++) p.push({ tile: "lobby", x, floor: 0 });
	// Build each floor bottom-up: lay the floor slab, extend the elevator + a
	// stairwell (deterministic walkable route so units are reachable), then rooms.
	const stairX = 232;
	for (let f = 1; f <= floors; f++) {
		for (let x = left; x <= right; x++) p.push({ tile: "floor", x, floor: f });
		p.push({ tile: "elevator", x: elevX, floor: f });
		// Stairs connect the floor below to this one.
		p.push({ tile: "stairs", x: stairX, floor: f - 1 });
		if (stars >= 3 && f % 6 === 0) {
			p.push({ tile: "hotelSuite", x: roomX, floor: f });
			p.push({ tile: "hotelSuite", x: roomX + 10, floor: f });
		} else if (stars >= 2 && f % 3 === 0) {
			p.push({ tile: "condo", x: roomX, floor: f });
			p.push({ tile: "condo", x: roomX + 16, floor: f });
		} else {
			p.push({ tile: "office", x: roomX, floor: f });
			p.push({ tile: "office", x: roomX + 9, floor: f });
			p.push({ tile: "office", x: roomX + 18, floor: f });
			p.push({ tile: "office", x: roomX + 27, floor: f });
		}
	}
	// Commercial on low floors for busier towers.
	if (stars >= 2) p.push({ tile: "fastFood", x: roomX, floor: 1 });
	if (stars >= 4) {
		p.push({ tile: "retail", x: roomX + 16, floor: 1 });
		p.push({ tile: "restaurant", x: roomX, floor: 2 });
	}
	return p;
}

describe("demo tower builder", () => {
	it("writes demo snapshots", () => {
		mkdirSync(OUT, { recursive: true });
		build("star1", 1, tower(1, 3), 9000);
		build("star2", 2, tower(2, 5), 9000);
		build("star3", 3, tower(3, 8), 9000);
		build("star4", 4, tower(4, 12), 9000);
		build("star5", 5, tower(5, 16), 10000);
	});
});
