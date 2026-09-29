import SwiftUI
import Combine
import UserNotifications

struct NativeRootView: View {
    @StateObject private var sessionStore = NativeSessionStore()
    @AppStorage("CanvasProColorScheme") private var colorScheme = "system"

    var body: some View {
        Group {
            if let error = sessionStore.configurationError {
                NativeEmptyState(title: "Build configuration missing", symbol: "wrench.and.screwdriver", detail: error)
            } else if sessionStore.session == nil {
                NativeAuthView(sessionStore: sessionStore)
            } else {
                NativeMainTabView(sessionStore: sessionStore).id(sessionStore.session?.user.id)
            }
        }
        .tint(.indigo)
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
                        Image(systemName: "graduationcap.fill").font(.system(size: 48)).foregroundStyle(.indigo)
                        Text("CanvasPro").font(.largeTitle.bold())
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
                    Button { submit() } label: { HStack { Spacer(); if sessionStore.isWorking { ProgressView() } else { Text(mode.rawValue).fontWeight(.semibold) }; Spacer() } }
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
            NativeStudyView(store: contentStore).tabItem { Label("Study", systemImage: "timer") }.tag(NativeTab.study)
            NativeGradesView(store: contentStore).tabItem { Label("Grades", systemImage: "chart.bar.fill") }.tag(NativeTab.grades)
            NativeSettingsView(sessionStore: sessionStore, contentStore: contentStore, features: featureStore).tabItem { Label("Settings", systemImage: "gearshape.fill") }.tag(NativeTab.settings)
        }
    }
}

private struct NativeDashboardView: View {
    @ObservedObject var store: NativeContentStore
    @ObservedObject var features: NativeFeatureStore
    private var allAssignments: [AssignmentItem] {
        store.bundle.assignments + features.customAssignments.map { item in .custom(item, course: store.bundle.courses.first { $0.id == item.courseID }) }
    }
    private var upcoming: [AssignmentItem] { Array(allAssignments.filter { !$0.isFinished(in: store) }.sorted(by: AssignmentItem.dueSort).prefix(5)) }
    private var average: Double? { let scores = store.bundle.courses.compactMap(\.currentScore); return scores.isEmpty ? nil : scores.reduce(0, +) / Double(scores.count) }

    var body: some View {
        NavigationStack {
            List {
                if store.isLoading && store.bundle.courses.isEmpty { Section { HStack { Spacer(); ProgressView("Syncing Canvas…"); Spacer() } } }
                Section("Since last visit") { HStack { MetricTile(value: "\(store.bundle.courses.count)", label: "Classes"); MetricTile(value: "\(upcoming.count)", label: "Upcoming"); MetricTile(value: "\(store.completed.count)", label: "Done") } }
                Section("Up next") {
                    if upcoming.isEmpty { NativeEmptyState(title: "You’re caught up", symbol: "checkmark.circle") }
                    ForEach(upcoming) { NativeAssignmentRow(assignment: $0, store: store) }
                }
                Section("Classes & grades") { ForEach(store.bundle.courses) { course in NavigationLink { CourseDetailView(course: course, store: store) } label: { CourseRow(course: course, store: store) } } }
                Section("Announcements") {
                    ForEach(store.bundle.announcements.prefix(3)) { item in NavigationLink(item.title) { AnnouncementDetailView(item: item) } }
                    if store.bundle.announcements.isEmpty { Text("No recent announcements").foregroundStyle(.secondary) }
                }
                Section("GPA snapshot") { LabeledContent("Average current score", value: average.map { String(format: "%.1f%%", $0) } ?? "—") }
                Section("Workload") { WorkloadView(assignments: allAssignments) }
            }
            .navigationTitle("Dashboard")
            .refreshable { async let a: Void = store.load(); async let b: Void = features.load(); _ = await (a, b) }
        }
    }
}

