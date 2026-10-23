import AppIntents
import ActivityKit
import Foundation
import SwiftUI
import UserNotifications

enum JSONValue: Codable, Equatable {
    case string(String), number(Double), bool(Bool), object([String: JSONValue]), array([JSONValue]), null

    init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if c.decodeNil() { self = .null }
        else if let value = try? c.decode(Bool.self) { self = .bool(value) }
        else if let value = try? c.decode(Double.self) { self = .number(value) }
        else if let value = try? c.decode(String.self) { self = .string(value) }
        else if let value = try? c.decode([String: JSONValue].self) { self = .object(value) }
        else { self = .array(try c.decode([JSONValue].self)) }
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.singleValueContainer()
        switch self {
        case .string(let v): try c.encode(v)
        case .number(let v): try c.encode(v)
        case .bool(let v): try c.encode(v)
        case .object(let v): try c.encode(v)
        case .array(let v): try c.encode(v)
        case .null: try c.encodeNil()
        }
    }

    var foundation: Any {
        switch self {
        case .string(let v): return v
        case .number(let v): return v
        case .bool(let v): return v
        case .object(let v): return v.mapValues(\.foundation)
        case .array(let v): return v.map(\.foundation)
        case .null: return NSNull()
        }
    }
}

struct UserPreferenceRow: Codable {
    let key: String
    let value: JSONValue
}

struct AccountProfile: Codable {
    var username: String? = nil
    var avatarPath: String? = nil
    enum CodingKeys: String, CodingKey { case username; case avatarPath = "avatar_path" }
}

struct NativeAccountDetails: Equatable {
    /// Same limit as the website, so greetings and widgets stay on one line.
    static let nicknameLimit = 10

    var firstName = ""
    var lastName = ""
    var nickname = ""
    var school = ""
    var major = ""
    var classOf = ""

    init(_ metadata: [String: Any] = [:]) {
        firstName = metadata["first_name"] as? String ?? metadata["firstName"] as? String ?? ""
        lastName = metadata["last_name"] as? String ?? metadata["lastName"] as? String ?? ""
        nickname = metadata["nickname"] as? String ?? ""
        school = metadata["school"] as? String ?? ""
        major = metadata["major"] as? String ?? ""
        classOf = metadata["class_of"] as? String ?? metadata["classOf"] as? String ?? ""
    }

    /// Freshman to Senior from the graduation year, for a four-year degree. The
    /// school year turns over in August, so the class of 2027 are juniors in
    /// fall 2025. "Class of 2031" when it's further out or already past; nil
    /// with no year.
    func standing(now: Date = Date(), calendar: Calendar = .current) -> String? {
        guard let year = Int(classOf.trimmingCharacters(in: .whitespacesAndNewlines)) else { return nil }
        let parts = calendar.dateComponents([.year, .month], from: now)
        guard let current = parts.year, let month = parts.month else { return nil }
        // The spring this school year ends in.
        let finalYear = month >= 8 ? current + 1 : current
        switch year - finalYear {
        case 0: return "Senior"
        case 1: return "Junior"
        case 2: return "Sophomore"
        case 3: return "Freshman"
        default: return "Class of \(year)"
        }
    }

    /// "State University · Sophomore", or nil when neither is filled in.
    var schoolLine: String? {
        let parts = [school.trimmingCharacters(in: .whitespacesAndNewlines), standing() ?? ""].filter { !$0.isEmpty }
        return parts.isEmpty ? nil : parts.joined(separator: " · ")
    }

    var metadata: [String: Any] { [
        "first_name": firstName.trimmingCharacters(in: .whitespacesAndNewlines),
        "last_name": lastName.trimmingCharacters(in: .whitespacesAndNewlines),
        "nickname": String(nickname.trimmingCharacters(in: .whitespacesAndNewlines).prefix(Self.nicknameLimit)),
        "school": school.trimmingCharacters(in: .whitespacesAndNewlines),
        "major": major.trimmingCharacters(in: .whitespacesAndNewlines),
        "class_of": classOf.trimmingCharacters(in: .whitespacesAndNewlines),
        "full_name": "\(firstName.trimmingCharacters(in: .whitespacesAndNewlines)) \(lastName.trimmingCharacters(in: .whitespacesAndNewlines))".trimmingCharacters(in: .whitespacesAndNewlines),
        "profile_setup_prompted": true,
        "profile_setup_completed": !firstName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !lastName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
    ] }
}

struct ClassScheduleEntry: Codable, Identifiable, Hashable {
    var id: String
    var code: String
    var section: String
    var title: String
    var crn: String
    var credits: Double
    var instructor: String
    var location: String
    var campus: String
    var scheduleType: String
    var days: [String]
    var startMinutes: Int
    var endMinutes: Int
    var term: String
    var dateRange: String
    var canvasCourseID: Int?

    enum CodingKeys: String, CodingKey {
        case id, code, section, title, crn, credits, instructor, location, campus, days, term
        case scheduleType = "schedule_type"; case startMinutes = "start_minutes"; case endMinutes = "end_minutes"
        case dateRange = "date_range"; case canvasCourseID = "canvas_course_id"
    }
}

struct CustomAssignment: Codable, Identifiable, Hashable {
    var id: Int
    var courseID: Int
    var name: String
    var dueAt: String?
    var pointsPossible: Double?
    var notes: String
    var createdAt: String
    var estimatedMinutes: Int? = nil
    enum CodingKeys: String, CodingKey {
        case id, name, notes
        case courseID = "course_id"; case dueAt = "due_at"; case pointsPossible = "points_possible"; case createdAt = "created_at"
        case estimatedMinutes = "estimated_minutes"
    }
}

/// Decodes what it can of a list, skipping entries it can't read.
struct NativeLossy<T: Decodable>: Decodable {
    let value: T?
    init(from decoder: Decoder) throws { value = try? T(from: decoder) }
}

struct CalendarPick: Codable, Identifiable, Hashable {
    var assignmentID: Int
    var title: String
    var context: String
    var at: String
    var dueAt: String?
    var id: Int { assignmentID }
    enum CodingKeys: String, CodingKey { case title, context, at; case assignmentID = "assignmentId"; case dueAt = "dueAt" }
}

struct AssignmentMeta: Codable, Hashable {
    let assignmentID: Int
    let estimatedMinutes: Int?
    let progressPercent: Int?
    enum CodingKeys: String, CodingKey { case assignmentID = "assignment_id"; case estimatedMinutes = "estimated_minutes"; case progressPercent = "progress_percent" }
}

struct ScheduledAlert: Codable, Identifiable, Hashable {
    let id: String
    let title: String
    let body: String
    let fireAt: String
    let sentAt: String?
    let toPath: String
    enum CodingKeys: String, CodingKey { case id, title, body; case fireAt = "fire_at"; case sentAt = "sent_at"; case toPath = "to_path" }
}

struct NotificationPreferences: Equatable {
    var enabled = true
    var due1w = false
    var due3d = true
    var due2d = true
    var due1d = true
    var grades = true
    var announcements = true
    var gradeThreshold = 80.0
    var browserPush = true
    var quietEnabled = true
    var quietStart = 22
    var quietEnd = 7
    var countdownClass = false
    var countdownLeads = [15]
    var countdownTonight = false
    var countdownTonightHours = [18]
    var badge = false
    /// "Don't break your streak!!!" at 6 PM.
    var streakReminder = true

    init(_ raw: [String: Any]? = nil) {
        guard let raw else { return }
        enabled = raw["enabled"] as? Bool ?? enabled; due1w = raw["due1w"] as? Bool ?? due1w
        due3d = raw["due3d"] as? Bool ?? due3d; due2d = raw["due2d"] as? Bool ?? due2d; due1d = raw["due1d"] as? Bool ?? due1d
        grades = raw["grades"] as? Bool ?? grades; announcements = raw["announcements"] as? Bool ?? announcements
        gradeThreshold = (raw["gradeThreshold"] as? NSNumber)?.doubleValue ?? gradeThreshold
        browserPush = raw["browserPush"] as? Bool ?? browserPush; quietEnabled = raw["quietEnabled"] as? Bool ?? quietEnabled
        quietStart = (raw["quietStart"] as? NSNumber)?.intValue ?? quietStart; quietEnd = (raw["quietEnd"] as? NSNumber)?.intValue ?? quietEnd
        countdownClass = raw["countdownClass"] as? Bool ?? countdownClass
        countdownLeads = raw["countdownLeads"] as? [Int] ?? countdownLeads
        countdownTonight = raw["countdownTonight"] as? Bool ?? countdownTonight
        countdownTonightHours = raw["countdownTonightHours"] as? [Int] ?? countdownTonightHours
        badge = raw["badge"] as? Bool ?? badge
        streakReminder = raw["streakReminder"] as? Bool ?? streakReminder
    }

    var dictionary: [String: Any] {[
        "enabled": enabled, "due1w": due1w, "due3d": due3d, "due2d": due2d, "due1d": due1d,
        "grades": grades, "announcements": announcements, "gradeThreshold": gradeThreshold,
        "browserPush": browserPush, "quietEnabled": quietEnabled, "quietStart": quietStart, "quietEnd": quietEnd,
        "countdownClass": countdownClass, "countdownLeads": countdownLeads,
        "countdownTonight": countdownTonight, "countdownTonightHours": countdownTonightHours, "badge": badge,
        "streakReminder": streakReminder,
    ]}
}

extension NativeAPI {
    func signedAvatarURL(path: String, token: String) async throws -> URL {
        var request = try request(path: "/storage/v1/object/sign/profile-avatars/\(path)", token: token)
        request.httpMethod = "POST"
        request.httpBody = try JSONSerialization.data(withJSONObject: ["expiresIn": 3600])
        guard let object = try await json(request) as? [String: Any],
              let signedPath = object["signedURL"] as? String,
              let url = URL(string: signedPath.hasPrefix("/storage/v1/") ? signedPath : "/storage/v1\(signedPath.hasPrefix("/") ? "" : "/")\(signedPath)", relativeTo: configuration.supabaseURL)?.absoluteURL else {
            throw NativeAppError.server("Could not display the profile photo.")
        }
        return url
    }

    func uploadAvatar(_ imageData: Data, contentType: String, userID: String, token: String) async throws {
        let path = "\(userID)/avatar"
        var request = try request(path: "/storage/v1/object/profile-avatars/\(path)", token: token)
        request.httpMethod = "POST"
        request.setValue(contentType, forHTTPHeaderField: "Content-Type")
        request.setValue("true", forHTTPHeaderField: "x-upsert")
        request.httpBody = imageData
        _ = try await data(request)
        try await setAvatarPath(path, token: token)
    }

    func removeAvatar(path: String, token: String) async throws {
        var request = try request(path: "/storage/v1/object/profile-avatars", token: token)
        request.httpMethod = "DELETE"
        request.httpBody = try JSONSerialization.data(withJSONObject: ["prefixes": [path]])
        _ = try await data(request)
        try await setAvatarPath(nil, token: token)
    }

    private func setAvatarPath(_ path: String?, token: String) async throws {
        var request = try request(path: "/rest/v1/rpc/set_avatar_path", token: token)
        request.httpMethod = "POST"
        request.httpBody = try JSONSerialization.data(withJSONObject: ["requested_path": path as Any? ?? NSNull()])
        _ = try await data(request)
        var metadataRequest = try self.request(path: "/auth/v1/user", token: token)
        metadataRequest.httpMethod = "PUT"
        metadataRequest.httpBody = try JSONSerialization.data(withJSONObject: ["data": ["avatar_path": path as Any? ?? NSNull()]])
        _ = try await data(metadataRequest)
    }

    func accountDetails(token: String) async throws -> NativeAccountDetails {
        let object = try await json(request(path: "/auth/v1/user", token: token)) as? [String: Any] ?? [:]
        return NativeAccountDetails(object["user_metadata"] as? [String: Any] ?? [:])
    }

    func saveAccountDetails(_ details: NativeAccountDetails, username: String, avatarPath: String?, token: String) async throws {
        var metadata = details.metadata
        metadata["username"] = username
        metadata["avatar_path"] = avatarPath as Any? ?? NSNull()
        var request = try request(path: "/auth/v1/user", token: token)
        request.httpMethod = "PUT"
        request.httpBody = try JSONSerialization.data(withJSONObject: ["data": metadata])
        _ = try await data(request)
    }

