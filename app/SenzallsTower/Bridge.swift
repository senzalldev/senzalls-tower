import OSLog
import WebKit

private let log = Logger(subsystem: "com.sparks.SenzallsTower", category: "engine")

/// Bridges the native app and the web engine.
///
/// JS → native (via `window.webkit.messageHandlers.senzall.postMessage`):
///   { id, action: "save"|"autosave"|"load"|"list", slot?, state? }
/// native → JS reply: `window.senzall._resolve(id, payload)`
/// native → JS menu:  `window.senzall._menu("<action>")`
final class Bridge: NSObject, WKScriptMessageHandler, WKNavigationDelegate {
    static let messageName = "senzall"

    weak var webView: WKWebView? {
        didSet {
            webView?.navigationDelegate = self
            observeMenuActions()
        }
    }

    // MARK: - Navigation diagnostics

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        // ES modules execute after didFinish, so probe React mount a bit later.
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.5) { [weak webView] in
            webView?.evaluateJavaScript(
                "document.title + '|' + (document.getElementById('root')?.childElementCount ?? 0)"
                    + " + '|' + ((window.__senzallErrors||[]).join(' ;; '))"
            ) { value, _ in
                log.info("engine status: \(String(describing: value), privacy: .public)")
                #if DEBUG
                if let s = value as? String {
                    try? s.write(
                        to: URL(fileURLWithPath: NSTemporaryDirectory()).appendingPathComponent("senzall-verify.txt"),
                        atomically: true, encoding: .utf8)
                }
                #endif
            }
        }
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        log.error("navigation failed: \(error.localizedDescription, privacy: .public)")
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        log.error("provisional navigation failed: \(error.localizedDescription, privacy: .public)")
    }

    private var menuObserver: NSObjectProtocol?

    private func observeMenuActions() {
        if let existing = menuObserver {
            NotificationCenter.default.removeObserver(existing)
        }
        menuObserver = NotificationCenter.default.addObserver(
            forName: .senzallMenuAction, object: nil, queue: .main
        ) { [weak self] note in
            if let action = note.object as? String {
                self?.sendMenuAction(action)
            }
        }
    }

    func userContentController(
        _ controller: WKUserContentController,
        didReceive message: WKScriptMessage
    ) {
        guard let body = message.body as? [String: Any],
              let action = body["action"] as? String,
              let id = body["id"] as? Int else { return }
        let slot = body["slot"] as? String ?? "autosave"

        switch action {
        case "save", "autosave":
            if let state = body["state"] as? String {
                try? SaveStore.save(slot: slot, state: state)
            }
            resolve(id, payload: "null")
        case "load":
            if let json = SaveStore.load(slot: slot) {
                resolve(id, payload: encodeJSONString(json))
            } else {
                resolve(id, payload: "null")
            }
        case "list":
            let data = (try? JSONSerialization.data(withJSONObject: SaveStore.list())) ?? Data("[]".utf8)
            resolve(id, payload: String(data: data, encoding: .utf8) ?? "[]")
        default:
            resolve(id, payload: "null")
        }
    }

    /// Forward a native menu action into the page.
    func sendMenuAction(_ action: String) {
        webView?.evaluateJavaScript(
            "window.senzall && window.senzall._menu && window.senzall._menu(\(encodeJSONString(action)))"
        )
    }

    private func resolve(_ id: Int, payload: String) {
        webView?.evaluateJavaScript(
            "window.senzall && window.senzall._resolve && window.senzall._resolve(\(id), \(payload))"
        )
    }

    /// Encode a Swift string as a safe JSON string literal for injection.
    private func encodeJSONString(_ value: String) -> String {
        let data = (try? JSONSerialization.data(withJSONObject: [value])) ?? Data("[\"\"]".utf8)
        let array = String(data: data, encoding: .utf8) ?? "[\"\"]"
        // Strip the surrounding [ ] to get the bare quoted string literal.
        return String(array.dropFirst().dropLast())
    }
}
