import SwiftUI
import UserNotifications
import PhotosUI
import SafariServices
import UIKit

/// A grouped list row in the style of the iPhone Settings app.
struct NativeMenuRow: View {
    @Environment(\.colorScheme) private var scheme
    @Environment(\.cpPalette) private var paletteDependency
    let title: String
    var detail: String? = nil
    let symbol: String
    var tint: Color? = nil
    var trailingSymbol = "chevron.right"
    var body: some View {
        HStack(spacing: 12) {
            CPIconBadge(symbol: symbol)
            VStack(alignment: .leading, spacing: 1) {
                Text(title).cpFont(13, .medium).foregroundStyle(CPTheme.foreground(scheme))
                if let detail { Text(detail).cpFont(11).foregroundStyle(CPTheme.muted(scheme)).lineLimit(1) }
            }
            Spacer(minLength: 8)
            Image(systemName: trailingSymbol).cpIconFont(9, .bold).foregroundStyle(CPTheme.faint(scheme))
        }
        .frame(minHeight: 50)
        .contentShape(Rectangle())
    }
}

/// Rows separated by inset hairlines inside one card.
struct NativeMenuGroup<Content: View>: View {
    let title: String?
    let content: Content
    init(_ title: String? = nil, @ViewBuilder content: () -> Content) { self.title = title; self.content = content() }
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            if let title { CPSectionLabel(title) }
            VStack(spacing: 0) { content }
                .padding(.horizontal, 14)
                .cpSurface()
        }
    }
}

private enum NativeMenuTint {
    static let blue = Color.hsl(214, 0.62, 0.60)
    static let violet = Color.hsl(266, 0.50, 0.66)
    static let orange = Color.hsl(28, 0.80, 0.60)
    static let rose = Color.hsl(345, 0.60, 0.66)
    static let teal = Color.hsl(180, 0.45, 0.52)
    static let gray = Color.hsl(220, 0.08, 0.58)
}

struct NativeMoreView: View {
    @Environment(\.colorScheme) private var scheme
    @Environment(\.cpPalette) private var paletteDependency
    @ObservedObject var store: NativeContentStore
    @ObservedObject var features: NativeFeatureStore
    @ObservedObject var sessionStore: NativeSessionStore

    private var fullName: String {
        let name = "\(features.accountDetails.firstName) \(features.accountDetails.lastName)".trimmingCharacters(in: .whitespacesAndNewlines)
        return name.isEmpty ? (features.profile.username ?? "Your profile") : name
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    NavigationLink { ProfileView(features: features, email: sessionStore.session?.user.email) } label: {
                        HStack(spacing: 12) {
                            NativeAvatar(url: features.avatarURL, size: 46)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(fullName).cpFont(15, .semibold).foregroundStyle(CPTheme.foreground(scheme))
                                Text(sessionStore.session?.user.email ?? "Photo, name, school, and major").cpFont(11).foregroundStyle(CPTheme.muted(scheme)).lineLimit(1)
                            }
                            Spacer(minLength: 8)
                            Image(systemName: "chevron.right").cpIconFont(9, .bold).foregroundStyle(CPTheme.faint(scheme))
                        }
                        .padding(CPLayout.cardPadding)
                        .cpSurface(strong: true)
                    }
                    .buttonStyle(CPPressStyle())

                    NativeMenuGroup("Plan") {
                        NavigationLink { NativeCalendarHub(store: store, features: features) } label: {
                            NativeMenuRow(title: "Calendar", symbol: "calendar", tint: NativeMenuTint.blue)
                        }.buttonStyle(CPPressStyle())
                    }
                    NativeMenuGroup("Account") {
                        NavigationLink { NotificationsView(sessionStore: sessionStore, features: features) } label: {
                            NativeMenuRow(title: "Notifications", symbol: "bell", tint: NativeMenuTint.rose)
                        }.buttonStyle(CPPressStyle())
                        CPRowDivider(leading: 40)
                        NavigationLink { NativeSettingsView(contentStore: store, features: features, sessionStore: sessionStore) } label: {
                            NativeMenuRow(title: "Settings", symbol: "gearshape", tint: NativeMenuTint.gray)
                        }.buttonStyle(CPPressStyle())
                    }
                }
                .cpPagePadding()
            }
            .background(CPBackdrop())
            .cpNavigationTitle("More")
            .navigationBarTitleDisplayMode(.inline)
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

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                CPPageHeader(eyebrow: "Your account", title: "Settings", detail: nil)
                NativeMenuGroup("Personal") {
                    NavigationLink { ProfileView(features: features, email: sessionStore.session?.user.email) } label: {
                        NativeMenuRow(title: "Profile", symbol: "person.crop.circle", tint: NativeMenuTint.blue)
                    }.buttonStyle(CPPressStyle())
                    CPRowDivider(leading: 40)
                    settingsLink("Appearance", detail: nil, "paintpalette", tint: NativeMenuTint.violet) { NativeAppearanceView(features: features) }
                }
                NativeMenuGroup("Classes") {
                    settingsLink("Canvas connection", detail: nil, "link", tint: NativeMenuTint.teal) { CanvasSettingsView(store: contentStore) }
                    CPRowDivider(leading: 40)
                    settingsLink("Class settings", detail: nil, "graduationcap", tint: NativeMenuTint.blue) { NativeClassSettingsView(store: contentStore, features: features) }
                    CPRowDivider(leading: 40)
                    settingsLink("Announcements", detail: nil, "megaphone", tint: NativeMenuTint.orange) { AnnouncementWindowSettingsView(features: features) }
                }
                NativeMenuGroup("App") {
                    settingsLink("Notifications", detail: nil, "bell", tint: NativeMenuTint.rose) { NotificationsView(sessionStore: sessionStore, features: features) }
                    CPRowDivider(leading: 40)
                    settingsLink("AI assistant", detail: nil, "sparkles", tint: NativeMenuTint.violet) { NativeAIConnectionView() }
                    CPRowDivider(leading: 40)
                    settingsLink("Account", detail: nil, "person.crop.circle.badge.xmark", tint: NativeMenuTint.gray) { NativeDeleteAccountView(sessionStore: sessionStore) }
                }
                NativeMenuGroup("Legal") {
                    legalRow(.privacy, "hand.raised")
                    CPRowDivider(leading: 40)
                    legalRow(.terms, "doc.text")
                }
                Button("Sign out") { Task { await sessionStore.signOut() } }
                    .buttonStyle(CPButtonStyle(kind: .quiet, fullWidth: true))
                    .foregroundStyle(CPTheme.danger)
            }
            .cpPagePadding()
        }
        .background(CPBackdrop())
        .cpNavigationTitle("Settings")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(item: $legalPage) { page in NativeSafariView(url: page.url).ignoresSafeArea() }
    }

    private func legalRow(_ page: NativeLegalPage, _ symbol: String) -> some View {
        Button { legalPage = page } label: {
            NativeMenuRow(title: page.title, symbol: symbol, tint: NativeMenuTint.gray, trailingSymbol: "arrow.up.right")
        }
        .buttonStyle(CPPressStyle())
        .accessibilityHint("Opens the current \(page.title) from canvaspro.app")
    }

    private func settingsLink<Destination: View>(_ title: String, detail: String?, _ symbol: String, tint: Color, @ViewBuilder destination: () -> Destination) -> some View {
        NavigationLink(destination: destination()) { NativeMenuRow(title: title, detail: detail, symbol: symbol, tint: tint) }.buttonStyle(CPPressStyle())
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
                CPGlassCard(title: "Connect an AI assistant", subtitle: "Read-only access to your CanvasPro information.") {
                    Text("Add this address to an assistant's connectors, sign in, and approve the request. It can then answer questions about your classes, deadlines, and grades.")
                        .cpFont(12).lineSpacing(2)
                    HStack {
                        Text(address).cpFont(12, .medium).monospaced().lineLimit(1).textSelection(.enabled)
                        Spacer(minLength: 8)
                        Button(copied ? "Copied" : "Copy") {
                            UIPasteboard.general.string = address
                            copied = true
                        }
                        .buttonStyle(CPButtonStyle(kind: .secondary))
                    }
                    .padding(.leading, 12).padding(.trailing, 4).padding(.vertical, 4)
                    .background(Color.primary.opacity(0.05), in: RoundedRectangle(cornerRadius: CPLayout.innerRadius, style: .continuous))
                    Text("Read-only. An assistant cannot change Canvas data or see your Canvas API key. Remove access from the assistant at any time.")
                        .cpFont(11).foregroundStyle(.secondary)
                }
                .cpPagePadding()
            }
        }
        .cpNavigationTitle("AI assistant")
        .navigationBarTitleDisplayMode(.inline)
    }
}

private struct NativeDeleteAccountView: View {
    @ObservedObject var sessionStore: NativeSessionStore
    @State private var confirmation = ""

    var body: some View {
        Form {
            Section {
                Text("This permanently deletes your account, saved Canvas key, classes, and app data. It cannot be undone.")
            }
            Section("Type DELETE to confirm") {
                TextField("DELETE", text: $confirmation)
                    .textInputAutocapitalization(.characters)
                    .autocorrectionDisabled()
                Button("Permanently delete account", role: .destructive) {
                    Task { await sessionStore.deleteAccount() }
                }
                .disabled(confirmation.trimmingCharacters(in: .whitespacesAndNewlines).uppercased() != "DELETE" || sessionStore.isWorking)
            }
            if let error = sessionStore.errorMessage {
                Section { Text(error).foregroundStyle(.red) }
            }
        }
        .cpListScreen()
        .cpNavigationTitle("Delete account")
    }
}