    func preferences(token: String, userID: String) async throws -> [String: JSONValue] {
        let request = try request(path: "/rest/v1/user_preferences", token: token, query: [
            .init(name: "select", value: "key,value"), .init(name: "user_id", value: "eq.\(userID)"),
        ])
        let rows = try decoder.decode([UserPreferenceRow].self, from: await data(request))
        return Dictionary(rows.map { ($0.key, $0.value) }, uniquingKeysWith: { first, _ in first })
    }

    func savePreference(key: String, value: JSONValue, token: String, userID: String) async throws {
        try await upsert(table: "user_preferences", token: token, conflict: "user_id,key", rows: [[
            "user_id": userID, "key": key, "value": value.foundation,
        ]])
    }

    func accountProfile(token: String, userID: String) async throws -> AccountProfile {
        let request = try request(path: "/rest/v1/account_profiles", token: token, query: [
            .init(name: "select", value: "username,avatar_path"), .init(name: "user_id", value: "eq.\(userID)"), .init(name: "limit", value: "1"),
        ])
        return try decoder.decode([AccountProfile].self, from: await data(request)).first ?? AccountProfile()
    }

    func setUsername(_ username: String, token: String) async throws {
        var request = try request(path: "/rest/v1/rpc/set_username", token: token)
        request.httpMethod = "POST"
        request.httpBody = try JSONSerialization.data(withJSONObject: ["requested_username": username])
        _ = try await data(request)
    }

    func usernameAvailable(_ username: String, token: String) async throws -> Bool {
        var request = try request(path: "/rest/v1/rpc/username_available", token: token)
        request.httpMethod = "POST"
        request.httpBody = try JSONSerialization.data(withJSONObject: ["requested_username": username])
        // Supabase returns a top-level JSON boolean for this RPC.
        return try JSONDecoder().decode(Bool.self, from: await data(request))
    }

    func classSchedule(token: String, userID: String) async throws -> [ClassScheduleEntry] {
        let request = try request(path: "/rest/v1/class_schedule_entries", token: token, query: [
            .init(name: "select", value: "id,code,section,title,crn,credits,instructor,location,campus,schedule_type,days,start_minutes,end_minutes,term,date_range,canvas_course_id"),
            .init(name: "user_id", value: "eq.\(userID)"), .init(name: "order", value: "start_minutes.asc"),
        ])
        return try decoder.decode([ClassScheduleEntry].self, from: await data(request))
    }

    func saveScheduleEntry(_ entry: ClassScheduleEntry, token: String, userID: String) async throws {
        var row: [String: Any] = [
            "user_id": userID, "code": entry.code, "section": entry.section, "title": entry.title,
            "crn": entry.crn, "credits": entry.credits, "instructor": entry.instructor,
            "location": entry.location, "campus": entry.campus, "schedule_type": entry.scheduleType,
            "days": entry.days, "start_minutes": entry.startMinutes, "end_minutes": entry.endMinutes,
            "term": entry.term, "date_range": entry.dateRange,
        ]
        if !entry.id.isEmpty { row["id"] = entry.id }
        if let courseID = entry.canvasCourseID { row["canvas_course_id"] = courseID }
        try await upsert(table: "class_schedule_entries", token: token, conflict: "id", rows: [row])
    }

    func deleteScheduleEntry(id: String, token: String) async throws {
        var request = try request(path: "/rest/v1/class_schedule_entries", token: token, query: [.init(name: "id", value: "eq.\(id)")])
        request.httpMethod = "DELETE"; _ = try await data(request)
    }

    func assignmentMeta(token: String, userID: String) async throws -> [AssignmentMeta] {
        let request = try request(path: "/rest/v1/user_assignment_meta", token: token, query: [
            .init(name: "select", value: "assignment_id,estimated_minutes,progress_percent"), .init(name: "user_id", value: "eq.\(userID)"),
        ])
        return try decoder.decode([AssignmentMeta].self, from: await data(request))
    }

    func saveEstimate(assignmentID: Int, courseID: Int, minutes: Int?, token: String, userID: String) async throws {
        try await upsert(table: "user_assignment_meta", token: token, conflict: "user_id,assignment_id", rows: [[
            "user_id": userID, "assignment_id": assignmentID, "course_id": courseID,
            "estimated_minutes": minutes as Any? ?? NSNull(),
        ]])
    }

    func saveProgress(assignmentID: Int, courseID: Int, percent: Int?, token: String, userID: String) async throws {
        try await upsert(table: "user_assignment_meta", token: token, conflict: "user_id,assignment_id", rows: [[
            "user_id": userID, "assignment_id": assignmentID, "course_id": courseID,
            "progress_percent": percent as Any? ?? NSNull(),
        ]])
    }

    func scheduledAlerts(token: String, userID: String) async throws -> [ScheduledAlert] {
        let request = try request(path: "/rest/v1/push_scheduled_alerts", token: token, query: [
            .init(name: "select", value: "id,title,body,fire_at,sent_at,to_path"), .init(name: "user_id", value: "eq.\(userID)"), .init(name: "order", value: "fire_at.desc"), .init(name: "limit", value: "100"),
        ])
        return try decoder.decode([ScheduledAlert].self, from: await data(request))
    }
}

private struct NativePreviewFeatureState: Codable {
    let preferences: [String: JSONValue]
    let profile: AccountProfile
    let schedule: [ClassScheduleEntry]
    let estimates: [Int: Int]
    var progress: [Int: Int]? = nil
}

@MainActor
final class NativeFeatureStore: ObservableObject {
    @Published var preferences: [String: JSONValue] = [:]
    @Published var profile = AccountProfile()
    @Published var accountDetails = NativeAccountDetails()
    @Published var avatarURL: URL?
    @Published var schedule: [ClassScheduleEntry] = []
    @Published var customAssignments: [CustomAssignment] = []
    @Published var calendarPicks: [CalendarPick] = []
    @Published var estimates: [Int: Int] = [:]
    /// Percent done per assignment, shared with the website.
    @Published var progress: [Int: Int] = [:]
    @Published var alerts: [ScheduledAlert] = []
    @Published var notificationPreferences = NotificationPreferences()
    private var savedNotificationPreferences = NotificationPreferences()
    /// False until the account's saved notification settings have loaded, so an
    /// offline launch never plans reminders (or saves) from the defaults.
    @Published var notificationPreferencesLoaded = false
    /// False until the account's saved preferences have loaded, so the widget
    /// picker never appears for someone who has already chosen.
    @Published var preferencesLoaded = false
    @Published var isLoading = false
    @Published var errorMessage: String?
    let isPreview: Bool
    unowned let sessionStore: NativeSessionStore
    // Versioned: saves from the earlier, smaller sample set are ignored.
    private let previewStateKey = "CanvasProPreviewFeatureState2"
    private var savesInFlight = 0

    /// The account's settings, estimates and progress from the last load, so a
    /// launch (or an offline one) hides the right classes and shows the
    /// student's own work before the account answers.
    private struct SavedState: Codable {
        var preferences: [String: JSONValue]
        var estimates: [Int: Int]
        var progress: [Int: Int]
    }
    nonisolated static func savedStateKey(userID: String) -> String { "CanvasProNativeFeatureCache.\(userID)" }
    private var savedStateKey: String? { sessionStore.session.map { Self.savedStateKey(userID: $0.user.id) } }

    private func loadSavedState() {
        guard let key = savedStateKey, let data = UserDefaults.standard.data(forKey: key),
              let saved = try? JSONDecoder().decode(SavedState.self, from: data) else { return }
        preferences = saved.preferences
        estimates = saved.estimates
        progress = saved.progress
        decodePreferenceModels()
    }

    private func persistSavedState() {
        guard !isPreview, let key = savedStateKey,
              let data = try? JSONEncoder().encode(SavedState(preferences: preferences, estimates: estimates, progress: progress)) else { return }
        UserDefaults.standard.set(data, forKey: key)
    }

    init(sessionStore: NativeSessionStore, preview: Bool = false) {
        self.sessionStore = sessionStore
        isPreview = preview
        notificationPreferencesLoaded = preview
        preferencesLoaded = preview
        if preview {
            if let data = UserDefaults.standard.data(forKey: previewStateKey),
               let saved = try? JSONDecoder().decode(NativePreviewFeatureState.self, from: data) {
                preferences = saved.preferences; profile = saved.profile; schedule = saved.schedule; estimates = saved.estimates; progress = saved.progress ?? [:]
                decodePreferenceModels()
            } else {
                profile = AccountProfile(username: "Preview Student", avatarPath: nil)
                schedule = [
                    ClassScheduleEntry(id: "preview-1", code: "BIO 201", section: "01", title: "Cell Biology", crn: "", credits: 4, instructor: "Dr. Rivera", location: "Science Hall 101", campus: "", scheduleType: "Lecture", days: ["M", "W"], startMinutes: 600, endMinutes: 675, term: "", dateRange: "", canvasCourseID: 9101),
                    ClassScheduleEntry(id: "preview-2", code: "ENG 102", section: "02", title: "College Writing", crn: "", credits: 3, instructor: "Prof. Chen", location: "Humanities 118", campus: "", scheduleType: "Lecture", days: ["T", "R"], startMinutes: 780, endMinutes: 855, term: "", dateRange: "", canvasCourseID: 9104),
                ]
                // The sample student's saved estimates and progress, as on the website.
                estimates = [8010: 90, 8014: 120, 8012: 60]
                progress = [8010: 75, 8014: 40]
            }
        } else {
            loadSavedState()
        }
    }

    /// Loads to the end even if the screen that asked (pull to refresh) redraws.
    /// A second request while one is running waits for it instead of returning at once.
    func load() async {
        if let running = currentLoad { await running.value; return }
        let task = Task { await performLoad() }
        currentLoad = task
        await task.value
        currentLoad = nil
    }
    private var currentLoad: Task<Void, Never>?

    private func performLoad() async {
        guard !isPreview else { return }
        guard let api = sessionStore.api, let user = sessionStore.session?.user else { return }
        guard !isLoading else { return }
        isLoading = true; errorMessage = nil; defer { isLoading = false }
        do {
            let token = try await sessionStore.accessToken()
            preferences = try await api.preferences(token: token, userID: user.id)
            preferencesLoaded = true
            decodePreferenceModels()
            applyAppearancePreferences()
            await moveLocalDismissedAnnouncements()
            await moveLocalTodoGrouping()
            async let profileRow = api.accountProfile(token: token, userID: user.id)
            async let detailsRow = api.accountDetails(token: token)
            async let scheduleRows = api.classSchedule(token: token, userID: user.id)
            async let metaRows = api.assignmentMeta(token: token, userID: user.id)
            async let alertRows = api.scheduledAlerts(token: token, userID: user.id)
            async let notificationRow = api.notificationPreferences(token: token, userID: user.id)
            if let value = try? await profileRow {
                profile = value
                if let path = value.avatarPath, !path.isEmpty { avatarURL = try? await api.signedAvatarURL(path: path, token: token) }
                else { avatarURL = nil }
            }
            if let value = try? await detailsRow { accountDetails = value }
            if let value = try? await scheduleRows { schedule = value }
            if let metas = try? await metaRows {
                estimates = Dictionary(metas.map { ($0.assignmentID, $0.estimatedMinutes ?? 0) }, uniquingKeysWith: { first, _ in first })
                var saved: [Int: Int] = [:]
                for meta in metas { if let percent = meta.progressPercent, percent > 0 { saved[meta.assignmentID] = min(100, percent) } }
                progress = saved
            }
            if let value = try? await alertRows { alerts = value }
            persistSavedState()
            // A new account has no saved row yet; the defaults are its settings.
            do {
                let row = try await notificationRow
                notificationPreferences = NotificationPreferences(row)
                savedNotificationPreferences = notificationPreferences
                notificationPreferencesLoaded = true
            } catch {}
        } catch is CancellationError {
            // Nothing to report: the request was stopped, not refused.
        } catch let error as URLError where error.code == .cancelled {
        } catch { errorMessage = error.localizedDescription }
    }

