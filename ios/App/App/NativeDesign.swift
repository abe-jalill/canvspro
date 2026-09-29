import SwiftUI

enum CPTheme {
    static let accent = Color(red: 0.47, green: 0.78, blue: 0.60)
    static let warning = Color(red: 0.98, green: 0.72, blue: 0.31)
    static let danger = Color(red: 0.98, green: 0.43, blue: 0.52)

    static func background(_ scheme: ColorScheme) -> Color {
        scheme == .dark ? Color(red: 0.025, green: 0.055, blue: 0.04) : Color(red: 0.955, green: 0.975, blue: 0.962)
    }
    static func foreground(_ scheme: ColorScheme) -> Color {
        scheme == .dark ? Color.white.opacity(0.97) : Color(red: 0.06, green: 0.16, blue: 0.10)
    }
    static func muted(_ scheme: ColorScheme) -> Color {
        scheme == .dark ? Color.white.opacity(0.60) : Color(red: 0.18, green: 0.32, blue: 0.24).opacity(0.82)
    }
    static func glass(_ scheme: ColorScheme, strong: Bool = false) -> Color {
        scheme == .dark
            ? Color(red: 0.12, green: 0.20, blue: 0.16).opacity(strong ? 0.82 : 0.68)
            : Color.white.opacity(strong ? 0.86 : 0.70)
    }
    static func border(_ scheme: ColorScheme) -> Color {
        scheme == .dark ? Color.white.opacity(0.11) : Color(red: 0.04, green: 0.18, blue: 0.10).opacity(0.11)
    }
}

struct CPBackdrop: View {
    @Environment(\.colorScheme) private var scheme
    var body: some View {
        ZStack {
            CPTheme.background(scheme)
            Circle().fill(CPTheme.accent.opacity(scheme == .dark ? 0.14 : 0.18)).frame(width: 360, height: 360).blur(radius: 80).offset(x: -150, y: -330)
            Circle().fill(Color.teal.opacity(scheme == .dark ? 0.08 : 0.11)).frame(width: 340, height: 340).blur(radius: 95).offset(x: 180, y: -80)
            Circle().fill(CPTheme.accent.opacity(scheme == .dark ? 0.08 : 0.12)).frame(width: 420, height: 420).blur(radius: 110).offset(x: 20, y: 390)
        }.ignoresSafeArea()
    }
}

struct CPGlassCard<Content: View>: View {
    @Environment(\.colorScheme) private var scheme
    let title: String?
    let subtitle: String?
    let strong: Bool
    let content: Content

    init(title: String? = nil, subtitle: String? = nil, strong: Bool = false, @ViewBuilder content: () -> Content) {
        self.title = title; self.subtitle = subtitle; self.strong = strong; self.content = content()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            if title != nil || subtitle != nil {
                VStack(alignment: .leading, spacing: 3) {
                    if let title { Text(title).font(.system(size: 18, weight: .medium, design: .rounded)).foregroundStyle(CPTheme.foreground(scheme)) }
                    if let subtitle { Text(subtitle).font(.caption).foregroundStyle(CPTheme.muted(scheme)) }
                }
            }
            content
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(CPTheme.glass(scheme, strong: strong), in: RoundedRectangle(cornerRadius: 22, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 22, style: .continuous).stroke(CPTheme.border(scheme), lineWidth: 1))
        .shadow(color: Color.black.opacity(scheme == .dark ? 0.24 : 0.08), radius: 22, y: 12)
    }
}

struct CPInsetRow<Content: View>: View {
    @Environment(\.colorScheme) private var scheme
    let content: Content
    init(@ViewBuilder content: () -> Content) { self.content = content() }
    var body: some View {
        content
            .padding(13)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(CPTheme.foreground(scheme).opacity(scheme == .dark ? 0.045 : 0.055), in: RoundedRectangle(cornerRadius: 15, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 15, style: .continuous).stroke(CPTheme.border(scheme), lineWidth: 1))
    }
}

struct CPPageHeader: View {
    @Environment(\.colorScheme) private var scheme
    let eyebrow: String
    let title: String
    let detail: String?
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(eyebrow.uppercased()).font(.caption2.weight(.semibold)).tracking(2).foregroundStyle(CPTheme.accent)
            Text(title).font(.system(size: 32, weight: .semibold, design: .rounded)).tracking(-0.8).foregroundStyle(CPTheme.foreground(scheme))
            if let detail { Text(detail).font(.subheadline).foregroundStyle(CPTheme.muted(scheme)) }
        }.frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct CPChip: View {
    @Environment(\.colorScheme) private var scheme
    let text: String
    let selected: Bool
    var body: some View {
        Text(text).font(.caption.weight(.medium)).padding(.horizontal, 13).padding(.vertical, 8)
            .foregroundStyle(selected ? CPTheme.background(scheme) : CPTheme.foreground(scheme))
            .background(selected ? CPTheme.foreground(scheme) : CPTheme.foreground(scheme).opacity(0.06), in: Capsule())
            .overlay(Capsule().stroke(CPTheme.border(scheme), lineWidth: selected ? 0 : 1))
    }
}

struct CPListScreenModifier: ViewModifier {
    func body(content: Content) -> some View {
        content
            .scrollContentBackground(.hidden)
            .background(CPBackdrop())
            .toolbarBackground(.ultraThinMaterial, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
    }
}

extension View {
    func cpListScreen() -> some View { modifier(CPListScreenModifier()) }
}