struct NativeSectionPicker: View {
    @Environment(\.colorScheme) private var scheme
    @Environment(\.cpPalette) private var paletteDependency
    @Binding var selection: String
    let options: [String]
    let label: String
    var body: some View {
        NativePageTabs(selection: $selection, options: options, label: label)
            .padding(.horizontal, CPLayout.gutter)
            .padding(.top, 6).padding(.bottom, 10)
            .background(CPTheme.background(scheme).opacity(0.96))
    }
}

struct NativeCalendarHub: View {
    @ObservedObject var store: NativeContentStore
    @ObservedObject var features: NativeFeatureStore
    @State private var section = "Calendar"
    var body: some View {
        Group {
            if section == "Calendar" { CalendarView(store: store, features: features) }
            else { ClassScheduleView(features: features, store: store) }
        }
        .safeAreaInset(edge: .top, spacing: 0) {
            NativeSectionPicker(selection: $section, options: ["Calendar", "My classes"], label: "Calendar sections")
        }
        .cpNavigationTitle("Calendar")
        .navigationBarTitleDisplayMode(.inline)
    }
}

struct GetItDoneView: View {
    @Environment(\.colorScheme) private var scheme
    @Environment(\.cpPalette) private var paletteDependency
    @ObservedObject var store: NativeContentStore
    @ObservedObject var features: NativeFeatureStore
    @Binding var section: String
    @State private var window = 7
    @State private var skippedRaw = ""
    @State private var orderRaw = ""
    @State private var planDate = ""
    @State private var planLoaded = false
    @State private var choiceOffset = 0
    @State private var editingEstimate: Int?
    @State private var estimateMinutes = 30

    private var planKey: String { "CanvasProNativePlan.\(store.persistenceScope)." }
    private func savePlan() {
        guard planLoaded else { return }
        let defaults = UserDefaults.standard
        defaults.set(window, forKey: planKey + "window")
        defaults.set(skippedRaw, forKey: planKey + "skipped")
        defaults.set(orderRaw, forKey: planKey + "order")
        defaults.set(planDate, forKey: planKey + "date")
    }
    private func loadPlan() {
        let defaults = UserDefaults.standard
        let savedWindow = defaults.integer(forKey: planKey + "window")
        window = savedWindow == 14 ? 14 : 7
        skippedRaw = defaults.string(forKey: planKey + "skipped") ?? ""
        orderRaw = defaults.string(forKey: planKey + "order") ?? ""
        planDate = defaults.string(forKey: planKey + "date") ?? ""
        let today = String(Int(Calendar.current.startOfDay(for: Date()).timeIntervalSince1970))
        if planDate != today { skippedRaw = ""; orderRaw = ""; planDate = today }
        planLoaded = true
        savePlan()
    }
    private var skipped: Set<Int> { Set(skippedRaw.split(separator: ",").compactMap { Int($0) }) }
    private var manualOrder: [Int] { orderRaw.split(separator: ",").compactMap { Int($0) } }
    private var allAssignments: [AssignmentItem] { features.shownAssignments(in: store) }
    private var visibleAssignments: [AssignmentItem] {
        let end = NativeParity.endOfUpcomingDay(window)
        return allAssignments.filter { item in
            guard let due = item.dueDate else { return false }
            return due >= Date() && due <= end
        }
    }
    private var candidates: [AssignmentItem] {
        NativeParity.rankedAssignments(visibleAssignments.filter { $0.isVisible(in: store) && !skipped.contains($0.id) }, estimates: features.estimates)
    }
    private var recommendation: AssignmentItem? { candidates.isEmpty ? nil : candidates[choiceOffset % candidates.count] }
    private var plan: [AssignmentItem] {
        let ordered = candidates.sorted { lhs, rhs in
            let left = manualOrder.firstIndex(of: lhs.id)
            let right = manualOrder.firstIndex(of: rhs.id)
            if let left, let right { return left < right }
            if left != nil { return true }
            if right != nil { return false }
            return score(lhs) > score(rhs)
        }
        var result: [AssignmentItem] = []
        var total = 0
        for item in ordered {
            let minutes = features.estimates[item.id].flatMap { $0 > 0 ? $0 : nil } ?? NativeParity.defaultEstimate(item)
            let dueSoon = item.dueDate.map { $0 <= Date().addingTimeInterval(3 * 86400) } ?? false
            if !dueSoon && result.count >= 3 { continue }
            if result.count >= 3 && total + minutes > 240 { continue }
            result.append(item)
            total += minutes
            if result.count >= 6 { break }
        }
        return result
    }
    private func score(_ item: AssignmentItem) -> Double {
        let count = candidatesDueSoonCount(for: item)
        return NativeParity.getItDoneScore(item, estimate: features.estimates[item.id], dueSoonCount: count)
    }
    private func candidatesDueSoonCount(for item: AssignmentItem) -> Int {
        visibleAssignments.filter { $0.courseID == item.courseID && $0.isVisible(in: store) && !skipped.contains($0.id) && ($0.dueDate ?? .distantFuture) <= Date().addingTimeInterval(3 * 86400) }.count
    }
    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 16) {
                NativeTodayTabs(selection: $section)
                CPPageHeader(eyebrow: Date().formatted(.dateTime.weekday(.wide).month(.wide).day()), title: "Up next", detail: nil)
                if store.needsCanvasConnection {
                    NativeConnectCanvasCard(store: store)
                } else if store.isLoading && allAssignments.isEmpty {
                    CPSkeletonCard()
                } else if let first = recommendation {
                    recommendationCard(first)
                } else {
                    CPGlassCard { NativeEmptyState(title: "You're all clear.", symbol: "checkmark.circle", detail: "Everything due in this window is done or skipped for today.") }
                }
                CPSegmented(selection: Binding(get: { window == 7 ? "One week" : "Two weeks" }, set: { value in window = value == "One week" ? 7 : 14; choiceOffset = 0; orderRaw = "" }), options: ["One week", "Two weeks"], label: "Planning window")
                if !store.needsCanvasConnection && (!store.isLoading || !allAssignments.isEmpty) { planCard }
            }
            .cpPagePadding()
            .cpStateChange(recommendation?.id)
        }
        .background(CPBackdrop())
        .onAppear { if !planLoaded { loadPlan() } }
        .onChange(of: store.persistenceScope) { _, _ in planLoaded = false; loadPlan() }
        .onChange(of: window) { _, _ in savePlan() }
        .onChange(of: skippedRaw) { _, _ in savePlan() }
        .onChange(of: orderRaw) { _, _ in savePlan() }
        .onChange(of: planDate) { _, _ in savePlan() }
        .alert("Estimated time", isPresented: Binding(get: { editingEstimate != nil }, set: { if !$0 { editingEstimate = nil } })) {
            TextField("Minutes", value: $estimateMinutes, format: .number).keyboardType(.numberPad)
            Button("Save") { if let id = editingEstimate, let item = allAssignments.first(where: { $0.id == id }) { Task { do { try await features.saveEstimate(min(480, max(5, estimateMinutes)), for: item) } catch { features.errorMessage = error.localizedDescription } } }; editingEstimate = nil }
            Button("Cancel", role: .cancel) { editingEstimate = nil }
        }
    }

    private func recommendationCard(_ first: AssignmentItem) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .top, spacing: 8) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(store.displayName(courseID: first.courseID, fallback: first.courseName).uppercased())
                        .cpFont(11, .semibold).tracking(1).foregroundStyle(CPTheme.foreground(scheme)).lineLimit(1)
                    Text(first.name).cpFont(20, .regular).tracking(-0.5).foregroundStyle(CPTheme.foreground(scheme))
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: 4)
                Menu {
                    if candidates.count > 1 { Button("Suggest something else") { choiceOffset = (choiceOffset + 1) % candidates.count } }
                    Button("Skip for today") { skip(first.id) }
                    Button("Change time estimate") { estimateMinutes = estimate(for: first); editingEstimate = first.id }
                } label: { CPIconButtonLabel(symbol: "ellipsis") }
                    .padding(-7)
                    .accessibilityLabel("More options for this suggestion")
            }
            HStack(spacing: 6) {
                if let due = first.dueDate {
                    CPPill(text: due.formatted(.dateTime.weekday(.abbreviated).month(.abbreviated).day().hour().minute()), tone: due < Date() ? .danger : .neutral, symbol: "calendar")
                }
                CPPill(text: "About \(estimate(for: first)) min", symbol: "clock")
            }
            Text(NativeParity.recommendationReason(first, estimate: features.estimates[first.id], dueSoonCount: candidatesDueSoonCount(for: first)))
                .cpFont(11).lineSpacing(2).foregroundStyle(CPTheme.muted(scheme)).fixedSize(horizontal: false, vertical: true)
            HStack(spacing: 8) {
                Button { NotificationCenter.default.post(name: .nativeStudyAssignment, object: first) } label: { Label("Start", systemImage: "play.fill") }
                    .buttonStyle(CPButtonStyle(kind: .primary, fullWidth: true))
                if let url = URL(string: first.htmlURL), url.scheme == "https" {
                    Link(destination: url) { Text("Canvas") }.buttonStyle(CPButtonStyle(kind: .quiet))
                }
            }
            NativeAssignmentDescriptionLink(assignment: first, store: store, features: features)
                .cpFont(11, .semibold).foregroundStyle(CPTheme.foreground(scheme))
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            LinearGradient(colors: [CPTheme.primary(scheme: scheme).opacity(scheme == .dark ? 0.12 : 0.08), .clear], startPoint: .topLeading, endPoint: .bottomTrailing),
            in: RoundedRectangle(cornerRadius: 22, style: .continuous)
        )
        .cpSurface(strong: true, radius: 22)
    }

    /// The plan without the suggestion shown above it.
    private var rest: [AssignmentItem] { plan.filter { $0.id != recommendation?.id } }
    private var plannedMinutes: Int { rest.reduce(0) { $0 + estimate(for: $1) } }
    private var planCard: some View {
        CPGlassCard {
            CPCardHeader(title: "The rest of today", subtitle: rest.isEmpty ? "Nothing else planned" : "\(rest.count) left · about \(plannedMinutes) min") {
                Button { skippedRaw = ""; orderRaw = ""; choiceOffset = 0 } label: { CPLinkLabel(text: "Reset", symbol: "arrow.counterclockwise") }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Rebuild the plan and bring back skipped work")
            }
            if plan.isEmpty {
                NativeEmptyState(title: "Nothing scheduled for today.", symbol: "checkmark.circle", detail: "Everything urgent is complete, skipped, or already submitted.")
            } else if rest.isEmpty {
                Text("That's everything planned for today.").cpFont(11).foregroundStyle(CPTheme.muted(scheme))
            } else {
                VStack(spacing: 0) {
                    ForEach(Array(rest.enumerated()), id: \.element.id) { index, item in
                        planRow(item, index: index, count: rest.count)
                        if index < rest.count - 1 { CPRowDivider(leading: 32) }
                    }
                }
            }
        }
    }

    private func planRow(_ item: AssignmentItem, index: Int, count: Int) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Text("\(index + 1)").cpFont(11, .bold).monospacedDigit()
                .foregroundStyle(CPTheme.foreground(scheme))
                .frame(width: 22, height: 22)
                .background(CPTheme.foreground(scheme).opacity(0.07), in: Circle())
            VStack(alignment: .leading, spacing: 4) {
                Text(item.name).cpFont(12, .semibold).foregroundStyle(CPTheme.foreground(scheme)).fixedSize(horizontal: false, vertical: true)
                Text(planMeta(item)).cpFont(11).foregroundStyle(CPTheme.muted(scheme)).lineLimit(2)
                HStack(spacing: 14) {
                    Button("Start") { NotificationCenter.default.post(name: .nativeStudyAssignment, object: item) }
                    Button("\(estimate(for: item)) min") { estimateMinutes = estimate(for: item); editingEstimate = item.id }
                        .accessibilityLabel("Change time estimate, \(estimate(for: item)) minutes")
                    Button("Skip today") { skip(item.id) }
                    NativeAssignmentDescriptionLink(assignment: item, store: store, features: features).labelStyle(.titleOnly)
                }
                .cpFont(11, .semibold)
                .foregroundStyle(CPTheme.foreground(scheme))
                .buttonStyle(.plain)
                .frame(minHeight: 30)
            }
            Spacer(minLength: 2)
            VStack(spacing: 0) {
                Button { move(item.id, direction: -1) } label: { Image(systemName: "chevron.up").frame(width: 32, height: 30) }
                    .disabled(index == 0).accessibilityLabel("Move \(item.name) earlier")
                Button { move(item.id, direction: 1) } label: { Image(systemName: "chevron.down").frame(width: 32, height: 30) }
                    .disabled(index == count - 1).accessibilityLabel("Move \(item.name) later")
            }
            .cpFont(11, .bold)
            .foregroundStyle(CPTheme.muted(scheme))
            .buttonStyle(.plain)
        }
        .padding(.vertical, 10)
    }

    private func planMeta(_ item: AssignmentItem) -> String {
        var parts = [store.displayName(courseID: item.courseID, fallback: item.courseName)]
        if item.submission?.missing == true { parts.append("Missing") }
        else if let due = item.dueDate { parts.append(due < Date() ? "Overdue" : due.formatted(.dateTime.weekday(.abbreviated).hour().minute())) }
        else { parts.append("No due date") }
        return parts.joined(separator: " · ")
    }
    private func estimate(for item: AssignmentItem) -> Int { NativeParity.estimate(item, estimates: features.estimates) }
    private func skip(_ id: Int) { skippedRaw = (skipped.union([id])).sorted().map { String($0) }.joined(separator: ","); orderRaw = manualOrder.filter { $0 != id }.map { String($0) }.joined(separator: ","); choiceOffset = 0 }
    /// Reorders the rows the student sees ("The rest of today").
    private func move(_ id: Int, direction: Int) { var ids = rest.map(\.id); guard let index = ids.firstIndex(of: id), ids.indices.contains(index + direction) else { return }; ids.swapAt(index, index + direction); orderRaw = ids.map { String($0) }.joined(separator: ",") }
}

