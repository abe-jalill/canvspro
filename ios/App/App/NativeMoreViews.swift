import SwiftUI
import UserNotifications

struct NativeSettingsView: View {
    @Environment(\.colorScheme) private var scheme
    @ObservedObject var sessionStore: NativeSessionStore
    @ObservedObject var contentStore: NativeContentStore
    @ObservedObject var features: NativeFeatureStore

    var body: some View {
        NavigationStack {
            ZStack {
                CPBackdrop()
                ScrollView {
                    LazyVStack(spacing: 20) {
                        CPPageHeader(eyebrow: "Your account", title: "Settings", detail: "Personalize CanvasPro and control what the app can do.")
                        CPGlassCard(title: "Plan & organize", subtitle: "The tools that live in the website sidebar.") {
                            settingsLink("Get It Done", "sparkles") { GetItDoneView(store: contentStore, features: features) }
                            settingsLink("Focus", "scope") { FocusView(store: contentStore, features: features) }
                            settingsLink("Calendar", "calendar") { CalendarView(store: contentStore, features: features) }
                            settingsLink("Class Schedule", "calendar.badge.clock") { ClassScheduleView(features: features) }
                            settingsLink("Announcements", "megaphone") { AnnouncementsView(store: contentStore) }
                        }
                        AppearanceSettingsCard()
                        CPGlassCard(title: "Profile", subtitle: "Your personal CanvasPro details.") {
                            settingsLink("Open profile settings", "person.crop.circle") { ProfileView(features: features, email: sessionStore.session?.user.email) }
                        }
                        CPGlassCard(title: "Courses", subtitle: "Names, visibility, and announcement history.") {
                            settingsLink("Announcements", "clock.arrow.circlepath") { AnnouncementWindowSettingsView() }
                            settingsLink("Class names", "character.cursor.ibeam") { ClassNamesView(store: contentStore) }
                            settingsLink("Which classes to show", "eye.slash") { HiddenCoursesView(store: contentStore, features: features) }
                        }
                        CPGlassCard(title: "Preview mode", subtitle: "No sign-in is required for this build.") { Text("Sample information is stored locally. Authentication, billing, Canvas connection, and notification preferences are intentionally excluded for now.").font(.system(size: 14)).foregroundStyle(CPTheme.muted(scheme)).lineSpacing(3) }
                        CPGlassCard(title: "Legal") {
                            settingsLink("Privacy Policy", "hand.raised") { NativeLegalView(title: "Privacy Policy") }
                            settingsLink("Terms of Service", "doc.text") { NativeLegalView(title: "Terms of Service") }
                        }
                    }.padding(.horizontal, 15).padding(.top, 10).padding(.bottom, 30)
                }
            }.navigationTitle("Settings").navigationBarTitleDisplayMode(.inline)
        }
    }

    private func settingsLink<Destination: View>(_ title: String, _ symbol: String, @ViewBuilder destination: () -> Destination) -> some View {
        NavigationLink(destination: destination()) { CPInsetRow { HStack(spacing: 12) { Image(systemName: symbol).frame(width: 22).foregroundStyle(CPTheme.primary(scheme: scheme)); Text(title).font(.system(size: 14, weight: .medium)); Spacer(); Image(systemName: "chevron.right").font(.system(size: 12, weight: .medium)).foregroundStyle(CPTheme.muted(scheme)) } } }.buttonStyle(.plain)
    }
}

