import SwiftUI
import Combine
import UserNotifications

struct NativeRootView: View {
    @StateObject private var sessionStore = NativeSessionStore()

    var body: some View {
        Group {
            if let error = sessionStore.configurationError {
                NativeEmptyState(title: "Build configuration missing", symbol: "wrench.and.screwdriver", detail: error)
            } else if sessionStore.session == nil {
                NativeSignInView(sessionStore: sessionStore)
            } else {
                NativeMainTabView(sessionStore: sessionStore)
                    .id(sessionStore.session?.user.id)
            }
        }
        .tint(.indigo)
    }
}

private struct NativeSignInView: View {
    @ObservedObject var sessionStore: NativeSessionStore
    @State private var email = ""
    @State private var password = ""

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    VStack(spacing: 14) {
                        Image(systemName: "graduationcap.fill")
                            .font(.system(size: 48))
                            .foregroundStyle(.indigo)
                        Text("CanvasPro").font(.largeTitle.bold())
                        Text("Your coursework, organized natively on iPhone.")
                            .foregroundStyle(.secondary)
                            .multilineTextAlignment(.center)
                    }
                    .frame(maxWidth: .infinity)
                    .listRowBackground(Color.clear)
                }
                Section("Sign in") {
                    TextField("Email", text: $email)
                        .textContentType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .keyboardType(.emailAddress)
                    SecureField("Password", text: $password)
                        .textContentType(.password)
                    Button {
                        Task { await sessionStore.signIn(email: email, password: password) }
                    } label: {
                        HStack {
                            Spacer()
                            if sessionStore.isWorking { ProgressView() } else { Text("Sign In").fontWeight(.semibold) }
                            Spacer()
                        }
                    }
                    .disabled(email.isEmpty || password.isEmpty || sessionStore.isWorking)
                }
                if let error = sessionStore.errorMessage {
                    Section { Text(error).foregroundStyle(.red) }
                }
            }
            .navigationTitle("Welcome")
        }
    }
}

private enum NativeTab: Hashable { case dashboard, assignments, study, grades, settings }

struct NativeMainTabView: View {
    @ObservedObject var sessionStore: NativeSessionStore
    @StateObject private var contentStore: NativeContentStore
    @State private var selection: NativeTab = .dashboard

    init(sessionStore: NativeSessionStore) {
        self.sessionStore = sessionStore
        _contentStore = StateObject(wrappedValue: NativeContentStore(sessionStore: sessionStore))
    }

    var body: some View {
        nativeTabs
            .task { await contentStore.load() }
            .alert("CanvasPro", isPresented: Binding(
                get: { contentStore.errorMessage != nil },
                set: { if !$0 { contentStore.errorMessage = nil } }
            )) { Button("OK", role: .cancel) {} } message: { Text(contentStore.errorMessage ?? "") }
    }

    @ViewBuilder
    private var nativeTabs: some View {
        if #available(iOS 26.0, *) {
            tabs.tabBarMinimizeBehavior(.onScrollDown)
        } else {
            tabs
        }
    }

    private var tabs: some View {
        TabView(selection: $selection) {
            NativeDashboardView(store: contentStore)
                .tabItem { Label("Dashboard", systemImage: "house.fill") }
                .tag(NativeTab.dashboard)
            NativeAssignmentsView(store: contentStore)
                .tabItem { Label("Assignments", systemImage: "checklist") }
                .tag(NativeTab.assignments)
            NativeStudyView()
                .tabItem { Label("Study", systemImage: "timer") }
                .tag(NativeTab.study)
            NativeGradesView(store: contentStore)
                .tabItem { Label("Grades", systemImage: "chart.bar.fill") }
                .tag(NativeTab.grades)
            NativeSettingsView(sessionStore: sessionStore, contentStore: contentStore)
                .tabItem { Label("Settings", systemImage: "gearshape.fill") }
                .tag(NativeTab.settings)
        }
    }
}

private struct NativeDashboardView: View {
    @ObservedObject var store: NativeContentStore

    private var upcoming: [AssignmentItem] {
        store.bundle.assignments
            .filter { !store.completed.contains($0.id) && $0.submission?.submittedAt == nil }
            .sorted { ($0.dueAt ?? "9999") < ($1.dueAt ?? "9999") }
            .prefix(5).map { $0 }
    }

    var body: some View {
        NavigationStack {
            List {
                if store.isLoading && store.bundle.courses.isEmpty {
                    Section { HStack { Spacer(); ProgressView("Syncing Canvas…"); Spacer() } }
                }
                Section("Overview") {
                    LabeledContent("Classes", value: "\(store.bundle.courses.count)")
                    LabeledContent("Upcoming", value: "\(upcoming.count)")
                    LabeledContent("Completed", value: "\(store.completed.count)")
                }
                Section("Up next") {
                    if upcoming.isEmpty { NativeEmptyState(title: "You’re caught up", symbol: "checkmark.circle") }
                    ForEach(upcoming) { NativeAssignmentRow(assignment: $0, store: store) }
                }
                Section("Classes") {
                    ForEach(store.bundle.courses) { course in
                        VStack(alignment: .leading, spacing: 4) {
                            Text(store.displayName(courseID: course.id, fallback: course.name)).font(.headline)
                            Text(course.courseCode).font(.caption).foregroundStyle(.secondary)
                        }
                    }
                }
            }
            .navigationTitle("Dashboard")
            .refreshable { await store.load() }
        }
    }
}

