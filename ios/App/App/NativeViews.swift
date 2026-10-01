import SwiftUI
import Combine
import UserNotifications

struct NativeRootView: View {
    @StateObject private var sessionStore = NativeSessionStore()
    @AppStorage("CanvasProColorScheme") private var colorScheme = "system"
    @AppStorage("CanvasProPalette") private var palette = "forest"

    var body: some View {
        Group {
            if sessionStore.session != nil {
                NativeMainTabView(sessionStore: sessionStore)
            } else {
                NativeAuthView(sessionStore: sessionStore)
            }
        }
        .font(.system(size: 13, weight: .regular))
        .fontDesign(.rounded)
        .fontWeight(.regular)
        .tint(CPTheme.primary(CPPalette(rawValue: palette) ?? .forest, scheme: colorScheme == "dark" ? .dark : colorScheme == "light" ? .light : UITraitCollection.current.userInterfaceStyle == .dark ? .dark : .light))
        .preferredColorScheme(colorScheme == "dark" ? .dark : colorScheme == "light" ? .light : nil)
        .background(CPTheme.background(colorScheme == "dark" ? .dark : colorScheme == "light" ? .light : UITraitCollection.current.userInterfaceStyle == .dark ? .dark : .light).ignoresSafeArea())
    }
}

private struct NativeAuthView: View {
    enum Mode: String, CaseIterable { case signIn = "Sign In", signUp = "Create Account" }
    @ObservedObject var sessionStore: NativeSessionStore
    @State private var mode: Mode = .signIn
    @State private var email = ""
    @State private var password = ""
    @State private var firstName = ""
    @State private var lastName = ""
    @State private var major = ""
    @State private var classOf = ""
    @State private var ageConfirmed = false
    @State private var legalAccepted = false
    @State private var notice: String?
    @State private var showReset = false

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    VStack(spacing: 12) {
                        Image(systemName: "graduationcap.fill").font(.system(size: 48)).foregroundStyle(Color.accentColor)
                        Text("CanvasPro").font(.title.weight(.regular))
                        Text("Your coursework, organized natively on iPhone.").foregroundStyle(.secondary).multilineTextAlignment(.center)
                    }.frame(maxWidth: .infinity).listRowBackground(Color.clear)
                }
                Section { Picker("Account", selection: $mode) { ForEach(Mode.allCases, id: \.self) { Text($0.rawValue) } }.pickerStyle(.segmented) }
                Section(mode.rawValue) {
                    if mode == .signUp {
                        TextField("First name", text: $firstName).textContentType(.givenName)
                        TextField("Last name", text: $lastName).textContentType(.familyName)
                    }
                    TextField("Email", text: $email).textContentType(.emailAddress).textInputAutocapitalization(.never).keyboardType(.emailAddress)
                    SecureField("Password", text: $password).textContentType(mode == .signIn ? .password : .newPassword)
                    if mode == .signUp {
                        TextField("Major (optional)", text: $major)
                        TextField("Class of (optional)", text: $classOf)
                        Toggle("I confirm that I am at least 13 years old", isOn: $ageConfirmed)
                        Toggle("I accept the Privacy Policy and Terms", isOn: $legalAccepted)
                    }
                    Button { submit() } label: { HStack { Spacer(); if sessionStore.isWorking { ProgressView() } else { Text(mode.rawValue).fontWeight(.regular) }; Spacer() } }
                        .disabled(email.isEmpty || password.count < 6 || sessionStore.isWorking || (mode == .signUp && (firstName.trimmingCharacters(in: .whitespaces).isEmpty || lastName.trimmingCharacters(in: .whitespaces).isEmpty || !ageConfirmed || !legalAccepted)))
                    if mode == .signIn { Button("Forgot password?") { showReset = true } }
                }
                if let notice { Section { Text(notice).foregroundStyle(.secondary) } }
                if let error = sessionStore.errorMessage { Section { Text(error).foregroundStyle(.red) } }
                if let error = sessionStore.configurationError { Section { Text(error).foregroundStyle(.red) } }
                Section("Legal") {
                    NavigationLink("Privacy Policy") { NativeLegalView(title: "Privacy Policy") }
                    NavigationLink("Terms of Service") { NativeLegalView(title: "Terms of Service") }
                }
            }
            .cpListScreen()
            .navigationTitle("Welcome")
            .sheet(isPresented: $showReset) { PasswordResetSheet(sessionStore: sessionStore, email: email) }
        }
    }

    private func submit() {
        Task {
            if mode == .signIn { await sessionStore.signIn(email: email, password: password) }
            else {
                let now = ISO8601DateFormatter().string(from: Date())
                let cleanFirst = firstName.trimmingCharacters(in: .whitespacesAndNewlines)
                let cleanLast = lastName.trimmingCharacters(in: .whitespacesAndNewlines)
                let metadata: [String: Any] = [
                    "first_name": cleanFirst, "last_name": cleanLast, "full_name": "\(cleanFirst) \(cleanLast)",
                    "major": major.trimmingCharacters(in: .whitespacesAndNewlines), "class_of": classOf.trimmingCharacters(in: .whitespacesAndNewlines),
                    "profile_setup_prompted": true, "profile_setup_completed": true,
                    "age_13_or_older_confirmed": true, "age_confirmation_version": 1, "age_confirmed_at": now,
                    "terms_accepted_version": "2026-09-28", "privacy_accepted_version": "2026-09-28", "legal_accepted_at": now,
                ]
                if await sessionStore.signUp(email: email, password: password, metadata: metadata) {
                notice = "Check your email to verify your account, then sign in."
                mode = .signIn
                }
            }
        }
    }
}

private struct PasswordResetSheet: View {
    @Environment(\.dismiss) private var dismiss
    @ObservedObject var sessionStore: NativeSessionStore
    @State var email: String
    @State private var sent = false
    var body: some View {
        NavigationStack {
            Form {
                Section("Reset password") { TextField("Email", text: $email).textInputAutocapitalization(.never).keyboardType(.emailAddress) }
                if sent { Section { Text("Password reset email sent.").foregroundStyle(.green) } }
            }
            .cpListScreen()
            .navigationTitle("Forgot Password")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Close") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) { Button("Send") { Task { sent = await sessionStore.sendPasswordReset(email: email) } }.disabled(email.isEmpty) }
            }
        }
    }
}

private enum NativeTab: Hashable { case dashboard, focus, study, grades, more }

struct NativeMainTabView: View {
    @Environment(\.scenePhase) private var scenePhase
    @ObservedObject var sessionStore: NativeSessionStore
    @StateObject private var contentStore: NativeContentStore
    @StateObject private var featureStore: NativeFeatureStore
    @State private var selection: NativeTab = .dashboard

    init(sessionStore: NativeSessionStore) {
        self.sessionStore = sessionStore
        _contentStore = StateObject(wrappedValue: NativeContentStore(sessionStore: sessionStore))
        _featureStore = StateObject(wrappedValue: NativeFeatureStore(sessionStore: sessionStore))
    }

    var body: some View {
        nativeTabs
            .task { await refreshAccountData() }
            .onChange(of: scenePhase) { _, phase in
                if phase == .active {
                    Task { await refreshAccountData() }
                }
            }
            .onReceive(NotificationCenter.default.publisher(for: .nativeDeviceToken)) { note in
                guard let deviceToken = note.object as? String else {
                    if let error = note.object as? Error { featureStore.errorMessage = error.localizedDescription }
                    return
                }
                Task { await registerDeviceToken(deviceToken) }
            }
            .onReceive(NotificationCenter.default.publisher(for: .nativeNotificationPath)) { note in
                guard let path = note.object as? String else { return }
                if path.contains("focus") { selection = .focus }
                else if path.contains("assignment") || path.contains("get-it-done") { selection = .more }
                else if path.contains("grade") { selection = .grades }
                else if path.contains("study") { selection = .study }
                else if path.contains("notification") || path.contains("settings") || path.contains("schedule") || path.contains("announcement") { selection = .more }
                else { selection = .dashboard }
            }
            .alert("CanvasPro", isPresented: Binding(get: { contentStore.errorMessage != nil || featureStore.errorMessage != nil }, set: { if !$0 { contentStore.errorMessage = nil; featureStore.errorMessage = nil } })) {
                Button("OK", role: .cancel) {}
            } message: { Text(contentStore.errorMessage ?? featureStore.errorMessage ?? "") }
    }

    @MainActor private func registerDeviceToken(_ deviceToken: String) async {
        guard featureStore.notificationPreferences.enabled && featureStore.notificationPreferences.browserPush else { return }
        guard let api = sessionStore.api, let user = sessionStore.session?.user else { return }
        do {
            try await api.upsertPushToken(deviceToken, token: try await sessionStore.accessToken(), userID: user.id)
            UserDefaults.standard.set(deviceToken, forKey: "CanvasProNativePushToken")
        } catch { featureStore.errorMessage = error.localizedDescription }
    }

    @MainActor private func refreshAccountData() async {
        async let content: Void = contentStore.load()
        async let features: Void = featureStore.load()
        _ = await (content, features)
        let settings = await UNUserNotificationCenter.current().notificationSettings()
        if featureStore.notificationPreferences.enabled && featureStore.notificationPreferences.browserPush &&
            (settings.authorizationStatus == .authorized || settings.authorizationStatus == .provisional) {
            UIApplication.shared.registerForRemoteNotifications()
        } else if !featureStore.notificationPreferences.enabled || !featureStore.notificationPreferences.browserPush {
            UIApplication.shared.unregisterForRemoteNotifications()
            if let deviceToken = UserDefaults.standard.string(forKey: "CanvasProNativePushToken"), let api = sessionStore.api {
                do {
                    try await api.deletePushToken(deviceToken, token: try await sessionStore.accessToken())
                    UserDefaults.standard.removeObject(forKey: "CanvasProNativePushToken")
                } catch { featureStore.errorMessage = error.localizedDescription }
            }
        }
    }

    @ViewBuilder private var nativeTabs: some View {
        if #available(iOS 26.0, *) { tabs.tabBarMinimizeBehavior(.onScrollDown) } else { tabs }
    }

    private var tabs: some View {
        TabView(selection: $selection) {
            NativeDashboardView(store: contentStore, features: featureStore, selection: $selection).tabItem { Label("Dashboard", systemImage: "house.fill") }.tag(NativeTab.dashboard)
            NavigationStack { FocusView(store: contentStore, features: featureStore) }.tabItem { Label("Focus", systemImage: "scope") }.tag(NativeTab.focus)
            NativeStudyView(store: contentStore, features: featureStore).tabItem { Label("Study Session", systemImage: "timer") }.tag(NativeTab.study)
            NativeGradesView(store: contentStore, features: featureStore).tabItem { Label("Grades", systemImage: "chart.bar.fill") }.tag(NativeTab.grades)
            NativeMoreView(store: contentStore, features: featureStore, sessionStore: sessionStore).tabItem { Label("More", systemImage: "square.grid.2x2") }.tag(NativeTab.more)
        }
        .tabBarMinimizeBehavior(.onScrollDown)
        .sensoryFeedback(.selection, trigger: selection)
    }
}

private struct NativeDigestSnapshot: Codable {
    var lastVisit: Date
    var grades: [Int: Double]
    var urgency: [Int: String]
}

