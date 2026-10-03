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
    static func gradeColor(_ score: Double?) -> Color {
        guard let score, score.isFinite else { return .hsl(215, 0.15, 0.60) }
        let hue = (((min(93, max(63, score)) - 63) / 30) * 142).rounded()
        return .hsl(hue, 0.42, 0.58)
    }
    static var currentPalette: CPPalette { CPPalette(rawValue: UserDefaults.standard.string(forKey: "CanvasProPalette") ?? "forest") ?? .forest }
    static let warning = Color.hsl(43, 0.92, 0.55)
    static let danger = Color.hsl(0, 0.70, 0.60)

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
                // Soft gradients avoid large offscreen blur passes during navigation.
                RadialGradient(colors: [CPTheme.primary(scheme: scheme).opacity(0.07), .clear], center: .center, startRadius: 0, endRadius: 380)
                    .frame(width: 760, height: 760).offset(x: -160, y: -320)
                RadialGradient(colors: [CPTheme.primary(scheme: scheme).opacity(0.04), .clear], center: .center, startRadius: 0, endRadius: 330)
                    .frame(width: 660, height: 660).offset(x: 180, y: -80)
            }
            .frame(width: proxy.size.width, height: proxy.size.height)
            .clipped()
        }
        .ignoresSafeArea()
    }
}

struct CPGlassCard<Content: View>: View {
    @Environment(\.colorScheme) private var scheme
    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency
    @Environment(\.colorSchemeContrast) private var contrast
    @ScaledMetric(relativeTo: .headline) private var titleSize = 16.0
    @ScaledMetric(relativeTo: .caption) private var subtitleSize = 11.0
    let title: String?; let subtitle: String?; let strong: Bool; let content: Content
    init(title: String? = nil, subtitle: String? = nil, strong: Bool = false, @ViewBuilder content: () -> Content) { self.title = title; self.subtitle = subtitle; self.strong = strong; self.content = content() }
    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            if title != nil || subtitle != nil {
                VStack(alignment: .leading, spacing: 4) {
                    if let title {
                        Text(title).font(.system(size: titleSize, weight: .regular)).tracking(-0.3).foregroundStyle(CPTheme.foreground(scheme)).fixedSize(horizontal: false, vertical: true)
                    }
                    if let subtitle {
                        Text(subtitle).font(.system(size: subtitleSize, weight: .regular)).foregroundStyle(contrast == .increased ? CPTheme.foreground(scheme) : CPTheme.muted(scheme)).fixedSize(horizontal: false, vertical: true)
                    }
                }
            }
            content
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background {
            let shape = RoundedRectangle(cornerRadius: 22, style: .continuous)
            ZStack {
                shape.fill(CPTheme.background(scheme))
                shape.fill(CPTheme.glass(scheme, strong: strong))
                if !reduceTransparency {
                    shape.fill(LinearGradient(colors: [CPTheme.primary(scheme: scheme).opacity(strong ? 0.08 : 0.025), .clear], startPoint: .topLeading, endPoint: .bottomTrailing))
                }
            }
        }
        .overlay(
            RoundedRectangle(cornerRadius: 22, style: .continuous)
                .stroke(
                    LinearGradient(
                        colors: [
                            contrast == .increased ? CPTheme.foreground(scheme).opacity(0.45) : Color.white.opacity(scheme == .dark ? 0.12 : 0.45),
                            contrast == .increased ? CPTheme.foreground(scheme).opacity(0.30) : CPTheme.foreground(scheme).opacity(0.06)
                        ],
                        startPoint: .top,
                        endPoint: .bottom
                    ),
                    lineWidth: 1
                )
        )
        .shadow(
            color: Color.black.opacity(scheme == .dark ? (strong ? 0.22 : 0.12) : 0.045),
            radius: strong ? 18 : 10,
            y: strong ? 8 : 4
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
    @Environment(\.isEnabled) private var isEnabled

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(reduceMotion || !configuration.isPressed ? 1 : 0.985)
            .opacity(!isEnabled ? 0.45 : configuration.isPressed ? 0.88 : 1)
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
    var body: some View { VStack(alignment: .leading, spacing: 6) { Text(eyebrow.uppercased()).cpFont(10, .regular).tracking(1.6).foregroundStyle(CPTheme.muted(scheme)); Text(title).cpFont(28, .regular).tracking(-0.8).foregroundStyle(CPTheme.foreground(scheme)).fixedSize(horizontal: false, vertical: true); if let detail { Text(detail).cpFont(12, .regular).foregroundStyle(CPTheme.muted(scheme)).lineSpacing(2).fixedSize(horizontal: false, vertical: true) } }.frame(maxWidth: .infinity, alignment: .leading) }
}

struct CPChip: View {
    @Environment(\.colorScheme) private var scheme
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @ScaledMetric(relativeTo: .subheadline) private var textSize = 12.0
    let text: String; let selected: Bool
    var body: some View {
        Text(text)
            .font(.system(size: textSize, weight: .regular))
            .padding(.horizontal, 14).padding(.vertical, 10)
            .frame(minHeight: 44)
            .foregroundStyle(selected ? CPTheme.background(scheme) : CPTheme.foreground(scheme))
            .background(selected ? CPTheme.primary(scheme: scheme) : CPTheme.inset(scheme), in: RoundedRectangle(cornerRadius: 13, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 13, style: .continuous).stroke(CPTheme.insetBorder(scheme), lineWidth: selected ? 0 : 1))
            .contentShape(RoundedRectangle(cornerRadius: 13, style: .continuous))
            .animation(reduceMotion ? nil : .easeInOut(duration: 0.18), value: selected)
            .accessibilityAddTraits(selected ? .isSelected : [])
    }
}

struct CPIconBadge: View {
    @Environment(\.colorScheme) private var scheme
    let symbol: String
    var body: some View {
        Image(systemName: symbol)
            .cpFont(15, .regular)
            .foregroundStyle(CPTheme.primary(scheme: scheme))
            .frame(width: 34, height: 34)
            .background(CPTheme.primary(scheme: scheme).opacity(0.10), in: RoundedRectangle(cornerRadius: 11, style: .continuous))
            .accessibilityHidden(true)
    }
}

struct CPListScreenModifier: ViewModifier {
    @Environment(\.colorScheme) private var scheme
    func body(content: Content) -> some View { content.scrollContentBackground(.hidden).foregroundStyle(CPTheme.foreground(scheme)).tint(CPTheme.primary(scheme: scheme)).background(CPBackdrop()) }
}

private struct CPPageSurface: ViewModifier {
    @Environment(\.colorScheme) private var scheme

