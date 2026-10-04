import SwiftUI
import UIKit

// MARK: - Palette

enum CPPalette: String, CaseIterable, Identifiable {
    case forest, blue, violet, rose

    var id: String { rawValue }
    var name: String { rawValue.capitalized }
    var hue: Double {
        switch self { case .forest: 148; case .blue: 214; case .violet: 266; case .rose: 340 }
    }
    /// The website's palette saturations (targeted-design.css).
    var saturation: Double {
        switch self { case .forest: 0.34; case .blue: 0.58; case .violet: 0.48; case .rose: 0.45 }
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

// MARK: - Colors
//
// The website's tokens: a near-black tinted background, translucent tinted
// glass cards with a hairline border, and monochrome controls. The palette color
// is used sparingly; deadlines stay monochrome and only overdue work is rose.

enum CPTheme {
    static func gradeColor(_ score: Double?) -> Color {
        guard let score, score.isFinite else { return adaptive(dark: .hsl(215, 0.15, 0.60), light: .hsl(215, 0.15, 0.45)) }
        let hue = (((min(93, max(63, score)) - 63) / 30) * 142).rounded()
        return adaptive(dark: .hsl(hue, 0.42, 0.58), light: .hsl(hue, 0.50, 0.38))
    }
    static var currentPalette: CPPalette { CPPalette(rawValue: UserDefaults.standard.string(forKey: "CanvasProPalette") ?? "forest") ?? .forest }
    /// Soft amber, for "needs a look" states.
    static let warning = adaptive(dark: .hsl(43, 0.92, 0.62), light: .hsl(34, 0.80, 0.40))
    /// Rose (the website's rose-400), for overdue or destructive states.
    static let danger = adaptive(dark: .hsl(351, 0.95, 0.71), light: .hsl(347, 0.77, 0.50))

    static func background(_ scheme: ColorScheme, palette: CPPalette = currentPalette) -> Color {
        scheme == .dark ? .hsl(palette.hue, 0.28, 0.04) : .hsl(palette.hue, 0.24, 0.97)
    }
    /// Card surface: the website's --glass over the background.
    static func surface(_ scheme: ColorScheme, palette: CPPalette = currentPalette) -> Color {
        glass(scheme, palette: palette)
    }
    static func foreground(_ scheme: ColorScheme, palette: CPPalette = currentPalette) -> Color {
        scheme == .dark ? .hsl(palette.hue, 0.10, 0.97) : .hsl(palette.hue, 0.26, 0.12)
    }
    static func primary(_ palette: CPPalette = currentPalette, scheme: ColorScheme) -> Color {
        .hsl(palette.hue, palette.saturation, scheme == .dark ? 0.72 : 0.30)
    }
    /// Text and icons drawn on top of `primary`.
    static func onPrimary(_ scheme: ColorScheme, palette: CPPalette = currentPalette) -> Color {
        scheme == .dark ? .hsl(palette.hue, 0.28, 0.08) : .white
    }
    static func muted(_ scheme: ColorScheme, palette: CPPalette = currentPalette) -> Color {
        scheme == .dark ? .hsl(palette.hue, 0.09, 0.67) : .hsl(palette.hue, 0.14, 0.40)
    }
    /// Third-level text: timestamps, counts, hints.
    static func faint(_ scheme: ColorScheme, palette: CPPalette = currentPalette) -> Color {
        scheme == .dark ? .hsl(palette.hue, 0.07, 0.50) : .hsl(palette.hue, 0.10, 0.56)
    }
    static func glass(_ scheme: ColorScheme, strong: Bool = false, palette: CPPalette = currentPalette) -> Color {
        scheme == .dark
            ? .hsl(palette.hue, strong ? 0.21 : 0.20, strong ? 0.116 : 0.112)
            : .hsl(palette.hue, 0.24, strong ? 0.945 : 0.95)
    }
    static func border(_ scheme: ColorScheme, palette: CPPalette = currentPalette) -> Color {
        scheme == .dark ? .hsl(palette.hue, 0.18, 0.88, opacity: 0.11) : .hsl(palette.hue, 0.28, 0.18, opacity: 0.11)
    }
    static func inset(_ scheme: ColorScheme) -> Color {
        scheme == .dark ? Color.white.opacity(0.035) : Color.hsl(216, 0.30, 0.20, opacity: 0.035)
    }
    static func insetBorder(_ scheme: ColorScheme) -> Color {
        scheme == .dark ? Color.white.opacity(0.06) : Color.hsl(216, 0.30, 0.20, opacity: 0.07)
    }

    static func adaptive(dark: Color, light: Color) -> Color {
        Color(UIColor { traits in traits.userInterfaceStyle == .dark ? UIColor(dark) : UIColor(light) })
    }

    /// The website keeps deadlines monochrome; only overdue work gets a soft tint.
    static func urgency(_ urgency: String, scheme: ColorScheme) -> Color {
        switch urgency {
        case "overdue": return danger
        case "today", "soon": return foreground(scheme)
        default: return muted(scheme)
        }
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

// MARK: - Layout constants

/// One spacing system for every screen. Cards are 16 apart with 16 inside;
/// rows inside a card are 8 apart.
enum CPLayout {
    /// Side margin of every screen.
    static let gutter: CGFloat = 16
    /// Space between cards.
    static let stack: CGFloat = 16
    static let cardRadius: CGFloat = 26
    static let cardPadding: CGFloat = 16
    static let innerRadius: CGFloat = 16
    /// Space between rows inside a card.
    static let rowGap: CGFloat = 8
}

// MARK: - Backdrop and surfaces

/// The website's page background: the tinted base with two soft glows at the top.
struct CPBackdrop: View {
    @Environment(\.colorScheme) private var scheme
    @Environment(\.cpPalette) private var paletteDependency
    var body: some View {
        GeometryReader { proxy in
            ZStack(alignment: .top) {
                CPTheme.background(scheme)
                RadialGradient(colors: [CPTheme.primary(scheme: scheme).opacity(0.13), .clear], center: .center, startRadius: 0, endRadius: 360)
                    .frame(width: 720, height: 560)
                    .offset(x: -proxy.size.width * 0.32, y: -260)
                RadialGradient(colors: [CPTheme.primary(scheme: scheme).opacity(0.08), .clear], center: .center, startRadius: 0, endRadius: 300)
                    .frame(width: 600, height: 480)
                    .offset(x: proxy.size.width * 0.35, y: -180)
            }
            .frame(width: proxy.size.width, height: proxy.size.height)
            .clipped()
        }
        .ignoresSafeArea()
    }
}

private struct CPSurfaceModifier: ViewModifier {
    @Environment(\.colorScheme) private var scheme
    @Environment(\.cpPalette) private var paletteDependency
    @Environment(\.colorSchemeContrast) private var contrast
    let strong: Bool
    let radius: CGFloat

    // No shadow: on the dark background it is invisible but still costs an
    // offscreen render pass per card while scrolling. The hairline border and
    // the glass fill separate cards, as on the website.
    func body(content: Content) -> some View {
        let shape = RoundedRectangle(cornerRadius: radius, style: .continuous)
        return content
            .background(shape.fill(CPTheme.glass(scheme, strong: strong)))
            .overlay(shape.strokeBorder(contrast == .increased ? CPTheme.foreground(scheme).opacity(0.35) : CPTheme.border(scheme), lineWidth: 0.5))
    }
}

/// The one card used across the app (the website's GlassCard).
struct CPGlassCard<Content: View>: View {
    @Environment(\.colorScheme) private var scheme
    @Environment(\.cpPalette) private var paletteDependency
    let title: String?; let subtitle: String?; let strong: Bool; let content: Content
    init(title: String? = nil, subtitle: String? = nil, strong: Bool = false, @ViewBuilder content: () -> Content) { self.title = title; self.subtitle = subtitle; self.strong = strong; self.content = content() }
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            if let title {
                CPCardHeader(title: title, subtitle: subtitle)
            } else if let subtitle {
                Text(subtitle).cpFont(12).foregroundStyle(CPTheme.muted(scheme)).fixedSize(horizontal: false, vertical: true)
            }
            content
        }
        .padding(CPLayout.cardPadding)
        .frame(maxWidth: .infinity, alignment: .leading)
        .cpSurface(strong: strong)
    }
}

/// Card title, optional one-line explanation, and an optional action on the right.
struct CPCardHeader<Trailing: View>: View {
    @Environment(\.colorScheme) private var scheme
    @Environment(\.cpPalette) private var paletteDependency
    let title: String
    let subtitle: String?
    let trailing: Trailing

    init(title: String, subtitle: String? = nil, @ViewBuilder trailing: () -> Trailing) {
        self.title = title; self.subtitle = subtitle; self.trailing = trailing()
    }

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                Text(title).cpFont(16, .regular).tracking(-0.3).foregroundStyle(CPTheme.foreground(scheme)).fixedSize(horizontal: false, vertical: true)
                if let subtitle {
                    Text(subtitle).cpFont(12).foregroundStyle(CPTheme.muted(scheme)).fixedSize(horizontal: false, vertical: true)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .accessibilityElement(children: .combine)
            .accessibilityAddTraits(.isHeader)
            trailing
        }
    }
}

extension CPCardHeader where Trailing == EmptyView {
    init(title: String, subtitle: String? = nil) { self.init(title: title, subtitle: subtitle) { EmptyView() } }
}

/// The quiet "View all" text action used on cards, as on the website.
struct CPLinkLabel: View {
    @Environment(\.colorScheme) private var scheme
    @Environment(\.cpPalette) private var paletteDependency
    let text: String
    var symbol: String? = nil
    var body: some View {
        HStack(spacing: 4) {
            Text(text)
            if let symbol { Image(systemName: symbol).cpIconFont(9, .medium) }
        }
        .cpFont(12)
        .foregroundStyle(CPTheme.muted(scheme))
        .padding(.horizontal, 10)
        .frame(height: 28)
        .background(CPTheme.inset(scheme), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
        // A 44-point target without changing the label's size.
        .padding(.vertical, 8).contentShape(Rectangle()).padding(.vertical, -8)
    }
}

/// A quiet title above a group of rows, like the website's agenda headings.
struct CPSectionLabel<Trailing: View>: View {
    @Environment(\.colorScheme) private var scheme
    @Environment(\.cpPalette) private var paletteDependency
    let title: String
    let count: Int?
    let trailing: Trailing

