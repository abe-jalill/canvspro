import SwiftUI
import UserNotifications
import PhotosUI
import SafariServices
import UIKit
import AuthenticationServices

/// A grouped list row in the style of the iPhone Settings app.
struct NativeMenuRow: View {
    @Environment(\.colorScheme) private var scheme
    @Environment(\.cpPalette) private var paletteDependency
    let title: String
    var detail: String? = nil
    let symbol: String
    var trailingSymbol = "chevron.right"
    var body: some View {
        HStack(spacing: 12) {
            CPIconBadge(symbol: symbol)
            VStack(alignment: .leading, spacing: 1) {
                Text(title).cpFont(13, .medium).foregroundStyle(CPTheme.foreground(scheme))
                    .fixedSize(horizontal: false, vertical: true)
                if let detail {
                    Text(detail).cpFont(11).foregroundStyle(CPTheme.muted(scheme))
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            Spacer(minLength: 8)
            Image(systemName: trailingSymbol).cpIconFont(9, .bold).foregroundStyle(CPTheme.faint(scheme))
        }
        .padding(.vertical, 8)
        .frame(minHeight: 56)
        .contentShape(Rectangle())
    }
}

/// Rows separated by inset hairlines inside one card.
struct NativeMenuGroup<Content: View>: View {
    let title: String?
    let content: Content
    init(_ title: String? = nil, @ViewBuilder content: () -> Content) { self.title = title; self.content = content() }
    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            if let title { CPSectionLabel(title) }
            VStack(spacing: 0) { content }
                .padding(.horizontal, 14)
                .cpSurface()
        }
    }
}

/// More: your profile, a tile for every page that isn't in the tab bar, then
/// quick settings, account and help. A page that isn't a tab (Calendar, Files,
/// a notification's announcement...) opens here.
@MainActor
struct NativeMoreView: View {
    @Environment(\.colorScheme) private var scheme
    @Environment(\.cpPalette) private var paletteDependency
    @Environment(\.dynamicTypeSize) private var typeSize
    @ObservedObject var store: NativeContentStore
    @ObservedObject var features: NativeFeatureStore
    @ObservedObject var sessionStore: NativeSessionStore
    @Binding var destination: NativeTab?
    @Binding var studyRequest: AssignmentItem?
    @Binding var quickPomodoro: Bool
    @ObservedObject private var streaks = NativeStreakStore.shared
    @ObservedObject private var files = NativeFileStore.shared
    @AppStorage("CanvasProColorScheme") private var colorScheme = "dark"
    @AppStorage(NativeTabBar.key) private var tabBarRaw = ""

    private var fullName: String {
        let name = "\(features.accountDetails.firstName) \(features.accountDetails.lastName)".trimmingCharacters(in: .whitespacesAndNewlines)
        return name.isEmpty ? (features.profile.username ?? "Your profile") : name
    }

    /// Every page not in the tab bar, then Completed.
    private var shortcuts: [NativeTab] {
        let inTabBar = NativeTabBar.middle(tabBarRaw)
        return NativeTabBar.choices.filter { !inTabBar.contains($0) } + [.completed]
    }

    /// Tiles two to a row (one at accessibility text sizes); an odd one out
    /// takes the whole row.
    private var shortcutGrid: some View {
        let perRow = typeSize.isAccessibilitySize ? 1 : 2
        let rows = stride(from: 0, to: shortcuts.count, by: perRow).map { Array(shortcuts[$0..<min($0 + perRow, shortcuts.count)]) }
        return VStack(spacing: 12) {
            ForEach(rows, id: \.self) { row in
                HStack(alignment: .top, spacing: 12) {
                    ForEach(row, id: \.self) { page in
                        Button { destination = page } label: { tile(page, wide: row.count == 1 && perRow > 1) }
                            .buttonStyle(CPPressStyle())
                    }
                }
                // Both tiles in a row take the taller one's height.
                .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 28) {
                    profileCard

                    shortcutGrid

                    NativeMenuGroup("Quick settings") {
                        VStack(alignment: .leading, spacing: 10) {
                            HStack(spacing: 12) {
                                CPIconBadge(symbol: "circle.lefthalf.filled")
                                Text("Appearance").cpFont(13, .medium).foregroundStyle(CPTheme.foreground(scheme))
                            }
                            CPSegmented(selection: modeSelection, options: ["Light", "Dark", "System"], label: "Appearance")
                        }
                        .padding(.vertical, 14)
                        if streaks.streak != nil {
                            CPRowDivider(leading: 44)
                            NativeStreakRow()
                        }
                    }

                    NativeMenuGroup("Account") {
                        NavigationLink { NotificationsView(sessionStore: sessionStore, features: features) } label: {
                            NativeMenuRow(title: "Notifications", detail: "Reminders, grades and posts", symbol: "bell")
                        }.buttonStyle(CPPressStyle())
                        CPRowDivider(leading: 44)
                        NavigationLink { NativeTabBarSettingsView() } label: {
                            NativeMenuRow(title: "Tab bar", detail: NativeTabBar.middle(tabBarRaw).map(\.title).joined(separator: " · "), symbol: "dock.rectangle")
                        }.buttonStyle(CPPressStyle())
                        CPRowDivider(leading: 44)
                        NavigationLink { NativeSettingsView(contentStore: store, features: features, sessionStore: sessionStore) } label: {
                            NativeMenuRow(title: "Settings", detail: "Canvas, classes, profile and more", symbol: "gearshape")
                        }.buttonStyle(CPPressStyle())
                    }

                    NativeMenuGroup("Help") {
                        NavigationLink { NativeSupportView() } label: {
                            NativeMenuRow(title: "Help & Support", detail: "Answers and contact", symbol: "questionmark.circle")
                        }.buttonStyle(CPPressStyle())
                    }

                    Text(versionLine)
                        .cpFont(11).foregroundStyle(CPTheme.faint(scheme))
                        .frame(maxWidth: .infinity)
                        .padding(.top, -8)
                }
                .cpPagePadding()
            }
            .background(CPBackdrop())
            .cpNavigationTitle("More")
            .navigationBarTitleDisplayMode(.inline)
            // Pages that aren't tabs, and links or notifications that open them.
            .navigationDestination(item: $destination) { page in destinationView(page) }
        }
    }

    @ViewBuilder private func destinationView(_ page: NativeTab) -> some View {
        switch page {
        case .todo: FocusView(store: store, features: features, inMore: true)
        case .study: NativeStudyView(store: store, features: features, requestedAssignment: $studyRequest, quickPomodoro: $quickPomodoro)
        case .grades: NativeGradesView(store: store, features: features)
        case .files: NativeFilesView(store: store, features: features)
        case .announcements: AnnouncementsView(store: store, features: features)
        case .calendar: CalendarView(store: store, features: features)
        case .classes: ClassScheduleView(features: features, store: store)
        case .completed: NativeCompletedView(store: store, features: features)
        default: EmptyView()
        }
    }

    private var profileCard: some View {
        NavigationLink { ProfileView(features: features, email: sessionStore.session?.user.email) } label: {
            HStack(spacing: 14) {
                NativeAvatar(url: features.avatarURL, size: 56)
                // Long names, schools and addresses wrap instead of being cut off.
                VStack(alignment: .leading, spacing: 3) {
                    Text(fullName).cpFont(17, .semibold).tracking(-0.3).foregroundStyle(CPTheme.foreground(scheme))
                        .fixedSize(horizontal: false, vertical: true)
                    // School and year, e.g. "State University · Sophomore".
                    if let schoolLine = features.accountDetails.schoolLine {
                        Text(schoolLine).cpFont(13).foregroundStyle(CPTheme.foreground(scheme).opacity(0.85))
                            .fixedSize(horizontal: false, vertical: true)
                    } else {
                        Text("Add your school and year").cpFont(13).foregroundStyle(CPTheme.primary(scheme: scheme))
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    if let email = sessionStore.session?.user.email {
                        Text(email).cpFont(12).foregroundStyle(CPTheme.muted(scheme))
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
                Spacer(minLength: 8)
                Image(systemName: "chevron.right").cpIconFont(9, .bold).foregroundStyle(CPTheme.faint(scheme))
            }
            .padding(CPLayout.cardPadding)
            .background(CPTheme.accentCardGradient(scheme), in: RoundedRectangle(cornerRadius: CPLayout.cardRadius, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: CPLayout.cardRadius, style: .continuous).strokeBorder(CPTheme.primary(scheme: scheme).opacity(0.3), lineWidth: 0.5))
        }
        .buttonStyle(CPPressStyle())
        .accessibilityHint("Opens your profile")
    }

    /// A page's tile: its icon, name and one live detail. A wide tile (the odd
    /// one out) puts the icon beside the words.
    @ViewBuilder private func tile(_ page: NativeTab, wide: Bool = false) -> some View {
        if wide {
            HStack(spacing: 14) {
                tileIcon(page)
                VStack(alignment: .leading, spacing: 3) {
                    Text(page.title).cpFont(15, .medium).foregroundStyle(CPTheme.foreground(scheme))
                        .fixedSize(horizontal: false, vertical: true)
                    Text(detail(for: page)).cpFont(12).foregroundStyle(CPTheme.muted(scheme))
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: 8)
                Image(systemName: "arrow.up.right").cpIconFont(10, .semibold).foregroundStyle(CPTheme.faint(scheme))
            }
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .cpSurface()
            .contentShape(Rectangle())
            .accessibilityElement(children: .combine)
            .accessibilityLabel("\(page.title), \(detail(for: page))")
        } else {
            squareTile(page)
        }
    }

    private func tileIcon(_ page: NativeTab) -> some View {
        let tint = CPTheme.primary(scheme: scheme)
        return Image(systemName: page.symbol).cpIconFont(15, .medium)
            .foregroundStyle(tint)
            .frame(width: 36, height: 36)
            .background(tint.opacity(scheme == .dark ? 0.16 : 0.12), in: RoundedRectangle(cornerRadius: 11, style: .continuous))
    }

    private func squareTile(_ page: NativeTab) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                tileIcon(page)
                Spacer(minLength: 4)
                Image(systemName: "arrow.up.right").cpIconFont(10, .semibold).foregroundStyle(CPTheme.faint(scheme))
            }
            Spacer(minLength: 0)
            VStack(alignment: .leading, spacing: 3) {
                Text(page.title).cpFont(15, .medium).foregroundStyle(CPTheme.foreground(scheme))
                    .multilineTextAlignment(.leading)
                    .fixedSize(horizontal: false, vertical: true)
                Text(detail(for: page)).cpFont(12).foregroundStyle(CPTheme.muted(scheme))
                    .lineLimit(2).multilineTextAlignment(.leading)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, minHeight: 124, maxHeight: .infinity, alignment: .topLeading)
        .cpSurface()
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(page.title), \(detail(for: page))")
    }

    private func detail(for page: NativeTab) -> String {
        // No counts until everything has loaded; the space stays so tiles don't jump.
        if store.showsSkeleton && ![NativeTab.study, .files].contains(page) { return " " }
        switch page {
        case .todo:
            let count = features.shownAssignments(in: store).filter { NativeParity.isDueThisWeek($0) && $0.isVisible(in: store) && !$0.notYetOpen() }.count
            return count == 0 ? "Nothing due this week" : "\(count) this week"
        case .study:
            return "Focus timer and Pomodoro"
        case .grades:
            let count = store.bundle.courses.filter { !features.hiddenCourseIDs.contains($0.id) }.count
            return count == 1 ? "1 class" : "\(count) classes"
        case .files:
            guard files.root != nil else { return "Class folders and scans" }
            return files.inICloud ? "Synced with iCloud Drive" : "Saved on this iPhone"
        case .announcements:
            // Posts you've dismissed (on any device) aren't new.
            let dismissed = features.dismissedAnnouncementIDs
            let count = store.bundle.announcements.filter { !features.hiddenCourseIDs.contains($0.courseID) && !dismissed.contains($0.id) && $0.isWithin(weeks: 1) }.count
            return count == 0 ? "Nothing new this week" : "\(count) this week"
        case .calendar:
            let now = Date()
            let next = features.shownEvents(in: store)
                .compactMap { event -> (String, Date)? in
                    guard let raw = event.startAt, let date = ISO8601DateFormatter.canvasDate(from: raw), date >= now else { return nil }
                    return (event.title, date)
                }
                .min { $0.1 < $1.1 }
            guard let next else { return "Nothing coming up" }
            return "Next: \(next.0)"
        case .completed:
            let count = features.shownAssignments(in: store).filter { $0.isFinished(in: store) }.count
            return count == 0 ? "Nothing finished yet" : "\(count) finished"
        case .classes:
            let count = Set(features.schedule.map { $0.title.lowercased() }).count
            return count == 0 ? "Add your class times" : count == 1 ? "1 class a week" : "\(count) classes a week"
        default:
            return ""
        }
    }

    private var versionLine: String {
        let version = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String
        return version.map { "CoursePro \($0)" } ?? "CoursePro"
    }

    /// Light, Dark or System, saved like Settings → Appearance (and shared with the website).
    private var modeSelection: Binding<String> {
        Binding(
            get: { colorScheme == "light" ? "Light" : colorScheme == "system" ? "System" : "Dark" },
            set: { label in
                let value = label.lowercased()
                guard value != colorScheme else { return }
                Task { @MainActor in
                    do { try await features.savePreference("theme", value) }
                    catch { features.errorMessage = error.localizedDescription }
                }
            }
        )
    }
}

/// Settings › Tab bar: Today is always first and More always last; the two
/// in between are the student's pick, and a third is optional.
@MainActor
struct NativeTabBarSettingsView: View {
    @Environment(\.colorScheme) private var scheme
    @Environment(\.cpPalette) private var paletteDependency
    @AppStorage(NativeTabBar.key) private var raw = ""
    private var middle: [NativeTab] { NativeTabBar.middle(raw) }

    var body: some View {
        Form {
            Section {
                preview
                    .listRowInsets(EdgeInsets(top: 14, leading: 12, bottom: 14, trailing: 12))
            } footer: {
                Text("Today is always first and More is always last. Everything else opens from More.")
            }
            Section("Tabs in the middle") {
                picker("Second tab", slot: 0)
                picker("Third tab", slot: 1)
                extraPicker
            }
            if middle != NativeTabBar.defaultMiddle {
                Section {
                    Button("Go back to To-Do, Study Session and Grades") { raw = "" }
                }
            }
        }
        .cpListScreen()
        .cpNavigationTitle("Tab bar")
        .navigationBarTitleDisplayMode(.inline)
        .sensoryFeedback(.selection, trigger: raw)
    }

    /// A small copy of the tab bar as it will look.
    private var preview: some View {
        let tabs = NativeTabBar.tabs(raw)
        return HStack(alignment: .top, spacing: 2) {
            ForEach(tabs, id: \.self) { tab in
                VStack(spacing: 4) {
                    Image(systemName: tab.symbol).cpIconFont(17)
                    // Wraps rather than shrinking when a name is long.
                    Text(tab.tabLabel(compact: tabs.count > 4)).cpFont(11)
                        .multilineTextAlignment(.center)
                        .lineLimit(2)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .foregroundStyle(tab == .today ? CPTheme.primary(scheme: scheme) : CPTheme.muted(scheme))
                .frame(maxWidth: .infinity)
            }
        }
        .animation(.easeInOut(duration: 0.2), value: raw)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Tab bar: " + NativeTabBar.tabs(raw).map(\.title).joined(separator: ", "))
    }

    /// Picking the tab that's already in the other slot swaps the two.
    private func picker(_ title: String, slot: Int) -> some View {
        Picker(title, selection: Binding(get: { middle[slot] }, set: { tab in
            var next = middle
            if let other = next.firstIndex(of: tab), other != slot { next.swapAt(slot, other) } else { next[slot] = tab }
            raw = NativeTabBar.raw(next)
        })) {
            ForEach(NativeTabBar.choices, id: \.self) { tab in
                Label(tab.title, systemImage: tab.symbol).tag(tab)
            }
        }
    }

    /// The optional fourth tab, which makes five: None, or a page not already picked.
    private var extraPicker: some View {
        Picker("Fourth tab", selection: Binding<NativeTab?>(get: { middle.count > 2 ? middle[2] : nil }, set: { tab in
            var next = Array(middle.prefix(2))
            if let tab { next.append(tab) }
            raw = NativeTabBar.raw(next)
        })) {
            Text("None").tag(NativeTab?.none)
            ForEach(NativeTabBar.choices.filter { !middle.prefix(2).contains($0) }, id: \.self) { tab in
                Label(tab.title, systemImage: tab.symbol).tag(NativeTab?.some(tab))
            }
        }
    }
}

/// The website's Support page, worded for the iPhone app.
enum NativeSupportFAQ {
    static let email = "support@canvaspro.app"
    static let reportForm = URL(string: "https://forms.gle/7bttezmTW3ji3zFU9")!

    static let items: [(question: String, answer: String)] = [
        ("How do I connect my Canvas account?",
         "Open More, then Settings, then Canvas connection. Enter your school's Canvas address (for example yourschool.instructure.com) and a Canvas access token.\n\nTo make a token, sign in to Canvas, open Account, then Settings. Under Approved Integrations, choose New Access Token, give it a name, and copy the token into CoursePro. You never enter your school password."),
        ("CoursePro can't connect to my school. What now?",
         "Check that the address is the one you use to open Canvas, and that the token was copied in full. If it still won't connect, email us your school's Canvas address and we'll look into it."),
        ("My notifications aren't arriving.",
         "Open More, then Notifications, and make sure notifications are on.\n\nThen open your iPhone's Settings app, tap Notifications, then CoursePro, and allow notifications. Quiet at night pauses them overnight, and a Focus mode can hold them too."),
        ("How do streaks work?",
         "Open CoursePro on a day and that day counts. Come back the next day and your streak grows.\n\nMiss a day and your streak freeze covers it automatically, once each month. At 6 PM, if you haven't opened CoursePro yet that day, we'll remind you. You can turn that reminder off in More, then Notifications."),
        ("Does CoursePro see my school password or change anything in Canvas?",
         "No. CoursePro only reads your courses, assignments, grades and announcements using the token you created, and never asks for your school password. You can revoke the token in Canvas at any time."),
        ("How do I delete my account?",
         "Open More, then Settings, then Account, and delete your account. Your account and the data stored with it are removed permanently. If you can't sign in, email us from the address on your account and we'll delete it for you."),
        ("Is CoursePro part of Canvas?",
         "No. CoursePro is an independent app and isn't affiliated with, endorsed by or sponsored by Instructure, Inc. or Canvas LMS."),
    ]
}

/// Help & Support: quick answers, email, and the policies.
struct NativeSupportView: View {
    @Environment(\.colorScheme) private var scheme
    @Environment(\.cpPalette) private var paletteDependency
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.openURL) private var openURL
    @State private var expanded: Int?
    @State private var legalPage: NativeLegalPage?
    @State private var showReport = false
    @State private var copied = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                CPPageHeader(
                    eyebrow: "Support",
                    title: "How can we help?",
                    detail: "Find a quick answer below, or email us and a real person will reply, usually within one to two business days."
                )
                CPGlassCard(title: "Contact us", strong: true) {
                    Text(NativeSupportFAQ.email)
                        .cpFont(13).foregroundStyle(CPTheme.muted(scheme))
                        .textSelection(.enabled)
                    VStack(spacing: 10) {
                        Button(action: emailSupport) {
                            Label(copied ? "Email address copied" : "Email support", systemImage: copied ? "checkmark" : "envelope")
                        }
                        .buttonStyle(CPButtonStyle(kind: .primary, fullWidth: true))
                        Button { showReport = true } label: {
                            Label("Report a problem", systemImage: "exclamationmark.bubble")
                        }
                        .buttonStyle(CPButtonStyle(kind: .secondary, fullWidth: true))
                    }
                }
                NativeMenuGroup("Common questions") {
                    ForEach(Array(NativeSupportFAQ.items.enumerated()), id: \.offset) { index, item in
                        if index > 0 { CPRowDivider(leading: 0) }
                        question(index, item.question, item.answer)
                    }
                }
                NativeMenuGroup("Policies") {
                    legalRow(.privacy, "hand.raised")
                    CPRowDivider(leading: 40)
                    legalRow(.terms, "doc.text")
                }
            }
            .cpPagePadding()
        }
        .background(CPBackdrop())
        .cpNavigationTitle("Help & Support")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(item: $legalPage) { page in NativeSafariView(url: page.url).ignoresSafeArea() }
        .sheet(isPresented: $showReport) { NativeSafariView(url: NativeSupportFAQ.reportForm).ignoresSafeArea() }
    }

    private func question(_ index: Int, _ question: String, _ answer: String) -> some View {
        let open = expanded == index
        return VStack(alignment: .leading, spacing: 0) {
            Button {
                CPHaptics.tap()
                withAnimation(reduceMotion ? nil : .easeInOut(duration: 0.22)) { expanded = open ? nil : index }
            } label: {
                HStack(alignment: .firstTextBaseline, spacing: 12) {
                    Text(question)
                        .cpFont(13, .medium).foregroundStyle(CPTheme.foreground(scheme))
                        .multilineTextAlignment(.leading)
                        .fixedSize(horizontal: false, vertical: true)
                    Spacer(minLength: 8)
                    Image(systemName: "chevron.down")
                        .cpIconFont(10, .bold).foregroundStyle(CPTheme.faint(scheme))
                        .rotationEffect(.degrees(open ? 180 : 0))
                }
                .padding(.vertical, 14)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityAddTraits(.isHeader)
            .accessibilityValue(open ? "Expanded" : "Collapsed")
            if open {
                Text(answer)
                    .cpFont(13).lineSpacing(3)
                    .foregroundStyle(CPTheme.muted(scheme))
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.bottom, 14)
                    .transition(.opacity)
            }
        }
    }

    private func legalRow(_ page: NativeLegalPage, _ symbol: String) -> some View {
        Button { legalPage = page } label: {
            NativeMenuRow(title: page.title, symbol: symbol, trailingSymbol: "arrow.up.right")
        }
        .buttonStyle(CPPressStyle())
    }

    /// Opens Mail; without a mail account, copies the address instead.
    private func emailSupport() {
        guard let url = URL(string: "mailto:\(NativeSupportFAQ.email)?subject=CoursePro%20help") else { return }
        openURL(url) { accepted in
            guard !accepted else { return }
            UIPasteboard.general.string = NativeSupportFAQ.email
            CPHaptics.tap()
            copied = true
        }
    }
}

