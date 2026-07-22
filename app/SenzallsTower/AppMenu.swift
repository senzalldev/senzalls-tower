import AppKit
import SwiftUI

extension Notification.Name {
    /// Posted by menu commands; carries the action string in `object`.
    static let senzallMenuAction = Notification.Name("senzallMenuAction")
}

private func fire(_ action: String) {
    NotificationCenter.default.post(name: .senzallMenuAction, object: action)
}

private func appVersion() -> String {
    let v = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "?"
    let b = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "?"
    return "\(v) (\(b))"
}

/// A rich, native About panel with credits, attribution, and how-to.
func showAboutPanel() {
    let credits = NSMutableAttributedString()
    func line(_ s: String, bold: Bool = false, size: CGFloat = 11) {
        let font = bold ? NSFont.boldSystemFont(ofSize: size) : NSFont.systemFont(ofSize: size)
        credits.append(NSAttributedString(string: s + "\n", attributes: [
            .font: font,
            .foregroundColor: NSColor.labelColor,
        ]))
    }
    line("Build a skyscraper of offices, condos, hotels, shops, and restaurants —", size: 11)
    line("keep tenants happy and the elevators moving without going bankrupt.\n")
    line("How to play", bold: true)
    line("• Pick a facility from the BUILD panel and click to place it.")
    line("• Start with a Lobby on the ground floor, then add floors, elevators, and rooms.")
    line("• Speed: ⌘1 / ⌘2 / ⌘3   Pause: ⌘P   Save: ⌘S   Load: ⌘O   New: ⌘N")
    line("• Watch for VIP guests like Senzall.\n")
    line("Offline & private", bold: true)
    line("Runs entirely on your Mac — no account, no network, no tracking.\n")
    line("Credits", bold: true)
    line("Simulation engine: tower-together (MIT) © 2026 Patrick Hulin —")
    line("github.com/phulin/tower-together. A clean-room reimplementation; no")
    line("original SimTower / Yoot Tower assets or code are included.")

    let options: [NSApplication.AboutPanelOptionKey: Any] = [
        .applicationName: "Senzall's Tower",
        .applicationVersion: appVersion(),
        .version: "",
        .credits: credits,
        NSApplication.AboutPanelOptionKey(rawValue: "Copyright"):
            "An independent game. “SimTower”/“Yoot Tower” are trademarks of their owners.",
    ]
    NSApp.activate(ignoringOtherApps: true)
    NSApp.orderFrontStandardAboutPanel(options: options)
}

/// Native menu bar for Senzall's Tower.
struct SenzallCommands: Commands {
    var body: some Commands {
        CommandGroup(replacing: .appInfo) {
            Button("About Senzall's Tower") { showAboutPanel() }
        }
        CommandGroup(replacing: .newItem) {
            Button("New Tower") { fire("newTower") }
                .keyboardShortcut("n", modifiers: .command)
        }
        CommandGroup(after: .newItem) {
            Button("Save") { fire("save") }
                .keyboardShortcut("s", modifiers: .command)
            Button("Load") { fire("load") }
                .keyboardShortcut("o", modifiers: .command)
        }
        CommandMenu("Game") {
            Button("Pause / Resume") { fire("pause") }
                .keyboardShortcut("p", modifiers: .command)
            Divider()
            Button("Speed: Normal") { fire("speed1") }
                .keyboardShortcut("1", modifiers: .command)
            Button("Speed: Fast") { fire("speed3") }
                .keyboardShortcut("2", modifiers: .command)
            Button("Speed: Ultra") { fire("speed10") }
                .keyboardShortcut("3", modifiers: .command)
        }
        CommandMenu("Cheats") {
            Button("Grant $1,000,000") { fire("cash1m") }
                .keyboardShortcut("m", modifiers: .command)
            Button("Grant $10,000,000") { fire("cash10m") }
                .keyboardShortcut("m", modifiers: [.command, .shift])
            Divider()
            Button("Toggle Free Build") { fire("freebuild") }
                .keyboardShortcut("b", modifiers: [.command, .shift])
            Button("Max Stars (5★)") { fire("maxstars") }
                .keyboardShortcut("5", modifiers: [.command, .shift])
            Divider()
            Button("Summon VIP") { fire("vip") }
                .keyboardShortcut("v", modifiers: [.command, .shift])
        }
    }
}