private struct GetItDoneView: View {
    @Environment(\.colorScheme) private var scheme
    @ObservedObject var store: NativeContentStore
    @ObservedObject var features: NativeFeatureStore
    @State private var window = 7
    @State private var skipped = Set<Int>()
    private var candidates: [AssignmentItem] {
        let limit = Date().addingTimeInterval(Double(window) * 86400)
        return store.bundle.assignments.filter { !$0.isFinished(in: store) && !skipped.contains($0.id) && ($0.dueDate ?? limit) <= limit }.sorted { score($0) > score($1) }
    }
    private func score(_ item: AssignmentItem) -> Double {
        let hours = max(1, (item.dueDate ?? .distantFuture).timeIntervalSinceNow / 3600)
        return (item.submission?.missing == true ? 1000 : 0) + 100 / hours + Double(features.estimates[item.id] ?? 25) / 100
    }
    var body: some View {
        ZStack {
            CPBackdrop()
            ScrollView {
                LazyVStack(spacing: 20) {
                    VStack(alignment: .leading, spacing: 12) { CPPageHeader(eyebrow: "Get It Done", title: "Get It Done", detail: nil); HStack(spacing: 8) { ForEach([7, 14], id: \.self) { value in Button { window = value } label: { CPChip(text: value == 7 ? "1 week" : "2 weeks", selected: window == value) }.buttonStyle(.plain) } } }
                    if let first = candidates.first {
                        CPGlassCard(title: "What Should I Do Now?", subtitle: "One clear next step, chosen from deadlines, workload, priority, and the rest of your week.", strong: true) {
                            HStack(alignment: .top, spacing: 12) { Image(systemName: "sparkles").frame(width: 36, height: 36).background(CPTheme.inset(scheme), in: RoundedRectangle(cornerRadius: 12)); VStack(alignment: .leading, spacing: 8) { NativeAssignmentRow(assignment: first, store: store); Text("This is the strongest next step based on its deadline and estimated workload.").font(.system(size: 14)).foregroundStyle(CPTheme.foreground(scheme).opacity(0.85)).lineSpacing(3) } }
                            HStack { Button("Choose another") { skipped.insert(first.id) }.buttonStyle(.bordered); Spacer(); Label("\(features.estimates[first.id] ?? 25) min", systemImage: "timer").font(.system(size: 12)).foregroundStyle(CPTheme.muted(scheme)) }
                        }
                    }
                    CPGlassCard(title: "Today’s Plan", subtitle: "A realistic order for the work CanvasPro thinks you can make progress on today.") {
                        LazyVGrid(columns: phoneMetricColumns, spacing: 8) { PlanMetricTile(value: "\(candidates.prefix(8).reduce(0) { $0 + (features.estimates[$1.id] ?? 25) })m", label: "Remaining workload"); PlanMetricTile(value: "0%", label: "Plan progress"); PlanMetricTile(value: "0/\(min(8, candidates.count))", label: "Tasks") }
                        VStack(spacing: 8) { ForEach(candidates.prefix(8)) { item in CPInsetRow { VStack(alignment: .leading, spacing: 5) { NativeAssignmentRow(assignment: item, store: store); Text("Estimated \(features.estimates[item.id] ?? 25) minutes").font(.system(size: 12)).foregroundStyle(CPTheme.muted(scheme)) } } } }
                        if candidates.isEmpty { NativeEmptyState(title: "No plan needed.", symbol: "checkmark.circle", detail: "Everything urgent is complete, skipped, or already submitted.") }
                    }
                }.padding(15).padding(.bottom, 24)
            }
        }.navigationTitle("Get It Done").navigationBarTitleDisplayMode(.inline)
    }
    private var phoneMetricColumns: [GridItem] { [GridItem(.flexible(minimum: 0), spacing: 8), GridItem(.flexible(minimum: 0), spacing: 8)] }
}

private struct FocusView: View {
    @Environment(\.colorScheme) private var scheme
    @ObservedObject var store: NativeContentStore
    @ObservedObject var features: NativeFeatureStore
    @State private var days = 7
    @State private var showCompleted = false
    private var items: [AssignmentItem] {
        let end = Date().addingTimeInterval(Double(days) * 86400)
        let custom = features.customAssignments.map { item in AssignmentItem.custom(item, course: store.bundle.courses.first { $0.id == item.courseID }) }
        return (store.bundle.assignments + custom).filter { ($0.dueDate ?? .distantFuture) <= end && (showCompleted || !$0.isFinished(in: store)) }.sorted(by: AssignmentItem.dueSort)
    }
    var body: some View {
        ZStack {
            CPBackdrop()
            ScrollView {
                LazyVStack(spacing: 18) {
                    CPPageHeader(eyebrow: "Focus", title: days == 3650 ? "All assignments" : "Due within \(days == 7 ? "1 week" : "\(days) day\(days == 1 ? "" : "s")")", detail: nil)
                    ScrollView(.horizontal, showsIndicators: false) { HStack(spacing: 8) { ForEach([3650, 7, 3, 2, 1], id: \.self) { value in Button { days = value } label: { CPChip(text: focusLabel(value), selected: days == value) }.buttonStyle(.plain) } } }
                    HStack { Text(showCompleted ? "Showing completed assignments" : "Showing unfinished assignments").font(.system(size: 12)).foregroundStyle(CPTheme.muted(scheme)); Spacer(); Toggle("Show completed", isOn: $showCompleted).labelsHidden() }
                    CPGlassCard {
                        if items.isEmpty { NativeEmptyState(title: "You’re all caught up.", symbol: "checkmark", detail: "No assignments match this view. Choose All dates to check other deadlines.") }
                        VStack(spacing: 8) { ForEach(items) { item in CPInsetRow { NativeAssignmentRow(assignment: item, store: store) } } }
                    }
                }.padding(15).padding(.bottom, 24)
            }
        }.navigationTitle("Focus").navigationBarTitleDisplayMode(.inline)
    }
    private func focusLabel(_ value: Int) -> String { value == 3650 ? "All dates" : value == 7 ? "1 week" : "\(value) day\(value == 1 ? "" : "s")" }
}

