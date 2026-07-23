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
            observeDefaults()
        }
    }

    private var defaultsObserver: NSObjectProtocol?

    private func observeDefaults() {
        if let existing = defaultsObserver {
            NotificationCenter.default.removeObserver(existing)
        }
        defaultsObserver = NotificationCenter.default.addObserver(
            forName: UserDefaults.didChangeNotification, object: nil, queue: .main
        ) { [weak self] _ in
            self?.pushSoundConfig()
        }
    }

    /// Read the Sound-menu categories from UserDefaults and push to the web.
    func pushSoundConfig() {
        let d = UserDefaults.standard
        func on(_ k: String) -> Bool { d.object(forKey: k) == nil ? true : d.bool(forKey: k) }
        let services = on(SettingsKeys.sndServices)
        let config: [String: Any] = [
            "ambience": on(SettingsKeys.sndAmbience),
            "cash": on(SettingsKeys.sndCash),
            "families": [
                "transport": on(SettingsKeys.sndTransport),
                "crowd": on(SettingsKeys.sndCrowd),
                "office": on(SettingsKeys.sndOffice),
                "food": on(SettingsKeys.sndFood),
                "lodging": on(SettingsKeys.sndLodging),
                "retail": on(SettingsKeys.sndRetail),
                "medical": services,
                "housekeeping": services,
                "security": services,
                "parking": services,
            ],
        ]
        guard let data = try? JSONSerialization.data(withJSONObject: config),
              let json = String(data: data, encoding: .utf8) else { return }
        webView?.evaluateJavaScript(
            "window.senzall && window.senzall._sound && window.senzall._sound(\(json))")
    }

    // MARK: - Navigation diagnostics

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        pushSoundConfig()
        // ES modules execute after didFinish, so probe React mount a bit later.
        DispatchQueue.main.asyncAfter(deadline: .now() + 3.0) { [weak webView] in
            let probe = """
            (function () {
              var root = document.getElementById('root');
              var cs = document.querySelectorAll('canvas');
              var c = cs[0];
              var gl = null;
              try { gl = c && (c.getContext('webgl2') || c.getContext('webgl') || c.getContext('experimental-webgl')); } catch (e) {}
              return JSON.stringify({
                title: document.title,
                rootKids: root ? root.childElementCount : -1,
                bodyText: (document.body.innerText || '').slice(0, 200),
                canvasCount: cs.length,
                canvasSize: c ? (c.width + 'x' + c.height) : 'none',
                webgl: gl ? 'yes' : 'no',
                dpr: window.devicePixelRatio,
                win: window.innerWidth + 'x' + window.innerHeight,
                errors: (window.__senzallErrors || [])
              });
            })()
            """
            webView?.evaluateJavaScript(probe) { value, err in
                let out = (value as? String) ?? "eval-error: \(String(describing: err))"
                log.info("engine status: \(out, privacy: .public)")
                #if DEBUG
                try? out.write(
                    to: URL(fileURLWithPath: NSTemporaryDirectory()).appendingPathComponent("senzall-verify.txt"),
                    atomically: true, encoding: .utf8)
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
        case "showAbout":
            showAboutPanel()
            resolve(id, payload: "null")
        case "zoom":
            let delta = (body["delta"] as? Double) ?? 0
            let cur = (UserDefaults.standard.object(forKey: SettingsKeys.uiScale) as? Double) ?? 1.0
            let next = min(1.6, max(0.8, cur + delta))
            UserDefaults.standard.set(next, forKey: SettingsKeys.uiScale)
            webView?.pageZoom = CGFloat(next)
            resolve(id, payload: "null")
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
