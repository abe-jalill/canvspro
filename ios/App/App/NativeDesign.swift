import SwiftUI
import UIKit

enum CPPalette: String, CaseIterable, Identifiable {
    case forest, blue, violet, rose, neutral

    var id: String { rawValue }
    var name: String { rawValue.capitalized }
    var hue: Double {
        switch self { case .forest: 148; case .blue: 214; case .violet: 266; case .rose: 340; case .neutral: 210 }
    }
    var saturation: Double {
        switch self { case .forest: 0.34; case .blue: 0.58; case .violet: 0.48; case .rose: 0.45; case .neutral: 0.04 }
    }
    var swatch: Color {
        switch self {
        case .forest: Color(red: 120.0 / 255, green: 185.0 / 255, blue: 142.0 / 255)
        case .blue: Color(red: 118.0 / 255, green: 169.0 / 255, blue: 232.0 / 255)
        case .violet: Color(red: 179.0 / 255, green: 154.0 / 255, blue: 231.0 / 255)
        case .rose: Color(red: 220.0 / 255, green: 147.0 / 255, blue: 173.0 / 255)
        case .neutral: Color(red: 168.0 / 255, green: 170.0 / 255, blue: 167.0 / 255)
        }
    }
    var detail: String {
        switch self {
        case .forest: "A little breathing room."
        case .blue: "Clear skies, clear mind."
        case .violet: "Space for a new idea."
        case .rose: "A warmer kind of focus."
        case .neutral: "Just the essentials."
        }
    }
}

enum CPTheme {
    static var currentPalette: CPPalette { CPPalette(rawValue: UserDefaults.standard.string(forKey: "CanvasProPalette") ?? "forest") ?? .forest }
    static var accent: Color { primary(currentPalette, scheme: currentScheme) }
    static let warning = Color.hsl(43, 0.92, 0.55)
    static let danger = Color.hsl(0, 0.70, 0.60)

    private static var currentScheme: ColorScheme {
        let mode = UserDefaults.standard.string(forKey: "CanvasProColorScheme") ?? "system"
        if mode == "light" { return .light }
        if mode == "dark" { return .dark }
        return UITraitCollection.current.userInterfaceStyle == .dark ? .dark : .light
    }

    static func background(_ scheme: ColorScheme, palette: CPPalette = currentPalette) -> Color { .hsl(palette.hue, scheme == .dark ? 0.28 : 0.24, scheme == .dark ? 0.04 : 0.97) }
    static func foreground(_ scheme: ColorScheme, palette: CPPalette = currentPalette) -> Color { .hsl(palette.hue, scheme == .dark ? 0.10 : 0.26, scheme == .dark ? 0.97 : 0.12) }
    static func primary(_ palette: CPPalette = currentPalette, scheme: ColorScheme) -> Color { .hsl(palette.hue, palette.saturation, scheme == .dark ? 0.72 : 0.30) }
    static func muted(_ scheme: ColorScheme, palette: CPPalette = currentPalette) -> Color { .hsl(palette.hue, scheme == .dark ? 0.09 : 0.14, scheme == .dark ? 0.67 : 0.40) }
    static func glass(_ scheme: ColorScheme, strong: Bool = false, palette: CPPalette = currentPalette) -> Color { .hsl(palette.hue, scheme == .dark ? (strong ? 0.20 : 0.18) : 0.24, scheme == .dark ? (strong ? 0.14 : 0.16) : 0.94, opacity: scheme == .dark ? (strong ? 0.76 : 0.60) : (strong ? 0.84 : 0.70)) }
    static func border(_ scheme: ColorScheme, palette: CPPalette = currentPalette) -> Color { .hsl(palette.hue, scheme == .dark ? 0.18 : 0.28, scheme == .dark ? 0.88 : 0.18, opacity: 0.11) }
    static func inset(_ scheme: ColorScheme) -> Color { foreground(scheme).opacity(0.035) }
    static func insetBorder(_ scheme: ColorScheme) -> Color { foreground(scheme).opacity(scheme == .dark ? 0.06 : 0.07) }
}

