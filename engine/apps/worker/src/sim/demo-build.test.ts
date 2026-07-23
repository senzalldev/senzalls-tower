// Demo/screenshot tower builder. Not a real test — it constructs genuinely
// well-designed, occupied towers in the sim and writes snapshot JSON to
// /tmp/senzall-demo/ for screenshot capture. Stars are NOT forced: we build
// real towers (dense floors, working elevator with cars, services) and let the
// simulation populate and rate them, so screenshots reflect actual content.
// Run: npx vitest run apps/worker/src/sim/demo-build.test.ts
import { mkdirSync, writeFileSync } from "node:fs";
import { describe, it } from "vitest";
import { TowerSim } from "./index";
import { STARTING_CASH } from "./resources";
import { createInitialSnapshot } from "./snapshot";

const OUT = "/tmp/senzall-demo";
const GROUND = 109; // grid y for display floor 0
const yOf = (floor: number) => GROUND - floor;

// Building envelope (grid x). Two elevator banks so every room is close to a
// shaft (SimTower rule: distant rooms = long trips = vacancies). Rooms fill the
// bays between/around the elevators; stairs on the far right for short hops.
const LEFT = 128;
const RIGHT = 248;
const ELEV_A = 128; // left elevator (width 4) -> serves bay A
const ELEV_B = 186; // mid elevator (width 4) -> serves bays around it
const STAIR_X = 240; // stairs (width 8)
// Room bays (kept short so walks stay under the stress clamp):
const BAYS: Array<[number, number]> = [
	[133, 181], // between left elevator and mid elevator
	[191, 239], // between mid elevator and stairs
];

type Sim = ReturnType<typeof TowerSim.fromSnapshot>;

function place(sim: Sim, tile: string, x: number, floor: number): boolean {
	return sim.submitCommand({
		type: "place_tile",
		x,
		y: yOf(floor),
		tileType: tile,
	} as never).accepted;
}

// Fill each room bay with a repeated room type (best-effort).
function fillFloor(sim: Sim, tile: string, width: number, floor: number) {
	for (const [start, end] of BAYS) {
		for (let x = start; x + width - 1 <= end; x += width) {
			place(sim, tile, x, floor);
		}
	}
}

function addCars(sim: Sim, elevX: number, n: number) {
	for (let i = 0; i < n; i++) {
		sim.submitCommand({
			type: "add_elevator_car",
			x: elevX,
			y: yOf(1),
		} as never);
	}
}

function buildGrand(sim: Sim, floors: number) {
	// Ground lobby, wide.
	for (let x = LEFT; x <= RIGHT; x++) place(sim, "lobby", x, 0);
	for (let f = 1; f <= floors; f++) {
		for (let x = LEFT; x <= RIGHT; x++) place(sim, "floor", x, f);
		place(sim, "elevator", ELEV_A, f);
		place(sim, "elevator", ELEV_B, f);
		place(sim, "stairs", STAIR_X, f - 1);
		if (f <= 3) {
			// Commercial near the lobby: a lively mix.
			const strip = ["fastFood", "retail", "restaurant", "retail"];
			for (const [start, end] of BAYS) {
				let x = start;
				let i = 0;
				const widths: Record<string, number> = {
					fastFood: 16,
					retail: 12,
					restaurant: 24,
				};
				while (x < end) {
					const tile = strip[i % strip.length];
					if (x + widths[tile] - 1 > end) break;
					place(sim, tile, x, f);
					x += widths[tile];
					i++;
				}
			}
		} else if (f <= Math.floor(floors * 0.6)) {
			fillFloor(sim, "office", 9, f); // office band
		} else if (f % 4 === 0) {
			fillFloor(sim, "hotelSuite", 10, f); // occasional hotel floor
		} else {
			fillFloor(sim, "condo", 16, f); // residential band
		}
	}
	// Services (satisfy 2★–4★ conditions + realism).
	place(sim, "security", 133, 4);
	place(sim, "medical", 133, 5);
	place(sim, "recyclingCenter", LEFT, -2);
	place(sim, "parking", LEFT, -1);
	place(sim, "parking", LEFT + 4, -1);
	place(sim, "metro", 140, -3);
	// Real elevator capacity — up to 8 cars per shaft.
	addCars(sim, ELEV_A, 7);
	addCars(sim, ELEV_B, 7);
}

function summarize(sim: Sim) {
	return `pop=${sim.currentPopulation} star=${sim.starCount} cash=${sim.cash}`;
}

describe("demo tower builder", () => {
	it("writes genuinely-built demo snapshots", { timeout: 180000 }, () => {
		mkdirSync(OUT, { recursive: true });
		// One flagship tower; capture it at several growth stages so the shots
		// show a real progression of the SAME tower filling up and being rated.
		const sim = TowerSim.fromSnapshot(
			createInitialSnapshot("demo", "Senzall's Tower", STARTING_CASH),
		);
		sim.freeBuild = true;
		buildGrand(sim, 28);

		const stages = [400, 1200, 3000, 6000, 12000];
		const names = ["early", "growing", "busy", "bustling", "grand"];
		let stepped = 0;
		const log: string[] = [];
		for (let i = 0; i < stages.length; i++) {
			while (stepped < stages[i]) {
				sim.step();
				stepped++;
			}
			writeFileSync(`${OUT}/${names[i]}.json`, JSON.stringify(sim.saveState()));
			log.push(`[${names[i]}] ticks=${stepped} ${summarize(sim)}`);
		}
		writeFileSync(`${OUT}/stats.txt`, log.join("\n"));
	});
});