/// Today's Assignments page: the website's Coming Up view (range, week strip,
/// by day or by class) with a Priority card on top, search, and adding your
/// own work. It replaces the separate Assignments tab.
struct FocusView: View {
    @Environment(\.colorScheme) private var scheme
    @Environment(\.cpPalette) private var paletteDependency
    @ObservedObject var store: NativeContentStore
    @ObservedObject var features: NativeFeatureStore
    @Binding var window: String
    @Binding var section: String
    @State private var showCompleted = false
    @State private var grouping = "By day"
    @State private var selectedDay: Date?
    @State private var recentlyCompleted: AssignmentItem?
    @State private var search = ""
    @State private var showAdd = false
    @FocusState private var searchFocused: Bool
    private let windows = ["overdue", "1", "2", "3", "7", "all"]

    private var allItems: [AssignmentItem] { features.shownAssignments(in: store) }
    private var visibleCourses: [CourseSummary] { store.bundle.courses.filter { !features.hiddenCourseIDs.contains($0.id) } }
    private var isSearching: Bool { !search.trimmingCharacters(in: .whitespaces).isEmpty }
    private var unfinished: [AssignmentItem] {
        allItems.filter { NativeParity.isInFocusWindow($0, window: window) && $0.isVisible(in: store) }.sorted(by: AssignmentItem.dueSort)
    }
    /// Unfinished work due within the next week (or already overdue), most
    /// important first. Nothing due further out than a week appears here.
    private var priority: [AssignmentItem] {
        let weekEnd = NativeParity.endOfUpcomingDay(7)
        let candidates = allItems.filter { item in
            guard let due = item.dueDate, due <= weekEnd else { return false }
            return item.isVisible(in: store)
        }
        return Array(NativeParity.rankedAssignments(candidates, estimates: features.estimates).prefix(5))
    }
    private var items: [AssignmentItem] {
        if isSearching {
            let query = search.trimmingCharacters(in: .whitespaces)
            return allItems.filter { item in
                item.isVisible(in: store, showCompleted: showCompleted) &&
                (item.name.localizedCaseInsensitiveContains(query) || store.displayName(courseID: item.courseID, fallback: item.courseName).localizedCaseInsensitiveContains(query))
            }.sorted(by: AssignmentItem.dueSort)
        }
        return allItems.filter { NativeParity.isInFocusWindow($0, window: window) && $0.isVisible(in: store, showCompleted: showCompleted) }.sorted(by: AssignmentItem.dueSort)
    }
    private var listItems: [AssignmentItem] {
        guard let selectedDay, !isSearching else { return items }
        return items.filter { $0.dueDate.map { Calendar.current.isDate($0, inSameDayAs: selectedDay) } ?? false }
    }
    private var dayGroups: [NativeTitledGroup] {
        let calendar = Calendar.current
        return Dictionary(grouping: listItems) { item -> Date in
            guard let due = item.dueDate else { return .distantFuture }
            return due < Date() ? .distantPast : calendar.startOfDay(for: due)
        }.sorted { $0.key < $1.key }.map { date, rows in
            let title = date == .distantPast ? "Overdue" : date == .distantFuture ? "No due date" : calendar.isDateInToday(date) ? "Today" : calendar.isDateInTomorrow(date) ? "Tomorrow" : date.formatted(.dateTime.weekday(.wide).month(.abbreviated).day())
            return NativeTitledGroup(title: title, items: rows)
        }
    }
    private var classGroups: [NativeCourseGroup] {
        let grouped = Dictionary(grouping: listItems, by: \.courseID)
        let known = visibleCourses.compactMap { course -> NativeCourseGroup? in
            guard let rows = grouped[course.id], !rows.isEmpty else { return nil }
            return NativeCourseGroup(course: course, items: rows)
        }
        return known.sorted { store.displayName(courseID: $0.course.id, fallback: $0.course.name).localizedStandardCompare(store.displayName(courseID: $1.course.id, fallback: $1.course.name)) == .orderedAscending }
    }
    private func estimate(_ item: AssignmentItem) -> Int { NativeParity.estimate(item, estimates: features.estimates) }
    private func dayCount(_ day: Date) -> Int {
        allItems.reduce(0) { total, item in
            total + (item.isVisible(in: store) && item.dueDate.map { Calendar.current.isDate($0, inSameDayAs: day) } == true ? 1 : 0)
        }
    }

