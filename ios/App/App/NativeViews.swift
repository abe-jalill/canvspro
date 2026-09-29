import SwiftUI
import Combine
import UserNotifications

struct NativeRootView: View {
    @StateObject private var sessionStore = NativeSessionStore()
    @AppStorage("CanvasProColorScheme") private var colorScheme = "system"
    @AppStorage("CanvasProPalette") private var palette = "forest"

    var body: some View {
        Group {
            NativeMainTabView(sessionStore: sessionStore, preview: true)
        }
        .font(.system(size: 13, weight: .regular))
        .fontWeight(.regular)
        .tint(CPTheme.primary(CPPalette(rawValue: palette) ?? .forest, scheme: colorScheme == "dark" ? .dark : colorScheme == "light" ? .light : UITraitCollection.current.userInterfaceStyle == .dark ? .dark : .light))
        .preferredColorScheme(colorScheme == "dark" ? .dark : colorScheme == "light" ? .light : nil)
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

private enum NativeTab: Hashable { case dashboard, assignments, study, grades, settings }

struct NativeMainTabView: View {
    @ObservedObject var sessionStore: NativeSessionStore
    let preview: Bool
    @StateObject private var contentStore: NativeContentStore
    @StateObject private var featureStore: NativeFeatureStore
    @State private var selection: NativeTab = .dashboard

    init(sessionStore: NativeSessionStore, preview: Bool = false) {
        self.sessionStore = sessionStore
        self.preview = preview
        _contentStore = StateObject(wrappedValue: NativeContentStore(sessionStore: sessionStore, preview: preview))
        _featureStore = StateObject(wrappedValue: NativeFeatureStore(sessionStore: sessionStore, preview: preview))
    }

    var body: some View {
        nativeTabs
            .task { async let content: Void = contentStore.load(); async let features: Void = featureStore.load(); _ = await (content, features) }
            .onReceive(NotificationCenter.default.publisher(for: .nativeDeviceToken)) { note in
                guard let deviceToken = note.object as? String else { return }
                Task { await registerDeviceToken(deviceToken) }
            }
            .onReceive(NotificationCenter.default.publisher(for: .nativeNotificationPath)) { note in
                guard let path = note.object as? String else { return }
                if path.contains("assignment") || path.contains("focus") || path.contains("get-it-done") { selection = .assignments }
                else if path.contains("grade") { selection = .grades }
                else if path.contains("study") { selection = .study }
                else if path.contains("notification") || path.contains("settings") || path.contains("schedule") || path.contains("announcement") { selection = .settings }
                else { selection = .dashboard }
            }
            .alert("CanvasPro", isPresented: Binding(get: { contentStore.errorMessage != nil || featureStore.errorMessage != nil }, set: { if !$0 { contentStore.errorMessage = nil; featureStore.errorMessage = nil } })) {
                Button("OK", role: .cancel) {}
            } message: { Text(contentStore.errorMessage ?? featureStore.errorMessage ?? "") }
    }

    private func registerDeviceToken(_ deviceToken: String) async {
        guard let api = sessionStore.api, let user = sessionStore.session?.user else { return }
        do {
            try await api.upsertPushToken(deviceToken, token: try await sessionStore.accessToken(), userID: user.id)
            UserDefaults.standard.set(deviceToken, forKey: "CanvasProNativePushToken")
        } catch { featureStore.errorMessage = error.localizedDescription }
    }

    @ViewBuilder private var nativeTabs: some View {
        if #available(iOS 26.0, *) { tabs.tabBarMinimizeBehavior(.onScrollDown) } else { tabs }
    }

    private var tabs: some View {
        TabView(selection: $selection) {
            NativeDashboardView(store: contentStore, features: featureStore).tabItem { Label("Dashboard", systemImage: "house.fill") }.tag(NativeTab.dashboard)
            NativeAssignmentsView(store: contentStore, features: featureStore).tabItem { Label("Assignments", systemImage: "checklist") }.tag(NativeTab.assignments)
            NativeStudyView(store: contentStore, features: featureStore).tabItem { Label("Study", systemImage: "timer") }.tag(NativeTab.study)
            NativeGradesView(store: contentStore, features: featureStore).tabItem { Label("Grades", systemImage: "chart.bar.fill") }.tag(NativeTab.grades)
            NativeSettingsView(sessionStore: sessionStore, contentStore: contentStore, features: featureStore).tabItem { Label("Settings", systemImage: "gearshape.fill") }.tag(NativeTab.settings)
        }
        .tabBarMinimizeBehavior(.onScrollDown)
    }
}

private struct NativeDashboardView: View {
    @Environment(\.colorScheme) private var scheme
    @ObservedObject var store: NativeContentStore
    @ObservedObject var features: NativeFeatureStore
    @AppStorage("NativeDashboardSummary") private var showSummary = true
    @AppStorage("NativeDashboardCourses") private var showCourses = true
    @AppStorage("NativeDashboardUpcoming") private var showUpcoming = true
    @AppStorage("NativeDashboardFocus") private var showFocus = true
    @AppStorage("NativeDashboardAnnouncements") private var showAnnouncements = true
    @AppStorage("NativeDashboardWorkload") private var showWorkload = true
    @AppStorage("CanvasProAnnouncementWeeks") private var announcementWeeks = 1
    private var visibleCourses: [CourseSummary] { store.bundle.courses.filter { !features.hiddenCourseIDs.contains($0.id) } }
    private var allAssignments: [AssignmentItem] {
        (store.bundle.assignments + features.customAssignments.map { item in .custom(item, course: store.bundle.courses.first { $0.id == item.courseID }) }).filter { !features.hiddenCourseIDs.contains($0.courseID) }
    }
    private var activeAssignments: [AssignmentItem] { allAssignments.filter { $0.isVisible(in: store) } }
    private var upcoming: [AssignmentItem] { Array(activeAssignments.sorted(by: AssignmentItem.dueSort).prefix(5)) }
    private var weekItems: [AssignmentItem] { activeAssignments.filter { ($0.dueDate ?? .distantFuture) <= Date().addingTimeInterval(7 * 86400) } }
    private var todayCount: Int { weekItems.filter { ($0.dueDate ?? .distantFuture) <= Date().addingTimeInterval(86400) && ($0.dueDate ?? .distantFuture) >= Date() }.count }
    private var overdueCount: Int { activeAssignments.filter { ($0.dueDate ?? .distantFuture) < Date() }.count }
    private var greeting: String { let hour = Calendar.current.component(.hour, from: Date()); return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening" }
    private var studentName: String { let value = features.profile.username?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""; return value.isEmpty ? "Preview Student" : value }

    var body: some View {
        NavigationStack {
            ZStack {
                CPBackdrop()
                ScrollView {
                    LazyVStack(spacing: 12) {
                        dashboardHero
                        HStack {
                            VStack(alignment: .leading, spacing: 3) {
                                Text("Your dashboard").font(.system(size: 16, weight: .regular)).foregroundStyle(CPTheme.foreground(scheme))
                                Text("Your classes, deadlines, and updates.").font(.system(size: 11, weight: .regular)).foregroundStyle(CPTheme.muted(scheme))
                            }
                            Spacer()
                            NavigationLink { DashboardCustomizationView() } label: { Label("Customize dashboard", systemImage: "slider.horizontal.3").labelStyle(.iconOnly).foregroundStyle(CPTheme.muted(scheme)).frame(width: 40, height: 40).background(CPTheme.inset(scheme), in: RoundedRectangle(cornerRadius: 12)).overlay(RoundedRectangle(cornerRadius: 12).stroke(CPTheme.insetBorder(scheme))) }.buttonStyle(.plain)
                        }.padding(.horizontal, 3)

                        if showSummary { CPGlassCard(title: "Since your last visit", subtitle: "A quick look at what changed", strong: true) {
                            LazyVGrid(columns: metricColumns, spacing: 8) { MetricTile(value: "\(visibleCourses.count)", label: "Classes"); MetricTile(value: "\(weekItems.count)", label: "Upcoming"); MetricTile(value: "\(store.completed.count)", label: "Done") }
                        } }

                        if showCourses { CPGlassCard(title: "Classes & Grades", subtitle: "Active enrollments") {
                            VStack(spacing: 8) {
                                ForEach(visibleCourses) { course in
                                    NavigationLink { CourseDetailView(course: course, store: store) } label: { CPInsetRow { CourseRow(course: course, store: store) } }.buttonStyle(.plain)
                                }
                            }
                        } }

                        if showUpcoming { CPGlassCard(title: "Upcoming Assignments", subtitle: "Due within the next 7 days") {
                            VStack(spacing: 8) {
                                if upcoming.isEmpty { NativeEmptyState(title: "You’re caught up", symbol: "checkmark.circle") }
                                ForEach(upcoming) { assignment in CPInsetRow { NativeAssignmentRow(assignment: assignment, store: store) } }
                            }
                        } }

                        if showFocus { CPGlassCard(title: "Focus", subtitle: "Due within 48 hours") {
                            VStack(spacing: 8) {
                                ForEach(weekItems.filter { ($0.dueDate ?? .distantFuture) <= Date().addingTimeInterval(2 * 86400) }.prefix(3)) { assignment in CPInsetRow { NativeAssignmentRow(assignment: assignment, store: store) } }
                            }
                        } }

                        if showAnnouncements { CPGlassCard(title: "Announcements", subtitle: "Latest from your courses") {
                            VStack(spacing: 8) {
                                ForEach(store.bundle.announcements.filter { !features.hiddenCourseIDs.contains($0.courseID) && $0.isWithin(weeks: announcementWeeks) }.prefix(3)) { item in NavigationLink { AnnouncementDetailView(item: item) } label: { CPInsetRow { VStack(alignment: .leading, spacing: 3) { Text(item.title).font(.system(size: 13, weight: .regular)); Text(item.courseName).font(.system(size: 10, weight: .regular)).foregroundStyle(CPTheme.muted(scheme)); Text(item.message.strippingHTML).font(.system(size: 11, weight: .regular)).foregroundStyle(CPTheme.muted(scheme)).lineLimit(2) } } }.buttonStyle(.plain) }
                            }
                        } }

                        if showWorkload { CPGlassCard(title: "Workload", subtitle: "Assignment density this week") { WorkloadView(assignments: activeAssignments) } }
                    }.padding(.horizontal, 14).padding(.top, 6).padding(.bottom, 24)
                }
            }
            .navigationTitle("Dashboard").navigationBarTitleDisplayMode(.inline)
            .refreshable { async let a: Void = store.load(); async let b: Void = features.load(); _ = await (a, b) }
        }
    }

    private var dashboardHero: some View {
        VStack(alignment: .leading, spacing: 12) {
            Label(Date().formatted(.dateTime.weekday(.wide).month(.wide).day()), systemImage: "calendar").font(.system(size: 10, weight: .regular)).tracking(1.4).textCase(.uppercase).foregroundStyle(CPTheme.muted(scheme))
            Text("\(greeting), \(studentName).").font(.system(size: 24, weight: .regular)).tracking(-0.6).foregroundStyle(CPTheme.foreground(scheme))
            Text(heroMessage).font(.system(size: 12, weight: .regular)).foregroundStyle(CPTheme.muted(scheme)).lineSpacing(2).lineLimit(2)
            HStack(spacing: 8) {
                heroStat(value: weekItems.count, label: "7 days", symbol: "calendar")
                heroStat(value: todayCount, label: "24 hours", symbol: "clock")
                heroStat(value: overdueCount, label: "Overdue", symbol: "exclamationmark.triangle", danger: overdueCount > 0)
            }
            NavigationLink { FocusView(store: store, features: features) } label: { Label("Open focus", systemImage: "arrow.up.right").font(.system(size: 11, weight: .regular)).padding(.horizontal, 12).frame(minHeight: 34).background(LinearGradient(colors: [CPTheme.primary(scheme: scheme).opacity(0.20), CPTheme.primary(scheme: scheme).opacity(0.07)], startPoint: .topLeading, endPoint: .bottomTrailing), in: Capsule()).overlay(Capsule().stroke(CPTheme.primary(scheme: scheme).opacity(0.45))) }.buttonStyle(.plain)
        }
        .padding(14)
        .background(heroBackground, in: RoundedRectangle(cornerRadius: 24, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 24, style: .continuous).stroke(CPTheme.primary(scheme: scheme).opacity(scheme == .dark ? 0.28 : 0.22), lineWidth: 1))
        .shadow(color: Color.black.opacity(scheme == .dark ? 0.30 : 0.08), radius: 20, y: 10)
    }

    private var metricColumns: [GridItem] { [GridItem(.flexible(minimum: 0), spacing: 8), GridItem(.flexible(minimum: 0), spacing: 8)] }

    private var heroMessage: String {
        if overdueCount > 0 { return "\(overdueCount) past-due item\(overdueCount == 1 ? " needs" : "s need") attention, with \(weekItems.count) ahead this week." }
        if todayCount > 0 { return "\(todayCount) assignment\(todayCount == 1 ? " is" : "s are") due in the next 24 hours. Everything else can wait." }
        if !weekItems.isEmpty { return "Today is clear. \(weekItems.count) item\(weekItems.count == 1 ? " is" : "s are") coming up over the next seven days." }
        return "Your next seven days are clear. Take the win."
    }

    private var heroBackground: LinearGradient {
        let palette = CPTheme.currentPalette
        return LinearGradient(colors: scheme == .dark ? [.hsl(palette.hue, palette.saturation, 0.19), .hsl(palette.hue, palette.saturation, 0.13), .hsl(palette.hue, palette.saturation, 0.08)] : [.hsl(palette.hue, palette.saturation, 0.97), .hsl(palette.hue, palette.saturation, 0.88)], startPoint: .topLeading, endPoint: .bottomTrailing)
    }

    private func heroStat(value: Int, label: String, symbol: String, danger: Bool = false) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack { Image(systemName: symbol).font(.system(size: 13)); Spacer(); Text("\(value)").font(.system(size: 18, weight: .regular)).tracking(-0.5).monospacedDigit() }
            Text(label).font(.system(size: 10, weight: .regular)).foregroundStyle(CPTheme.muted(scheme)).lineLimit(1).minimumScaleFactor(0.75)
        }.foregroundStyle(danger ? CPTheme.danger : CPTheme.foreground(scheme)).padding(9).frame(maxWidth: .infinity, minHeight: 64).heroStatSurface(scheme: scheme)
    }
}

private extension View {
    func heroStatSurface(scheme: ColorScheme) -> some View {
        let palette = CPTheme.currentPalette
        return background(LinearGradient(colors: scheme == .dark ? [.hsl(palette.hue, palette.saturation, 0.23), .hsl(palette.hue, palette.saturation, 0.16), .hsl(palette.hue, palette.saturation, 0.11)] : [.hsl(palette.hue, palette.saturation, 0.98), .hsl(palette.hue, palette.saturation, 0.92)], startPoint: .topLeading, endPoint: .bottomTrailing), in: RoundedRectangle(cornerRadius: 20, style: .continuous)).overlay(RoundedRectangle(cornerRadius: 20).stroke(CPTheme.primary(scheme: scheme).opacity(scheme == .dark ? 0.30 : 0.23)))
    }
}

private struct MetricTile: View {
    @Environment(\.colorScheme) private var scheme
    let value: String; let label: String
    var body: some View { VStack(spacing: 3) { Text(value).font(.system(size: 19, weight: .regular)).monospacedDigit(); Text(label).font(.system(size: 10, weight: .regular)).foregroundStyle(CPTheme.muted(scheme)) }.padding(.vertical, 10).frame(maxWidth: .infinity).background(CPTheme.foreground(scheme).opacity(0.045), in: RoundedRectangle(cornerRadius: 13)).overlay(RoundedRectangle(cornerRadius: 13).stroke(CPTheme.border(scheme), lineWidth: 1)) }
}

private struct DashboardCustomizationView: View {
    @AppStorage("NativeDashboardSummary") private var showSummary = true
    @AppStorage("NativeDashboardCourses") private var showCourses = true
    @AppStorage("NativeDashboardUpcoming") private var showUpcoming = true
    @AppStorage("NativeDashboardFocus") private var showFocus = true
    @AppStorage("NativeDashboardAnnouncements") private var showAnnouncements = true
    @AppStorage("NativeDashboardWorkload") private var showWorkload = true