    /// Picks up changes made on the website while the app is open, such as a new
    /// theme. Skipped while this phone is saving, so a refresh can't undo a choice
    /// that hasn't reached the account yet.
    func refreshPreferences() async {
        guard !isPreview, !isLoading, savesInFlight == 0 else { return }
        guard let api = sessionStore.api, let user = sessionStore.session?.user else { return }
        guard let token = try? await sessionStore.accessToken(),
              let fresh = try? await api.preferences(token: token, userID: user.id) else { return }
        guard savesInFlight == 0, !isLoading, fresh != preferences else { return }
        preferences = fresh
        decodePreferenceModels()
        persistSavedState()
        applyAppearancePreferences()
    }

    func savePreference<T: Encodable>(_ key: String, _ value: T) async throws {
        savesInFlight += 1
        defer { savesInFlight -= 1 }
        let data = try JSONEncoder().encode(value)
        let json = try JSONDecoder().decode(JSONValue.self, from: data)
        let previous = preferences[key]
        preferences[key] = json
        // The sample preview keeps its choices on this phone, and still shows them.
        if isPreview { decodePreferenceModels(); applyAppearancePreferences(); persistPreviewState(); return }
        decodePreferenceModels()
        applyAppearancePreferences()
        do {
            guard let api = sessionStore.api, let user = sessionStore.session?.user else { throw NativeAppError.signedOut }
            try await api.savePreference(key: key, value: json, token: try await sessionStore.accessToken(), userID: user.id)
            persistSavedState()
        } catch {
            if preferences[key] == json {
                if let previous { preferences[key] = previous } else { preferences.removeValue(forKey: key) }
                decodePreferenceModels()
                applyAppearancePreferences()
            }
            throw error
        }
    }

    /// Pick up an all-devices pause without replacing this phone's unsaved edits.
    func refreshNotificationPreferences() async {
        guard !isPreview, !isLoading, savesInFlight == 0,
              notificationPreferencesLoaded, notificationPreferences == savedNotificationPreferences,
              let api = sessionStore.api, let user = sessionStore.session?.user else { return }
        let previous = notificationPreferences
        do {
            let row = try await api.notificationPreferences(token: try await sessionStore.accessToken(), userID: user.id)
            guard savesInFlight == 0, notificationPreferences == previous else { return }
            notificationPreferences = NotificationPreferences(row)
            savedNotificationPreferences = notificationPreferences
        } catch { /* Keep the last known settings offline. */ }
    }

    func saveNotifications() async throws {
        if isPreview { return }
        guard let api = sessionStore.api, let user = sessionStore.session?.user else { throw NativeAppError.signedOut }
        let current = notificationPreferences
        let previous = savedNotificationPreferences.dictionary
        let changes = current.dictionary.filter { entry in
            !((previous[entry.key] as? NSObject)?.isEqual(entry.value) ?? false)
        }
        guard !changes.isEmpty else { return }
        savesInFlight += 1
        defer { savesInFlight -= 1 }
        try await api.syncNotificationPreferences(changes, token: try await sessionStore.accessToken(), userID: user.id)
        savedNotificationPreferences = current
    }

    func saveUsername(_ username: String) async throws {
        if isPreview { profile.username = username; persistPreviewState(); return }
        guard let api = sessionStore.api else { throw NativeAppError.signedOut }
        try await api.setUsername(username, token: try await sessionStore.accessToken())
        profile.username = username
    }

    func saveAccountDetails(_ details: NativeAccountDetails, username: String) async throws {
        guard let api = sessionStore.api else { throw NativeAppError.signedOut }
        let token = try await sessionStore.accessToken()
        let normalized = username.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if !normalized.isEmpty && normalized != (profile.username ?? "") {
            guard normalized.range(of: "^[a-z0-9_]{3,24}$", options: .regularExpression) != nil else {
                throw NativeAppError.server("Username must be 3–24 lowercase letters, numbers, or underscores.")
            }
            try await api.setUsername(normalized, token: token)
            profile.username = normalized
        }
        try await api.saveAccountDetails(details, username: normalized, avatarPath: profile.avatarPath, token: token)
        accountDetails = details
    }

    func usernameAvailable(_ username: String) async throws -> Bool {
        guard let api = sessionStore.api else { throw NativeAppError.signedOut }
        return try await api.usernameAvailable(username, token: try await sessionStore.accessToken())
    }

    func uploadAvatar(_ imageData: Data, contentType: String) async throws {
        guard imageData.count <= 5 * 1024 * 1024 else { throw NativeAppError.server("Profile photos must be 5 MB or smaller.") }
        guard let api = sessionStore.api, let user = sessionStore.session?.user else { throw NativeAppError.signedOut }
        let token = try await sessionStore.accessToken()
        try await api.uploadAvatar(imageData, contentType: contentType, userID: user.id, token: token)
        let path = "\(user.id)/avatar"
        profile.avatarPath = path
        avatarURL = try? await api.signedAvatarURL(path: path, token: token)
    }

    func removeAvatar() async throws {
        guard let path = profile.avatarPath, !path.isEmpty else { return }
        guard let api = sessionStore.api else { throw NativeAppError.signedOut }
        try await api.removeAvatar(path: path, token: try await sessionStore.accessToken())
        profile.avatarPath = nil
        avatarURL = nil
    }

    func saveEstimate(_ minutes: Int?, for assignment: AssignmentItem) async throws {
        if isPreview { estimates[assignment.id] = minutes ?? 0; persistPreviewState(); return }
        guard let api = sessionStore.api, let user = sessionStore.session?.user else { throw NativeAppError.signedOut }
        try await api.saveEstimate(assignmentID: assignment.id, courseID: assignment.courseID, minutes: minutes, token: try await sessionStore.accessToken(), userID: user.id)
        estimates[assignment.id] = minutes ?? 0
        persistSavedState()
    }

    func saveProgress(_ percent: Int?, for assignment: AssignmentItem) async throws {
        if isPreview { progress[assignment.id] = percent; persistPreviewState(); return }
        guard let api = sessionStore.api, let user = sessionStore.session?.user else { throw NativeAppError.signedOut }
        let previous = progress[assignment.id]
        progress[assignment.id] = percent
        do {
            try await api.saveProgress(assignmentID: assignment.id, courseID: assignment.courseID, percent: percent, token: try await sessionStore.accessToken(), userID: user.id)
            persistSavedState()
        } catch {
            progress[assignment.id] = previous
            throw error
        }
    }

    private func decodePreferenceModels() {
        let decoder = JSONDecoder()
        customAssignments = preferences["custom-assignments"].flatMap { value in (try? JSONEncoder().encode(value)).flatMap { try? decoder.decode([CustomAssignment].self, from: $0) } } ?? []
        calendarPicks = preferences["calendar-picks"].flatMap { value in (try? JSONEncoder().encode(value)).flatMap { try? decoder.decode([CalendarPick].self, from: $0) } } ?? []
    }

    /// Mirrors the account's theme. A color or background the account never
    /// chose falls back to the website's defaults (Forest, plain color), so a
    /// previous account's choice never lingers on this phone.
    private func applyAppearancePreferences() {
        let defaults = UserDefaults.standard
        if case .some(.string(let mode)) = preferences["theme"], ["light", "dark", "system"].contains(mode) {
            defaults.set(mode, forKey: "CanvasProColorScheme")
        }
        var palette = "forest"
        if case .some(.string(let saved)) = preferences["color_theme"], CPPalette(rawValue: saved) != nil { palette = saved }
        var wallpaper = "plain"
        if case .some(.string(let saved)) = preferences["wallpaper"], ["wave", "glow", "plain"].contains(saved) { wallpaper = saved }
        // Only write a change, so a refresh doesn't redraw every themed view.
        if defaults.string(forKey: "CanvasProPalette") != palette {
            defaults.set(palette, forKey: "CanvasProPalette")
            CanvasProWidgetStore.updatePalette(palette)
        }
        if defaults.string(forKey: "CanvasProWallpaper") != wallpaper { defaults.set(wallpaper, forKey: "CanvasProWallpaper") }
    }

    var announcementWeeks: Int {
        guard case .some(.number(let value)) = preferences["announcement_window_weeks"], [0, 1, 2, 4].contains(Int(value)) else { return 1 }
        return Int(value)
    }

    /// Every website widget, in the website's default order.
    static let defaultDashboardOrder = ["digest", "classes", "upcoming", "focus", "calendar", "announcements", "gpa", "heatmap"]
    /// The widgets the app draws. GPA is left out: it can't be exact from Canvas
    /// scores (schools' scales differ, current scores aren't final grades, and past
    /// terms aren't included). It keeps its slot in the website's saved layout.
    private var dashboardWidgets: [String] { Self.defaultDashboardOrder.filter { $0 != "gpa" && $0 != "calendar" } }
    /// The website's full default order, used to keep saved slots in place.
    private let websiteDashboardOrder = ["digest", "classes", "upcoming", "focus", "calendar", "announcements", "gpa", "heatmap"]
    /// Whether this iPhone and the website share one dashboard (Settings >
    /// Dashboard). On unless the student turned it off.
    var dashboardSyncsWithWebsite: Bool {
        if case .some(.bool(let value)) = preferences["dashboard-sync"] { return value }
        return true
    }
    /// The shared layout, or the iPhone's own when it doesn't sync. Both are saved
    /// to the account, so another iPhone signed in to it looks the same.
    private var dashboardKey: String { dashboardSyncsWithWebsite ? "dashboard-layout" : "dashboard-layout-iphone" }
    private var dashboardObject: [String: JSONValue] {
        if case .some(.object(let value)) = preferences[dashboardKey] { return value }
        return [:]
    }
    /// The student has chosen their widgets for this layout (the picker shows once).
    var dashboardPicked: Bool {
        if case .some(.string) = dashboardObject["picked_at"] { return true }
        return false
    }
    /// The widgets the picker offers, in the website's order.
    var pickableDashboardWidgets: [String] { dashboardWidgets }
    var dashboardOrder: [String] {
        let saved: [String]
        if case .some(.array(let values)) = dashboardObject["order"] {
            saved = values.compactMap { if case .string(let value) = $0 { return value }; return nil }
        } else { saved = [] }
        var order = saved.filter { dashboardWidgets.contains($0) }
        for widget in dashboardWidgets where !order.contains(widget) { order.append(widget) }
        return order
    }
    var dashboardHidden: Set<String> {
        // A new account starts with the five essentials; Customize brings the rest back.
        guard case .some(.array(let values)) = dashboardObject["hidden"] else { return ["focus", "heatmap"] }
        return Set(values.compactMap { if case .string(let value) = $0 { return value }; return nil })
    }
    func updateDashboard(order: [String]? = nil, hidden: Set<String>? = nil, picked: Bool = false) async throws {
        var layout = dashboardObject
        var full: [String] = []
        if case .some(.array(let values)) = layout["order"] {
            full = values.compactMap { if case .string(let value) = $0 { return value }; return nil }
        }
        if full.isEmpty { full = websiteDashboardOrder }
        for widget in websiteDashboardOrder where !full.contains(widget) { full.append(widget) }
        // Put this app's widgets, in their new order, into the slots they already
        // hold, so any widget the app doesn't know keeps its place.
        var queue = ArraySlice(order ?? dashboardOrder)
        full = full.map { widget in dashboardWidgets.contains(widget) ? (queue.popFirst() ?? widget) : widget }
        for widget in queue where !full.contains(widget) { full.append(widget) }
        layout["order"] = .array(full.map(JSONValue.string))
        layout["hidden"] = .array((hidden ?? dashboardHidden).sorted().map(JSONValue.string))
        if layout["sizes"] == nil { layout["sizes"] = .object([:]) }
        if picked { layout["picked_at"] = .string(ISO8601DateFormatter().string(from: Date())) }
        try await savePreference(dashboardKey, JSONValue.object(layout))
    }