private struct NativeAssignmentsView: View {
    @ObservedObject var store: NativeContentStore
    @State private var search = ""

    private var assignments: [AssignmentItem] {
        store.bundle.assignments
            .filter { search.isEmpty || $0.name.localizedCaseInsensitiveContains(search) || $0.courseName.localizedCaseInsensitiveContains(search) }
            .sorted { ($0.dueAt ?? "9999") < ($1.dueAt ?? "9999") }
    }

    var body: some View {
        NavigationStack {
            List(assignments) { NativeAssignmentRow(assignment: $0, store: store) }
                .overlay { if assignments.isEmpty && !store.isLoading { NativeEmptyState(title: search.isEmpty ? "No assignments" : "No matches", symbol: "magnifyingglass") } }
                .navigationTitle("Assignments")
                .searchable(text: $search, prompt: "Assignment or class")
                .refreshable { await store.load() }
        }
    }
}

private struct NativeAssignmentRow: View {
    let assignment: AssignmentItem
    @ObservedObject var store: NativeContentStore

    private var isComplete: Bool { store.completed.contains(assignment.id) || assignment.submission?.submittedAt != nil }

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Button { Task { await store.toggle(assignment) } } label: {
                Image(systemName: isComplete ? "checkmark.circle.fill" : "circle")
                    .font(.title3)
                    .foregroundStyle(isComplete ? .green : .secondary)
            }
            .buttonStyle(.plain)
            VStack(alignment: .leading, spacing: 4) {
                Text(assignment.name).font(.headline).strikethrough(isComplete)
                Text(store.displayName(courseID: assignment.courseID, fallback: assignment.courseName))
                    .font(.subheadline).foregroundStyle(.secondary)
                if let due = assignment.dueAt, let date = ISO8601DateFormatter.canvas.date(from: due) {
                    Text(date, format: .dateTime.month().day().hour().minute())
                        .font(.caption).foregroundStyle(date < Date() && !isComplete ? .red : .secondary)
                }
            }
        }
        .padding(.vertical, 3)
    }
}

private struct NativeGradesView: View {
    @ObservedObject var store: NativeContentStore
    var body: some View {
        NavigationStack {
            List(store.bundle.courses) { course in
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(store.displayName(courseID: course.id, fallback: course.name)).font(.headline)
                        Text(course.courseCode).font(.caption).foregroundStyle(.secondary)
                    }
                    Spacer()
                    VStack(alignment: .trailing) {
                        Text(course.currentGrade ?? "—").font(.title3.bold())
                        if let score = course.currentScore { Text(score, format: .number.precision(.fractionLength(1))).font(.caption).foregroundStyle(.secondary) }
                    }
                }
                .padding(.vertical, 4)
            }
            .overlay { if store.bundle.courses.isEmpty && !store.isLoading { NativeEmptyState(title: "No grades yet", symbol: "chart.bar") } }
            .navigationTitle("Grades")
            .refreshable { await store.load() }
        }
    }
}

private struct NativeStudyView: View {
    @State private var remaining = 25 * 60
    @State private var running = false
    private let timer = Timer.publish(every: 1, on: .main, in: .common).autoconnect()

    var body: some View {
        NavigationStack {
            VStack(spacing: 28) {
                Spacer()
                Image(systemName: running ? "timer.circle.fill" : "timer.circle")
                    .font(.system(size: 72)).foregroundStyle(.indigo)
                Text(String(format: "%02d:%02d", remaining / 60, remaining % 60))
                    .font(.system(size: 64, weight: .semibold, design: .rounded)).monospacedDigit()
                HStack(spacing: 16) {
                    Button(running ? "Pause" : "Start") { running.toggle() }
                        .buttonStyle(.borderedProminent).controlSize(.large)
                    Button("Reset") { running = false; remaining = 25 * 60 }
                        .buttonStyle(.bordered).controlSize(.large)
                }
                Spacer()
            }
            .padding()
            .navigationTitle("Study Session")
            .onReceive(timer) { _ in
                guard running, remaining > 0 else { return }
                remaining -= 1
                if remaining == 0 { running = false; UINotificationFeedbackGenerator().notificationOccurred(.success) }
            }
        }
    }
}