struct NativeAvatar: View {
    @Environment(\.colorScheme) private var scheme
    @Environment(\.cpPalette) private var paletteDependency
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    let url: URL?
    var size: CGFloat = 36
    var body: some View {
        AsyncImage(url: url, transaction: Transaction(animation: reduceMotion ? nil : .easeInOut(duration: 0.2))) { phase in
            if let image = phase.image { image.resizable().scaledToFill().transition(.opacity) }
            else {
                Image(systemName: "person.fill").cpIconFont(size * 0.38, .semibold)
                    .foregroundStyle(CPTheme.foreground(scheme))
                    .frame(width: size, height: size)
                    .background(CPTheme.foreground(scheme).opacity(0.07))
            }
        }
        .frame(width: size, height: size)
        .clipShape(Circle())
        .accessibilityHidden(true)
    }
}

struct NativeSettingsView: View {
    @Environment(\.colorScheme) private var scheme
    @Environment(\.cpPalette) private var paletteDependency
    @ObservedObject var contentStore: NativeContentStore
    @ObservedObject var features: NativeFeatureStore
    @ObservedObject var sessionStore: NativeSessionStore
    @State private var legalPage: NativeLegalPage?
    @State private var showTutorial = false
    @State private var confirmingSignOut = false
    @AppStorage("CanvasProHideGrades") private var hideGrades = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                CPPageHeader(eyebrow: nil, title: "Settings", detail: nil)
                NativeMenuGroup("Personal") {
                    NavigationLink { ProfileView(features: features, email: sessionStore.session?.user.email) } label: {
                        NativeMenuRow(title: "Profile", symbol: "person.crop.circle")
                    }.buttonStyle(CPPressStyle())
                    CPRowDivider(leading: 40)
                    settingsLink("Appearance", "paintpalette") { NativeAppearanceView(features: features) }
                    CPRowDivider(leading: 40)
                    settingsLink("Dashboard", "square.grid.2x2") { NativeDashboardSettingsView(features: features) }
                    CPRowDivider(leading: 40)
                    settingsLink("Tab bar", "dock.rectangle") { NativeTabBarSettingsView() }
                    CPRowDivider(leading: 40)
                    HStack(spacing: 12) {
                        CPIconBadge(symbol: "eye.slash")
                        Toggle("Hide grades until tapped", isOn: $hideGrades)
                            .cpFont(13, .medium).foregroundStyle(CPTheme.foreground(scheme))
                            // The Grades widget hides its numbers too.
                            .onChange(of: hideGrades) { _, hide in CanvasProWidgetStore.updateHideGrades(hide) }
                    }
                    .frame(minHeight: 56)
                }
                NativeMenuGroup("Classes") {
                    settingsLink("Canvas connection", "link") { CanvasSettingsView(store: contentStore) }
                    CPRowDivider(leading: 40)
                    settingsLink("Class settings", "graduationcap") { NativeClassSettingsView(store: contentStore, features: features) }
                    CPRowDivider(leading: 40)
                    settingsLink("Announcements", "megaphone") { AnnouncementWindowSettingsView(features: features) }
                }
                NativeMenuGroup("App") {
                    settingsLink("Notifications", "bell") { NotificationsView(sessionStore: sessionStore, features: features) }
                    CPRowDivider(leading: 40)
                    settingsLink("AI assistant", "sparkles") { NativeAIConnectionView() }
                    CPRowDivider(leading: 40)
                    settingsLink("Signed-in devices", "laptopcomputer.and.iphone") { NativeDevicesView(sessionStore: sessionStore) }
                    CPRowDivider(leading: 40)
                    settingsLink("Delete account", "person.crop.circle.badge.xmark") { NativeDeleteAccountView(sessionStore: sessionStore) }
                }
                NativeMenuGroup("Help & legal") {
                    Button { showTutorial = true } label: {
                        NativeMenuRow(title: "Tutorial", symbol: "play.circle")
                    }
                    .buttonStyle(CPPressStyle())
                    .accessibilityHint("A one-minute animated tour of CoursePro")
                    CPRowDivider(leading: 40)
                    settingsLink("Help & Support", "questionmark.circle") { NativeSupportView() }
                    CPRowDivider(leading: 40)
                    legalRow(.privacy, "hand.raised")
                    CPRowDivider(leading: 40)
                    legalRow(.terms, "doc.text")
                }
                Button("Sign out") { confirmingSignOut = true }
                    .buttonStyle(CPButtonStyle(kind: .quiet, fullWidth: true))
                    .foregroundStyle(CPTheme.danger)
                    .confirmationDialog("Sign out of CoursePro on this iPhone?", isPresented: $confirmingSignOut, titleVisibility: .visible) {
                        Button("Sign out", role: .destructive) { Task { await sessionStore.signOut() } }
                    } message: { Text("Your work stays in your account. Notifications stop on this iPhone until you sign in again.") }
            }
            .cpPagePadding()
        }
        .background(CPBackdrop())
        .cpNavigationTitle("Settings")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(item: $legalPage) { page in NativeSafariView(url: page.url).ignoresSafeArea() }
        // The same tour as on first launch (and the website's Settings > Tutorial).
        .fullScreenCover(isPresented: $showTutorial) {
            NativeTutorialView(fromSettings: true) {
                showTutorial = false
                // The website stops offering the tour too.
                Task { try? await features.savePreference("tutorial-seen", true) }
            }
        }
    }

    private func legalRow(_ page: NativeLegalPage, _ symbol: String) -> some View {
        Button { legalPage = page } label: {
            NativeMenuRow(title: page.title, symbol: symbol, trailingSymbol: "arrow.up.right")
        }
        .buttonStyle(CPPressStyle())
        .accessibilityHint("Opens the current \(page.title) from canvaspro.app")
    }

    private func settingsLink<Destination: View>(_ title: String, _ symbol: String, @ViewBuilder destination: () -> Destination) -> some View {
        NavigationLink(destination: destination()) { NativeMenuRow(title: title, symbol: symbol) }.buttonStyle(CPPressStyle())
    }
}

private struct NativeAppearanceView: View {
    @ObservedObject var features: NativeFeatureStore
    var body: some View {
        ZStack { CPBackdrop(); ScrollView { AppearanceSettingsCard(features: features).cpPagePadding() } }
            .cpNavigationTitle("Appearance")
            .navigationBarTitleDisplayMode(.inline)
    }
}

private struct NativeClassSettingsView: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @ObservedObject var store: NativeContentStore
    @ObservedObject var features: NativeFeatureStore
    @State private var section = 0
    var body: some View {
        ZStack {
            CPBackdrop()
            VStack(spacing: 16) {
                Picker("Class settings", selection: $section) {
                    Text("Class names").tag(0)
                    Text("Classes shown").tag(1)
                }
                .pickerStyle(.segmented)
                .padding(.horizontal, 14)
                if section == 0 { ClassNamesView(store: store) }
                else { HiddenCoursesView(store: store, features: features) }
            }
        }
        .animation(reduceMotion ? nil : .easeInOut(duration: 0.2), value: section)
        .cpNavigationTitle("Class settings")
        .navigationBarTitleDisplayMode(.inline)
    }
}

private struct NativeAIConnectionView: View {
    @State private var copied = false
    private let address = "https://canvaspro.app/mcp"
    var body: some View {
        ZStack {
            CPBackdrop()
            ScrollView {
                CPGlassCard(title: "Connect an AI assistant") {
                    Text("Add this address to your assistant, then approve.")
                        .cpFont(12).lineSpacing(2)
                    HStack {
                        Text(address).cpFont(12, .medium, design: .monospaced).lineLimit(1).textSelection(.enabled)
                        Spacer(minLength: 8)
                        Button(copied ? "Copied" : "Copy") {
                            UIPasteboard.general.string = address
                            copied = true
                        }
                        .buttonStyle(CPButtonStyle(kind: .secondary))
                    }
                    .padding(.leading, 12).padding(.trailing, 4).padding(.vertical, 4)
                    .background(Color.primary.opacity(0.05), in: RoundedRectangle(cornerRadius: CPLayout.innerRadius, style: .continuous))
                    Text("Read-only. Your Canvas key is never shared.")
                        .cpFont(11).foregroundStyle(.secondary)
                    // App Review Guideline 5.1.2(i): say what goes to a third-party AI before anything does.
                    Text("Nothing is shared until you sign in and approve on CoursePro's consent screen. After that, the assistant can read your courses, grades, assignments, due dates, announcements and calendar, and its provider's terms and privacy policy cover what it receives. You can remove the connection in your assistant at any time.")
                        .cpFont(11).lineSpacing(2).foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .cpPagePadding()
            }
        }
        .cpNavigationTitle("AI assistant")
        .navigationBarTitleDisplayMode(.inline)
    }
}

// MARK: Signed-in devices

/// One sign-in on the account (list_my_sessions, the website's too).
struct NativeSignedInDevice: Decodable, Identifiable, Equatable {
    let id: String
    let createdAt: String
    let lastActiveAt: String
    let userAgent: String?
    let isCurrent: Bool
    enum CodingKeys: String, CodingKey {
        case id
        case createdAt = "created_at"; case lastActiveAt = "last_active_at"
        case userAgent = "user_agent"; case isCurrent = "is_current"
    }
}

extension NativeAPI {
    func signedInDevices(token: String) async throws -> [NativeSignedInDevice] {
        try decoder.decode([NativeSignedInDevice].self, from: try await rpc("list_my_sessions", token: token))
    }

    /// False once another device ended this sign-in; nil when the server can't say.
    func sessionIsActive(token: String) async -> Bool? {
        guard let data = try? await rpc("my_session_active", token: token) else { return nil }
        switch String(decoding: data, as: UTF8.self).trimmingCharacters(in: .whitespacesAndNewlines) {
        case "true": return true
        case "false": return false
        default: return nil
        }
    }

    /// Ends one of the account's sign-ins and stops its notifications.
    func endSignIn(_ id: String, token: String) async throws {
        _ = try await rpc("revoke_my_session", token: token, body: ["target": id])
    }

    /// Ends every sign-in but this one, and their notifications.
    func endOtherSignIns(token: String) async throws {
        _ = try await rpc("revoke_my_other_sessions", token: token)
    }

    private func rpc(_ name: String, token: String, body: [String: Any] = [:]) async throws -> Data {
        var request = try request(path: "/rest/v1/rpc/\(name)", token: token)
        request.httpMethod = "POST"
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        return try await data(request)
    }
}

/// A readable name for a sign-in, read from its user agent the way the
/// website does (src/lib/devices.ts).
enum NativeDeviceName {
    struct Description: Equatable { let name: String; let symbol: String }

    static func describe(_ userAgent: String?) -> Description {
        let ua = (userAgent ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        func has(_ pattern: String) -> Bool { ua.range(of: pattern, options: [.regularExpression, .caseInsensitive]) != nil }
        if ua.isEmpty { return Description(name: "Unknown device", symbol: "app") }
        // The iPhone app signs in without a browser: its requests say CFNetwork/Darwin.
        if has("CoursePro-iOS|CFNetwork|Darwin/") && !has("Mozilla") { return Description(name: "CoursePro for iPhone", symbol: "iphone") }
        if !has("Mozilla|Opera") { return Description(name: "Another app", symbol: "app") }
        let os: String? = has("iPhone") ? "iPhone" : has("iPad") ? "iPad" : has("Android") ? "Android" : has("CrOS") ? "Chromebook" : has("Windows") ? "Windows" : has("Macintosh|Mac OS X") ? "Mac" : has("Linux") ? "Linux" : nil
        let browser = has("Edg(e|A|iOS)?/") ? "Edge" : has("OPR/|Opera") ? "Opera" : has("Firefox|FxiOS") ? "Firefox" : has("SamsungBrowser") ? "Samsung Internet" : has("Chrome|CriOS|Chromium") ? "Chrome" : has("Safari") ? "Safari" : "A browser"
        let symbol = os == "iPhone" || (os == "Android" && has("Mobile")) ? "iphone" : os == "iPad" || os == "Android" ? "ipad" : "laptopcomputer"
        return Description(name: os.map { "\(browser) on \($0)" } ?? browser, symbol: symbol)
    }

    /// "Signed in Oct 3 · Active now" / "… · Active 2 hours ago".
    static func line(_ device: NativeSignedInDevice, now: Date = Date()) -> String {
        let signedIn = (date(device.createdAt) ?? now).formatted(.dateTime.month(.abbreviated).day())
        let last = min(date(device.lastActiveAt) ?? now, now)
        let active = now.timeIntervalSince(last) < 5 * 60 ? "Active now" : "Active \(last.formatted(.relative(presentation: .named)))"
        return "Signed in \(signedIn) · \(active)"
    }

    /// The database sends microseconds; the formatter wants none.
    private static func date(_ value: String) -> Date? {
        ISO8601DateFormatter.canvasWithoutFractionalSeconds.date(from: value.replacingOccurrences(of: #"\.\d+"#, with: "", options: .regularExpression))
    }
}

/// Every sign-in on the account, this iPhone first. Sign out of any of them,
/// of the others, or everywhere: the same as the website's Settings page.
struct NativeDevicesView: View {
    @Environment(\.colorScheme) private var scheme
    @Environment(\.cpPalette) private var paletteDependency
    @ObservedObject var sessionStore: NativeSessionStore
    @State private var devices: [NativeSignedInDevice] = []
    @State private var loading = true
    @State private var status: String?
    @State private var ending: Set<String> = []
    @State private var working = false
    @State private var confirmEverywhere = false
    @State private var confirmingSignOut = false

    var body: some View {
        Form {
            Section {
                if loading && devices.isEmpty {
                    HStack(spacing: 10) { ProgressView(); Text("Loading your devices…").foregroundStyle(CPTheme.muted(scheme)) }
                }
                ForEach(devices) { device in row(device) }
            } footer: {
                Text("A device you sign out of goes back to the sign-in screen and stops getting notifications.")
            }
            if let status { Section { Text(status).foregroundStyle(CPTheme.muted(scheme)) } }
            Section {
                Button("Sign out of other devices") { Task { _ = await endOthers() } }
                    .disabled(working || !devices.contains { !$0.isCurrent })
                Button("Sign out everywhere", role: .destructive) { confirmEverywhere = true }
                    .disabled(working || devices.isEmpty)
            }
        }
        .cpListScreen()
        .cpNavigationTitle("Signed-in devices")
        .navigationBarTitleDisplayMode(.inline)
        .task { await load() }
        .refreshable { await load() }
        .confirmationDialog("Sign out of CoursePro on this iPhone?", isPresented: $confirmingSignOut, titleVisibility: .visible) {
            Button("Sign out", role: .destructive) { Task { await sessionStore.signOut() } }
        }
        .confirmationDialog("Sign out everywhere?", isPresented: $confirmEverywhere, titleVisibility: .visible) {
            Button("Sign out everywhere", role: .destructive) { Task { await signOutEverywhere() } }
        } message: {
            Text("Every device, this iPhone included, goes back to the sign-in screen and stops getting notifications until you sign in again.")
        }
    }

    private func row(_ device: NativeSignedInDevice) -> some View {
        let described = NativeDeviceName.describe(device.userAgent)
        let isEnding = ending.contains(device.id)
        return HStack(spacing: 12) {
            Image(systemName: described.symbol).cpIconFont(16).foregroundStyle(CPTheme.foreground(scheme).opacity(0.8))
                .frame(width: 34, height: 34)
                .background(CPTheme.foreground(scheme).opacity(0.08), in: RoundedRectangle(cornerRadius: 9, style: .continuous))
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 6) {
                    Text(described.name).cpFont(15, .medium).foregroundStyle(CPTheme.foreground(scheme)).fixedSize(horizontal: false, vertical: true)
                    if device.isCurrent {
                        Text("This device").cpFont(11, .semibold).foregroundStyle(CPTheme.primary(scheme: scheme))
                            .padding(.horizontal, 7).padding(.vertical, 2)
                            .background(CPTheme.primary(scheme: scheme).opacity(0.15), in: Capsule())
                    }
                }
                Text(NativeDeviceName.line(device)).cpFont(12).foregroundStyle(CPTheme.muted(scheme)).fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 8)
            Button(isEnding ? "Signing out…" : "Sign out") { Task { await end(device) } }
                .buttonStyle(.borderless)
                .cpFont(13, .medium)
                .disabled(isEnding || working)
                .accessibilityLabel(device.isCurrent ? "Sign out of this iPhone" : "Sign out of \(described.name)")
        }
        .padding(.vertical, 4)
    }

    private func load() async {
        guard let api = sessionStore.api, sessionStore.session != nil else {
            loading = false
            status = "Sign in to see your devices."
            return
        }
        loading = true
        defer { loading = false }
        do {
            devices = try await api.signedInDevices(token: try await sessionStore.accessToken())
            status = nil
        } catch {
            status = "Couldn't load your devices. Pull down to try again."
        }
    }

    private func end(_ device: NativeSignedInDevice) async {
        if device.isCurrent { confirmingSignOut = true; return }
        guard let api = sessionStore.api else { return }
        ending.insert(device.id)
        defer { ending.remove(device.id) }
        do {
            try await api.endSignIn(device.id, token: try await sessionStore.accessToken())
            CPHaptics.success()
            devices.removeAll { $0.id == device.id }
        } catch {
            status = "Couldn't sign out of that device. Try again."
        }
    }

    private func endOthers() async -> Bool {
        guard let api = sessionStore.api else { return false }
        working = true
        defer { working = false }
        do {
            try await api.endOtherSignIns(token: try await sessionStore.accessToken())
            CPHaptics.success()
            devices.removeAll { !$0.isCurrent }
            return true
        } catch {
            status = "Couldn't sign out of your other devices. Try again."
            return false
        }
    }

    private func signOutEverywhere() async {
        if await endOthers() { await sessionStore.signOut() }
    }
}

private struct NativeDeleteAccountView: View {
    @Environment(\.colorScheme) private var scheme
    @ObservedObject var sessionStore: NativeSessionStore
    @State private var confirmation = ""

