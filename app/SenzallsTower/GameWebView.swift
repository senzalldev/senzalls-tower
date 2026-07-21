import SwiftUI
import WebKit

/// Hosts the offline engine bundle (Contents/Resources/engine/index.html) in a
/// WKWebView. Fully local: no network is used. The bridge (registered in
/// Task 7) exposes native save/load and menu actions to the page.
struct GameWebView: NSViewRepresentable {
    func makeCoordinator() -> Bridge {
        Bridge()
    }

    func makeNSView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.defaultWebpagePreferences.allowsContentJavaScript = true
        config.userContentController.add(context.coordinator, name: Bridge.messageName)

        let webView = WKWebView(frame: .zero, configuration: config)
        context.coordinator.webView = webView
        // Avoid a white flash before the page paints its sky.
        webView.setValue(false, forKey: "drawsBackground")
        webView.allowsMagnification = false

        loadEngine(into: webView)
        return webView
    }

    func updateNSView(_ nsView: WKWebView, context: Context) {}

    private func loadEngine(into webView: WKWebView) {
        guard let engineRoot = Bundle.main.resourceURL?.appendingPathComponent("engine", isDirectory: true) else {
            return
        }
        let index = engineRoot.appendingPathComponent("index.html")
        if FileManager.default.fileExists(atPath: index.path) {
            webView.loadFileURL(index, allowingReadAccessTo: engineRoot)
        } else {
            // Engine bundle not embedded yet (dev build). Show a helpful notice
            // rather than a blank window.
            webView.loadHTMLString(
                "<body style='background:#0b1021;color:#cdd6f4;font:16px -apple-system;display:flex;align-items:center;justify-content:center;height:100vh;margin:0'>"
                    + "<div style='text-align:center'>Senzall&rsquo;s Tower<br><small>engine bundle not embedded — run <code>make app</code></small></div></body>",
                baseURL: nil
            )
        }
    }
}