    /// Saves the picker's choice: the picked widgets in the order shown, every
    /// other widget hidden. A widget only the website has keeps its setting.
    func saveDashboardPicks(_ picks: Set<String>) async throws {
        let order = dashboardOrder.filter { picks.contains($0) } + dashboardOrder.filter { !picks.contains($0) }
        let websiteOnly = dashboardHidden.subtracting(dashboardWidgets)
        let hidden = Set(dashboardWidgets.filter { !picks.contains($0) }).union(websiteOnly)
        try await updateDashboard(order: order, hidden: hidden, picked: true)
    }

    /// The answers' plan (Why did you download CoursePro?): these widgets first,
    /// in this order, every other one hidden. A website-only widget keeps its setting.
    func saveDashboardPlan(_ ordered: [String]) async throws {
        let plan = ordered.filter { dashboardWidgets.contains($0) }
        let order = plan + dashboardOrder.filter { !plan.contains($0) }
        let websiteOnly = dashboardHidden.subtracting(dashboardWidgets)
        let hidden = Set(dashboardWidgets.filter { !plan.contains($0) }).union(websiteOnly)
        try await updateDashboard(order: order, hidden: hidden, picked: true)
    }

    /// The answers to "Why did you download CoursePro?" (`download-reasons`), the website's too.
    func saveDownloadReasons(_ ids: [String]) async throws {
        try await savePreference("download-reasons", ids)
    }

    /// Turns sharing the dashboard with the website on or off. Turning it off
    /// starts the iPhone's own layout as a copy of the shared one. Turning it
    /// back on keeps the website's layout, or puts the iPhone's in its place.
    func setDashboardSync(_ on: Bool, keepIPhoneLayout: Bool = false) async throws {
        guard on != dashboardSyncsWithWebsite else { return }
        if on {
            let mine = dashboardObject
            try await savePreference("dashboard-sync", true)
            if keepIPhoneLayout {
                let order = Self.strings(mine["order"]).filter { dashboardWidgets.contains($0) }
                let hidden = Set(Self.strings(mine["hidden"]))
                try await updateDashboard(order: order.isEmpty ? nil : order, hidden: hidden, picked: mine["picked_at"] != nil)
            }
        } else {
            try await savePreference("dashboard-layout-iphone", preferences["dashboard-layout"] ?? JSONValue.object([:]))
            try await savePreference("dashboard-sync", false)
        }
    }

    private static func strings(_ value: JSONValue?) -> [String] {
        guard case .some(.array(let values)) = value else { return [] }
        return values.compactMap { if case .string(let text) = $0 { return text }; return nil }
    }

    func persistPreviewState() {
        guard isPreview else { return }
        let state = NativePreviewFeatureState(preferences: preferences, profile: profile, schedule: schedule, estimates: estimates, progress: progress)
        if let data = try? JSONEncoder().encode(state) { UserDefaults.standard.set(data, forKey: previewStateKey) }
    }

    var hiddenCourseIDs: Set<Int> {
        guard case .some(.array(let values)) = preferences["hidden_course_ids"] else { return [] }
        return Set(values.compactMap { value -> Int? in
            switch value {
            case .number(let id): return id.isFinite ? Int(id) : nil
            case .string(let id): return Int(id)
            default: return nil
            }
        })
    }

    // MARK: Synced across devices
    //
    // Saved to the account under the website's keys and in its format, so the
    // phone and every browser agree on what's been seen, dismissed and chosen.

    private func decoded<T: Decodable>(_ key: String, as type: T.Type) -> T? {
        guard let value = preferences[key], let data = try? JSONEncoder().encode(value) else { return nil }
        return try? JSONDecoder().decode(T.self, from: data)
    }

    /// Since your last visit (`digest-seen`).
    var digestSeen: NativeDigestSeen? {
        guard let seen = decoded("digest-seen", as: NativeDigestSeen.self),
              ISO8601DateFormatter.canvasDate(from: seen.lastVisit) != nil else { return nil }
        return seen
    }
    func saveDigestSeen(_ seen: NativeDigestSeen) async {
        guard digestSeen != seen else { return }
        try? await savePreference("digest-seen", seen)
    }

    /// Announcements dismissed on any device (`dismissed-announcements`, ids as text).
    var dismissedAnnouncementIDs: Set<Int> {
        guard case .some(.array(let values)) = preferences["dismissed-announcements"] else { return [] }
        return Set(values.compactMap { value -> Int? in
            switch value {
            case .string(let id): return Int(id)
            case .number(let id): return id.isFinite ? Int(id) : nil
            default: return nil
            }
        })
    }
    func setDismissedAnnouncements(_ ids: Set<Int>) async {
        guard ids != dismissedAnnouncementIDs else { return }
        // A failed save puts the announcement back, so say why rather than let it reappear silently.
        do { try await savePreference("dismissed-announcements", ids.sorted().map(String.init)) }
        catch { errorMessage = "Couldn't hide that announcement. \(error.localizedDescription)" }
    }

    /// Before syncing, dismissed announcements were kept on this phone: added to
    /// the account's list once, then forgotten here.
    func moveLocalDismissedAnnouncements() async {
        let key = "CanvasProDismissedAnnouncements"
        let local = Set((UserDefaults.standard.string(forKey: key) ?? "").split(separator: ",").compactMap { Int($0) })
        guard preferencesLoaded, !local.isEmpty else { return }
        await setDismissedAnnouncements(dismissedAnnouncementIDs.union(local))
        UserDefaults.standard.removeObject(forKey: key)
    }

    /// To-Do by day, by class or by impact (`todo-grouping`: "day", "class" or "impact").
    var todoGrouping: String {
        if case .some(.string(let value)) = preferences["todo-grouping"], value == "class" || value == "impact" { return value }
        return "day"
    }

    /// Steps for big work (`assignment-steps`: assignment id → steps), the website's too.
    var assignmentSteps: [Int: [NativeAssignmentStep]] {
        guard let saved = decoded("assignment-steps", as: [String: [NativeLossy<NativeAssignmentStep>]].self) else { return [:] }
        var out: [Int: [NativeAssignmentStep]] = [:]
        for (key, list) in saved {
            let steps = list.compactMap(\.value)
            if let id = Int(key), !steps.isEmpty { out[id] = steps }
        }
        return out
    }
    /// Saves an assignment's steps; its progress follows them (cleared when the last step goes).
    func saveSteps(_ steps: [NativeAssignmentStep], for assignment: AssignmentItem) async throws {
        var all: [String: JSONValue] = [:]
        if case .some(.object(let saved)) = preferences["assignment-steps"] { all = saved }
        let key = String(assignment.id)
        if steps.isEmpty {
            all.removeValue(forKey: key)
        } else {
            all[key] = try JSONDecoder().decode(JSONValue.self, from: JSONEncoder().encode(steps))
        }
        try await savePreference("assignment-steps", all)
        try await saveProgress(steps.isEmpty ? nil : NativeSteps.percent(steps), for: assignment)
    }

    /// How far back Completed looks (`completed-range`, in days), the website's too.
    var completedRangeDays: Int {
        if case .some(.number(let days)) = preferences["completed-range"], NativeCompletedRange.days.contains(Int(days)) { return Int(days) }
        return NativeCompletedRange.defaultDays
    }
    func setCompletedRange(_ days: Int) async {
        guard days != completedRangeDays || preferences["completed-range"] == nil else { return }
        try? await savePreference("completed-range", days)
    }

    /// The optional weekly rhythm on To-Do (`weekly-rhythm`), off until turned on.
    var showsWeeklyRhythm: Bool {
        if case .some(.bool(true)) = preferences["weekly-rhythm"] { return true }
        return false
    }
    func setWeeklyRhythm(_ on: Bool) async {
        guard on != showsWeeklyRhythm else { return }
        try? await savePreference("weekly-rhythm", on)
    }
    func setTodoGrouping(_ value: String) async {
        guard value != todoGrouping || preferences["todo-grouping"] == nil else { return }
        try? await savePreference("todo-grouping", value)
    }

    /// Before syncing, To-Do's grouping was kept on this phone: saved to the account once.
    func moveLocalTodoGrouping() async {
        let key = "CanvasProAssignmentsGrouping"
        guard preferencesLoaded, let local = UserDefaults.standard.string(forKey: key) else { return }
        if preferences["todo-grouping"] == nil { await setTodoGrouping(local == "By class" ? "class" : "day") }
        UserDefaults.standard.removeObject(forKey: key)
    }

    /// The study time choice (`study-setup`).
    var studySetup: NativeStudySetup? {
        guard let setup = decoded("study-setup", as: NativeStudySetup.self),
              ["total", "per", "pomodoro"].contains(setup.mode) else { return nil }
        return setup
    }
    func saveStudySetup(_ setup: NativeStudySetup) async {
        guard studySetup != setup else { return }
        try? await savePreference("study-setup", setup)
    }

    /// The day the streak was last celebrated (`streak-celebrated`), so it's once a day in all.
    var streakCelebratedDay: String? {
        if case .some(.string(let day)) = preferences["streak-celebrated"] { return day }
        return nil
    }

    /// Canvas and custom assignments for every class the student hasn't hidden.
    /// Every screen lists work through this, so hiding a class hides it everywhere.
    func shownAssignments(in store: NativeContentStore, includePersonalTasks: Bool = false) -> [AssignmentItem] {
        let hidden = hiddenCourseIDs
        let courses = Dictionary(store.bundle.courses.map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })
        let custom = customAssignments.filter { includePersonalTasks || $0.courseID != CustomAssignment.noClassID }.map { AssignmentItem.custom($0, course: courses[$0.courseID]) }
        return (store.bundle.assignments + custom).filter { !hidden.contains($0.courseID) }
    }
}

extension CustomAssignment {
    /// The class id of your own task that isn't for a class (the website uses 0 too).
    static let noClassID = 0
    /// What such a task shows where a class name would be.
    static let noClassLabel = "Personal"
    /// Stands in for a class where a list goes class by class.
    static let noClassCourse = CourseSummary(id: noClassID, name: noClassLabel, courseCode: "", currentScore: nil, currentGrade: nil, finalScore: nil)
}

extension AssignmentItem {
    static func custom(_ item: CustomAssignment, course: CourseSummary?) -> AssignmentItem {
        let fallback = item.courseID == CustomAssignment.noClassID ? CustomAssignment.noClassLabel : ""
        return AssignmentItem(id: item.id, name: item.name, description: item.notes, dueAt: item.dueAt, htmlURL: "", pointsPossible: item.pointsPossible, courseID: item.courseID, courseName: course?.name ?? fallback, courseCode: course?.courseCode ?? "", submission: nil, estimatedMinutes: item.estimatedMinutes)
    }
}

/// Sunday–Saturday in local time, independent of the device's first-weekday setting.
enum NativeTodoWeek {
    static func days(now: Date = Date(), offset: Int = 0) -> [Date] {
        let calendar = Calendar.current
        let today = calendar.startOfDay(for: now)
        let shift = 1 - calendar.component(.weekday, from: today) + min(3, max(0, offset)) * 7
        guard let sunday = calendar.date(byAdding: .day, value: shift, to: today) else { return [] }
        return (0..<7).compactMap { calendar.date(byAdding: .day, value: $0, to: sunday) }
    }

    static func isDue(_ item: AssignmentItem, on day: Date) -> Bool {
        guard let due = item.dueDate else { return false }
        return Calendar.current.isDate(due, inSameDayAs: day)
    }
}

enum NativeParity {
    static func relativeDueDay(_ due: Date, now: Date = Date()) -> String? {
        let calendar = Calendar.current
        if calendar.isDate(due, inSameDayAs: now) { return "Today" }
        if let tomorrow = calendar.date(byAdding: .day, value: 1, to: now), calendar.isDate(due, inSameDayAs: tomorrow) { return "Tomorrow" }
        return nil
    }

    static func dueDisplay(_ due: Date, now: Date = Date(), includeTime: Bool = true) -> String {
        let day = relativeDueDay(due, now: now) ?? due.formatted(.dateTime.weekday(.abbreviated).month(.abbreviated).day())
        return includeTime ? "\(day) · \(due.formatted(.dateTime.hour().minute()))" : day
    }

    struct Countdown {
        let label: String
        let urgency: String
        let fullDate: String
    }