    init(_ title: String, count: Int? = nil, @ViewBuilder trailing: () -> Trailing) {
        self.title = title; self.count = count; self.trailing = trailing()
    }

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 8) {
            Text(title).cpFont(13).foregroundStyle(CPTheme.muted(scheme))
            if let count { Text("\(count)").cpFont(13).monospacedDigit().foregroundStyle(CPTheme.muted(scheme).opacity(0.7)) }
            Spacer(minLength: 8)
            trailing
        }
        .padding(.horizontal, 4)
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isHeader)
    }
}

extension CPSectionLabel where Trailing == EmptyView {
    init(_ title: String, count: Int? = nil) { self.init(title, count: count) { EmptyView() } }
}

/// A hairline between rows in a card.
struct CPRowDivider: View {
    @Environment(\.colorScheme) private var scheme
    @Environment(\.cpPalette) private var paletteDependency
    @Environment(\.displayScale) private var displayScale
    var leading: CGFloat = 0
    var body: some View {
        Rectangle().fill(CPTheme.border(scheme)).frame(height: 1 / max(1, displayScale)).padding(.leading, leading)
    }
}

/// A soft tile inside a card (the website's glass-inset rows).
struct CPInsetRow<Content: View>: View {
    @Environment(\.colorScheme) private var scheme
    @Environment(\.cpPalette) private var paletteDependency
    let content: Content
    init(@ViewBuilder content: () -> Content) { self.content = content() }
    var body: some View {
        content
            .padding(12)
            .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
            .background(CPTheme.inset(scheme), in: RoundedRectangle(cornerRadius: CPLayout.innerRadius, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: CPLayout.innerRadius, style: .continuous).strokeBorder(CPTheme.insetBorder(scheme), lineWidth: 0.5))
    }
}