private struct MetricTile: View {
    let value: String; let label: String
    var body: some View { VStack { Text(value).font(.title2.bold()); Text(label).font(.caption).foregroundStyle(.secondary) }.frame(maxWidth: .infinity) }
}

private enum AssignmentFilter: String, CaseIterable { case upcoming = "Upcoming", all = "All", missing = "Missing", completed = "Completed" }

private struct NativeAssignmentsView: View {
    @ObservedObject var store: NativeContentStore
    @ObservedObject var features: NativeFeatureStore
    @State private var search = ""
    @State private var filter: AssignmentFilter = .upcoming
    @State private var courseID: Int?
    @State private var showAdd = false

    private var assignments: [AssignmentItem] {
        let custom = features.customAssignments.map { item in AssignmentItem.custom(item, course: store.bundle.courses.first { $0.id == item.courseID }) }
        return (store.bundle.assignments + custom).filter { item in
            let matches = search.isEmpty || item.name.localizedCaseInsensitiveContains(search) || item.courseName.localizedCaseInsensitiveContains(search)
            let courseMatches = courseID == nil || item.courseID == courseID
            let stateMatches: Bool
            switch filter {
            case .all: stateMatches = true
            case .upcoming: stateMatches = !item.isFinished(in: store) && (item.dueDate == nil || item.dueDate! >= Date())
            case .missing: stateMatches = item.submission?.missing == true || (!item.isFinished(in: store) && (item.dueDate ?? .distantFuture) < Date())
            case .completed: stateMatches = item.isFinished(in: store)
            }
            return matches && courseMatches && stateMatches
        }.sorted(by: AssignmentItem.dueSort)
    }

    var body: some View {
        NavigationStack {
            List {
                Section { Picker("Status", selection: $filter) { ForEach(AssignmentFilter.allCases, id: \.self) { Text($0.rawValue) } }.pickerStyle(.segmented) }
                Section { Picker("Class", selection: $courseID) { Text("All classes").tag(Int?.none); ForEach(store.bundle.courses) { Text(store.displayName(courseID: $0.id, fallback: $0.name)).tag(Optional($0.id)) } } }
                Section { ForEach(assignments) { item in NavigationLink { AssignmentDetailView(assignment: item, store: store, features: features) } label: { NativeAssignmentRow(assignment: item, store: store) } } }
            }
            .overlay { if assignments.isEmpty && !store.isLoading { NativeEmptyState(title: search.isEmpty ? "No assignments" : "No matches", symbol: "magnifyingglass") } }
            .navigationTitle("Assignments").searchable(text: $search, prompt: "Assignment or class")
            .toolbar { Button { showAdd = true } label: { Image(systemName: "plus") } }
            .sheet(isPresented: $showAdd) { AddAssignmentView(courses: store.bundle.courses, features: features) }
            .refreshable { async let a: Void = store.load(); async let b: Void = features.load(); _ = await (a, b) }
        }
    }
}