    private var confirmed: Bool {
        confirmation.trimmingCharacters(in: .whitespacesAndNewlines).uppercased() == "DELETE"
    }

    var body: some View {
        Form {
            Section {
                Text("Permanently deletes your account and everything saved with it: your Canvas key, settings, schedule, grade history and notification sign-ups. It happens right away and can't be undone. Your school's Canvas account isn't affected.")
            }
            Section("Type DELETE to confirm") {
                TextField("DELETE", text: $confirmation)
                    .textInputAutocapitalization(.characters)
                    .autocorrectionDisabled()
                if sessionStore.session?.user.usesApple == true {
                    // Confirming with Apple also lets CoursePro stop using Sign in with Apple for you.
                    SignInWithAppleButton(.continue) { request in
                        request.requestedScopes = []
                    } onCompletion: { result in
                        switch result {
                        case .success(let authorization):
                            let credential = authorization.credential as? ASAuthorizationAppleIDCredential
                            let code = credential?.authorizationCode.flatMap { String(data: $0, encoding: .utf8) }
                            Task { await sessionStore.deleteAccount(appleAuthorizationCode: code) }
                        case .failure(let error):
                            // Closing Apple's sheet means "not now". Any other failure must not
                            // trap the account (Apple TN3194): delete it anyway; the person can
                            // remove CoursePro under Settings > Apple Account > Sign in with Apple.
                            if (error as? ASAuthorizationError)?.code != .canceled {
                                Task { await sessionStore.deleteAccount() }
                            }
                        }
                    }
                    .signInWithAppleButtonStyle(scheme == .dark ? .white : .black)
                    .frame(height: 46)
                    .disabled(!confirmed || sessionStore.isWorking)
                    .opacity(confirmed ? 1 : 0.4)
                    .id(scheme)
                    Text("Confirm with Apple to delete your account.")
                        .font(.footnote).foregroundStyle(.secondary)
                } else {
                    Button("Permanently delete account", role: .destructive) {
                        Task { await sessionStore.deleteAccount() }
                    }
                    .disabled(!confirmed || sessionStore.isWorking)
                }
            }
            if let error = sessionStore.errorMessage {
                Section { Text(error).foregroundStyle(.red) }
            }
        }
        .cpListScreen()
        .cpNavigationTitle("Delete account")
    }
}

/// To-Do, a tab of its own: everything left, catch-up work first, then the
/// next four weeks day by day (or class by class). No ranges or days to pick;
/// search, Completed and Add are the buttons at the top.
struct FocusView: View {
    @Environment(\.colorScheme) private var scheme
    @Environment(\.cpPalette) private var paletteDependency
    @ObservedObject var store: NativeContentStore
    @ObservedObject var features: NativeFeatureStore
    /// Opened from More rather than as a tab: keeps the bar with its back button.
    var inMore = false
    /// By day or by class, saved to the account: the website's To-Do follows it too.
    private var grouping: String { features.todoGrouping == "class" ? "By class" : "By day" }
    private var groupingChoice: Binding<String> {
        Binding(get: { grouping }, set: { value in
            Task { await features.setTodoGrouping(value == "By class" ? "class" : "day") }
        })
    }
    @State private var search = ""
    @State private var showAdd = false
    @State private var showSearch = false
    @FocusState private var searchFocused: Bool

    private var allItems: [AssignmentItem] { features.shownAssignments(in: store) }
    private var visibleCourses: [CourseSummary] { store.bundle.courses.filter { !features.hiddenCourseIDs.contains($0.id) } }
    private var isSearching: Bool { !search.trimmingCharacters(in: .whitespaces).isEmpty }
    /// Unfinished work due within four weeks, anything recent to catch up on,
    /// and your own tasks with no due date (last). A search looks further ahead.
    private var items: [AssignmentItem] {
        let query = search.trimmingCharacters(in: .whitespaces)
        return allItems.filter { item in
            let listed: Bool
            if item.dueDate == nil {
                listed = item.id < 0 && !item.showsDone(in: store)
            } else {
                listed = (!query.isEmpty || NativeParity.isInFocusWindow(item, window: "all")) && item.isVisible(in: store)
            }
            return listed && (query.isEmpty || item.name.localizedCaseInsensitiveContains(query) || store.displayName(courseID: item.courseID, fallback: item.courseName).localizedCaseInsensitiveContains(query))
        }.sorted(by: AssignmentItem.dueSort)
    }
    private var dayGroups: [NativeTitledGroup] {
        let calendar = Calendar.current
        return Dictionary(grouping: items) { item -> Date in
            guard let due = item.dueDate else { return .distantFuture }
            return due < Date() ? .distantPast : calendar.startOfDay(for: due)
        }.sorted { $0.key < $1.key }.map { date, rows in
            let title = date == .distantPast ? "Catch up" : date == .distantFuture ? "No due date" : calendar.isDateInToday(date) ? "Today" : calendar.isDateInTomorrow(date) ? "Tomorrow" : date.formatted(.dateTime.weekday(.wide).month(.abbreviated).day())
            return NativeTitledGroup(title: title, items: rows, day: date == .distantPast || date == .distantFuture ? nil : date)
        }
    }
    private var classGroups: [NativeTitledGroup] {
        let grouped = Dictionary(grouping: items, by: \.courseID)
        let classes = visibleCourses.compactMap { course -> NativeTitledGroup? in
            guard let rows = grouped[course.id], !rows.isEmpty else { return nil }
            return NativeTitledGroup(title: store.displayName(courseID: course.id, fallback: course.name), items: rows, courseID: course.id)
        }
        .sorted { $0.title.localizedStandardCompare($1.title) == .orderedAscending }
        // Your own tasks that aren't for a class come after the classes.
        guard let personal = grouped[CustomAssignment.noClassID], !personal.isEmpty else { return classes }
        return classes + [NativeTitledGroup(title: CustomAssignment.noClassLabel, items: personal, courseID: CustomAssignment.noClassID)]
    }
    private func estimate(_ item: AssignmentItem) -> Int { NativeParity.estimate(item, estimates: features.estimates) }
    private func classTint(_ courseID: Int) -> Color { CPTheme.classColor(courseID, in: store.bundle.courses) }
    private var showsCounts: Bool { !store.showsSkeleton && !store.needsCanvasConnection && store.loadFailure == nil }
    /// This week, over Today's seven days. Work Canvas hasn't opened yet is
    /// listed (with when it opens) but not counted, as on Today. A search
    /// narrows the list, not these counts.
    private var weekItems: [AssignmentItem] { allItems.filter { NativeParity.isDueThisWeek($0) && !$0.notYetOpen() } }
    private var weekLeft: [AssignmentItem] { weekItems.filter { !$0.showsDone(in: store) && $0.isVisible(in: store) } }
    /// This week's work (the same seven days as the header line): done, and in all.
    private var weekTally: (done: Int, total: Int) {
        let done = weekItems.filter { $0.showsDone(in: store) }.count
        return (done, done + weekLeft.count)
    }
    /// "4 this week · 2 hr 30 min".
    private var headerLine: String {
        let week = weekLeft
        if week.isEmpty { return items.isEmpty && !isSearching ? "All clear" : "Nothing due this week" }
        return "\(week.count) this week · \(Self.duration(week.reduce(0) { $0 + estimate($1) }))"
    }
    /// 45 → "45 min", 90 → "1 hr 30 min", 240 → "4 hr".
    static func duration(_ minutes: Int) -> String {
        let hours = minutes / 60, rest = minutes % 60
        if hours == 0 { return "\(rest) min" }
        return rest == 0 ? "\(hours) hr" : "\(hours) hr \(rest) min"
    }

    var body: some View {
        TimelineView(.periodic(from: .now, by: 60)) { _ in
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 20) {
                    header
                    if showSearch || isSearching { searchField.transition(.opacity) }
                    if store.needsCanvasConnection {
                        NativeConnectCanvasCard(store: store)
                    } else if store.loadFailure != nil {
                        NativeLoadFailedCard(store: store)
                    } else if store.showsSkeleton {
                        CPSkeletonCard()
                        CPSkeletonCard()
                    } else {
                        list
                    }
                }
                .cpPagePadding()
                .cpStateChange(grouping)
                .cpStateChange(items.map(\.id))
            }
            .scrollDismissesKeyboard(.immediately)
        }
        .background(CPBackdrop())
        .cpNavigationTitle("To-Do")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(inMore ? .visible : .hidden, for: .navigationBar)
        .refreshable { async let a: Void = store.refresh(); async let b: Void = features.load(); _ = await (a, b) }
        .sheet(isPresented: $showAdd) { AddAssignmentView(courses: visibleCourses, store: store, features: features) }
    }

    // MARK: Header and search

    /// The title with search, Completed and Add, then one line on the week and
    /// how the list is grouped.
    private var header: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .center, spacing: 4) {
                Text("To-Do").cpFont(28, .semibold).tracking(-0.6).foregroundStyle(CPTheme.foreground(scheme))
                    .accessibilityAddTraits(.isHeader)
                Spacer(minLength: 8)
                Button {
                    withAnimation(.easeInOut(duration: 0.2)) { showSearch.toggle() }
                    searchFocused = showSearch
                    if !showSearch { search = "" }
                } label: { CPIconButtonLabel(symbol: "magnifyingglass") }
                    .buttonStyle(.plain)
                    .accessibilityLabel(showSearch ? "Close search" : "Search")
                NavigationLink { NativeCompletedView(store: store, features: features) } label: {
                    CPIconButtonLabel(symbol: "checkmark.circle")
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Completed")
                Button { showAdd = true } label: { CPIconButtonLabel(symbol: "plus") }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Add a task")
            }
            HStack(alignment: .center, spacing: 8) {
                // Counts only once everything has loaded, never "All clear" before it.
                if showsCounts {
                    Text(headerLine)
                        .cpFont(15).monospacedDigit().foregroundStyle(CPTheme.muted(scheme))
                        .fixedSize(horizontal: false, vertical: true)
                } else {
                    RoundedRectangle(cornerRadius: 5, style: .continuous)
                        .fill(CPTheme.foreground(scheme).opacity(0.06))
                        .frame(width: 170, height: 14)
                        .accessibilityHidden(true)
                }
                Spacer(minLength: 8)
                Menu {
                    Picker("Group by", selection: groupingChoice) {
                        Text("By day").tag("By day")
                        Text("By class").tag("By class")
                    }
                } label: { CPLinkLabel(text: grouping, symbol: "chevron.down") }
                    .accessibilityLabel("Group, \(grouping)")
            }
            let tally = weekTally
            if tally.total > 0 && showsCounts {
                NativeWeekSegments(done: tally.done, total: tally.total)
                    .padding(.top, 6)
                    .transition(.opacity)
            }
        }
        .padding(.horizontal, 4)
        .padding(.top, 8)
        .cpHeaderLight()
    }

    private var searchField: some View {
        HStack(spacing: 10) {
            Image(systemName: "magnifyingglass").cpIconFont(13).foregroundStyle(CPTheme.muted(scheme))
            TextField("Search assignments or classes", text: $search)
                .cpFont(14)
                .focused($searchFocused)
                .submitLabel(.search)
                .autocorrectionDisabled()
            if isSearching {
                Button { search = ""; searchFocused = false } label: {
                    Image(systemName: "xmark.circle.fill").cpIconFont(14).foregroundStyle(CPTheme.muted(scheme))
                        .frame(width: 44, height: 44).contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Clear search")
            }
        }
        .padding(.horizontal, 14)
        .frame(minHeight: 44)
        .background(CPTheme.inset(scheme), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).strokeBorder(CPTheme.insetBorder(scheme), lineWidth: 0.5))
    }

    // MARK: List

    @ViewBuilder private var list: some View {
        if items.isEmpty {
            CPGlassCard {
                NativeEmptyState(
                    title: isSearching ? "No matches" : "You're all clear.",
                    symbol: isSearching ? "magnifyingglass" : "checkmark.circle",
                    actionTitle: isSearching ? "Clear search" : "Add a task",
                    action: { if isSearching { search = "" } else { showAdd = true } }
                )
            }
        } else {
            ForEach(grouping == "By class" ? classGroups : dayGroups) { group in
                section(group, showCourse: grouping != "By class")
            }
        }
    }

    /// One card per day (or class), its rows split by hairlines. Today's card
    /// catches the palette light.
    private func section(_ group: NativeTitledGroup, showCourse: Bool) -> some View {
        let isToday = group.day.map { Calendar.current.isDateInToday($0) } ?? false
        let shape = RoundedRectangle(cornerRadius: 20, style: .continuous)
        return VStack(alignment: .leading, spacing: 8) {
            sectionLabel(group)
            VStack(spacing: 0) {
                ForEach(group.items) { item in
                    row(item, showCourse: showCourse)
                    if item.id != group.items.last?.id { CPRowDivider(leading: 32) }
                }
            }
            .padding(.horizontal, 14)
            .background {
                if isToday {
                    shape.fill(LinearGradient(colors: [CPTheme.primary(scheme: scheme).opacity(scheme == .dark ? 0.10 : 0.07), .clear], startPoint: .top, endPoint: .bottom))
                }
            }
            .cpSurface(radius: 20)
            .overlay {
                if isToday { shape.strokeBorder(CPTheme.primary(scheme: scheme).opacity(0.3), lineWidth: 0.5) }
            }
        }
    }

    /// "Sunday  Oct 25  2 ······ 1 hr", with Today in the palette color and Catch
    /// up in rose. By class it starts with the class's color.
    private func sectionLabel(_ group: NativeTitledGroup) -> some View {
        let calendar = Calendar.current
        let isToday = group.day.map { calendar.isDateInToday($0) } ?? false
        let isCatchUp = group.day == nil && group.courseID == nil && group.title == "Catch up"
        let name = group.day.map { calendar.isDateInToday($0) ? "Today" : calendar.isDateInTomorrow($0) ? "Tomorrow" : $0.formatted(.dateTime.weekday(.wide)) } ?? group.title
        let minutes = group.items.reduce(0) { $0 + estimate($1) }
        return HStack(alignment: .firstTextBaseline, spacing: 6) {
            if let courseID = group.courseID {
                Image(systemName: "circle.fill").cpIconFont(7).foregroundStyle(classTint(courseID)).accessibilityHidden(true)
            }
            Text(name).cpFont(15, .semibold).tracking(-0.2)
                .foregroundStyle(isToday ? CPTheme.primary(scheme: scheme) : isCatchUp ? CPTheme.danger : CPTheme.foreground(scheme))
                .fixedSize(horizontal: false, vertical: true)
            if let day = group.day {
                Text(day.formatted(.dateTime.month(.abbreviated).day())).cpFont(13).foregroundStyle(CPTheme.muted(scheme))
            }
            Text("\(group.items.count)").cpFont(13).monospacedDigit().foregroundStyle(CPTheme.faint(scheme))
            Spacer(minLength: 8)
            Text(Self.duration(minutes)).cpFont(12).monospacedDigit().foregroundStyle(CPTheme.faint(scheme))
        }
        .padding(.horizontal, 4)
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isHeader)
    }

    /// The name, and one quiet line: class, time and how long it takes.
    private func row(_ item: AssignmentItem, showCourse: Bool) -> some View {
        let done = item.showsDone(in: store)
        return HStack(alignment: .top, spacing: 12) {
            NativeCompletionButton(assignment: item, store: store, tint: classTint(item.courseID)).padding(.top, 1)
            NavigationLink {
                if let course = store.bundle.courses.first(where: { $0.id == item.courseID }) {
                    CourseDetailView(course: course, store: store, features: features, highlightAssignment: item)
                } else {
                    AssignmentDetailView(assignment: item, store: store, features: features)
                }
            } label: {
                VStack(alignment: .leading, spacing: 4) {
                    Text(item.name).cpFont(15, .medium)
                        .foregroundStyle(done ? CPTheme.muted(scheme) : CPTheme.foreground(scheme))
                        .strikethrough(done)
                        .multilineTextAlignment(.leading)
                        .fixedSize(horizontal: false, vertical: true)
                    Text(rowMeta(item, showCourse: showCourse, done: done))
                        .cpFont(12).monospacedDigit().foregroundStyle(CPTheme.muted(scheme))
                        .multilineTextAlignment(.leading)
                        .fixedSize(horizontal: false, vertical: true)
                    if !done { NativeOpensLabel(assignment: item) }
                    if !done, let percent = features.progress[item.id], percent > 0 { NativeProgressBar(percent: percent) }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .contentShape(Rectangle())
            }
            .buttonStyle(CPPressStyle())
        }
        .padding(.vertical, 13)
        .opacity(done ? 0.6 : 1)
        .nativeAssignmentSwipe(item, store: store)
        .transition(.cpCompletionExit)
    }

    /// By day the section already names the day, so a row shows just the time
    /// (or the date, for work to catch up on). By class it shows the date.
    private func rowMeta(_ item: AssignmentItem, showCourse: Bool, done: Bool) -> String {
        var parts: [String] = []
        if showCourse { parts.append(store.displayName(courseID: item.courseID, fallback: item.courseName)) }
        if let due = item.dueDate {
            parts.append(showCourse && due >= Date() ? due.formatted(date: .omitted, time: .shortened) : NativeParity.dueDisplay(due))
        } else {
            parts.append("No due date")
        }
        parts.append(done ? (item.isCanvasFinished ? "Done in Canvas" : "Done") : Self.duration(estimate(item)))
        return parts.joined(separator: " · ")
    }
}

struct NativeTitledGroup: Identifiable {
    let title: String
    let items: [AssignmentItem]
    /// The day (To-Do by day) or class (by class) the group is for.
    var day: Date? = nil
    var courseID: Int? = nil
    /// Two classes can share a name, so a class group goes by its class.
    var id: String { courseID.map { "course-\($0)" } ?? day.map { "day-\($0.timeIntervalSince1970)" } ?? title }
}

/// To-Do's week: one segment per assignment due in the next seven days; done
/// ones fill from the left. Past 12 it's one bar, so segments never get thin.
private struct NativeWeekSegments: View {
    @Environment(\.colorScheme) private var scheme
    @Environment(\.cpPalette) private var paletteDependency
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    let done: Int
    let total: Int

    var body: some View {
        Group {
            if total > 12 {
                CPProgressBar(value: Double(done) / Double(max(1, total)), color: CPTheme.primary(scheme: scheme), height: 6)
            } else {
                HStack(spacing: 4) {
                    ForEach(0..<total, id: \.self) { index in
                        Capsule()
                            .fill(index < done ? CPTheme.primary(scheme: scheme) : CPTheme.foreground(scheme).opacity(0.08))
                            .frame(maxWidth: .infinity)
                            .frame(height: 6)
                    }
                }
            }
        }
        .animation(reduceMotion ? nil : .spring(duration: 0.4, bounce: 0.1), value: done)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(done) of \(total) done this week")
    }
}

/// One thing on the Calendar: a class meeting, your own event, work you put
/// on the calendar, a due date, or a Canvas event.
struct NativeCalendarEntry: Identifiable {
    enum Kind: Int { case classMeeting, event, canvas, planned, due }
    let id: String
    let kind: Kind
    let start: Date
    var end: Date? = nil
    var allDay = false
    let title: String
    var context = ""
    var courseID: Int? = nil
    var url: URL? = nil
    var pickID: Int? = nil
    var eventID: String? = nil

    var label: String {
        switch kind {
        case .classMeeting: return "Class"
        case .event: return "Event"
        case .canvas: return "Canvas event"
        case .planned: return "Planned"
        case .due: return "Due"
        }
    }
}

private struct CalendarDayGroup: Identifiable {
    var id: Date { day }
    let day: Date
    let items: [NativeCalendarEntry]
}

/// What the calendar is built from, read once per redraw.
private struct NativeCalendarSources {
    let classes: [ClassScheduleEntry]
    let events: [NativeCalendarEvent]
    let picks: [CalendarPick]
    let due: [AssignmentItem]
    let canvas: [CalendarEventItem]
}

/// The Calendar, as on the website: a week to pick a day from, then that day
/// in time order — classes, your events, work you planned, and what's due.
/// Upcoming lists the next month without the everyday classes.
struct CalendarView: View {
    @Environment(\.colorScheme) private var scheme
    @Environment(\.cpPalette) private var paletteDependency
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @ObservedObject var store: NativeContentStore
    @ObservedObject var features: NativeFeatureStore
    /// The time column grows with Text Size, so times never squeeze.
    @ScaledMetric(relativeTo: .footnote) private var timeWidth: CGFloat = 66
    @State private var editingPick: CalendarPick?
    @State private var pickedTime = Date()
    @State private var editingEvent: NativeEventEditing?
    @State private var selectedDate: Date? = Calendar.current.startOfDay(for: Date())
    @State private var currentWeekOffset = 0