    static func countdown(_ item: AssignmentItem, completed: Bool, now: Date = Date()) -> Countdown? {
        guard let due = item.dueDate else { return nil }
        let days = Calendar.current.dateComponents([.day], from: Calendar.current.startOfDay(for: now), to: Calendar.current.startOfDay(for: due)).day ?? 0
        let fullDate = dueDisplay(due, now: now)
        let shortDate = due.formatted(.dateTime.month(.abbreviated).day())
        let relative = relativeDueDay(due, now: now)
        if completed { return Countdown(label: relative ?? (days >= 0 ? shortDate : "Completed"), urgency: "none", fullDate: fullDate) }
        if due < now {
            if let relative { return Countdown(label: relative, urgency: "overdue", fullDate: fullDate) }
            return Countdown(label: "Past due", urgency: "overdue", fullDate: fullDate)
        }
        if days <= 0 { return Countdown(label: "Today", urgency: "today", fullDate: fullDate) }
        if days == 1 { return Countdown(label: "Tomorrow", urgency: "soon", fullDate: fullDate) }
        if days <= 6 { return Countdown(label: "\(days) days left", urgency: days <= 3 ? "soon" : "later", fullDate: fullDate) }
        return Countdown(label: "Due \(shortDate)", urgency: "later", fullDate: fullDate)
    }

    static func endOfStudySearchMonth(from now: Date = Date()) -> Date {
        let calendar = Calendar.current
        let date = calendar.date(byAdding: .month, value: 1, to: now) ?? now
        return calendar.date(bySettingHour: 23, minute: 59, second: 59, of: date) ?? date
    }

    static func endOfUpcomingDay(_ days: Int, from now: Date = Date()) -> Date {
        let day = Calendar.current.date(byAdding: .day, value: days, to: now) ?? now
        return Calendar.current.date(bySettingHour: 23, minute: 59, second: 59, of: day) ?? day
    }

    static func startOfRecentWindow(from now: Date = Date()) -> Date {
        let recent = Calendar.current.date(byAdding: .day, value: -3, to: now) ?? now
        return Calendar.current.startOfDay(for: recent)
    }

    static func isInDisplayWindow(_ item: AssignmentItem, now: Date = Date()) -> Bool {
        guard let due = item.dueDate else { return false }
        return due >= startOfRecentWindow(from: now) && due <= endOfUpcomingDay(28, from: now)
    }

    /// "This week" wherever it sits beside Today's seven circles (Today's line,
    /// Next up, the To-Do header, More): from now to the end of the sixth day
    /// ahead, the same seven days the circles and the Week widget show.
    static func isDueThisWeek(_ item: AssignmentItem, now: Date = Date()) -> Bool {
        guard let due = item.dueDate else { return false }
        return due >= now && due <= endOfUpcomingDay(6, from: now)
    }

    static func isInFocusWindow(_ item: AssignmentItem, window: String, now: Date = Date()) -> Bool {
        // Assignments only ever lists dated work due within four weeks (or overdue).
        if window == "all" { return item.dueDate.map { $0 <= endOfUpcomingDay(28, from: now) } ?? false }
        guard let due = item.dueDate else { return false }
        if window == "overdue" { return due < now }
        guard let days = Int(window) else { return false }
        let end = days == 7 ? endOfUpcomingDay(7, from: now) : now.addingTimeInterval(Double(days) * 86400)
        return due >= now && due <= end
    }

    /// The student's saved estimate, or the default for the assignment's size.
    /// A cleared estimate is stored as 0 and falls back to the default.
    static func estimate(_ item: AssignmentItem, estimates: [Int: Int]) -> Int {
        if let saved = estimates[item.id], saved > 0 { return saved }
        return defaultEstimate(item)
    }

    static func defaultEstimate(_ item: AssignmentItem) -> Int {
        if let saved = item.estimatedMinutes, saved > 0 { return saved }
        let points = item.pointsPossible ?? 0
        if points >= 100 { return 90 }
        if points >= 50 { return 60 }
        if points >= 20 { return 45 }
        return 30
    }

    /// Points still to do after saved progress; 25 when Canvas gives no points.
    static func remainingWork(_ item: AssignmentItem, progress: Int?) -> Double {
        let points = (item.pointsPossible ?? 0) > 0 ? (item.pointsPossible ?? 25) : 25
        let done = Double(min(100, max(0, progress ?? 0)))
        return points * (1 - done / 100)
    }

    /// Next up, like the website: the unfinished work due soonest in the seven
    /// days Today's circles show. Two due at the same time: the one worth more points.
    static func nextUp(_ items: [AssignmentItem], progress: [Int: Int], now: Date = Date()) -> AssignmentItem? {
        let candidates = items.filter { item in
            guard isDueThisWeek(item, now: now) else { return false }
            // Work that hasn't opened in Canvas yet can't be next up.
            return !item.notYetOpen(now: now)
        }
        return candidates.min { left, right in
            let leftDue = left.dueDate ?? .distantFuture, rightDue = right.dueDate ?? .distantFuture
            if leftDue != rightDue { return leftDue < rightDue }
            let leftPoints = left.pointsPossible ?? 0, rightPoints = right.pointsPossible ?? 0
            if leftPoints != rightPoints { return leftPoints > rightPoints }
            return left.name.localizedStandardCompare(right.name) == .orderedAscending
        }
    }

    /// Grades → New grades: grades that came in over the last 24 hours, newest first.
    static func newGrades(_ items: [AssignmentItem], now: Date = Date()) -> [AssignmentItem] {
        let since = now.addingTimeInterval(-86_400)
        return items
            .compactMap { item in item.gradeArrivedAt.map { (item, $0) } }
            .filter { $0.1 >= since }
            .sorted { $0.1 > $1.1 }
            .map(\.0)
    }

    static func priorityLabel(_ item: AssignmentItem, now: Date = Date()) -> String {
        guard let due = item.dueDate else { return "Later" }
        let hours = due.timeIntervalSince(now) / 3600
        return hours <= 24 ? "Do first" : hours <= 72 ? "Soon" : hours <= 168 ? "This week" : "Later"
    }

    static func courseLetter(_ supplied: String?, score: Double?) -> String {
        if let supplied, !supplied.isEmpty { return supplied }
        guard let score, score.isFinite else { return "—" }
        return score >= 93 ? "A" : score >= 90 ? "A-" : score >= 87 ? "B+" : score >= 83 ? "B" : score >= 80 ? "B-" : score >= 77 ? "C+" : score >= 73 ? "C" : score >= 70 ? "C-" : score >= 67 ? "D+" : score >= 63 ? "D" : score >= 60 ? "D-" : "F"
    }
}

extension Notification.Name {
    /// "This iPhone" was switched on or off in notification settings.
    static let nativeLocalRemindersChanged = Notification.Name("CanvasProNativeLocalRemindersChanged")
}

/// Starts, updates and ends the app's Live Activities: the study timer, and from
/// 9 PM the work still due tonight. iOS only lets an app start one while it's
/// open, so "tonight" begins the first time the app is used after 9 PM.
@MainActor
enum NativeLiveActivities {
    private static var lastStudy: CanvasProStudyActivity.ContentState?
    private static var lastTonight: CanvasProTonightActivity.ContentState?
    /// The night "tonight" was last started, so one dismissed by the student stays gone.
    private static let tonightStartedKey = "CanvasProTonightActivityDay"

    private static var allowed: Bool { ActivityAuthorizationInfo().areActivitiesEnabled }

    // Study session

    /// Mirrors the study timer. `nil` ends it right away (the session was reset).
    static func updateStudy(_ state: CanvasProStudyActivity.ContentState?) {
        let activities = Activity<CanvasProStudyActivity>.activities
        guard let state else {
            lastStudy = nil
            for activity in activities { Task { await activity.end(nil, dismissalPolicy: .immediate) } }
            return
        }
        // The timer saves every second; only a real change reaches the lock screen.
        guard state != lastStudy else { return }
        lastStudy = state
        let content = ActivityContent(state: state, staleDate: state.running ? state.blockEnd : nil)
        if let activity = activities.first {
            for extra in activities.dropFirst() { Task { await extra.end(nil, dismissalPolicy: .immediate) } }
            if state.finished {
                Task { await activity.end(content, dismissalPolicy: .after(Date().addingTimeInterval(10 * 60))) }
            } else {
                Task { await activity.update(content) }
            }
        } else if !state.finished, allowed {
            _ = try? Activity.request(attributes: CanvasProStudyActivity(), content: content, pushType: nil)
        }
    }

    // Due tonight

    /// Starts "Due tonight" once a night from 9 PM while work is still due before
    /// midnight, keeps it in step as work is finished, and ends it when everything
    /// is done or the night is over.
    static func updateTonight(_ snapshot: CanvasProWidgetSnapshot, now: Date = Date()) {
        let calendar = Calendar.current
        let today = calendar.startOfDay(for: now)
        let midnight = calendar.date(byAdding: .day, value: 1, to: today) ?? now
        let activities = Activity<CanvasProTonightActivity>.activities
        for activity in activities where activity.attributes.day != today {
            Task { await activity.end(nil, dismissalPolicy: .immediate) }
        }
        let work = snapshot.workload(.tonight, at: now)
        let state = CanvasProTonightActivity.ContentState(
            items: work.remaining.prefix(3).map { CanvasProTonightActivity.Item(name: $0.name, course: $0.course, due: $0.due) },
            remaining: work.remaining.count,
            done: work.done
        )
        let content = ActivityContent(state: state, staleDate: midnight)
        if let tonight = activities.first(where: { $0.attributes.day == today }) {
            guard state != lastTonight else { return }
            lastTonight = state
            if work.remaining.isEmpty {
                Task { await tonight.end(content, dismissalPolicy: .after(now.addingTimeInterval(20 * 60))) }
            } else {
                Task { await tonight.update(content) }
            }
            return
        }
        let ninePM = calendar.date(bySettingHour: 21, minute: 0, second: 0, of: now) ?? midnight
        let defaults = UserDefaults.standard
        guard now >= ninePM, now < midnight, !work.remaining.isEmpty, allowed,
              defaults.double(forKey: tonightStartedKey) != today.timeIntervalSince1970 else { return }
        defaults.set(today.timeIntervalSince1970, forKey: tonightStartedKey)
        lastTonight = state
        _ = try? Activity.request(attributes: CanvasProTonightActivity(day: today), content: content, pushType: nil)
    }

    /// Sign-out: nothing of the previous student's stays on the lock screen.
    static func endAll() {
        lastStudy = nil
        lastTonight = nil
        for activity in Activity<CanvasProStudyActivity>.activities { Task { await activity.end(nil, dismissalPolicy: .immediate) } }
        for activity in Activity<CanvasProTonightActivity>.activities { Task { await activity.end(nil, dismissalPolicy: .immediate) } }
    }
}

/// Siri, Shortcuts, Control Center, the Action button and widget buttons, as
/// the app carries them out.
@MainActor
enum NativeWidgetActions {
    /// The signed-in app's coursework, while its screens are open.
    static weak var contentStore: NativeContentStore?

    static func register() {
        CanvasProIntentBridge.open = { path in NativeRouter.shared.pendingPath = path }
        CanvasProIntentBridge.saveCompletions = { await saveCompletions() }
    }

    /// Saves work checked off on a widget to the account, so the website and the
    /// other devices see it. If the phone is offline it waits for the next try.
    static func saveCompletions() async {
        let pending = CanvasProWidgetStore.pendingCompletions
        guard !pending.isEmpty else { return }
        let session = NativeSessionStore.shared
        guard let api = session.api, let user = session.session?.user else { return }
        var saved: [Int] = []
        for (id, due) in pending {
            let item = contentStore?.bundle.assignments.first { $0.id == id }
                ?? AssignmentItem(id: id, name: "", description: nil, dueAt: ISO8601DateFormatter().string(from: due), htmlURL: "", pointsPossible: nil, courseID: 0, courseName: "", courseCode: "", submission: nil)
            do {
                try await api.setCompletion(true, assignment: item, reopenedAt: nil, token: try await session.accessToken(), userID: user.id)
                saved.append(id)
                contentStore?.completed.insert(id)
                contentStore?.reopenedAt.removeValue(forKey: id)
            } catch {
                break
            }
        }
        CanvasProWidgetStore.clearPending(saved)
    }
}

