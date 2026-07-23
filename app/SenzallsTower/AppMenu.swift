import AppKit
import SwiftUI

extension Notification.Name {
    /// Posted by menu commands; carries the action string in `object`.
    static let senzallMenuAction = Notification.Name("senzallMenuAction")
}

private func fire(_ action: String) {
    NotificationCenter.default.post(name: .senzallMenuAction, object: action)
}

/// Turn every sound category on or off at once.
private func setAllSounds(_ on: Bool) {
    for key in [
        SettingsKeys.sndAmbience, SettingsKeys.sndCash, SettingsKeys.sndTransport,
        SettingsKeys.sndCrowd, SettingsKeys.sndOffice, SettingsKeys.sndFood,
        SettingsKeys.sndLodging, SettingsKeys.sndRetail, SettingsKeys.sndServices,
    ] {
        UserDefaults.standard.set(on, forKey: key)
    }
}

/// Show the custom About window (see AboutView).
@MainActor
func showAboutPanel() {
    AboutWindow.show()
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
            Button("Enable All Sounds") { setAllSounds(true) }
            Button("Mute All Sounds") { setAllSounds(false) }
        }
    }
}