private struct PlanMetricTile: View {
    @Environment(\.colorScheme) private var scheme
    let value: String; let label: String
    var body: some View { VStack(alignment: .leading, spacing: 5) { Text(label.uppercased()).font(.system(size: 9, weight: .medium)).tracking(1.2).foregroundStyle(CPTheme.muted(scheme)).lineLimit(2); Text(value).font(.system(size: 18, weight: .medium)).monospacedDigit() }.padding(12).frame(maxWidth: .infinity, minHeight: 76, alignment: .leading).background(CPTheme.inset(scheme), in: RoundedRectangle(cornerRadius: 20)).overlay(RoundedRectangle(cornerRadius: 20).stroke(CPTheme.insetBorder(scheme))) }
}

private struct CalendarView: View {
    @Environment(\.colorScheme) private var scheme
    @ObservedObject var store: NativeContentStore
    @ObservedObject var features: NativeFeatureStore
    @State private var weekOnly = true
    private var agenda: [(Date, String, String)] {
        let end = weekOnly ? Date().addingTimeInterval(7 * 86400) : Date.distantFuture
        var result = store.bundle.assignments.compactMap { item -> (Date, String, String)? in
            guard let date = item.dueDate, date >= Date(), date <= end else { return nil }
            return (date, item.name, item.courseName)
        }
        result += store.bundle.calendar.compactMap { event in
            guard let raw = event.startAt, let date = ISO8601DateFormatter.canvas.date(from: raw), date >= Date(), date <= end else { return nil }
            return (date, event.title, "Canvas event")
        }
        result += features.calendarPicks.compactMap { pick in
            guard let date = ISO8601DateFormatter.canvas.date(from: pick.at), date >= Date(), date <= end else { return nil }
            return (date, pick.title, pick.context)
        }
        return result.sorted { $0.0 < $1.0 }
    }
    var body: some View {
        ZStack {
            CPBackdrop()
            ScrollView {
                LazyVStack(spacing: 20) {
                    VStack(alignment: .leading, spacing: 12) { CPPageHeader(eyebrow: weekOnly ? "Next 7 days" : "Full semester", title: "Calendar", detail: nil); HStack(spacing: 8) { Button { weekOnly = true } label: { CPChip(text: "This Week", selected: weekOnly) }.buttonStyle(.plain); Button { weekOnly = false } label: { CPChip(text: "Full Semester", selected: !weekOnly) }.buttonStyle(.plain) } }
                    CPGlassCard(title: "Workload", subtitle: "Assignment density by week") { WorkloadView(assignments: store.bundle.assignments) }
                    CPGlassCard {
                        VStack(spacing: 8) { ForEach(Array(agenda.enumerated()), id: \.offset) { _, item in CPInsetRow { HStack { VStack(alignment: .leading, spacing: 5) { Text(item.1).font(.system(size: 14, weight: .medium)); Text(item.2).font(.system(size: 12)).foregroundStyle(CPTheme.muted(scheme)) }; Spacer(); Text(item.0, format: .dateTime.month().day().hour().minute()).font(.system(size: 12)).foregroundStyle(CPTheme.muted(scheme)).multilineTextAlignment(.trailing) } } } }
                        if agenda.isEmpty { NativeEmptyState(title: "Nothing scheduled", symbol: "calendar", detail: weekOnly ? "Nothing scheduled in the next 7 days." : "Nothing scheduled for the semester.") }
                    }
                }.padding(15).padding(.bottom, 24)
            }
        }.navigationTitle("Calendar").navigationBarTitleDisplayMode(.inline)
    }
}

struct WorkloadView: View {
    let assignments: [AssignmentItem]
    var body: some View {
        HStack(spacing: 6) {
            ForEach(0..<7, id: \.self) { offset in
                let day = Calendar.current.date(byAdding: .day, value: offset, to: Date())!
                let count = assignments.filter { $0.dueDate.map { Calendar.current.isDate($0, inSameDayAs: day) } ?? false }.count
                VStack { RoundedRectangle(cornerRadius: 5).fill(count == 0 ? Color.secondary.opacity(0.15) : CPTheme.accent.opacity(min(1, 0.3 + Double(count) * 0.18))).frame(height: 34); Text(day, format: .dateTime.weekday(.narrow)).font(.caption2) }.accessibilityLabel("\(count) assignments")
            }
        }
    }
}

