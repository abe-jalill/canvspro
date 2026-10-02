import SwiftUI
import UIKit

enum CPPalette: String, CaseIterable, Identifiable {
    case forest, blue, violet, rose

    var id: String { rawValue }
    var name: String { rawValue.capitalized }
    var hue: Double {
        switch self { case .forest: 152; case .blue: 214; case .violet: 266; case .rose: 340 }
    }
    var saturation: Double {
        switch self { case .forest: 0.45; case .blue: 0.58; case .violet: 0.48; case .rose: 0.45 }
    }
    var swatch: Color {
        switch self {
        case .forest: Color(red: 48.0 / 255, green: 209.0 / 255, blue: 88.0 / 255)
        case .blue: Color(red: 118.0 / 255, green: 169.0 / 255, blue: 232.0 / 255)
        case .violet: Color(red: 179.0 / 255, green: 154.0 / 255, blue: 231.0 / 255)
        case .rose: Color(red: 220.0 / 255, green: 147.0 / 255, blue: 173.0 / 255)
        }
    }
    var detail: String {
        switch self {
        case .forest: "A little breathing room."
        case .blue: "Clear skies, clear mind."
        case .violet: "Space for a new idea."
        case .rose: "A warmer kind of focus."
        }
    }
}

enum CPTheme {
    static var currentPalette: CPPalette { CPPalette(rawValue: UserDefaults.standard.string(forKey: "CanvasProPalette") ?? "forest") ?? .forest }
    static var accent: Color { primary(currentPalette, scheme: currentScheme) }
    static let warning = Color.hsl(43, 0.92, 0.55)
    static let danger = Color.hsl(0, 0.70, 0.60)

    private static var currentScheme: ColorScheme {
        let mode = UserDefaults.standard.string(forKey: "CanvasProColorScheme") ?? "dark"
        if mode == "light" { return .light }
        if mode == "dark" { return .dark }
        return UITraitCollection.current.userInterfaceStyle == .dark ? .dark : .light
    }

    static func background(_ scheme: ColorScheme, palette: CPPalette = currentPalette) -> Color {
        scheme == .dark ? .hsl(palette.hue, 0.38, 0.065) : .hsl(palette.hue, 0.15, 0.98)
    }
    static func foreground(_ scheme: ColorScheme, palette: CPPalette = currentPalette) -> Color {
        scheme == .dark ? .hsl(palette.hue, 0.02, 0.97) : .hsl(palette.hue, 0.20, 0.12)
    }
    static func primary(_ palette: CPPalette = currentPalette, scheme: ColorScheme) -> Color {
        .hsl(palette.hue, palette.saturation, scheme == .dark ? 0.65 : 0.35)
    }
    static func muted(_ scheme: ColorScheme, palette: CPPalette = currentPalette) -> Color {
        scheme == .dark ? .hsl(palette.hue, 0.03, 0.60) : .hsl(palette.hue, 0.10, 0.45)
    }
    static func glass(_ scheme: ColorScheme, strong: Bool = false, palette: CPPalette = currentPalette) -> Color {
        scheme == .dark
            ? Color.hsl(palette.hue, strong ? 0.30 : 0.24, strong ? 0.14 : 0.105).opacity(0.96)
            : Color.white.opacity(strong ? 0.90 : 0.75)
    }
    static func border(_ scheme: ColorScheme, palette: CPPalette = currentPalette) -> Color {
        scheme == .dark ? Color.white.opacity(0.08) : Color.black.opacity(0.08)
    }
    static func inset(_ scheme: ColorScheme) -> Color {
        scheme == .dark ? Color.white.opacity(0.045) : Color.black.opacity(0.035)
    }
    static func insetBorder(_ scheme: ColorScheme) -> Color {
        scheme == .dark ? Color.white.opacity(0.065) : Color.black.opacity(0.06)
    }
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
        GeometryReader { proxy in
            ZStack {
                CPTheme.background(scheme)
                Circle().fill(CPTheme.primary(scheme: scheme).opacity(0.05)).frame(width: 480, height: 480).blur(radius: 120).offset(x: -160, y: -320)
                Circle().fill(CPTheme.primary(scheme: scheme).opacity(0.03)).frame(width: 400, height: 400).blur(radius: 130).offset(x: 180, y: -80)
            }
            .frame(width: proxy.size.width, height: proxy.size.height)
            .clipped()
        }
        .ignoresSafeArea()
    }
}