enum CPTone { case neutral, accent, warning, danger }

private extension CPTone {
    /// Monochrome like the website: "accent" is the foreground, not a color.
    func color(_ scheme: ColorScheme) -> Color {
        switch self {
        case .neutral: CPTheme.muted(scheme)
        case .accent: CPTheme.foreground(scheme)
        case .warning: CPTheme.warning
        case .danger: CPTheme.danger
        }
    }
}

/// A number with a label, used in every page's summary.
struct CPStatTile: View {
    @Environment(\.colorScheme) private var scheme
    @Environment(\.cpPalette) private var paletteDependency
    let value: String
    let label: String
    var symbol: String? = nil
    var tone: CPTone = .neutral
    var large = false

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            if let symbol {
                Image(systemName: symbol).cpIconFont(12).foregroundStyle(tone == .danger ? CPTheme.danger : CPTheme.muted(scheme)).padding(.bottom, 4).accessibilityHidden(true)
            }
            Text(value)
                .cpFont(large ? 30 : 22, .regular)
                .tracking(-1)
                .monospacedDigit()
                .lineLimit(1)
                .minimumScaleFactor(0.6)
                .foregroundStyle(tone == .danger ? CPTheme.danger : CPTheme.foreground(scheme))
            Text(label)
                .cpFont(11)
                .foregroundStyle(CPTheme.muted(scheme))
                .lineLimit(2)
                .minimumScaleFactor(0.85)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(tone == .danger ? CPTheme.danger.opacity(0.06) : CPTheme.inset(scheme), in: RoundedRectangle(cornerRadius: CPLayout.innerRadius, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: CPLayout.innerRadius, style: .continuous).strokeBorder(tone == .danger ? CPTheme.danger.opacity(0.2) : CPTheme.insetBorder(scheme), lineWidth: 0.5))
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(label): \(value)")
    }
}