/// What Siri and the Shortcuts app offer. Each one can also go on the Action button.
/// Every phrase has to name the app; Siri also matches close variations of them.
struct CanvasProShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: CanvasProWhatsDue(),
            phrases: [
                // With a range: tonight, in the next 2 days, this week (and their synonyms).
                "What's due \(\.$range) in \(.applicationName)",
                "What do I have due \(\.$range) in \(.applicationName)",
                "What's due \(\.$range) on \(.applicationName)",
                "What homework do I have \(\.$range) in \(.applicationName)",
                "What assignments are due \(\.$range) in \(.applicationName)",
                "Do I have anything due \(\.$range) in \(.applicationName)",
                "Do I have homework \(\.$range) in \(.applicationName)",
                "Is anything due \(\.$range) in \(.applicationName)",
                "What do I need to turn in \(\.$range) in \(.applicationName)",
                "What do I need to finish \(\.$range) in \(.applicationName)",
                "Ask \(.applicationName) what's due \(\.$range)",
                "Ask \(.applicationName) what I have due \(\.$range)",
                "\(.applicationName) what's due \(\.$range)",
                // Without one: tonight.
                "What's due in \(.applicationName)",
                "What's due on \(.applicationName)",
                "What's due next in \(.applicationName)",
                "What do I have due in \(.applicationName)",
                "What do I have to do in \(.applicationName)",
                "What do I still have to do in \(.applicationName)",
                "What's left to do in \(.applicationName)",
                "What's left on \(.applicationName)",
                "What homework do I have in \(.applicationName)",
                "What's my homework in \(.applicationName)",
                "Do I have homework in \(.applicationName)",
                "Do I have anything due in \(.applicationName)",
                "Is anything due in \(.applicationName)",
                "Any assignments due in \(.applicationName)",
                "What assignments are due in \(.applicationName)",
                "What assignments do I have in \(.applicationName)",
                "Check my homework in \(.applicationName)",
                "Check my assignments in \(.applicationName)",
                "Check what's due in \(.applicationName)",
                "What's on my plate in \(.applicationName)",
                "What's my workload in \(.applicationName)",
                "How much homework do I have in \(.applicationName)",
                "How much do I have due in \(.applicationName)",
                "Ask \(.applicationName) what's due",
                "Ask \(.applicationName) about my homework",
                "\(.applicationName) what's due",
                "\(.applicationName) homework",
            ],
            shortTitle: "What's Due",
            systemImageName: "checklist"
        )
        AppShortcut(
            intent: CanvasProStartFocus(),
            phrases: [
                "Start a focus session in \(.applicationName)",
                "Start a focus timer in \(.applicationName)",
                "Start a study session in \(.applicationName)",
                "Start a study timer in \(.applicationName)",
                "Start a Pomodoro in \(.applicationName)",
                "Start a Pomodoro timer in \(.applicationName)",
                "Start studying in \(.applicationName)",
                "Start studying with \(.applicationName)",
                "Start focusing in \(.applicationName)",
                "Begin a study session in \(.applicationName)",
                "Begin studying with \(.applicationName)",
                "Time to study with \(.applicationName)",
                "Time to focus with \(.applicationName)",
                "Let's study with \(.applicationName)",
                "Let's focus with \(.applicationName)",
                "Help me focus with \(.applicationName)",
                "Help me study with \(.applicationName)",
                "I need to study with \(.applicationName)",
                "I need to focus with \(.applicationName)",
                "Study with \(.applicationName)",
                "Focus with \(.applicationName)",
                "Lock in with \(.applicationName)",
                "Do homework with \(.applicationName)",
                "Work on homework with \(.applicationName)",
                "\(.applicationName) start studying",
                "\(.applicationName) focus mode",
            ],
            shortTitle: "Start Focus",
            systemImageName: "timer"
        )
        AppShortcut(
            intent: CanvasProGradeAverage(),
            phrases: [
                "What's my average in \(.applicationName)",
                "What's my grade average in \(.applicationName)",
                "What's my overall grade in \(.applicationName)",
                "What are my grades in \(.applicationName)",
                "What are my grades on \(.applicationName)",
                "How are my grades in \(.applicationName)",
                "How are my grades looking in \(.applicationName)",
                "How are my classes going in \(.applicationName)",
                "How am I doing in \(.applicationName)",
                "How am I doing in my classes in \(.applicationName)",
                "How am I doing in school with \(.applicationName)",
                "Am I passing in \(.applicationName)",
                "Check my grades in \(.applicationName)",
                "Check my grades on \(.applicationName)",
                "Show my grades in \(.applicationName)",
                "Tell me my grades in \(.applicationName)",
                "Ask \(.applicationName) about my grades",
                "Ask \(.applicationName) how I'm doing",
                "\(.applicationName) grades",
                "\(.applicationName) my grades",
            ],
            shortTitle: "Grade Average",
            systemImageName: "chart.bar"
        )
        AppShortcut(
            intent: CanvasProOpenWhatsDue(),
            phrases: [
                "Open my assignments in \(.applicationName)",
                "Open my homework in \(.applicationName)",
                "Open my to-do list in \(.applicationName)",
                "Show my to-do list in \(.applicationName)",
                "Show my assignment list in \(.applicationName)",
                "Take me to my assignments in \(.applicationName)",
                "Open \(.applicationName) assignments",
                "Open \(.applicationName) homework",
            ],
            shortTitle: "To-Do",
            systemImageName: "list.bullet"
        )
    }
}

/// How many times the student has opened the app on this phone. A fresh start
/// or a return from the background counts; coming back within ten minutes (say,
/// from copying a Canvas key in Safari) is still the same visit.
enum NativeAppOpens {
    /// The notification permission prompt waits for this open.
    static let askForNotificationsAt = 3
    private static let countKey = "CanvasProAppOpens"
    /// Written by NativeRootView when the app goes to the background.
    private static let lastActiveKey = "CanvasProLastActive"
    private static let sameVisit: TimeInterval = 600

    static var count: Int { UserDefaults.standard.integer(forKey: countKey) }

    /// Call before the last-active time is refreshed.
    static func record(now: Date = Date()) {
        let defaults = UserDefaults.standard
        let last = defaults.double(forKey: lastActiveKey)
        guard last == 0 || now.timeIntervalSince1970 - last >= sameVisit else { return }
        defaults.set(count + 1, forKey: countKey)
    }
}

/// Reminders this iPhone schedules for itself: due dates, class reminders and
/// "due tonight". iOS delivers them on time with the app closed, and they need
/// no Apple push account. They are rebuilt from the latest coursework and
/// settings whenever the app refreshes, a setting changes or work is checked off.
/// New grades and announcements still need a server push, since only Canvas
/// knows about them.
enum NativeLocalReminders {
    struct DueItem {
        let id: Int
        let name: String
        let course: String
        let due: Date
    }

    struct Reminder: Equatable {
        let id: String
        let fireAt: Date
        let title: String
        let body: String
        let path: String
    }

    private static let deviceKey = "CanvasProLocalReminders"
    private static let prefix = "canvaspro.local."
    /// iOS keeps only the 64 soonest pending reminders per app; leave a little room.
    private static let limit = 60
    @MainActor private static var queue: Task<Void, Never>?

    /// "This iPhone" in notification settings. A choice for this phone only, so
    /// it lives on the device rather than in the account.
    static var deviceEnabled: Bool {
        get { UserDefaults.standard.object(forKey: deviceKey) as? Bool ?? true }
        set { UserDefaults.standard.set(newValue, forKey: deviceKey) }
    }

    static func isQuiet(_ date: Date, prefs: NotificationPreferences, calendar: Calendar = .current) -> Bool {
        guard prefs.quietEnabled, prefs.quietStart != prefs.quietEnd else { return false }
        let hour = calendar.component(.hour, from: date)
        let start = prefs.quietStart, end = prefs.quietEnd
        return start < end ? (hour >= start && hour < end) : (hour >= start || hour < end)
    }

    static func hourLabel(_ hour: Int) -> String {
        let h = ((hour % 24) + 24) % 24
        return "\(h % 12 == 0 ? 12 : h % 12) \(h < 12 ? "AM" : "PM")"
    }

    static func leadLabel(_ minutes: Int) -> String {
        if minutes <= 0 { return "starts now" }
        if minutes % 60 == 0 { let h = minutes / 60; return "starts in \(h) hour\(h == 1 ? "" : "s")" }
        return "starts in \(minutes) min"
    }

    /// Every reminder due in the next week, soonest first, following the same
    /// saved settings (and the same wording) as the website's background check.
    static func plan(items: [DueItem], schedule: [ClassScheduleEntry], prefs: NotificationPreferences, now: Date = Date(), calendar: Calendar = .current) -> [Reminder] {
        guard prefs.enabled, prefs.browserPush else { return [] }
        var reminders: [Reminder] = []
        let today = calendar.startOfDay(for: now)
        let horizon = now.addingTimeInterval(8 * 86_400)

        // Due dates: when each chosen window opens. One that falls in quiet hours
        // waits for them to end, like the website's 30-minute check.
        let windows: [(on: Bool, key: String, hours: Double)] = [
            (prefs.due1w, "1w", 168), (prefs.due3d, "3d", 72), (prefs.due2d, "2d", 48), (prefs.due1d, "1d", 24),
        ]
        for item in items where item.due > now {
            for window in windows where window.on {
                var fire = item.due.addingTimeInterval(-window.hours * 3_600)
                if isQuiet(fire, prefs: prefs, calendar: calendar) {
                    guard let end = calendar.nextDate(after: fire, matching: DateComponents(hour: prefs.quietEnd, minute: 0), matchingPolicy: .nextTime) else { continue }
                    fire = end
                }
                guard fire > now, fire < item.due, fire < horizon else { continue }
                reminders.append(Reminder(
                    id: "due:\(item.id):\(window.key)", fireAt: fire,
                    title: "Due \(dayLabel(item.due, from: fire, calendar: calendar)): \(item.name)",
                    body: "\(item.course) · \(item.due.formatted(date: .omitted, time: .shortened))",
                    path: "/assignments"
                ))
            }
        }

        // Class reminders, for each class day in the coming week. Quiet hours
        // silence them, as they do on the server.
        let weekdays: [String: Int] = ["U": 1, "M": 2, "T": 3, "W": 4, "R": 5, "F": 6, "S": 7]
        let leads = Array(Set(prefs.countdownLeads.filter { $0 >= 0 })).sorted(by: >)
        if prefs.countdownClass && !leads.isEmpty {
            for offset in 0..<7 {
                guard let day = calendar.date(byAdding: .day, value: offset, to: today) else { continue }
                let weekday = calendar.component(.weekday, from: day)
                let dayKey = day.formatted(.iso8601.year().month().day())
                for entry in schedule where entry.days.contains(where: { weekdays[$0] == weekday }) {
                    guard (0..<1_440).contains(entry.startMinutes),
                          let start = calendar.date(bySettingHour: entry.startMinutes / 60, minute: entry.startMinutes % 60, second: 0, of: day) else { continue }
                    let name = entry.title.trimmingCharacters(in: .whitespaces).isEmpty ? entry.code : entry.title
                    let place = entry.location.trimmingCharacters(in: .whitespaces)
                    for lead in leads {
                        let fire = start.addingTimeInterval(TimeInterval(-lead * 60))
                        guard fire > now, !isQuiet(fire, prefs: prefs, calendar: calendar) else { continue }
                        reminders.append(Reminder(
                            id: "class:\(dayKey):\(entry.startMinutes):\(entry.id):\(lead)", fireAt: fire,
                            title: "\(name) \(leadLabel(lead))",
                            body: [start.formatted(date: .omitted, time: .shortened), place].filter { !$0.isEmpty }.joined(separator: " · "),
                            path: "/class-schedule"
                        ))
                    }
                }
            }
        }

        // Due tonight: at the chosen hour, everything still due by 11:59 PM.
        if prefs.countdownTonight {
            let hours = Array(Set(prefs.countdownTonightHours.filter { (0..<24).contains($0) })).sorted()
            for offset in 0..<7 {
                guard let day = calendar.date(byAdding: .day, value: offset, to: today),
                      let end = calendar.date(bySettingHour: 23, minute: 59, second: 59, of: day) else { continue }
                let dayKey = day.formatted(.iso8601.year().month().day())
                for hour in hours {
                    guard let fire = calendar.date(bySettingHour: hour, minute: 0, second: 0, of: day),
                          fire > now, !isQuiet(fire, prefs: prefs, calendar: calendar) else { continue }
                    let tonight = items.filter { $0.due > fire && $0.due <= end }.sorted { $0.due < $1.due }
                    guard let first = tonight.first else { continue }
                    reminders.append(Reminder(
                        id: "tonight:\(dayKey):\(hour)", fireAt: fire,
                        title: tonight.count == 1 ? "Due tonight by 11:59 PM: \(first.name)" : "\(tonight.count) assignments due tonight by 11:59 PM",
                        body: tonight.prefix(3).map { "\($0.name) · \($0.course)" }.joined(separator: "\n"),
                        path: "/assignments"
                    ))
                }
            }
        }

        return Array(reminders.sorted { $0.fireAt < $1.fireAt }.prefix(limit))
    }