    func body(content: Content) -> some View {
        content
            .background(CPTheme.background(scheme).ignoresSafeArea())
            .presentationBackground(CPTheme.background(scheme))
    }
}

private struct CPStateChange<Value: Equatable>: ViewModifier {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    let value: Value

    func body(content: Content) -> some View {
        content.animation(reduceMotion ? nil : .easeInOut(duration: 0.2), value: value)
    }
}

/// System text at the design's point size, scaled with the reader's Text Size
/// setting. Nothing renders below 11 pt, Apple's smallest legible size.
private struct CPScaledFont: ViewModifier {
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    let size: CGFloat
    let weight: Font.Weight?
    let design: Font.Design?

    func body(content: Content) -> some View {
        let base = max(11, size)
        let style: UIFont.TextStyle = base >= 28 ? .largeTitle : base >= 20 ? .title2 : base >= 16 ? .headline : base >= 13 ? .body : .footnote
        let traits = UITraitCollection(preferredContentSizeCategory: UIContentSizeCategory(dynamicTypeSize))
        let scaled = UIFontMetrics(forTextStyle: style).scaledValue(for: base, compatibleWith: traits)
        return content.font(.system(size: scaled, weight: weight, design: design))
    }
}

/// Tints and backs the app with the palette, following the color scheme that is
/// actually showing, including the iPhone's own light/dark switch in System mode.
struct CPThemeModifier: ViewModifier {
    @Environment(\.colorScheme) private var scheme
    let palette: CPPalette

    func body(content: Content) -> some View {
        content
            .tint(CPTheme.primary(palette, scheme: scheme))
            .background(CPTheme.background(scheme, palette: palette).ignoresSafeArea())
    }
}

extension View {
    func cpListScreen() -> some View { modifier(CPListScreenModifier()) }

    /// Use instead of a fixed `.font(.system(size:))` so text follows Dynamic Type.
    func cpFont(_ size: CGFloat, _ weight: Font.Weight? = nil, design: Font.Design? = nil) -> some View {
        modifier(CPScaledFont(size: size, weight: weight, design: design))
    }

    // Keep NavigationStack's interactive push/pop and TabView's native selection.
    // A stable surface stays behind content during page and sheet transitions.
    func cpNavigationTitle<S: StringProtocol>(_ title: S) -> some View {
        modifier(CPPageSurface()).navigationTitle(String(title))
    }

    func cpStateChange<Value: Equatable>(_ value: Value) -> some View {
        modifier(CPStateChange(value: value))
    }
}
