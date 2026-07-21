import XCTest

final class SaveStoreTests: XCTestCase {
    func testSaveLoadRoundTrip() throws {
        let slot = "unit-test-\(UUID().uuidString)"
        let payload = #"{"time":{"totalTicks":42},"world":{"name":"Senzall's Tower"}}"#
        try SaveStore.save(slot: slot, state: payload)
        defer { try? FileManager.default.removeItem(at: SaveStore.url(for: slot)) }

        let loaded = SaveStore.load(slot: slot)
        XCTAssertEqual(loaded, payload)
        XCTAssertTrue(SaveStore.list().contains(slot))
    }

    func testLoadMissingSlotReturnsNil() {
        XCTAssertNil(SaveStore.load(slot: "does-not-exist-\(UUID().uuidString)"))
    }
}