    private static let upcomingDays = 30
    /// Earlier weeks show your classes and events (finished due dates are on Completed).
    private static let weeksBack = 12
    private var calendar: Calendar { Calendar.current }
    private var today: Date { calendar.startOfDay(for: Date()) }

    private var weekDates: [Date] {
        let weekday = calendar.component(.weekday, from: today)
        let monday = calendar.date(byAdding: .day, value: -((weekday + 5) % 7) + (currentWeekOffset * 7), to: today) ?? today
        return (0..<7).compactMap { calendar.date(byAdding: .day, value: $0, to: monday) }
    }

    private var sources: NativeCalendarSources {
        let all = features.shownAssignments(in: store)
        let picked = Set(features.calendarPicks.map(\.assignmentID))
        let customIDs = Set(features.customAssignments.map(\.id))
        let now = Date()
        let picks = features.calendarPicks.filter { pick in
            // A deleted task, finished work, or a hidden class leaves the calendar too.
            if pick.assignmentID < 0 && !customIDs.contains(pick.assignmentID) { return false }
            guard let item = all.first(where: { $0.id == pick.assignmentID }) else { return pick.assignmentID > 0 && !store.bundle.assignments.contains { $0.id == pick.assignmentID } }
            return item.isVisible(in: store, showCompleted: false)
        }
        let due = all.filter { item in
            guard item.id > 0, !picked.contains(item.id), let date = item.dueDate, date >= now else { return false }
            return item.isVisible(in: store, showCompleted: false)
        }
        let classes = features.schedule.filter { entry in
            entry.canvasCourseID.map { !features.hiddenCourseIDs.contains($0) } ?? true
        }
        return NativeCalendarSources(classes: classes, events: features.calendarEvents, picks: picks, due: due, canvas: features.shownEvents(in: store))
    }

    private func at(_ day: Date, minutes: Int) -> Date {
        calendar.date(bySettingHour: minutes / 60, minute: minutes % 60, second: 0, of: day) ?? day
    }

    private func classCourseID(_ entry: ClassScheduleEntry) -> Int? {
        if let id = entry.canvasCourseID { return id }
        let title = entry.title.lowercased()
        return store.bundle.courses.first { store.displayName(courseID: $0.id, fallback: $0.name).lowercased() == title }?.id
    }

    /// Everything on one day: all-day first, then by time.
    private func entries(on day: Date, _ src: NativeCalendarSources, classes includeClasses: Bool = true) -> [NativeCalendarEntry] {
        var result: [NativeCalendarEntry] = []
        let weekday = calendar.component(.weekday, from: day)
        if includeClasses {
            let letters = ["U": 1, "M": 2, "T": 3, "W": 4, "R": 5, "F": 6, "S": 7]
            for entry in src.classes where entry.days.contains(where: { letters[$0] == weekday }) {
                let courseID = classCourseID(entry)
                // A lab or discussion found in a syllabus keeps its own name.
                let title = courseID != nil && entry.canvasCourseID != nil && entry.scheduleType == "Lecture" ? store.displayName(courseID: courseID!, fallback: entry.title) : entry.title
                result.append(NativeCalendarEntry(id: "class-\(entry.id)-\(day.timeIntervalSince1970)", kind: .classMeeting, start: at(day, minutes: entry.startMinutes), end: at(day, minutes: entry.endMinutes), title: title, context: entry.location, courseID: courseID))
            }
        }
        for event in src.events where NativeParity.occurs(event, on: day) {
            let start = event.start.map { at(day, minutes: $0) } ?? day
            let end = event.start != nil ? event.end.map { at(day, minutes: $0) } : nil
            result.append(NativeCalendarEntry(id: "event-\(event.id)-\(day.timeIntervalSince1970)", kind: .event, start: start, end: end, allDay: event.start == nil, title: event.title, context: event.location, eventID: event.id))
        }
        for pick in src.picks {
            guard let date = ISO8601DateFormatter.canvasDate(from: pick.at), calendar.isDate(date, inSameDayAs: day) else { continue }
            result.append(NativeCalendarEntry(id: "pick-\(pick.id)", kind: .planned, start: date, title: pick.title, context: pick.context, pickID: pick.id))
        }
        for item in src.due {
            guard let date = item.dueDate, calendar.isDate(date, inSameDayAs: day) else { continue }
            result.append(NativeCalendarEntry(id: "due-\(item.id)", kind: .due, start: date, title: item.name, context: store.displayName(courseID: item.courseID, fallback: item.courseName), courseID: item.courseID, url: URL(string: item.htmlURL)))
        }
        for event in src.canvas {
            guard let raw = event.startAt, let start = ISO8601DateFormatter.canvasDate(from: raw), calendar.isDate(start, inSameDayAs: day) else { continue }
            let end = event.endAt.flatMap { ISO8601DateFormatter.canvasDate(from: $0) }
            // Canvas marks all-day events as midnight to midnight (or no length at all).
            let isMidnight = { (date: Date) in calendar.component(.hour, from: date) == 0 && calendar.component(.minute, from: date) == 0 }
            let allDay = isMidnight(start) && (end.map { $0 == start || isMidnight($0) } ?? true)
            result.append(NativeCalendarEntry(id: "canvas-\(event.id)", kind: .canvas, start: start, end: allDay ? nil : end.flatMap { $0 > start ? $0 : nil }, allDay: allDay, title: event.title, context: event.contextName ?? event.locationName ?? "", url: event.htmlURL.flatMap { URL(string: $0) }))
        }
        return result.sorted { a, b in
            if a.allDay != b.allDay { return a.allDay }
            if a.start != b.start { return a.start < b.start }
            if a.kind != b.kind { return a.kind.rawValue < b.kind.rawValue }
            return a.title.localizedStandardCompare(b.title) == .orderedAscending
        }
    }

    private func upcomingGroups(_ src: NativeCalendarSources) -> [CalendarDayGroup] {
        (0..<Self.upcomingDays).compactMap { offset in
            guard let day = calendar.date(byAdding: .day, value: offset, to: today) else { return nil }
            let items = entries(on: day, src, classes: false)
            return items.isEmpty ? nil : CalendarDayGroup(day: day, items: items)
        }
    }

    var body: some View {
        let src = sources
        return ScrollView {
            LazyVStack(alignment: .leading, spacing: CPLayout.stack) {
                calendarStrip(src)
                // Due dates come from Canvas: say so, rather than show an empty week.
                if store.needsCanvasConnection {
                    NativeConnectCanvasCard(store: store)
                } else if store.loadFailure != nil && store.bundle.assignments.isEmpty {
                    NativeLoadFailedCard(store: store)
                } else if store.showsSkeleton {
                    CPSkeletonCard()
                } else if let selected = selectedDate {
                    dayCard(title: dayTitle(selected), items: entries(on: selected, src), day: selected)
                } else {
                    let groups = upcomingGroups(src)
                    if groups.isEmpty {
                        CPGlassCard { NativeEmptyState(title: "Nothing coming up besides class", symbol: "calendar", actionTitle: "Add event", action: { editingEvent = .new(today) }) }
                    } else {
                        ForEach(groups) { group in dayCard(title: dayTitle(group.day), items: group.items, day: nil) }
                    }
                }
            }
            .cpPagePadding()
            .cpStateChange(selectedDate)
            .sensoryFeedback(.selection, trigger: selectedDate)
        }
        .background(CPBackdrop())
        .cpNavigationTitle("Calendar")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button { editingEvent = .new(selectedDate ?? today) } label: { Image(systemName: "plus") }
                    .accessibilityLabel("Add event")
            }
        }
        .sheet(item: $editingEvent) { editing in
            NativeEventEditor(editing: editing, features: features)
        }
        .sheet(item: $editingPick) { pick in
            NavigationStack {
                Form {
                    DatePicker("Planned time", selection: $pickedTime)
                }
                .cpListScreen()
                .cpNavigationTitle("Change time")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Cancel") { editingPick = nil }
                    }
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Save") {
                            let updated = features.calendarPicks.map { existing in
                                var value = existing
                                if existing.id == pick.id {
                                    value.at = ISO8601DateFormatter().string(from: pickedTime)
                                }
                                return value
                            }
                            Task {
                                do { try await features.savePreference("calendar-picks", updated) }
                                catch { features.errorMessage = error.localizedDescription }
                            }
                            editingPick = nil
                        }
                    }
                }
            }
            .presentationDetents([.medium])
        }
    }

    private func dayTitle(_ day: Date) -> String {
        let date = day.formatted(.dateTime.weekday(.wide).month(.abbreviated).day())
        return calendar.isDateInToday(day) ? "Today · \(date)" : calendar.isDateInTomorrow(day) ? "Tomorrow · \(date)" : date
    }

    private func dayCard(title: String, items: [NativeCalendarEntry], day: Date?) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            CPSectionLabel(title, count: items.count)
            VStack(spacing: 0) {
                if items.isEmpty {
                    HStack(spacing: 10) {
                        Image(systemName: "sun.max").cpIconFont(12, .semibold).foregroundStyle(CPTheme.muted(scheme))
                        Text("Nothing on this day.").cpFont(13).foregroundStyle(CPTheme.muted(scheme))
                        Spacer()
                        if let day {
                            Button("Add event") { editingEvent = .new(day) }
                                .cpFont(13, .medium)
                                .buttonStyle(.plain)
                                .foregroundStyle(CPTheme.primary(scheme: scheme))
                        }
                    }
                    .padding(.vertical, 14)
                }
                ForEach(items) { item in
                    agendaItemRow(item)
                    if item.id != items.last?.id { CPRowDivider(leading: timeWidth + 27) }
                }
            }
            .padding(.horizontal, 14)
            .cpSurface()
        }
        .padding(.top, 4)
    }

    private var isOnToday: Bool {
        currentWeekOffset == 0 && selectedDate.map { calendar.isDate($0, inSameDayAs: today) } == true
    }

    /// The week and its arrows, the seven days, then Today or Upcoming. A small
    /// gray dot marks a class day; the colored one, anything else.
    private func calendarStrip(_ src: NativeCalendarSources) -> some View {
        VStack(spacing: 12) {
            HStack(spacing: 6) {
                if let firstDate = weekDates.first {
                    Text(firstDate.formatted(.dateTime.month(.wide).year()))
                        .cpFont(17, .semibold).tracking(-0.3)
                        .foregroundStyle(CPTheme.foreground(scheme))
                        .lineLimit(1)
                }
                Spacer(minLength: 8)
                Button { changeWeek(by: -1) } label: { CPIconButtonLabel(symbol: "chevron.left") }
                    .buttonStyle(.plain)
                    .disabled(currentWeekOffset <= -Self.weeksBack)
                    .opacity(currentWeekOffset <= -Self.weeksBack ? 0.35 : 1)
                    .accessibilityLabel("Previous week")
                Button { changeWeek(by: 1) } label: { CPIconButtonLabel(symbol: "chevron.right") }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Next week")
            }
            HStack(spacing: 4) {
                ForEach(weekDates, id: \.self) { date in
                    let busy = !entries(on: date, src, classes: false).isEmpty
                    let hasClass = entries(on: date, src).contains { $0.kind == .classMeeting }
                    dateButton(date, busy: busy, hasClass: hasClass)
                }
            }
            HStack(spacing: 8) {
                Button {
                    withAnimation(reduceMotion ? nil : .easeInOut(duration: 0.2)) {
                        currentWeekOffset = 0
                        selectedDate = today
                    }
                } label: { CPChip(text: "Today", selected: isOnToday) }
                    .buttonStyle(.plain)
                Button {
                    withAnimation(reduceMotion ? nil : .easeInOut(duration: 0.2)) { selectedDate = nil }
                } label: { CPChip(text: "Upcoming", selected: selectedDate == nil) }
                    .buttonStyle(.plain)
                Spacer(minLength: 0)
            }
        }
        .padding(CPLayout.cardPadding)
        .cpSurface(strong: true)
        .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
    }

    private func changeWeek(by offset: Int) {
        withAnimation(reduceMotion ? nil : .easeInOut(duration: 0.2)) {
            currentWeekOffset = max(-Self.weeksBack, currentWeekOffset + offset)
            if selectedDate != nil {
                selectedDate = currentWeekOffset == 0 ? today : weekDates.first
            }
        }
    }

    @ViewBuilder
    private func dateButton(_ date: Date, busy: Bool, hasClass: Bool) -> some View {
        let isSelected = selectedDate.map { calendar.isDate($0, inSameDayAs: date) } ?? false
        let isToday = calendar.isDate(date, inSameDayAs: today)
        Button {
            withAnimation(reduceMotion ? nil : .easeInOut(duration: 0.18)) { selectedDate = date }
        } label: {
            VStack(spacing: 5) {
                Text(date.formatted(.dateTime.weekday(.narrow)))
                    .cpFont(11, .semibold)
                    .foregroundStyle(isToday ? CPTheme.primary(scheme: scheme) : CPTheme.muted(scheme))
                ZStack {
                    if isSelected {
                        Circle().fill(CPTheme.foreground(scheme))
                    } else if isToday {
                        Circle().strokeBorder(CPTheme.primary(scheme: scheme).opacity(0.7), lineWidth: 1)
                    }
                    Text("\(calendar.component(.day, from: date))")
                        .cpFont(14, .semibold)
                        .monospacedDigit()
                        .foregroundStyle(isSelected ? CPTheme.background(scheme) : CPTheme.foreground(scheme))
                }
                .frame(width: 32, height: 32)
                HStack(spacing: 2) {
                    Circle().fill(CPTheme.muted(scheme)).frame(width: 3, height: 3).opacity(hasClass ? 0.7 : 0)
                    Circle().fill(CPTheme.primary(scheme: scheme)).frame(width: 5, height: 5).opacity(busy ? 1 : 0)
                }
            }
            .opacity(date < today ? 0.45 : 1)
            .frame(maxWidth: .infinity, minHeight: 64)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(date.formatted(.dateTime.weekday(.wide).month().day()))\(hasClass ? ", class" : "")\(busy ? ", has plans" : "")")
        .accessibilityAddTraits(isSelected ? [.isSelected] : [])
    }

    private func barColor(_ item: NativeCalendarEntry) -> Color {
        switch item.kind {
        case .event, .planned: return CPTheme.primary(scheme: scheme)
        case .canvas: return CPTheme.warning
        case .classMeeting, .due:
            return item.courseID.map { CPTheme.classColor($0, in: store.bundle.courses) } ?? CPTheme.muted(scheme)
        }
    }

    /// A time column ("9:30 AM" over "10:45 AM", or "All day"), the class or
    /// kind's color, then the title and one line: what it is, the class or place.
    private func agendaItemRow(_ item: NativeCalendarEntry) -> some View {
        let event = item.eventID.flatMap { id in features.calendarEvents.first { $0.id == id } }
        let line = [item.label, item.context, event.flatMap { $0.repeatDays.isEmpty ? nil : NativeParity.repeatLabel($0.repeatDays) }]
            .compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " · ")
        let over = !item.allDay && (item.end ?? item.start) < Date()
        return HStack(alignment: .top, spacing: 12) {
            VStack(alignment: .trailing, spacing: 2) {
                Text(item.allDay ? "All day" : item.start.formatted(date: .omitted, time: .shortened))
                    .cpFont(13, .semibold).monospacedDigit()
                    .foregroundStyle(CPTheme.foreground(scheme))
                if let end = item.end {
                    Text(end.formatted(date: .omitted, time: .shortened))
                        .cpFont(11).monospacedDigit()
                        .foregroundStyle(CPTheme.muted(scheme))
                }
            }
            .lineLimit(1)
            .minimumScaleFactor(0.8)
            .frame(width: timeWidth, alignment: .trailing)
            RoundedRectangle(cornerRadius: 1.5, style: .continuous)
                .fill(barColor(item))
                .frame(width: 3)
                .padding(.vertical, 2)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 3) {
                Text(item.title)
                    .cpFont(15, .medium)
                    .foregroundStyle(CPTheme.foreground(scheme))
                    .fixedSize(horizontal: false, vertical: true)
                Text(line)
                    .cpFont(12)
                    .foregroundStyle(CPTheme.muted(scheme))
                    .fixedSize(horizontal: false, vertical: true)
                if let notes = event?.notes, !notes.isEmpty {
                    Text(notes).cpFont(12).foregroundStyle(CPTheme.foreground(scheme).opacity(0.7)).fixedSize(horizontal: false, vertical: true)
                }
            }
            Spacer(minLength: 8)
            rowAction(item, event: event)
        }
        .padding(.vertical, 12)
        .opacity(over ? 0.55 : 1)
        .fixedSize(horizontal: false, vertical: true)
        .accessibilityElement(children: .contain)
    }

    @ViewBuilder
    private func rowAction(_ item: NativeCalendarEntry, event: NativeCalendarEvent?) -> some View {
        if let event {
            Button { editingEvent = .edit(event) } label: { actionIcon("pencil") }
                .buttonStyle(.plain)
                .accessibilityLabel("Edit \(item.title)")
        } else if item.kind == .classMeeting {
            NavigationLink { ClassScheduleView(features: features, store: store) } label: { actionIcon("pencil") }
                .buttonStyle(.plain)
                .accessibilityLabel("Edit \(item.title) in My classes")
        } else if let pickID = item.pickID {
            Menu {
                Button { changePick(pickID, date: item.start) } label: { Label("Change time", systemImage: "clock") }
                Button(role: .destructive) { removePick(pickID) } label: { Label("Remove from calendar", systemImage: "trash") }
            } label: { actionIcon("ellipsis") }
                .accessibilityLabel("Options for \(item.title)")
        } else if let url = item.url, url.scheme == "https" {
            Link(destination: url) { actionIcon("arrow.up.right") }
                .accessibilityLabel("Open \(item.title) in Canvas")
        }
    }

    private func actionIcon(_ symbol: String) -> some View {
        Image(systemName: symbol).cpIconFont(12, .medium)
            .foregroundStyle(CPTheme.muted(scheme))
            .frame(width: 44, height: 44)
            .contentShape(Rectangle())
    }

    private func changePick(_ id: Int, date: Date) {
        guard let pick = features.calendarPicks.first(where: { $0.id == id }) else { return }
        pickedTime = date
        editingPick = pick
    }

    private func removePick(_ id: Int) {
        Task {
            do { try await features.savePreference("calendar-picks", features.calendarPicks.filter { $0.id != id }) }
            catch { features.errorMessage = error.localizedDescription }
        }
    }
}

/// Adding an event (on a day) or changing one.
enum NativeEventEditing: Identifiable {
    case new(Date)
    case edit(NativeCalendarEvent)
    var id: String {
        switch self {
        case .new(let day): return "new-\(day.timeIntervalSince1970)"
        case .edit(let event): return event.id
        }
    }
}