private struct NativeDashboardView: View {
    @Environment(\.colorScheme) private var scheme
    @ObservedObject var store: NativeContentStore
    @ObservedObject var features: NativeFeatureStore
    @Binding var selection: NativeTab
    @AppStorage("CanvasProDismissedAnnouncements") private var dismissedAnnouncementsRaw = ""
    @State private var digest: NativeDigestSnapshot?
    private var digestKey: String { "CanvasProNativeDigest.\(store.persistenceScope)" }
    @State private var syllabusCourse: CourseSummary?
    private var dismissedAnnouncements: Set<Int> { Set(dismissedAnnouncementsRaw.split(separator: ",").compactMap { Int($0) }) }
    private var visibleCourses: [CourseSummary] { store.bundle.courses.filter { !features.hiddenCourseIDs.contains($0.id) } }
    private var allAssignments: [AssignmentItem] {
        (store.bundle.assignments + features.customAssignments.map { item in .custom(item, course: store.bundle.courses.first { $0.id == item.courseID }) }).filter { !features.hiddenCourseIDs.contains($0.courseID) }
    }
    private var activeAssignments: [AssignmentItem] { allAssignments.filter { $0.isVisible(in: store) } }
    private var weekItems: [AssignmentItem] { activeAssignments.filter { item in guard let due = item.dueDate else { return false }; return due >= Date() && due <= NativeParity.endOfUpcomingDay(7) } }
    private var todayCount: Int { weekItems.filter { ($0.dueDate ?? .distantFuture) <= Date().addingTimeInterval(86400) && ($0.dueDate ?? .distantFuture) >= Date() }.count }
    private var overdueCount: Int { activeAssignments.filter { ($0.dueDate ?? .distantFuture) < Date() }.count }
    private var greeting: String { let hour = Calendar.current.component(.hour, from: Date()); return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening" }
    private var studentName: String { let value = features.profile.username?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""; return value.isEmpty ? "there" : value }
    private var gradeMap: [Int: Double] { Dictionary(uniqueKeysWithValues: allAssignments.compactMap { item in item.submission?.score.map { (item.id, $0) } }) }
    private var urgencyMap: [Int: String] { Dictionary(uniqueKeysWithValues: activeAssignments.compactMap { item in urgency(for: item).map { (item.id, $0) } }) }
    private var newAnnouncements: [AnnouncementItem] { guard let digest else { return [] }; return Array(store.bundle.announcements.filter { item in item.isWithin(weeks: features.announcementWeeks) && (ISO8601DateFormatter.canvasDate(from: item.postedAt) ?? .distantPast) > digest.lastVisit }.prefix(8)) }
    private var newGrades: [AssignmentItem] { guard let digest else { return [] }; return Array(allAssignments.filter { item in guard let score = item.submission?.score else { return false }; return digest.grades[item.id] != score }.prefix(8)) }
    private var newlyUrgent: [AssignmentItem] { guard let digest else { return [] }; return Array(activeAssignments.filter { item in guard let value = urgency(for: item) else { return false }; return (value == "today" || value == "soon") && digest.urgency[item.id] != value }.prefix(8)) }
    private var calendarPreview: [NativeCalendarEntry] {
        let pickedIDs = Set(features.calendarPicks.map(\.assignmentID))
        var values = activeAssignments.compactMap { item -> NativeCalendarEntry? in
            guard !pickedIDs.contains(item.id), let due = item.dueDate, due >= Date() else { return nil }
            return NativeCalendarEntry(id: "assignment-\(item.id)", date: due, title: item.name, context: item.courseName, kind: "Assignment due", url: URL(string: item.htmlURL), pickID: nil)
        }
        values += store.bundle.calendar.compactMap { event -> NativeCalendarEntry? in
            guard let raw = event.startAt, let date = ISO8601DateFormatter.canvasDate(from: raw), date >= Date() else { return nil }
            return NativeCalendarEntry(id: "event-\(event.id)", date: date, title: event.title, context: event.contextName ?? "Canvas event", kind: "Canvas event", url: event.htmlURL.flatMap { URL(string: $0) }, pickID: nil)
        }
        values += features.calendarPicks.compactMap { pick -> NativeCalendarEntry? in
            if let assignment = allAssignments.first(where: { $0.id == pick.assignmentID }), !assignment.isVisible(in: store) { return nil }
            guard let date = ISO8601DateFormatter.canvasDate(from: pick.at), date >= Date().addingTimeInterval(-12 * 3600) else { return nil }
            return NativeCalendarEntry(id: "pick-\(pick.id)", date: date, title: pick.title, context: pick.context, kind: "Planned work", url: nil, pickID: pick.id)
        }
        return Array(values.sorted { $0.date < $1.date }.prefix(3))
    }
    private var widgetIDs: [String] { features.dashboardOrder.filter { !features.dashboardHidden.contains($0) } }

    var body: some View {
        NavigationStack {
            ZStack {
                CPBackdrop()
                ScrollView {
                    LazyVStack(spacing: 12) {
                        if store.isLoading && store.bundle.courses.isEmpty {
                            CPSkeletonCard()
                            CPSkeletonCard()
                            CPSkeletonCard()
                        } else {
                            dashboardHero
                            NativeSyncStatusCard(store: store) {
                                Task { await store.load() }
                            }
                            HStack {
                                Spacer()
                                NavigationLink { DashboardCustomizationView(features: features) } label: { Label("Customize dashboard", systemImage: "slider.horizontal.3").labelStyle(.iconOnly).foregroundStyle(CPTheme.muted(scheme)).frame(width: 40, height: 40).background(CPTheme.inset(scheme), in: RoundedRectangle(cornerRadius: 12)).overlay(RoundedRectangle(cornerRadius: 12).stroke(CPTheme.insetBorder(scheme))) }.buttonStyle(CPPressStyle())
                            }.padding(.horizontal, 3)

                            ForEach(widgetIDs, id: \.self) { id in dashboardWidget(id) }
                        }
                    }.padding(.horizontal, 14).padding(.top, 6).padding(.bottom, 24)
                }
            }
            .navigationTitle("Dashboard").navigationBarTitleDisplayMode(.inline)
            .refreshable { async let a: Void = store.load(); async let b: Void = features.load(); _ = await (a, b) }
            .onAppear { loadDigest() }
            .sheet(item: $syllabusCourse) { course in NavigationStack { ScrollView { Text(course.syllabusBody?.strippingHTML ?? "No syllabus available.").font(.system(size: 13)).textSelection(.enabled).frame(maxWidth: .infinity, alignment: .leading).padding() }.navigationTitle("\(course.name) Syllabus").toolbar { Button("Done") { syllabusCourse = nil } } } }
        }
    }

    private var dashboardHero: some View {
        VStack(alignment: .leading, spacing: 14) {
            VStack(alignment: .leading, spacing: 4) {
                Label(Date().formatted(.dateTime.weekday(.wide).month(.wide).day()), systemImage: "calendar")
                    .font(.system(size: 11, weight: .semibold))
                    .tracking(1.2)
                    .textCase(.uppercase)
                    .foregroundStyle(CPTheme.muted(scheme))
                Text("\(greeting), \(studentName).")
                    .font(.system(size: 26, weight: .semibold))
                    .tracking(-0.6)
                    .foregroundStyle(CPTheme.foreground(scheme))
            }
            HStack(spacing: 8) {
                heroStat(value: weekItems.count, label: "7 days", symbol: "calendar")
                heroStat(value: todayCount, label: "24 hours", symbol: "clock")
                heroStat(value: overdueCount, label: "Overdue", symbol: "exclamationmark.triangle.fill", danger: overdueCount > 0)
            }
        }
        .padding(16)
        .background(heroBackground, in: RoundedRectangle(cornerRadius: 24, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 24, style: .continuous)
                .stroke(
                    LinearGradient(
                        colors: [
                            Color.white.opacity(scheme == .dark ? 0.14 : 0.5),
                            Color.white.opacity(scheme == .dark ? 0.04 : 0.1)
                        ],
                        startPoint: .top,
                        endPoint: .bottom
                    ),
                    lineWidth: 1
                )
        )
        .shadow(color: Color.black.opacity(scheme == .dark ? 0.35 : 0.08), radius: 24, y: 10)
    }

    private var metricColumns: [GridItem] { [GridItem(.flexible(minimum: 0), spacing: 8), GridItem(.flexible(minimum: 0), spacing: 8)] }
    @ViewBuilder private func dashboardWidget(_ id: String) -> some View {
        switch id {
        case "digest": digestCard
        case "classes": classesWidget
        case "upcoming": upcomingWidget
        case "focus": focusWidget
        case "calendar":
            CPGlassCard(title: "Calendar", subtitle: "Upcoming deadlines & events") {
                VStack(spacing: 8) {
                    ForEach(calendarPreview) { item in
                        HStack(spacing: 12) {
                            VStack(spacing: 1) {
                                Text(item.date, format: .dateTime.month(.abbreviated).day())
                                    .font(.system(size: 11, weight: .semibold))
                                    .foregroundStyle(CPTheme.foreground(scheme))
                                Text(item.date, format: .dateTime.weekday(.abbreviated))
                                    .font(.system(size: 9))
                                    .foregroundStyle(CPTheme.muted(scheme))
                            }
                            .frame(width: 48, height: 42)
                            .background(Color.white.opacity(scheme == .dark ? 0.05 : 0.04), in: RoundedRectangle(cornerRadius: 10, style: .continuous))

                            VStack(alignment: .leading, spacing: 2) {
                                Text(item.title)
                                    .font(.system(size: 13, weight: .medium))
                                    .foregroundStyle(CPTheme.foreground(scheme))
                                    .lineLimit(1)
                                Text("\(item.kind) · \(item.context)")
                                    .font(.system(size: 11))
                                    .foregroundStyle(CPTheme.muted(scheme))
                                    .lineLimit(1)
                            }
                            Spacer()
                            Text(item.date, format: .dateTime.hour().minute())
                                .font(.system(size: 11, weight: .medium))
                                .monospacedDigit()
                                .foregroundStyle(CPTheme.muted(scheme))
                        }
                        .padding(.horizontal, 10)
                        .padding(.vertical, 8)
                        .background(CPTheme.inset(scheme), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                        .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).stroke(CPTheme.insetBorder(scheme), lineWidth: 1))
                    }
                }
                NavigationLink {
                    CalendarView(store: store, features: features)
                } label: {
                    HStack(spacing: 4) {
                        Text("Open full calendar")
                        Image(systemName: "arrow.up.right")
                    }
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(CPTheme.primary(scheme: scheme))
                }
                .padding(.top, 4)
            }
        case "announcements": CPGlassCard(title: "Announcements") { ForEach(store.bundle.announcements.filter { !features.hiddenCourseIDs.contains($0.courseID) && $0.isWithin(weeks: features.announcementWeeks) && !dismissedAnnouncements.contains($0.id) }.prefix(3)) { item in NavigationLink { AnnouncementDetailView(item: item) } label: { CPInsetRow { VStack(alignment: .leading, spacing: 3) { Text(item.title).font(.system(size: 13, weight: .regular)); Text(item.courseName).font(.system(size: 10, weight: .regular)).foregroundStyle(CPTheme.muted(scheme)); Text(item.message.strippingHTML).font(.system(size: 11, weight: .regular)).foregroundStyle(CPTheme.muted(scheme)).lineLimit(2) } } }.buttonStyle(.plain) } }
        case "heatmap": CPGlassCard(title: "Workload") { WorkloadView(assignments: activeAssignments) }
        default: EmptyView()
        }
    }
    private var classesWidget: some View {
        CPGlassCard {
            widgetHeader("Classes & Grades", subtitle: "Active enrollments") {
                selection = .grades
            }
            VStack(spacing: 8) {
                ForEach(visibleCourses) { course in
                    dashboardCourseRow(course)
                }
            }
            if visibleCourses.isEmpty { NativeEmptyState(title: "No classes yet", symbol: "books.vertical") }
        }
    }

    private var focusWidget: some View {
        CPGlassCard {
            HStack(spacing: 10) {
                Image(systemName: "scope").font(.system(size: 18)).foregroundStyle(CPTheme.primary(scheme: scheme))
                    .frame(width: 38, height: 38).background(CPTheme.primary(scheme: scheme).opacity(0.12), in: RoundedRectangle(cornerRadius: 12))
                VStack(alignment: .leading, spacing: 2) {
                    Text("Focus").font(.system(size: 16))
                    Text(weekItems.isEmpty ? "All caught up" : "\(weekItems.count) assignment\(weekItems.count == 1 ? "" : "s") this week")
                        .font(.system(size: 11)).foregroundStyle(CPTheme.muted(scheme))
                }
                Spacer(minLength: 8)
                Button { selection = .focus } label: {
                    Image(systemName: "arrow.up.right").font(.system(size: 12))
                        .frame(width: 32, height: 32).background(CPTheme.inset(scheme), in: Circle())
                }.accessibilityLabel("Open Focus")
            }
            ForEach(weekItems.sorted(by: AssignmentItem.dueSort).prefix(2)) { assignment in
                CPInsetRow { NativeAssignmentRow(assignment: assignment, store: store) }
            }
        }
    }

