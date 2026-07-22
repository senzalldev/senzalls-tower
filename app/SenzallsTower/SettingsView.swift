import SwiftUI

/// Persisted user preferences. Keys are shared with the app + web view via
/// @AppStorage (UserDefaults), so changes apply live.
enum SettingsKeys {
    static let uiScale = "uiScale"
    static let launchSpeed = "launchSpeed"
    static let muteOnLaunch = "muteOnLaunch"
}

struct SettingsView: View {
    @AppStorage(SettingsKeys.uiScale) private var uiScale: Double = 1.0
    @AppStorage(SettingsKeys.launchSpeed) private var launchSpeed: Int = 1
    @AppStorage(SettingsKeys.muteOnLaunch) private var muteOnLaunch: Bool = false

    var body: some View {
        Form {
            Section("Display") {
                VStack(alignment: .leading, spacing: 6) {
                    HStack {
                        Text("Interface size")
                        Spacer()
                        Text("\(Int(uiScale * 100))%")
                            .foregroundStyle(.secondary)
                            .monospacedDigit()
                    }
                    Slider(value: $uiScale, in: 0.8...1.6, step: 0.05) {
                        Text("Interface size")
                    } minimumValueLabel: {
                        Text("A").font(.caption)
                    } maximumValueLabel: {
                        Text("A").font(.title3)
                    }
                    Text("Scales the whole game interface for readability.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Button("Reset to 100%") { uiScale = 1.0 }
                        .controlSize(.small)
                }
                .padding(.vertical, 4)
            }

            Section("Gameplay") {
                Picker("Speed at launch", selection: $launchSpeed) {
                    Text("Normal").tag(1)
                    Text("Fast").tag(3)
                    Text("Ultra").tag(10)
                }
                Toggle("Start muted", isOn: $muteOnLaunch)
            }
        }
        .formStyle(.grouped)
        .frame(width: 380, height: 320)
    }
}
