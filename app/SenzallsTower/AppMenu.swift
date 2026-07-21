import SwiftUI

extension Notification.Name {
    /// Posted by menu commands; carries the action string in `object`.
    static let senzallMenuAction = Notification.Name("senzallMenuAction")
}

private func fire(_ action: String) {
    NotificationCenter.default.post(name: .senzallMenuAction, object: action)
}

/// Native menu bar commands for Senzall's Tower. Each forwards an action string
/// to the web engine via the bridge (see GameWebView / Bridge.sendMenuAction).
struct SenzallCommands: Commands {
    var body: some Commands {
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
    }
}
