import Foundation

/// Persists game snapshots as JSON under
/// ~/Library/Application Support/Senzall's Tower/saves/<slot>.json.
/// Writes are atomic (temp file + replace).
enum SaveStore {
    static let directory: URL = {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        let dir = base.appendingPathComponent("Senzall's Tower/saves", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }()

    static func url(for slot: String) -> URL {
        directory.appendingPathComponent("\(slot).json")
    }

    static func save(slot: String, state: String) throws {
        let target = url(for: slot)
        let temp = target.appendingPathExtension("tmp")
        try state.data(using: .utf8)?.write(to: temp, options: .atomic)
        if FileManager.default.fileExists(atPath: target.path) {
            _ = try FileManager.default.replaceItemAt(target, withItemAt: temp)
        } else {
            try FileManager.default.moveItem(at: temp, to: target)
        }
    }

    static func load(slot: String) -> String? {
        try? String(contentsOf: url(for: slot), encoding: .utf8)
    }

    static func list() -> [String] {
        let names = (try? FileManager.default.contentsOfDirectory(atPath: directory.path)) ?? []
        return names.filter { $0.hasSuffix(".json") }.map { String($0.dropLast(5)) }.sorted()
    }
}