    var body: some View {
        Form {
            Section("Dashboard widgets") {
                Toggle("Summary", isOn: $showSummary)
                Toggle("Classes & Grades", isOn: $showCourses)
                Toggle("Upcoming Assignments", isOn: $showUpcoming)
                Toggle("Focus", isOn: $showFocus)
                Toggle("Announcements", isOn: $showAnnouncements)
                Toggle("Workload", isOn: $showWorkload)
            }
            Section { Text("Choose what appears on your dashboard. These choices are saved on this iPhone.").foregroundStyle(.secondary) }
        }.cpListScreen().navigationTitle("Customize Dashboard")
    }
}

private enum AssignmentFilter: String, CaseIterable { case upcoming = "Upcoming", all = "All", missing = "Missing", completed = "Completed" }

private struct NativeAssignmentsView: View {
    @Environment(\.colorScheme) private var scheme
    @ObservedObject var store: NativeContentStore
    @ObservedObject var features: NativeFeatureStore
    @State private var search = ""
    @State private var filter: AssignmentFilter = .upcoming
    @State private var courseID: Int?
    @State private var showAdd = false

    private var visibleCourses: [CourseSummary] { store.bundle.courses.filter { !features.hiddenCourseIDs.contains($0.id) } }
    private var allAssignments: [AssignmentItem] { (store.bundle.assignments + features.customAssignments.map { item in AssignmentItem.custom(item, course: store.bundle.courses.first { $0.id == item.courseID }) }).filter { !features.hiddenCourseIDs.contains($0.courseID) } }
    private var remaining: [AssignmentItem] { allAssignments.filter { $0.isVisible(in: store) } }
    private var overdueCount: Int { remaining.filter { ($0.dueDate ?? .distantFuture) < Date() }.count }
    private var weekCount: Int { remaining.filter { guard let due = $0.dueDate else { return false }; return due >= Date() && due <= Date().addingTimeInterval(7 * 86400) }.count }