/// Add or change an event: a name, a day, a time (or all day), weekly repeats,
/// where, and notes. The same fields as the website's.
struct NativeEventEditor: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.colorScheme) private var scheme
    let editing: NativeEventEditing
    @ObservedObject var features: NativeFeatureStore
    @State private var title = ""
    @State private var day = Date()
    @State private var allDay = false
    @State private var start = Date()
    @State private var end = Date()
    @State private var repeatDays: Set<Int> = []
    @State private var hasUntil = false
    @State private var until = Date()
    @State private var location = ""
    @State private var notes = ""
    @State private var saving = false
    @State private var error: String?
    @State private var loaded = false
    @State private var confirmingDelete = false

    private var existing: NativeCalendarEvent? {
        if case .edit(let event) = editing { return event }
        return nil
    }
    private var calendar: Calendar { Calendar.current }
    private func minutes(_ date: Date) -> Int { calendar.component(.hour, from: date) * 60 + calendar.component(.minute, from: date) }
    private var timesOK: Bool { allDay || minutes(end) > minutes(start) }
    private var canSave: Bool { !saving && !title.trimmingCharacters(in: .whitespaces).isEmpty && timesOK && (!hasUntil || repeatDays.isEmpty || calendar.startOfDay(for: until) >= calendar.startOfDay(for: day)) }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("What's happening?", text: $title)
                    DatePicker("Date", selection: $day, displayedComponents: .date)
                    Toggle("All day", isOn: $allDay)
                    if !allDay {
                        DatePicker("Starts", selection: $start, displayedComponents: .hourAndMinute)
                            .onChange(of: start) { old, new in
                                // Moving the start moves the end with it, keeping the same length.
                                let length = max(15, minutes(end) - minutes(old))
                                end = new.addingTimeInterval(TimeInterval(length * 60))
                            }
                        DatePicker("Ends", selection: $end, displayedComponents: .hourAndMinute)
                        if !timesOK { Text("It needs to end after it starts.").cpFont(12).foregroundStyle(CPTheme.danger) }
                    }
                } footer: {
                    Text("Only you see this. It goes on your calendar, not To-Do.")
                }
                Section {
                    HStack(spacing: 6) {
                        ForEach(0..<7, id: \.self) { weekday in dayToggle(weekday) }
                    }
                    .frame(maxWidth: .infinity)
                    if !repeatDays.isEmpty {
                        Toggle("Ends on a date", isOn: $hasUntil)
                        if hasUntil { DatePicker("Until", selection: $until, in: day..., displayedComponents: .date) }
                    }
                } header: {
                    Text("Repeats every week on")
                } footer: {
                    Text(repeatDays.isEmpty ? "Leave these off for a one-time event." : NativeParity.repeatLabel(repeatDays.sorted()))
                }
                Section {
                    TextField("Location (optional)", text: $location)
                    TextField("Notes (optional)", text: $notes, axis: .vertical)
                }
                if let existing {
                    Section {
                        Button(existing.repeatDays.isEmpty ? "Delete event" : "Delete every time", role: .destructive) { confirmingDelete = true }
                            .confirmationDialog(existing.repeatDays.isEmpty ? "Delete \(existing.title)?" : "Delete \(existing.title) every time?", isPresented: $confirmingDelete, titleVisibility: .visible) {
                                Button("Delete", role: .destructive) { Task { await delete(existing) } }
                            }
                    }
                }
                if let error { Section { Text(error).foregroundStyle(CPTheme.danger) } }
            }
            .cpListScreen()
            .cpNavigationTitle(existing == nil ? "New Event" : "Edit Event")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) { Button(existing == nil ? "Add" : "Save") { Task { await save() } }.disabled(!canSave) }
            }
            .onAppear(perform: load)
        }
        .interactiveDismissDisabled(saving)
    }

    private func dayToggle(_ weekday: Int) -> some View {
        let on = repeatDays.contains(weekday)
        let letter = ["S", "M", "T", "W", "T", "F", "S"][weekday]
        let name = calendar.weekdaySymbols[weekday]
        return Button {
            if on { repeatDays.remove(weekday) } else { repeatDays.insert(weekday) }
        } label: {
            Text(letter).cpFont(13, .semibold)
                .foregroundStyle(on ? CPTheme.background(scheme) : CPTheme.muted(scheme))
                .frame(width: 34, height: 34)
                .background(Circle().fill(on ? CPTheme.primary(scheme: scheme) : Color.clear))
                .overlay(Circle().strokeBorder(on ? Color.clear : CPTheme.foreground(scheme).opacity(0.15), lineWidth: 1))
        }
        .buttonStyle(.borderless)
        .accessibilityLabel(name)
        .accessibilityAddTraits(on ? [.isSelected] : [])
    }

    private func clock(_ minutes: Int, on base: Date) -> Date {
        calendar.date(bySettingHour: minutes / 60, minute: minutes % 60, second: 0, of: base) ?? base
    }

    private func load() {
        guard !loaded else { return }
        loaded = true
        if let event = existing {
            title = event.title
            day = NativeParity.day(fromKey: event.date) ?? Date()
            allDay = event.start == nil
            start = clock(event.start ?? 9 * 60, on: day)
            end = clock(event.end ?? (event.start ?? 9 * 60) + 60, on: day)
            repeatDays = Set(event.repeatDays)
            hasUntil = event.until != nil
            until = event.until.flatMap(NativeParity.day(fromKey:)) ?? day
            location = event.location
            notes = event.notes
        } else if case .new(let picked) = editing {
            // Today: the next whole hour. Another day: 10 AM. Always daytime.
            let now = Date()
            let isToday = calendar.isDateInToday(picked)
            var startMinutes = isToday ? (calendar.component(.hour, from: now) + 1) * 60 : 10 * 60
            var startDay = calendar.startOfDay(for: picked < calendar.startOfDay(for: now) ? now : picked)
            if startMinutes < 8 * 60 { startMinutes = 9 * 60 }
            if startMinutes > 21 * 60, let next = calendar.date(byAdding: .day, value: 1, to: startDay) { startDay = next; startMinutes = 9 * 60 }
            day = startDay
            start = clock(startMinutes, on: startDay)
            end = clock(min(startMinutes + 60, 23 * 60 + 59), on: startDay)
            until = startDay
        }
    }

    private func save() async {
        guard canSave else { return }
        saving = true
        defer { saving = false }
        let event = NativeCalendarEvent(
            id: existing?.id ?? "ev-\(String(Int(Date().timeIntervalSince1970 * 1000), radix: 36))-\(String(Int.random(in: 0..<60_466_176), radix: 36))",
            title: title.trimmingCharacters(in: .whitespaces),
            date: NativeParity.dayKey(day),
            start: allDay ? nil : minutes(start),
            end: allDay ? nil : minutes(end),
            repeatDays: repeatDays.sorted(),
            until: !repeatDays.isEmpty && hasUntil ? NativeParity.dayKey(until) : nil,
            location: location.trimmingCharacters(in: .whitespaces),
            notes: notes.trimmingCharacters(in: .whitespacesAndNewlines)
        )
        var list = features.calendarEvents
        if let index = list.firstIndex(where: { $0.id == event.id }) { list[index] = event } else { list.append(event) }
        do {
            try await features.saveCalendarEvents(list)
            CPHaptics.success()
            dismiss()
        } catch { self.error = error.localizedDescription }
    }

    private func delete(_ event: NativeCalendarEvent) async {
        saving = true
        defer { saving = false }
        do {
            try await features.saveCalendarEvents(features.calendarEvents.filter { $0.id != event.id })
            dismiss()
        } catch { self.error = error.localizedDescription }
    }
}

/// The website's four-week workload, laid out for a phone: pick a week, see its
/// seven days as roomy columns whose bars show how much is due, and tap a day
/// to list it. Showing one week at a time keeps every day readable.
struct WorkloadView: View {
    @Environment(\.colorScheme) private var scheme
    @Environment(\.cpPalette) private var paletteDependency
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    let assignments: [AssignmentItem]
    @ObservedObject var store: NativeContentStore
    @ObservedObject var features: NativeFeatureStore
    @State private var week = 0
    @State private var openDay: Date?
    /// The bars rise once when the card first shows (never with Reduce Motion).
    @State private var grown = false
    private static let weekNames = ["This week", "Next week", "Week 3", "Week 4"]
    private var calendar: Calendar { Calendar.current }
    private var today: Date { calendar.startOfDay(for: Date()) }
    private var monday: Date {
        let weekday = calendar.component(.weekday, from: today)
        return calendar.date(byAdding: .day, value: -((weekday + 5) % 7), to: today) ?? today
    }
    private func days(inWeek index: Int) -> [Date] {
        (0..<7).compactMap { calendar.date(byAdding: .day, value: index * 7 + $0, to: monday) }
    }

    var body: some View {
        // Group once per redraw instead of filtering for every day.
        let byDay = groupedByDay()
        let shownDays = days(inWeek: week)
        let counts = shownDays.map { byDay[$0]?.count ?? 0 }
        let weekTotal = counts.reduce(0, +)
        // Bar height follows the work left (points after saved progress), like the website.
        let maxLoad = max(1, shownDays.map { load(byDay[$0] ?? []) }.max() ?? 1)

        VStack(alignment: .leading, spacing: 14) {
            CPSegmented(selection: Binding(get: { Self.weekNames[week] }, set: { value in
                week = Self.weekNames.firstIndex(of: value) ?? 0
                openDay = nil
            }), options: Self.weekNames, label: "Week")

            HStack(alignment: .firstTextBaseline) {
                Text(weekRange(shownDays)).cpFont(12).foregroundStyle(CPTheme.muted(scheme))
                Spacer()
                Text(weekSummary(days: shownDays, counts: counts))
                    .cpFont(12).monospacedDigit().foregroundStyle(CPTheme.muted(scheme))
            }
            .padding(.horizontal, 2)

            HStack(alignment: .bottom, spacing: 6) {
                ForEach(shownDays, id: \.self) { day in
                    dayColumn(day, count: byDay[day]?.count ?? 0, load: load(byDay[day] ?? []), maxLoad: maxLoad)
                }
            }

            if let openDay, let items = byDay[openDay], !items.isEmpty {
                dayDetail(openDay, items: items)
                    .transition(.opacity)
            } else if weekTotal == 0 {
                Text("A clear week.")
                    .cpFont(12).foregroundStyle(CPTheme.faint(scheme))
                    .frame(maxWidth: .infinity)
            }
        }
        .animation(reduceMotion ? nil : .easeInOut(duration: 0.22), value: week)
        .animation(reduceMotion ? nil : .easeInOut(duration: 0.2), value: openDay)
        .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
        .onAppear {
            guard !grown else { return }
            if reduceMotion { grown = true } else { withAnimation(.spring(duration: 0.6, bounce: 0).delay(0.15)) { grown = true } }
        }
    }

    private func load(_ items: [AssignmentItem]) -> Double {
        items.reduce(0) { $0 + NativeParity.remainingWork($1, progress: features.progress[$1.id]) }
    }

    private func dayColumn(_ day: Date, count: Int, load: Double, maxLoad: Double) -> some View {
        let isToday = calendar.isDate(day, inSameDayAs: today)
        let isOpen = openDay == day
        let isPast = day < today
        let barHeight: CGFloat = count == 0 ? 4 : 10 + 50 * CGFloat(load / maxLoad)
        // Drawn in the palette: stronger for heavier days, solid when picked,
        // half strength for days already past.
        let intensity = load / maxLoad
        let tint = CPTheme.primary(scheme: scheme)
        let fade = isPast ? 0.5 : 1.0
        let barFill: AnyShapeStyle = count == 0
            ? AnyShapeStyle(CPTheme.foreground(scheme).opacity(0.08))
            : AnyShapeStyle(LinearGradient(
                colors: [tint.opacity((isOpen ? 1 : 0.55 + 0.45 * intensity) * fade), tint.opacity((isOpen ? 0.75 : 0.22 + 0.25 * intensity) * fade)],
                startPoint: .top, endPoint: .bottom))
        return Button {
            guard count > 0 else { return }
            openDay = isOpen ? nil : day
        } label: {
            VStack(spacing: 8) {
                Text(count > 0 ? "\(count)" : " ")
                    .cpFont(12, .medium).monospacedDigit()
                    .foregroundStyle(CPTheme.foreground(scheme))
                ZStack(alignment: .bottom) {
                    Color.clear.frame(height: 60)
                    RoundedRectangle(cornerRadius: 5, style: .continuous)
                        .fill(barFill)
                        .frame(width: 18, height: grown ? barHeight : 4)
                }
                VStack(spacing: 2) {
                    Text(day.formatted(.dateTime.weekday(.narrow)))
                        .cpFont(11)
                        .foregroundStyle(CPTheme.muted(scheme))
                    Text("\(calendar.component(.day, from: day))")
                        .cpFont(13, isToday ? .semibold : .regular).monospacedDigit()
                        .foregroundStyle(isToday ? CPTheme.onPrimary(scheme) : CPTheme.foreground(scheme).opacity(isPast ? 0.45 : 0.9))
                        .frame(width: 30, height: 30)
                        .background(isToday ? CPTheme.primary(scheme: scheme) : Color.clear, in: Circle())
                }
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 8)
            .background(isOpen ? CPTheme.inset(scheme) : Color.clear, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(day.formatted(.dateTime.weekday(.wide).month(.wide).day())), \(count) due, \(Int(load.rounded())) points of work left")
        .accessibilityAddTraits(isOpen ? .isSelected : [])
    }

    private func pointsLeft(_ item: AssignmentItem, points: Double) -> String {
        guard let percent = features.progress[item.id], percent > 0 else { return "\(points.formatted()) pts" }
        return "\(Int(NativeParity.remainingWork(item, progress: percent).rounded())) of \(points.formatted()) pts left"
    }

    private func dayDetail(_ day: Date, items: [AssignmentItem]) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(NativeParity.dueDisplay(day, includeTime: false))
                .cpFont(12, .medium).foregroundStyle(CPTheme.foreground(scheme))
                .padding(.horizontal, 2)
            ForEach(items) { item in
                CPInsetRow {
                    VStack(alignment: .leading, spacing: 8) {
                    HStack(alignment: .center, spacing: 10) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(item.name).cpFont(13, .medium).foregroundStyle(CPTheme.foreground(scheme)).fixedSize(horizontal: false, vertical: true)
                            Text(store.displayName(courseID: item.courseID, fallback: item.courseName)).cpFont(11).foregroundStyle(CPTheme.muted(scheme)).fixedSize(horizontal: false, vertical: true)
                        }
                        Spacer(minLength: 8)
                        VStack(alignment: .trailing, spacing: 2) {
                            if let due = item.dueDate { Text(NativeParity.dueDisplay(due)).cpFont(11).monospacedDigit().foregroundStyle(CPTheme.muted(scheme)) }
                            if let points = item.pointsPossible { Text(pointsLeft(item, points: points)).cpFont(11).monospacedDigit().foregroundStyle(CPTheme.faint(scheme)) }
                        }
                        .fixedSize()
                    }
                    NativeEstimateEditor(assignment: item, features: features)
                    }
                }
            }
        }
    }

    private func groupedByDay() -> [Date: [AssignmentItem]] {
        var result: [Date: [AssignmentItem]] = [:]
        for item in assignments {
            guard let due = item.dueDate else { continue }
            result[calendar.startOfDay(for: due), default: []].append(item)
        }
        return result.mapValues { $0.sorted(by: AssignmentItem.dueSort) }
    }

    private func weekSummary(days: [Date], counts: [Int]) -> String {
        let total = counts.reduce(0, +)
        guard total > 0 else { return "Nothing due" }
        guard let top = counts.max(), top > 1, let index = counts.firstIndex(of: top), days.indices.contains(index) else { return "\(total) due" }
        return "\(total) due · busiest \(days[index].formatted(.dateTime.weekday(.abbreviated)))"
    }

    private func weekRange(_ days: [Date]) -> String {
        guard let first = days.first, let last = days.last else { return "" }
        return "\(first.formatted(.dateTime.month(.abbreviated).day())) – \(last.formatted(.dateTime.month(.abbreviated).day()))"
    }
}

struct AnnouncementsView: View {
    @Environment(\.colorScheme) private var scheme
    @Environment(\.cpPalette) private var paletteDependency
    @ObservedObject var store: NativeContentStore
    @ObservedObject var features: NativeFeatureStore
    @AppStorage("CanvasProAnnouncementsGrouping") private var grouping = "By time"
    @State private var search = ""
    @State private var courseFilter: Int?
    @State private var expanded = Set<Int>()
    /// Dismissed on any device: the account's list, shared with the website.
    private var dismissed: Set<Int> { features.dismissedAnnouncementIDs }
    /// What Restore brings back: dismissed posts still listed and in the window.
    private var restorable: Set<Int> {
        Set(store.bundle.announcements.filter { item in
            dismissed.contains(item.id) && !features.hiddenCourseIDs.contains(item.courseID) && item.isWithin(weeks: features.announcementWeeks)
        }.map(\.id))
    }
    private var items: [AnnouncementItem] {
        store.bundle.announcements.filter { item in
            !features.hiddenCourseIDs.contains(item.courseID) && !dismissed.contains(item.id) && item.isWithin(weeks: features.announcementWeeks) && (search.isEmpty || item.title.localizedCaseInsensitiveContains(search) || item.courseName.localizedCaseInsensitiveContains(search))
        }.sorted {
            let left = ISO8601DateFormatter.canvasDate(from: $0.postedAt) ?? .distantPast
            let right = ISO8601DateFormatter.canvasDate(from: $1.postedAt) ?? .distantPast
            return left == right ? $0.id > $1.id : left > right
        }
    }
    private var feed: [AnnouncementItem] { items.filter { courseFilter == nil || $0.courseID == courseFilter } }
    private var courses: [Int] { Array(Set(items.map(\.courseID))).sorted { name(for: $0) < name(for: $1) } }
    private var classGroups: [NativeAnnouncementGroup] {
        Dictionary(grouping: feed, by: \.courseID)
            .map { id, rows in NativeAnnouncementGroup(id: id, name: name(for: id), items: rows) }
            .sorted {
                let order = $0.name.localizedStandardCompare($1.name)
                return order == .orderedSame ? $0.id < $1.id : order == .orderedAscending
            }
    }
    private var dayGroups: [NativeAnnouncementDayGroup] {
        let calendar = Calendar.current
        return Dictionary(grouping: feed) { item -> Date in
            guard let posted = ISO8601DateFormatter.canvasDate(from: item.postedAt) else { return .distantPast }
            return calendar.startOfDay(for: posted)
        }.sorted { $0.key > $1.key }.map { day, rows in
            NativeAnnouncementDayGroup(day: day, items: rows)
        }
    }
    private func name(for id: Int) -> String { store.displayName(courseID: id, fallback: items.first(where: { $0.courseID == id })?.courseName ?? "Class") }
    private var courseCount: Int { Set(items.map(\.courseID)).count }
    private var windowTitle: String { features.announcementWeeks == 0 ? "All announcements" : features.announcementWeeks == 1 ? "Past week" : features.announcementWeeks == 4 ? "Past month" : "Past \(features.announcementWeeks) weeks" }

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: CPLayout.stack) {
                NativePageHero(symbol: "megaphone", eyebrow: windowTitle, title: "Announcements") {
                    CPStatTile(value: "\(items.count)", label: "Recent posts")
                    CPStatTile(value: "\(courseCount)", label: "Active classes")
                }
                CPSegmented(selection: $grouping, options: ["By time", "By class"], label: "Group announcements")
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 6) {
                        Button { courseFilter = nil } label: { CPChip(text: "All updates · \(items.count)", selected: courseFilter == nil) }.buttonStyle(.plain)
                        ForEach(courses, id: \.self) { id in
                            Button { courseFilter = id } label: { CPChip(text: "\(name(for: id)) · \(items.filter { $0.courseID == id }.count)", selected: courseFilter == id) }.buttonStyle(.plain)
                        }
                        if !restorable.isEmpty {
                            Button {
                                let back = restorable
                                Task { await features.setDismissedAnnouncements(dismissed.subtracting(back)) }
                            } label: { CPLinkLabel(text: "Restore \(restorable.count)", symbol: "arrow.uturn.backward") }.buttonStyle(.plain)
                        }
                    }
                    .padding(.horizontal, 1)
                }
                .scrollClipDisabled()
                // Never "No announcements" while they're still loading or couldn't load.
                if store.needsCanvasConnection {
                    NativeConnectCanvasCard(store: store)
                } else if store.loadFailure != nil && store.bundle.announcements.isEmpty {
                    NativeLoadFailedCard(store: store)
                } else if store.showsSkeleton {
                    CPSkeletonCard()
                    CPSkeletonCard()
                } else if feed.isEmpty {
                    CPGlassCard { NativeEmptyState(title: "No announcements in this view.", symbol: "megaphone") }
                } else if grouping == "By class" {
                    ForEach(classGroups) { group in
                        VStack(alignment: .leading, spacing: 12) {
                            CPSectionLabel(group.name, count: group.items.count)
                            ForEach(group.items) { item in announcementRow(item) }
                        }
                    }
                } else {
                    ForEach(dayGroups) { group in
                        VStack(alignment: .leading, spacing: 12) {
                            CPSectionLabel(dayTitle(group.day), count: group.items.count)
                            ForEach(group.items) { item in announcementRow(item) }
                        }
                    }
                }
            }
            .cpPagePadding()
            .cpStateChange(courseFilter)
            .cpStateChange(grouping)
            .cpStateChange(feed.map(\.id))
        }
        .background(CPBackdrop())
        .searchable(text: $search)
        .refreshable { await store.refresh() }
        .cpNavigationTitle("Announcements")
        .navigationBarTitleDisplayMode(.inline)
        .onChange(of: courses) { _, ids in
            if let courseFilter, !ids.contains(courseFilter) { self.courseFilter = nil }
        }
    }

    private func dayTitle(_ day: Date) -> String {
        if day == .distantPast { return "Date unavailable" }
        if Calendar.current.isDateInToday(day) { return "Today" }
        if Calendar.current.isDateInYesterday(day) { return "Yesterday" }
        return day.formatted(.dateTime.weekday(.wide).month(.abbreviated).day())
    }

    private func deleteAnnouncement(_ item: AnnouncementItem) {
        let next = dismissed.union([item.id])
        Task { await features.setDismissedAnnouncements(next) }
        expanded.remove(item.id)
        CPHaptics.tap()
    }

    private func announcementRow(_ item: AnnouncementItem) -> some View {
        let message = item.message.strippingHTML
        let isOpen = expanded.contains(item.id)
        return VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text(name(for: item.courseID).uppercased()).cpFont(11, .semibold).tracking(0.8).foregroundStyle(CPTheme.foreground(scheme))
                    .fixedSize(horizontal: false, vertical: true)
                Spacer(minLength: 6)
                Text(announcementDate(item)).cpFont(11).monospacedDigit().foregroundStyle(CPTheme.faint(scheme))
            }
            Text(item.title).cpFont(13, .semibold).foregroundStyle(CPTheme.foreground(scheme)).fixedSize(horizontal: false, vertical: true)
            Text(message).cpFont(12).lineSpacing(2).foregroundStyle(CPTheme.muted(scheme)).lineLimit(isOpen ? nil : 3)
                .fixedSize(horizontal: false, vertical: true)
            HStack(spacing: 14) {
                // Anything that may run past three lines: long, or in paragraphs.
                if message.count > 140 || message.filter(\.isNewline).count >= 2 {
                    Button(isOpen ? "Show less" : "Read full update") { if isOpen { expanded.remove(item.id) } else { expanded.insert(item.id) } }
                }
                if let course = store.bundle.courses.first(where: { $0.id == item.courseID }) {
                    NavigationLink("Open class") { CourseDetailView(course: course, store: store, features: features, initialSection: .announcements) }
                }
            }
            .cpFont(11, .semibold)
            .foregroundStyle(CPTheme.foreground(scheme))
            .buttonStyle(.plain)
            .frame(minHeight: 44)
        }
        .padding(CPLayout.cardPadding)
        .frame(maxWidth: .infinity, alignment: .leading)
        .cpSurface()
        .cpSwipe(trailing: CPSwipeAction(title: "Dismiss", symbol: "eye.slash") { deleteAnnouncement(item) })
    }
    private func announcementDate(_ item: AnnouncementItem) -> String { ISO8601DateFormatter.canvasDate(from: item.postedAt)?.formatted(.dateTime.month(.abbreviated).day().hour().minute()) ?? "Recent" }
}