    var body: some View {
        TimelineView(.periodic(from: .now, by: 60)) { _ in
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 16) {
                    NativeTodayTabs(selection: $section)
                    header
                    searchField
                    if store.needsCanvasConnection {
                        NativeConnectCanvasCard(store: store)
                    } else if store.isLoading && allItems.isEmpty {
                        CPSkeletonCard()
                        CPSkeletonCard()
                    } else {
                        if !isSearching && !priority.isEmpty { priorityCard }
                        if !isSearching { rangeChips }
                        if !isSearching && window != "overdue" { weekStrip }
                        controls
                        list
                    }
                }
                .cpPagePadding()
                .cpStateChange(window).cpStateChange(grouping).cpStateChange(showCompleted).cpStateChange(selectedDay)
            }
            .scrollDismissesKeyboard(.immediately)
        }
        .background(CPBackdrop())
        .refreshable { async let a: Void = store.load(); async let b: Void = features.load(); _ = await (a, b) }
        .sheet(isPresented: $showAdd) { AddAssignmentView(courses: visibleCourses, store: store, features: features) }
        .safeAreaInset(edge: .bottom) {
            if let item = recentlyCompleted {
                HStack(spacing: 10) {
                    Image(systemName: "checkmark").cpIconFont(12, .semibold).foregroundStyle(CPTheme.foreground(scheme))
                    Text("Marked complete").cpFont(13)
                    Spacer()
                    Button("Undo") {
                        Task {
                            if item.isFinished(in: store) { await store.toggle(item) }
                            recentlyCompleted = nil
                        }
                    }
                    .cpFont(13, .medium)
                    Button { recentlyCompleted = nil } label: { CPIconButtonLabel(symbol: "xmark") }.buttonStyle(.plain).accessibilityLabel("Dismiss")
                }
                .padding(.leading, 16).padding(.trailing, 4)
                .cpSurface(strong: true, radius: 18)
                .padding(.horizontal, CPLayout.gutter).padding(.bottom, 8)
                .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
    }

    // MARK: Header and search

    private var header: some View {
        HStack(alignment: .center, spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Text("Assignments").cpFont(28, .regular).tracking(-1).foregroundStyle(CPTheme.foreground(scheme))
                    .accessibilityAddTraits(.isHeader)
                Text(unfinished.isEmpty ? "All clear" : "\(unfinished.count) \(window == "overdue" ? "overdue" : "due") · about \(unfinished.reduce(0) { $0 + estimate($1) }) min")
                    .cpFont(13).monospacedDigit().foregroundStyle(CPTheme.muted(scheme))
            }
            Spacer(minLength: 8)
            Button { showAdd = true } label: { CPIconButtonLabel(symbol: "plus") }
                .buttonStyle(.plain)
                .disabled(visibleCourses.isEmpty)
                .accessibilityLabel("Add an assignment")
        }
        .padding(.horizontal, 4)
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
                        .frame(width: 32, height: 32).contentShape(Rectangle())
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

    // MARK: Priority

    private var priorityCard: some View {
        CPGlassCard {
            CPCardHeader(title: "Priority") {
                Text("\(priority.count)").cpFont(13).monospacedDigit().foregroundStyle(CPTheme.muted(scheme))
            }
            VStack(spacing: 8) {
                ForEach(priority) { item in
                    CPInsetRow {
                        HStack(spacing: 12) {
                            NativeCompletionButton(assignment: item, store: store, onCompleted: { recentlyCompleted = $0 })
                            VStack(alignment: .leading, spacing: 2) {
                                Text(item.name).cpFont(13, .medium).foregroundStyle(CPTheme.foreground(scheme)).lineLimit(2)
                                Text(priorityMeta(item)).cpFont(11).foregroundStyle(CPTheme.muted(scheme)).lineLimit(1)
                            }
                            Spacer(minLength: 8)
                            let label = NativeParity.priorityLabel(item)
                            CPPill(text: label, tone: label == "Do first" ? .accent : .neutral)
                        }
                    }
                }
            }
        }
    }

    private func priorityMeta(_ item: AssignmentItem) -> String {
        let course = store.displayName(courseID: item.courseID, fallback: item.courseName)
        guard let countdown = NativeParity.countdown(item, completed: false) else { return course }
        return "\(course) · \(countdown.label)"
    }

    // MARK: Range, week and grouping

    private var rangeChips: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(windows, id: \.self) { value in
                    Button { window = value; selectedDay = nil } label: { CPChip(text: focusLabel(value), selected: window == value) }
                        .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 1)
        }
        .scrollClipDisabled()
    }

    private var weekStrip: some View {
        HStack(spacing: 6) {
            ForEach(0..<7, id: \.self) { offset in
                let day = Calendar.current.date(byAdding: .day, value: offset, to: Calendar.current.startOfDay(for: Date())) ?? Date()
                let count = dayCount(day)
                let isSelected = selectedDay == day
                Button { selectedDay = isSelected ? nil : day } label: {
                    VStack(spacing: 4) {
                        Text(offset == 0 ? "Today" : day.formatted(.dateTime.weekday(.abbreviated)))
                            .cpFont(11).lineLimit(1).minimumScaleFactor(0.7)
                            .foregroundStyle(isSelected ? CPTheme.background(scheme) : CPTheme.muted(scheme))
                        Text(day.formatted(.dateTime.day())).cpFont(15).monospacedDigit()
                            .foregroundStyle(isSelected ? CPTheme.background(scheme) : CPTheme.foreground(scheme))
                        Circle().fill(isSelected ? CPTheme.background(scheme) : CPTheme.foreground(scheme).opacity(0.6))
                            .frame(width: 4, height: 4).opacity(count > 0 ? 1 : 0)
                    }
                    .frame(maxWidth: .infinity, minHeight: 60)
                    .background(isSelected ? CPTheme.foreground(scheme) : CPTheme.inset(scheme), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).strokeBorder(isSelected ? Color.clear : CPTheme.insetBorder(scheme), lineWidth: 0.5))
                }
                .buttonStyle(CPPressStyle())
                .accessibilityLabel("\(day.formatted(date: .complete, time: .omitted)), \(count) due")
                .accessibilityAddTraits(isSelected ? .isSelected : [])
            }
        }
        .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
    }

    private var controls: some View {
        HStack(spacing: 10) {
            CPSegmented(selection: $grouping, options: ["By day", "By class"], label: "Group by")
                .frame(maxWidth: 210)
            Spacer(minLength: 4)
            Button { showCompleted.toggle() } label: { CPChip(text: "Finished", selected: showCompleted) }
                .buttonStyle(.plain)
                .accessibilityLabel("Show finished")
        }
    }

    // MARK: List

    @ViewBuilder private var list: some View {
        if listItems.isEmpty {
            CPGlassCard {
                NativeEmptyState(
                    title: isSearching ? "No matches" : selectedDay != nil ? "Nothing due this day." : window == "overdue" ? "Nothing overdue." : "You're all clear.",
                    symbol: isSearching ? "magnifyingglass" : "checkmark.circle",
                    detail: isSearching || selectedDay != nil || window == "all" ? nil : "Try a longer range above."
                )
            }
        } else if grouping == "By class" {
            ForEach(classGroups) { group in classCard(group) }
        } else {
            ForEach(dayGroups) { group in
                VStack(alignment: .leading, spacing: 8) {
                    CPSectionLabel(group.title, count: group.items.count)
                    VStack(spacing: 8) {
                        ForEach(group.items) { item in assignmentRow(item, showCourse: true) }
                    }
                }
            }
        }
    }

    /// One card per class, like the website's class cards.
    private func classCard(_ group: NativeCourseGroup) -> some View {
        let course = group.course
        let color = CPTheme.gradeColor(course.currentScore)
        return CPGlassCard {
            HStack(spacing: 10) {
                Circle().fill(color).frame(width: 8, height: 8)
                Text(store.displayName(courseID: course.id, fallback: course.name))
                    .cpFont(16, .regular).tracking(-0.3).foregroundStyle(CPTheme.foreground(scheme)).lineLimit(2)
                Spacer(minLength: 8)
                if let score = course.currentScore {
                    Text("\(score.formatted(.number.precision(.fractionLength(1))))%")
                        .cpFont(12).monospacedDigit().foregroundStyle(color)
                }
                Text("\(group.items.count)").cpFont(12).monospacedDigit().foregroundStyle(CPTheme.muted(scheme))
            }
            .accessibilityElement(children: .combine)
            .accessibilityAddTraits(.isHeader)
            VStack(spacing: 8) {
                ForEach(group.items) { item in assignmentRow(item, showCourse: false) }
            }
        }
    }

    private func assignmentRow(_ item: AssignmentItem, showCourse: Bool) -> some View {
        let done = item.isFinished(in: store)
        let countdown = NativeParity.countdown(item, completed: done)
        return CPInsetRow {
            HStack(alignment: .center, spacing: 12) {
                NativeCompletionButton(assignment: item, store: store, onCompleted: { recentlyCompleted = $0 })
                NavigationLink {
                    if let course = store.bundle.courses.first(where: { $0.id == item.courseID }) {
                        CourseDetailView(course: course, store: store, features: features, highlightAssignment: item)
                    } else {
                        AssignmentDetailView(assignment: item, store: store, features: features)
                    }
                } label: {
                    HStack(spacing: 8) {
                        VStack(alignment: .leading, spacing: 3) {
                            Text(item.name).cpFont(13, .medium)
                                .foregroundStyle(done ? CPTheme.muted(scheme) : CPTheme.foreground(scheme))
                                .strikethrough(done)
                                .lineLimit(2)
                            Text(rowMeta(item, showCourse: showCourse, done: done)).cpFont(11).foregroundStyle(CPTheme.muted(scheme)).lineLimit(1)
                        }
                        Spacer(minLength: 8)
                        VStack(alignment: .trailing, spacing: 3) {
                            if let countdown {
                                Text(countdown.label).cpFont(12, countdown.urgency == "today" || countdown.urgency == "overdue" ? .medium : .regular)
                                    .foregroundStyle(CPTheme.urgency(countdown.urgency, scheme: scheme))
                            }
                            Text("\(estimate(item)) min").cpFont(11).monospacedDigit().foregroundStyle(CPTheme.faint(scheme))
                        }
                        .fixedSize()
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(CPPressStyle())
            }
        }
        .opacity(done ? 0.6 : 1)
    }

    private func rowMeta(_ item: AssignmentItem, showCourse: Bool, done: Bool) -> String {
        var parts: [String] = []
        if showCourse { parts.append(store.displayName(courseID: item.courseID, fallback: item.courseName)) }
        if let due = item.dueDate { parts.append(due.formatted(.dateTime.weekday(.abbreviated).month(.abbreviated).day().hour().minute())) } else { parts.append("No due date") }
        if done { parts.append(item.isCanvasFinished ? "Done in Canvas" : "Marked done") }
        return parts.joined(separator: " · ")
    }

    private func focusLabel(_ value: String) -> String {
        switch value {
        case "overdue": return "Overdue"
        case "1": return "24 hours"
        case "2": return "2 days"
        case "3": return "3 days"
        case "7": return "7 days"
        default: return "4 weeks"
        }
    }
}

struct NativeTitledGroup: Identifiable {
    let title: String
    let items: [AssignmentItem]
    var id: String { title }
}

struct NativeCalendarEntry: Identifiable {
    let id: String
    let date: Date
    let title: String
    let context: String
    let kind: String
    let url: URL?
    let pickID: Int?
}

private struct CalendarDayGroup: Identifiable {
    var id: Date { day }
    let day: Date
    let items: [NativeCalendarEntry]
}

struct CalendarView: View {
    @Environment(\.colorScheme) private var scheme
    @Environment(\.cpPalette) private var paletteDependency
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @ObservedObject var store: NativeContentStore
    @ObservedObject var features: NativeFeatureStore
    @State private var showCompleted = false
    @State private var editingPick: CalendarPick?
    @State private var pickedTime = Date()
    @State private var selectedDate: Date? = Calendar.current.startOfDay(for: Date())
    @State private var currentWeekOffset = 0

    private var calendar: Calendar { Calendar.current }
    private var today: Date { calendar.startOfDay(for: Date()) }

    private var weekDates: [Date] {
        let weekday = calendar.component(.weekday, from: today)
        let monday = calendar.date(byAdding: .day, value: -((weekday + 5) % 7) + (currentWeekOffset * 7), to: today) ?? today
        return (0..<7).compactMap { calendar.date(byAdding: .day, value: $0, to: monday) }
    }

    private var allAssignments: [AssignmentItem] { features.shownAssignments(in: store) }
    private var visibleAssignments: [AssignmentItem] {
        allAssignments.filter { $0.isVisible(in: store, showCompleted: showCompleted) }
    }
    /// Everything from the start of the shared display window (3 days ago).
    private var agenda: [NativeCalendarEntry] {
        let windowStart = NativeParity.startOfRecentWindow()
        let pickedIDs = Set(features.calendarPicks.map(\.assignmentID))
        var result = visibleAssignments.compactMap { item -> NativeCalendarEntry? in
            guard !pickedIDs.contains(item.id), let date = item.dueDate, date >= windowStart else { return nil }
            return NativeCalendarEntry(id: "assignment-\(item.id)", date: date, title: item.name, context: store.displayName(courseID: item.courseID, fallback: item.courseName), kind: "Assignment due", url: URL(string: item.htmlURL), pickID: nil)
        }
        result += store.bundle.calendar.compactMap { event in
            guard let raw = event.startAt, let date = ISO8601DateFormatter.canvasDate(from: raw), date >= windowStart else { return nil }
            return NativeCalendarEntry(id: "event-\(event.id)", date: date, title: event.title, context: event.contextName ?? event.locationName ?? "Canvas event", kind: "Canvas event", url: event.htmlURL.flatMap { URL(string: $0) }, pickID: nil)
        }
        result += features.calendarPicks.compactMap { pick in
            if let assignment = allAssignments.first(where: { $0.id == pick.assignmentID }), !assignment.isVisible(in: store, showCompleted: showCompleted) { return nil }
            let pickCourseID = store.bundle.assignments.first(where: { $0.id == pick.assignmentID })?.courseID ?? features.customAssignments.first(where: { $0.id == pick.assignmentID })?.courseID
            if let pickCourseID, features.hiddenCourseIDs.contains(pickCourseID) { return nil }
            guard let date = ISO8601DateFormatter.canvasDate(from: pick.at), date >= windowStart else { return nil }
            return NativeCalendarEntry(id: "pick-\(pick.id)", date: date, title: pick.title, context: pick.context, kind: "Planned work", url: nil, pickID: pick.id)
        }
        return result.sorted { $0.date < $1.date }
    }

    private func itemsFor(day: Date) -> [NativeCalendarEntry] {
        agenda.filter { calendar.isDate($0.date, inSameDayAs: day) }
    }

    /// "All upcoming" lists today onward.
    private var upcomingDayGroups: [CalendarDayGroup] {
        let uniqueDays = Array(Set(agenda.map { calendar.startOfDay(for: $0.date) })).filter { $0 >= today }.sorted()
        return uniqueDays.compactMap { day in
            let items = itemsFor(day: day)
            return items.isEmpty ? nil : CalendarDayGroup(day: day, items: items)
        }
    }

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: CPLayout.stack) {
                calendarStrip
                if agenda.isEmpty {
                    CPGlassCard { NativeEmptyState(title: "Nothing scheduled", symbol: "calendar", detail: "No upcoming assignments or events on your Canvas calendar.") }
                } else if let selected = selectedDate {
                    let dayItems = itemsFor(day: selected)
                    dayCard(title: dayTitle(selected), items: dayItems)
                } else {
                    ForEach(upcomingDayGroups) { group in dayCard(title: dayTitle(group.day), items: group.items) }
                }
                CPGlassCard(title: "Workload") {
                    WorkloadView(assignments: visibleAssignments, store: store, features: features)
                }
            }
            .cpPagePadding()
            .cpStateChange(selectedDate)
            .cpStateChange(showCompleted)
        }
        .background(CPBackdrop())
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
        calendar.isDateInToday(day) ? "Today" : calendar.isDateInTomorrow(day) ? "Tomorrow" : day.formatted(.dateTime.weekday(.wide).month(.abbreviated).day())
    }

    private func dayCard(title: String, items: [NativeCalendarEntry]) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            CPSectionLabel(title, count: items.count)
            VStack(spacing: 0) {
                if items.isEmpty {
                    HStack(spacing: 10) {
                        Image(systemName: "sun.max").cpIconFont(12, .semibold).foregroundStyle(CPTheme.foreground(scheme))
                        Text("Your schedule is clear for this day.").cpFont(12).foregroundStyle(CPTheme.muted(scheme))
                        Spacer()
                    }
                    .padding(.vertical, 14)
                }
                ForEach(items) { item in
                    agendaItemRow(item)
                    if item.id != items.last?.id { CPRowDivider(leading: 62) }
                }
            }
            .padding(.horizontal, 14)
            .cpSurface()
        }
        .padding(.top, 4)
    }

    private var calendarStrip: some View {
        let counts = Dictionary(grouping: agenda, by: { calendar.startOfDay(for: $0.date) }).mapValues { $0.count }
        return VStack(spacing: 12) {
            HStack(spacing: 4) {
                if let firstDate = weekDates.first {
                    Text(firstDate.formatted(.dateTime.month(.wide).year()))
                        .cpFont(15, .semibold)
                        .foregroundStyle(CPTheme.foreground(scheme))
                }
                Spacer()
                Button { changeWeek(by: -1) } label: { CPIconButtonLabel(symbol: "chevron.left") }
                    .buttonStyle(.plain)
                    // Earlier weeks are outside the display window, so they'd always be empty.
                    .disabled(currentWeekOffset <= 0)
                    .opacity(currentWeekOffset <= 0 ? 0.35 : 1)
                    .accessibilityLabel("Previous week")
                Button {
                    withAnimation(reduceMotion ? nil : .easeInOut(duration: 0.2)) {
                        currentWeekOffset = 0
                        selectedDate = today
                    }
                } label: { CPLinkLabel(text: "Today") }
                    .buttonStyle(.plain)
                Button { changeWeek(by: 1) } label: { CPIconButtonLabel(symbol: "chevron.right") }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Next week")
            }
            HStack(spacing: 4) {
                ForEach(weekDates, id: \.self) { date in
                    dateButton(date, count: counts[calendar.startOfDay(for: date)] ?? 0)
                }
            }
            HStack(spacing: 8) {
                Button {
                    withAnimation(reduceMotion ? nil : .easeInOut(duration: 0.2)) { selectedDate = nil }
                } label: { CPChip(text: "All upcoming", selected: selectedDate == nil) }
                    .buttonStyle(.plain)
                Spacer()
                Button { showCompleted.toggle() } label: { CPChip(text: "Show completed", selected: showCompleted) }
                    .buttonStyle(.plain)
            }
        }
        .padding(CPLayout.cardPadding)
        .cpSurface(strong: true)
        .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
    }

    private func changeWeek(by offset: Int) {
        withAnimation(reduceMotion ? nil : .easeInOut(duration: 0.2)) {
            currentWeekOffset += offset
            if let selectedDate {
                self.selectedDate = calendar.date(byAdding: .day, value: offset * 7, to: selectedDate)
            }
        }
    }

    @ViewBuilder
    private func dateButton(_ date: Date, count: Int) -> some View {
        let isSelected = selectedDate.map { calendar.isDate($0, inSameDayAs: date) } ?? false
        let isToday = calendar.isDate(date, inSameDayAs: today)

        Button {
            withAnimation(reduceMotion ? nil : .easeInOut(duration: 0.18)) {
                selectedDate = date
            }
        } label: {
            VStack(spacing: 5) {
                Text(date.formatted(.dateTime.weekday(.narrow)))
                    .cpFont(11, .semibold)
                    .foregroundStyle(isToday ? CPTheme.foreground(scheme) : CPTheme.muted(scheme))
                ZStack {
                    if isSelected {
                        Circle().fill(CPTheme.foreground(scheme))
                    } else if isToday {
                        Circle().strokeBorder(CPTheme.foreground(scheme).opacity(0.6), lineWidth: 0.5)
                    }
                    Text("\(calendar.component(.day, from: date))")
                        .cpFont(14, .semibold)
                        .monospacedDigit()
                        .foregroundStyle(isSelected ? CPTheme.background(scheme) : isToday ? CPTheme.foreground(scheme) : CPTheme.foreground(scheme))
                }
                .frame(width: 32, height: 32)
                Circle()
                    .fill(CPTheme.foreground(scheme))
                    .frame(width: 4, height: 4)
                    .opacity(count > 0 ? 1 : 0)
            }
            .frame(maxWidth: .infinity, minHeight: 64)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(date.formatted(.dateTime.weekday(.wide).month().day())), \(count) items")
        .accessibilityAddTraits(isSelected ? [.isSelected] : [])
    }

    private func agendaItemRow(_ item: NativeCalendarEntry) -> some View {
        let tone: CPTone = item.pickID != nil ? .accent : item.kind.contains("Assignment") ? .neutral : .warning
        return HStack(alignment: .top, spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Text(item.date, format: .dateTime.hour().minute())
                    .cpFont(11, .semibold).monospacedDigit()
                    .foregroundStyle(CPTheme.foreground(scheme))
                CPPill(text: item.pickID != nil ? "Planned" : item.kind.contains("Assignment") ? "Due" : "Event", tone: tone)
            }
            .frame(width: 50, alignment: .leading)

            VStack(alignment: .leading, spacing: 3) {
                Text(item.title)
                    .cpFont(13, .medium)
                    .foregroundStyle(CPTheme.foreground(scheme))
                    .fixedSize(horizontal: false, vertical: true)
                Text(item.context)
                    .cpFont(11)
                    .foregroundStyle(CPTheme.muted(scheme))
                HStack(spacing: 14) {
                    if let pickID = item.pickID {
                        Button("Change time") {
                            if let pick = features.calendarPicks.first(where: { $0.id == pickID }) {
                                pickedTime = item.date
                                editingPick = pick
                            }
                        }
                        .foregroundStyle(CPTheme.foreground(scheme))
                        Button("Remove", role: .destructive) { removePick(pickID) }
                            .foregroundStyle(CPTheme.danger)
                    } else if let url = item.url, url.scheme == "https" {
                        Link(destination: url) {
                            HStack(spacing: 3) {
                                Text("Open Canvas")
                                Image(systemName: "arrow.up.right").cpIconFont(8, .bold)
                            }
                        }
                        .foregroundStyle(CPTheme.foreground(scheme))
                    }
                }
                .cpFont(11, .semibold)
                .buttonStyle(.plain)
                .frame(minHeight: 26)
            }
            Spacer(minLength: 0)
        }
        .padding(.vertical, 11)
    }

    private func removePick(_ id: Int) {
        Task {
            do { try await features.savePreference("calendar-picks", features.calendarPicks.filter { $0.id != id }) }
            catch { features.errorMessage = error.localizedDescription }
        }
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
        let maxCount = max(1, counts.max() ?? 1)

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
                    dayColumn(day, count: byDay[day]?.count ?? 0, maxCount: maxCount)
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
    }

    private func dayColumn(_ day: Date, count: Int, maxCount: Int) -> some View {
        let isToday = calendar.isDate(day, inSameDayAs: today)
        let isOpen = openDay == day
        let isPast = day < today
        let barHeight: CGFloat = count == 0 ? 4 : 10 + 50 * CGFloat(count) / CGFloat(maxCount)
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
                        .fill(count == 0 ? CPTheme.foreground(scheme).opacity(0.08) : CPTheme.foreground(scheme).opacity(isOpen ? 0.85 : 0.18 + 0.4 * Double(count) / Double(maxCount)))
                        .frame(width: 18, height: barHeight)
                }
                VStack(spacing: 2) {
                    Text(day.formatted(.dateTime.weekday(.narrow)))
                        .cpFont(11)
                        .foregroundStyle(CPTheme.muted(scheme))
                    Text("\(calendar.component(.day, from: day))")
                        .cpFont(13, isToday ? .semibold : .regular).monospacedDigit()
                        .foregroundStyle(isToday ? CPTheme.background(scheme) : CPTheme.foreground(scheme).opacity(isPast ? 0.45 : 0.9))
                        .frame(width: 30, height: 30)
                        .background(isToday ? CPTheme.foreground(scheme) : Color.clear, in: Circle())
                }
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 8)
            .background(isOpen ? CPTheme.inset(scheme) : Color.clear, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(day.formatted(.dateTime.weekday(.wide).month(.wide).day())), \(count) due")
        .accessibilityAddTraits(isOpen ? .isSelected : [])
    }

    private func dayDetail(_ day: Date, items: [AssignmentItem]) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(day.formatted(.dateTime.weekday(.wide).month(.abbreviated).day()))
                .cpFont(12, .medium).foregroundStyle(CPTheme.foreground(scheme))
                .padding(.horizontal, 2)
            ForEach(items) { item in
                CPInsetRow {
                    HStack(alignment: .center, spacing: 10) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(item.name).cpFont(13, .medium).foregroundStyle(CPTheme.foreground(scheme)).lineLimit(2)
                            Text(store.displayName(courseID: item.courseID, fallback: item.courseName)).cpFont(11).foregroundStyle(CPTheme.muted(scheme)).lineLimit(1)
                        }
                        Spacer(minLength: 8)
                        VStack(alignment: .trailing, spacing: 2) {
                            if let due = item.dueDate { Text(due.formatted(.dateTime.hour().minute())).cpFont(11).monospacedDigit().foregroundStyle(CPTheme.muted(scheme)) }
                            if let points = item.pointsPossible { Text("\(points.formatted()) pts").cpFont(11).monospacedDigit().foregroundStyle(CPTheme.faint(scheme)) }
                        }
                        .fixedSize()
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
    @AppStorage("CanvasProDismissedAnnouncements") private var dismissedRaw = ""
    @State private var search = ""
    @State private var courseFilter: Int?
    @State private var expanded = Set<Int>()
    private var dismissed: Set<Int> { Set(dismissedRaw.split(separator: ",").compactMap { Int($0) }) }
    private var items: [AnnouncementItem] {
        store.bundle.announcements.filter { item in
            !features.hiddenCourseIDs.contains(item.courseID) && !dismissed.contains(item.id) && item.isWithin(weeks: features.announcementWeeks) && (search.isEmpty || item.title.localizedCaseInsensitiveContains(search) || item.courseName.localizedCaseInsensitiveContains(search))
        }.sorted { $0.postedAt > $1.postedAt }
    }
    private var feed: [AnnouncementItem] { items.filter { courseFilter == nil || $0.courseID == courseFilter } }
    private var courses: [Int] { Array(Set(items.map(\.courseID))).sorted { name(for: $0) < name(for: $1) } }
    private func name(for id: Int) -> String { store.displayName(courseID: id, fallback: items.first(where: { $0.courseID == id })?.courseName ?? "Class") }
    private var courseCount: Int { Set(items.map(\.courseID)).count }
    private var windowTitle: String { features.announcementWeeks == 0 ? "All announcements" : features.announcementWeeks == 1 ? "Past week" : features.announcementWeeks == 4 ? "Past month" : "Past \(features.announcementWeeks) weeks" }

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: CPLayout.stack) {
                NativePageHero(symbol: "megaphone", eyebrow: windowTitle, title: "Announcements") {
                    CPStatTile(value: "\(items.count)", label: "Recent posts")
                    CPStatTile(value: "\(courseCount)", label: "Active courses")
                }
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 6) {
                        Button { courseFilter = nil } label: { CPChip(text: "All updates · \(items.count)", selected: courseFilter == nil) }.buttonStyle(.plain)
                        ForEach(courses, id: \.self) { id in
                            Button { courseFilter = id } label: { CPChip(text: "\(name(for: id)) · \(items.filter { $0.courseID == id }.count)", selected: courseFilter == id) }.buttonStyle(.plain)
                        }
                        if !dismissed.isEmpty {
                            Button { dismissedRaw = "" } label: { CPLinkLabel(text: "Restore \(dismissed.count)", symbol: "arrow.uturn.backward") }.buttonStyle(.plain)
                        }
                    }
                    .padding(.horizontal, 1)
                }
                .scrollClipDisabled()
                if feed.isEmpty {
                    CPGlassCard { NativeEmptyState(title: "No announcements in this view.", symbol: "megaphone") }
                } else {
                    VStack(spacing: 0) {
                        ForEach(feed) { item in
                            announcementRow(item)
                            if item.id != feed.last?.id { CPRowDivider() }
                        }
                    }
                    .padding(.horizontal, 14)
                    .cpSurface()
                }
            }
            .cpPagePadding()
            .cpStateChange(courseFilter)
        }
        .background(CPBackdrop())
        .searchable(text: $search)
        .refreshable { await store.load() }
        .cpNavigationTitle("Announcements")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func announcementRow(_ item: AnnouncementItem) -> some View {
        let message = item.message.strippingHTML
        let isOpen = expanded.contains(item.id)
        return VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text(name(for: item.courseID).uppercased()).cpFont(11, .semibold).tracking(0.8).foregroundStyle(CPTheme.foreground(scheme)).lineLimit(1)
                Spacer(minLength: 6)
                Text(announcementDate(item)).cpFont(11).monospacedDigit().foregroundStyle(CPTheme.faint(scheme))
                Button { dismissedRaw = dismissed.union([item.id]).sorted().map { String($0) }.joined(separator: ",") } label: {
                    Image(systemName: "xmark").cpIconFont(8, .bold).foregroundStyle(CPTheme.muted(scheme))
                        .frame(width: 22, height: 22).background(CPTheme.inset(scheme), in: Circle())
                        .frame(width: 44, height: 32).contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .padding(.trailing, -11)
                .accessibilityLabel("Dismiss \(item.title)")
            }
            Text(item.title).cpFont(13, .semibold).foregroundStyle(CPTheme.foreground(scheme)).fixedSize(horizontal: false, vertical: true)
            Text(message).cpFont(12).lineSpacing(2).foregroundStyle(CPTheme.muted(scheme)).lineLimit(isOpen ? nil : 3)
                .fixedSize(horizontal: false, vertical: true)
            HStack(spacing: 14) {
                if message.count > 180 {
                    Button(isOpen ? "Show less" : "Read full update") { if isOpen { expanded.remove(item.id) } else { expanded.insert(item.id) } }
                }
                if let course = store.bundle.courses.first(where: { $0.id == item.courseID }) {
                    NavigationLink("Open class") { CourseDetailView(course: course, store: store, features: features, initialSection: .announcements) }
                }
            }
            .cpFont(11, .semibold)
            .foregroundStyle(CPTheme.foreground(scheme))
            .buttonStyle(.plain)
            .frame(minHeight: 28)
        }
        .padding(.vertical, 10)
    }
    private func announcementDate(_ item: AnnouncementItem) -> String { ISO8601DateFormatter.canvasDate(from: item.postedAt)?.formatted(.dateTime.month(.abbreviated).day().hour().minute()) ?? "Recent" }
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