    private var upcomingWidget: some View {
        CPGlassCard {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 3) {
                    Text("Upcoming Assignments").font(.system(size: 16, weight: .regular))
                    Text("Due within the next 7 days").font(.system(size: 11)).foregroundStyle(CPTheme.muted(scheme))
                }
                Spacer(minLength: 8)
                NavigationLink { NativeAssignmentsView(store: store, features: features) } label: {
                    Text("View all").font(.system(size: 11)).foregroundStyle(CPTheme.muted(scheme))
                }.buttonStyle(CPPressStyle())
            }.padding(.bottom, 5)
            ForEach(visibleCourses) { course in
                if course.id != visibleCourses.first?.id { Divider().overlay(CPTheme.border(scheme)) }
                NavigationLink {
                    CourseDetailView(course: course, store: store, features: features, initialSection: .upcoming)
                } label: {
                    HStack(spacing: 11) {
                        Image(systemName: "chevron.right").font(.system(size: 10)).foregroundStyle(CPTheme.muted(scheme))
                        Circle().fill(courseColor(course)).frame(width: 8, height: 8)
                        Text(store.displayName(courseID: course.id, fallback: course.name))
                            .font(.system(size: 12)).foregroundStyle(CPTheme.foreground(scheme)).lineLimit(2)
                        Spacer(minLength: 8)
                        Text("\(weekItems.filter { $0.courseID == course.id }.count)")
                            .font(.system(size: 12)).monospacedDigit().foregroundStyle(CPTheme.muted(scheme))
                    }.frame(minHeight: 42).contentShape(Rectangle())
                }.buttonStyle(CPPressStyle())
            }
            if visibleCourses.isEmpty { NativeEmptyState(title: "No classes yet", symbol: "books.vertical") }
        }
    }

    private func widgetHeader(_ title: String, subtitle: String, action: @escaping () -> Void) -> some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: 3) {
                Text(title).font(.system(size: 16, weight: .regular))
                Text(subtitle).font(.system(size: 11)).foregroundStyle(CPTheme.muted(scheme))
            }
            Spacer(minLength: 8)
            Button("View all", action: action).font(.system(size: 11)).foregroundStyle(CPTheme.muted(scheme))
        }.padding(.bottom, 5)
    }

    private func dashboardCourseRow(_ course: CourseSummary) -> some View {
        NavigationLink {
            CourseDetailView(course: course, store: store, features: features, initialSection: .graded)
        } label: {
            HStack(spacing: 12) {
                RoundedRectangle(cornerRadius: 3, style: .continuous)
                    .fill(courseColor(course))
                    .frame(width: 4, height: 28)

                VStack(alignment: .leading, spacing: 2) {
                    Text(store.displayName(courseID: course.id, fallback: course.name))
                        .font(.system(size: 14, weight: .medium))
                        .foregroundStyle(CPTheme.foreground(scheme))
                        .lineLimit(1)

                    if !course.courseCode.isEmpty {
                        Text(course.courseCode)
                            .font(.system(size: 11))
                            .foregroundStyle(CPTheme.muted(scheme))
                    }
                }

                Spacer(minLength: 8)

                if course.syllabusBody != nil {
                    Button {
                        syllabusCourse = course
                    } label: {
                        HStack(spacing: 3) {
                            Image(systemName: "doc.text")
                                .font(.system(size: 11))
                            Text("Syllabus")
                                .font(.system(size: 11, weight: .regular))
                        }
                        .foregroundStyle(CPTheme.muted(scheme))
                        .padding(.horizontal, 8)
                        .frame(height: 26)
                        .background(Color.white.opacity(scheme == .dark ? 0.06 : 0.05), in: Capsule())
                        .overlay(Capsule().stroke(Color.white.opacity(scheme == .dark ? 0.08 : 0.1), lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("View syllabus for \(course.name)")
                }

                Text(course.currentScore.map { "\($0.formatted(.number.precision(.fractionLength(1))))%" } ?? "—")
                    .font(.system(size: 13, weight: .semibold))
                    .monospacedDigit()
                    .foregroundStyle(courseColor(course))
                    .padding(.horizontal, 7)
                    .padding(.vertical, 3)
                    .background(courseColor(course).opacity(0.12), in: RoundedRectangle(cornerRadius: 7, style: .continuous))

                Image(systemName: "chevron.right")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(CPTheme.muted(scheme).opacity(0.4))
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
            .background(CPTheme.inset(scheme), in: RoundedRectangle(cornerRadius: 15, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 15, style: .continuous).stroke(CPTheme.insetBorder(scheme), lineWidth: 1))
        }
        .buttonStyle(CPPressStyle())
    }

    private func courseColor(_ course: CourseSummary) -> Color {
        guard let score = course.currentScore else { return CPTheme.muted(scheme) }
        return score >= 80 ? CPTheme.primary(scheme: scheme) : score >= 70 ? CPTheme.warning : CPTheme.danger
    }

    private var digestCard: some View {
        Group {
            if newAnnouncements.isEmpty && newGrades.isEmpty && newlyUrgent.isEmpty {
                HStack(spacing: 12) {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 20))
                        .foregroundStyle(CPTheme.primary(scheme: scheme))
                    VStack(alignment: .leading, spacing: 2) {
                        Text("All caught up")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(CPTheme.foreground(scheme))
                        Text("No new announcements, grades, or urgent deadlines.")
                            .font(.system(size: 11))
                            .foregroundStyle(CPTheme.muted(scheme))
                    }
                    Spacer()
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 12)
                .background(CPTheme.glass(scheme), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).stroke(CPTheme.border(scheme), lineWidth: 1))
            } else {
                CPGlassCard(title: "Since your last visit", subtitle: "\(newAnnouncements.count + newGrades.count + newlyUrgent.count) updates", strong: true) {
                    Button("Mark all seen") { markDigestSeen() }.font(.system(size: 11, weight: .regular))
                    digestSection("New announcements", items: newAnnouncements.map { $0.title })
                    digestSection("New grades", items: newGrades.map { "\($0.name) · \($0.submission?.score?.formatted() ?? "—")" })
                    digestSection("Newly urgent", items: newlyUrgent.map { "\($0.name) · \(urgency(for: $0) == "today" ? "Due today" : "Due soon")" })
                }
            }
        }
    }
    private func digestSection(_ title: String, items: [String]) -> some View { VStack(alignment: .leading, spacing: 5) { Text("\(title) · \(items.count)").font(.system(size: 11)).foregroundStyle(CPTheme.muted(scheme)); if items.isEmpty { Text("Nothing new").font(.system(size: 11)).foregroundStyle(CPTheme.muted(scheme)) }; ForEach(items, id: \.self) { item in Text(item).font(.system(size: 11)).lineLimit(2) } }.frame(maxWidth: .infinity, alignment: .leading) }
    private func urgency(for item: AssignmentItem) -> String? { guard let due = item.dueDate else { return nil }; let hours = due.timeIntervalSinceNow / 3600; if hours < 0 { return "overdue" }; if hours <= 24 { return "today" }; if hours <= 72 { return "soon" }; return "later" }
    private func loadDigest() {
        if let data = UserDefaults.standard.data(forKey: digestKey), let saved = try? JSONDecoder().decode(NativeDigestSnapshot.self, from: data) { digest = saved }
        else if !store.bundle.courses.isEmpty { markDigestSeen() }
    }
    private func markDigestSeen() { let snapshot = NativeDigestSnapshot(lastVisit: Date(), grades: gradeMap, urgency: urgencyMap); digest = snapshot; if let data = try? JSONEncoder().encode(snapshot) { UserDefaults.standard.set(data, forKey: digestKey) } }

    private var heroBackground: LinearGradient {
        let palette = CPTheme.currentPalette
        return LinearGradient(
            colors: scheme == .dark
                ? [.hsl(palette.hue, 0.08, 0.16), .hsl(palette.hue, 0.08, 0.10)]
                : [.hsl(palette.hue, 0.04, 0.98), .hsl(palette.hue, 0.08, 0.92)],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    }

    private func heroStat(value: Int, label: String, symbol: String, danger: Bool = false) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: symbol)
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(danger ? CPTheme.danger : CPTheme.muted(scheme))
                Spacer()
                Text("\(value)")
                    .font(.system(size: 20, weight: .semibold))
                    .tracking(-0.5)
                    .monospacedDigit()
                    .foregroundStyle(danger ? CPTheme.danger : CPTheme.foreground(scheme))
            }
            Text(label)
                .font(.system(size: 11, weight: .regular))
                .foregroundStyle(danger ? CPTheme.danger.opacity(0.85) : CPTheme.muted(scheme))
                .lineLimit(1)
                .minimumScaleFactor(0.75)
        }
        .padding(10)
        .frame(maxWidth: .infinity, minHeight: 64)
        .background(
            danger
                ? CPTheme.danger.opacity(scheme == .dark ? 0.14 : 0.10)
                : Color.white.opacity(scheme == .dark ? 0.05 : 0.04),
            in: RoundedRectangle(cornerRadius: 16, style: .continuous)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(
                    danger
                        ? CPTheme.danger.opacity(0.35)
                        : Color.white.opacity(scheme == .dark ? 0.07 : 0.12),
                    lineWidth: 1
                )
        )
    }
}

private struct MetricTile: View {
    @Environment(\.colorScheme) private var scheme
    let value: String; let label: String
    var body: some View { VStack(spacing: 3) { Text(value).font(.system(size: 19, weight: .regular)).monospacedDigit(); Text(label).font(.system(size: 10, weight: .regular)).foregroundStyle(CPTheme.muted(scheme)) }.padding(.vertical, 10).frame(maxWidth: .infinity).background(CPTheme.foreground(scheme).opacity(0.045), in: RoundedRectangle(cornerRadius: 13)).overlay(RoundedRectangle(cornerRadius: 13).stroke(CPTheme.border(scheme), lineWidth: 1)) }
}

struct NativeSyncStatusCard: View {
    @Environment(\.colorScheme) private var scheme
    @ObservedObject var store: NativeContentStore
    let retry: () -> Void

    private var shouldShow: Bool {
        !store.isPreview && (store.isLoading || store.isShowingCachedData || store.syncMessage != nil || store.lastSyncedAt != nil)
    }

    var body: some View {
        if shouldShow {
            CPGlassCard {
                HStack(spacing: 10) {
                    ZStack {
                        Circle().fill(statusColor.opacity(0.14)).frame(width: 32, height: 32)
                        if store.isLoading { ProgressView().controlSize(.small) }
                        else { Image(systemName: statusSymbol).font(.system(size: 13)).foregroundStyle(statusColor) }
                    }
                    VStack(alignment: .leading, spacing: 2) {
                        Text(statusTitle).font(.system(size: 12, weight: .regular))
                        Text(statusDetail).font(.system(size: 10, weight: .regular)).foregroundStyle(CPTheme.muted(scheme)).lineLimit(2)
                    }
                    Spacer(minLength: 8)
                    if store.isShowingCachedData && !store.isLoading {
                        Button(action: retry) {
                            Image(systemName: "arrow.clockwise").font(.system(size: 12))
                                .frame(width: 30, height: 30)
                                .background(CPTheme.inset(scheme), in: Circle())
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Refresh Canvas")
                    }
                }
            }
        }
    }

    private var statusColor: Color {
        if store.isLoading { return CPTheme.primary(scheme: scheme) }
        if store.isShowingCachedData { return CPTheme.warning }
        if store.syncMessage != nil { return CPTheme.warning }
        return CPTheme.primary(scheme: scheme)
    }

    private var statusSymbol: String {
        if store.isShowingCachedData { return "wifi.slash" }
        if store.syncMessage != nil { return "exclamationmark.triangle" }
        return "checkmark"
    }

    private var statusTitle: String {
        if store.isLoading { return "Refreshing Canvas" }
        if store.isShowingCachedData { return "Saved data" }
        if store.syncMessage != nil { return "Needs refresh" }
        return "Live data"
    }

    private var statusDetail: String {
        if let message = store.syncMessage { return message }
        if let date = store.lastSyncedAt { return "Updated \(date.formatted(.dateTime.month(.abbreviated).day().hour().minute()))" }
        return "Coursework will appear after the first sync."
    }
}

private struct DashboardCustomizationView: View {
    @ObservedObject var features: NativeFeatureStore
    @State private var status: String?
    private var order: [String] { features.dashboardOrder }

    var body: some View {
        Form {
            Section("Dashboard widgets") {
                ForEach(order, id: \.self) { id in Toggle(title(for: id), isOn: Binding(get: { !features.dashboardHidden.contains(id) }, set: { setVisible(id, $0) })) }
            }
            Section("Order") { ForEach(order.indices, id: \.self) { index in HStack { Text(title(for: order[index])); Spacer(); Button { move(index, -1) } label: { Image(systemName: "arrow.up") }.disabled(index == 0); Button { move(index, 1) } label: { Image(systemName: "arrow.down") }.disabled(index == order.count - 1) } } }
            Section { Button("Reset dashboard") { Task { await save(order: ["digest", "focus", "classes", "upcoming", "calendar", "announcements", "heatmap"], hidden: []) } } }
            if let status { Section { Text(status).foregroundStyle(.secondary) } }
        }.cpListScreen().navigationTitle("Customize Dashboard")
    }

    private func title(for id: String) -> String { ["digest": "Since your last visit", "classes": "Classes & Grades", "upcoming": "Upcoming Assignments", "focus": "Focus", "calendar": "Calendar", "announcements": "Announcements", "heatmap": "Workload"][id] ?? id }
    private func setVisible(_ id: String, _ visible: Bool) { var hidden = features.dashboardHidden; if visible { hidden.remove(id) } else { hidden.insert(id) }; Task { await save(hidden: hidden) } }
    private func move(_ index: Int, _ direction: Int) { var values = order; guard values.indices.contains(index + direction) else { return }; values.swapAt(index, index + direction); Task { await save(order: values) } }
    private func save(order: [String]? = nil, hidden: Set<String>? = nil) async { do { try await features.updateDashboard(order: order, hidden: hidden); status = nil } catch { status = error.localizedDescription } }
}

struct NativeAssignmentsView: View {
    @Environment(\.colorScheme) private var scheme
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @ObservedObject var store: NativeContentStore
    @ObservedObject var features: NativeFeatureStore
    @State private var search = ""
    @State private var showCompleted = false
    @State private var courseID: Int?
    @State private var showAdd = false