struct NativeAssignmentRow: View {
    let assignment: AssignmentItem
    @ObservedObject var store: NativeContentStore
    private var isComplete: Bool { assignment.isFinished(in: store) }
    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Button { Task { await store.toggle(assignment) } } label: { Image(systemName: isComplete ? "checkmark.circle.fill" : "circle").font(.title3).foregroundStyle(isComplete ? .green : .secondary) }.buttonStyle(.plain)
            VStack(alignment: .leading, spacing: 4) {
                Text(assignment.name).font(.headline).strikethrough(isComplete)
                Text(store.displayName(courseID: assignment.courseID, fallback: assignment.courseName)).font(.subheadline).foregroundStyle(.secondary)
                if let date = assignment.dueDate { Text(date, format: .dateTime.month().day().hour().minute()).font(.caption).foregroundStyle(date < Date() && !isComplete ? .red : .secondary) }
                HStack(spacing: 8) {
                    if assignment.submission?.missing == true { Label("Missing", systemImage: "exclamationmark.triangle.fill").foregroundStyle(.red) }
                    if assignment.submission?.late == true { Text("Late").foregroundStyle(.orange) }
                    if let points = assignment.pointsPossible { Text("\(points.formatted()) pts") }
                }.font(.caption2)
            }
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
        }.navigationTitle("Assignment").onAppear { estimate = features.estimates[assignment.id].flatMap { $0 > 0 ? $0 : nil } ?? 25 }
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
    @ObservedObject var store: NativeContentStore
    var body: some View {
        NavigationStack {
            List {
                Section { ForEach(store.bundle.courses) { course in NavigationLink { CourseDetailView(course: course, store: store) } label: { CourseRow(course: course, store: store) } } }
                Section("Tools") { NavigationLink("What-if grade calculator") { GradeCalculatorView() } }
            }
            .overlay { if store.bundle.courses.isEmpty && !store.isLoading { NativeEmptyState(title: "No grades yet", symbol: "chart.bar") } }
            .navigationTitle("Grades").refreshable { await store.load() }
        }
    }
}

struct CourseRow: View {
    let course: CourseSummary; @ObservedObject var store: NativeContentStore
    var body: some View { HStack { VStack(alignment: .leading, spacing: 4) { Text(store.displayName(courseID: course.id, fallback: course.name)).font(.headline); Text(course.courseCode).font(.caption).foregroundStyle(.secondary) }; Spacer(); VStack(alignment: .trailing) { Text(course.currentGrade ?? "—").font(.title3.bold()); if let score = course.currentScore { Text("\(score.formatted(.number.precision(.fractionLength(1))))%").font(.caption).foregroundStyle(.secondary) } } }.padding(.vertical, 4) }
}

struct CourseDetailView: View {
    let course: CourseSummary; @ObservedObject var store: NativeContentStore
    private var assignments: [AssignmentItem] { store.bundle.assignments.filter { $0.courseID == course.id }.sorted(by: AssignmentItem.dueSort) }
    var body: some View { List { Section("Current grade") { CourseRow(course: course, store: store); if let final = course.finalScore { LabeledContent("Final score", value: "\(final.formatted())%") } }; Section("Assignments") { ForEach(assignments) { NativeAssignmentRow(assignment: $0, store: store) } }; Section("Announcements") { ForEach(store.bundle.announcements.filter { $0.courseID == course.id }) { NavigationLink($0.title) { AnnouncementDetailView(item: $0) } } } }.navigationTitle(store.displayName(courseID: course.id, fallback: course.name)).navigationBarTitleDisplayMode(.inline) }
}

private struct GradeCalculatorView: View {
    @State private var current = 85.0; @State private var currentWeight = 75.0; @State private var target = 90.0
    private var needed: Double { guard currentWeight < 100 else { return target }; return (target - current * currentWeight / 100) / ((100 - currentWeight) / 100) }
    var body: some View { Form { Section("Current course") { LabeledContent("Current score", value: current.formatted()); Slider(value: $current, in: 0...100); LabeledContent("Work already graded", value: "\(Int(currentWeight))%"); Slider(value: $currentWeight, in: 1...99) }; Section("Goal") { LabeledContent("Target grade", value: "\(Int(target))%"); Slider(value: $target, in: 0...100) }; Section("Result") { Text(needed > 100 ? "You would need \(needed.formatted(.number.precision(.fractionLength(1))))% on remaining work." : "Average \(needed.formatted(.number.precision(.fractionLength(1))))% on remaining work to finish at your target.") } }.navigationTitle("Grade Calculator") }
}

