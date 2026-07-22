import SwiftUI

@main
struct SenzallsTowerApp: App {
    @AppStorage(SettingsKeys.uiScale) private var uiScale: Double = 1.0

    var body: some Scene {
        WindowGroup("Senzall's Tower") {
            GameWebView(uiScale: uiScale)
                .frame(minWidth: 1024, minHeight: 700)
                .ignoresSafeArea()
        }
        .windowStyle(.hiddenTitleBar)
        .windowResizability(.contentMinSize)
        .commands {
            SenzallCommands()
        }

        Settings {
            SettingsView()
        }
    }
}
