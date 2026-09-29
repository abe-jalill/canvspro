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
    func preferences(token: String, userID: String) async throws -> [String: JSONValue] {
        let request = try request(path: "/rest/v1/user_preferences", token: token, query: [
            .init(name: "select", value: "key,value"), .init(name: "user_id", value: "eq.\(userID)"),
        ])
        let rows = try decoder.decode([UserPreferenceRow].self, from: await data(request))
        return Dictionary(uniqueKeysWithValues: rows.map { ($0.key, $0.value) })
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

@MainActor
final class NativeFeatureStore: ObservableObject {
    @Published var preferences: [String: JSONValue] = [:]
    @Published var profile = AccountProfile()
    @Published var schedule: [ClassScheduleEntry] = []
    @Published var customAssignments: [CustomAssignment] = []
    @Published var calendarPicks: [CalendarPick] = []
    @Published var estimates: [Int: Int] = [:]
    @Published var alerts: [ScheduledAlert] = []
    @Published var notificationPreferences = NotificationPreferences()
    @Published var isLoading = false
    @Published var errorMessage: String?
    unowned let sessionStore: NativeSessionStore

    init(sessionStore: NativeSessionStore) { self.sessionStore = sessionStore }

    func load() async {
        guard let api = sessionStore.api, let user = sessionStore.session?.user else { return }
        isLoading = true; errorMessage = nil; defer { isLoading = false }
        do {
            let token = try await sessionStore.accessToken()
            async let preferenceRows = api.preferences(token: token, userID: user.id)
            async let profileRow = api.accountProfile(token: token, userID: user.id)
            async let scheduleRows = api.classSchedule(token: token, userID: user.id)
            async let metaRows = api.assignmentMeta(token: token, userID: user.id)
            async let alertRows = api.scheduledAlerts(token: token, userID: user.id)
            async let notificationRow = api.notificationPreferences(token: token, userID: user.id)
            preferences = try await preferenceRows; profile = try await profileRow; schedule = try await scheduleRows
            let metas = try await metaRows
            estimates = Dictionary(uniqueKeysWithValues: metas.map { ($0.assignmentID, $0.estimatedMinutes ?? 0) })
            alerts = try await alertRows; notificationPreferences = NotificationPreferences(try await notificationRow)
            decodePreferenceModels()
        } catch { errorMessage = error.localizedDescription }
    }

    func savePreference<T: Encodable>(_ key: String, _ value: T) async throws {
        guard let api = sessionStore.api, let user = sessionStore.session?.user else { throw NativeAppError.signedOut }
        let data = try JSONEncoder().encode(value)
        let json = try JSONDecoder().decode(JSONValue.self, from: data)
        preferences[key] = json
        try await api.savePreference(key: key, value: json, token: try await sessionStore.accessToken(), userID: user.id)
        decodePreferenceModels()
    }

    func saveNotifications() async throws {
        guard let api = sessionStore.api, let user = sessionStore.session?.user else { throw NativeAppError.signedOut }
        try await api.syncNotificationPreferences(notificationPreferences.dictionary, token: try await sessionStore.accessToken(), userID: user.id)
    }

    func saveUsername(_ username: String) async throws {
        guard let api = sessionStore.api else { throw NativeAppError.signedOut }
        try await api.setUsername(username, token: try await sessionStore.accessToken())
        profile.username = username
    }

    func saveEstimate(_ minutes: Int?, for assignment: AssignmentItem) async throws {
        guard let api = sessionStore.api, let user = sessionStore.session?.user else { throw NativeAppError.signedOut }
        try await api.saveEstimate(assignmentID: assignment.id, courseID: assignment.courseID, minutes: minutes, token: try await sessionStore.accessToken(), userID: user.id)
        estimates[assignment.id] = minutes ?? 0
    }

    private func decodePreferenceModels() {
        let decoder = JSONDecoder()
        if let value = preferences["custom-assignments"], let data = try? JSONEncoder().encode(value) { customAssignments = (try? decoder.decode([CustomAssignment].self, from: data)) ?? [] }
        if let value = preferences["calendar-picks"], let data = try? JSONEncoder().encode(value) { calendarPicks = (try? decoder.decode([CalendarPick].self, from: data)) ?? [] }
    }
}

extension AssignmentItem {
    static func custom(_ item: CustomAssignment, course: CourseSummary?) -> AssignmentItem {
        AssignmentItem(id: item.id, name: item.name, description: item.notes, dueAt: item.dueAt, htmlURL: "", pointsPossible: item.pointsPossible, courseID: item.courseID, courseName: course?.name ?? "", courseCode: course?.courseCode ?? "", submission: nil)
    }
}