private struct NotificationsView: View {
    @ObservedObject var sessionStore: NativeSessionStore
    @ObservedObject var features: NativeFeatureStore
    @State private var status: String?
    @State private var syncing = false
    var body: some View {
        Form {
            Section("Master") {
                Toggle("Notifications", isOn: bind(\.enabled)); Toggle("Push notifications", isOn: bind(\.browserPush)); Toggle("App icon badge", isOn: bind(\.badge)); Toggle("Quiet hours", isOn: bind(\.quietEnabled))
                if features.notificationPreferences.quietEnabled { Stepper("Starts at \(features.notificationPreferences.quietStart):00", value: bind(\.quietStart), in: 0...23); Stepper("Ends at \(features.notificationPreferences.quietEnd):00", value: bind(\.quietEnd), in: 0...23) }
            }
            Section("Due date reminders") { Toggle("1 week before", isOn: bind(\.due1w)); Toggle("3 days before", isOn: bind(\.due3d)); Toggle("2 days before", isOn: bind(\.due2d)); Toggle("1 day before", isOn: bind(\.due1d)) }
            Section("Canvas updates") { Toggle("Grades", isOn: bind(\.grades)); Toggle("Announcements", isOn: bind(\.announcements)); if features.notificationPreferences.grades { Stepper("Grade threshold: \(Int(features.notificationPreferences.gradeThreshold))%", value: bind(\.gradeThreshold), in: 0...100, step: 5) } }
            Section("Class schedule") {
                Toggle("Class countdown", isOn: bind(\.countdownClass))
                if features.notificationPreferences.countdownClass {
                    ForEach([60, 30, 15, 5, 0], id: \.self) { minutes in
                        Toggle(minutes == 0 ? "When class starts" : "\(minutes) minutes before", isOn: listBinding(\.countdownLeads, minutes))
                    }
                }
                Toggle("Tonight’s deadlines", isOn: bind(\.countdownTonight))
                if features.notificationPreferences.countdownTonight {
                    ForEach([15, 18, 21, 23], id: \.self) { hour in
                        Toggle("\(hour - 12):00 PM", isOn: listBinding(\.countdownTonightHours, hour))
                    }
                }
            }
            Section { Button { save() } label: { HStack { Spacer(); if syncing { ProgressView() } else { Text("Save Notification Settings") }; Spacer() } }.disabled(syncing) }
            Section("History") { ForEach(features.alerts) { alert in VStack(alignment: .leading) { Text(alert.title).cpFont(12, .semibold); Text(alert.body).cpFont(11); Text(alert.sentAt == nil ? "Scheduled" : "Sent").cpFont(11).foregroundStyle(.secondary) } }; if features.alerts.isEmpty { Text("No notification history").foregroundStyle(.secondary) } }
            if let status { Section { Text(status).foregroundStyle(.secondary) } }
        }
        .cpListScreen()
        .cpNavigationTitle("Notifications")
        .onReceive(NotificationCenter.default.publisher(for: .nativeDeviceToken)) { note in
            if let token = note.object as? String { Task { await register(token) } }
            else if let error = note.object as? Error { status = error.localizedDescription }
        }
    }
    private func bind<T>(_ path: WritableKeyPath<NotificationPreferences, T>) -> Binding<T> { Binding(get: { features.notificationPreferences[keyPath: path] }, set: { features.notificationPreferences[keyPath: path] = $0 }) }
    private func listBinding(_ path: WritableKeyPath<NotificationPreferences, [Int]>, _ value: Int) -> Binding<Bool> {
        Binding(get: { features.notificationPreferences[keyPath: path].contains(value) }, set: { selected in
            var values = features.notificationPreferences[keyPath: path]
            if selected { values.append(value) } else { values.removeAll { $0 == value } }
            features.notificationPreferences[keyPath: path] = Array(Set(values)).sorted()
        })
    }
    private func save() {
        syncing = true
        Task {
            defer { syncing = false }
            do {
                if features.notificationPreferences.enabled && features.notificationPreferences.browserPush {
                    let granted = try await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound])
                    if granted { UIApplication.shared.registerForRemoteNotifications() } else { features.notificationPreferences.browserPush = false }
                } else {
                    UIApplication.shared.unregisterForRemoteNotifications()
                    if let deviceToken = UserDefaults.standard.string(forKey: "CanvasProNativePushToken"), let api = sessionStore.api {
                        let access = try await sessionStore.accessToken()
                        try await api.deletePushToken(deviceToken, token: access)
                        UserDefaults.standard.removeObject(forKey: "CanvasProNativePushToken")
                    }
                }
                try await features.saveNotifications(); status = "Notification settings saved."
            } catch { status = error.localizedDescription }
        }
    }
    private func register(_ deviceToken: String) async {
        guard let api = sessionStore.api, let user = sessionStore.session?.user else { return }
        do { try await api.upsertPushToken(deviceToken, token: try await sessionStore.accessToken(), userID: user.id); UserDefaults.standard.set(deviceToken, forKey: "CanvasProNativePushToken"); status = "Push notifications enabled." }
        catch { status = error.localizedDescription }
    }
}