extension Color {
    static func hsl(_ hue: Double, _ saturation: Double, _ lightness: Double, opacity: Double = 1) -> Color {
        let h = hue.truncatingRemainder(dividingBy: 360) / 60
        let c = (1 - abs(2 * lightness - 1)) * saturation
        let x = c * (1 - abs(h.truncatingRemainder(dividingBy: 2) - 1))
        let m = lightness - c / 2
        let rgb: (Double, Double, Double)
        switch h { case 0..<1: rgb = (c, x, 0); case 1..<2: rgb = (x, c, 0); case 2..<3: rgb = (0, c, x); case 3..<4: rgb = (0, x, c); case 4..<5: rgb = (x, 0, c); default: rgb = (c, 0, x) }
        return Color(.sRGB, red: rgb.0 + m, green: rgb.1 + m, blue: rgb.2 + m, opacity: opacity)
    }
}

struct CPBackdrop: View {
    @Environment(\.colorScheme) private var scheme
    var body: some View {
        ZStack {
            CPTheme.background(scheme)
            Circle().fill(CPTheme.primary(scheme: scheme).opacity(0.13)).frame(width: 520, height: 520).blur(radius: 100).offset(x: -180, y: -360)
            Circle().fill(CPTheme.primary(scheme: scheme).opacity(0.08)).frame(width: 440, height: 440).blur(radius: 110).offset(x: 210, y: -120)
        }.ignoresSafeArea()
    }
}

struct CPGlassCard<Content: View>: View {
    @Environment(\.colorScheme) private var scheme
    let title: String?; let subtitle: String?; let strong: Bool; let content: Content
    init(title: String? = nil, subtitle: String? = nil, strong: Bool = false, @ViewBuilder content: () -> Content) { self.title = title; self.subtitle = subtitle; self.strong = strong; self.content = content() }
    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            if title != nil || subtitle != nil { VStack(alignment: .leading, spacing: 2) { if let title { Text(title).font(.system(size: 18, weight: .regular)).tracking(-0.4).foregroundStyle(CPTheme.foreground(scheme)) }; if let subtitle { Text(subtitle).font(.system(size: 12)).foregroundStyle(CPTheme.muted(scheme)) } } }
            content
        }
        .padding(16).frame(maxWidth: .infinity, alignment: .leading)
        .background(CPTheme.glass(scheme, strong: strong), in: RoundedRectangle(cornerRadius: 32, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 32, style: .continuous).stroke(CPTheme.border(scheme), lineWidth: 1))
        .shadow(color: Color.black.opacity(scheme == .dark ? (strong ? 0.34 : 0.25) : 0.09), radius: strong ? 32 : 20, y: strong ? 18 : 10)
    }
}

struct CPInsetRow<Content: View>: View {
    @Environment(\.colorScheme) private var scheme
    let content: Content
    init(@ViewBuilder content: () -> Content) { self.content = content() }
    var body: some View { content.padding(12).frame(maxWidth: .infinity, alignment: .leading).background(CPTheme.inset(scheme), in: RoundedRectangle(cornerRadius: 20, style: .continuous)).overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).stroke(CPTheme.insetBorder(scheme), lineWidth: 1)) }
}

struct CPPageHeader: View {
    @Environment(\.colorScheme) private var scheme
    let eyebrow: String; let title: String; let detail: String?
    var body: some View { VStack(alignment: .leading, spacing: 8) { Text(eyebrow.uppercased()).font(.system(size: 12, weight: .medium)).tracking(2.2).foregroundStyle(CPTheme.muted(scheme)); Text(title).font(.system(size: 36, weight: .medium)).tracking(-1.6).foregroundStyle(CPTheme.foreground(scheme)); if let detail { Text(detail).font(.system(size: 14)).foregroundStyle(CPTheme.muted(scheme)).lineSpacing(3) } }.frame(maxWidth: .infinity, alignment: .leading) }
}

struct CPChip: View {
    @Environment(\.colorScheme) private var scheme
    let text: String; let selected: Bool
    var body: some View { Text(text).font(.system(size: 13, weight: selected ? .semibold : .medium)).padding(.horizontal, 14).frame(minHeight: 42).foregroundStyle(selected ? CPTheme.background(scheme) : CPTheme.foreground(scheme)).background(selected ? CPTheme.foreground(scheme) : CPTheme.inset(scheme), in: RoundedRectangle(cornerRadius: 12, style: .continuous)).overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).stroke(CPTheme.insetBorder(scheme), lineWidth: selected ? 0 : 1)) }
}

struct CPListScreenModifier: ViewModifier {
    func body(content: Content) -> some View { content.scrollContentBackground(.hidden).background(CPBackdrop()) }
}

extension View { func cpListScreen() -> some View { modifier(CPListScreenModifier()) } }