    private var assignments: [AssignmentItem] {
        return allAssignments.filter { item in
            let matches = search.isEmpty || item.name.localizedCaseInsensitiveContains(search) || item.courseName.localizedCaseInsensitiveContains(search)
            let courseMatches = courseID == nil || item.courseID == courseID
            let stateMatches: Bool
            switch filter {
            case .all: stateMatches = item.isVisible(in: store)
            case .upcoming: stateMatches = item.isVisible(in: store) && (item.dueDate == nil || item.dueDate! >= Date())
            case .missing: stateMatches = item.isVisible(in: store) && (item.submission?.missing == true || (item.dueDate ?? .distantFuture) < Date())
            case .completed: stateMatches = item.isFinished(in: store)
            }
            return matches && courseMatches && stateMatches
        }.sorted(by: AssignmentItem.dueSort)
    }

    var body: some View {
        NavigationStack {
            ZStack {
                CPBackdrop()
                ScrollView {
                    LazyVStack(spacing: 14) {
                        assignmentsHero
                        CPGlassCard(title: "Priority Assignments", subtitle: "Smart ordering by deadline and weight") {
                            HStack(alignment: .top, spacing: 10) { Image(systemName: "sparkles").font(.system(size: 13)).foregroundStyle(CPTheme.foreground(scheme).opacity(0.8)).frame(width: 28, height: 28).background(CPTheme.foreground(scheme).opacity(0.10), in: RoundedRectangle(cornerRadius: 8)); Text(prioritySummary).font(.system(size: 12, weight: .regular)).foregroundStyle(CPTheme.foreground(scheme).opacity(0.90)).lineSpacing(2) }
                            VStack(spacing: 8) { ForEach(remaining.sorted(by: AssignmentItem.dueSort).prefix(5)) { item in CPInsetRow { NativeAssignmentRow(assignment: item, store: store) } } }
                        }
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 8) { ForEach(AssignmentFilter.allCases, id: \.self) { option in Button { filter = option } label: { CPChip(text: option.rawValue, selected: filter == option) }.buttonStyle(.plain) } }
                        }
                        CPGlassCard(strong: true) {
                            Picker("Class", selection: $courseID) { Text("All classes").tag(Int?.none); ForEach(visibleCourses) { Text(store.displayName(courseID: $0.id, fallback: $0.name)).tag(Optional($0.id)) } }.pickerStyle(.menu).tint(CPTheme.foreground(scheme))
                        }
                        if assignments.isEmpty && !store.isLoading { CPGlassCard { NativeEmptyState(title: search.isEmpty ? "No assignments" : "No matches", symbol: "magnifyingglass") } }
                        ForEach(assignments) { item in
                            NavigationLink { AssignmentDetailView(assignment: item, store: store, features: features) } label: { CPGlassCard { NativeAssignmentRow(assignment: item, store: store) } }.buttonStyle(.plain)
                        }
                    }.padding(.horizontal, 15).padding(.vertical, 10).padding(.bottom, 24)
                }
            }
            .navigationTitle("Assignments").navigationBarTitleDisplayMode(.inline).searchable(text: $search, prompt: "Assignment or class")
            .toolbar { Button { showAdd = true } label: { Image(systemName: "plus") } }
            .sheet(isPresented: $showAdd) { AddAssignmentView(courses: visibleCourses, features: features) }
            .refreshable { async let a: Void = store.load(); async let b: Void = features.load(); _ = await (a, b) }
        }
    }

    private var assignmentsHero: some View {
        CPGlassCard(strong: true) {
            VStack(alignment: .leading, spacing: 14) {
                Image(systemName: "checklist").font(.system(size: 16)).foregroundStyle(CPTheme.primary(scheme: scheme)).frame(width: 36, height: 36).background(CPTheme.primary(scheme: scheme).opacity(0.15), in: RoundedRectangle(cornerRadius: 12))
                Text("COMPLETE WORKLOAD").font(.system(size: 10, weight: .regular)).tracking(1.7).foregroundStyle(CPTheme.muted(scheme))
                Text("One agenda. Every assignment.").font(.system(size: 28, weight: .regular)).tracking(-0.8)
                Text("Work is ordered by urgency across every class, so the next deadline is always obvious.").font(.system(size: 12, weight: .regular)).foregroundStyle(CPTheme.muted(scheme)).lineSpacing(2)
                LazyVGrid(columns: [GridItem(.flexible(minimum: 0), spacing: 8), GridItem(.flexible(minimum: 0), spacing: 8)], spacing: 8) { workloadMetric(remaining.count, "Remaining"); workloadMetric(overdueCount, "Overdue", color: CPTheme.danger); workloadMetric(weekCount, "This week", color: CPTheme.primary(scheme: scheme)) }
            }
        }.overlay(alignment: .topTrailing) { Circle().fill(CPTheme.primary(scheme: scheme).opacity(0.15)).frame(width: 280, height: 280).blur(radius: 70).offset(x: 100, y: -100).allowsHitTesting(false) }
    }

    private func workloadMetric(_ value: Int, _ label: String, color: Color? = nil) -> some View { VStack(alignment: .leading, spacing: 3) { Text("\(value)").font(.system(size: 21, weight: .regular)).tracking(-0.6).monospacedDigit().foregroundStyle(color ?? CPTheme.foreground(scheme)); Text(label).font(.system(size: 10, weight: .regular)).foregroundStyle(CPTheme.muted(scheme)) }.padding(10).frame(maxWidth: .infinity, alignment: .leading).background((color ?? CPTheme.foreground(scheme)).opacity(0.06), in: RoundedRectangle(cornerRadius: 14)).overlay(RoundedRectangle(cornerRadius: 14).stroke((color ?? CPTheme.foreground(scheme)).opacity(0.10))) }
    private var prioritySummary: String { overdueCount > 0 ? "Start with overdue work, then move through the nearest deadlines." : weekCount > 0 ? "Your nearest deadlines are collected here so you always know what to start next." : "Nothing urgent right now. Your remaining work is still listed below." }
}