private struct NativeStudyView: View {
    @ObservedObject var store: NativeContentStore
    @State private var selected = Set<Int>(); @State private var duration = 25; @State private var remaining = 25 * 60; @State private var running = false; @State private var currentIndex = 0
    private let timer = Timer.publish(every: 1, on: .main, in: .common).autoconnect()
    private var items: [AssignmentItem] { store.bundle.assignments.filter { selected.contains($0.id) }.sorted(by: AssignmentItem.dueSort) }
    var body: some View {
        NavigationStack {
            Group { if running || remaining != duration * 60 { activeSession } else { setup } }
                .navigationTitle("Study Session")
                .onReceive(timer) { _ in guard running, remaining > 0 else { return }; remaining -= 1; if remaining == 0 { running = false; UINotificationFeedbackGenerator().notificationOccurred(.success) } }
        }
    }
    private var setup: some View { Form { Section("Duration") { Picker("Minutes", selection: $duration) { ForEach([15, 25, 45, 60], id: \.self) { Text("\($0) minutes").tag($0) } }.pickerStyle(.segmented) }; Section("Choose assignments") { ForEach(store.bundle.assignments.filter { !$0.isFinished(in: store) }.sorted(by: AssignmentItem.dueSort)) { item in Button { if selected.contains(item.id) { selected.remove(item.id) } else { selected.insert(item.id) } } label: { HStack { VStack(alignment: .leading) { Text(item.name); Text(item.courseName).font(.caption).foregroundStyle(.secondary) }; Spacer(); Image(systemName: selected.contains(item.id) ? "checkmark.circle.fill" : "circle") } }.buttonStyle(.plain) } }; Section { Button("Start session") { remaining = duration * 60; running = true }.frame(maxWidth: .infinity).disabled(selected.isEmpty) } } }
    private var activeSession: some View { VStack(spacing: 22) { Spacer(); ProgressView(value: Double(duration * 60 - remaining), total: Double(duration * 60)).padding(.horizontal); Text(String(format: "%02d:%02d", remaining / 60, remaining % 60)).font(.system(size: 64, weight: .semibold, design: .rounded)).monospacedDigit(); if !items.isEmpty { Text(items[min(currentIndex, items.count - 1)].name).font(.title2.bold()).multilineTextAlignment(.center); Text(items[min(currentIndex, items.count - 1)].courseName).foregroundStyle(.secondary) }; HStack { Button(running ? "Pause" : "Resume") { running.toggle() }.buttonStyle(.borderedProminent); Button("Next") { if !items.isEmpty { currentIndex = (currentIndex + 1) % items.count } }.buttonStyle(.bordered) }; Button("End Session", role: .destructive) { running = false; remaining = duration * 60; selected.removeAll(); currentIndex = 0 }; Spacer() }.padding() }
}

extension AssignmentItem {
    var dueDate: Date? { dueAt.flatMap { ISO8601DateFormatter.canvas.date(from: $0) } }
    func isFinished(in store: NativeContentStore) -> Bool { store.completed.contains(id) || submission?.submittedAt != nil || submission?.workflowState == "graded" || submission?.excused == true }
    static func dueSort(_ lhs: AssignmentItem, _ rhs: AssignmentItem) -> Bool { (lhs.dueDate ?? .distantFuture) < (rhs.dueDate ?? .distantFuture) }
}

extension String {
    var strippingHTML: String { replacingOccurrences(of: "<[^>]+>", with: "", options: .regularExpression).replacingOccurrences(of: "&nbsp;", with: " ").replacingOccurrences(of: "&amp;", with: "&") }
}

extension ISO8601DateFormatter {
    static let canvas: ISO8601DateFormatter = { let formatter = ISO8601DateFormatter(); formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]; return formatter }()
}

struct NativeEmptyState: View {
    let title: String; let symbol: String; var detail: String? = nil
    var body: some View { VStack(spacing: 10) { Image(systemName: symbol).font(.largeTitle).foregroundStyle(.secondary); Text(title).font(.headline); if let detail { Text(detail).font(.subheadline).foregroundStyle(.secondary).multilineTextAlignment(.center) } }.padding().frame(maxWidth: .infinity) }
}