private struct NativeAnnouncementDayGroup: Identifiable {
    let day: Date
    let items: [AnnouncementItem]
    var id: Date { day }
}

struct AnnouncementDetailView: View {
    @Environment(\.colorScheme) private var scheme
    @Environment(\.cpPalette) private var paletteDependency
    let item: AnnouncementItem
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                VStack(alignment: .leading, spacing: 6) {
                    Text(item.courseName.uppercased()).cpFont(11, .semibold).tracking(0.5).foregroundStyle(CPTheme.foreground(scheme))
                    Text(item.title).cpFont(22, .regular).tracking(-0.6).foregroundStyle(CPTheme.foreground(scheme)).fixedSize(horizontal: false, vertical: true)
                    if let date = ISO8601DateFormatter.canvasDate(from: item.postedAt) {
                        Text(date.formatted(.dateTime.weekday(.wide).month(.wide).day().hour().minute())).cpFont(11).foregroundStyle(CPTheme.muted(scheme))
                    }
                }
                CPRowDivider()
                Text(item.message.strippingHTML).cpFont(13).lineSpacing(4).foregroundStyle(CPTheme.foreground(scheme).opacity(0.9)).textSelection(.enabled)
                    .fixedSize(horizontal: false, vertical: true)
                if let url = URL(string: item.htmlURL), !item.htmlURL.isEmpty {
                    Link(destination: url) { Label("Open in Canvas", systemImage: "arrow.up.right") }.buttonStyle(CPButtonStyle(kind: .secondary))
                }
            }
            .padding(18)
            .frame(maxWidth: .infinity, alignment: .leading)
            .cpSurface(strong: true, radius: 22)
            .cpPagePadding()
        }
        .background(CPBackdrop())
        .cpNavigationTitle("Announcement")
        .navigationBarTitleDisplayMode(.inline)
    }
}

/// The same short list as the website: one switch, this iPhone, what to hear
/// about, and quiet hours. Each choice sets the saved fields that the
/// background check and this phone's own reminders read. Changes save on their own.
private struct NotificationsView: View {
    @Environment(\.scenePhase) private var scenePhase
    @ObservedObject var sessionStore: NativeSessionStore
    @ObservedObject var features: NativeFeatureStore
    @State private var status: String?
    @State private var saved: NotificationPreferences?
    @State private var deviceOn = NativeLocalReminders.deviceEnabled
    @State private var permission: UNAuthorizationStatus = .notDetermined
    private let leads = [5, 15, 30, 60]

    private var prefs: NotificationPreferences { features.notificationPreferences }
    private var off: Bool { !prefs.enabled }
    private var dueOn: Bool { prefs.due1d || prefs.due2d || prefs.due3d || prefs.due1w }
    private var allowed: Bool { permission == .authorized || permission == .provisional || permission == .ephemeral }
    private var deviceText: String {
        if permission == .denied { return "Turned off in iOS Settings" }
        return deviceOn && allowed ? "Arrives even when the app is closed" : "Off on this iPhone"
    }

    var body: some View {
        Form {
            if !features.notificationPreferencesLoaded {
                Section { HStack(spacing: 10) { ProgressView(); Text("Loading your settings…").foregroundStyle(.secondary) } }
            } else {
                Section {
                    row("Notifications", off ? "Off everywhere" : "On for your account", isOn: Binding(get: { prefs.enabled }, set: setNotifications))
                    row("This iPhone", deviceText, isOn: Binding(get: { deviceOn && allowed }, set: { on in Task { await setDevice(on) } }))
                        .disabled(off)
                }
                Section {
                    row("Due dates", "3 days, 2 days and 1 day before", isOn: Binding(get: { dueOn }, set: setDueDates))
                    row("New grades", "When you score \(Int(prefs.gradeThreshold))% or higher", isOn: bind(\.grades))
                    row("Announcements", "New posts from your instructors", isOn: bind(\.announcements))
                    row("Class reminders", "Before each class on your schedule", isOn: Binding(get: { prefs.countdownClass }, set: setClassReminders))
                    if prefs.countdownClass {
                        // One choice keeps it to one reminder per class.
                        Picker("Remind me", selection: Binding(get: { prefs.countdownLeads.first ?? 15 }, set: { features.notificationPreferences.countdownLeads = [$0] })) {
                            ForEach(leads, id: \.self) { minutes in Text(minutes == 60 ? "1 hour" : "\(minutes) min").tag(minutes) }
                        }
                        .pickerStyle(.segmented)
                    }
                    row("Due tonight", "At \(NativeLocalReminders.hourLabel(prefs.countdownTonightHours.first ?? 18)) if something is due by 11:59 PM", isOn: Binding(get: { prefs.countdownTonight }, set: setTonight))
                    row("Streak reminder", "“Don't break your streak!!!” at 6 PM if you haven't opened CoursePro that day", isOn: bind(\.streakReminder))
                } header: {
                    Text("Notify me about")
                } footer: {
                    Text("Due dates, class reminders, due tonight and streak reminders are set on this iPhone, so they arrive with the app closed. New grades and announcements show when the app refreshes.")
                }
                .disabled(off)
                Section {
                    row("Quiet at night", "No notifications \(NativeLocalReminders.hourLabel(prefs.quietStart)) – \(NativeLocalReminders.hourLabel(prefs.quietEnd))", isOn: bind(\.quietEnabled))
                }
                .disabled(off)
                if let status { Section { Text(status).foregroundStyle(.secondary) } }
            }
        }
        .cpListScreen()
        .cpNavigationTitle("Notifications")
        .task {
            await refreshPermission()
            if !features.notificationPreferencesLoaded { await features.load() }
        }
        .task(id: features.notificationPreferences) { await autosave() }
        // Back from iOS Settings: show the new permission.
        .onChange(of: scenePhase) { _, phase in if phase == .active { Task { await refreshPermission() } } }
        // Leaving within the save delay still saves.
        .onDisappear {
            // Leaving straight after a change still saves it, and says so if that fails.
            if let last = saved, last != features.notificationPreferences {
                Task {
                    do { try await features.saveNotifications() }
                    catch { features.errorMessage = "Your notification changes weren't saved. Check your connection and change them again." }
                }
            }
        }
    }

    private func row(_ title: String, _ detail: String, isOn: Binding<Bool>) -> some View {
        Toggle(isOn: isOn) {
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                Text(detail).cpFont(12).foregroundStyle(.secondary)
            }
        }
    }

    private func bind(_ path: WritableKeyPath<NotificationPreferences, Bool>) -> Binding<Bool> {
        Binding(get: { features.notificationPreferences[keyPath: path] }, set: { features.notificationPreferences[keyPath: path] = $0 })
    }

    private func setNotifications(_ on: Bool) {
        features.notificationPreferences.enabled = on
        // Older accounts may have pop-ups muted; turning notifications on means all of them.
        if on { features.notificationPreferences.browserPush = true }
    }

    private func setDueDates(_ on: Bool) {
        features.notificationPreferences.due1d = on
        features.notificationPreferences.due2d = on
        features.notificationPreferences.due3d = on
        if !on { features.notificationPreferences.due1w = false }
    }

    private func setClassReminders(_ on: Bool) {
        features.notificationPreferences.countdownClass = on
        if on && features.notificationPreferences.countdownLeads.isEmpty { features.notificationPreferences.countdownLeads = [15] }
    }

    private func setTonight(_ on: Bool) {
        features.notificationPreferences.countdownTonight = on
        if on && features.notificationPreferences.countdownTonightHours.isEmpty { features.notificationPreferences.countdownTonightHours = [18] }
    }

    private func refreshPermission() async {
        permission = await UNUserNotificationCenter.current().notificationSettings().authorizationStatus
    }

    /// "This iPhone": asks iOS for permission when needed, then turns this
    /// phone's reminders (and Apple push, once available) on or off.
    private func setDevice(_ on: Bool) async {
        let center = UNUserNotificationCenter.current()
        if on {
            if permission == .denied {
                status = "Allow notifications for CoursePro in iOS Settings."
                if let url = URL(string: UIApplication.openSettingsURLString) { _ = await UIApplication.shared.open(url) }
                return
            }
            let granted = (try? await center.requestAuthorization(options: [.alert, .badge, .sound])) ?? false
            await refreshPermission()
            guard granted else {
                // Say why the switch went back off.
                status = "Notifications are off for CoursePro. Turn them on in iOS Settings to get reminders on this iPhone."
                return
            }
        }
        deviceOn = on
        NativeLocalReminders.deviceEnabled = on
        status = nil
        if on {
            UIApplication.shared.registerForRemoteNotifications()
        } else {
            UIApplication.shared.unregisterForRemoteNotifications()
            if let deviceToken = UserDefaults.standard.string(forKey: "CanvasProNativePushToken"), let api = sessionStore.api,
               let access = try? await sessionStore.accessToken() {
                try? await api.deletePushToken(deviceToken, token: access)
                UserDefaults.standard.removeObject(forKey: "CanvasProNativePushToken")
            }
        }
        NotificationCenter.default.post(name: .nativeLocalRemindersChanged, object: nil)
    }

    /// Saves a moment after the last change, like the website.
    private func autosave() async {
        guard features.notificationPreferencesLoaded else { return }
        let current = features.notificationPreferences
        guard let last = saved else { saved = current; return }
        guard last != current else { return }
        try? await Task.sleep(for: .milliseconds(600))
        guard !Task.isCancelled else { return }
        do {
            try await features.saveNotifications()
            saved = current
            status = nil
        } catch {
            // At the bottom of a long form this could go unseen, so it's an alert too.
            status = "Couldn't save. Check your connection and try again."
            features.errorMessage = "Your notification changes weren't saved. Check your connection and try again."
        }
    }
}

private struct AppearanceSettingsCard: View {
    @Environment(\.colorScheme) private var resolvedScheme
    @ObservedObject var features: NativeFeatureStore
    @AppStorage("CanvasProColorScheme") private var scheme = "dark"
    @AppStorage("CanvasProPalette") private var palette = "forest"
    @AppStorage("CanvasProWallpaper") private var wallpaper = "plain"
    @State private var status: String?
    private let columns = [GridItem(.flexible()), GridItem(.flexible())]
    var body: some View {
        CPGlassCard(title: "Appearance", strong: true) {
                    Text("THEME").cpFont(11, .semibold).tracking(1).foregroundStyle(CPTheme.muted(resolvedScheme))
                    LazyVGrid(columns: columns, spacing: 11) {
                        ForEach(CPPalette.allCases) { option in
                            Button { Task { await save("color_theme", option.rawValue) } } label: { PaletteOption(option: option, selected: palette == option.rawValue) }.buttonStyle(.plain)
                        }
                    }
                    Text("MODE").cpFont(11, .semibold).tracking(1).foregroundStyle(CPTheme.muted(resolvedScheme)).padding(.top, 4)
                    LazyVGrid(columns: [GridItem(.flexible(minimum: 0), spacing: 9), GridItem(.flexible(minimum: 0), spacing: 9), GridItem(.flexible(minimum: 0))], spacing: 9) {
                        appearanceButton("light", "Light", "sun.max")
                        appearanceButton("dark", "Dark", "moon")
                        appearanceButton("system", "System", "desktopcomputer")
                    }
                    if scheme == "system" { Text("Follows your iPhone.").cpFont(12).foregroundStyle(CPTheme.muted(resolvedScheme)) }
                    Text("BACKGROUND").cpFont(11, .semibold).tracking(1).foregroundStyle(CPTheme.muted(resolvedScheme)).padding(.top, 4)
                    LazyVGrid(columns: [GridItem(.flexible(minimum: 0), spacing: 9), GridItem(.flexible(minimum: 0), spacing: 9), GridItem(.flexible(minimum: 0))], spacing: 9) {
                        // Solid is the default: one flat color, no gradient.
                        backgroundButton("plain", "Solid", "square.fill")
                        backgroundButton("glow", "Glow", "circle.lefthalf.filled")
                        backgroundButton("wave", "Wallpaper", "photo")
                    }
                    if let status { Text(status).cpFont(12).foregroundStyle(.red) }
        }
    }
    private func appearanceButton(_ value: String, _ title: String, _ symbol: String) -> some View {
        Button { Task { await save("theme", value) } } label: {
            VStack(spacing: 6) { Image(systemName: symbol).cpIconFont(13, .semibold); Text(title).cpFont(11, .semibold); if scheme == value { Image(systemName: "checkmark").cpIconFont(8, .bold) } }
                .frame(maxWidth: .infinity, minHeight: 64).foregroundStyle(scheme == value ? CPTheme.primary(scheme: resolvedScheme) : CPTheme.foreground(resolvedScheme)).background(scheme == value ? CPTheme.primary(scheme: resolvedScheme).opacity(0.10) : CPTheme.inset(resolvedScheme), in: RoundedRectangle(cornerRadius: 12)).overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).strokeBorder(scheme == value ? CPTheme.primary(scheme: resolvedScheme).opacity(0.55) : CPTheme.insetBorder(resolvedScheme), lineWidth: scheme == value ? 1 : 0.5))
        }.buttonStyle(.plain)
    }
    /// The solid palette color, a soft glow of it, or its blurred wallpaper, shared with the website.
    private func backgroundButton(_ value: String, _ title: String, _ symbol: String) -> some View {
        let selected = wallpaper == value
        let accent = CPTheme.primary(scheme: resolvedScheme)
        return Button {
            wallpaper = value
            Task { await save("wallpaper", value) }
        } label: {
            VStack(spacing: 6) { Image(systemName: symbol).cpIconFont(13, .semibold); Text(title).cpFont(11, .semibold); if selected { Image(systemName: "checkmark").cpIconFont(8, .bold) } }
                .frame(maxWidth: .infinity, minHeight: 64)
                .foregroundStyle(selected ? accent : CPTheme.foreground(resolvedScheme))
                .background(selected ? accent.opacity(0.10) : CPTheme.inset(resolvedScheme), in: RoundedRectangle(cornerRadius: 12))
                .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).strokeBorder(selected ? accent.opacity(0.55) : CPTheme.insetBorder(resolvedScheme), lineWidth: selected ? 1 : 0.5))
        }.buttonStyle(.plain)
    }
    private func save(_ key: String, _ value: String) async {
        do { try await features.savePreference(key, value); status = nil }
        catch { status = error.localizedDescription }
    }
}

private struct AnnouncementWindowSettingsView: View {
    @Environment(\.colorScheme) private var scheme
    @Environment(\.cpPalette) private var paletteDependency
    @ObservedObject var features: NativeFeatureStore
    @State private var status: String?
    var body: some View {
        ZStack {
            CPBackdrop()
            ScrollView {
                CPGlassCard(title: "Announcement history", strong: true) {
                    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) { ForEach([1, 2, 4, 0], id: \.self) { value in Button { Task { do { try await features.savePreference("announcement_window_weeks", value); status = nil } catch { status = error.localizedDescription } } } label: { CPChip(text: value == 0 ? "All" : value == 4 ? "1 month" : "\(value) week\(value == 1 ? "" : "s")", selected: features.announcementWeeks == value).frame(maxWidth: .infinity) }.buttonStyle(.plain) } }
                    if let status { Text(status).foregroundStyle(.red) }
                    Text("Older announcements are hidden everywhere.").cpFont(11).foregroundStyle(CPTheme.muted(scheme))
                }.cpPagePadding()
            }
        }.cpNavigationTitle("Announcements").navigationBarTitleDisplayMode(.inline)
    }
}

private struct PaletteOption: View {
    @Environment(\.colorScheme) private var scheme
    @Environment(\.cpPalette) private var paletteDependency
    let option: CPPalette; let selected: Bool
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            ZStack(alignment: .bottomTrailing) {
                HStack(spacing: 6) { RoundedRectangle(cornerRadius: 4).fill(option.swatch.opacity(0.20)).frame(width: 24); VStack(spacing: 6) { RoundedRectangle(cornerRadius: 4).fill(option.swatch.opacity(0.42)); RoundedRectangle(cornerRadius: 4).fill(option.swatch.opacity(0.13)) } }.padding(9).frame(height: 72).background(Color.hsl(option.hue, 0.12, 0.075), in: RoundedRectangle(cornerRadius: 9))
                if selected { Image(systemName: "checkmark").cpIconFont(10, .regular).foregroundStyle(Color.hsl(option.hue, 0.28, 0.08)).frame(width: 20, height: 20).background(option.swatch, in: Circle()).padding(7) }
            }
            Text(option.name).cpFont(12, .semibold).foregroundStyle(CPTheme.foreground(scheme))
        }.padding(8).frame(maxWidth: .infinity, alignment: .leading).background(CPTheme.background(scheme).opacity(0.55), in: RoundedRectangle(cornerRadius: 14)).overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).strokeBorder(selected ? CPTheme.primary(option, scheme: scheme) : CPTheme.border(scheme), lineWidth: selected ? 1 : 0.5))
    }
}