struct NativeAssignmentRow: View {
    @Environment(\.colorScheme) private var scheme
    let assignment: AssignmentItem
    @ObservedObject var store: NativeContentStore
    private var isComplete: Bool { assignment.isFinished(in: store) }
    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Button { Task { await store.toggle(assignment) } } label: { Image(systemName: isComplete ? "checkmark.square.fill" : "square").font(.system(size: 17)).foregroundStyle(isComplete ? CPTheme.primary(scheme: scheme) : CPTheme.muted(scheme)) }.buttonStyle(.plain).disabled(assignment.isCanvasFinished)
            VStack(alignment: .leading, spacing: 4) {
                Text(assignment.name).font(.system(size: 14, weight: .regular)).strikethrough(isComplete).fixedSize(horizontal: false, vertical: true)
                Text(store.displayName(courseID: assignment.courseID, fallback: assignment.courseName)).font(.system(size: 12, weight: .regular)).foregroundStyle(CPTheme.muted(scheme)).fixedSize(horizontal: false, vertical: true)
                if let date = assignment.dueDate { Text(date, format: .dateTime.month().day().hour().minute()).font(.caption).foregroundStyle(date < Date() && !isComplete ? CPTheme.danger : CPTheme.muted(scheme)) }
                HStack(spacing: 8) {
                    if assignment.submission?.missing == true { Label("Missing", systemImage: "exclamationmark.triangle.fill").foregroundStyle(.red) }
                    if assignment.submission?.late == true { Text("Late").foregroundStyle(.orange) }
                    if let points = assignment.pointsPossible { Text("\(points.formatted()) pts") }
                }.font(.caption2)
            }.frame(maxWidth: .infinity, alignment: .leading)
        }.padding(.vertical, 3)
    }
}

