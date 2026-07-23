import SwiftUI

@main
struct SenzallsTowerApp: App {
    @AppStorage(SettingsKeys.uiScale) private var uiScale: Double = 1.0
    @AppStorage(SettingsKeys.launchSpeed) private var launchSpeed: Int = 1
    @AppStorage(SettingsKeys.muteOnLaunch) private var muteOnLaunch: Bool = false

    init() {
        SettingsKeys.registerDefaults()
    }

    var body: some Scene {
        WindowGroup("Senzall's Tower") {
            GameWebView(
                uiScale: uiScale, launchSpeed: launchSpeed, startMuted: muteOnLaunch)
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