private struct NativeSettingsView: View {
    @ObservedObject var sessionStore: NativeSessionStore
    @ObservedObject var contentStore: NativeContentStore
    @State private var canvasDomain = ""
    @State private var canvasToken = ""
    @State private var nicknameDrafts: [Int: String] = [:]
    @State private var notificationsEnabled = false
    @State private var status: String?
    @State private var working = false

    var body: some View {
        NavigationStack {
            Form {
                Section("Account") {
                    LabeledContent("Signed in as", value: sessionStore.session?.user.email ?? "CanvasPro user")
                    Button("Sign Out", role: .destructive) { sessionStore.signOut() }
                }
                Section("Canvas connection") {
                    TextField("yourschool.instructure.com", text: $canvasDomain)
                        .textInputAutocapitalization(.never).keyboardType(.URL)
                    SecureField("Canvas API token", text: $canvasToken)
                    Button("Validate and Save") { saveCanvas() }
                        .disabled(canvasDomain.isEmpty || canvasToken.isEmpty || working)
                } footer: {
                    Text("Your Canvas token is validated through CanvasPro and stored server-side; it is not saved on this device.")
                }
                Section("Class names") {
                    ForEach(contentStore.bundle.courses) { course in
                        HStack {
                            VStack(alignment: .leading) {
                                Text(course.name).font(.subheadline)
                                Text(course.courseCode).font(.caption).foregroundStyle(.secondary)
                            }
                            Spacer()
                            TextField("Nickname", text: Binding(
                                get: { nicknameDrafts[course.id] ?? contentStore.nicknames[course.id]?.customName ?? "" },
                                set: { nicknameDrafts[course.id] = $0 }
                            ))
                            .multilineTextAlignment(.trailing)
                            .onSubmit { saveNickname(course) }
                        }
                    }
                } footer: { Text("Press Return after editing a nickname to save it across devices.") }
                Section("Notifications") {
                    Toggle("Push notifications", isOn: $notificationsEnabled)
                        .onChange(of: notificationsEnabled) { enabled in syncNotifications(enabled) }
                }
                if let status { Section { Text(status).foregroundStyle(.secondary) } }
                Section("About") {
                    LabeledContent("Interface", value: "Native SwiftUI")
                    LabeledContent("Navigation", value: "Apple TabView")
                }
            }
            .navigationTitle("Settings")
            .onReceive(NotificationCenter.default.publisher(for: .nativeDeviceToken)) { notification in
                guard let deviceToken = notification.object as? String else {
                    if let error = notification.object as? Error { status = error.localizedDescription }
                    return
                }
                Task { await register(deviceToken) }
            }
        }
    }

    private func saveCanvas() {
        working = true
        Task {
            defer { working = false }
            do { try await contentStore.saveCanvas(domain: canvasDomain, canvasToken: canvasToken); canvasToken = ""; status = "Canvas connection saved." }
            catch { status = error.localizedDescription }
        }
    }

    private func saveNickname(_ course: CourseSummary) {
        Task {
            do { try await contentStore.saveNickname(course: course, name: nicknameDrafts[course.id] ?? ""); status = "Class name saved." }
            catch { status = error.localizedDescription }
        }
    }

    private func syncNotifications(_ enabled: Bool) {
        Task {
            guard let api = sessionStore.api, let user = sessionStore.session?.user else { return }
            do {
                let token = try await sessionStore.accessToken()
                if enabled {
                    let granted = try await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound])
                    guard granted else { notificationsEnabled = false; status = "Notifications were denied in iOS Settings."; return }
                    UIApplication.shared.registerForRemoteNotifications()
                } else {
                    UIApplication.shared.unregisterForRemoteNotifications()
                    if let deviceToken = UserDefaults.standard.string(forKey: "CanvasProNativePushToken") {
                        try await api.deletePushToken(deviceToken, token: token)
                        UserDefaults.standard.removeObject(forKey: "CanvasProNativePushToken")
                    }
                }
                try await api.syncNotificationPreferences(enabled: enabled, token: token, userID: user.id)
            } catch { status = error.localizedDescription }
        }
    }

    private func register(_ deviceToken: String) async {
        guard let api = sessionStore.api, let user = sessionStore.session?.user else { return }
        do {
            try await api.upsertPushToken(deviceToken, token: try await sessionStore.accessToken(), userID: user.id)
            UserDefaults.standard.set(deviceToken, forKey: "CanvasProNativePushToken")
            status = "Push notifications enabled."
        } catch { status = error.localizedDescription }
    }
}

private extension ISO8601DateFormatter {
    static let canvas: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()
}

private struct NativeEmptyState: View {
    let title: String
    let symbol: String
    var detail: String? = nil

    var body: some View {
        VStack(spacing: 10) {
            Image(systemName: symbol).font(.largeTitle).foregroundStyle(.secondary)
            Text(title).font(.headline)
            if let detail { Text(detail).font(.subheadline).foregroundStyle(.secondary).multilineTextAlignment(.center) }
        }
        .padding()
        .frame(maxWidth: .infinity)
    }
}