private struct AssignmentDetailView: View {
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
    @ObservedObject var store: NativeContentStore
    @ObservedObject var features: NativeFeatureStore
    @State private var search = ""
    private var courses: [CourseSummary] { store.bundle.courses.filter { course in !features.hiddenCourseIDs.contains(course.id) && (search.isEmpty || store.displayName(courseID: course.id, fallback: course.name).localizedCaseInsensitiveContains(search) || course.courseCode.localizedCaseInsensitiveContains(search) || store.bundle.assignments.contains { $0.courseID == course.id && $0.name.localizedCaseInsensitiveContains(search) }) } }
    private var scored: [CourseSummary] { courses.filter { $0.currentScore != nil } }
    private var average: Double? { scored.isEmpty ? nil : scored.compactMap(\.currentScore).reduce(0, +) / Double(scored.count) }
    private var gradedAssignments: Int { store.bundle.assignments.filter { !features.hiddenCourseIDs.contains($0.courseID) && ($0.submission?.score != nil || $0.submission?.grade != nil) }.count }
    var body: some View {
        NavigationStack {
            ZStack {
                CPBackdrop()
                ScrollView {
                    LazyVStack(spacing: 14) {
                        gradesHero
                        ForEach(courses) { course in NavigationLink { CourseDetailView(course: course, store: store) } label: { CPGlassCard { CourseRow(course: course, store: store) } }.buttonStyle(.plain) }
                        NavigationLink { GradeCalculatorView() } label: { CPGlassCard(title: "What-if grade calculator", subtitle: "Plan the score you need") { Label("Open calculator", systemImage: "function").font(.system(size: 12, weight: .regular)).foregroundStyle(Color.accentColor) } }.buttonStyle(.plain)
                        if courses.isEmpty && !store.isLoading { CPGlassCard { NativeEmptyState(title: search.isEmpty ? "No grades yet" : "No matching grades", symbol: "chart.bar") } }
                    }.padding(.horizontal, 15).padding(.vertical, 10).padding(.bottom, 24)
                }
            }
            .navigationTitle("Grades").navigationBarTitleDisplayMode(.inline).searchable(text: $search, prompt: "Course or assignment").refreshable { await store.load() }
        }
    }

