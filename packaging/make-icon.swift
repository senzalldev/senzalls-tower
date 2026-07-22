import AppKit

// Renders an original Senzall's Tower app icon (a stylized skyscraper at dusk)
// to a 1024x1024 PNG. Original artwork — no third-party assets.

let size = 1024
let rep = NSBitmapImageRep(
    bitmapDataPlanes: nil, pixelsWide: size, pixelsHigh: size,
    bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false,
    colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!

NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
let ctx = NSGraphicsContext.current!.cgContext

let S = CGFloat(size)
func rgb(_ r: CGFloat, _ g: CGFloat, _ b: CGFloat) -> CGColor {
    CGColor(red: r/255, green: g/255, blue: b/255, alpha: 1)
}

// Rounded-rect (macOS squircle-ish) background with inset padding.
let inset: CGFloat = 96
let rect = CGRect(x: inset, y: inset, width: S - inset * 2, height: S - inset * 2)
let radius: CGFloat = (S - inset * 2) * 0.235
let bgPath = CGPath(roundedRect: rect, cornerWidth: radius, cornerHeight: radius, transform: nil)
ctx.saveGState()
ctx.addPath(bgPath)
ctx.clip()

// Sky gradient (dusk): deep indigo at top -> warm horizon.
let sky = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(),
    colors: [rgb(24, 33, 84), rgb(58, 78, 138), rgb(129, 150, 190), rgb(238, 174, 128)] as CFArray,
    locations: [0.0, 0.45, 0.72, 1.0])!
ctx.drawLinearGradient(sky, start: CGPoint(x: 0, y: S), end: CGPoint(x: 0, y: inset), options: [])

// Sun near the horizon.
ctx.setFillColor(rgb(255, 224, 168))
let sunR: CGFloat = 78
ctx.fillEllipse(in: CGRect(x: rect.maxX - 250, y: rect.minY + 230, width: sunR * 2, height: sunR * 2))

// Ground band.
ctx.setFillColor(rgb(43, 33, 28))
ctx.fill(CGRect(x: rect.minX, y: rect.minY, width: rect.width, height: 150))

// Tower: a central tall block with a setback top.
func building(x: CGFloat, w: CGFloat, top: CGFloat, color: CGColor) {
    ctx.setFillColor(color)
    ctx.fill(CGRect(x: x, y: rect.minY + 120, width: w, height: top - (rect.minY + 120)))
}
let cx = rect.midX
// Side buildings (silhouette depth).
building(x: cx - 300, w: 150, top: rect.minY + 470, color: rgb(30, 40, 74))
building(x: cx + 150, w: 150, top: rect.minY + 540, color: rgb(30, 40, 74))
// Main tower.
let towerW: CGFloat = 300
building(x: cx - towerW/2, w: towerW, top: rect.maxY - 210, color: rgb(46, 60, 104))
// Setback crown.
building(x: cx - 95, w: 190, top: rect.maxY - 90, color: rgb(56, 72, 122))
// Antenna.
ctx.setFillColor(rgb(56, 72, 122))
ctx.fill(CGRect(x: cx - 8, y: rect.maxY - 150, width: 16, height: 70))

// Lit windows on the main tower.
let winW: CGFloat = 34, winH: CGFloat = 40, gapX: CGFloat = 56, gapY: CGFloat = 66
let cols = 4
let startX = cx - towerW/2 + 34
var lit = 0
var row = 0
var y = rect.minY + 175
while y < rect.maxY - 250 {
    for c in 0..<cols {
        lit += 1
        let on = (lit * 7 + row * 3) % 5 != 0
        ctx.setFillColor(on ? rgb(255, 214, 120) : rgb(31, 42, 78))
        ctx.fill(CGRect(x: startX + CGFloat(c) * gapX, y: y, width: winW, height: winH))
    }
    y += gapY
    row += 1
}

ctx.restoreGState()

// Subtle top highlight for the glossy rounded look.
ctx.saveGState()
ctx.addPath(bgPath)
ctx.clip()
let gloss = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(),
    colors: [CGColor(red: 1, green: 1, blue: 1, alpha: 0.16), CGColor(red: 1, green: 1, blue: 1, alpha: 0)] as CFArray,
    locations: [0, 1])!
ctx.drawLinearGradient(gloss, start: CGPoint(x: 0, y: S), end: CGPoint(x: 0, y: S * 0.62), options: [])
ctx.restoreGState()

NSGraphicsContext.restoreGraphicsState()

let out = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : "icon-1024.png"
let png = rep.representation(using: .png, properties: [:])!
try! png.write(to: URL(fileURLWithPath: out))
print("wrote \(out)")
