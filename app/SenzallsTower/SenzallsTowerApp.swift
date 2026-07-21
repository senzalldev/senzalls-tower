import SwiftUI

@main
struct SenzallsTowerApp: App {
    var body: some Scene {
        WindowGroup("Senzall's Tower") {
            GameWebView()
                .frame(minWidth: 1024, minHeight: 700)
                .ignoresSafeArea()
        }
        .windowStyle(.hiddenTitleBar)
        .windowResizability(.contentMinSize)
    }
}
