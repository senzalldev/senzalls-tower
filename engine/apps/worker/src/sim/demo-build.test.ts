// Demo/screenshot tower builder. Not a real test — it constructs a genuinely
// well-designed, occupied, good-looking tower in the sim and writes snapshot
// JSON to /tmp/senzall-demo/ for screenshot capture. Stars are NOT forced.
//
// Design principles (from SimTower strategy + validated in-engine):
//  - Elevator shafts MUST start at the ground/lobby floor (0) or nothing above
//    is reachable and units never lease. (This was the key fix.)
//  - Multiple distributed shafts so every room sits next to one; ~8 cars each.
//  - Fill floors — no empty bays. Match room count to what transport can serve.
//  - Stepped/tapered profile (setbacks), not a plain square block.
//  - Zone it: commercial low + underground, offices in the middle band,
//    condos/hotels up top; services (security/medical/recycling/metro) for the
//    star conditions.
// Run: npx vitest run apps/worker/src/sim/demo-build.test.ts
import { mkdirSync, writeFileSync } from "node:fs";
import { describe, it } from "vitest";
import { TowerSim } from "./index";
import { STARTING_CASH } from "./resources";
import { createInitialSnapshot } from "./snapshot";

const OUT = "/tmp/senzall-demo";
const y = (f: number) => 109 - f; // display floor -> grid y (0 = ground)
type Sim = ReturnType<typeof TowerSim.fromSnapshot>;

function P(sim: Sim, tile: string, x: number, f: number): boolean {
	return sim.submitCommand({
		type: "place_tile",
		x,
		y: y(f),
		tileType: tile,
	} as never).accepted;
}
function addCars(sim: Sim, x: number, n: number) {
	for (let i = 0; i < n; i++)
		sim.submitCommand({ type: "add_elevator_car", x, y: y(0) } as never);
}
// Fill [x0,x1] on floor f with repeated `tile` of `w` width.
function fillBay(sim: Sim, tile: string, w: number, x0: number, x1: number, f: number) {
	for (let x = x0; x + w - 1 <= x1; x += w) P(sim, tile, x, f);
}

function buildTower(sim: Sim) {
	// ── Envelope: a wide base (floors 0–14) with a setback tower (15–27). ──
	const baseL = 118;
	const baseR = 252;
	const towerL = 150;
	const towerR = 252;
	const baseTop = 14;
	const top = 27;

	// Elevator shafts. All start at floor 0 (lobby). Two run the full height
	// (inside the setback envelope); one extra serves the wide base.
	const fullShafts = [174, 216]; // within towerL..towerR
	const baseShaft = 130; // wide base only
	const stairXBase = 246;

	// Ground lobby across the whole base.
	for (let x = baseL; x <= baseR; x++) P(sim, "lobby", x, 0);
	for (const sx of fullShafts) P(sim, "elevator", sx, 0);
	P(sim, "elevator", baseShaft, 0);

	for (let f = 1; f <= top; f++) {
		const wide = f <= baseTop;
		const L = wide ? baseL : towerL;
		const R = wide ? baseR : towerR;
		for (let x = L; x <= R; x++) P(sim, "floor", x, f);
		for (const sx of fullShafts) P(sim, "elevator", sx, f);
		if (wide) P(sim, "elevator", baseShaft, f);
		P(sim, "stairs", wide ? stairXBase : towerR - 8, f - 1);

		// Room bays between shafts (kept adjacent to a shaft).
		const bays: Array<[number, number]> = wide
			? [
					[134, 170], // base-shaft ↔ shaft1
					[178, 212], // shaft1 ↔ shaft2
					[220, 242], // shaft2 ↔ stairs
				]
			: [
					[154, 170],
					[178, 212],
					[220, 242],
				];

		for (const [x0, x1] of bays) {
			if (f <= 3)
				fillBay(sim, f % 2 ? "fastFood" : "retail", f % 2 ? 16 : 12, x0, x1, f);
			else if (f <= 14) fillBay(sim, "office", 9, x0, x1, f);
			else if (f % 5 === 0) fillBay(sim, "hotelSuite", 10, x0, x1, f);
			else fillBay(sim, "condo", 16, x0, x1, f);
		}
	}

	// Underground: parking, recycling, metro, and a restaurant row.
	for (let x = baseL; x <= baseR; x++) {
		P(sim, "floor", x, -1);
		P(sim, "floor", x, -2);
	}
	fillBay(sim, "restaurant", 24, 134, 242, -1);
	P(sim, "parking", baseL, -2);
	P(sim, "parking", baseL + 4, -2);
	P(sim, "recyclingCenter", baseL + 8, -2);
	P(sim, "metro", 150, -2);

	// Services on low floors (satisfy 2★–4★ conditions).
	P(sim, "security", 134, 4);
	P(sim, "medical", 134, 5);

	// Real elevator capacity.
	for (const sx of fullShafts) addCars(sim, sx, 7);
	addCars(sim, baseShaft, 7);
}

describe("demo tower builder", () => {
	it("writes a genuinely-built tower", { timeout: 240000 }, () => {
		mkdirSync(OUT, { recursive: true });
		const sim = TowerSim.fromSnapshot(
			createInitialSnapshot("demo", "Senzall's Tower", STARTING_CASH),
		);
		sim.freeBuild = true;
		buildTower(sim);

		const stages: Array<[string, number]> = [
			["early", 1500],
			["growing", 6000],
			["busy", 14000],
			["grand", 26000],
		];
		let t = 0;
		const log: string[] = [];
		for (const [name, target] of stages) {
			while (t < target) {
				sim.step();
				t++;
			}
			writeFileSync(`${OUT}/${name}.json`, JSON.stringify(sim.saveState()));
			log.push(`[${name}] ticks=${t} pop=${sim.currentPopulation} star=${sim.starCount} cash=${sim.cash}`);
		}
		writeFileSync(`${OUT}/stats.txt`, log.join("\n"));
	});
});
