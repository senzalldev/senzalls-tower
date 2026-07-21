import { describe, expect, it } from "vitest";
import { VIP_ROSTER, vipArrivalMessage, vipForVisit, vipLabel } from "./vips";

describe("VIP roster", () => {
	it("has 12 named VIPs with Senzall first", () => {
		expect(VIP_ROSTER).toHaveLength(12);
		expect(VIP_ROSTER[0].name).toBe("Senzall");
	});

	it("selects deterministically and cycles", () => {
		expect(vipForVisit(0).name).toBe("Senzall");
		expect(vipForVisit(1).name).toBe("JetBlast");
		expect(vipForVisit(11).name).toBe("Dan");
		expect(vipForVisit(12).name).toBe("Senzall"); // wraps
		expect(vipForVisit(13).name).toBe("JetBlast");
	});

	it("every VIP has a non-empty characteristic", () => {
		for (const v of VIP_ROSTER) {
			expect(v.characteristic.length).toBeGreaterThan(0);
		}
	});

	it("formats labels and arrival messages", () => {
		expect(vipLabel(VIP_ROSTER[0])).toBe("Senzall (VIP)");
		expect(vipArrivalMessage(VIP_ROSTER[0])).toContain(
			"Senzall (VIP) has arrived",
		);
	});
});