private struct AppearanceSettingsCard: View {
    @Environment(\.colorScheme) private var resolvedScheme
    @ObservedObject var features: NativeFeatureStore
    @AppStorage("CanvasProColorScheme") private var scheme = "dark"
    @AppStorage("CanvasProPalette") private var palette = "forest"
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
                    if let status { Text(status).cpFont(12).foregroundStyle(.red) }
        }
    }
    private func appearanceButton(_ value: String, _ title: String, _ symbol: String) -> some View {
        Button { Task { await save("theme", value) } } label: {
            VStack(spacing: 6) { Image(systemName: symbol).cpIconFont(13, .semibold); Text(title).cpFont(11, .semibold); if scheme == value { Image(systemName: "checkmark").cpIconFont(8, .bold) } }
                .frame(maxWidth: .infinity, minHeight: 64).foregroundStyle(scheme == value ? CPTheme.primary(scheme: resolvedScheme) : CPTheme.foreground(resolvedScheme)).background(scheme == value ? CPTheme.primary(scheme: resolvedScheme).opacity(0.10) : CPTheme.inset(resolvedScheme), in: RoundedRectangle(cornerRadius: 12)).overlay(RoundedRectangle(cornerRadius: 12).stroke(scheme == value ? CPTheme.primary(scheme: resolvedScheme).opacity(0.55) : CPTheme.insetBorder(resolvedScheme)))
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
                    Text("Announcements older than this are hidden on every screen, here and on the website.").cpFont(11).foregroundStyle(CPTheme.muted(scheme))
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
        }.padding(8).frame(maxWidth: .infinity, alignment: .leading).background(CPTheme.background(scheme).opacity(0.55), in: RoundedRectangle(cornerRadius: 14)).overlay(RoundedRectangle(cornerRadius: 14).stroke(selected ? CPTheme.primary(option, scheme: scheme) : CPTheme.border(scheme), lineWidth: selected ? 2 : 1))
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
        guard normalizedUsername.range(of: "^[a-z0-9_]+$", options: .regularExpression) != nil else { return "Use only lowercase letters, numbers, and underscores." }
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
                    Text(usernameState == "taken" ? "That username is already taken." : usernameState == "invalid" ? (usernameError ?? "Invalid username.") : usernameState == "available" ? "Username is available. You can use it to sign in." : "3–24 lowercase letters, numbers, or underscores.")
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
                    PhotosPicker(selection: $selectedPhoto, matching: .images) { Label(features.profile.avatarPath == nil ? "Add photo" : "Change photo", systemImage: "camera") }
                        .disabled(photoBusy)
                    if photoBusy { ProgressView() }
                }
                Text("JPEG, PNG, WebP, or GIF. Maximum 5 MB.").cpFont(11).foregroundStyle(.secondary)
                if features.profile.avatarPath != nil {
                    Button("Remove photo", role: .destructive) { Task { do { photoBusy = true; defer { photoBusy = false }; try await features.removeAvatar(); status = "Photo removed." } catch { status = error.localizedDescription } } }.disabled(photoBusy)
                }
            }
            Section("About you") {
                TextField("First name", text: $details.firstName).textContentType(.givenName)
                TextField("Last name", text: $details.lastName).textContentType(.familyName)
                TextField("Nickname", text: $details.nickname)
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
            guard data.count <= 5 * 1024 * 1024 else { throw NativeAppError.server("Profile photos must be 5 MB or smaller.") }
            return (data, contentType)
        }

        // iPhone libraries commonly contain HEIC; convert it for the same avatar service.
        guard let image = UIImage(data: data) else { throw NativeAppError.server("Choose a JPEG, PNG, WebP, or GIF image.") }
        let scale = min(1, 1200 / max(image.size.width, image.size.height))
        let size = CGSize(width: image.size.width * scale, height: image.size.height * scale)
        guard size.width > 0 && size.height > 0 else { throw NativeAppError.server("Could not read that photo.") }
        let jpeg = UIGraphicsImageRenderer(size: size).jpegData(withCompressionQuality: 0.82) { _ in image.draw(in: CGRect(origin: .zero, size: size)) }
        guard jpeg.count <= 5 * 1024 * 1024 else { throw NativeAppError.server("Profile photos must be 5 MB or smaller.") }
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
            ForEach(store.bundle.courses) { course in
                Toggle(store.displayName(courseID: course.id, fallback: course.name), isOn: Binding(get: { hidden.contains(course.id) }, set: { value in if value { hidden.insert(course.id) } else { hidden.remove(course.id) }; Task { do { try await features.savePreference("hidden_course_ids", Array(hidden).sorted()); status = nil } catch { status = error.localizedDescription; hidden = features.hiddenCourseIDs } } }))
            }
            if let status { Text(status).foregroundStyle(.red) }
        }.cpListScreen().onAppear { hidden = features.hiddenCourseIDs }
    }
}