struct CPGlassCard<Content: View>: View {
    @Environment(\.colorScheme) private var scheme
    let title: String?; let subtitle: String?; let strong: Bool; let content: Content
    init(title: String? = nil, subtitle: String? = nil, strong: Bool = false, @ViewBuilder content: () -> Content) { self.title = title; self.subtitle = subtitle; self.strong = strong; self.content = content() }
    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            if title != nil || subtitle != nil {
                VStack(alignment: .leading, spacing: 2) {
                    if let title {
                        Text(title).font(.system(size: 16, weight: .semibold)).tracking(-0.3).foregroundStyle(CPTheme.foreground(scheme))
                    }
                    if let subtitle {
                        Text(subtitle).font(.system(size: 11, weight: .regular)).foregroundStyle(CPTheme.muted(scheme))
                    }
                }
            }
            content
        }
        .padding(15)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background {
            RoundedRectangle(cornerRadius: 22, style: .continuous)
                .fill(CPTheme.glass(scheme, strong: strong))
        }
        .overlay(
            RoundedRectangle(cornerRadius: 22, style: .continuous)
                .stroke(
                    LinearGradient(
                        colors: [
                            Color.white.opacity(scheme == .dark ? 0.12 : 0.45),
                            Color.white.opacity(scheme == .dark ? 0.03 : 0.08)
                        ],
                        startPoint: .top,
                        endPoint: .bottom
                    ),
                    lineWidth: 1
                )
        )
        .shadow(
            color: Color.black.opacity(scheme == .dark ? (strong ? 0.35 : 0.22) : 0.06),
            radius: strong ? 24 : 14,
            y: strong ? 12 : 6
        )
    }
}

struct CPInsetRow<Content: View>: View {
    @Environment(\.colorScheme) private var scheme
    let content: Content
    init(@ViewBuilder content: () -> Content) { self.content = content() }
    var body: some View {
        content
            .padding(11)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(CPTheme.inset(scheme), in: RoundedRectangle(cornerRadius: 15, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 15, style: .continuous).stroke(CPTheme.insetBorder(scheme), lineWidth: 1))
    }
}

struct CPPressStyle: ButtonStyle {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(reduceMotion || !configuration.isPressed ? 1 : 0.985)
            .opacity(configuration.isPressed ? 0.82 : 1)
            .animation(reduceMotion ? nil : .easeOut(duration: 0.14), value: configuration.isPressed)
    }
}

struct CPSkeletonCard: View {
    @Environment(\.colorScheme) private var scheme
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var visible = false

    var body: some View {
        CPGlassCard {
            VStack(alignment: .leading, spacing: 13) {
                RoundedRectangle(cornerRadius: 5).frame(width: 124, height: 12)
                RoundedRectangle(cornerRadius: 5).frame(height: 18)
                RoundedRectangle(cornerRadius: 5).frame(maxWidth: 210).frame(height: 12)
            }
            .foregroundStyle(CPTheme.foreground(scheme).opacity(visible ? 0.13 : 0.07))
        }
        .accessibilityLabel("Loading")
        .onAppear {
            guard !reduceMotion else { return }
            withAnimation(.easeInOut(duration: 0.8).repeatForever(autoreverses: true)) { visible = true }
        }
        .onDisappear { visible = false }
    }
}

struct CPPageHeader: View {
    @Environment(\.colorScheme) private var scheme
    let eyebrow: String; let title: String; let detail: String?
    var body: some View { VStack(alignment: .leading, spacing: 6) { Text(eyebrow.uppercased()).font(.system(size: 10, weight: .regular)).tracking(1.6).foregroundStyle(CPTheme.muted(scheme)); Text(title).font(.system(size: 28, weight: .regular)).tracking(-0.8).foregroundStyle(CPTheme.foreground(scheme)).fixedSize(horizontal: false, vertical: true); if let detail { Text(detail).font(.system(size: 12, weight: .regular)).foregroundStyle(CPTheme.muted(scheme)).lineSpacing(2).fixedSize(horizontal: false, vertical: true) } }.frame(maxWidth: .infinity, alignment: .leading) }
}

struct CPChip: View {
    @Environment(\.colorScheme) private var scheme
    let text: String; let selected: Bool
    var body: some View { Text(text).font(.system(size: 12, weight: .regular)).padding(.horizontal, 12).frame(minHeight: 36).foregroundStyle(selected ? CPTheme.background(scheme) : CPTheme.foreground(scheme)).background(selected ? CPTheme.foreground(scheme) : CPTheme.inset(scheme), in: RoundedRectangle(cornerRadius: 10, style: .continuous)).overlay(RoundedRectangle(cornerRadius: 10, style: .continuous).stroke(CPTheme.insetBorder(scheme), lineWidth: selected ? 0 : 1)) }
}

struct CPListScreenModifier: ViewModifier {
    @Environment(\.colorScheme) private var scheme
    func body(content: Content) -> some View { content.scrollContentBackground(.hidden).foregroundStyle(CPTheme.foreground(scheme)).tint(CPTheme.primary(scheme: scheme)).background(CPBackdrop()) }
}

extension View { func cpListScreen() -> some View { modifier(CPListScreenModifier()) } }