private struct ProfileView: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @ObservedObject var features: NativeFeatureStore
    let email: String?
    @State private var username = ""
    @State private var details = NativeAccountDetails()
    @State private var selectedPhoto: PhotosPickerItem?
    @State private var photoBusy = false
    @State private var saving = false
    @State private var usernameState = "idle"
    @State private var status: String?
    private var normalizedUsername: String { username.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() }
    private var usernameError: String? {
        guard !normalizedUsername.isEmpty else { return nil }
        guard (3...24).contains(normalizedUsername.count) else { return "Use 3–24 characters." }
        guard normalizedUsername.range(of: "^[a-z0-9_]+$", options: .regularExpression) != nil else { return "Lowercase letters, numbers, underscores." }
        return nil
    }
    var body: some View {
        Form {
            Section("Account") {
                LabeledContent("Email", value: email ?? "—")
                TextField("Username", text: $username)
                    .textInputAutocapitalization(.never).autocorrectionDisabled()
                    .textContentType(.username)
                    .onChange(of: username) { _, value in
                        let lowered = value.lowercased()
                        if value != lowered { username = lowered }
                    }
                HStack(spacing: 6) {
                    if usernameState == "checking" { ProgressView().controlSize(.mini) }
                    else if usernameState == "available" { Image(systemName: "checkmark.circle.fill").foregroundStyle(.green) }
                    else if usernameState == "taken" || usernameState == "invalid" { Image(systemName: "xmark.circle.fill").foregroundStyle(.red) }
                    Text(usernameState == "taken" ? "That username is already taken." : usernameState == "invalid" ? (usernameError ?? "Invalid username.") : usernameState == "available" ? "Username is available." : "3–24 lowercase letters, numbers, or underscores.")
                        .cpFont(11)
                        .foregroundStyle(usernameState == "taken" || usernameState == "invalid" ? Color.red : Color.secondary)
                }
            }
            Section("Photo") {
                HStack(spacing: 14) {
                    AsyncImage(url: features.avatarURL, transaction: Transaction(animation: reduceMotion ? nil : .easeInOut(duration: 0.2))) { phase in
                        switch phase {
                        case .success(let image): image.resizable().scaledToFill().transition(.opacity)
                        case .empty: Image(systemName: "person.crop.circle.fill").resizable().foregroundStyle(.secondary)
                        case .failure: Image(systemName: "person.crop.circle.badge.exclamationmark").resizable().foregroundStyle(.secondary)
                        @unknown default: Image(systemName: "person.crop.circle.fill").resizable().foregroundStyle(.secondary)
                        }
                    }
                    .frame(width: 80, height: 80).clipShape(Circle())
                    .animation(reduceMotion ? nil : .easeInOut(duration: 0.2), value: features.avatarURL)
                    PhotosPicker(selection: $selectedPhoto, matching: .images) { [photoLabel = features.profile.avatarPath == nil ? "Add photo" : "Change photo"] in
                        Label(photoLabel, systemImage: "camera")
                    }
                        .disabled(photoBusy)
                    if photoBusy { ProgressView() }
                }
                Text("JPEG, PNG, WebP or GIF, up to 5 MB.").cpFont(11).foregroundStyle(.secondary)
                if features.profile.avatarPath != nil {
                    Button("Remove photo", role: .destructive) { Task { do { photoBusy = true; defer { photoBusy = false }; try await features.removeAvatar(); status = "Photo removed." } catch { status = error.localizedDescription } } }.disabled(photoBusy)
                }
            }
            Section("About you") {
                TextField("First name", text: $details.firstName).textContentType(.givenName)
                TextField("Last name", text: $details.lastName).textContentType(.familyName)
                // Up to 10 letters, so the greeting and widgets stay on one line.
                TextField("Nickname (up to \(NativeAccountDetails.nicknameLimit) letters)", text: $details.nickname)
                    .onChange(of: details.nickname) { _, value in
                        if value.count > NativeAccountDetails.nicknameLimit {
                            details.nickname = String(value.prefix(NativeAccountDetails.nicknameLimit))
                        }
                    }
                TextField("School", text: $details.school)
                TextField("Major", text: $details.major)
                TextField("Class of", text: $details.classOf)
            }
            Section {
                Button {
                    Task {
                        saving = true
                        defer { saving = false }
                        do {
                            try await features.saveAccountDetails(details, username: normalizedUsername)
                            status = "Profile saved."
                            UINotificationFeedbackGenerator().notificationOccurred(.success)
                        } catch { status = error.localizedDescription }
                    }
                } label: { HStack { Spacer(); if saving { ProgressView() } else { Text("Save profile") }; Spacer() } }
                    .disabled(saving || usernameState == "checking" || usernameState == "taken" || usernameState == "invalid")
            }
            if let status { Section { Text(status).foregroundStyle(.secondary) } }
        }
        .cpListScreen()
        .cpNavigationTitle("Profile")
        .onAppear { username = features.profile.username ?? ""; details = features.accountDetails }
        .onChange(of: features.profile.username) { previous, current in
            if username.isEmpty || username == previous { username = current ?? "" }
        }
        .onChange(of: features.accountDetails) { old, current in
            if details == old { details = current }
        }
        .task(id: username) {
            let value = normalizedUsername
            if value.isEmpty || value == features.profile.username { usernameState = "idle"; return }
            if usernameError != nil { usernameState = "invalid"; return }
            usernameState = "checking"
            do {
                try await Task.sleep(for: .milliseconds(350))
                let available = try await features.usernameAvailable(value)
                if !Task.isCancelled { usernameState = available ? "available" : "taken" }
            } catch is CancellationError { }
            catch { if !Task.isCancelled { usernameState = "idle"; status = error.localizedDescription } }
        }
        .onChange(of: selectedPhoto) { _, item in
            guard let item else { return }
            photoBusy = true
            Task {
                defer { photoBusy = false }
                do {
                    guard let data = try await item.loadTransferable(type: Data.self) else { throw NativeAppError.server("Could not read that photo.") }
                    let (imageData, contentType) = try preparedAvatar(data)
                    try await features.uploadAvatar(imageData, contentType: contentType)
                    status = "Photo saved."
                } catch { status = error.localizedDescription }
            }
        }
    }

    private func preparedAvatar(_ data: Data) throws -> (Data, String) {
        let contentType: String?
        if data.starts(with: [0xFF, 0xD8, 0xFF]) { contentType = "image/jpeg" }
        else if data.starts(with: [0x89, 0x50, 0x4E, 0x47]) { contentType = "image/png" }
        else if data.starts(with: Array("GIF8".utf8)) { contentType = "image/gif" }
        else if data.count >= 12 && data.prefix(4).elementsEqual("RIFF".utf8) && data.dropFirst(8).prefix(4).elementsEqual("WEBP".utf8) { contentType = "image/webp" }
        else { contentType = nil }

        if let contentType {
            guard data.count <= 5 * 1024 * 1024 else { throw NativeAppError.server("Photos must be 5 MB or smaller.") }
            return (data, contentType)
        }

        // iPhone libraries commonly contain HEIC; convert it for the same avatar service.
        guard let image = UIImage(data: data) else { throw NativeAppError.server("Choose a JPEG, PNG, WebP or GIF.") }
        let scale = min(1, 1200 / max(image.size.width, image.size.height))
        let size = CGSize(width: image.size.width * scale, height: image.size.height * scale)
        guard size.width > 0 && size.height > 0 else { throw NativeAppError.server("Could not read that photo.") }
        let jpeg = UIGraphicsImageRenderer(size: size).jpegData(withCompressionQuality: 0.82) { _ in image.draw(in: CGRect(origin: .zero, size: size)) }
        guard jpeg.count <= 5 * 1024 * 1024 else { throw NativeAppError.server("Photos must be 5 MB or smaller.") }
        return (jpeg, "image/jpeg")
    }
}

private struct ClassNamesView: View {
    @ObservedObject var store: NativeContentStore
    @State private var drafts: [Int: String] = [:]
    @State private var status: String?
    var body: some View { Form { Section("Class names") { ForEach(store.bundle.courses) { course in VStack(alignment: .leading) { Text(course.name).cpFont(11).foregroundStyle(.secondary); TextField("Nickname", text: Binding(get: { drafts[course.id] ?? store.nicknames[course.id]?.customName ?? "" }, set: { drafts[course.id] = $0 })).onSubmit { save(course) } } } }; Section { Button("Save Class Names") { saveAll() }.disabled(drafts.isEmpty) }; if let status { Section { Text(status) } } }.cpListScreen() }
    private func save(_ course: CourseSummary) { Task { do { try await store.saveNickname(course: course, name: drafts[course.id] ?? ""); status = "Saved." } catch { status = error.localizedDescription } } }
    private func saveAll() { Task { do { for course in store.bundle.courses where drafts[course.id] != nil { try await store.saveNickname(course: course, name: drafts[course.id] ?? "") }; drafts.removeAll(); status = "Class names saved." } catch { status = error.localizedDescription } } }
}

private struct HiddenCoursesView: View {
    @ObservedObject var store: NativeContentStore
    @ObservedObject var features: NativeFeatureStore
    @State private var hidden = Set<Int>()
    @State private var status: String?
    var body: some View {
        List {
            Section {
                ForEach(store.bundle.courses) { course in
                    // On means shown: turning a class off hides it, and its work, everywhere.
                    Toggle(store.displayName(courseID: course.id, fallback: course.name), isOn: Binding(get: { !hidden.contains(course.id) }, set: { shown in if shown { hidden.remove(course.id) } else { hidden.insert(course.id) }; Task { do { try await features.savePreference("hidden_course_ids", Array(hidden).sorted()); status = nil } catch { status = error.localizedDescription; hidden = features.hiddenCourseIDs } } }))
                }
            } header: {
                Text("Shown in CoursePro")
            } footer: {
                Text("Turn a class off to hide it and its work everywhere, on the website too. Turn it back on any time.")
            }
            if let status { Text(status).foregroundStyle(.red) }
        }.cpListScreen().onAppear { hidden = features.hiddenCourseIDs }
    }
}

/// How to make a Canvas key on an iPhone, in plain words. The Canvas Student app
/// can't make one (it keeps its own key hidden), so it's done on the Canvas
/// website in Safari.
struct NativeCanvasKeyGuide: View {
    @Environment(\.colorScheme) private var scheme
    @Environment(\.cpPalette) private var paletteDependency
    @Environment(\.dismiss) private var dismiss
    let address: String?

    private var steps: [(title: String, detail: String)] {
        [
            ("Open Canvas in Safari", "Not the Canvas app; it can't make keys. In Safari, go to \(address ?? "your school's Canvas address") and sign in."),
            ("Go to Settings", "Tap the menu at the top left, then Account, then Settings."),
            ("Make a new key", "Scroll down to Approved Integrations and tap New Access Token."),
            ("Name it", "For Purpose, type CoursePro. Leave Expires empty. Tap Generate Token."),
            ("Copy and paste", "Copy the long code it shows. You only see it once. Come back here and tap Paste."),
        ]
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    CPPageHeader(eyebrow: "About a minute", title: "Get your Canvas key", detail: "A key lets CoursePro read your classes. Your school password is never used.")
                    VStack(alignment: .leading, spacing: 0) {
                        ForEach(Array(steps.enumerated()), id: \.offset) { index, step in
                            HStack(alignment: .top, spacing: 14) {
                                Text("\(index + 1)").cpFont(13, .medium).monospacedDigit()
                                    .foregroundStyle(CPTheme.background(scheme))
                                    .frame(width: 28, height: 28)
                                    .background(CPTheme.foreground(scheme), in: Circle())
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(step.title).cpFont(15, .medium).foregroundStyle(CPTheme.foreground(scheme))
                                    Text(step.detail).cpFont(13).lineSpacing(3).foregroundStyle(CPTheme.muted(scheme))
                                        .fixedSize(horizontal: false, vertical: true)
                                }
                            }
                            .padding(.vertical, 16)
                            .accessibilityElement(children: .combine)
                            if index < steps.count - 1 { CPRowDivider(leading: 42) }
                        }
                    }
                    .padding(.horizontal, CPLayout.cardPadding)
                    .cpSurface()
                    CPNotice(text: "Don't see New Access Token? Your school may have turned keys off. Email support@canvaspro.app and we'll help.", isError: false)
                    Button("Got it") { dismiss() }
                        .buttonStyle(CPButtonStyle(kind: .primary, fullWidth: true))
                }
                .cpPagePadding()
            }
            .background(CPBackdrop())
            .cpNavigationTitle("Your Canvas key")
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}

/// Connecting Canvas in two steps: the school's address, then a token made in
/// Canvas and pasted here. Used from Settings and from the first-run flow.
struct CanvasSettingsView: View {
    private enum Field: Hashable { case domain, token }
    @Environment(\.colorScheme) private var scheme
    @Environment(\.cpPalette) private var paletteDependency
    @ObservedObject var store: NativeContentStore
    @FocusState private var focus: Field?
    @State private var domain = ""
    @State private var canvasToken = ""
    @State private var working = false
    @State private var status: String?
    @State private var statusIsError = false
    @State private var connectedDomain: String?
    @State private var savedCount = 0
    @State private var showKeyGuide = false

    private var cleanDomain: String {
        var value = domain.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        value = value.replacingOccurrences(of: "https://", with: "")
        value = value.replacingOccurrences(of: "http://", with: "")
        value = value.split(separator: "/").first.map(String.init) ?? value
        return value.trimmingCharacters(in: CharacterSet(charactersIn: "."))
    }
    private var domainLooksValid: Bool { cleanDomain.range(of: "^[a-z0-9-]+(\\.[a-z0-9-]+)+$", options: .regularExpression) != nil }
    private var trimmedToken: String { canvasToken.trimmingCharacters(in: .whitespacesAndNewlines) }
    private var canSave: Bool { domainLooksValid && trimmedToken.count >= 20 && !working }

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 16) {
                if let connectedDomain { connectedCard(connectedDomain) }
                NativeSyncStatusCard(store: store) { Task { await store.load() } }
                step(1, title: "Your Canvas address") {
                    CPFieldBox(title: "Address", focused: focus == .domain) {
                        TextField("yourschool.instructure.com", text: $domain)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                            .keyboardType(.URL)
                            .textContentType(.URL)
                            .focused($focus, equals: .domain)
                            .submitLabel(.next)
                            .onSubmit { focus = .token }
                    }
                    if domainLooksValid {
                        Label(cleanDomain, systemImage: "checkmark.circle").cpFont(12).foregroundStyle(CPTheme.muted(scheme))
                    } else {
                        Text("Copy it from your browser's address bar.")
                            .cpFont(12).foregroundStyle(CPTheme.muted(scheme)).fixedSize(horizontal: false, vertical: true)
                    }
                }
                step(2, title: "Your access token") {
                    Text("In Canvas: Account, Settings, Approved Integrations, New Access Token.")
                        .cpFont(12).lineSpacing(2).foregroundStyle(CPTheme.muted(scheme)).fixedSize(horizontal: false, vertical: true)
                    Button { showKeyGuide = true } label: {
                        Label("How do I get my key?", systemImage: "questionmark.circle")
                    }
                    .buttonStyle(CPButtonStyle(kind: .quiet, fullWidth: true))
                    CPFieldBox(title: "Access token", focused: focus == .token) {
                        SecureField("Paste the token", text: $canvasToken)
                            .focused($focus, equals: .token)
                            .submitLabel(.done)
                            .onSubmit { if canSave { save() } }
                    }
                    PasteButton(payloadType: String.self) { strings in
                        if let first = strings.first { canvasToken = first.trimmingCharacters(in: .whitespacesAndNewlines) }
                    }
                    .labelStyle(.titleAndIcon)
                    .buttonBorderShape(.capsule)
                    .tint(CPTheme.foreground(scheme))
                }
                if let status { CPNotice(text: status, isError: statusIsError) }
                Button(action: save) {
                    HStack(spacing: 8) {
                        if working { ProgressView().tint(CPTheme.background(scheme)) }
                        Text(working ? "Checking Canvas…" : connectedDomain == nil ? "Connect Canvas" : "Save connection")
                    }
                }
                .buttonStyle(CPButtonStyle(kind: .primary, fullWidth: true))
                .disabled(!canSave)
                HStack(alignment: .top, spacing: 8) {
                    Image(systemName: "lock").cpIconFont(11).foregroundStyle(CPTheme.faint(scheme)).padding(.top, 2)
                    Text("Your school password is never used. Replace the token any time.")
                        .cpFont(11).lineSpacing(2).foregroundStyle(CPTheme.faint(scheme)).fixedSize(horizontal: false, vertical: true)
                }
                .padding(.horizontal, 4)
            }
            .cpPagePadding()
        }
        .scrollDismissesKeyboard(.interactively)
        .background(CPBackdrop())
        .cpNavigationTitle("Canvas")
        .navigationBarTitleDisplayMode(.inline)
        .sensoryFeedback(.success, trigger: savedCount)
        .sheet(isPresented: $showKeyGuide) {
            NativeCanvasKeyGuide(address: domainLooksValid ? cleanDomain : nil)
                .presentationDetents([.large])
                .presentationDragIndicator(.visible)
        }
        .task {
            connectedDomain = await store.connectedCanvasDomain()
            if domain.isEmpty, let connectedDomain { domain = connectedDomain }
        }
    }

    private func connectedCard(_ address: String) -> some View {
        CPGlassCard {
            HStack(spacing: 12) {
                Image(systemName: "checkmark").cpIconFont(12, .semibold)
                    .foregroundStyle(CPTheme.foreground(scheme))
                    .frame(width: 32, height: 32)
                    .background(CPTheme.inset(scheme), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                VStack(alignment: .leading, spacing: 2) {
                    Text("Connected").cpFont(14, .medium).foregroundStyle(CPTheme.foreground(scheme))
                    Text(address).cpFont(12, design: .monospaced).foregroundStyle(CPTheme.muted(scheme)).lineLimit(1)
                }
                Spacer(minLength: 0)
            }
            .accessibilityElement(children: .combine)
        }
    }

    private func step<Inner: View>(_ number: Int, title: String, @ViewBuilder content: () -> Inner) -> some View {
        CPGlassCard {
            HStack(spacing: 10) {
                Text("\(number)").cpFont(12, .medium).monospacedDigit()
                    .foregroundStyle(CPTheme.foreground(scheme))
                    .frame(width: 24, height: 24)
                    .overlay(Circle().strokeBorder(CPTheme.foreground(scheme).opacity(0.3), lineWidth: 0.5))
                Text(title).cpFont(15).tracking(-0.2).foregroundStyle(CPTheme.foreground(scheme))
            }
            .accessibilityElement(children: .combine)
            .accessibilityAddTraits(.isHeader)
            content()
        }
    }

    private func save() {
        guard canSave else { return }
        focus = nil
        working = true
        status = nil
        Task {
            defer { working = false }
            do {
                try await store.saveCanvas(domain: cleanDomain, canvasToken: trimmedToken)
                domain = cleanDomain
                connectedDomain = cleanDomain
                canvasToken = ""
                statusIsError = false
                let count = store.bundle.courses.count
                status = count > 0 ? "Connected. \(count) \(count == 1 ? "class" : "classes") found." : "Connected."
                savedCount += 1
            } catch {
                statusIsError = true
                status = Self.plainMessage(error)
            }
        }
    }

    /// The common failures, in one plain line each.
    private static func plainMessage(_ error: Error) -> String {
        let text = error.localizedDescription
        let lower = text.lowercased()
        if lower.contains("401") || lower.contains("unauthor") || lower.contains("invalid") || lower.contains("token") && lower.contains("expired") {
            return "That token didn't work. Make a new one and paste it."
        }
        if lower.contains("404") || lower.contains("could not be found") || lower.contains("hostname") || lower.contains("domain") {
            return "Check the address and try again."
        }
        if lower.contains("offline") || lower.contains("internet") || lower.contains("network") || lower.contains("timed out") {
            return "No connection. Try again."
        }
        return text
    }
}