    /// Replaces this app's pending reminders. Runs one at a time, so a quick
    /// second change can't leave reminders from the first one behind.
    @MainActor static func replace(with reminders: [Reminder]) {
        let previous = queue
        queue = Task {
            await previous?.value
            await apply(reminders)
        }
    }

    private static func apply(_ reminders: [Reminder]) async {
        let center = UNUserNotificationCenter.current()
        let old = await center.pendingNotificationRequests().map(\.identifier).filter { $0.hasPrefix(prefix) }
        if !old.isEmpty { center.removePendingNotificationRequests(withIdentifiers: old) }
        let status = await center.notificationSettings().authorizationStatus
        guard status == .authorized || status == .provisional || status == .ephemeral else { return }
        for reminder in reminders {
            guard deviceEnabled else { return }
            let content = UNMutableNotificationContent()
            content.title = reminder.title
            content.body = reminder.body
            content.sound = .default
            content.threadIdentifier = String(reminder.id.prefix { $0 != ":" })
            content.userInfo = ["to_path": reminder.path]
            let when = Calendar.current.dateComponents([.year, .month, .day, .hour, .minute, .second], from: reminder.fireAt)
            let trigger = UNCalendarNotificationTrigger(dateMatching: when, repeats: false)
            let identifier = prefix + reminder.id
            try? await center.add(UNNotificationRequest(identifier: identifier, content: content, trigger: trigger))
            if !deviceEnabled { center.removePendingNotificationRequests(withIdentifiers: [identifier]); return }
        }
    }

    /// "today", "tomorrow", a weekday, or a date for further out.
    private static func dayLabel(_ due: Date, from fire: Date, calendar: Calendar) -> String {
        if calendar.isDate(due, inSameDayAs: fire) { return "today" }
        if let next = calendar.date(byAdding: .day, value: 1, to: fire), calendar.isDate(due, inSameDayAs: next) { return "tomorrow" }
        if due.timeIntervalSince(fire) < 6 * 86_400 { return due.formatted(.dateTime.weekday(.wide)) }
        return "on \(due.formatted(.dateTime.month(.abbreviated).day()))"
    }
}

/// Since your last visit, as the website saves it: when, the scores seen then,
/// and each deadline's urgency then. Ids are text, as in JSON.
struct NativeDigestSeen: Codable, Equatable {
    var lastVisit: String
    var grades: [String: Double]
    var urgency: [String: String]
}

/// The study time choice, as the website saves it.
struct NativeStudySetup: Codable, Equatable {
    struct Custom: Codable, Equatable {
        var focus: Double
        var shortBreak: Double
        var longBreak: Double
        var rounds: Double
    }
    var mode: String
    var preset: String
    var custom: Custom
}

// MARK: To-Do helpers
//
// The website's rules (src/lib/assignment-steps.ts, todo-insights.ts and
// quick-add.ts), so the phone and every browser give the same answers.

/// One step of big work, saved under `assignment-steps` (assignment id → steps).
struct NativeAssignmentStep: Codable, Identifiable, Hashable {
    var id: String
    var title: String
    /// Rough minutes for this step, or nil.
    var minutes: Int?
    var done: Bool
}

enum NativeSteps {
    static func newID() -> String {
        "st-\(String(Int(Date().timeIntervalSince1970 * 1000), radix: 36))-\(String(Int.random(in: 0..<1_679_616), radix: 36))"
    }

    /// The first step not done yet.
    static func next(_ steps: [NativeAssignmentStep]) -> NativeAssignmentStep? { steps.first { !$0.done } }

    /// Percent done, weighted by each step's minutes when every step has them.
    static func percent(_ steps: [NativeAssignmentStep]) -> Int {
        guard !steps.isEmpty else { return 0 }
        let timed = steps.allSatisfy { $0.minutes != nil }
        func weight(_ step: NativeAssignmentStep) -> Double { timed ? Double(step.minutes ?? 0) : 1 }
        let total = steps.reduce(0) { $0 + weight($1) }
        let done = steps.filter(\.done).reduce(0) { $0 + weight($1) }
        return total > 0 ? Int((done / total * 100).rounded()) : 0
    }

    /// Worth breaking down: a lot of points or a long estimate.
    static func isBigWork(points: Double?, estimate: Int) -> Bool { (points ?? 0) >= 50 || estimate >= 90 }

    /// Suggested steps from the kind of work its name suggests, with the estimate shared out.
    static func suggested(name: String, estimate: Int) -> [NativeAssignmentStep] {
        let n = name.lowercased()
        func has(_ pattern: String) -> Bool { n.range(of: pattern, options: .regularExpression) != nil }
        let plan: [(String, Double)]
        if has("exam|midterm|final|quiz|test") {
            plan = [("Gather notes and topics", 0.15), ("Review the main ideas", 0.35), ("Practice problems", 0.35), ("Quick self-test", 0.15)]
        } else if has("lab") {
            plan = [("Read the lab and pre-lab", 0.2), ("Do the work and collect data", 0.4), ("Write it up", 0.3), ("Check and submit", 0.1)]
        } else if has("project|presentation|portfolio") {
            plan = [("Plan what's needed", 0.15), ("Build the main part", 0.5), ("Polish", 0.25), ("Check and submit", 0.1)]
        } else if has("essay|paper|report|writing|draft|response|reflection|review") {
            plan = [("Research and notes", 0.25), ("Outline", 0.15), ("Write the draft", 0.4), ("Revise and submit", 0.2)]
        } else {
            plan = [("Read what's asked", 0.1), ("Do the main part", 0.6), ("Check your work", 0.2), ("Submit", 0.1)]
        }
        return plan.enumerated().map { index, part in
            NativeAssignmentStep(id: "\(newID())-\(index)", title: part.0,
                minutes: max(5, Int((Double(estimate) * part.1 / 5).rounded()) * 5), done: false)
        }
    }
}

enum NativeTodoInsights {
    /// Share of a class's points this assignment is worth (0–1), or nil when the
    /// class has no points to compare with. Worded "of class points", never as a grade.
    static func pointsShare(_ item: AssignmentItem, among all: [AssignmentItem]) -> Double? {
        let points = item.pointsPossible ?? 0
        guard points > 0, item.courseID > 0 else { return nil }
        let total = all.filter { $0.courseID == item.courseID && ($0.pointsPossible ?? 0) > 0 }
            .reduce(0) { $0 + ($1.pointsPossible ?? 0) }
        return total > 0 ? points / total : nil
    }

    /// "12% of class points", for anything worth 3% or more.
    static func impactLabel(_ share: Double?) -> String? {
        guard let share, share >= 0.03 else { return nil }
        return "\(Int((share * 100).rounded()))% of class points"
    }

    /// Worth a closer look: 10% or more of the class's points.
    static func isHighImpact(_ share: Double?) -> Bool { (share ?? 0) >= 0.1 }

    struct TodayProgress { let left: Int; let total: Int; let fraction: Double; let minutesLeft: Int }

    /// Finished items count whole, unfinished ones by their saved progress (a head start counts).
    static func todayProgress(_ items: [(done: Bool, progress: Int?, minutes: Int)]) -> TodayProgress {
        let left = items.filter { !$0.done }.count
        let credit = items.reduce(0.0) { sum, item in
            sum + (item.done ? 1 : Double(min(max(item.progress ?? 0, 0), 100)) / 100)
        }
        let minutesLeft = items.filter { !$0.done }.reduce(0) { sum, item in
            sum + Int((Double(item.minutes) * (1 - Double(min(item.progress ?? 0, 100)) / 100)).rounded())
        }
        return TodayProgress(left: left, total: items.count, fraction: items.isEmpty ? 0 : credit / Double(items.count), minutesLeft: minutesLeft)
    }

    /// "2 left today", "All done today".
    static func leftTodayLabel(left: Int, total: Int) -> String {
        if total == 0 { return "Nothing due today" }
        if left == 0 { return "All done today" }
        return "\(left) left today"
    }

    /// The weekly rhythm (`weekly-rhythm`): which days this Sunday–Saturday week
    /// you finished something. Rest days are fine; 4 active days is the gentle
    /// aim, and a new week always starts fresh.
    static let rhythmAim = 4

    static func rhythmWeek(_ completedAt: [Date], now: Date, calendar: Calendar = .current) -> [Bool] {
        let today = calendar.startOfDay(for: now)
        guard let start = calendar.date(byAdding: .day, value: -(calendar.component(.weekday, from: today) - 1), to: today) else { return Array(repeating: false, count: 7) }
        var days = Array(repeating: false, count: 7)
        for date in completedAt {
            guard let index = calendar.dateComponents([.day], from: start, to: calendar.startOfDay(for: date)).day else { continue }
            if (0..<7).contains(index) { days[index] = true }
        }
        return days
    }

    /// One kind line about the week so far.
    static func rhythmLine(_ days: [Bool], now: Date, calendar: Calendar = .current) -> String {
        let active = days.filter { $0 }.count
        let dayIndex = calendar.component(.weekday, from: now) - 1
        if active == 0 { return dayIndex <= 1 ? "New week, fresh start." : "Any day is a good day to start." }
        if active >= rhythmAim { return "\(active) active days this week. Rest is part of the plan." }
        return "\(active) of \(rhythmAim) active days. Rest days count too."
    }
}

/// Quick add: one line typed the way you'd jot it down ("Read ch4 bio fri 30m")
/// becomes a task with its class, due date and estimate.
enum NativeQuickAdd {
    struct Course { let id: Int; let names: [String] }
    struct Result: Equatable {
        var name: String
        var courseID: Int?
        /// Today at 11:59 PM when no day or time is given, like Add's form.
        var dueDate: Date
        var minutes: Int?
    }

    private static let weekdays: [String: Int] = [
        "sun": 0, "sunday": 0, "mon": 1, "monday": 1, "tue": 2, "tues": 2, "tuesday": 2,
        "wed": 3, "weds": 3, "wednesday": 3, "thu": 4, "thur": 4, "thurs": 4, "thursday": 4,
        "fri": 5, "friday": 5, "sat": 6, "saturday": 6,
    ]
    private static let months: [String: Int] = [
        "jan": 1, "january": 1, "feb": 2, "february": 2, "mar": 3, "march": 3, "apr": 4, "april": 4, "may": 5,
        "jun": 6, "june": 6, "jul": 7, "july": 7, "aug": 8, "august": 8, "sep": 9, "sept": 9, "september": 9,
        "oct": 10, "october": 10, "nov": 11, "november": 11, "dec": 12, "december": 12,
    ]
    /// Words too common to pick a class by.
    private static let genericWords: Set<String> = [
        "intro", "introduction", "the", "and", "for", "of", "to", "section", "lecture", "lab", "course", "general",
        "principles", "advanced", "foundations", "topics", "special", "seminar", "honors", "survey",
    ]
    private static let units = "m|min|mins|minutes|h|hr|hrs|hour|hours"

