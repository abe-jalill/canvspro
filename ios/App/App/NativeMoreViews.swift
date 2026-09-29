import SwiftUI
import UserNotifications

struct NativeSettingsView: View {
    @ObservedObject var sessionStore: NativeSessionStore
    @ObservedObject var contentStore: NativeContentStore
    @ObservedObject var features: NativeFeatureStore

    var body: some View {
        NavigationStack {
            List {
                Section("Plan & organize") {
                    NavigationLink("Get It Done") { GetItDoneView(store: contentStore, features: features) }
                    NavigationLink("Focus") { FocusView(store: contentStore, features: features) }
                    NavigationLink("Calendar") { CalendarView(store: contentStore, features: features) }
                    NavigationLink("Class Schedule") { ClassScheduleView(features: features) }
                }
                Section("Updates") {
                    NavigationLink("Announcements") { AnnouncementsView(store: contentStore) }
                    NavigationLink("Notifications") { NotificationsView(sessionStore: sessionStore, features: features) }
                }
                Section("Personalization") {
                    NavigationLink("Appearance") { AppearanceView() }
                    NavigationLink("Profile") { ProfileView(features: features, email: sessionStore.session?.user.email) }
                    NavigationLink("Class names") { ClassNamesView(store: contentStore) }
                    NavigationLink("Hidden courses") { HiddenCoursesView(store: contentStore, features: features) }
                }
                Section("Connections") { NavigationLink("Canvas") { CanvasSettingsView(store: contentStore) } }
                Section("Account") {
                    LabeledContent("Signed in as", value: sessionStore.session?.user.email ?? "CanvasPro user")
                    Button("Sign Out", role: .destructive) { Task { await sessionStore.signOut() } }
                }
                Section("Legal") {
                    NavigationLink("Privacy Policy") { NativeLegalView(title: "Privacy Policy") }
                    NavigationLink("Terms of Service") { NativeLegalView(title: "Terms of Service") }
                }
                Section("About") { LabeledContent("Interface", value: "Native SwiftUI"); LabeledContent("Navigation", value: "Apple TabView") }
            }.navigationTitle("Settings")
        }
    }
}

private struct GetItDoneView: View {
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
        List {
            Section { Picker("Window", selection: $window) { Text("7 days").tag(7); Text("14 days").tag(14) }.pickerStyle(.segmented) }
            if let first = candidates.first { Section("Start here") { NativeAssignmentRow(assignment: first, store: store); Button("Choose another") { skipped.insert(first.id) } } }
            Section("Today’s plan") { ForEach(candidates.prefix(8)) { item in VStack(alignment: .leading) { NativeAssignmentRow(assignment: item, store: store); Text("Estimated \(features.estimates[item.id] ?? 25) minutes").font(.caption).foregroundStyle(.secondary) } } }
            if candidates.isEmpty { NativeEmptyState(title: "Nothing urgent", symbol: "sparkles") }
        }.navigationTitle("Get It Done")
    }
}

private struct FocusView: View {
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
        List {
            Section { Picker("Due within", selection: $days) { Text("1 day").tag(1); Text("3 days").tag(3); Text("1 week").tag(7); Text("All").tag(3650) }.pickerStyle(.segmented); Toggle("Show completed", isOn: $showCompleted) }
            Section { ForEach(items) { NativeAssignmentRow(assignment: $0, store: store) } }
            if items.isEmpty { NativeEmptyState(title: "You’re all caught up", symbol: "checkmark.circle") }
        }.navigationTitle("Focus")
    }
}

private struct CalendarView: View {
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
        List {
            Section { Picker("Range", selection: $weekOnly) { Text("This week").tag(true); Text("Semester").tag(false) }.pickerStyle(.segmented) }
            Section("Workload") { WorkloadView(assignments: store.bundle.assignments) }
            ForEach(Array(agenda.enumerated()), id: \.offset) { _, item in
                VStack(alignment: .leading) { Text(item.1).font(.headline); Text(item.2).font(.caption).foregroundStyle(.secondary); Text(item.0, format: .dateTime.weekday().month().day().hour().minute()).font(.caption) }
            }
            if agenda.isEmpty { NativeEmptyState(title: "Nothing scheduled", symbol: "calendar") }
        }.navigationTitle("Calendar")
    }
}

struct WorkloadView: View {
    let assignments: [AssignmentItem]
    var body: some View {
        HStack(spacing: 6) {
            ForEach(0..<7, id: \.self) { offset in
                let day = Calendar.current.date(byAdding: .day, value: offset, to: Date())!
                let count = assignments.filter { $0.dueDate.map { Calendar.current.isDate($0, inSameDayAs: day) } ?? false }.count
                VStack { RoundedRectangle(cornerRadius: 5).fill(count == 0 ? Color.secondary.opacity(0.15) : Color.indigo.opacity(min(1, 0.3 + Double(count) * 0.18))).frame(height: 34); Text(day, format: .dateTime.weekday(.narrow)).font(.caption2) }.accessibilityLabel("\(count) assignments")
            }
        }
    }
}