struct CanvasSettingsView: View {
    @Environment(\.colorScheme) private var scheme
    @Environment(\.cpPalette) private var paletteDependency
    @ObservedObject var store: NativeContentStore
    @State private var domain = ""
    @State private var canvasToken = ""
    @State private var working = false
    @State private var status: String?
    @State private var connectedDomain: String?
    private var cleanDomain: String {
        var value = domain.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        value = value.replacingOccurrences(of: "https://", with: "")
        value = value.replacingOccurrences(of: "http://", with: "")
        value = value.split(separator: "/").first.map(String.init) ?? value
        return value.trimmingCharacters(in: CharacterSet(charactersIn: "."))
    }
    private var canSave: Bool { cleanDomain.contains(".") && canvasToken.trimmingCharacters(in: .whitespacesAndNewlines).count >= 20 && !working }

    var body: some View {
        Form {
            Section {
                NativeSyncStatusCard(store: store) {
                    Task { await store.load() }
                }
                .listRowInsets(EdgeInsets())
                .listRowBackground(Color.clear)
            }
            if let connectedDomain {
                Section {
                    LabeledContent("Connected to", value: connectedDomain)
                } footer: {
                    Text("To change schools or replace an expired token, enter the details below and save.")
                }
            }
            Section {
                TextField("yourschool.instructure.com", text: $domain)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .keyboardType(.URL)
                    .textContentType(.URL)
                    .submitLabel(.next)
                SecureField("Canvas API token", text: $canvasToken)
                    .textContentType(.password)
                    .submitLabel(.done)
                    .onSubmit { if canSave { save() } }
                Button {
                    save()
                } label: {
                    HStack {
                        Spacer()
                        if working { ProgressView() }
                        else { Text("Validate and Save") }
                        Spacer()
                    }
                }
                .disabled(!canSave)
            } header: {
                Text("Canvas connection")
            } footer: {
                Text("The token is validated through CanvasPro and stored securely on the server, not on this device.")
            }
            if !cleanDomain.isEmpty && cleanDomain != domain {
                Section { Text("Will save as \(cleanDomain).").cpFont(13).foregroundStyle(CPTheme.muted(scheme)) }
            }
            if let status { Section { Text(status).foregroundStyle(status.localizedCaseInsensitiveContains("saved") ? CPTheme.primary(scheme: scheme) : CPTheme.warning) } }
            Section("How to get a token") { Text("In Canvas on the web, open Account → Settings → Approved Integrations → New Access Token. Copy it here once; CanvasPro cannot read it back later.") }
        }.cpListScreen().cpNavigationTitle("Canvas")
        .task {
            connectedDomain = await store.connectedCanvasDomain()
            if domain.isEmpty, let connectedDomain { domain = connectedDomain }
        }
    }