private struct AnnouncementsView: View {
    @Environment(\.colorScheme) private var scheme
    @ObservedObject var store: NativeContentStore
    @State private var search = ""
    private var items: [AnnouncementItem] { store.bundle.announcements.filter { search.isEmpty || $0.title.localizedCaseInsensitiveContains(search) || $0.courseName.localizedCaseInsensitiveContains(search) } }
    private var courseCount: Int { Set(items.map(\.courseID)).count }
    var body: some View {
        ZStack {
            CPBackdrop()
            ScrollView {
                LazyVStack(spacing: 18) {
                    CPGlassCard(strong: true) {
                        VStack(alignment: .leading, spacing: 18) {
                            Image(systemName: "megaphone").font(.system(size: 20)).foregroundStyle(CPTheme.primary(scheme: scheme)).frame(width: 44, height: 44).background(CPTheme.primary(scheme: scheme).opacity(0.15), in: RoundedRectangle(cornerRadius: 16))
                            Text("CAMPUS FEED · 2 WEEKS").font(.system(size: 12, weight: .medium)).tracking(2.4).foregroundStyle(CPTheme.muted(scheme))
                            Text("What changed while you were away.").font(.system(size: 38, weight: .medium)).tracking(-1.7)
                            Text("Every course update, ordered by when it happened—not hidden behind class cards.").font(.system(size: 14)).foregroundStyle(CPTheme.muted(scheme)).lineSpacing(4)
                            HStack(spacing: 8) { announcementMetric(items.count, "Recent posts"); announcementMetric(courseCount, "Active courses") }
                        }
                    }.overlay(alignment: .topTrailing) { Circle().fill(CPTheme.primary(scheme: scheme).opacity(0.15)).frame(width: 260, height: 260).blur(radius: 70).offset(x: 95, y: -95).allowsHitTesting(false) }
                    CPGlassCard {
                        VStack(spacing: 0) {
                            ForEach(items) { item in NavigationLink { AnnouncementDetailView(item: item) } label: { HStack(alignment: .top, spacing: 14) { VStack(alignment: .leading, spacing: 3) { Text(announcementDate(item)).font(.system(size: 14, weight: .medium)).monospacedDigit(); Text(announcementTime(item)).font(.system(size: 11)).foregroundStyle(CPTheme.muted(scheme)) }.frame(width: 62, alignment: .leading); VStack(alignment: .leading, spacing: 6) { Text(item.courseName).font(.system(size: 11, weight: .medium)).foregroundStyle(CPTheme.primary(scheme: scheme)); Text(item.title).font(.system(size: 15, weight: .medium)); Text(item.message.strippingHTML).font(.system(size: 12)).foregroundStyle(CPTheme.muted(scheme)).lineLimit(3) }; Spacer(); Image(systemName: "chevron.right").font(.system(size: 11, weight: .medium)).foregroundStyle(CPTheme.muted(scheme)) }.padding(.vertical, 16) }.buttonStyle(.plain); if item.id != items.last?.id { Divider().overlay(CPTheme.foreground(scheme).opacity(0.10)) } }
                        }
                        if items.isEmpty { NativeEmptyState(title: "No recent announcements", symbol: "megaphone") }
                    }
                }.padding(15).padding(.bottom, 24)
            }.searchable(text: $search).refreshable { await store.load() }
        }.navigationTitle("Announcements").navigationBarTitleDisplayMode(.inline)
    }
    private func announcementMetric(_ value: Int, _ label: String) -> some View { VStack(alignment: .leading, spacing: 4) { Text("\(value)").font(.system(size: 30, weight: .medium)).tracking(-1.5); Text(label).font(.system(size: 12)).foregroundStyle(CPTheme.muted(scheme)) }.padding(14).frame(maxWidth: .infinity, alignment: .leading).background(CPTheme.background(scheme).opacity(0.35), in: RoundedRectangle(cornerRadius: 16)).overlay(RoundedRectangle(cornerRadius: 16).stroke(CPTheme.foreground(scheme).opacity(0.10))) }
    private func announcementDate(_ item: AnnouncementItem) -> String { ISO8601DateFormatter.canvas.date(from: item.postedAt)?.formatted(.dateTime.month(.abbreviated).day()) ?? "Recent" }
    private func announcementTime(_ item: AnnouncementItem) -> String { ISO8601DateFormatter.canvas.date(from: item.postedAt)?.formatted(.dateTime.hour().minute()) ?? "" }
}