private struct AnnouncementsView: View {
    @ObservedObject var store: NativeContentStore
    @State private var search = ""
    private var items: [AnnouncementItem] { store.bundle.announcements.filter { search.isEmpty || $0.title.localizedCaseInsensitiveContains(search) || $0.courseName.localizedCaseInsensitiveContains(search) } }
    var body: some View { List(items) { item in NavigationLink { AnnouncementDetailView(item: item) } label: { VStack(alignment: .leading) { Text(item.title).font(.headline); Text(item.courseName).font(.caption).foregroundStyle(.secondary) } } }.navigationTitle("Announcements").searchable(text: $search).refreshable { await store.load() } }
}

struct AnnouncementDetailView: View {
    let item: AnnouncementItem
    var body: some View { ScrollView { VStack(alignment: .leading, spacing: 14) { Text(item.courseName).foregroundStyle(.secondary); Text(item.message.strippingHTML).textSelection(.enabled); if let url = URL(string: item.htmlURL), !item.htmlURL.isEmpty { Link("Open in Canvas", destination: url) } }.frame(maxWidth: .infinity, alignment: .leading).padding() }.navigationTitle(item.title).navigationBarTitleDisplayMode(.inline) }
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
        .navigationTitle("Notifications")
        .onReceive(NotificationCenter.default.publisher(for: .nativeDeviceToken)) { note in
            if let token = note.object as? String { Task { await register(token) } }
            else if let error = note.object as? Error { status = error.localizedDescription }
        }
    }
    private func bind<T>(_ path: WritableKeyPath<NotificationPreferences, T>) -> Binding<T> { Binding(get: { features.notificationPreferences[keyPath: path] }, set: { features.notificationPreferences[keyPath: path] = $0 }) }
    private func save() {
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
    @AppStorage("CanvasProColorScheme") private var scheme = "system"
    var body: some View { Form { Section("Theme") { Picker("Appearance", selection: $scheme) { Text("System").tag("system"); Text("Light").tag("light"); Text("Dark").tag("dark") } } }.navigationTitle("Appearance") }
}

private struct ProfileView: View {
    @ObservedObject var features: NativeFeatureStore
    let email: String?
    @State private var username = ""
    @State private var status: String?
    var body: some View { Form { Section("Account") { LabeledContent("Email", value: email ?? "—"); TextField("Username", text: $username).textInputAutocapitalization(.never); Button("Save username") { Task { do { try await features.saveUsername(username); status = "Profile saved." } catch { status = error.localizedDescription } } } }; if let status { Section { Text(status).foregroundStyle(.secondary) } } }.navigationTitle("Profile").onAppear { username = features.profile.username ?? "" } }
}

private struct ClassNamesView: View {
    @ObservedObject var store: NativeContentStore
    @State private var drafts: [Int: String] = [:]
    @State private var status: String?
    var body: some View { Form { Section("Class names") { ForEach(store.bundle.courses) { course in VStack(alignment: .leading) { Text(course.name).font(.caption).foregroundStyle(.secondary); TextField("Nickname", text: Binding(get: { drafts[course.id] ?? store.nicknames[course.id]?.customName ?? "" }, set: { drafts[course.id] = $0 })).onSubmit { save(course) } } } }; if let status { Section { Text(status) } } }.navigationTitle("Class Names") }
    private func save(_ course: CourseSummary) { Task { do { try await store.saveNickname(course: course, name: drafts[course.id] ?? ""); status = "Saved." } catch { status = error.localizedDescription } } }
}

private struct HiddenCoursesView: View {
    @ObservedObject var store: NativeContentStore
    @ObservedObject var features: NativeFeatureStore
    @State private var hidden = Set<Int>()
    var body: some View {
        List(store.bundle.courses) { course in
            Toggle(store.displayName(courseID: course.id, fallback: course.name), isOn: Binding(get: { hidden.contains(course.id) }, set: { value in if value { hidden.insert(course.id) } else { hidden.remove(course.id) }; Task { try? await features.savePreference("hidden-courses", Array(hidden)) } }))
        }.navigationTitle("Hidden Courses").onAppear { if case .some(.array(let values)) = features.preferences["hidden-courses"] { hidden = Set(values.compactMap { if case .number(let id) = $0 { return Int(id) }; return nil }) } }
    }
}

