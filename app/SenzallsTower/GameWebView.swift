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

        // Capture early JS errors so load failures are diagnosable.
        let errorCatcher = """
        window.__senzallErrors = [];
        window.addEventListener('error', function (e) {
          window.__senzallErrors.push((e.message || 'error') + ' @ ' + (e.filename||'') + ':' + (e.lineno||0));
        });
        window.addEventListener('unhandledrejection', function (e) {
          window.__senzallErrors.push('promise: ' + (e.reason && e.reason.message ? e.reason.message : e.reason));
        });
        """
        config.userContentController.addUserScript(
            WKUserScript(source: errorCatcher, injectionTime: .atDocumentStart, forMainFrameOnly: true)
        )

        let engineRoot = Bundle.main.resourceURL?.appendingPathComponent("engine", isDirectory: true)
        let hasEngine = engineRoot.map {
            FileManager.default.fileExists(atPath: $0.appendingPathComponent("index.html").path)
        } ?? false

        if let engineRoot, hasEngine {
            // Serve the bundle over a custom same-origin scheme (see
            // EngineSchemeHandler) so ES module scripts and absolute asset paths
            // work offline.
            config.setURLSchemeHandler(
                EngineSchemeHandler(root: engineRoot),
                forURLScheme: EngineSchemeHandler.scheme
            )
        }

        let webView = WKWebView(frame: .zero, configuration: config)
        context.coordinator.webView = webView
        // Avoid a white flash before the page paints its sky.
        webView.setValue(false, forKey: "drawsBackground")
        webView.allowsMagnification = false

        if hasEngine {
            webView.load(URLRequest(url: EngineSchemeHandler.indexURL))
        } else {
            // Engine bundle not embedded yet (dev build). Show a helpful notice
            // rather than a blank window.
            webView.loadHTMLString(
                "<body style='background:#0b1021;color:#cdd6f4;font:16px -apple-system;display:flex;align-items:center;justify-content:center;height:100vh;margin:0'>"
                    + "<div style='text-align:center'>Senzall&rsquo;s Tower<br><small>engine bundle not embedded — run <code>make app</code></small></div></body>",
                baseURL: nil
            )
        }
        return webView
    }

    func updateNSView(_ nsView: WKWebView, context: Context) {}
}