    private var gradesHero: some View {
        CPGlassCard(strong: true) {
            VStack(alignment: .leading, spacing: 14) {
                Image(systemName: "chart.bar.xaxis").font(.system(size: 16)).foregroundStyle(CPTheme.primary(scheme: scheme)).frame(width: 36, height: 36).background(CPTheme.primary(scheme: scheme).opacity(0.15), in: RoundedRectangle(cornerRadius: 12))
                Text("ACADEMIC PERFORMANCE").font(.system(size: 10, weight: .regular)).tracking(1.7).foregroundStyle(CPTheme.muted(scheme))
                Text("Your semester, at a glance.").font(.system(size: 28, weight: .regular)).tracking(-0.8)
                Text("Compare courses, spot movement, and open the details only when you need them.").font(.system(size: 12, weight: .regular)).foregroundStyle(CPTheme.muted(scheme)).lineSpacing(2)
                VStack(alignment: .leading, spacing: 2) { Text("CURRENT AVERAGE").font(.system(size: 10, weight: .regular)).tracking(1.4).foregroundStyle(CPTheme.muted(scheme)); HStack(alignment: .bottom, spacing: 3) { Text(average.map { String(format: "%.1f", $0) } ?? "—").font(.system(size: 42, weight: .regular)).tracking(-2.2).foregroundStyle(gradeColor(average)); if average != nil { Text("%").font(.system(size: 14, weight: .regular)).foregroundStyle(CPTheme.muted(scheme)).padding(.bottom, 6) } } }
                Divider().overlay(CPTheme.foreground(scheme).opacity(0.10))
                LazyVGrid(columns: [GridItem(.flexible(minimum: 0), spacing: 8), GridItem(.flexible(minimum: 0), spacing: 8)], spacing: 12) { gradeMetric("\(scored.count)", "Courses graded"); gradeMetric("0", "Trending up", accent: true); gradeMetric("\(gradedAssignments)", "Grades posted") }
            }
        }.overlay(alignment: .topTrailing) { Circle().fill(CPTheme.primary(scheme: scheme).opacity(0.15)).frame(width: 280, height: 280).blur(radius: 70).offset(x: 100, y: -100).allowsHitTesting(false) }
    }

    private func gradeMetric(_ value: String, _ label: String, accent: Bool = false) -> some View { VStack(alignment: .leading, spacing: 4) { Text(value).font(.system(size: 17, weight: .regular)).foregroundStyle(accent ? CPTheme.primary(scheme: scheme) : CPTheme.foreground(scheme)); Text(label).font(.system(size: 10, weight: .regular)).foregroundStyle(CPTheme.muted(scheme)).lineLimit(1).minimumScaleFactor(0.75) }.padding(.horizontal, 8).frame(maxWidth: .infinity, alignment: .leading) }
    private func gradeColor(_ score: Double?) -> Color { guard let score else { return CPTheme.muted(scheme) }; return score >= 90 ? CPTheme.primary(scheme: scheme) : score >= 80 ? .cyan : score >= 70 ? CPTheme.warning : CPTheme.danger }
}

struct CourseRow: View {
    @Environment(\.colorScheme) private var scheme
    let course: CourseSummary; @ObservedObject var store: NativeContentStore
    var body: some View { HStack(spacing: 10) { Circle().fill(gradeColor).frame(width: 8, height: 8).shadow(color: gradeColor.opacity(0.6), radius: 4); VStack(alignment: .leading, spacing: 3) { Text(store.displayName(courseID: course.id, fallback: course.name)).font(.system(size: 14, weight: .regular)).lineLimit(2); Text(course.courseCode).font(.system(size: 11, weight: .regular)).foregroundStyle(CPTheme.muted(scheme)).lineLimit(1) }.frame(maxWidth: .infinity, alignment: .leading); VStack(alignment: .trailing) { Text(course.currentGrade ?? "—").font(.system(size: 16, weight: .regular)).foregroundStyle(gradeColor); if let score = course.currentScore { Text("\(score.formatted(.number.precision(.fractionLength(1))))%").font(.system(size: 11, weight: .regular)).foregroundStyle(CPTheme.muted(scheme)) } }.fixedSize(horizontal: true, vertical: false) }.padding(.vertical, 2) }
    private var gradeColor: Color { guard let score = course.currentScore else { return CPTheme.muted(scheme) }; return score >= 90 ? Color.accentColor : score >= 80 ? .cyan : score >= 70 ? CPTheme.warning : CPTheme.danger }
}

struct CourseDetailView: View {
    let course: CourseSummary; @ObservedObject var store: NativeContentStore
    @State private var showCompleted = false
    @AppStorage("CanvasProAnnouncementWeeks") private var announcementWeeks = 1
    private var assignments: [AssignmentItem] { store.bundle.assignments.filter { $0.courseID == course.id && $0.isVisible(in: store, showCompleted: showCompleted) }.sorted(by: AssignmentItem.dueSort) }
    var body: some View { List { Section("Current grade") { CourseRow(course: course, store: store); if let final = course.finalScore { LabeledContent("Final score", value: "\(final.formatted())%") } }; Section("Assignments") { Toggle("Show completed", isOn: $showCompleted); ForEach(assignments) { assignment in NativeAssignmentRow(assignment: assignment, store: store) } }; Section("Announcements") { ForEach(store.bundle.announcements.filter { $0.courseID == course.id && $0.isWithin(weeks: announcementWeeks) }) { announcement in NavigationLink(announcement.title) { AnnouncementDetailView(item: announcement) } } } }.cpListScreen().navigationTitle(store.displayName(courseID: course.id, fallback: course.name)).navigationBarTitleDisplayMode(.inline) }
}