    private func save() {
        guard canSave else { return }
        working = true
        status = "Checking Canvas..."
        Task {
            defer { working = false }
            do {
                try await store.saveCanvas(domain: cleanDomain, canvasToken: canvasToken)
                domain = cleanDomain
                connectedDomain = cleanDomain
                canvasToken = ""
                status = "Canvas connection saved."
            } catch {
                status = error.localizedDescription
            }
        }
    }
}

struct ClassScheduleView: View {
    @ObservedObject var features: NativeFeatureStore
    var store: NativeContentStore? = nil
    @State private var showAdd = false
    @State private var editing: ClassScheduleEntry?
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
    var body: some View {
        List {
            Section { LabeledContent("Classes", value: "\(Set(features.schedule.map { $0.title.lowercased() }).count)"); LabeledContent("Credits", value: credits.formatted()); if !conflicts.isEmpty { ForEach(conflicts, id: \.self) { Text($0).cpFont(12).foregroundStyle(.orange) } } }
            ForEach(days.indices, id: \.self) { index in
                let day = days[index]
                let meetings = features.schedule.filter { $0.days.contains(day.0) }.sorted { $0.startMinutes < $1.startMinutes }
                if !meetings.isEmpty { Section(day.1) { ForEach(meetings) { item in Button { editing = item } label: { VStack(alignment: .leading, spacing: 3) { Text(displayName(item)).cpFont(13, .semibold); Text("\(time(item.startMinutes))–\(time(item.endMinutes))").cpFont(12).monospacedDigit(); Text([item.code, item.location, item.instructor].filter { !$0.isEmpty }.joined(separator: " · ")).cpFont(11).foregroundStyle(.secondary) } }.buttonStyle(.plain) } } }
            }
            Section("Edit or remove") { ForEach(features.schedule) { item in Button { editing = item } label: { HStack { Text(displayName(item)); Spacer(); Text(item.days.map(NativeWeekday.short).joined(separator: ", ")).foregroundStyle(.secondary) } } }
                .onDelete { indexes in
                    let items = indexes.map { features.schedule[$0] }
                    Task {
                        if features.isPreview { features.schedule.removeAll { entry in items.contains { $0.id == entry.id } }; features.persistPreviewState(); return }
                        guard let api = features.sessionStore.api else { return }
                        do {
                            let token = try await features.sessionStore.accessToken()
                            for item in items { try await api.deleteScheduleEntry(id: item.id, token: token) }
                        } catch {
                            features.errorMessage = error.localizedDescription
                        }
                        await features.load()
                    }
                } }
            if features.schedule.isEmpty { NativeEmptyState(title: "No class schedule", symbol: "calendar.badge.plus") }
        }.cpListScreen().cpNavigationTitle("Class Schedule").toolbar { Button { showAdd = true } label: { Image(systemName: "plus") } }.sheet(isPresented: $showAdd) { AddScheduleView(features: features) }.sheet(item: $editing) { AddScheduleView(features: features, editing: $0) }
    }
    private func time(_ minutes: Int) -> String { let hour = minutes / 60; let minute = minutes % 60; return String(format: "%d:%02d %@", hour % 12 == 0 ? 12 : hour % 12, minute, hour < 12 ? "AM" : "PM") }
}

private struct AddScheduleView: View {
    @Environment(\.dismiss) private var dismiss
    @ObservedObject var features: NativeFeatureStore
    var editing: ClassScheduleEntry? = nil
    @State private var title = ""; @State private var code = ""; @State private var location = ""; @State private var instructor = ""; @State private var credits = ""; @State private var selectedDays = Set<String>(); @State private var start = Date(); @State private var end = Date().addingTimeInterval(3600); @State private var error: String?
    @State private var perDay = false
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
    var title: String { self == .privacy ? "Privacy Policy" : "Terms of Service" }
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
            Button(compact ? "Terms" : "Terms of Service") { page = .terms }
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
        CPGlassCard(title: "Connect Canvas", subtitle: "CanvasPro shows your classes, deadlines, and grades once it's connected to your school's Canvas.", strong: true) {
            VStack(alignment: .leading, spacing: 10) {
                Label("Have your school's Canvas address ready, like yourschool.instructure.com.", systemImage: "1.circle.fill")
                Label("In Canvas, open Account → Settings → New Access Token, and copy the token.", systemImage: "2.circle.fill")
                Label("Paste both on the next screen. Your school password is never needed.", systemImage: "3.circle.fill")
            }
            .cpFont(12)
            .lineSpacing(2)
            .foregroundStyle(CPTheme.muted(scheme))
            .fixedSize(horizontal: false, vertical: true)
            NavigationLink { CanvasSettingsView(store: store) } label: {
                Label("Connect Canvas", systemImage: "link")
            }
            .buttonStyle(CPButtonStyle(kind: .primary, fullWidth: true))
        }
    }
}