    private var visibleCourses: [CourseSummary] { store.bundle.courses.filter { !features.hiddenCourseIDs.contains($0.id) } }
    private var allAssignments: [AssignmentItem] { (store.bundle.assignments + features.customAssignments.map { item in AssignmentItem.custom(item, course: store.bundle.courses.first { $0.id == item.courseID }) }).filter { !features.hiddenCourseIDs.contains($0.courseID) } }
    private var remaining: [AssignmentItem] { allAssignments.filter { $0.isVisible(in: store) } }
    private var overdueCount: Int { assignments.filter { ($0.dueDate ?? .distantFuture) < Date() }.count }
    private var weekCount: Int { assignments.filter { guard let due = $0.dueDate else { return false }; return due >= Date() && due <= Date().addingTimeInterval(7 * 86400) }.count }
    private var priorityGroups: [(courseID: Int, items: [AssignmentItem])] {
        let now = Date()
        return Dictionary(grouping: remaining) { $0.courseID }.map { entry in
            let courseID = entry.key
            let items = entry.value
            let total = items.reduce(0) { $0 + ($1.pointsPossible ?? 0) }
            let ranked = items.sorted {
                NativeParity.priority($0, courseTotalPoints: total, estimate: features.estimates[$0.id], now: now) >
                NativeParity.priority($1, courseTotalPoints: total, estimate: features.estimates[$1.id], now: now)
            }
            return (courseID: courseID, items: ranked)
        }.sorted { left, right in
            let leftTop = left.items.first.map { NativeParity.priority($0, courseTotalPoints: left.items.reduce(0) { $0 + ($1.pointsPossible ?? 0) }, estimate: features.estimates[$0.id], now: now) } ?? 0
            let rightTop = right.items.first.map { NativeParity.priority($0, courseTotalPoints: right.items.reduce(0) { $0 + ($1.pointsPossible ?? 0) }, estimate: features.estimates[$0.id], now: now) } ?? 0
            return leftTop == rightTop ? left.courseID < right.courseID : leftTop > rightTop
        }
    }
    private var priorityAssignments: [AssignmentItem] { Array(priorityGroups.flatMap { $0.items.prefix(2) }.prefix(5)) }

    private var assignments: [AssignmentItem] {
        return allAssignments.filter { item in
            let matches = search.isEmpty || item.name.localizedCaseInsensitiveContains(search) || store.displayName(courseID: item.courseID, fallback: item.courseName).localizedCaseInsensitiveContains(search)
            let courseMatches = courseID == nil || item.courseID == courseID
            return matches && courseMatches && item.isVisible(in: store, showCompleted: showCompleted)
        }.sorted(by: AssignmentItem.dueSort)
    }
    private var agendaSections: [(String, String, [AssignmentItem])] {
        let now = Date(), week = Date().addingTimeInterval(7 * 86400)
        return [
            ("Overdue", "Needs attention first", assignments.filter { $0.dueDate.map { $0 < now } ?? false }),
            ("Next 7 days", "Your immediate runway", assignments.filter { $0.dueDate.map { $0 >= now && $0 <= week } ?? false }),
            ("Later", "Beyond this week", assignments.filter { $0.dueDate.map { $0 > week } ?? false }),
            ("No due date", "Keep these on your radar", assignments.filter { $0.dueDate == nil }),
        ].filter { !$0.2.isEmpty }
    }

    var body: some View {
        ZStack {
                CPBackdrop()
                ScrollView {
                    LazyVStack(spacing: 14) {
                        if store.isLoading && store.bundle.assignments.isEmpty {
                            CPSkeletonCard()
                            CPSkeletonCard()
                        } else {
                        assignmentsHero
                        CPGlassCard(title: "Priority") {
                            HStack(alignment: .top, spacing: 10) { Image(systemName: "sparkles").font(.system(size: 13)).foregroundStyle(CPTheme.foreground(scheme).opacity(0.8)).frame(width: 28, height: 28).background(CPTheme.foreground(scheme).opacity(0.10), in: RoundedRectangle(cornerRadius: 8)); Text(prioritySummary).font(.system(size: 12, weight: .regular)).foregroundStyle(CPTheme.foreground(scheme).opacity(0.90)).lineSpacing(2) }
                            VStack(spacing: 8) { ForEach(priorityAssignments) { item in CPInsetRow { VStack(alignment: .leading, spacing: 4) { NativeAssignmentRow(assignment: item, store: store); Text(priorityUrgency(item).uppercased()).font(.system(size: 9, weight: .regular)).tracking(0.7).foregroundStyle(priorityUrgency(item) == "critical" ? CPTheme.danger : priorityUrgency(item) == "high" ? CPTheme.warning : CPTheme.muted(scheme)) } } } }
                        }
                        HStack { Toggle("Show completed", isOn: $showCompleted).font(.system(size: 11)); Spacer(); Text("\(assignments.count) shown").font(.system(size: 10)).foregroundStyle(CPTheme.muted(scheme)) }
                        CPGlassCard(strong: true) {
                            Picker("Class", selection: $courseID) { Text("All classes").tag(Int?.none); ForEach(visibleCourses) { Text(store.displayName(courseID: $0.id, fallback: $0.name)).tag(Optional($0.id)) } }.pickerStyle(.menu).tint(CPTheme.foreground(scheme))
                        }
                        if assignments.isEmpty && !store.isLoading { CPGlassCard { NativeEmptyState(title: search.isEmpty ? "No assignments" : "No matches", symbol: "magnifyingglass") } }
                        ForEach(agendaSections.indices, id: \.self) { sectionIndex in
                            let section = agendaSections[sectionIndex]
                            CPGlassCard(title: "\(section.0) · \(section.2.count)") {
                                ForEach(section.2) { item in CPInsetRow { VStack(alignment: .leading, spacing: 7) {
                                    NativeAssignmentRow(assignment: item, store: store)
                                    HStack(spacing: 12) {
                                        NavigationLink { AssignmentDetailView(assignment: item, store: store, features: features) } label: { Label("Description", systemImage: "doc.text") }
                                        if item.dueDate != nil { Button { addToCalendar(item) } label: { Label("Plan", systemImage: "calendar.badge.plus") } }
                                        Spacer(minLength: 0)
                                        if let url = URL(string: item.htmlURL), url.scheme == "https" { Link("Canvas", destination: url) }
                                    }.font(.system(size: 10, weight: .regular))
                                } } }
                            }
                        }
                        }
                    }.padding(.horizontal, 15).padding(.vertical, 10).padding(.bottom, 24)
                    .animation(reduceMotion ? nil : .easeInOut(duration: 0.2), value: assignments.map(\.id))
                }
        }
        .navigationTitle("Assignments").navigationBarTitleDisplayMode(.inline).searchable(text: $search, prompt: "Assignment or class")
        .toolbar { Button { showAdd = true } label: { Image(systemName: "plus") } }
        .sheet(isPresented: $showAdd) { AddAssignmentView(courses: visibleCourses, features: features) }
        .refreshable { async let a: Void = store.load(); async let b: Void = features.load(); _ = await (a, b) }
    }

    private var assignmentsHero: some View {
        CPGlassCard(strong: true) {
            HStack(spacing: 8) {
                workloadMetric(assignments.count, "Remaining")
                workloadMetric(overdueCount, "Overdue", color: CPTheme.danger)
                workloadMetric(weekCount, "This week", color: CPTheme.primary(scheme: scheme))
            }
        }
    }

    private func workloadMetric(_ value: Int, _ label: String, color: Color? = nil) -> some View { VStack(alignment: .leading, spacing: 3) { Text("\(value)").font(.system(size: 21, weight: .regular)).tracking(-0.6).monospacedDigit().foregroundStyle(color ?? CPTheme.foreground(scheme)); Text(label).font(.system(size: 10, weight: .regular)).foregroundStyle(CPTheme.muted(scheme)) }.padding(10).frame(maxWidth: .infinity, alignment: .leading).background((color ?? CPTheme.foreground(scheme)).opacity(0.06), in: RoundedRectangle(cornerRadius: 14)).overlay(RoundedRectangle(cornerRadius: 14).stroke((color ?? CPTheme.foreground(scheme)).opacity(0.10))) }
    private var prioritySummary: String {
        let parts = priorityGroups.prefix(3).compactMap { group -> String? in
            let names = group.items.prefix(2).map(\.name).joined(separator: " and ")
            guard !names.isEmpty, let first = group.items.first else { return nil }
            return "\(names) from \(store.displayName(courseID: group.courseID, fallback: first.courseName))"
        }
        guard let first = parts.first else { return "No unfinished assignments right now." }
        return "Right now, finish \(first)\(parts.count > 1 ? ", then \(parts.dropFirst().joined(separator: "; then "))" : "")."
    }
    private func priorityUrgency(_ item: AssignmentItem) -> String {
        guard let due = item.dueDate else { return "low" }
        let hours = due.timeIntervalSinceNow / 3600
        if hours <= 24 { return "critical" }
        if hours <= 72 { return "high" }
        if hours <= 168 { return "medium" }
        return "low"
    }
    private func addToCalendar(_ item: AssignmentItem) { guard let due = item.dueDate else { return }; let pick = CalendarPick(assignmentID: item.id, title: item.name, context: item.courseName, at: ISO8601DateFormatter().string(from: due), dueAt: item.dueAt); Task { try? await features.savePreference("calendar-picks", features.calendarPicks.filter { $0.assignmentID != item.id } + [pick]) } }
}

struct NativeAssignmentRow: View {
    @Environment(\.colorScheme) private var scheme
    let assignment: AssignmentItem
    @ObservedObject var store: NativeContentStore
    private var isComplete: Bool { assignment.isFinished(in: store) }
    private var countdown: NativeParity.Countdown? { NativeParity.countdown(assignment, completed: isComplete) }
    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Button { UIImpactFeedbackGenerator(style: .light).impactOccurred(); Task { await store.toggle(assignment) } } label: {
                Image(systemName: isComplete ? "checkmark.circle.fill" : "circle")
                    .font(.system(size: 20))
                    .foregroundStyle(isComplete ? CPTheme.primary(scheme: scheme) : CPTheme.muted(scheme).opacity(0.6))
            }
            .buttonStyle(.plain)
            .disabled(assignment.isCanvasFinished)

            VStack(alignment: .leading, spacing: 4) {
                Text(assignment.name)
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(isComplete ? CPTheme.muted(scheme) : CPTheme.foreground(scheme))
                    .strikethrough(isComplete)
                    .fixedSize(horizontal: false, vertical: true)

                Text(store.displayName(courseID: assignment.courseID, fallback: assignment.courseName))
                    .font(.system(size: 12, weight: .regular))
                    .foregroundStyle(CPTheme.muted(scheme))
                    .fixedSize(horizontal: false, vertical: true)

                if let countdown {
                    HStack(spacing: 4) {
                        Image(systemName: "clock")
                            .font(.system(size: 10))
                        Text(countdown.label)
                            .font(.system(size: 11, weight: .medium))
                        if !countdown.fullDate.isEmpty {
                            Text("· \(countdown.fullDate)")
                                .font(.system(size: 10))
                                .foregroundStyle(CPTheme.muted(scheme))
                        }
                    }
                    .foregroundStyle(
                        countdown.urgency == "overdue" ? CPTheme.danger :
                        countdown.urgency == "today" ? Color.orange :
                        CPTheme.muted(scheme)
                    )
                }

                HStack(spacing: 8) {
                    if assignment.submission?.missing == true {
                        Label("Missing", systemImage: "exclamationmark.triangle.fill").foregroundStyle(.red)
                    }
                    if assignment.submission?.late == true {
                        Text("Late").foregroundStyle(.orange)
                    }
                    if let points = assignment.pointsPossible {
                        Text("\(points.formatted()) pts")
                            .foregroundStyle(CPTheme.muted(scheme))
                    }
                }
                .font(.system(size: 10, weight: .medium))
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.vertical, 3)
    }
}