private struct GradeCalculatorView: View {
    @State private var current = 85.0; @State private var currentWeight = 75.0; @State private var target = 90.0
    private var needed: Double { guard currentWeight < 100 else { return target }; return (target - current * currentWeight / 100) / ((100 - currentWeight) / 100) }
    var body: some View { Form { Section("Current course") { LabeledContent("Current score", value: current.formatted()); Slider(value: $current, in: 0...100); LabeledContent("Work already graded", value: "\(Int(currentWeight))%"); Slider(value: $currentWeight, in: 1...99) }; Section("Goal") { LabeledContent("Target grade", value: "\(Int(target))%"); Slider(value: $target, in: 0...100) }; Section("Result") { Text(needed > 100 ? "You would need \(needed.formatted(.number.precision(.fractionLength(1))))% on remaining work." : "Average \(needed.formatted(.number.precision(.fractionLength(1))))% on remaining work to finish at your target.") } }.cpListScreen().navigationTitle("Grade Calculator") }
}

private struct StoredNativeStudySession: Codable {
    let selected: [Int]
    let duration: Int
    let remaining: Int
    let running: Bool
    let currentIndex: Int
    let savedAt: Date
}

private struct NativeStudyView: View {
    @Environment(\.colorScheme) private var scheme
    @ObservedObject var store: NativeContentStore
    @ObservedObject var features: NativeFeatureStore
    @State private var selected: Set<Int>; @State private var duration: Int; @State private var remaining: Int; @State private var running: Bool; @State private var currentIndex: Int; @State private var showCompleted = false
    private let timer = Timer.publish(every: 1, on: .main, in: .common).autoconnect()
    private let sessionKey = "CanvasProPreviewStudySession"
    private var availableItems: [AssignmentItem] { (store.bundle.assignments + features.customAssignments.map { item in AssignmentItem.custom(item, course: store.bundle.courses.first { $0.id == item.courseID }) }).filter { !features.hiddenCourseIDs.contains($0.courseID) } }
    private var items: [AssignmentItem] { availableItems.filter { selected.contains($0.id) }.sorted(by: AssignmentItem.dueSort) }

    init(store: NativeContentStore, features: NativeFeatureStore) {
        self.store = store; self.features = features
        let key = "CanvasProPreviewStudySession"
        let saved = UserDefaults.standard.data(forKey: key).flatMap { try? JSONDecoder().decode(StoredNativeStudySession.self, from: $0) }
        let elapsed = saved?.running == true ? max(0, Int(Date().timeIntervalSince(saved?.savedAt ?? Date()))) : 0
        let restoredRemaining = max(0, (saved?.remaining ?? 25 * 60) - elapsed)
        _selected = State(initialValue: Set(saved?.selected ?? []))
        _duration = State(initialValue: saved?.duration ?? 25)
        _remaining = State(initialValue: restoredRemaining)
        _running = State(initialValue: saved?.running == true && restoredRemaining > 0)
        _currentIndex = State(initialValue: saved?.currentIndex ?? 0)
    }

    var body: some View {
        NavigationStack {
            Group { if running || remaining != duration * 60 { activeSession } else { setup } }
                .navigationTitle("Study Session")
                .onReceive(timer) { _ in guard running, remaining > 0 else { return }; remaining -= 1; if remaining == 0 { running = false; UINotificationFeedbackGenerator().notificationOccurred(.success) } }
                .onChange(of: selected) { _, _ in persistSession() }
                .onChange(of: duration) { _, _ in persistSession() }
                .onChange(of: remaining) { _, _ in persistSession() }
                .onChange(of: running) { _, _ in persistSession() }
                .onChange(of: currentIndex) { _, _ in persistSession() }
        }
    }