    private static func norm(_ text: String) -> String {
        text.lowercased().filter { $0.isASCII && ($0.isLetter || $0.isNumber) }
    }

    /// The pattern's groups (nil for one that didn't take part), or nil for no match.
    private static func match(_ pattern: String, _ text: String) -> [String?]? {
        guard let regex = try? NSRegularExpression(pattern: pattern),
              let found = regex.firstMatch(in: text, range: NSRange(text.startIndex..., in: text)) else { return nil }
        return (0..<found.numberOfRanges).map { index in Range(found.range(at: index), in: text).map { String(text[$0]) } }
    }

    /// The ways a class can be named: "BIO 201" → bio201, bio; "Cell Biology" → cellbiology, cell, biology.
    static func aliases(name: String, code: String, nickname: String?) -> [String] {
        var out: [String] = []
        func add(_ alias: String) { if !out.contains(alias) { out.append(alias) } }
        for text in [code, name, nickname ?? ""] {
            let whole = norm(text)
            if whole.count >= 3 { add(whole) }
            if let letters = match("^([A-Za-z]{2,5})\\s*\\d", text.trimmingCharacters(in: .whitespaces))?[1] { add(letters.lowercased()) }
            for word in text.split(whereSeparator: \.isWhitespace) {
                let w = norm(String(word))
                if w.count >= 4 && !genericWords.contains(w) { add(w) }
            }
        }
        return out
    }

    /// Reads one quick-add line. `now` sets "today".
    static func parse(_ text: String, courses: [Course], now: Date = Date(), calendar: Calendar = .current) -> Result {
        let tokens = text.split(whereSeparator: \.isWhitespace).map(String.init)
        let today = calendar.startOfDay(for: now)
        var used = Set<Int>()
        var day: Date?
        var time: (h: Int, m: Int)?
        var minutes: Int?
        var courseID: Int?
        func trimmed(_ token: String) -> String {
            var t = token.lowercased()
            if t.hasSuffix(",") || t.hasSuffix(".") { t.removeLast() }
            return t
        }
        func plus(_ days: Int) -> Date { calendar.date(byAdding: .day, value: days, to: today) ?? today }
        /// A month and day, next year once it has passed.
        func dated(month: Int, day: Int) -> Date? {
            guard (1...12).contains(month), (1...31).contains(day) else { return nil }
            var parts = calendar.dateComponents([.year], from: today)
            parts.month = month; parts.day = day
            guard let date = calendar.date(from: parts) else { return nil }
            if date < today { return calendar.date(byAdding: .year, value: 1, to: date) }
            return date
        }

        for i in tokens.indices where !used.contains(i) {
            let t = trimmed(tokens[i])
            let nextToken = i + 1 < tokens.count ? tokens[i + 1].lowercased() : nil

            // Estimate: 30m, 45min, 1h, 1.5hr, 2 hours
            if minutes == nil {
                var amount: (value: Double, unit: String, tokens: Int)?
                if let m = match("^(\\d+(?:\\.\\d+)?)(\(units))$", t), let value = m[1].flatMap({ Double($0) }), let unit = m[2] {
                    amount = (value: value, unit: unit, tokens: 1)
                } else if match("^\\d+(?:\\.\\d+)?$", t) != nil, let nextToken, match("^(\(units))$", nextToken) != nil, let value = Double(t) {
                    amount = (value: value, unit: nextToken, tokens: 2)
                }
                if let amount {
                    let mins = amount.unit.hasPrefix("h") ? amount.value * 60 : amount.value
                    if mins > 0 && mins <= 600 {
                        minutes = Int(mins.rounded())
                        used.insert(i)
                        if amount.tokens == 2 { used.insert(i + 1) }
                        continue
                    }
                }
            }

            // Day: today, tonight, tomorrow, a weekday, "next fri", 10/24, oct 24
            if day == nil {
                if t == "today" || t == "tonight" {
                    day = today
                    if t == "tonight" && time == nil { time = (h: 21, m: 0) }
                    used.insert(i)
                    continue
                }
                if ["tomorrow", "tmr", "tmrw", "tom"].contains(t) { day = plus(1); used.insert(i); continue }
                let following = nextToken.map(trimmed)
                let isNext = t == "next" && following.flatMap { weekdays[$0] } != nil
                if let weekday = weekdays[isNext ? following ?? "" : t] {
                    var ahead = (weekday - (calendar.component(.weekday, from: today) - 1) + 7) % 7
                    if isNext && ahead == 0 { ahead = 7 }
                    day = plus(ahead)
                    used.insert(i)
                    if isNext { used.insert(i + 1) }
                    continue
                }
                if let m = match("^(\\d{1,2})/(\\d{1,2})$", t), let month = m[1].flatMap({ Int($0) }), let date = m[2].flatMap({ Int($0) }), let found = dated(month: month, day: date) {
                    day = found
                    used.insert(i)
                    continue
                }
                if let month = months[t], let nextToken, let m = match("^(\\d{1,2})(st|nd|rd|th)?$", nextToken),
                   let date = m[1].flatMap({ Int($0) }), let found = dated(month: month, day: date) {
                    day = found
                    used.insert(i); used.insert(i + 1)
                    continue
                }
            }

            // Time: 5pm, 5:30pm, 17:00, "at 5", noon, midnight
            if time == nil {
                var m = match("^(\\d{1,2})(?::(\\d{2}))?(am|pm|a|p)$", t)
                var skipAt = false
                if m == nil, t == "at", let nextToken {
                    m = match("^(\\d{1,2})(?::(\\d{2}))?(am|pm|a|p)?$", nextToken)
                    skipAt = m != nil
                }
                if let m, var hour = m[1].flatMap({ Int($0) }) {
                    let minute = m[2].flatMap { Int($0) } ?? 0
                    let meridiem = m[3]
                    if meridiem?.hasPrefix("p") == true && hour < 12 { hour += 12 }
                    if meridiem?.hasPrefix("a") == true && hour == 12 { hour = 0 }
                    // "at 5" with no am/pm: school hours, so afternoon.
                    if meridiem == nil && (1...6).contains(hour) { hour += 12 }
                    if hour <= 23 && minute <= 59 {
                        time = (h: hour, m: minute)
                        used.insert(i)
                        if skipAt { used.insert(i + 1) }
                        continue
                    }
                }
                if let m = match("^([01]?\\d|2[0-3]):([0-5]\\d)$", t), let hour = m[1].flatMap({ Int($0) }), let minute = m[2].flatMap({ Int($0) }) {
                    time = (h: hour, m: minute); used.insert(i); continue
                }
                if t == "noon" { time = (h: 12, m: 0); used.insert(i); continue }
                if t == "midnight" { time = (h: 23, m: 59); used.insert(i); continue }
            }

            // Class: a word that names exactly one class.
            if courseID == nil {
                let n = norm(t)
                if n.count >= 3 {
                    // A whole name ("bio"), or the start of one ("psych", "calc") when it's 4+ letters.
                    var hits = courses.filter { $0.names.contains(n) }
                    if hits.isEmpty && n.count >= 4 { hits = courses.filter { $0.names.contains { $0.hasPrefix(n) } } }
                    if hits.count == 1 { courseID = hits[0].id; used.insert(i); continue }
                }
            }
        }

        var words = tokens.indices.filter { !used.contains($0) }.map { tokens[$0] }
        // "Due" left over from "due fri" isn't part of the name.
        while words.count > 1, let last = words.last, ["due", "by", "on", "for"].contains(last.lowercased()) { words.removeLast() }
        let name = words.joined(separator: " ").trimmingCharacters(in: .whitespaces)

        // No day or time: today at 11:59 PM, so it's on today's To-Do.
        let base = day ?? today
        var due = calendar.date(bySettingHour: time?.h ?? 23, minute: time?.m ?? 59, second: 0, of: base) ?? base
        // A time already past today, with no day given, means tomorrow.
        if day == nil && due < now { due = calendar.date(byAdding: .day, value: 1, to: due) ?? due }
        return Result(name: name.prefix(1).uppercased() + name.dropFirst(), courseID: courseID, dueDate: due, minutes: minutes)
    }
}

/// How far back Completed looks: the past 2 days to the past 2 months, the
/// same choices as the website (src/lib/completed-range.ts).
enum NativeCompletedRange {
    static let days = [2, 7, 14, 30, 60]
    static let defaultDays = 30

    static func label(_ days: Int) -> String {
        switch days { case 2: return "2 days"; case 7: return "Week"; case 14: return "2 weeks"; case 30: return "Month"; default: return "2 months" }
    }
    static func long(_ days: Int) -> String {
        switch days { case 2: return "the past 2 days"; case 7: return "the past week"; case 14: return "the past 2 weeks"; case 30: return "the past month"; default: return "the past 2 months" }
    }
    /// Local midnight, `days - 1` days before today (today counts).
    static func start(_ days: Int, now: Date = Date(), calendar: Calendar = .current) -> Date {
        calendar.date(byAdding: .day, value: -(days - 1), to: calendar.startOfDay(for: now)) ?? now
    }
    /// Finished within the range. Work with no known finish time isn't shown.
    static func contains(_ date: Date?, days: Int, now: Date = Date()) -> Bool {
        guard let date else { return false }
        return date >= start(days, now: now)
    }
}

/// "Why did you download CoursePro?" The same ten answers as the website
/// (src/lib/download-reasons.ts), each pointing at the dashboard widgets that
/// help with it.
enum NativeDownloadReasons {
    struct Reason: Identifiable {
        let id: String
        let label: String
        let symbol: String
        let widgets: [String: Int]
    }

    static let all: [Reason] = [
        Reason(id: "deadlines", label: "Never miss a deadline", symbol: "alarm", widgets: ["focus": 3, "upcoming": 2, "calendar": 1]),
        Reason(id: "grades", label: "Keep my grades up", symbol: "chart.line.uptrend.xyaxis", widgets: ["classes": 3, "focus": 1]),
        Reason(id: "plan", label: "Plan my week", symbol: "calendar", widgets: ["calendar": 3, "upcoming": 2, "heatmap": 2]),
        Reason(id: "procrastination", label: "Stop putting things off", symbol: "bolt", widgets: ["focus": 3, "digest": 1]),
        Reason(id: "study", label: "Focus when I study", symbol: "timer", widgets: ["focus": 2, "heatmap": 1]),
        Reason(id: "overview", label: "See all my classes in one place", symbol: "square.grid.2x2", widgets: ["classes": 2, "upcoming": 2, "digest": 2]),
        Reason(id: "announcements", label: "Keep up with announcements", symbol: "megaphone", widgets: ["announcements": 3, "digest": 2]),
        Reason(id: "balance", label: "Balance school with work or sports", symbol: "scalemass", widgets: ["calendar": 3, "heatmap": 2]),
        Reason(id: "gpa", label: "Track my GPA", symbol: "function", widgets: ["gpa": 3, "classes": 2]),
        Reason(id: "stress", label: "Feel less stressed about school", symbol: "leaf", widgets: ["focus": 2, "digest": 1, "heatmap": 1]),
    ]

    /// Widgets that make a good start when the answers point to only one or two.
    private static let fallback = ["digest", "focus", "upcoming", "classes"]
    static let maxRecommended = 5

    /// The widgets for these answers, most helpful first (ties in `order`), at
    /// most five and at least three. `available` leaves out widgets this app doesn't draw.
    static func recommend(_ ids: Set<String>, order: [String], available: (String) -> Bool) -> [String] {
        var score: [String: Int] = [:]
        for reason in all where ids.contains(reason.id) {
            for (widget, points) in reason.widgets where available(widget) { score[widget, default: 0] += points }
        }
        var picks = order.filter { (score[$0] ?? 0) > 0 }
            .sorted { a, b in
                let left = score[a] ?? 0, right = score[b] ?? 0
                if left != right { return left > right }
                return (order.firstIndex(of: a) ?? 0) < (order.firstIndex(of: b) ?? 0)
            }
        picks = Array(picks.prefix(maxRecommended))
        for widget in fallback where picks.count < 3 && available(widget) && !picks.contains(widget) {
            picks.append(widget)
        }
        return picks
    }
}