struct AnnouncementDetailView: View {
    let item: AnnouncementItem
    var body: some View { ZStack { CPBackdrop(); ScrollView { CPGlassCard(title: item.title, subtitle: item.courseName, strong: true) { Text(item.message.strippingHTML).textSelection(.enabled); if let url = URL(string: item.htmlURL), !item.htmlURL.isEmpty { Link("Open in Canvas", destination: url) } }.padding() } }.navigationTitle("Announcement").navigationBarTitleDisplayMode(.inline) }
}

private struct NotificationsView: View {
    @ObservedObject var sessionStore: NativeSessionStore
    @ObservedObject var features: NativeFeatureStore
    @State private var status: String?
    @State private var syncing = false
    var body: some View {
        Form {
            Section("Master") {
                Toggle("Notifications", isOn: bind(\.enabled)); Toggle("App icon badge", isOn: bind(\.badge)); Toggle("Quiet hours", isOn: bind(\.quietEnabled))
                if features.notificationPreferences.quietEnabled { Stepper("Starts at \(features.notificationPreferences.quietStart):00", value: bind(\.quietStart), in: 0...23); Stepper("Ends at \(features.notificationPreferences.quietEnd):00", value: bind(\.quietEnd), in: 0...23) }
            }
            Section("Due date reminders") { Toggle("1 week before", isOn: bind(\.due1w)); Toggle("3 days before", isOn: bind(\.due3d)); Toggle("2 days before", isOn: bind(\.due2d)); Toggle("1 day before", isOn: bind(\.due1d)) }
            Section("Canvas updates") { Toggle("Grades", isOn: bind(\.grades)); Toggle("Announcements", isOn: bind(\.announcements)); if features.notificationPreferences.grades { Stepper("Grade threshold: \(Int(features.notificationPreferences.gradeThreshold))%", value: bind(\.gradeThreshold), in: 0...100, step: 5) } }
            Section("Class schedule") { Toggle("Class countdown", isOn: bind(\.countdownClass)); Toggle("Tonight’s deadlines", isOn: bind(\.countdownTonight)) }
            Section { Button { save() } label: { HStack { Spacer(); if syncing { ProgressView() } else { Text("Save Notification Settings") }; Spacer() } }.disabled(syncing) }
            Section("History") { ForEach(features.alerts) { alert in VStack(alignment: .leading) { Text(alert.title).font(.headline); Text(alert.body).font(.subheadline); Text(alert.sentAt == nil ? "Scheduled" : "Sent").font(.caption).foregroundStyle(.secondary) } }; if features.alerts.isEmpty { Text("No notification history").foregroundStyle(.secondary) } }
            if let status { Section { Text(status).foregroundStyle(.secondary) } }
        }
        .cpListScreen()
        .navigationTitle("Notifications")
        .onReceive(NotificationCenter.default.publisher(for: .nativeDeviceToken)) { note in
            if let token = note.object as? String { Task { await register(token) } }
            else if let error = note.object as? Error { status = error.localizedDescription }
        }
    }
    private func bind<T>(_ path: WritableKeyPath<NotificationPreferences, T>) -> Binding<T> { Binding(get: { features.notificationPreferences[keyPath: path] }, set: { features.notificationPreferences[keyPath: path] = $0 }) }
    private func save() {
        if features.isPreview {
            status = "Preview settings saved on this simulator."
            return
        }
        syncing = true
        Task {
            defer { syncing = false }
            do {
                if features.notificationPreferences.enabled {
                    let granted = try await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound])
                    if granted { UIApplication.shared.registerForRemoteNotifications() } else { features.notificationPreferences.enabled = false }
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

private struct AppearanceView: View {
    var body: some View { ZStack { CPBackdrop(); ScrollView { AppearanceSettingsCard().padding(15) } }.navigationTitle("Appearance").navigationBarTitleDisplayMode(.inline) }
}

private struct AppearanceSettingsCard: View {
    @Environment(\.colorScheme) private var resolvedScheme
    @AppStorage("CanvasProColorScheme") private var scheme = "system"
    @AppStorage("CanvasProPalette") private var palette = "forest"
    private let columns = [GridItem(.flexible()), GridItem(.flexible())]
    var body: some View {
        CPGlassCard(title: "Make yourself at home", subtitle: "Your colors, saved to your account. A familiar space on every device.", strong: true) {
                    Text("COLOR PALETTE").font(.system(size: 12, weight: .medium)).tracking(1.9).foregroundStyle(CPTheme.muted(resolvedScheme))
                    LazyVGrid(columns: columns, spacing: 11) {
                        ForEach(Array(CPPalette.allCases.dropLast())) { option in
                            Button { palette = option.rawValue } label: { PaletteOption(option: option, selected: palette == option.rawValue) }.buttonStyle(.plain)
                        }
                        Button { palette = CPPalette.neutral.rawValue } label: { PaletteOption(option: .neutral, selected: palette == CPPalette.neutral.rawValue) }.buttonStyle(.plain).gridCellColumns(2)
                    }
                    Text("APPEARANCE").font(.system(size: 12, weight: .medium)).tracking(1.9).foregroundStyle(CPTheme.muted(resolvedScheme)).padding(.top, 4)
                    LazyVGrid(columns: [GridItem(.flexible(minimum: 0), spacing: 9), GridItem(.flexible(minimum: 0), spacing: 9), GridItem(.flexible(minimum: 0))], spacing: 9) {
                        appearanceButton("light", "Light", "sun.max")
                        appearanceButton("dark", "Dark", "moon")
                        appearanceButton("system", "System", "desktopcomputer")
                    }
                    Text(scheme == "system" ? "Follows your device’s light or dark appearance." : "A space that feels like you.").font(.system(size: 12)).foregroundStyle(CPTheme.muted(resolvedScheme))
        }
    }
    private func appearanceButton(_ value: String, _ title: String, _ symbol: String) -> some View {
        Button { scheme = value } label: {
            VStack(spacing: 7) { Image(systemName: symbol).font(.system(size: 16)); Text(title).font(.system(size: 12, weight: .medium)); if scheme == value { Image(systemName: "checkmark").font(.system(size: 10, weight: .medium)) } }
                .frame(maxWidth: .infinity, minHeight: 66).foregroundStyle(scheme == value ? CPTheme.primary(scheme: resolvedScheme) : CPTheme.foreground(resolvedScheme)).background(scheme == value ? CPTheme.primary(scheme: resolvedScheme).opacity(0.10) : CPTheme.inset(resolvedScheme), in: RoundedRectangle(cornerRadius: 12)).overlay(RoundedRectangle(cornerRadius: 12).stroke(scheme == value ? CPTheme.primary(scheme: resolvedScheme).opacity(0.55) : CPTheme.insetBorder(resolvedScheme)))
        }.buttonStyle(.plain)
    }
}

private struct AnnouncementWindowSettingsView: View {
    @Environment(\.colorScheme) private var scheme
    @AppStorage("CanvasProAnnouncementWeeks") private var weeks = 2
    var body: some View {
        ZStack {
            CPBackdrop()
            ScrollView {
                CPGlassCard(title: "Announcements", subtitle: "How far back the announcements list reaches.", strong: true) {
                    HStack(spacing: 10) { ForEach([1, 2], id: \.self) { value in Button { weeks = value } label: { CPChip(text: "\(value) week\(value == 1 ? "" : "s")", selected: weeks == value) }.buttonStyle(.plain) } }
                    Text("Announcements older than this are hidden from the list.").font(.system(size: 12)).foregroundStyle(CPTheme.muted(scheme))
                }.padding(15)
            }
        }.navigationTitle("Announcements").navigationBarTitleDisplayMode(.inline)
    }
}

private struct PaletteOption: View {
    @Environment(\.colorScheme) private var scheme
    let option: CPPalette; let selected: Bool
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            ZStack(alignment: .bottomTrailing) {
                HStack(spacing: 6) { RoundedRectangle(cornerRadius: 4).fill(option.swatch.opacity(0.20)).frame(width: 24); VStack(spacing: 6) { RoundedRectangle(cornerRadius: 4).fill(option.swatch.opacity(0.42)); RoundedRectangle(cornerRadius: 4).fill(option.swatch.opacity(0.13)) } }.padding(9).frame(height: 72).background(Color.hsl(option.hue, 0.12, 0.075), in: RoundedRectangle(cornerRadius: 9))
                if selected { Image(systemName: "checkmark").font(.system(size: 12, weight: .medium)).foregroundStyle(Color.hsl(option.hue, 0.28, 0.08)).frame(width: 22, height: 22).background(option.swatch, in: Circle()).padding(7) }
            }
            Text(option.name).font(.system(size: 13, weight: .medium)).foregroundStyle(CPTheme.foreground(scheme))
            Text(option.detail).font(.system(size: 11)).foregroundStyle(CPTheme.muted(scheme)).lineLimit(2)
        }.padding(8).frame(maxWidth: .infinity, alignment: .leading).background(CPTheme.background(scheme).opacity(0.55), in: RoundedRectangle(cornerRadius: 14)).overlay(RoundedRectangle(cornerRadius: 14).stroke(selected ? CPTheme.primary(option, scheme: scheme) : CPTheme.border(scheme), lineWidth: selected ? 2 : 1))
    }
}

private struct ProfileView: View {
    @ObservedObject var features: NativeFeatureStore
    let email: String?
    @State private var username = ""
    @State private var status: String?
    var body: some View { Form { Section("Account") { LabeledContent("Email", value: email ?? "—"); TextField("Username", text: $username).textInputAutocapitalization(.never); Button("Save username") { Task { do { try await features.saveUsername(username); status = "Profile saved." } catch { status = error.localizedDescription } } } }; if let status { Section { Text(status).foregroundStyle(.secondary) } } }.cpListScreen().navigationTitle("Profile").onAppear { username = features.profile.username ?? "" } }
}

private struct ClassNamesView: View {
    @ObservedObject var store: NativeContentStore
    @State private var drafts: [Int: String] = [:]
    @State private var status: String?
    var body: some View { Form { Section("Class names") { ForEach(store.bundle.courses) { course in VStack(alignment: .leading) { Text(course.name).font(.caption).foregroundStyle(.secondary); TextField("Nickname", text: Binding(get: { drafts[course.id] ?? store.nicknames[course.id]?.customName ?? "" }, set: { drafts[course.id] = $0 })).onSubmit { save(course) } } } }; if let status { Section { Text(status) } } }.cpListScreen().navigationTitle("Class Names") }
    private func save(_ course: CourseSummary) { Task { do { try await store.saveNickname(course: course, name: drafts[course.id] ?? ""); status = "Saved." } catch { status = error.localizedDescription } } }
}

private struct HiddenCoursesView: View {
    @ObservedObject var store: NativeContentStore
    @ObservedObject var features: NativeFeatureStore
    @State private var hidden = Set<Int>()
    var body: some View {
        List(store.bundle.courses) { course in
            Toggle(store.displayName(courseID: course.id, fallback: course.name), isOn: Binding(get: { hidden.contains(course.id) }, set: { value in if value { hidden.insert(course.id) } else { hidden.remove(course.id) }; Task { try? await features.savePreference("hidden-courses", Array(hidden)) } }))
        }.cpListScreen().navigationTitle("Hidden Courses").onAppear { if case .some(.array(let values)) = features.preferences["hidden-courses"] { hidden = Set(values.compactMap { if case .number(let id) = $0 { return Int(id) }; return nil }) } }
    }
}

private struct CanvasSettingsView: View {
    @ObservedObject var store: NativeContentStore
    @State private var domain = ""; @State private var canvasToken = ""; @State private var working = false; @State private var status: String?
    var body: some View {
        Form {
            Section {
                TextField("yourschool.instructure.com", text: $domain).textInputAutocapitalization(.never).keyboardType(.URL)
                SecureField("Canvas API token", text: $canvasToken)
                Button("Validate and Save") { save() }.disabled(domain.isEmpty || canvasToken.isEmpty || working)
            } header: {
                Text("Canvas connection")
            } footer: {
                Text("The token is validated through CanvasPro and stored securely on the server, not on this device.")
            }
            if let status { Section { Text(status).foregroundStyle(.secondary) } }
            Section("How to get a token") { Text("In Canvas on the web, open Account → Settings → Approved Integrations → New Access Token. Copy it here once; CanvasPro cannot read it back later.") }
        }.cpListScreen().navigationTitle("Canvas")
    }
    private func save() { working = true; Task { defer { working = false }; do { try await store.saveCanvas(domain: domain, canvasToken: canvasToken); canvasToken = ""; status = "Canvas connection saved." } catch { status = error.localizedDescription } } }
}

private struct ClassScheduleView: View {
    @ObservedObject var features: NativeFeatureStore
    @State private var showAdd = false
    var body: some View {
        List {
            ForEach(features.schedule) { item in VStack(alignment: .leading, spacing: 4) { Text(item.title).font(.headline); Text("\(item.days.joined(separator: ", ")) · \(time(item.startMinutes))–\(time(item.endMinutes))").font(.subheadline); Text([item.code, item.section, item.location, item.instructor].filter { !$0.isEmpty }.joined(separator: " · ")).font(.caption).foregroundStyle(.secondary) } }
                .onDelete { indexes in Task {
                    if features.isPreview { features.schedule.remove(atOffsets: indexes); return }
                    for index in indexes {
                        let item = features.schedule[index]
                        if let api = features.sessionStore.api {
                            let token = try await features.sessionStore.accessToken()
                            try? await api.deleteScheduleEntry(id: item.id, token: token)
                        }
                    }
                    await features.load()
                } }
            if features.schedule.isEmpty { NativeEmptyState(title: "No class schedule", symbol: "calendar.badge.plus") }
        }.cpListScreen().navigationTitle("Class Schedule").toolbar { Button { showAdd = true } label: { Image(systemName: "plus") } }.sheet(isPresented: $showAdd) { AddScheduleView(features: features) }
    }
    private func time(_ minutes: Int) -> String { let hour = minutes / 60; let minute = minutes % 60; return String(format: "%d:%02d %@", hour % 12 == 0 ? 12 : hour % 12, minute, hour < 12 ? "AM" : "PM") }
}

private struct AddScheduleView: View {
    @Environment(\.dismiss) private var dismiss
    @ObservedObject var features: NativeFeatureStore
    @State private var title = ""; @State private var code = ""; @State private var location = ""; @State private var instructor = ""; @State private var selectedDays = Set<String>(); @State private var start = Date(); @State private var end = Date().addingTimeInterval(3600); @State private var error: String?
    private let days = ["M", "T", "W", "R", "F", "S", "U"]
    var body: some View {
        NavigationStack {
            Form {
                Section("Class") { TextField("Title", text: $title); TextField("Course code", text: $code); TextField("Location", text: $location); TextField("Instructor", text: $instructor) }
                Section("Meets") { HStack { ForEach(days, id: \.self) { day in Button(day) { if selectedDays.contains(day) { selectedDays.remove(day) } else { selectedDays.insert(day) } }.buttonStyle(.borderedProminent).tint(selectedDays.contains(day) ? CPTheme.accent : .gray) } }; DatePicker("Starts", selection: $start, displayedComponents: .hourAndMinute); DatePicker("Ends", selection: $end, displayedComponents: .hourAndMinute) }
                if let error { Section { Text(error).foregroundStyle(.red) } }
            }.cpListScreen().navigationTitle("Add Class").toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }; ToolbarItem(placement: .confirmationAction) { Button("Save") { save() }.disabled(title.isEmpty || selectedDays.isEmpty) } }
        }
    }
    private func save() {
        let cal = Calendar.current
        let startMinutes = cal.component(.hour, from: start) * 60 + cal.component(.minute, from: start)
        let endMinutes = cal.component(.hour, from: end) * 60 + cal.component(.minute, from: end)
        let entry = ClassScheduleEntry(id: "", code: code, section: "", title: title, crn: "", credits: 0, instructor: instructor, location: location, campus: "", scheduleType: "Lecture", days: days.filter(selectedDays.contains), startMinutes: startMinutes, endMinutes: endMinutes, term: "", dateRange: "", canvasCourseID: nil)
        Task {
            do {
                if features.isPreview {
                    var previewEntry = entry
                    previewEntry.id = "preview-\(UUID().uuidString)"
                    features.schedule.append(previewEntry)
                    dismiss()
                    return
                }
                guard let api = features.sessionStore.api, let user = features.sessionStore.session?.user else { return }
                let token = try await features.sessionStore.accessToken()
                try await api.saveScheduleEntry(entry, token: token, userID: user.id)
                await features.load()
                dismiss()
            } catch { self.error = error.localizedDescription }
        }
    }
}

struct NativeLegalView: View {
    let title: String
    var body: some View {
        ZStack {
            CPBackdrop()
            ScrollView {
                CPGlassCard(title: title, strong: true) {
                    Text("CanvasPro stores the account and coursework settings needed to provide the service. Canvas credentials are stored server-side and used only to retrieve your Canvas data. You may delete your account and its stored data from CanvasPro. Use of CanvasPro is subject to school and Canvas policies.")
                    Text("The complete, current policy is also available on canvaspro.app.").foregroundStyle(.secondary)
                    if let url = URL(string: title == "Privacy Policy" ? "https://canvaspro.app/privacy" : "https://canvaspro.app/terms") { Link("View current \(title)", destination: url) }
                }.padding()
            }
        }.navigationTitle(title).navigationBarTitleDisplayMode(.inline)
    }
}