    private func persistSession() {
        let value = StoredNativeStudySession(selected: Array(selected), duration: duration, remaining: remaining, running: running, currentIndex: currentIndex, savedAt: Date())
        if let data = try? JSONEncoder().encode(value) { UserDefaults.standard.set(data, forKey: sessionKey) }
    }
    private var setup: some View {
        ZStack {
            CPBackdrop()
            ScrollView {
                LazyVStack(spacing: 14) {
                    CPPageHeader(eyebrow: "Study Session", title: "Build a focused session.", detail: "Choose the work, set a finish line, and let CanvasPro hold your place—even if you close the app.")
                    CPGlassCard(title: "1 · Choose your focus", subtitle: "Select Canvas work or add one task of your own.") {
                        Toggle("Show completed", isOn: $showCompleted).font(.system(size: 12, weight: .regular))
                        VStack(spacing: 8) { ForEach(availableItems.filter { $0.isVisible(in: store, showCompleted: showCompleted) }.sorted(by: AssignmentItem.dueSort)) { item in Button { if selected.contains(item.id) { selected.remove(item.id) } else { selected.insert(item.id) } } label: { CPInsetRow { HStack(spacing: 10) { Image(systemName: selected.contains(item.id) ? "checkmark.square.fill" : "square").foregroundStyle(selected.contains(item.id) ? CPTheme.primary(scheme: scheme) : CPTheme.muted(scheme)); VStack(alignment: .leading, spacing: 3) { Text(item.name).font(.system(size: 13, weight: .regular)); Text(item.courseName).font(.system(size: 11, weight: .regular)).foregroundStyle(CPTheme.muted(scheme)) }; Spacer() } } }.buttonStyle(.plain) } }
                    }
                    CPGlassCard(title: "2 · Set a finish line", subtitle: "Pick a focused amount of time.", strong: true) {
                        VStack(spacing: 2) { Text("\(duration)").font(.system(size: 32, weight: .regular)).tracking(-1).monospacedDigit(); Text("MINUTES").font(.system(size: 10, weight: .regular)).tracking(1.4).foregroundStyle(CPTheme.muted(scheme)) }.frame(maxWidth: .infinity).padding(.vertical, 12).background(CPTheme.foreground(scheme).opacity(0.05), in: RoundedRectangle(cornerRadius: 14))
                        LazyVGrid(columns: [GridItem(.flexible(minimum: 0), spacing: 8), GridItem(.flexible(minimum: 0), spacing: 8)], spacing: 8) { ForEach([15, 25, 45, 60], id: \.self) { value in Button { duration = value; remaining = value * 60 } label: { CPChip(text: "\(value)m", selected: duration == value).frame(maxWidth: .infinity) }.buttonStyle(.plain) } }
                        Button { remaining = duration * 60; running = true } label: { Label("Start session", systemImage: "timer").font(.system(size: 13, weight: .regular)).frame(maxWidth: .infinity, minHeight: 42).foregroundStyle(CPTheme.background(scheme)).background(CPTheme.foreground(scheme), in: RoundedRectangle(cornerRadius: 11)) }.buttonStyle(.plain).disabled(selected.isEmpty).opacity(selected.isEmpty ? 0.5 : 1)
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
                    CPPageHeader(eyebrow: "Study Session", title: "One thing at a time.", detail: "The plan stays out of the way while you focus on the assignment in front of you.")
                    CPGlassCard(strong: true) {
                        HStack { Text("0 finished"); Spacer(); Text("\(Int((Double(duration * 60 - remaining) / Double(max(1, duration * 60))) * 100))% of session") }.font(.system(size: 12)).foregroundStyle(CPTheme.muted(scheme))
                        ZStack {
                            Circle().stroke(CPTheme.foreground(scheme).opacity(0.08), lineWidth: 10)
                            Circle().trim(from: 0, to: Double(duration * 60 - remaining) / Double(max(1, duration * 60))).stroke(CPTheme.primary(scheme: scheme), style: StrokeStyle(lineWidth: 10, lineCap: .round)).rotationEffect(.degrees(-90))
                            VStack(spacing: 6) { Text(String(format: "%02d:%02d", remaining / 60, remaining % 60)).font(.system(size: 38, weight: .regular)).tracking(-1.5).monospacedDigit(); Text(running ? "FOCUS TIME" : "PAUSED").font(.system(size: 10, weight: .regular)).tracking(1.4).foregroundStyle(CPTheme.muted(scheme)) }
                        }.frame(width: 180, height: 180).frame(maxWidth: .infinity).padding(.vertical, 8)
                        if !items.isEmpty { VStack(spacing: 5) { Text("NOW STUDYING").font(.system(size: 10, weight: .regular)).tracking(1.4).foregroundStyle(CPTheme.muted(scheme)); Text(items[min(currentIndex, items.count - 1)].name).font(.system(size: 17, weight: .regular)).multilineTextAlignment(.center); Text(items[min(currentIndex, items.count - 1)].courseName).font(.system(size: 11, weight: .regular)).foregroundStyle(CPTheme.muted(scheme)) }.frame(maxWidth: .infinity) }
                        HStack { Button(running ? "Pause" : "Resume") { running.toggle() }.buttonStyle(.borderedProminent); Button("Next") { if !items.isEmpty { currentIndex = (currentIndex + 1) % items.count } }.buttonStyle(.bordered) }.frame(maxWidth: .infinity)
                        Button("End session", role: .destructive) { running = false; remaining = duration * 60; selected.removeAll(); currentIndex = 0 }.frame(maxWidth: .infinity)
                    }
                }.padding(.horizontal, 14).padding(.vertical, 8).padding(.bottom, 24)
            }
        }
    }
}

extension AssignmentItem {
    var dueDate: Date? { dueAt.flatMap { ISO8601DateFormatter.canvas.date(from: $0) } }
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
        guard let posted = ISO8601DateFormatter.canvas.date(from: postedAt) else { return true }
        return posted >= Date().addingTimeInterval(Double(-7 * weeks) * 86400)
    }
}

extension String {
    var strippingHTML: String { replacingOccurrences(of: "<[^>]+>", with: "", options: .regularExpression).replacingOccurrences(of: "&nbsp;", with: " ").replacingOccurrences(of: "&amp;", with: "&") }
}

extension ISO8601DateFormatter {
    static let canvas: ISO8601DateFormatter = { let formatter = ISO8601DateFormatter(); formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]; return formatter }()
}

struct NativeEmptyState: View {
    let title: String; let symbol: String; var detail: String? = nil
    var body: some View { VStack(spacing: 8) { Image(systemName: symbol).font(.system(size: 26)).foregroundStyle(Color.accentColor); Text(title).font(.system(size: 14, weight: .regular)); if let detail { Text(detail).font(.system(size: 12, weight: .regular)).foregroundStyle(.secondary).multilineTextAlignment(.center) } }.padding(12).frame(maxWidth: .infinity) }
}
