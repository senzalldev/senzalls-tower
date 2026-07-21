// Named VIP roster for Senzall's Tower. Presentation-layer only: these names
// and characteristics decorate arrival toasts and inspection labels. They never
// feed back into the deterministic simulation (RNG, ticks, snapshots).

export interface Vip {
	name: string;
	characteristic: string;
}

export const VIP_ROSTER: Vip[] = [
	{
		name: "Senzall",
		characteristic: "the founder — always the first VIP to bless a new tower",
	},
	{
		name: "JetBlast",
		characteristic: "arrives fast; demands express elevators",
	},
	{ name: "Dawn", characteristic: "early riser — visits at daybreak" },
	{ name: "Anabella", characteristic: "refined — rates hotel suites hardest" },
	{
		name: "Kathy",
		characteristic: "foodie — heads straight for the restaurants",
	},
	{ name: "Andy", characteristic: "deal-maker — loves busy office floors" },
	{ name: "Nick", characteristic: "night owl — turns up after dark" },
	{
		name: "Eric",
		characteristic: "efficiency hawk — hates long elevator waits",
	},
	{
		name: "Josh",
		characteristic: "crowd-pleaser — happiest in a packed lobby",
	},
	{
		name: "Stevie",
		characteristic: "retail therapist — makes a beeline for the shops",
	},
	{ name: "Brian", characteristic: "big spender — favors the condos" },
	{ name: "Dan", characteristic: "the closer — signs off on 5-star status" },
];

// Deterministic, display-only: pick a VIP by how many VIP visits have occurred.
// Senzall (index 0) is always first; the roster then cycles.
export function vipForVisit(visitIndex: number): Vip {
	const n = VIP_ROSTER.length;
	const i = ((visitIndex % n) + n) % n;
	return VIP_ROSTER[i];
}

export function vipLabel(vip: Vip): string {
	return `${vip.name} (VIP)`;
}

export function vipArrivalMessage(vip: Vip): string {
	return `${vipLabel(vip)} has arrived — ${vip.characteristic}`;
}
