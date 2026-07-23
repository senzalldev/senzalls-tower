import AppKit
import SwiftUI

/// A large, readable About window. The standard macOS about panel is small with
/// tiny text; this gives room to properly credit the game's author.
struct AboutView: View {
    private var version: String {
        let v = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "?"
        return "Version \(v)"
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                // Header
                HStack(spacing: 16) {
                    if let icon = NSApp.applicationIconImage {
                        Image(nsImage: icon)
                            .resizable()
                            .frame(width: 84, height: 84)
                    }
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Senzall's Tower")
                            .font(.system(size: 30, weight: .bold))
                        Text(version)
                            .font(.system(size: 15))
                            .foregroundStyle(.secondary)
                        Text("An offline, single-player tower-building simulation for the Mac.")
                            .font(.system(size: 15))
                            .foregroundStyle(.secondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    Spacer()
                }

                Divider()

                // Author — the star of the credits.
                section("The game & its author") {
                    para(
                        "The game you're playing — its simulation, its rules, its art — is the "
                            + "work of Patrick Hulin, who created the open-source engine "
                            + "“tower-together.” This is his game. Senzall's Tower is simply a "
                            + "package of that engine for the Mac.")
                    para(
                        "tower-together is a clean-room reimplementation released under the MIT "
                            + "license. It ships none of any original game's assets or code. Huge "
                            + "thanks to Patrick for building it and sharing it with the world.")
                    link("Patrick Hulin — tower-together on GitHub",
                         "https://github.com/phulin/tower-together")
                }

                // Inspiration.
                section("Inspired by a classic") {
                    para(
                        "The tower-building genre was defined by SimTower (“The Tower,” 1994), "
                            + "created by Yoot Saito and OPeNBook and published by Maxis, and its "
                            + "sequel Yoot Tower (1998). Thank you, Yoot Saito, for the games that "
                            + "inspired all of this — and for supporting their open-sourcing.")
                    para(
                        "Thanks also to Don Hopkins, who — working with Yoot Saito — leads the "
                            + "effort to open-source and preserve the original sources for archival "
                            + "and academic study.")
                    link("Don Hopkins", "https://github.com/SimHacker")
                    link("Yoot Tower preservation project",
                         "https://github.com/YootTowerManagement/YootTower")
                    para(
                        "Senzall's Tower is not affiliated with, endorsed by, or derived from the "
                            + "code or assets of those games. “SimTower” and “Yoot Tower” are "
                            + "trademarks of their respective owners.")
                }

                // What this fork adds.
                section("What this Mac edition adds") {
                    para(
                        "This fork wraps Patrick's engine in a native macOS app: it runs fully "
                            + "offline (no account, no server), with native menus, save/load, an "
                            + "app icon, Settings, a per-effect Sound menu, cheats, a VIP roster, "
                            + "an in-app guide, and Mac-native typography — signed and notarized by "
                            + "Apple.")
                }

                // Maker's note.
                section("A note from the maker") {
                    para(
                        "SimTower and Yoot Tower are among my favorite games of all time. I built "
                            + "this version for myself — to play my favorite game — and I wanted to "
                            + "share it with anyone who'd like to play it too. The credit for the "
                            + "game belongs to its author; I just packaged it for the Mac, working "
                            + "with Claude using modern AI tools.")
                }

                section("Offline & private") {
                    para("Runs entirely on your Mac — no account, no network, no tracking.")
                }
            }
            .padding(28)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .frame(width: 560, height: 660)
    }

    private func section(_ title: String, @ViewBuilder _ content: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title).font(.system(size: 17, weight: .semibold))
            content()
        }
    }

    private func para(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 15))
            .lineSpacing(3)
            .fixedSize(horizontal: false, vertical: true)
    }

    private func link(_ label: String, _ url: String) -> some View {
        Button(label) {
            if let u = URL(string: url) { NSWorkspace.shared.open(u) }
        }
        .buttonStyle(.link)
        .font(.system(size: 15))
    }
}

/// Presents the custom About window (creating it once, reusing it thereafter).
@MainActor
enum AboutWindow {
    private static var window: NSWindow?

    static func show() {
        NSApp.activate(ignoringOtherApps: true)
        if let existing = window {
            existing.makeKeyAndOrderFront(nil)
            return
        }
        let hosting = NSHostingController(rootView: AboutView())
        let win = NSWindow(contentViewController: hosting)
        win.title = "About Senzall's Tower"
        win.styleMask = [.titled, .closable]
        win.isReleasedWhenClosed = false
        win.center()
        window = win
        win.makeKeyAndOrderFront(nil)
    }
}