struct AssignmentDetailView: View {
    @Environment(\.dismiss) private var dismiss
    let assignment: AssignmentItem
    @ObservedObject var store: NativeContentStore
    @ObservedObject var features: NativeFeatureStore
    @State private var estimate = 25
    @State private var status: String?
    var body: some View {
        Form {
            Section { NativeAssignmentRow(assignment: assignment, store: store) }
            if let description = assignment.description, !description.isEmpty { Section("Description") { Text(description.strippingHTML).textSelection(.enabled) } }
            Section("Planning") {
                Stepper("Estimated time: \(estimate) min", value: $estimate, in: 5...480, step: 5)
                Button("Save estimate") { Task { do { try await features.saveEstimate(estimate, for: assignment); status = "Estimate saved." } catch { status = error.localizedDescription } } }
                Button("Add to CanvasPro Calendar") { addToCalendar() }
            }
            if let score = assignment.submission?.score { Section("Grade") { LabeledContent("Score", value: score.formatted()) } }
            if let url = URL(string: assignment.htmlURL), !assignment.htmlURL.isEmpty { Section { Link("Open in Canvas", destination: url) } }
            if assignment.id < 0, features.customAssignments.contains(where: { $0.id == assignment.id }) { Section { Button("Delete custom assignment", role: .destructive) { Task { do { try await features.savePreference("custom-assignments", features.customAssignments.filter { $0.id != assignment.id }); dismiss() } catch { status = error.localizedDescription } } } } }
            if let status { Section { Text(status).foregroundStyle(.secondary) } }
        }.cpListScreen().navigationTitle("Assignment").onAppear { estimate = features.estimates[assignment.id].flatMap { $0 > 0 ? $0 : nil } ?? 25 }
    }
    private func addToCalendar() {
        guard !features.calendarPicks.contains(where: { $0.assignmentID == assignment.id }) else { status = "Already on your calendar."; return }
        let date = assignment.dueDate ?? Date()
        let pick = CalendarPick(assignmentID: assignment.id, title: assignment.name, context: assignment.courseName, at: ISO8601DateFormatter().string(from: date), dueAt: assignment.dueAt)
        Task { do { try await features.savePreference("calendar-picks", features.calendarPicks + [pick]); status = "Added to calendar." } catch { status = error.localizedDescription } }
    }
}

private struct AddAssignmentView: View {
    @Environment(\.dismiss) private var dismiss
    let courses: [CourseSummary]
    @ObservedObject var features: NativeFeatureStore
    @State private var name = ""; @State private var courseID: Int?; @State private var dueDate = Date(); @State private var hasDueDate = true; @State private var points = 0.0; @State private var notes = ""; @State private var error: String?
    var body: some View {
        NavigationStack {
            Form {
                Section("Assignment") {
                    TextField("Name", text: $name)
                    Picker("Class", selection: $courseID) { Text("Choose a class").tag(Int?.none); ForEach(courses) { Text($0.name).tag(Optional($0.id)) } }
                    Toggle("Due date", isOn: $hasDueDate); if hasDueDate { DatePicker("Due", selection: $dueDate) }
                    TextField("Points", value: $points, format: .number).keyboardType(.decimalPad)
                    TextField("Notes", text: $notes, axis: .vertical)
                }
                if let error { Section { Text(error).foregroundStyle(.red) } }
            }
            .cpListScreen()
            .navigationTitle("New Assignment")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) { Button("Save") { save() }.disabled(name.trimmingCharacters(in: .whitespaces).isEmpty || courseID == nil) }
            }
        }
    }
    private func save() {
        guard let courseID else { return }
        let item = CustomAssignment(id: -Int(Date().timeIntervalSince1970 * 1000), courseID: courseID, name: name.trimmingCharacters(in: .whitespaces), dueAt: hasDueDate ? ISO8601DateFormatter().string(from: dueDate) : nil, pointsPossible: points > 0 ? points : nil, notes: notes, createdAt: ISO8601DateFormatter().string(from: Date()))
        Task { do { try await features.savePreference("custom-assignments", features.customAssignments + [item]); dismiss() } catch { self.error = error.localizedDescription } }
    }
}

private struct NativeGradesView: View {
    @Environment(\.colorScheme) private var scheme
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @ObservedObject var store: NativeContentStore
    @ObservedObject var features: NativeFeatureStore
    @State private var search = ""
    @State private var expanded = Set<Int>()
    @State private var gradeHistory: [Int: [Double]] = [:]
    private var visibleCourses: [CourseSummary] { store.bundle.courses.filter { !features.hiddenCourseIDs.contains($0.id) } }
    private var courses: [CourseSummary] { visibleCourses.filter { course in search.isEmpty || store.displayName(courseID: course.id, fallback: course.name).localizedCaseInsensitiveContains(search) || course.courseCode.localizedCaseInsensitiveContains(search) || store.bundle.assignments.contains { $0.courseID == course.id && $0.name.localizedCaseInsensitiveContains(search) } } }
    private var scored: [CourseSummary] { visibleCourses.filter { $0.currentScore != nil } }
    private var average: Double? { scored.isEmpty ? nil : scored.compactMap(\.currentScore).reduce(0, +) / Double(scored.count) }
    private var gradedAssignments: Int { store.bundle.assignments.filter { !features.hiddenCourseIDs.contains($0.courseID) && ($0.submission?.score != nil || $0.submission?.grade != nil) }.count }
    private var gradeSignature: String { store.bundle.courses.map { "\($0.id):\($0.currentScore ?? -1)" }.joined(separator: ",") }
    private var risingCount: Int { scored.filter { course in trend(for: course).map { $0 > 0 } ?? false }.count }
    var body: some View {
        NavigationStack {
            ZStack {
                CPBackdrop()
                ScrollView {
                    LazyVStack(spacing: 14) {
                        if store.isLoading && store.bundle.courses.isEmpty {
                            CPSkeletonCard()
                            CPSkeletonCard()
                            CPSkeletonCard()
                        } else {
                            gradesHero
                            ForEach(courses) { course in gradeCard(course) }
                            NavigationLink { GradeCalculatorView() } label: { CPGlassCard(title: "What-if grade calculator", subtitle: "Plan the score you need") { Label("Open calculator", systemImage: "function").font(.system(size: 12, weight: .regular)).foregroundStyle(Color.accentColor) } }.buttonStyle(CPPressStyle())
                            if courses.isEmpty && !store.isLoading { CPGlassCard { NativeEmptyState(title: search.isEmpty ? "No grades yet" : "No matching grades", symbol: "chart.bar") } }
                        }
                    }.padding(.horizontal, 15).padding(.vertical, 10).padding(.bottom, 24)
                }
            }
            .navigationTitle("Grades").navigationBarTitleDisplayMode(.inline).searchable(text: $search, prompt: "Course or assignment").refreshable { await store.load() }
            .onAppear { loadAndRecordGrades() }.onChange(of: gradeSignature) { _, _ in loadAndRecordGrades() }
        }
    }

    private var gradesHero: some View {
        CPGlassCard(strong: true) {
            VStack(alignment: .leading, spacing: 12) {
                VStack(alignment: .leading, spacing: 2) { Text("CURRENT AVERAGE").font(.system(size: 10, weight: .regular)).tracking(1.4).foregroundStyle(CPTheme.muted(scheme)); CountUpGrade(value: average, size: 42, color: gradeColor(average)) }
                Divider().overlay(CPTheme.foreground(scheme).opacity(0.10))
                LazyVGrid(columns: [GridItem(.flexible(minimum: 0), spacing: 8), GridItem(.flexible(minimum: 0), spacing: 8)], spacing: 12) { gradeMetric("\(scored.count)", "Courses graded"); gradeMetric("\(risingCount)", "Trending up", accent: true); gradeMetric("\(gradedAssignments)", "Grades posted") }
            }
        }.overlay(alignment: .topTrailing) { Circle().fill(CPTheme.primary(scheme: scheme).opacity(0.15)).frame(width: 280, height: 280).blur(radius: 70).offset(x: 100, y: -100).allowsHitTesting(false) }
    }

    private func gradeMetric(_ value: String, _ label: String, accent: Bool = false) -> some View { VStack(alignment: .leading, spacing: 4) { Text(value).font(.system(size: 17, weight: .regular)).foregroundStyle(accent ? CPTheme.primary(scheme: scheme) : CPTheme.foreground(scheme)); Text(label).font(.system(size: 10, weight: .regular)).foregroundStyle(CPTheme.muted(scheme)).lineLimit(1).minimumScaleFactor(0.75) }.padding(.horizontal, 8).frame(maxWidth: .infinity, alignment: .leading) }
    private func gradeColor(_ score: Double?) -> Color { guard let score else { return CPTheme.muted(scheme) }; return score >= 90 ? CPTheme.primary(scheme: scheme) : score >= 80 ? .cyan : score >= 70 ? CPTheme.warning : CPTheme.danger }
    private func trend(for course: CourseSummary) -> Double? { guard let current = course.currentScore, let previous = gradeHistory[course.id]?.first(where: { abs($0 - current) > 0.05 }) else { return nil }; return current - previous }
    private func gradeCard(_ course: CourseSummary) -> some View {
        let graded = store.bundle.assignments.filter { item in
            item.courseID == course.id &&
            (item.submission?.score != nil || !((item.submission?.grade ?? "").isEmpty)) &&
            (search.isEmpty || item.name.localizedCaseInsensitiveContains(search))
        }
        return CPGlassCard {
            NavigationLink { CourseDetailView(course: course, store: store, features: features, initialSection: .graded) } label: {
                VStack(alignment: .leading, spacing: 12) {
                    HStack(spacing: 9) {
                        Image(systemName: "book.closed.fill").font(.system(size: 12)).foregroundStyle(gradeColor(course.currentScore))
                            .frame(width: 30, height: 30).background(gradeColor(course.currentScore).opacity(0.12), in: RoundedRectangle(cornerRadius: 9))
                        Text(store.displayName(courseID: course.id, fallback: course.name)).font(.system(size: 14)).lineLimit(2)
                        Spacer(minLength: 5)
                        Image(systemName: "chevron.right").font(.system(size: 11)).foregroundStyle(CPTheme.muted(scheme))
                    }
                    HStack(alignment: .bottom) { VStack(alignment: .leading) { Text("CURRENT GRADE").font(.system(size: 9)).foregroundStyle(CPTheme.muted(scheme)); CountUpGrade(value: course.currentScore, size: 31, color: gradeColor(course.currentScore)) }; Spacer(); Text(course.currentGrade ?? "—").font(.system(size: 12)).foregroundStyle(gradeColor(course.currentScore)); if let trend = trend(for: course) { Label("\(abs(trend).formatted(.number.precision(.fractionLength(1))))", systemImage: trend > 0 ? "arrow.up" : "arrow.down").font(.system(size: 11)).foregroundStyle(trend > 0 ? CPTheme.primary(scheme: scheme) : CPTheme.danger) } else { Label("Steady", systemImage: "minus").font(.system(size: 10)).foregroundStyle(CPTheme.muted(scheme)) } }
                    Text("\(graded.count) graded assignment\(graded.count == 1 ? "" : "s")").font(.system(size: 10)).foregroundStyle(CPTheme.muted(scheme))
                    ProgressView(value: max(0, min(100, course.currentScore ?? 0)), total: 100).tint(gradeColor(course.currentScore))
                }
            }.buttonStyle(CPPressStyle())
            Button { withAnimation(reduceMotion ? nil : .easeInOut(duration: 0.2)) { if expanded.contains(course.id) { expanded.remove(course.id) } else { expanded.insert(course.id) } } } label: { HStack { Text(expanded.contains(course.id) ? "Hide graded work" : "Show graded work"); Spacer(); Image(systemName: expanded.contains(course.id) ? "chevron.up" : "chevron.down") }.font(.system(size: 11)).foregroundStyle(CPTheme.primary(scheme: scheme)) }.buttonStyle(CPPressStyle())
            if expanded.contains(course.id) {
                Divider()
                Text("GRADED WORK").font(.system(size: 10)).foregroundStyle(CPTheme.muted(scheme))
                if graded.isEmpty { Text("No graded assignments yet.").font(.system(size: 11)).foregroundStyle(CPTheme.muted(scheme)) }
                ForEach(graded) { item in NavigationLink { AssignmentDetailView(assignment: item, store: store, features: features) } label: { HStack { Text(item.name).font(.system(size: 11)).lineLimit(2); Spacer(); Text("\(item.submission?.score?.formatted() ?? "—") / \(item.pointsPossible?.formatted() ?? "—")").font(.system(size: 11)).monospacedDigit() } }.buttonStyle(.plain) }
            }
        }
    }
    private func loadAndRecordGrades() {
        let historyKey = "CanvasProNativeGradeHistory.\(store.persistenceScope)"
        if let saved = UserDefaults.standard.data(forKey: historyKey), let decoded = try? JSONDecoder().decode([Int: [Double]].self, from: saved) { gradeHistory = decoded }
        for course in store.bundle.courses { guard let score = course.currentScore else { continue }; if gradeHistory[course.id]?.first != score { gradeHistory[course.id, default: []].insert(score, at: 0); gradeHistory[course.id] = Array(gradeHistory[course.id, default: []].prefix(20)) } }
        if let data = try? JSONEncoder().encode(gradeHistory) { UserDefaults.standard.set(data, forKey: historyKey) }
    }
}