/// A small status tag, such as "Due today" or "Missing".
struct CPPill: View {
    @Environment(\.colorScheme) private var scheme
    @Environment(\.cpPalette) private var paletteDependency
    let text: String
    var tone: CPTone = .neutral
    var symbol: String? = nil
    var body: some View {
        HStack(spacing: 4) {
            if let symbol { Image(systemName: symbol).cpIconFont(9, .medium) }
            Text(text).lineLimit(1)
        }
        .cpFont(11)
        .foregroundStyle(tone.color(scheme))
        .padding(.horizontal, 8)
        .frame(minHeight: 22)
        .overlay(RoundedRectangle(cornerRadius: 8, style: .continuous).strokeBorder(tone == .danger ? CPTheme.danger.opacity(0.35) : CPTheme.foreground(scheme).opacity(0.15), lineWidth: 0.5))
    }
}

/// A thin progress bar.
struct CPProgressBar: View {
    @Environment(\.colorScheme) private var scheme
    @Environment(\.cpPalette) private var paletteDependency
    let value: Double
    var color: Color? = nil
    var height: CGFloat = 4
    var body: some View {
        GeometryReader { proxy in
            ZStack(alignment: .leading) {
                Capsule().fill(CPTheme.foreground(scheme).opacity(0.08))
                Capsule().fill(color ?? CPTheme.foreground(scheme))
                    .frame(width: max(height, proxy.size.width * min(1, max(0, value))))
                    .opacity(value > 0 ? 1 : 0)
            }
        }
        .frame(height: height)
        .accessibilityHidden(true)
    }
}

/// A circular progress ring with content in the middle.
struct CPRing<Content: View>: View {
    @Environment(\.colorScheme) private var scheme
    @Environment(\.cpPalette) private var paletteDependency
    let progress: Double
    var color: Color? = nil
    var lineWidth: CGFloat = 5
    let content: Content

    init(progress: Double, color: Color? = nil, lineWidth: CGFloat = 5, @ViewBuilder content: () -> Content) {
        self.progress = progress; self.color = color; self.lineWidth = lineWidth; self.content = content()
    }

    var body: some View {
        ZStack {
            Circle().stroke(CPTheme.foreground(scheme).opacity(0.08), lineWidth: lineWidth)
            Circle()
                .trim(from: 0, to: min(1, max(0, progress)))
                .stroke(color ?? CPTheme.primary(scheme: scheme), style: StrokeStyle(lineWidth: lineWidth, lineCap: .round))
                .rotationEffect(.degrees(-90))
            content
        }
    }
}

// MARK: - Buttons