struct ClassScheduleView: View {
    @ObservedObject var features: NativeFeatureStore
    var store: NativeContentStore? = nil
    @State private var showAdd = false
    @State private var editing: ClassScheduleEntry?
    /// Asked first: deleting a class removes it from every day it meets.
    @State private var confirmingDelete: ClassScheduleEntry?
    private let days = [("M", "Monday"), ("T", "Tuesday"), ("W", "Wednesday"), ("R", "Thursday"), ("F", "Friday"), ("S", "Saturday"), ("U", "Sunday")]
    private func displayName(_ entry: ClassScheduleEntry) -> String {
        guard let store else { return entry.title }
        func normalized(_ value: String) -> String { value.lowercased().filter { $0.isLetter || $0.isNumber } }
        let names = [entry.title, entry.code].map(normalized).filter { !$0.isEmpty }
        guard let course = store.bundle.courses.first(where: { course in
            if entry.canvasCourseID == course.id { return true }
            let candidates = [course.name, course.courseCode, store.displayName(courseID: course.id, fallback: course.name)].map(normalized)
            return names.contains { name in candidates.contains { $0 == name || (name.count > 3 && $0.contains(name)) } }
        }) else { return entry.title }
        return store.displayName(courseID: course.id, fallback: course.name)
    }
    private var credits: Double { var seen = Set<String>(); return features.schedule.reduce(0) { total, entry in let key = entry.title.lowercased(); guard seen.insert(key).inserted else { return total }; return total + entry.credits } }
    private var conflicts: [String] { var result: [String] = []; for i in features.schedule.indices { for j in features.schedule.indices where j > i { let a = features.schedule[i], b = features.schedule[j]; if a.title != b.title && !Set(a.days).isDisjoint(with: b.days) && a.startMinutes < b.endMinutes && b.startMinutes < a.endMinutes { result.append("\(a.title) overlaps \(b.title)") } } }; return result }
    private var classCount: Int { Set(features.schedule.map { $0.title.lowercased() }).count }

    /// Each day's classes; tap one to edit it, swipe to delete it.
    var body: some View {
        List {
            if features.schedule.isEmpty {
                Section {
                    VStack(spacing: 12) {
                        NativeEmptyState(title: "No classes yet", symbol: "calendar.badge.plus")
                        Button { showAdd = true } label: { Label("Add a class", systemImage: "plus") }
                            .buttonStyle(CPButtonStyle(kind: .primary))
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 8)
                }
            } else {
                Section {
                    LabeledContent("Classes", value: "\(classCount)")
                    LabeledContent("Credits", value: credits.formatted())
                    ForEach(conflicts, id: \.self) { conflict in
                        Label(conflict, systemImage: "exclamationmark.triangle").cpFont(13).foregroundStyle(.orange)
                    }
                }
                ForEach(days.indices, id: \.self) { index in
                    let day = days[index]
                    let meetings = features.schedule.filter { $0.days.contains(day.0) }.sorted { $0.startMinutes < $1.startMinutes }
                    if !meetings.isEmpty {
                        Section(day.1) {
                            ForEach(meetings) { item in
                                Button { editing = item } label: { meetingRow(item) }
                                    .buttonStyle(.plain)
                                    .swipeActions {
                                        Button(role: .destructive) { confirmingDelete = item } label: { Label("Delete", systemImage: "trash") }
                                    }
                            }
                        }
                    }
                }
            }
        }
        .cpListScreen()
        .cpNavigationTitle("My Classes")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button { showAdd = true } label: { Image(systemName: "plus") }
                    .accessibilityLabel("Add a class")
            }
        }
        .sheet(isPresented: $showAdd) { AddScheduleView(features: features) }
        .sheet(item: $editing) { AddScheduleView(features: features, editing: $0) }
        .confirmationDialog(
            "Delete \(confirmingDelete.map(displayName) ?? "this class") from every day?",
            isPresented: deleteQuestion,
            titleVisibility: .visible,
            presenting: confirmingDelete
        ) { item in
            Button("Delete class", role: .destructive) { delete(item) }
        } message: { _ in
            Text("It comes off your schedule and calendar on every day it meets.")
        }
    }

    /// The class, then "9:00 – 9:50 AM · Room 204".
    private func meetingRow(_ item: ClassScheduleEntry) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(displayName(item)).cpFont(15, .medium).foregroundStyle(.primary)
                .fixedSize(horizontal: false, vertical: true)
            Text(["\(time(item.startMinutes)) – \(time(item.endMinutes))", item.location].filter { !$0.isEmpty }.joined(separator: " · "))
                .cpFont(12).monospacedDigit().foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
        }
        .padding(.vertical, 2)
        .frame(maxWidth: .infinity, alignment: .leading)
        .contentShape(Rectangle())
    }

    private func delete(_ item: ClassScheduleEntry) {
        Task { await NativeScheduleActions.delete(item, features: features) }
    }

    private var deleteQuestion: Binding<Bool> {
        Binding(get: { confirmingDelete != nil }, set: { if !$0 { confirmingDelete = nil } })
    }

    private func time(_ minutes: Int) -> String { let hour = minutes / 60; let minute = minutes % 60; return String(format: "%d:%02d %@", hour % 12 == 0 ? 12 : hour % 12, minute, hour < 12 ? "AM" : "PM") }
}

private struct AddScheduleView: View {
    @Environment(\.dismiss) private var dismiss
    @ObservedObject var features: NativeFeatureStore
    var editing: ClassScheduleEntry? = nil
    @State private var title = ""; @State private var code = ""; @State private var location = ""; @State private var instructor = ""; @State private var credits = ""; @State private var selectedDays = Set<String>(); @State private var start = Date(); @State private var end = Date().addingTimeInterval(3600); @State private var error: String?
    @State private var perDay = false
    @State private var confirmingDelete = false
    @State private var dayStarts: [String: Date] = [:]
    @State private var dayEnds: [String: Date] = [:]
    @State private var loaded = false
    private let days = ["M", "T", "W", "R", "F", "S", "U"]
    var body: some View {
        NavigationStack {
            Form {
                Section("Class") { TextField("Title", text: $title); TextField("Course code", text: $code); TextField("Credits", text: $credits).keyboardType(.decimalPad); TextField("Location", text: $location); TextField("Instructor", text: $instructor) }
                Section("Meets") { LazyVGrid(columns: Array(repeating: GridItem(.flexible(minimum: 0)), count: 4), spacing: 8) { ForEach(days, id: \.self) { day in Button(NativeWeekday.short(day)) { if selectedDays.contains(day) { selectedDays.remove(day) } else { selectedDays.insert(day); dayStarts[day] = start; dayEnds[day] = end } }.buttonStyle(.borderedProminent).tint(selectedDays.contains(day) ? Color.accentColor : .gray).frame(maxWidth: .infinity).accessibilityLabel(NativeWeekday.full(day)).accessibilityAddTraits(selectedDays.contains(day) ? .isSelected : []) } }; Toggle("Different times by day", isOn: $perDay); if perDay { ForEach(days.filter { selectedDays.contains($0) }, id: \.self) { day in Text(NativeWeekday.full(day)).cpFont(12).foregroundStyle(.secondary); DatePicker("Starts", selection: Binding(get: { dayStarts[day] ?? start }, set: { dayStarts[day] = $0 }), displayedComponents: .hourAndMinute); DatePicker("Ends", selection: Binding(get: { dayEnds[day] ?? end }, set: { dayEnds[day] = $0 }), displayedComponents: .hourAndMinute) } } else { DatePicker("Starts", selection: $start, displayedComponents: .hourAndMinute); DatePicker("Ends", selection: $end, displayedComponents: .hourAndMinute) } }
                if let error { Section { Text(error).foregroundStyle(.red) } }
                if let editing {
                    Section {
                        Button("Delete class", role: .destructive) { confirmingDelete = true }
                            .confirmationDialog("Delete this class from every day?", isPresented: $confirmingDelete, titleVisibility: .visible) {
                                Button("Delete class", role: .destructive) {
                                    Task {
                                        if let message = await NativeScheduleActions.delete(editing, features: features) { error = message } else { dismiss() }
                                    }
                                }
                            }
                    }
                }
            }.cpListScreen().cpNavigationTitle(editing == nil ? "Add Class" : "Edit Class").toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }; ToolbarItem(placement: .confirmationAction) { Button("Save") { save() }.disabled(title.trimmingCharacters(in: .whitespaces).isEmpty || selectedDays.isEmpty) } }.onAppear { loadEditing() }
        }
    }
    private func save() {
        let cal = Calendar.current
        let chosenDays = days.filter(selectedDays.contains)
        let groups = perDay ? chosenDays.map { [$0] } : [chosenDays]
        let entries: [ClassScheduleEntry] = groups.compactMap { group in
            let startDate = perDay ? (dayStarts[group[0]] ?? start) : start
            let endDate = perDay ? (dayEnds[group[0]] ?? end) : end
            let startMinutes = cal.component(.hour, from: startDate) * 60 + cal.component(.minute, from: startDate)
            let endMinutes = cal.component(.hour, from: endDate) * 60 + cal.component(.minute, from: endDate)
            guard endMinutes > startMinutes else { return nil }
            return ClassScheduleEntry(id: group == groups.first ? (editing?.id ?? "") : "", code: code, section: editing?.section ?? "", title: title.trimmingCharacters(in: .whitespaces), crn: editing?.crn ?? "", credits: Double(credits) ?? 0, instructor: instructor, location: location, campus: editing?.campus ?? "", scheduleType: editing?.scheduleType ?? "Lecture", days: group, startMinutes: startMinutes, endMinutes: endMinutes, term: editing?.term ?? "", dateRange: editing?.dateRange ?? "", canvasCourseID: editing?.canvasCourseID)
        }
        guard entries.count == groups.count else { error = "End time must be after start time on every selected day."; return }
        Task {
            do {
                if features.isPreview {
                    if let editing { features.schedule.removeAll { $0.id == editing.id } }
                    features.schedule += entries.map { entry in var value = entry; if value.id.isEmpty { value.id = "preview-\(UUID().uuidString)" }; return value }
                    features.persistPreviewState()
                    dismiss()
                    return
                }
                guard let api = features.sessionStore.api, let user = features.sessionStore.session?.user else { return }
                let token = try await features.sessionStore.accessToken()
                for entry in entries { try await api.saveScheduleEntry(entry, token: token, userID: user.id) }
                await features.load()
                dismiss()
            } catch { self.error = error.localizedDescription }
        }
    }
    private func loadEditing() { guard !loaded, let editing else { return }; loaded = true; title = editing.title; code = editing.code; location = editing.location; instructor = editing.instructor; credits = editing.credits == 0 ? "" : editing.credits.formatted(); selectedDays = Set(editing.days); start = timeDate(editing.startMinutes); end = timeDate(editing.endMinutes); for day in editing.days { dayStarts[day] = start; dayEnds[day] = end } }
    private func timeDate(_ minutes: Int) -> Date { Calendar.current.date(bySettingHour: minutes / 60, minute: minutes % 60, second: 0, of: Date()) ?? Date() }
}

enum NativeScheduleActions {
    /// Deletes one class from the schedule. Returns an error message, or nil.
    @MainActor @discardableResult
    static func delete(_ item: ClassScheduleEntry, features: NativeFeatureStore) async -> String? {
        if features.isPreview {
            features.schedule.removeAll { $0.id == item.id }
            features.persistPreviewState()
            return nil
        }
        guard let api = features.sessionStore.api else { return nil }
        // Gone from the list at once; put back if the server says no.
        let before = features.schedule
        features.schedule.removeAll { $0.id == item.id }
        do {
            try await api.deleteScheduleEntry(id: item.id, token: try await features.sessionStore.accessToken())
            await features.load()
            return nil
        } catch {
            features.schedule = before
            features.errorMessage = error.localizedDescription
            return error.localizedDescription
        }
    }
}

/// Schedule entries store days as single letters (R = Thursday, U = Sunday).
enum NativeWeekday {
    static func short(_ code: String) -> String {
        ["M": "Mon", "T": "Tue", "W": "Wed", "R": "Thu", "F": "Fri", "S": "Sat", "U": "Sun"][code] ?? code
    }
    static func full(_ code: String) -> String {
        ["M": "Monday", "T": "Tuesday", "W": "Wednesday", "R": "Thursday", "F": "Friday", "S": "Saturday", "U": "Sunday"][code] ?? code
    }
}

/// The current policies, served from canvaspro.app so the app never shows an outdated copy.
enum NativeLegalPage: String, Identifiable {
    case privacy, terms
    var id: String { rawValue }
    var title: String { self == .privacy ? "Privacy Policy" : "Terms of Use" }
    var url: URL { NativeConfiguration.websiteURL.appendingPathComponent(rawValue) }
}

struct NativeSafariView: UIViewControllerRepresentable {
    let url: URL
    func makeUIViewController(context: Context) -> SFSafariViewController {
        let controller = SFSafariViewController(url: url)
        controller.dismissButtonStyle = .done
        return controller
    }
    func updateUIViewController(_ controller: SFSafariViewController, context: Context) {}
}

/// "Terms" and "Privacy" links that open the live pages in an in-app browser.
struct NativeLegalLinks: View {
    let compact: Bool
    @State private var page: NativeLegalPage?
    var body: some View {
        HStack(spacing: compact ? 16 : 20) {
            Button(compact ? "Terms" : "Terms of Use") { page = .terms }
            Button(compact ? "Privacy" : "Privacy Policy") { page = .privacy }
        }
        .cpFont(compact ? 12 : 13)
        .frame(minHeight: 44)
        .sheet(item: $page) { page in NativeSafariView(url: page.url).ignoresSafeArea() }
    }
}

/// Shown wherever coursework would appear while the account has no Canvas connection.
struct NativeConnectCanvasCard: View {
    @Environment(\.colorScheme) private var scheme
    @Environment(\.cpPalette) private var paletteDependency
    @ObservedObject var store: NativeContentStore
    var body: some View {
        CPGlassCard(strong: true) {
            CPIconBadge(symbol: "link")
            VStack(alignment: .leading, spacing: 4) {
                Text("Connect Canvas").cpFont(22, .regular).tracking(-0.6).foregroundStyle(CPTheme.foreground(scheme))
                    .accessibilityAddTraits(.isHeader)
                Text("Add your school's Canvas to see your classes.")
                    .cpFont(13).lineSpacing(2).foregroundStyle(CPTheme.muted(scheme)).fixedSize(horizontal: false, vertical: true)
            }
            NavigationLink { CanvasSettingsView(store: store) } label: {
                Label("Get started", systemImage: "arrow.right")
            }
            .buttonStyle(CPButtonStyle(kind: .primary, fullWidth: true))
            HStack(spacing: 6) {
                Image(systemName: "lock").cpIconFont(10)
                Text("Your school password is never used.").cpFont(11)
            }
            .foregroundStyle(CPTheme.faint(scheme))
        }
    }
}

/// The first refresh failed and there is nothing saved to show instead.
struct NativeLoadFailedCard: View {
    @ObservedObject var store: NativeContentStore
    var body: some View {
        CPGlassCard {
            NativeEmptyState(title: "Couldn't load your classes", symbol: "wifi.exclamationmark", detail: store.loadFailure)
            Button { Task { await store.load() } } label: {
                HStack(spacing: 8) {
                    if store.isLoading { ProgressView().controlSize(.small) }
                    Text(store.isLoading ? "Trying…" : "Try again")
                }
            }
            .buttonStyle(CPButtonStyle(kind: .secondary, fullWidth: true))
            .disabled(store.isLoading)
        }
    }
}

// MARK: - Completed

/// Everything finished (ticked off here or done in Canvas), most recent first.
/// A page of its own: the tab bar hides and the back arrow returns.
struct NativeCompletedView: View {
    @Environment(\.colorScheme) private var scheme
    @Environment(\.cpPalette) private var paletteDependency
    @ObservedObject var store: NativeContentStore
    @ObservedObject var features: NativeFeatureStore
    @State private var search = ""

    private struct Entry: Identifiable {
        let item: AssignmentItem
        let date: Date?
        let inCanvas: Bool
        var id: Int { item.id }
    }

    private var entries: [Entry] {
        features.shownAssignments(in: store)
            .filter { $0.isFinished(in: store) }
            .map { item in
                let marked = store.completed.contains(item.id)
                let submitted = item.submission?.submittedAt.flatMap { ISO8601DateFormatter.canvasDate(from: $0) }
                return Entry(item: item, date: (marked ? store.completedAt[item.id] : nil) ?? submitted ?? item.dueDate, inCanvas: !marked)
            }
            .sorted { ($0.date ?? .distantPast) > ($1.date ?? .distantPast) }
    }

    private var shown: [Entry] {
        let query = search.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !query.isEmpty else { return entries }
        return entries.filter { entry in
            entry.item.name.localizedCaseInsensitiveContains(query) ||
                store.displayName(courseID: entry.item.courseID, fallback: entry.item.courseName).localizedCaseInsensitiveContains(query)
        }
    }

    var body: some View {
        let all = entries
        let groups = NativeCompletedGroups.groups(shown, date: \.date)
        ScrollView {
            LazyVStack(alignment: .leading, spacing: CPLayout.stack) {
                if all.isEmpty {
                    CPGlassCard {
                        NativeEmptyState(title: "Nothing finished yet.", symbol: "checkmark.circle")
                    }
                } else {
                    searchField
                    if groups.isEmpty {
                        CPGlassCard { NativeEmptyState(title: "No matches", symbol: "magnifyingglass") }
                    }
                    ForEach(groups, id: \.title) { group in
                        VStack(alignment: .leading, spacing: 8) {
                            CPSectionLabel(group.title, count: group.items.count)
                            VStack(spacing: 0) {
                                ForEach(group.items) { entry in
                                    row(entry)
                                        .transition(.cpCompletionExit)
                                    if entry.id != group.items.last?.id { CPRowDivider(leading: 34) }
                                }
                            }
                            .padding(.horizontal, 14)
                            .cpSurface()
                        }
                    }
                }
            }
            .cpPagePadding()
        }
        .background(CPBackdrop())
        .scrollDismissesKeyboard(.immediately)
        .cpNavigationTitle("Completed")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(.hidden, for: .tabBar)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Text("\(all.count) finished").cpFont(12).monospacedDigit().foregroundStyle(CPTheme.muted(scheme))
            }
        }
    }

    private var searchField: some View {
        HStack(spacing: 10) {
            Image(systemName: "magnifyingglass").cpIconFont(13).foregroundStyle(CPTheme.muted(scheme))
            TextField("Find a finished assignment or class", text: $search)
                .cpFont(14)
                .submitLabel(.search)
                .autocorrectionDisabled()
        }
        .padding(.horizontal, 14)
        .frame(minHeight: 44)
        .background(CPTheme.inset(scheme), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).strokeBorder(CPTheme.insetBorder(scheme), lineWidth: 0.5))
    }

    private func row(_ entry: Entry) -> some View {
        HStack(alignment: .top, spacing: 12) {
            // Unticking puts it back on the lists.
            NativeCompletionButton(assignment: entry.item, store: store).padding(.top, 1)
            VStack(alignment: .leading, spacing: 3) {
                Text(entry.item.name).cpFont(15, .medium).foregroundStyle(CPTheme.foreground(scheme))
                    .fixedSize(horizontal: false, vertical: true)
                Text("\(store.displayName(courseID: entry.item.courseID, fallback: entry.item.courseName)) · \(entry.inCanvas ? "Done in Canvas" : "Marked done")")
                    .cpFont(12).foregroundStyle(CPTheme.muted(scheme)).fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 8)
            if let date = entry.date {
                Text(date.formatted(.dateTime.month(.abbreviated).day()))
                    .cpFont(12).monospacedDigit().foregroundStyle(CPTheme.muted(scheme)).fixedSize()
            }
        }
        .padding(.vertical, 12)
        .accessibilityElement(children: .contain)
    }
}

/// "Today", "Yesterday", "Past week", "Earlier", the same groups as the website.
enum NativeCompletedGroups {
    struct Group<Item> {
        let title: String
        let items: [Item]
    }

    static func label(for date: Date?, now: Date = Date(), calendar: Calendar = .current) -> String {
        guard let date else { return "Earlier" }
        let today = calendar.startOfDay(for: now)
        if date >= today { return "Today" }
        if date >= today.addingTimeInterval(-86400) { return "Yesterday" }
        if date >= today.addingTimeInterval(-6 * 86400) { return "Past week" }
        return "Earlier"
    }

    static func groups<Item>(_ items: [Item], date: KeyPath<Item, Date?>, now: Date = Date()) -> [Group<Item>] {
        ["Today", "Yesterday", "Past week", "Earlier"].compactMap { title in
            let matching = items.filter { label(for: $0[keyPath: date], now: now) == title }
            return matching.isEmpty ? nil : Group(title: title, items: matching)
        }
    }
}