struct CourseRow: View {
    @Environment(\.colorScheme) private var scheme
    let course: CourseSummary; @ObservedObject var store: NativeContentStore
    var body: some View { HStack(spacing: 10) { Circle().fill(gradeColor).frame(width: 8, height: 8).shadow(color: gradeColor.opacity(0.6), radius: 4); VStack(alignment: .leading, spacing: 3) { Text(store.displayName(courseID: course.id, fallback: course.name)).font(.system(size: 14, weight: .regular)).lineLimit(2); Text(course.courseCode).font(.system(size: 11, weight: .regular)).foregroundStyle(CPTheme.muted(scheme)).lineLimit(1) }.frame(maxWidth: .infinity, alignment: .leading); VStack(alignment: .trailing) { Text(course.currentGrade ?? "—").font(.system(size: 16, weight: .regular)).foregroundStyle(gradeColor); if let score = course.currentScore { Text("\(score.formatted(.number.precision(.fractionLength(1))))%").font(.system(size: 11, weight: .regular)).foregroundStyle(CPTheme.muted(scheme)) } }.fixedSize(horizontal: true, vertical: false) }.padding(.vertical, 2) }
    private var gradeColor: Color { guard let score = course.currentScore else { return CPTheme.muted(scheme) }; return score >= 90 ? Color.accentColor : score >= 80 ? .cyan : score >= 70 ? CPTheme.warning : CPTheme.danger }
}

enum CourseDetailSection: String, CaseIterable {
    case upcoming = "Upcoming", graded = "Graded", announcements = "Announcements"
}

struct CourseDetailView: View {
    @Environment(\.colorScheme) private var scheme
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.dismiss) private var dismiss
    let course: CourseSummary
    @ObservedObject var store: NativeContentStore
    @ObservedObject var features: NativeFeatureStore
    @State private var section: CourseDetailSection
    @State private var showAllUpcoming = false
    @State private var showAllAnnouncements = false

    init(course: CourseSummary, store: NativeContentStore, features: NativeFeatureStore, initialSection: CourseDetailSection = .upcoming) {
        self.course = course
        self.store = store
        self.features = features
        _section = State(initialValue: initialSection)
    }

    private var courseName: String { store.displayName(courseID: course.id, fallback: course.name) }
    private var courseAssignments: [AssignmentItem] {
        store.bundle.assignments.filter { $0.courseID == course.id } +
        features.customAssignments.filter { $0.courseID == course.id }.map { AssignmentItem.custom($0, course: course) }
    }
    private var upcoming: [AssignmentItem] { courseAssignments.filter { $0.isVisible(in: store) }.sorted(by: AssignmentItem.dueSort) }
    private var upcomingThreeWeeks: [AssignmentItem] {
        let cutoff = Date().addingTimeInterval(21 * 86400)
        return upcoming.filter { item in
            guard let dueDate = item.dueDate else { return true }
            return dueDate <= cutoff
        }
    }
    private var graded: [AssignmentItem] {
        courseAssignments.filter { $0.submission?.score != nil || !($0.submission?.grade ?? "").isEmpty }
            .sorted { ($0.submission?.submittedAt ?? $0.dueAt ?? "") > ($1.submission?.submittedAt ?? $1.dueAt ?? "") }
    }
    private var announcements: [AnnouncementItem] {
        store.bundle.announcements.filter { $0.courseID == course.id && $0.isWithin(weeks: features.announcementWeeks) }
            .sorted { $0.postedAt > $1.postedAt }
    }
    private var recentAnnouncements: [AnnouncementItem] { announcements.filter { item in ISO8601DateFormatter.canvasDate(from: item.postedAt).map { $0 >= Date().addingTimeInterval(-21 * 86400) } ?? true } }
    private var matchingSchedule: [ClassScheduleEntry] {
        let values = [course.name, course.courseCode, courseName].map { normalize($0) }
        return features.schedule.filter { entry in
            if entry.canvasCourseID == course.id { return true }
            let candidates = [entry.title, entry.code].map { normalize($0) }
            return candidates.contains { candidate in values.contains { value in candidate == value || (candidate.count > 3 && value.contains(candidate)) || (value.count > 3 && candidate.contains(value)) } }
        }
    }
    private var scheduleText: String? {
        if !matchingSchedule.isEmpty {
            return matchingSchedule.map { entry in
                let days = entry.days.map { fullDay($0) }.joined(separator: ", ")
                return "\(days) · \(time(entry.startMinutes))–\(time(entry.endMinutes))\(entry.location.isEmpty ? "" : " · \(entry.location)")"
            }.joined(separator: "  |  ")
        }
        let names = [course.name, course.courseCode].map { normalize($0) }
        guard let event = store.bundle.calendar.first(where: { event in
            if event.contextCode == "course_\(course.id)" { return true }
            let title = normalize(event.title)
            return names.contains { value in !value.isEmpty && (title.contains(value) || value.contains(title)) }
        }), let startAt = event.startAt, let date = ISO8601DateFormatter.canvasDate(from: startAt) else { return nil }
        return date.formatted(.dateTime.weekday(.abbreviated).hour().minute()) + (event.locationName.map { " · \($0)" } ?? "")
    }
    private var gradeColor: Color {
        guard let score = course.currentScore else { return CPTheme.muted(scheme) }
        return score >= 90 ? CPTheme.primary(scheme: scheme) : score >= 80 ? .cyan : score >= 70 ? CPTheme.warning : CPTheme.danger
    }

    var body: some View {
        ZStack {
            CPBackdrop()
            ScrollView {
                LazyVStack(spacing: 14) {
                    scheduleBar
                    hero
                    sectionPicker
                    sectionContent
                        .id(section)
                        .transition(.opacity)
                }
                .padding(.horizontal, 14).padding(.top, 8).padding(.bottom, 28)
            }
        }
        .navigationTitle(courseName)
        .navigationBarTitleDisplayMode(.inline)
    }

    private var scheduleBar: some View {
        HStack {
            Button { dismiss() } label: { Label("Back", systemImage: "chevron.left").font(.system(size: 12, weight: .regular)).foregroundStyle(CPTheme.muted(scheme)) }.buttonStyle(.plain)
            Spacer()
            if let scheduleText { Label(scheduleText, systemImage: "calendar").font(.system(size: 11, weight: .regular)).foregroundStyle(CPTheme.muted(scheme)).lineLimit(2).multilineTextAlignment(.trailing) }
            else { NavigationLink { ClassScheduleView(features: features) } label: { Label("Enter class time/days", systemImage: "calendar.badge.plus").font(.system(size: 11, weight: .regular)) } }
        }
    }

    private var hero: some View {
        CPGlassCard(strong: true) {
            VStack(alignment: .leading, spacing: 14) {
                Text(course.courseCode.isEmpty ? "COURSE" : course.courseCode).font(.system(size: 10, weight: .regular)).tracking(1.1).foregroundStyle(CPTheme.muted(scheme)).padding(.horizontal, 10).frame(minHeight: 26).background(CPTheme.inset(scheme), in: Capsule())
                Text(courseName).font(.system(size: 27, weight: .regular)).tracking(-0.8).fixedSize(horizontal: false, vertical: true)
                if let scheduleText { Label(scheduleText, systemImage: "clock").font(.system(size: 12, weight: .regular)).foregroundStyle(CPTheme.muted(scheme)).fixedSize(horizontal: false, vertical: true) }
                else { NavigationLink { ClassScheduleView(features: features) } label: { Label("Enter class time/days", systemImage: "calendar.badge.plus").font(.system(size: 12, weight: .regular)) } }
                Divider().overlay(CPTheme.foreground(scheme).opacity(0.10))
                VStack(spacing: 8) {
                    Text("CURRENT GRADE").font(.system(size: 10, weight: .regular)).tracking(1.5).foregroundStyle(CPTheme.muted(scheme))
                    CountUpGrade(value: course.currentScore, size: 44, color: gradeColor)
                    HStack(spacing: 8) {
                        Text(course.currentGrade ?? letterGrade(course.currentScore)).foregroundStyle(gradeColor).padding(.horizontal, 9).frame(minHeight: 25).background(gradeColor.opacity(0.12), in: Capsule())
                        Text("\(courseAssignments.count) assignment\(courseAssignments.count == 1 ? "" : "s")").foregroundStyle(CPTheme.muted(scheme))
                    }.font(.system(size: 11, weight: .regular))
                }.frame(maxWidth: .infinity).padding(14).background(CPTheme.inset(scheme), in: RoundedRectangle(cornerRadius: 18, style: .continuous)).overlay(RoundedRectangle(cornerRadius: 18).stroke(CPTheme.insetBorder(scheme)))
            }
        }.overlay(alignment: .topTrailing) { Circle().fill(gradeColor.opacity(0.14)).frame(width: 240, height: 240).blur(radius: 70).offset(x: 100, y: -100).allowsHitTesting(false) }
    }

    private var sectionPicker: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(CourseDetailSection.allCases, id: \.self) { option in
                    Button { withAnimation(reduceMotion ? nil : .easeInOut(duration: 0.18)) { section = option } } label: { HStack(spacing: 6) { Text(option.rawValue); Text("\(count(for: option))").font(.system(size: 10, weight: .regular)).padding(.horizontal, 6).frame(minHeight: 20).background(CPTheme.inset(scheme), in: Capsule()) }.font(.system(size: 12, weight: .regular)).padding(.horizontal, 12).frame(minHeight: 38).foregroundStyle(section == option ? CPTheme.background(scheme) : CPTheme.muted(scheme)).background(section == option ? CPTheme.foreground(scheme) : CPTheme.inset(scheme), in: RoundedRectangle(cornerRadius: 12)).overlay(RoundedRectangle(cornerRadius: 12).stroke(CPTheme.insetBorder(scheme))) }.buttonStyle(CPPressStyle())
                }
            }
        }
    }

    @ViewBuilder private var sectionContent: some View {
        switch section {
        case .upcoming: upcomingSection
        case .graded: gradedSection
        case .announcements: announcementsSection
        }
    }

    private var upcomingSection: some View {
        let items = showAllUpcoming ? upcoming : upcomingThreeWeeks
        return VStack(alignment: .leading, spacing: 10) {
            sectionHeading("Upcoming")
            if upcoming.isEmpty { CPGlassCard { NativeEmptyState(title: "All caught up", symbol: "checkmark.circle", detail: "No upcoming assignments due for this class.") } }
            else {
                if upcoming.count > upcomingThreeWeeks.count { Button(showAllUpcoming ? "Show less" : "Only showing the next 3 weeks · View all") { showAllUpcoming.toggle() }.font(.system(size: 11, weight: .regular)).foregroundStyle(CPTheme.muted(scheme)) }
                ForEach(items) { assignment in courseAssignmentCard(assignment, graded: false) }
            }
        }
    }

    private var gradedSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            sectionHeading("Graded")
            if graded.isEmpty { CPGlassCard { NativeEmptyState(title: "No graded assignments", symbol: "checkmark.circle", detail: "No graded assignments are recorded yet.") } }
            else { ForEach(graded) { assignment in courseAssignmentCard(assignment, graded: true) } }
        }
    }

    private var announcementsSection: some View {
        let items = showAllAnnouncements ? announcements : recentAnnouncements
        return VStack(alignment: .leading, spacing: 10) {
            sectionHeading("Announcements")
            if announcements.isEmpty { CPGlassCard { NativeEmptyState(title: "No announcements", symbol: "megaphone", detail: "No announcements are posted for this course.") } }
            else {
                if announcements.count > recentAnnouncements.count { Button(showAllAnnouncements ? "Show less" : "Only showing the past 3 weeks · View all") { showAllAnnouncements.toggle() }.font(.system(size: 11, weight: .regular)).foregroundStyle(CPTheme.muted(scheme)) }
                ForEach(items) { item in NavigationLink { AnnouncementDetailView(item: item) } label: { CPGlassCard { VStack(alignment: .leading, spacing: 7) { HStack(alignment: .top) { Text(item.title).font(.system(size: 14, weight: .regular)); Spacer(); Text(announcementDate(item)).font(.system(size: 10, weight: .regular)).foregroundStyle(CPTheme.muted(scheme)) }; Text(item.message.strippingHTML).font(.system(size: 12, weight: .regular)).foregroundStyle(CPTheme.muted(scheme)).lineLimit(3); Label("Read full announcement", systemImage: "arrow.up.right").font(.system(size: 11, weight: .regular)) } } }.buttonStyle(.plain) }
            }
        }
    }

    private func courseAssignmentCard(_ assignment: AssignmentItem, graded isGraded: Bool) -> some View {
        CPGlassCard {
            HStack(alignment: .top, spacing: 12) {
                VStack(alignment: .leading, spacing: 7) {
                    Text(assignment.name).font(.system(size: 14, weight: .regular)).fixedSize(horizontal: false, vertical: true)
                    NavigationLink { AssignmentDetailView(assignment: assignment, store: store, features: features) } label: { Label("Description", systemImage: "doc.text").font(.system(size: 10, weight: .regular)).foregroundStyle(CPTheme.muted(scheme)) }
                    HStack(spacing: 8) {
                        if let date = assignment.dueDate { Label(date.formatted(.dateTime.month(.abbreviated).day().hour().minute()), systemImage: isGraded ? "checkmark.circle" : "calendar").font(.system(size: 11, weight: .regular)).foregroundStyle(CPTheme.muted(scheme)) }
                        if let points = assignment.pointsPossible { Text("\(points.formatted()) pts").font(.system(size: 10, weight: .regular)).padding(.horizontal, 7).frame(minHeight: 22).background(CPTheme.inset(scheme), in: Capsule()) }
                    }
                }.frame(maxWidth: .infinity, alignment: .leading)
                if isGraded { gradeResult(assignment) }
                else if let url = URL(string: assignment.htmlURL), !assignment.htmlURL.isEmpty { Link(destination: url) { Label("Open", systemImage: "arrow.up.right").font(.system(size: 11, weight: .regular)).padding(.horizontal, 10).frame(minHeight: 34).background(CPTheme.inset(scheme), in: RoundedRectangle(cornerRadius: 11)) } }
            }
        }
    }

    private func gradeResult(_ assignment: AssignmentItem) -> some View {
        let earned = assignment.submission?.score
        let possible = assignment.pointsPossible
        let percent = earned.flatMap { score in possible.flatMap { $0 > 0 ? score / $0 * 100 : nil } }
        let color = percent.map { $0 >= 90 ? CPTheme.primary(scheme: scheme) : $0 >= 80 ? Color.cyan : $0 >= 70 ? CPTheme.warning : CPTheme.danger } ?? CPTheme.muted(scheme)
        return VStack(alignment: .trailing, spacing: 5) { Text(earned.map { $0.formatted() } ?? "—") + Text(possible.map { " / \($0.formatted())" } ?? ""); if let percent { Text("\(Int(percent.rounded()))%").font(.system(size: 10, weight: .regular)).foregroundStyle(color).padding(.horizontal, 7).frame(minHeight: 22).background(color.opacity(0.12), in: Capsule()) } }.font(.system(size: 12, weight: .regular)).fixedSize()
    }

    private func sectionHeading(_ title: String) -> some View { Text(title.uppercased()).font(.system(size: 10, weight: .regular)).tracking(1.5).foregroundStyle(CPTheme.muted(scheme)).padding(.horizontal, 2) }
    private func count(for value: CourseDetailSection) -> Int { value == .upcoming ? upcoming.count : value == .graded ? graded.count : announcements.count }
    private func normalize(_ value: String) -> String { value.lowercased().filter { $0.isLetter || $0.isNumber } }
    private func fullDay(_ value: String) -> String { ["M": "Monday", "T": "Tuesday", "W": "Wednesday", "R": "Thursday", "F": "Friday", "S": "Saturday", "U": "Sunday"][value] ?? value }
    private func time(_ minutes: Int) -> String { let hour = minutes / 60; let minute = minutes % 60; return String(format: "%d:%02d %@", hour % 12 == 0 ? 12 : hour % 12, minute, hour < 12 ? "AM" : "PM") }
    private func letterGrade(_ score: Double?) -> String { guard let score else { return "—" }; return score >= 97 ? "A+" : score >= 93 ? "A" : score >= 90 ? "A−" : score >= 87 ? "B+" : score >= 83 ? "B" : score >= 80 ? "B−" : score >= 77 ? "C+" : score >= 73 ? "C" : score >= 70 ? "C−" : score >= 67 ? "D+" : score >= 63 ? "D" : score >= 60 ? "D−" : "F" }
    private func announcementDate(_ item: AnnouncementItem) -> String { ISO8601DateFormatter.canvasDate(from: item.postedAt)?.formatted(.dateTime.month(.abbreviated).day().year()) ?? "Recent" }
}

