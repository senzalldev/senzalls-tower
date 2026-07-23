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
    line("A skyscraper-building simulation: stack offices, condos, hotels, shops,")
    line("and restaurants; keep tenants happy and elevators moving; grow from one")
    line("star to a five-star tower without going bankrupt.\n")

    line("How to play", bold: true)
    line("• Pick a facility from the BUILD panel and click to place it.")
    line("• Start with a Lobby on the ground floor, then add floors, elevators, rooms.")
    line("• Speed: ⌘1 / ⌘2 / ⌘3   Pause: ⌘P   Save: ⌘S   Load: ⌘O   New: ⌘N")
    line("• Tune sound per-effect in the Sound menu; scale the UI in Settings (⌘,).")
    line("• Watch for VIP guests like Senzall.\n")

    line("A fork — and what we changed", bold: true)
    line("Senzall's Tower is an independent fork that turns a browser-based,")
    line("multiplayer game into a polished, offline single-player Mac app. Our work:")
    line("• Ported the authoritative multiplayer server loop to run in-process, so")
    line("  the game is fully offline — no account, no network, no server.")
    line("• Wrapped it in a native macOS app (SwiftUI + WKWebView) with a custom")
    line("  local content origin, native menus, Save/Load, and an app icon.")
    line("• Added Settings (interface scaling), a per-effect Sound menu, cheats,")
    line("  a named VIP roster, and Mac-native typography & layout polish.")
    line("• Signed with a Developer ID and notarized by Apple.\n")

    line("Credits", bold: true)
    line("Simulation engine: tower-together by Patrick Hulin (MIT license) —")
    line("github.com/phulin/tower-together. A clean-room reimplementation that")
    line("ships none of the original game's assets or code.")
    line("")
    line("Inspired by the classic tower-building sim SimTower (\"The Tower\", 1994)")
    line("created by Yoot Saito / OPeNBook and published by Maxis, and its sequel")
    line("Yoot Tower (1998). Senzall's Tower is not affiliated with, endorsed by,")
    line("or derived from the code or assets of those games; \"SimTower\" and")
    line("\"Yoot Tower\" are trademarks of their respective owners.\n")

    line("A note from the maker", bold: true)
    line("SimTower and Yoot Tower are among my favorite games of all time. I built")
    line("this version for myself — to play my favorite game — and I wanted to")
    line("share it with anyone who'd like to play it too. It's a privilege to work")
    line("on it with Claude, bringing a new implementation to the Mac using modern")
    line("AI tools.\n")

    line("Offline & private", bold: true)
    line("Runs entirely on your Mac — no account, no network, no tracking.")

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
    @AppStorage(SettingsKeys.sndAmbience) private var sndAmbience = true
    @AppStorage(SettingsKeys.sndTransport) private var sndTransport = true
    @AppStorage(SettingsKeys.sndCrowd) private var sndCrowd = true
    @AppStorage(SettingsKeys.sndOffice) private var sndOffice = true
    @AppStorage(SettingsKeys.sndFood) private var sndFood = true
    @AppStorage(SettingsKeys.sndLodging) private var sndLodging = true
    @AppStorage(SettingsKeys.sndRetail) private var sndRetail = true
    @AppStorage(SettingsKeys.sndServices) private var sndServices = true
    @AppStorage(SettingsKeys.sndCash) private var sndCash = true

    var body: some Commands {
        CommandGroup(replacing: .appInfo) {
            Button("About Senzall's Tower") { showAboutPanel() }
        }
        CommandGroup(replacing: .help) {
            Button("Senzall's Tower Guide") { fire("help") }
                .keyboardShortcut("?", modifiers: .command)
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
        CommandMenu("Sound") {
            Toggle("Ambience & Rooster", isOn: $sndAmbience)
            Toggle("Cash Register", isOn: $sndCash)
            Divider()
            Toggle("Elevators & Transport", isOn: $sndTransport)
            Toggle("Crowds & Lobbies", isOn: $sndCrowd)
            Toggle("Offices", isOn: $sndOffice)
            Toggle("Food & Restaurants", isOn: $sndFood)
            Toggle("Hotels & Condos", isOn: $sndLodging)
            Toggle("Shops", isOn: $sndRetail)
            Toggle("Services", isOn: $sndServices)
            Divider()
            Button("Enable All Sounds") {
                for key in [
                    SettingsKeys.sndAmbience, SettingsKeys.sndCash, SettingsKeys.sndTransport,
                    SettingsKeys.sndCrowd, SettingsKeys.sndOffice, SettingsKeys.sndFood,
                    SettingsKeys.sndLodging, SettingsKeys.sndRetail, SettingsKeys.sndServices,
                ] {
                    UserDefaults.standard.set(true, forKey: key)
                }
            }
        }
    }
}
