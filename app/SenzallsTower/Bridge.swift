import WebKit

/// Bridges the native app and the web engine.
///
/// JS → native (via `window.webkit.messageHandlers.senzall.postMessage`):
///   { id, action: "save"|"autosave"|"load"|"list", slot?, state? }
/// native → JS reply: `window.senzall._resolve(id, payload)`
/// native → JS menu:  `window.senzall._menu("<action>")`
final class Bridge: NSObject, WKScriptMessageHandler {
    static let messageName = "senzall"

    weak var webView: WKWebView? {
        didSet { observeMenuActions() }
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
