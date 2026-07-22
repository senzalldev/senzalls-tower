import Foundation
import UniformTypeIdentifiers
import WebKit

/// Serves the embedded engine bundle over a custom `senzall://app/` origin.
///
/// Using a real origin (instead of file://) is required because the Vite build
/// emits `<script type="module" crossorigin>` and requests assets by absolute
/// path (`/rooms/*.svg`, `/sounds/*.webm`). Under file:// those hit null-origin
/// CORS failures and resolve against the filesystem root. A custom scheme gives
/// a proper same-origin context while staying entirely local (no network).
final class EngineSchemeHandler: NSObject, WKURLSchemeHandler {
    static let scheme = "senzall"
    static let host = "app"
    static var indexURL: URL { URL(string: "\(scheme)://\(host)/index.html")! }

    private let root: URL

    /// `root` is the directory that contains index.html (…/Resources/engine).
    init(root: URL) {
        self.root = root.standardizedFileURL
    }

    func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        guard let url = urlSchemeTask.request.url else {
            urlSchemeTask.didFailWithError(URLError(.badURL))
            return
        }

        // Map the request path onto a file inside the engine root. "/" → index.html.
        var path = url.path
        if path.isEmpty || path == "/" { path = "/index.html" }
        let relative = String(path.drop(while: { $0 == "/" }))
        let fileURL = root.appendingPathComponent(relative).standardizedFileURL

        // Prevent path traversal outside the bundle.
        guard fileURL.path.hasPrefix(root.path),
              let data = try? Data(contentsOf: fileURL) else {
            urlSchemeTask.didFailWithError(URLError(.fileDoesNotExist))
            return
        }

        // Use an HTTPURLResponse with a real Content-Type header so WebKit parses
        // HTML/JS/CSS correctly (a bare URLResponse with an inline charset makes
        // WebKit treat the document as plain text and skip script execution).
        let response = HTTPURLResponse(
            url: url,
            statusCode: 200,
            httpVersion: "HTTP/1.1",
            headerFields: [
                "Content-Type": Self.mimeType(for: fileURL.pathExtension),
                "Content-Length": String(data.count),
                "Cache-Control": "no-store",
            ]
        )!
        urlSchemeTask.didReceive(response)
        urlSchemeTask.didReceive(data)
        urlSchemeTask.didFinish()
    }

    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {}

    private static func mimeType(for ext: String) -> String {
        switch ext.lowercased() {
        case "html", "htm": return "text/html; charset=utf-8"
        case "js", "mjs": return "text/javascript; charset=utf-8"
        case "css": return "text/css; charset=utf-8"
        case "json": return "application/json; charset=utf-8"
        case "svg": return "image/svg+xml"
        case "png": return "image/png"
        case "jpg", "jpeg": return "image/jpeg"
        case "webp": return "image/webp"
        case "gif": return "image/gif"
        case "webm": return "audio/webm"
        case "mp3": return "audio/mpeg"
        case "wav": return "audio/wav"
        case "wasm": return "application/wasm"
        case "woff2": return "font/woff2"
        case "woff": return "font/woff"
        case "ttf": return "font/ttf"
        default:
            if let type = UTType(filenameExtension: ext)?.preferredMIMEType {
                return type
            }
            return "application/octet-stream"
        }
    }
}