struct CPPressStyle: ButtonStyle {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.isEnabled) private var isEnabled

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(reduceMotion || !configuration.isPressed ? 1 : 0.985)
            .opacity(!isEnabled ? 0.45 : configuration.isPressed ? 0.85 : 1)
            .animation(reduceMotion ? nil : .easeOut(duration: 0.14), value: configuration.isPressed)
    }
}

/// The website's buttons: primary is inverted (light on dark), secondary is a
/// soft inset tile, quiet is outlined. All 40 pt tall.
struct CPButtonStyle: ButtonStyle {
    enum Kind { case primary, secondary, quiet }
    var kind: Kind = .primary
    var fullWidth = false

    func makeBody(configuration: Configuration) -> some View {
        CPButtonBody(configuration: configuration, kind: kind, fullWidth: fullWidth)
    }
}

private struct CPButtonBody: View {
    @Environment(\.colorScheme) private var scheme
    @Environment(\.cpPalette) private var paletteDependency
    @Environment(\.isEnabled) private var isEnabled
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    let configuration: ButtonStyleConfiguration
    let kind: CPButtonStyle.Kind
    let fullWidth: Bool

    var body: some View {
        let shape = RoundedRectangle(cornerRadius: 14, style: .continuous)
        configuration.label
            .cpFont(13, .medium)
            .lineLimit(1)
            .padding(.horizontal, 16)
            .frame(maxWidth: fullWidth ? .infinity : nil, minHeight: 40)
            .foregroundStyle(kind == .primary ? CPTheme.background(scheme) : CPTheme.foreground(scheme))
            .background(kind == .primary ? CPTheme.foreground(scheme) : kind == .secondary ? CPTheme.inset(scheme) : Color.clear, in: shape)
            .overlay(shape.strokeBorder(kind == .primary ? Color.clear : kind == .secondary ? CPTheme.insetBorder(scheme) : CPTheme.foreground(scheme).opacity(0.15), lineWidth: 0.5))
            .contentShape(shape)
            .opacity(!isEnabled ? 0.4 : configuration.isPressed ? 0.85 : 1)
            .scaleEffect(reduceMotion || !configuration.isPressed ? 1 : 0.98)
            .animation(reduceMotion ? nil : .easeOut(duration: 0.14), value: configuration.isPressed)
    }
}

/// A 30-point outlined icon button with a 44-point target.
struct CPIconButtonLabel: View {
    @Environment(\.colorScheme) private var scheme
    @Environment(\.cpPalette) private var paletteDependency
    let symbol: String
    var body: some View {
        Image(systemName: symbol)
            .cpIconFont(12, .medium)
            .foregroundStyle(CPTheme.muted(scheme))
            .frame(width: 30, height: 30)
            .overlay(RoundedRectangle(cornerRadius: 9, style: .continuous).strokeBorder(CPTheme.foreground(scheme).opacity(0.15), lineWidth: 0.5))
            .frame(width: 44, height: 44)
            .contentShape(Rectangle())
    }
}

// MARK: - Loading, headers, tabs, chips

struct CPSkeletonCard: View {
    @Environment(\.colorScheme) private var scheme
    @Environment(\.cpPalette) private var paletteDependency
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var visible = false

    var body: some View {
        CPGlassCard {
            VStack(alignment: .leading, spacing: 12) {
                RoundedRectangle(cornerRadius: 6).frame(width: 120, height: 12)
                RoundedRectangle(cornerRadius: 10).frame(height: 44)
                RoundedRectangle(cornerRadius: 10).frame(height: 44)
            }
            .foregroundStyle(CPTheme.foreground(scheme).opacity(visible ? 0.08 : 0.04))
        }
        .accessibilityLabel("Loading")
        .onAppear {
            guard !reduceMotion else { return }
            withAnimation(.easeInOut(duration: 0.9).repeatForever(autoreverses: true)) { visible = true }
        }
        .onDisappear { visible = false }
    }
}