private struct CountUpGrade: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    let value: Double?; let size: CGFloat; let color: Color
    @State private var displayed = 0.0
    var body: some View {
        Group {
            if let value { AnimatedNumberText(value: displayed, size: size, color: color) }
            else { Text("—").font(.system(size: size, weight: .regular)).foregroundStyle(color) }
        }
        .onAppear { animate(to: value) }
        .onChange(of: value) { _, next in animate(to: next) }
    }
    private func animate(to target: Double?) {
        guard let target else { displayed = 0; return }
        if reduceMotion { displayed = target }
        else { withAnimation(.easeOut(duration: 0.7)) { displayed = target } }
    }
}

private struct AnimatedNumberText: View, Animatable {
    var value: Double; let size: CGFloat; let color: Color
    var animatableData: Double { get { value } set { value = newValue } }
    var body: some View { Text("\(value, specifier: "%.1f")%").font(.system(size: size, weight: .regular)).tracking(-1.8).monospacedDigit().foregroundStyle(color) }
}

private struct GradeGroup: Identifiable {
    let id: UUID
    var name: String
    var weight: String
    var score: String
    init(name: String, weight: String, score: String) { id = UUID(); self.name = name; self.weight = weight; self.score = score }
}

private struct GradeCalculatorView: View {
    @State private var rows = [GradeGroup(name: "Homework", weight: "20", score: "92"), GradeGroup(name: "Quizzes", weight: "20", score: "85"), GradeGroup(name: "Midterm", weight: "25", score: "78"), GradeGroup(name: "Final exam", weight: "35", score: "")]
    @State private var target = "90"
    private var gradedWeight: Double { rows.reduce(0) { $0 + ((Double($1.weight) ?? 0) > 0 && Double($1.score) != nil ? (Double($1.weight) ?? 0) : 0) } }
    private var ungradedWeight: Double { rows.reduce(0) { $0 + ((Double($1.weight) ?? 0) > 0 && Double($1.score) == nil ? (Double($1.weight) ?? 0) : 0) } }
    private var totalWeight: Double { gradedWeight + ungradedWeight }
    private var earned: Double { rows.reduce(0) { $0 + ((Double($1.weight) ?? 0) > 0 ? (Double($1.weight) ?? 0) * (Double($1.score) ?? 0) / 100 : 0) } }
    private var current: Double? { gradedWeight > 0 ? earned / gradedWeight * 100 : nil }
    private var projected: Double? { totalWeight > 0 ? earned / totalWeight * 100 : nil }
    private var needed: Double? { guard let goal = Double(target), ungradedWeight > 0, totalWeight > 0 else { return nil }; return (goal / 100 * totalWeight - earned) / (ungradedWeight / 100) }
    var body: some View {
        Form {
            Section("Weighted grade") {
                Text("Enter each group's weight and score. Leave the score blank for work that is not graded yet.").font(.system(size: 12)).foregroundStyle(.secondary)
                ForEach($rows) { $row in
                    VStack(alignment: .leading, spacing: 8) {
                        HStack { TextField("Group name", text: $row.name); Button(role: .destructive) { rows.removeAll { $0.id == row.id } } label: { Image(systemName: "trash") }.accessibilityLabel("Remove \(row.name)") }
                        HStack { TextField("Weight %", text: $row.weight).keyboardType(.decimalPad); TextField("Score % (optional)", text: $row.score).keyboardType(.decimalPad) }
                    }
                }
                Button { rows.append(GradeGroup(name: "", weight: "", score: "")) } label: { Label("Add group", systemImage: "plus") }
            }
            Section("Results") {
                LabeledContent("Grade now", value: current.map { "\($0.formatted(.number.precision(.fractionLength(1))))%" } ?? "—")
                Text("Based on \(gradedWeight.formatted())% of the course graded").font(.system(size: 11)).foregroundStyle(.secondary)
                LabeledContent("Projected if remaining scores zero", value: (ungradedWeight > 0 ? projected : current).map { "\($0.formatted(.number.precision(.fractionLength(1))))%" } ?? "—")
                LabeledContent("Weights total", value: "\(totalWeight.formatted())%")
                if totalWeight != 100 { Text("Weights should total 100%.").font(.system(size: 11)).foregroundStyle(.orange) }
            }
            Section("What do I need on the final?") {
                TextField("Grade I want", text: $target).keyboardType(.decimalPad)
                if let needed { Text(needed > 100 ? "You would need \(needed.formatted(.number.precision(.fractionLength(1))))% on remaining work, above 100%." : "Average \(needed.formatted(.number.precision(.fractionLength(1))))% on remaining work to finish at your target.") }
                else { Text("Leave at least one score blank and enter a target grade.").foregroundStyle(.secondary) }
            }
        }.cpListScreen().navigationTitle("Grade Calculator")
    }
}

private struct StoredNativeStudySession: Codable {
    let selected: [Int]
    let duration: Int
    let remaining: Int
    let running: Bool
    let currentIndex: Int
    let savedAt: Date
    let manualTasks: [AssignmentItem]?
    let completedIDs: [Int]?
    let finished: Bool?
    let started: Bool?
}

private struct NativeStudyView: View {
    @Environment(\.colorScheme) private var scheme
    @ObservedObject var store: NativeContentStore
    @ObservedObject var features: NativeFeatureStore
    @State private var selected: Set<Int>; @State private var selectedOrder: [Int]; @State private var manualTasks: [AssignmentItem]; @State private var completedIDs: Set<Int>; @State private var sessionFinished: Bool; @State private var sessionStarted: Bool
    @State private var duration: Int; @State private var remaining: Int; @State private var running: Bool; @State private var currentIndex: Int; @State private var showCompleted = false
    @State private var manualName = ""; @State private var search = ""
    private let timer = Timer.publish(every: 1, on: .main, in: .common).autoconnect()
    private var sessionKey: String { "CanvasProNativeStudySession.\(store.persistenceScope)" }
    private var availableItems: [AssignmentItem] { (store.bundle.assignments + features.customAssignments.map { item in AssignmentItem.custom(item, course: store.bundle.courses.first { $0.id == item.courseID }) } + manualTasks).filter { !features.hiddenCourseIDs.contains($0.courseID) || $0.courseID == 0 } }
    private var items: [AssignmentItem] { selectedOrder.compactMap { id in availableItems.first { $0.id == id && selected.contains(id) } } }

    init(store: NativeContentStore, features: NativeFeatureStore) {
        self.store = store; self.features = features
        let key = "CanvasProNativeStudySession.\(store.persistenceScope)"
        let saved = UserDefaults.standard.data(forKey: key).flatMap { try? JSONDecoder().decode(StoredNativeStudySession.self, from: $0) }
        let elapsed = saved?.running == true ? max(0, Int(Date().timeIntervalSince(saved?.savedAt ?? Date()))) : 0
        let restoredRemaining = max(0, (saved?.remaining ?? 25 * 60) - elapsed)
        _selected = State(initialValue: Set(saved?.selected ?? []))
        _selectedOrder = State(initialValue: saved?.selected ?? [])
        _manualTasks = State(initialValue: saved?.manualTasks ?? [])
        _completedIDs = State(initialValue: Set(saved?.completedIDs ?? []))
        _sessionFinished = State(initialValue: saved?.finished ?? false)
        _sessionStarted = State(initialValue: saved?.started ?? (saved?.running == true || restoredRemaining != (saved?.duration ?? 25) * 60))
        _duration = State(initialValue: saved?.duration ?? 25)
        _remaining = State(initialValue: restoredRemaining)
        _running = State(initialValue: saved?.running == true && restoredRemaining > 0)
        _currentIndex = State(initialValue: saved?.currentIndex ?? 0)
    }

    var body: some View {
        NavigationStack {
            Group { if sessionFinished { summary } else if sessionStarted { activeSession } else { setup } }
                .navigationTitle("Study Session")
                .onReceive(timer) { _ in guard running, remaining > 0 else { return }; remaining -= 1; if remaining == 0 { running = false; UINotificationFeedbackGenerator().notificationOccurred(.success) } }
                .onChange(of: selected) { _, _ in persistSession() }
                .onChange(of: selectedOrder) { _, _ in persistSession() }
                .onChange(of: manualTasks) { _, _ in persistSession() }
                .onChange(of: completedIDs) { _, _ in persistSession() }
                .onChange(of: sessionFinished) { _, _ in persistSession() }
                .onChange(of: sessionStarted) { _, _ in persistSession() }
                .onChange(of: duration) { _, _ in persistSession() }
                .onChange(of: remaining) { _, _ in persistSession() }
                .onChange(of: running) { _, _ in persistSession() }
                .onChange(of: currentIndex) { _, _ in persistSession() }
        }
    }

