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

    var metadata: [String: Any] { [
        "first_name": firstName.trimmingCharacters(in: .whitespacesAndNewlines),
        "last_name": lastName.trimmingCharacters(in: .whitespacesAndNewlines),
        "nickname": nickname.trimmingCharacters(in: .whitespacesAndNewlines),
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
    enum CodingKeys: String, CodingKey {
        case id, name, notes
        case courseID = "course_id"; case dueAt = "due_at"; case pointsPossible = "points_possible"; case createdAt = "created_at"
    }
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
    enum CodingKeys: String, CodingKey { case assignmentID = "assignment_id"; case estimatedMinutes = "estimated_minutes" }
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
    }

    var dictionary: [String: Any] {[
        "enabled": enabled, "due1w": due1w, "due3d": due3d, "due2d": due2d, "due1d": due1d,
        "grades": grades, "announcements": announcements, "gradeThreshold": gradeThreshold,
        "browserPush": browserPush, "quietEnabled": quietEnabled, "quietStart": quietStart, "quietEnd": quietEnd,
        "countdownClass": countdownClass, "countdownLeads": countdownLeads,
        "countdownTonight": countdownTonight, "countdownTonightHours": countdownTonightHours, "badge": badge,
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
            .init(name: "select", value: "assignment_id,estimated_minutes"), .init(name: "user_id", value: "eq.\(userID)"),
        ])
        return try decoder.decode([AssignmentMeta].self, from: await data(request))
    }

    func saveEstimate(assignmentID: Int, courseID: Int, minutes: Int?, token: String, userID: String) async throws {
        try await upsert(table: "user_assignment_meta", token: token, conflict: "user_id,assignment_id", rows: [[
            "user_id": userID, "assignment_id": assignmentID, "course_id": courseID,
            "estimated_minutes": minutes as Any? ?? NSNull(),
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
    @Published var alerts: [ScheduledAlert] = []
    @Published var notificationPreferences = NotificationPreferences()
    @Published var isLoading = false
    @Published var errorMessage: String?
    let isPreview: Bool
    unowned let sessionStore: NativeSessionStore
    private let previewStateKey = "CanvasProPreviewFeatureState"

    init(sessionStore: NativeSessionStore, preview: Bool = false) {
        self.sessionStore = sessionStore
        isPreview = preview
        if preview {
            if let data = UserDefaults.standard.data(forKey: previewStateKey),
               let saved = try? JSONDecoder().decode(NativePreviewFeatureState.self, from: data) {
                preferences = saved.preferences; profile = saved.profile; schedule = saved.schedule; estimates = saved.estimates
                decodePreferenceModels()
            } else {
                profile = AccountProfile(username: "Preview Student", avatarPath: nil)
                schedule = [
                    ClassScheduleEntry(id: "preview-1", code: "CS 230", section: "01", title: "Data Structures", crn: "", credits: 3, instructor: "Dr. Rivera", location: "Science 204", campus: "", scheduleType: "Lecture", days: ["M", "W"], startMinutes: 600, endMinutes: 675, term: "", dateRange: "", canvasCourseID: 102),
                    ClassScheduleEntry(id: "preview-2", code: "ENG 102", section: "02", title: "College Writing", crn: "", credits: 3, instructor: "Prof. Chen", location: "Humanities 118", campus: "", scheduleType: "Lecture", days: ["T", "R"], startMinutes: 780, endMinutes: 855, term: "", dateRange: "", canvasCourseID: 103),
                ]
                estimates = [1001: 45, 1002: 60, 1003: 20]
            }
        }
    }

    func load() async {
        guard !isPreview else { return }
        guard let api = sessionStore.api, let user = sessionStore.session?.user else { return }
        guard !isLoading else { return }
        isLoading = true; errorMessage = nil; defer { isLoading = false }
        do {
            let token = try await sessionStore.accessToken()
            preferences = try await api.preferences(token: token, userID: user.id)
            decodePreferenceModels()
            applyAppearancePreferences()
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
            if let metas = try? await metaRows { estimates = Dictionary(metas.map { ($0.assignmentID, $0.estimatedMinutes ?? 0) }, uniquingKeysWith: { first, _ in first }) }
            if let value = try? await alertRows { alerts = value }
            if let value = try? await notificationRow { notificationPreferences = NotificationPreferences(value) }
        } catch { errorMessage = error.localizedDescription }
    }

    func savePreference<T: Encodable>(_ key: String, _ value: T) async throws {
        let data = try JSONEncoder().encode(value)
        let json = try JSONDecoder().decode(JSONValue.self, from: data)
        let previous = preferences[key]
        preferences[key] = json
        if isPreview { decodePreferenceModels(); persistPreviewState(); return }
        decodePreferenceModels()
        applyAppearancePreferences()
        do {
            guard let api = sessionStore.api, let user = sessionStore.session?.user else { throw NativeAppError.signedOut }
            try await api.savePreference(key: key, value: json, token: try await sessionStore.accessToken(), userID: user.id)
        } catch {
            if preferences[key] == json {
                if let previous { preferences[key] = previous } else { preferences.removeValue(forKey: key) }
                decodePreferenceModels()
                applyAppearancePreferences()
            }
            throw error
        }
    }

    func saveNotifications() async throws {
        if isPreview { return }
        guard let api = sessionStore.api, let user = sessionStore.session?.user else { throw NativeAppError.signedOut }
        try await api.syncNotificationPreferences(notificationPreferences.dictionary, token: try await sessionStore.accessToken(), userID: user.id)
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
    }

    private func decodePreferenceModels() {
        let decoder = JSONDecoder()
        customAssignments = preferences["custom-assignments"].flatMap { value in (try? JSONEncoder().encode(value)).flatMap { try? decoder.decode([CustomAssignment].self, from: $0) } } ?? []
        calendarPicks = preferences["calendar-picks"].flatMap { value in (try? JSONEncoder().encode(value)).flatMap { try? decoder.decode([CalendarPick].self, from: $0) } } ?? []
    }

    private func applyAppearancePreferences() {
        if case .some(.string(let mode)) = preferences["theme"], ["light", "dark", "system"].contains(mode) {
            UserDefaults.standard.set(mode, forKey: "CanvasProColorScheme")
        }
        if case .some(.string(let palette)) = preferences["color_theme"], CPPalette(rawValue: palette) != nil {
            UserDefaults.standard.set(palette, forKey: "CanvasProPalette")
        }
    }

    var announcementWeeks: Int {
        guard case .some(.number(let value)) = preferences["announcement_window_weeks"], [0, 1, 2, 4].contains(Int(value)) else { return 1 }
        return Int(value)
    }

    /// Every website widget, in the website's default order. The app draws all of them.
    static let defaultDashboardOrder = ["digest", "classes", "upcoming", "focus", "calendar", "announcements", "gpa", "heatmap"]
    private var dashboardWidgets: [String] { Self.defaultDashboardOrder }
    /// The website's full default order, used to keep saved slots in place.
    private let websiteDashboardOrder = ["digest", "classes", "upcoming", "focus", "calendar", "announcements", "gpa", "heatmap"]
    private var dashboardObject: [String: JSONValue] {
        if case .some(.object(let value)) = preferences["dashboard-layout"] { return value }
        return [:]
    }
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
        guard case .some(.array(let values)) = dashboardObject["hidden"] else { return ["focus", "calendar", "heatmap"] }
        return Set(values.compactMap { if case .string(let value) = $0 { return value }; return nil })
    }
    func updateDashboard(order: [String]? = nil, hidden: Set<String>? = nil) async throws {
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
        try await savePreference("dashboard-layout", JSONValue.object(layout))
    }

    func persistPreviewState() {
        guard isPreview else { return }
        let state = NativePreviewFeatureState(preferences: preferences, profile: profile, schedule: schedule, estimates: estimates)
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

    /// Canvas and custom assignments for every class the student hasn't hidden.
    /// Every screen lists work through this, so hiding a class hides it everywhere.
    func shownAssignments(in store: NativeContentStore) -> [AssignmentItem] {
        let hidden = hiddenCourseIDs
        let courses = Dictionary(store.bundle.courses.map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })
        let custom = customAssignments.map { AssignmentItem.custom($0, course: courses[$0.courseID]) }
        return (store.bundle.assignments + custom).filter { !hidden.contains($0.courseID) }
    }
}

extension AssignmentItem {
    static func custom(_ item: CustomAssignment, course: CourseSummary?) -> AssignmentItem {
        AssignmentItem(id: item.id, name: item.name, description: item.notes, dueAt: item.dueAt, htmlURL: "", pointsPossible: item.pointsPossible, courseID: item.courseID, courseName: course?.name ?? "", courseCode: course?.courseCode ?? "", submission: nil)
    }
}

enum NativeParity {
    struct Countdown {
        let label: String
        let urgency: String
        let fullDate: String
    }

    static func countdown(_ item: AssignmentItem, completed: Bool, now: Date = Date()) -> Countdown? {
        guard let due = item.dueDate else { return nil }
        let days = Calendar.current.dateComponents([.day], from: Calendar.current.startOfDay(for: now), to: Calendar.current.startOfDay(for: due)).day ?? 0
        let fullDate = due.formatted(.dateTime.weekday(.abbreviated).month(.abbreviated).day().hour().minute())
        let shortDate = due.formatted(.dateTime.month(.abbreviated).day())
        if completed { return Countdown(label: days >= 0 ? shortDate : "Completed", urgency: "none", fullDate: fullDate) }
        if due < now { return Countdown(label: "Overdue", urgency: "overdue", fullDate: fullDate) }
        if days <= 0 { return Countdown(label: "Due today", urgency: "today", fullDate: fullDate) }
        if days == 1 { return Countdown(label: "Due tomorrow", urgency: "soon", fullDate: fullDate) }
        if days <= 6 { return Countdown(label: "\(days) days left", urgency: days <= 3 ? "soon" : "later", fullDate: fullDate) }
        return Countdown(label: "Due \(shortDate)", urgency: "later", fullDate: fullDate)
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

    static func isInFocusWindow(_ item: AssignmentItem, window: String, now: Date = Date()) -> Bool {
        if window == "all" { return item.dueDate.map { $0 <= endOfUpcomingDay(28, from: now) } ?? true }
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

    /// Planned work goes on the calendar at noon on the due day (today when there
    /// is no due date), the same as on the website.
    static func plannedTime(for dueAt: String?, now: Date = Date()) -> String {
        let day = dueAt.flatMap { ISO8601DateFormatter.canvasDate(from: $0) } ?? now
        let noon = Calendar.current.date(bySettingHour: 12, minute: 0, second: 0, of: day) ?? day
        return ISO8601DateFormatter().string(from: noon)
    }

    static func defaultEstimate(_ item: AssignmentItem) -> Int {
        let points = item.pointsPossible ?? 0
        if points >= 100 { return 90 }
        if points >= 50 { return 60 }
        if points >= 20 { return 45 }
        return 30
    }

    static func rankedAssignments(_ items: [AssignmentItem], estimates: [Int: Int], now: Date = Date()) -> [AssignmentItem] {
        let dueSoon = Dictionary(grouping: items.filter {
            guard let due = $0.dueDate else { return false }
            return due >= now && due <= now.addingTimeInterval(3 * 86400)
        }, by: \.courseID).mapValues(\.count)
        return items.sorted { left, right in
            let a = getItDoneScore(left, estimate: estimates[left.id], dueSoonCount: dueSoon[left.courseID] ?? 0, now: now)
            let b = getItDoneScore(right, estimate: estimates[right.id], dueSoonCount: dueSoon[right.courseID] ?? 0, now: now)
            return a == b ? AssignmentItem.dueSort(left, right) : a > b
        }
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


    static func getItDoneScore(_ item: AssignmentItem, estimate: Int?, dueSoonCount: Int, now: Date = Date()) -> Double {
        let hours = item.dueDate.map { $0.timeIntervalSince(now) / 3600 }
        var score: Double
        if let hours {
            if hours < 0 { score = 120 + min(abs(hours) / 24, 7) * 3 }
            else if hours <= 12 { score = 105 }
            else if hours <= 24 { score = 92 }
            else if hours <= 72 { score = 70 - hours / 72 * 12 }
            else if hours <= 168 { score = 38 - hours / 168 * 8 }
            else { score = 10 }
        } else { score = 8 }
        let points = item.pointsPossible ?? 0
        if points > 0 { score += min(points / 100, 1) * 16 }
        if let estimate, estimate > 0 { score += min(Double(estimate) / 90, 1) * 8 }
        else { score += min(Double(defaultEstimate(item)) / 90, 1) * 4 }
        if dueSoonCount > 1 { score += Double(min(dueSoonCount, 4)) * 5 }
        return score
    }

    static func recommendationReason(_ item: AssignmentItem, estimate: Int?, dueSoonCount: Int, now: Date = Date()) -> String {
        var reasons: [String] = []
        if let due = item.dueDate {
            let hours = due.timeIntervalSince(now) / 3600
            if hours < 0 { reasons.append("it is overdue") }
            else if hours <= 12 { reasons.append("it is due soon") }
            else if hours <= 24 { reasons.append("it is due within 24 hours") }
            else if hours <= 72 { reasons.append("it is due within 3 days") }
            else if hours <= 168 { reasons.append("it is due this week") }
        }
        if (item.pointsPossible ?? 0) >= 50 { reasons.append("it carries a lot of points") }
        if (estimate ?? 0) >= 60 { reasons.append("it needs a longer work block") }
        if dueSoonCount > 1 { reasons.append("\(dueSoonCount) assignments in this class are due soon") }
        let dueDescription: String
        if let due = item.dueDate {
            let days = Int(ceil(abs(due.timeIntervalSince(now)) / 86400))
            dueDescription = due < now ? (days <= 1 ? "overdue" : "\(days) days overdue") : due <= now.addingTimeInterval(86400) ? "due within 24 hours" : due <= now.addingTimeInterval(3 * 86400) ? "due within 3 days" : due <= now.addingTimeInterval(7 * 86400) ? "due this week" : "due later"
        } else { dueDescription = "no due date" }
        return reasons.isEmpty ? "Recommended because it is the strongest next task with \(dueDescription)." : "Recommended because \(reasons.prefix(2).joined(separator: " and "))."
    }
}