struct CPPageHeader: View {
    @Environment(\.colorScheme) private var scheme
    @Environment(\.cpPalette) private var paletteDependency
    let eyebrow: String; let title: String; let detail: String?
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(eyebrow.uppercased()).cpFont(11, .medium).tracking(2).foregroundStyle(CPTheme.muted(scheme))
            Text(title).cpFont(28, .regular).tracking(-1).foregroundStyle(CPTheme.foreground(scheme)).fixedSize(horizontal: false, vertical: true)
            if let detail { Text(detail).cpFont(13).foregroundStyle(CPTheme.muted(scheme)).lineSpacing(3).fixedSize(horizontal: false, vertical: true) }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 4)
        .accessibilityElement(children: .combine)
    }
}

/// The website's PageTabs: centered, outlined tabs for pages that share one
/// sidebar entry. The selected tab gets a stronger outline and full-strength text.
struct NativePageTabs: View {
    @Environment(\.colorScheme) private var scheme
    @Environment(\.cpPalette) private var paletteDependency
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Binding var selection: String
    let options: [String]
    let label: String

    var body: some View {
        HStack(spacing: 8) {
            ForEach(options, id: \.self) { option in
                let isSelected = selection == option
                Button { selection = option } label: {
                    Text(option)
                        .cpFont(13)
                        .lineLimit(1)
                        .foregroundStyle(isSelected ? CPTheme.foreground(scheme) : CPTheme.muted(scheme))
                        .padding(.horizontal, 14)
                        .frame(height: 32)
                        .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).strokeBorder(CPTheme.foreground(scheme).opacity(isSelected ? 0.6 : 0.15), lineWidth: 0.5))
                        .padding(.vertical, 6).contentShape(Rectangle()).padding(.vertical, -6)
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(isSelected ? .isSelected : [])
            }
        }
        .frame(maxWidth: .infinity)
        .animation(reduceMotion ? nil : .easeOut(duration: 0.3), value: selection)
        .accessibilityElement(children: .contain)
        .accessibilityLabel(label)
        .dynamicTypeSize(...DynamicTypeSize.xxLarge)
    }
}

/// Range and filter choices, outlined like the website's tabs.
struct CPChip: View {
    @Environment(\.colorScheme) private var scheme
    @Environment(\.cpPalette) private var paletteDependency
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    let text: String; let selected: Bool
    var body: some View {
        Text(text)
            .cpFont(12)
            .lineLimit(1)
            .padding(.horizontal, 12)
            .frame(height: 30)
            .foregroundStyle(selected ? CPTheme.foreground(scheme) : CPTheme.muted(scheme))
            .overlay(RoundedRectangle(cornerRadius: 10, style: .continuous).strokeBorder(CPTheme.foreground(scheme).opacity(selected ? 0.6 : 0.15), lineWidth: 0.5))
            .frame(minHeight: 44)
            .contentShape(Rectangle())
            .animation(reduceMotion ? nil : .easeInOut(duration: 0.18), value: selected)
            .accessibilityAddTraits(selected ? .isSelected : [])
    }
}

/// A square icon tile. Monochrome unless a tint is given.
struct CPIconBadge: View {
    @Environment(\.colorScheme) private var scheme
    @Environment(\.cpPalette) private var paletteDependency
    let symbol: String
    var tint: Color? = nil
    var body: some View {
        Image(systemName: symbol)
            .cpIconFont(13)
            .foregroundStyle(tint ?? CPTheme.foreground(scheme).opacity(0.8))
            .frame(width: 32, height: 32)
            .background(tint.map { $0.opacity(0.12) } ?? CPTheme.inset(scheme), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 10, style: .continuous).strokeBorder(tint == nil ? CPTheme.insetBorder(scheme) : Color.clear, lineWidth: 0.5))
            .accessibilityHidden(true)
    }
}

/// The website's Segmented control: a glass track whose selected option is
/// inverted (light on dark).
struct CPSegmented: View {
    @Environment(\.colorScheme) private var scheme
    @Environment(\.cpPalette) private var paletteDependency
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Namespace private var selectionAnimation
    @Binding var selection: String
    let options: [String]
    let label: String