    private func persistSession() {
        let value = StoredNativeStudySession(selected: selectedOrder, duration: duration, remaining: remaining, running: running, currentIndex: currentIndex, savedAt: Date(), manualTasks: manualTasks, completedIDs: Array(completedIDs), finished: sessionFinished, started: sessionStarted)
        if let data = try? JSONEncoder().encode(value) { UserDefaults.standard.set(data, forKey: sessionKey) }
    }
    private var setup: some View {
        ZStack {
            CPBackdrop()
            ScrollView {
                LazyVStack(spacing: 14) {
                    CPGlassCard(title: "Choose tasks") {
                        Toggle("Show completed", isOn: $showCompleted).font(.system(size: 12, weight: .regular))
                        HStack { TextField("Add a task of your own", text: $manualName); Button("Add") { addManualTask() }.disabled(manualName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty) }
                        TextField("Search assignments", text: $search)
                        VStack(spacing: 8) { ForEach(availableItems.filter { item in (item.courseID == 0 || item.isVisible(in: store, showCompleted: showCompleted)) && (search.isEmpty || item.name.localizedCaseInsensitiveContains(search) || item.courseName.localizedCaseInsensitiveContains(search)) }.sorted(by: AssignmentItem.dueSort)) { item in Button { if selected.contains(item.id) { selected.remove(item.id); selectedOrder.removeAll { $0 == item.id } } else { selected.insert(item.id); selectedOrder.append(item.id) } } label: { CPInsetRow { HStack(spacing: 10) { Image(systemName: selected.contains(item.id) ? "checkmark.square.fill" : "square").foregroundStyle(selected.contains(item.id) ? CPTheme.primary(scheme: scheme) : CPTheme.muted(scheme)); VStack(alignment: .leading, spacing: 3) { Text(item.name).font(.system(size: 13, weight: .regular)); Text(item.courseName).font(.system(size: 11, weight: .regular)).foregroundStyle(CPTheme.muted(scheme)) }; Spacer() } } }.buttonStyle(.plain) } }
                        if !items.isEmpty { VStack(alignment: .leading, spacing: 8) { Text("SELECTED ORDER").font(.system(size: 10)).foregroundStyle(CPTheme.muted(scheme)); ForEach(items.indices, id: \.self) { index in let item = items[index]; HStack { Text(item.name).font(.system(size: 12)); Spacer(); Button { moveSelection(index, -1) } label: { Image(systemName: "arrow.up") }.disabled(index == 0); Button { moveSelection(index, 1) } label: { Image(systemName: "arrow.down") }.disabled(index == items.count - 1); Button { selected.remove(item.id); selectedOrder.removeAll { $0 == item.id } } label: { Image(systemName: "xmark") } }.buttonStyle(.plain) } } }
                    }
                    CPGlassCard(title: "Duration", strong: true) {
                        VStack(spacing: 2) { Text("\(duration)").font(.system(size: 32, weight: .regular)).tracking(-1).monospacedDigit(); Text("MINUTES").font(.system(size: 10, weight: .regular)).tracking(1.4).foregroundStyle(CPTheme.muted(scheme)) }.frame(maxWidth: .infinity).padding(.vertical, 12).background(CPTheme.foreground(scheme).opacity(0.05), in: RoundedRectangle(cornerRadius: 14))
                        LazyVGrid(columns: [GridItem(.flexible(minimum: 0), spacing: 8), GridItem(.flexible(minimum: 0), spacing: 8)], spacing: 8) { ForEach([15, 25, 45, 60], id: \.self) { value in Button { duration = value; remaining = value * 60 } label: { CPChip(text: "\(value)m", selected: duration == value).frame(maxWidth: .infinity) }.buttonStyle(.plain) } }
                        Button { completedIDs.removeAll(); currentIndex = 0; remaining = duration * 60; sessionStarted = true; running = true } label: { Label("Start session", systemImage: "timer").font(.system(size: 13, weight: .regular)).frame(maxWidth: .infinity, minHeight: 42).foregroundStyle(CPTheme.background(scheme)).background(CPTheme.foreground(scheme), in: RoundedRectangle(cornerRadius: 11)) }.buttonStyle(.plain).disabled(selected.isEmpty).opacity(selected.isEmpty ? 0.5 : 1)
                    }
                }.padding(.horizontal, 14).padding(.vertical, 8).padding(.bottom, 24)
            }
        }
    }
    private var activeSession: some View {
        ZStack {
            CPBackdrop()
            ScrollView {
                VStack(spacing: 14) {
                    CPGlassCard(strong: true) {
                        HStack { Text("\(completedIDs.count) finished"); Spacer(); Text("\(Int((Double(duration * 60 - remaining) / Double(max(1, duration * 60))) * 100))% of session") }.font(.system(size: 12)).foregroundStyle(CPTheme.muted(scheme))
                        ZStack {
                            Circle().stroke(CPTheme.foreground(scheme).opacity(0.08), lineWidth: 10)
                            Circle().trim(from: 0, to: Double(duration * 60 - remaining) / Double(max(1, duration * 60))).stroke(CPTheme.primary(scheme: scheme), style: StrokeStyle(lineWidth: 10, lineCap: .round)).rotationEffect(.degrees(-90))
                            VStack(spacing: 6) { Text(String(format: "%02d:%02d", remaining / 60, remaining % 60)).font(.system(size: 38, weight: .regular)).tracking(-1.5).monospacedDigit(); Text(running ? "FOCUS TIME" : "PAUSED").font(.system(size: 10, weight: .regular)).tracking(1.4).foregroundStyle(CPTheme.muted(scheme)) }
                        }.frame(width: 180, height: 180).frame(maxWidth: .infinity).padding(.vertical, 8)
                        if !items.isEmpty { VStack(spacing: 5) { Text("NOW STUDYING").font(.system(size: 10, weight: .regular)).tracking(1.4).foregroundStyle(CPTheme.muted(scheme)); Text(items[min(currentIndex, items.count - 1)].name).font(.system(size: 17, weight: .regular)).multilineTextAlignment(.center); Text(items[min(currentIndex, items.count - 1)].courseName).font(.system(size: 11, weight: .regular)).foregroundStyle(CPTheme.muted(scheme)) }.frame(maxWidth: .infinity) }
                        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 8) { Button("Previous") { navigateTask(-1) }; Button(running ? "Pause" : "Resume") { running.toggle() }.buttonStyle(.borderedProminent); Button("Next") { navigateTask(1) }; Button("Finish task") { finishTask() }.disabled(items.isEmpty) }.font(.system(size: 11, weight: .regular)).frame(maxWidth: .infinity)
                    }
                    CPGlassCard(title: "Up next", subtitle: "\(completedIDs.count) of \(items.count) finished") { ForEach(items.indices, id: \.self) { index in let item = items[index]; Button { currentIndex = index } label: { CPInsetRow { HStack { Text("\(index + 1)").frame(width: 22); VStack(alignment: .leading) { Text(item.name).strikethrough(completedIDs.contains(item.id)); if !item.courseName.isEmpty { Text(item.courseName).font(.system(size: 10)).foregroundStyle(CPTheme.muted(scheme)) } }; Spacer(); if currentIndex == index { Image(systemName: "arrowtriangle.right.fill") }; if completedIDs.contains(item.id) { Image(systemName: "checkmark") } } } }.buttonStyle(.plain) } }
                    Button("End session", role: .destructive) { running = false; sessionFinished = true }.frame(maxWidth: .infinity)
                }.padding(.horizontal, 14).padding(.vertical, 8).padding(.bottom, 24)
            }
        }
    }

    private var summary: some View {
        ZStack { CPBackdrop(); ScrollView { VStack(spacing: 14) { CPGlassCard(title: "Session complete", subtitle: "\(completedIDs.count) of \(items.count) tasks finished") { Button("Plan another") { resetSession(keepSelection: true) }; Button("Dismiss") { resetSession(keepSelection: false) } } }.padding(14) } }
    }

    private func addManualTask() {
        let name = manualName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !name.isEmpty else { return }
        let id = -Int(Date().timeIntervalSince1970 * 1000)
        let item = AssignmentItem(id: id, name: name, description: nil, dueAt: nil, htmlURL: "", pointsPossible: nil, courseID: 0, courseName: "Personal task", courseCode: "", submission: nil)
        manualTasks.append(item); selected.insert(id); selectedOrder.append(id); manualName = ""
    }
    private func moveSelection(_ index: Int, _ direction: Int) { guard selectedOrder.indices.contains(index + direction) else { return }; selectedOrder.swapAt(index, index + direction) }
    private func navigateTask(_ direction: Int) { guard !items.isEmpty else { return }; currentIndex = (currentIndex + direction + items.count) % items.count }
    private func finishTask() { guard items.indices.contains(currentIndex) else { return }; completedIDs.insert(items[currentIndex].id); if completedIDs.count >= items.count { running = false; sessionFinished = true; UINotificationFeedbackGenerator().notificationOccurred(.success) } else { for step in 1...items.count { let next = (currentIndex + step) % items.count; if !completedIDs.contains(items[next].id) { currentIndex = next; break } } } }
    private func resetSession(keepSelection: Bool) { running = false; sessionFinished = false; sessionStarted = false; completedIDs.removeAll(); remaining = duration * 60; currentIndex = 0; if !keepSelection { selected.removeAll(); selectedOrder.removeAll(); manualTasks.removeAll() } }
}

extension AssignmentItem {
    var dueDate: Date? { dueAt.flatMap { ISO8601DateFormatter.canvasDate(from: $0) } }
    var isCanvasFinished: Bool {
        guard let submission else { return false }
        if submission.excused == true { return true }
        if submission.missing == true { return false }
        if submission.submittedAt != nil || submission.workflowState == "submitted" || submission.workflowState == "pending_review" { return true }
        return submission.workflowState == "graded" && (submission.score != nil || !(submission.grade ?? "").isEmpty)
    }
    var isStaleOverdue: Bool { dueDate.map { $0 < Date().addingTimeInterval(-86400) } ?? false }
    @MainActor func isFinished(in store: NativeContentStore) -> Bool { store.completed.contains(id) || isCanvasFinished }
    @MainActor func isVisible(in store: NativeContentStore, showCompleted: Bool = false) -> Bool {
        if isFinished(in: store) { return showCompleted }
        return !isStaleOverdue
    }
    static func dueSort(_ lhs: AssignmentItem, _ rhs: AssignmentItem) -> Bool { (lhs.dueDate ?? .distantFuture) < (rhs.dueDate ?? .distantFuture) }
}

extension AnnouncementItem {
    func isWithin(weeks: Int) -> Bool {
        if weeks == 0 { return true }
        guard let posted = ISO8601DateFormatter.canvasDate(from: postedAt) else { return true }
        return posted >= Date().addingTimeInterval(Double(-7 * weeks) * 86400)
    }
}

extension String {
    var strippingHTML: String {
        replacingOccurrences(of: "(?i)<br\\s*/?>|</p>|</div>|</li>|</h[1-6]>", with: "\n", options: .regularExpression)
            .replacingOccurrences(of: "<[^>]+>", with: "", options: .regularExpression)
            .replacingOccurrences(of: "&nbsp;", with: " ").replacingOccurrences(of: "&amp;", with: "&")
            .replacingOccurrences(of: "&lt;", with: "<").replacingOccurrences(of: "&gt;", with: ">")
            .replacingOccurrences(of: "&quot;", with: "\"").replacingOccurrences(of: "&#39;", with: "'")
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }
}

extension ISO8601DateFormatter {
    static let canvas: ISO8601DateFormatter = { let formatter = ISO8601DateFormatter(); formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]; return formatter }()
    static let canvasWithoutFractionalSeconds: ISO8601DateFormatter = { let formatter = ISO8601DateFormatter(); formatter.formatOptions = [.withInternetDateTime]; return formatter }()
    static func canvasDate(from value: String) -> Date? { canvas.date(from: value) ?? canvasWithoutFractionalSeconds.date(from: value) }
}

struct NativeEmptyState: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var appeared = false
    let title: String; let symbol: String; var detail: String? = nil
    var body: some View {
        VStack(spacing: 8) { Image(systemName: symbol).font(.system(size: 26)).foregroundStyle(Color.accentColor); Text(title).font(.system(size: 14, weight: .regular)); if let detail { Text(detail).font(.system(size: 12, weight: .regular)).foregroundStyle(.secondary).multilineTextAlignment(.center) } }
            .padding(12).frame(maxWidth: .infinity)
            .opacity(appeared ? 1 : 0)
            .offset(y: appeared || reduceMotion ? 0 : 5)
            .onAppear { withAnimation(reduceMotion ? nil : .easeOut(duration: 0.2)) { appeared = true } }
    }
}