private struct CanvasSettingsView: View {
    @ObservedObject var store: NativeContentStore
    @State private var domain = ""; @State private var canvasToken = ""; @State private var working = false; @State private var status: String?
    var body: some View {
        Form {
            Section("Canvas connection") { TextField("yourschool.instructure.com", text: $domain).textInputAutocapitalization(.never).keyboardType(.URL); SecureField("Canvas API token", text: $canvasToken); Button("Validate and Save") { save() }.disabled(domain.isEmpty || canvasToken.isEmpty || working) } footer: { Text("The token is validated through CanvasPro and stored securely on the server, not on this device.") }
            if let status { Section { Text(status).foregroundStyle(.secondary) } }
            Section("How to get a token") { Text("In Canvas on the web, open Account → Settings → Approved Integrations → New Access Token. Copy it here once; CanvasPro cannot read it back later.") }
        }.navigationTitle("Canvas")
    }
    private func save() { working = true; Task { defer { working = false }; do { try await store.saveCanvas(domain: domain, canvasToken: canvasToken); canvasToken = ""; status = "Canvas connection saved." } catch { status = error.localizedDescription } } }
}

private struct ClassScheduleView: View {
    @ObservedObject var features: NativeFeatureStore
    @State private var showAdd = false
    var body: some View {
        List {
            ForEach(features.schedule) { item in VStack(alignment: .leading, spacing: 4) { Text(item.title).font(.headline); Text("\(item.days.joined(separator: ", ")) · \(time(item.startMinutes))–\(time(item.endMinutes))").font(.subheadline); Text([item.code, item.section, item.location, item.instructor].filter { !$0.isEmpty }.joined(separator: " · ")).font(.caption).foregroundStyle(.secondary) } }
                .onDelete { indexes in Task { for index in indexes { let item = features.schedule[index]; if let api = features.sessionStore.api { let token = try await features.sessionStore.accessToken(); try? await api.deleteScheduleEntry(id: item.id, token: token) } }; await features.load() } }
            if features.schedule.isEmpty { NativeEmptyState(title: "No class schedule", symbol: "calendar.badge.plus") }
        }.navigationTitle("Class Schedule").toolbar { Button { showAdd = true } label: { Image(systemName: "plus") } }.sheet(isPresented: $showAdd) { AddScheduleView(features: features) }
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
                Section("Meets") { HStack { ForEach(days, id: \.self) { day in Button(day) { if selectedDays.contains(day) { selectedDays.remove(day) } else { selectedDays.insert(day) } }.buttonStyle(.borderedProminent).tint(selectedDays.contains(day) ? .indigo : .gray) } }; DatePicker("Starts", selection: $start, displayedComponents: .hourAndMinute); DatePicker("Ends", selection: $end, displayedComponents: .hourAndMinute) }
                if let error { Section { Text(error).foregroundStyle(.red) } }
            }.navigationTitle("Add Class").toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }; ToolbarItem(placement: .confirmationAction) { Button("Save") { save() }.disabled(title.isEmpty || selectedDays.isEmpty) } }
        }
    }
    private func save() {
        let cal = Calendar.current
        let startMinutes = cal.component(.hour, from: start) * 60 + cal.component(.minute, from: start)
        let endMinutes = cal.component(.hour, from: end) * 60 + cal.component(.minute, from: end)
        let entry = ClassScheduleEntry(id: "", code: code, section: "", title: title, crn: "", credits: 0, instructor: instructor, location: location, campus: "", scheduleType: "Lecture", days: days.filter(selectedDays.contains), startMinutes: startMinutes, endMinutes: endMinutes, term: "", dateRange: "", canvasCourseID: nil)
        Task { do { guard let api = features.sessionStore.api, let user = features.sessionStore.session?.user else { return }; let token = try await features.sessionStore.accessToken(); try await api.saveScheduleEntry(entry, token: token, userID: user.id); await features.load(); dismiss() } catch { self.error = error.localizedDescription } }
    }
}

struct NativeLegalView: View {
    let title: String
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text(title).font(.largeTitle.bold())
                Text("CanvasPro stores the account and coursework settings needed to provide the service. Canvas credentials are stored server-side and used only to retrieve your Canvas data. You may delete your account and its stored data from CanvasPro. Use of CanvasPro is subject to school and Canvas policies.")
                Text("The complete, current policy is also available on canvaspro.app.").foregroundStyle(.secondary)
                if let url = URL(string: title == "Privacy Policy" ? "https://canvaspro.app/privacy" : "https://canvaspro.app/terms") { Link("View current \(title)", destination: url) }
            }.padding()
        }.navigationTitle(title).navigationBarTitleDisplayMode(.inline)
    }
}