    var body: some View {
        HStack(spacing: 4) {
            ForEach(options, id: \.self) { option in
                let isSelected = selection == option
                Button {
                    selection = option
                } label: {
                    Text(option)
                        .cpFont(12, .medium)
                        .lineLimit(1)
                        .minimumScaleFactor(0.8)
                        .foregroundStyle(isSelected ? CPTheme.background(scheme) : CPTheme.muted(scheme))
                        .frame(maxWidth: .infinity, minHeight: 32)
                        .background {
                            if isSelected {
                                RoundedRectangle(cornerRadius: 11, style: .continuous)
                                    .fill(CPTheme.foreground(scheme))
                                    .matchedGeometryEffect(id: "selected-segment", in: selectionAnimation)
                            }
                        }
                        .padding(.vertical, 6).contentShape(Rectangle()).padding(.vertical, -6)
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(isSelected ? .isSelected : [])
            }
        }
        .padding(5)
        .background(CPTheme.glass(scheme, strong: true), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(CPTheme.border(scheme), lineWidth: 0.5))
        .animation(reduceMotion ? nil : .spring(duration: 0.26, bounce: 0), value: selection)
        .accessibilityElement(children: .contain)
        .accessibilityLabel(label)
        .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
    }
}

// MARK: - Screen modifiers

struct CPListScreenModifier: ViewModifier {
    @Environment(\.colorScheme) private var scheme
    @Environment(\.cpPalette) private var paletteDependency
    func body(content: Content) -> some View {
        content
            .cpFont(13)
            .environment(\.defaultMinListRowHeight, 44)
            .listSectionSpacing(.compact)
            .scrollContentBackground(.hidden)
            .foregroundStyle(CPTheme.foreground(scheme))
            .tint(CPTheme.primary(scheme: scheme))
            .background(CPBackdrop())
    }
}

private struct CPPageSurface: ViewModifier {
    @Environment(\.colorScheme) private var scheme
    @Environment(\.cpPalette) private var paletteDependency

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
/// setting. No text renders below 11 pt, Apple's smallest legible size, and every
/// size grows with Dynamic Type. SF Symbols may be smaller, since they are not
/// text. Weights follow the website, which sets most text near regular: bold
/// and semibold are drawn one step lighter.
private struct CPScaledFont: ViewModifier {
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    let size: CGFloat
    let weight: Font.Weight?
    let design: Font.Design?
    var isIcon = false

    func body(content: Content) -> some View {
        let base = isIcon ? max(7, size) : max(11, size)
        let style: UIFont.TextStyle = base >= 28 ? .largeTitle : base >= 20 ? .title2 : base >= 16 ? .headline : base >= 13 ? .subheadline : base >= 11 ? .footnote : base >= 10 ? .caption1 : .caption2
        let traits = UITraitCollection(preferredContentSizeCategory: UIContentSizeCategory(dynamicTypeSize))
        let scaled = UIFontMetrics(forTextStyle: style).scaledValue(for: base, compatibleWith: traits)
        let drawn: Font.Weight? = isIcon ? weight : weight == .bold ? .semibold : weight == .semibold ? .medium : weight
        return content.font(.system(size: scaled, weight: drawn, design: design))
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

    /// Like cpFont, for SF Symbols. Icons can sit below the 11 pt text floor.
    func cpIconFont(_ size: CGFloat, _ weight: Font.Weight? = nil) -> some View {
        modifier(CPScaledFont(size: size, weight: weight, design: nil, isIcon: true))
    }

    /// The card surface: tinted glass, hairline border and a soft shadow.
    func cpSurface(strong: Bool = false, radius: CGFloat = CPLayout.cardRadius) -> some View {
        modifier(CPSurfaceModifier(strong: strong, radius: radius))
    }

    /// Standard page padding: 16-point side margins and room above the tab bar.
    func cpPagePadding() -> some View {
        padding(.horizontal, CPLayout.gutter).padding(.top, 12).padding(.bottom, 32)
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

/// The color theme name. CPTheme reads the saved theme directly, so every view
/// that draws with it declares this value too; when the theme arrives from the
/// account (or changes in Settings), all of them redraw in the new colors
/// together instead of leaving some parts in the old ones.
private struct CPPaletteKey: EnvironmentKey {
    static let defaultValue = "forest"
}

extension EnvironmentValues {
    var cpPalette: String {
        get { self[CPPaletteKey.self] }
        set { self[CPPaletteKey.self] = newValue }
    }
}
