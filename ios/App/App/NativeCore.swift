import Foundation
import Security
import UIKit
import Combine

enum NativeAppError: LocalizedError {
    case configuration(String)
    case server(String)
    /// A response the server rejected. `code` is the raw value it sent, kept for
    /// decisions; `message` is what a student should read.
    case http(status: Int, code: String, message: String)
    case signedOut

    var errorDescription: String? {
        switch self {
        case .configuration(let message), .server(let message): return message
        case .http(_, _, let message): return message
        case .signedOut: return "Please sign in again."
        }
    }

    /// The account has no Canvas URL or token saved yet.
    var isCanvasNotConnected: Bool {
        guard case .http(let status, let code, _) = self else { return false }
        return status == 428 || code == "NO_CANVAS_KEY" || code == "NO_CANVAS_DOMAIN"
    }

    /// The saved sign-in can no longer be renewed, so the student must sign in again.
    var isExpiredSignIn: Bool {
        guard case .http(let status, let code, _) = self else { return false }
        if status == 401 { return true }
        guard status == 400 || status == 403 else { return false }
        let value = code.lowercased()
        return value.contains("refresh") || value.contains("invalid_grant") || value.contains("session")
    }
}

/// Turns server error codes into sentences a student can act on.
enum NativeErrorText {
    static func friendly(code: String, status: Int) -> String {
        let raw = code.trimmingCharacters(in: .whitespacesAndNewlines)
        switch raw {
        case "NO_CANVAS_KEY", "NO_CANVAS_DOMAIN":
            return "Connect your Canvas account to see your classes."
        case "INVALID_DOMAIN":
            return "That doesn’t look like a Canvas address. Enter it like yourschool.instructure.com."
        case "CANVAS_DOMAIN_NOT_ALLOWED":
            return "CanvasPro can’t connect to that Canvas address yet. Check it, or email support@canvaspro.app to add your school."
        case "NOT_AUTHENTICATED":
            return "Please sign in again."
        default:
            break
        }
        let lower = raw.lowercased()
        if raw.hasPrefix("Canvas API 401") || raw.hasPrefix("Canvas API 403") {
            return "Canvas didn’t accept that access token. Create a new token in Canvas and try again."
        }
        if raw.hasPrefix("Canvas API 404") {
            return "Canvas couldn’t find that address. Check your Canvas URL."
        }
        if raw.hasPrefix("Canvas API") {
            return "Canvas had a problem responding. Please try again in a moment."
        }
        if lower.contains("invalid login credentials") || lower == "invalid_credentials" || lower.contains("invalid username or password") {
            return "That email, username, or password isn’t right."
        }
        if lower.contains("email not confirmed") {
            return "Confirm your email first. Check your inbox for the link we sent."
        }
        if lower.contains("user already registered") {
            return "An account with that email already exists. Sign in instead."
        }
        if status >= 500 || raw.isEmpty {
            return "CanvasPro had a problem. Please try again in a moment."
        }
        return raw
    }
}

struct NativeConfiguration {
    let supabaseURL: URL
    let publishableKey: String
    /// The website hosts the endpoints that need server-side secrets.
    static let websiteURL = URL(string: "https://canvaspro.app")!

    static func load() throws -> NativeConfiguration {
        let info = Bundle.main.infoDictionary ?? [:]
        let rawURL = (info["SupabaseURL"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let key = (info["SupabasePublishableKey"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        guard let url = URL(string: rawURL), !key.isEmpty, !rawURL.contains("$(") else {
            throw NativeAppError.configuration("CanvasPro’s native backend configuration is missing from this build.")
        }
        return NativeConfiguration(supabaseURL: url, publishableKey: key)
    }
}

struct NativeUser: Codable, Equatable {
    let id: String
    let email: String?
}

struct NativeSession: Codable, Equatable {
    var accessToken: String
    var refreshToken: String
    var expiresAt: Date
    var user: NativeUser
}

private enum SecureSessionStore {
    static let service = "app.canvaspro.mobile"
    static let account = "supabase-session"
    #if targetEnvironment(simulator)
    // Unsigned hosted simulators cannot always access Keychain. Keep a real,
    // authenticated session in memory only; never put tokens in UserDefaults.
    private static var previewSession: NativeSession?
    #endif

    static func save(_ session: NativeSession) throws {
        let data = try JSONEncoder().encode(session)
        let attributes: [String: Any] = [
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly,
        ]
        var status = SecItemUpdate(query() as CFDictionary, attributes as CFDictionary)
        if status == errSecSuccess {
            #if targetEnvironment(simulator)
            previewSession = nil
            #endif
            return
        }
        if status == errSecItemNotFound {
            var item = query()
            attributes.forEach { item[$0.key] = $0.value }
            status = SecItemAdd(item as CFDictionary, nil)
        }
        guard status == errSecSuccess else {
            #if targetEnvironment(simulator)
            previewSession = session
            return
            #else
            throw NativeAppError.server("Your credentials were accepted, but this device could not securely save your session (\(status)). Please try again.")
            #endif
        }
        #if targetEnvironment(simulator)
        previewSession = nil
        #endif
    }

    static func load() -> NativeSession? {
        #if targetEnvironment(simulator)
        if let previewSession { return previewSession }
        #endif
        var item = query()
        item[kSecReturnData as String] = true
        item[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: CFTypeRef?
        guard SecItemCopyMatching(item as CFDictionary, &result) == errSecSuccess,
              let data = result as? Data else { return nil }
        return try? JSONDecoder().decode(NativeSession.self, from: data)
    }

    static func clear() {
        #if targetEnvironment(simulator)
        previewSession = nil
        #endif
        SecItemDelete(query() as CFDictionary)
    }

    private static func query() -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
    }
}

struct CourseSummary: Codable, Identifiable, Hashable {
    let id: Int
    let name: String
    let courseCode: String
    let currentScore: Double?
    let currentGrade: String?
    let finalScore: Double?
    var syllabusBody: String? = nil

    enum CodingKeys: String, CodingKey {
        case id, name
        case courseCode = "course_code"
        case currentScore = "current_score"
        case currentGrade = "current_grade"
        case finalScore = "final_score"
        case syllabusBody = "syllabus_body"
    }
}

struct AssignmentSubmission: Codable, Hashable {
    let workflowState: String?
    let submittedAt: String?
    let score: Double?
    let gradedAt: String?
    let grade: String?
    let missing: Bool?
    let excused: Bool?
    let late: Bool?

    enum CodingKeys: String, CodingKey {
        case workflowState = "workflow_state"
        case submittedAt = "submitted_at"
        case score
        case gradedAt = "graded_at"
        case grade, missing, excused, late
    }
}

struct AssignmentItem: Codable, Identifiable, Hashable {
    let id: Int
    let name: String
    let description: String?
    let dueAt: String?
    let htmlURL: String
    let pointsPossible: Double?
    let courseID: Int
    let courseName: String
    let courseCode: String
    let submission: AssignmentSubmission?

    enum CodingKeys: String, CodingKey {
        case id, name, description
        case dueAt = "due_at"
        case htmlURL = "html_url"
        case pointsPossible = "points_possible"
        case courseID = "course_id"
        case courseName = "course_name"
        case courseCode = "course_code"
        case submission
    }
}

struct AnnouncementItem: Codable, Identifiable, Hashable {
    let id: Int
    let title: String
    let message: String
    let postedAt: String
    let htmlURL: String
    let contextCode: String
    let courseID: Int
    let courseName: String
    let courseCode: String

    enum CodingKeys: String, CodingKey {
        case id, title, message
        case postedAt = "posted_at"
        case htmlURL = "html_url"
        case contextCode = "context_code"
        case courseID = "course_id"
        case courseName = "course_name"
        case courseCode = "course_code"
    }
}

struct CalendarEventItem: Codable, Identifiable, Hashable {
    let id: String
    let title: String
    let startAt: String?
    let endAt: String?
    let htmlURL: String?
    let contextCode: String?
    let contextName: String?
    let locationName: String?

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        if let string = try? container.decode(String.self, forKey: .id) { id = string }
        else { id = String(try container.decode(Int.self, forKey: .id)) }
        title = try container.decode(String.self, forKey: .title)
        startAt = try container.decodeIfPresent(String.self, forKey: .startAt)
        endAt = try container.decodeIfPresent(String.self, forKey: .endAt)
        htmlURL = try container.decodeIfPresent(String.self, forKey: .htmlURL)
        contextCode = try container.decodeIfPresent(String.self, forKey: .contextCode)
        contextName = try container.decodeIfPresent(String.self, forKey: .contextName)
        locationName = try container.decodeIfPresent(String.self, forKey: .locationName)
    }

    private enum CodingKeys: String, CodingKey {
        case id, title
        case startAt = "start_at"
        case endAt = "end_at"
        case htmlURL = "html_url"
        case contextCode = "context_code"
        case contextName = "context_name"
        case locationName = "location_name"
    }
}

struct CanvasBundle: Codable {
    let courses: [CourseSummary]
    let assignments: [AssignmentItem]
    let announcements: [AnnouncementItem]
    let calendar: [CalendarEventItem]
    let errors: [String: String]?

    enum CodingKeys: String, CodingKey { case courses, assignments, announcements, calendar, errors }
}

/// Decodes a list one element at a time, skipping any element that can't be read,
/// so one unusual Canvas record never blanks the whole app.
private struct LossyList<Element: Decodable>: Decodable {
    let values: [Element]

    init(from decoder: Decoder) throws {
        var container = try decoder.unkeyedContainer()
        var values: [Element] = []
        while !container.isAtEnd {
            if let value = try? container.decode(Element.self) {
                values.append(value)
            } else if (try? container.decode(JSONValue.self)) == nil {
                // Nothing could consume this element, so stop rather than loop.
                break
            }
        }
        self.values = values
    }
}

private func uniqueByID<Item: Identifiable>(_ items: [Item]) -> [Item] {
    var seen = Set<Item.ID>()
    return items.filter { seen.insert($0.id).inserted }
}

extension CanvasBundle {
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        func list<Element: Decodable>(_ key: CodingKeys, _ type: Element.Type) -> [Element] {
            (try? container.decodeIfPresent(LossyList<Element>.self, forKey: key))?.values ?? []
        }
        self.init(
            courses: uniqueByID(list(.courses, CourseSummary.self)),
            assignments: uniqueByID(list(.assignments, AssignmentItem.self)),
            announcements: uniqueByID(list(.announcements, AnnouncementItem.self)),
            calendar: uniqueByID(list(.calendar, CalendarEventItem.self)),
            errors: (try? container.decodeIfPresent([String: String].self, forKey: .errors))
        )
    }
}

extension CourseSummary {
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        self.init(
            id: try c.decode(Int.self, forKey: .id),
            name: (try? c.decodeIfPresent(String.self, forKey: .name)) ?? "Course",
            courseCode: (try? c.decodeIfPresent(String.self, forKey: .courseCode)) ?? "",
            currentScore: (try? c.decodeIfPresent(Double.self, forKey: .currentScore)),
            currentGrade: (try? c.decodeIfPresent(String.self, forKey: .currentGrade)),
            finalScore: (try? c.decodeIfPresent(Double.self, forKey: .finalScore)),
            syllabusBody: (try? c.decodeIfPresent(String.self, forKey: .syllabusBody))
        )
    }
}

extension AssignmentItem {
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        self.init(
            id: try c.decode(Int.self, forKey: .id),
            name: (try? c.decodeIfPresent(String.self, forKey: .name)) ?? "Untitled assignment",
            description: (try? c.decodeIfPresent(String.self, forKey: .description)),
            dueAt: (try? c.decodeIfPresent(String.self, forKey: .dueAt)),
            htmlURL: (try? c.decodeIfPresent(String.self, forKey: .htmlURL)) ?? "",
            pointsPossible: (try? c.decodeIfPresent(Double.self, forKey: .pointsPossible)),
            courseID: try c.decode(Int.self, forKey: .courseID),
            courseName: (try? c.decodeIfPresent(String.self, forKey: .courseName)) ?? "",
            courseCode: (try? c.decodeIfPresent(String.self, forKey: .courseCode)) ?? "",
            submission: (try? c.decodeIfPresent(AssignmentSubmission.self, forKey: .submission))
        )
    }
}

extension AnnouncementItem {
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        let contextCode = (try? c.decodeIfPresent(String.self, forKey: .contextCode)) ?? ""
        let fallbackCourseID = Int(contextCode.replacingOccurrences(of: "course_", with: "")) ?? 0
        self.init(
            id: try c.decode(Int.self, forKey: .id),
            title: (try? c.decodeIfPresent(String.self, forKey: .title)) ?? "Announcement",
            message: (try? c.decodeIfPresent(String.self, forKey: .message)) ?? "",
            postedAt: (try? c.decodeIfPresent(String.self, forKey: .postedAt)) ?? "",
            htmlURL: (try? c.decodeIfPresent(String.self, forKey: .htmlURL)) ?? "",
            contextCode: contextCode,
            courseID: (try? c.decodeIfPresent(Int.self, forKey: .courseID)) ?? fallbackCourseID,
            courseName: (try? c.decodeIfPresent(String.self, forKey: .courseName)) ?? "",
            courseCode: (try? c.decodeIfPresent(String.self, forKey: .courseCode)) ?? ""
        )
    }
}

private struct NativeContentCache: Codable {
    let savedAt: Date
    let bundle: CanvasBundle
    let completed: [Int]
    let reopenedAt: [Int: Date]?
    let nicknames: [Int: ClassNickname]
}

struct NativeCompletionState {
    let completed: Set<Int>
    let reopenedAt: [Int: Date]
}

private enum NativeCourseworkCacheStore {
    private static func file(for userID: String) -> URL? {
        guard let id = UUID(uuidString: userID),
              let directory = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first else { return nil }
        return directory.appendingPathComponent("coursework-\(id.uuidString).json")
    }

    static func load(userID: String) -> Data? {
        guard let url = file(for: userID) else { return nil }
        return try? Data(contentsOf: url)
    }

    @discardableResult static func save(_ data: Data, userID: String) -> Bool {
        guard let url = file(for: userID) else { return false }
        let directory = url.deletingLastPathComponent()
        do {
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
            try data.write(to: url, options: .atomic)
            try FileManager.default.setAttributes([.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication], ofItemAtPath: url.path)
            var excludedURL = url
            var values = URLResourceValues()
            values.isExcludedFromBackup = true
            try excludedURL.setResourceValues(values)
            return true
        } catch {
            // The remote account remains the source of truth if offline caching fails.
            return false
        }
    }

    static func clear(userID: String) {
        guard let url = file(for: userID) else { return }
        try? FileManager.default.removeItem(at: url)
    }
}

enum NativePreviewData {
    private static func date(daysFromToday: Int, hour: Int = 17) -> String {
        let value = Calendar.current.date(byAdding: .day, value: daysFromToday, to: Date()) ?? Date()
        let scheduled = Calendar.current.date(bySettingHour: hour, minute: 0, second: 0, of: value) ?? value
        return ISO8601DateFormatter().string(from: scheduled)
    }

    static var bundle: CanvasBundle {
        let courses = [
            CourseSummary(id: 101, name: "Introduction to Psychology", courseCode: "PSY 101", currentScore: 91.4, currentGrade: "A-", finalScore: nil, syllabusBody: "<h2>Introduction to Psychology</h2><p>Meetings: Monday and Wednesday. Topics include learning, memory, development, and research methods.</p><p>Assignments and announcements are posted in Canvas.</p>"),
            CourseSummary(id: 102, name: "Data Structures", courseCode: "CS 230", currentScore: 87.2, currentGrade: "B+", finalScore: nil),
            CourseSummary(id: 103, name: "College Writing", courseCode: "ENG 102", currentScore: 94.0, currentGrade: "A", finalScore: nil),
        ]
        let assignments = [
            AssignmentItem(id: 1001, name: "Research outline", description: "Prepare an outline with at least three peer-reviewed sources.", dueAt: date(daysFromToday: 1), htmlURL: "", pointsPossible: 25, courseID: 103, courseName: "College Writing", courseCode: "ENG 102", submission: nil),
            AssignmentItem(id: 1002, name: "Linked list lab", description: "Implement insert, remove, and search operations.", dueAt: date(daysFromToday: 2), htmlURL: "", pointsPossible: 40, courseID: 102, courseName: "Data Structures", courseCode: "CS 230", submission: nil),
            AssignmentItem(id: 1003, name: "Memory and learning quiz", description: "Review chapters 6–7 before taking the quiz.", dueAt: date(daysFromToday: 4), htmlURL: "", pointsPossible: 15, courseID: 101, courseName: "Introduction to Psychology", courseCode: "PSY 101", submission: nil),
            AssignmentItem(id: 1004, name: "Discussion response", description: "Reply thoughtfully to two classmates.", dueAt: date(daysFromToday: -1), htmlURL: "", pointsPossible: 10, courseID: 101, courseName: "Introduction to Psychology", courseCode: "PSY 101", submission: AssignmentSubmission(workflowState: nil, submittedAt: nil, score: nil, gradedAt: nil, grade: nil, missing: true, excused: false, late: false)),
            AssignmentItem(id: 1005, name: "Arrays practice", description: "Completed example assignment.", dueAt: date(daysFromToday: -2), htmlURL: "", pointsPossible: 20, courseID: 102, courseName: "Data Structures", courseCode: "CS 230", submission: AssignmentSubmission(workflowState: "graded", submittedAt: date(daysFromToday: -2), score: 19, gradedAt: date(daysFromToday: -1), grade: "A", missing: false, excused: false, late: false)),
        ]
        let announcements = [
            AnnouncementItem(id: 501, title: "Reminder: outline workshop", message: "Bring a working thesis statement and one source to class on Thursday.", postedAt: date(daysFromToday: -1), htmlURL: "", contextCode: "course_103", courseID: 103, courseName: "College Writing", courseCode: "ENG 102"),
            AnnouncementItem(id: 502, title: "Exam review materials posted", message: "The review guide and practice problems are now available in Modules.", postedAt: date(daysFromToday: -2), htmlURL: "", contextCode: "course_101", courseID: 101, courseName: "Introduction to Psychology", courseCode: "PSY 101"),
        ]
        return CanvasBundle(courses: courses, assignments: assignments, announcements: announcements, calendar: [], errors: nil)
    }
}

struct ClassNickname: Codable, Identifiable, Hashable {
    let canvasCourseID: Int
    let rawName: String?
    let rawCode: String?
    var customName: String
    var id: Int { canvasCourseID }

    enum CodingKeys: String, CodingKey {
        case canvasCourseID = "canvas_course_id"
        case rawName = "raw_name"
        case rawCode = "raw_code"
        case customName = "custom_name"
    }
}

final class NativeAPI {
    let configuration: NativeConfiguration
    let decoder: JSONDecoder

    init(configuration: NativeConfiguration) {
        self.configuration = configuration
        decoder = JSONDecoder()
    }

    /// Signs in with an email address, or with a username like the website does.
    /// A username is resolved on the server so the account's email is never exposed.
    func signIn(identifier: String, password: String) async throws -> NativeSession {
        if identifier.contains("@") {
            var request = try request(path: "/auth/v1/token", query: [URLQueryItem(name: "grant_type", value: "password")])
            request.httpMethod = "POST"
            request.httpBody = try JSONSerialization.data(withJSONObject: ["email": identifier, "password": password])
            return try session(from: try await json(request))
        }
        var usernameRequest = URLRequest(url: NativeConfiguration.websiteURL.appendingPathComponent("api/mobile/sign-in"))
        usernameRequest.httpMethod = "POST"
        usernameRequest.timeoutInterval = 20
        usernameRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
        usernameRequest.httpBody = try JSONSerialization.data(withJSONObject: ["username": identifier.lowercased(), "password": password])
        return try session(from: try await json(usernameRequest))
    }

    func signUp(email: String, password: String, metadata: [String: Any]) async throws {
        var request = try request(path: "/auth/v1/signup", query: [.init(name: "redirect_to", value: "https://canvaspro.app/email-verified")])
        request.httpMethod = "POST"
        request.httpBody = try JSONSerialization.data(withJSONObject: ["email": email, "password": password, "data": metadata])
        _ = try await data(request)
    }

    func sendPasswordReset(email: String) async throws {
        var request = try request(path: "/auth/v1/recover", query: [.init(name: "redirect_to", value: "https://canvaspro.app/reset-password")])
        request.httpMethod = "POST"
        request.httpBody = try JSONSerialization.data(withJSONObject: ["email": email])
        _ = try await data(request)
    }

    func signOut(token: String) async throws {
        var request = try request(path: "/auth/v1/logout", token: token)
        request.httpMethod = "POST"
        _ = try await data(request)
    }

    /// Uses the website's account deletion, so the app and the website remove
    /// exactly the same data.
    func deleteAccount(token: String) async throws {
        var deleteRequest = URLRequest(url: NativeConfiguration.websiteURL.appendingPathComponent("api/mobile/delete-account"))
        deleteRequest.httpMethod = "POST"
        deleteRequest.timeoutInterval = 30
        deleteRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
        deleteRequest.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        deleteRequest.httpBody = try JSONSerialization.data(withJSONObject: ["confirm": "DELETE"])
        _ = try await data(deleteRequest)
    }

    /// The school address saved for this account (the token itself is never readable).
    func canvasDomain(token: String, userID: String) async throws -> String? {
        let rows = try await restRows(path: "/rest/v1/user_settings", token: token, query: [
            .init(name: "select", value: "canvas_domain"),
            .init(name: "user_id", value: "eq.\(userID)"),
            .init(name: "limit", value: "1"),
        ])
        let value = (rows.first?["canvas_domain"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines)
        return value?.isEmpty == false ? value : nil
    }

    func refresh(_ refreshToken: String) async throws -> NativeSession {
        var request = try request(path: "/auth/v1/token", query: [URLQueryItem(name: "grant_type", value: "refresh_token")])
        request.httpMethod = "POST"
        request.httpBody = try JSONSerialization.data(withJSONObject: ["refresh_token": refreshToken])
        return try session(from: try await json(request))
    }

    func canvasBundle(token: String) async throws -> CanvasBundle {
        var request = try request(path: "/functions/v1/canvas", token: token)
        request.httpMethod = "POST"
        request.httpBody = try JSONSerialization.data(withJSONObject: ["resource": "all"])
        let data = try await data(request)
        return try decoder.decode(CanvasBundle.self, from: data)
    }

    func completionState(token: String, userID: String) async throws -> NativeCompletionState {
        let rows = try await restRows(path: "/rest/v1/user_preferences", token: token, query: [
            .init(name: "select", value: "key,value"),
            .init(name: "user_id", value: "eq.\(userID)"),
            .init(name: "key", value: "like.assignment-completion:%"),
        ])
        var result = Set<Int>()
        var reopenedAt: [Int: Date] = [:]
        for row in rows {
            guard let key = row["key"] as? String,
                  let value = row["value"] as? [String: Any],
                  let id = Int(key.replacingOccurrences(of: "assignment-completion:", with: "")) else { continue }
            if value["completed"] as? Bool == true { result.insert(id) }
            else if let text = value["reopenedAt"] as? String,
                    let date = ISO8601DateFormatter.canvasDate(from: text) { reopenedAt[id] = date }
        }
        return NativeCompletionState(completed: result, reopenedAt: reopenedAt)
    }

    func setCompletion(_ completed: Bool, assignment: AssignmentItem, reopenedAt: Date?, token: String, userID: String) async throws {
        var value: [String: Any] = [
            "completed": completed,
            "completedAt": completed ? ISO8601DateFormatter().string(from: Date()) : NSNull(),
            "dueAt": assignment.dueAt as Any? ?? NSNull(),
        ]
        if let reopenedAt { value["reopenedAt"] = ISO8601DateFormatter.canvas.string(from: reopenedAt) }
        try await upsert(table: "user_preferences", token: token, conflict: "user_id,key", rows: [[
            "user_id": userID,
            "key": "assignment-completion:\(assignment.id)",
            "value": value,
        ]])
    }

    func nicknames(token: String, userID: String) async throws -> [ClassNickname] {
        let request = try request(path: "/rest/v1/class_nicknames", token: token, query: [
            .init(name: "select", value: "canvas_course_id,raw_name,raw_code,custom_name"),
            .init(name: "user_id", value: "eq.\(userID)"),
        ])
        return try decoder.decode([ClassNickname].self, from: await data(request))
    }

    func saveNickname(_ nickname: ClassNickname, token: String, userID: String) async throws {
        let trimmed = nickname.customName.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty {
            var request = try request(path: "/rest/v1/class_nicknames", token: token, query: [
                .init(name: "user_id", value: "eq.\(userID)"),
                .init(name: "canvas_course_id", value: "eq.\(nickname.canvasCourseID)"),
            ])
            request.httpMethod = "DELETE"
            _ = try await data(request)
            return
        }
        try await upsert(table: "class_nicknames", token: token, conflict: "user_id,canvas_course_id", rows: [[
            "user_id": userID,
            "canvas_course_id": nickname.canvasCourseID,
            "raw_name": nickname.rawName as Any? ?? NSNull(),
            "raw_code": nickname.rawCode as Any? ?? NSNull(),
            "custom_name": trimmed,
        ]])
    }

    func saveCanvas(domain: String, canvasToken: String, token: String, userID: String) async throws {
        var validation = try request(path: "/functions/v1/canvas", token: token)
        validation.httpMethod = "POST"
        validation.httpBody = try JSONSerialization.data(withJSONObject: [
            "resource": "validate", "domain": domain, "token": canvasToken,
        ])
        _ = try await data(validation)
        try await upsert(table: "user_settings", token: token, conflict: "user_id", rows: [[
            "user_id": userID, "canvas_domain": domain, "canvas_api_key": canvasToken,
        ]])
    }

    func upsertPushToken(_ deviceToken: String, token: String, userID: String) async throws {
        #if DEBUG
        let environment = "sandbox"
        #else
        let environment = "production"
        #endif
        try await upsert(table: "native_push_tokens", token: token, conflict: "token", rows: [[
            "user_id": userID, "token": deviceToken, "platform": "ios", "environment": environment,
            "updated_at": ISO8601DateFormatter().string(from: Date()),
        ]])
    }

    func deletePushToken(_ deviceToken: String, token: String) async throws {
        var request = try request(path: "/rest/v1/native_push_tokens", token: token, query: [
            .init(name: "token", value: "eq.\(deviceToken)"),
        ])
        request.httpMethod = "DELETE"
        _ = try await data(request)
    }

    func notificationPreferences(token: String, userID: String) async throws -> [String: Any]? {
        let rows = try await restRows(path: "/rest/v1/notification_prefs", token: token, query: [
            .init(name: "select", value: "prefs"), .init(name: "user_id", value: "eq.\(userID)"), .init(name: "limit", value: "1"),
        ])
        return rows.first?["prefs"] as? [String: Any]
    }

    /// Merges only the supplied fields, preserving every preference created on the website.
    func syncNotificationPreferences(_ changes: [String: Any], token: String, userID: String) async throws {
        var prefs = try await notificationPreferences(token: token, userID: userID) ?? [:]
        changes.forEach { prefs[$0.key] = $0.value }
        try await upsert(table: "notification_prefs", token: token, conflict: "user_id", rows: [[
            "user_id": userID, "prefs": prefs,
            "timezone_offset_minutes": TimeZone.current.secondsFromGMT() / -60,
            "updated_at": ISO8601DateFormatter().string(from: Date()),
        ]])
    }

    func upsert(table: String, token: String, conflict: String, rows: [[String: Any]]) async throws {
        var request = try request(path: "/rest/v1/\(table)", token: token, query: [.init(name: "on_conflict", value: conflict)])
        request.httpMethod = "POST"
        request.setValue("resolution=merge-duplicates,return=minimal", forHTTPHeaderField: "Prefer")
        request.httpBody = try JSONSerialization.data(withJSONObject: rows)
        _ = try await data(request)
    }

    func restRows(path: String, token: String, query: [URLQueryItem]) async throws -> [[String: Any]] {
        try await json(request(path: path, token: token, query: query)) as? [[String: Any]] ?? []
    }

    func request(path: String, token: String? = nil, query: [URLQueryItem] = []) throws -> URLRequest {
        let relativePath = path.hasPrefix("/") ? String(path.dropFirst()) : path
        guard var components = URLComponents(url: configuration.supabaseURL.appendingPathComponent(relativePath), resolvingAgainstBaseURL: false) else {
            throw NativeAppError.configuration("Invalid backend URL.")
        }
        components.queryItems = query.isEmpty ? nil : query
        guard let url = components.url else { throw NativeAppError.configuration("Invalid backend request.") }
        var request = URLRequest(url: url)
        request.timeoutInterval = 20
        request.setValue(configuration.publishableKey, forHTTPHeaderField: "apikey")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let token { request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
        return request
    }

    func data(_ request: URLRequest) async throws -> Data {
        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await URLSession.shared.data(for: request)
        } catch let error as URLError {
            switch error.code {
            case .notConnectedToInternet, .networkConnectionLost:
                throw NativeAppError.server("Your connection was interrupted. Check your internet connection and try again.")
            case .timedOut:
                throw NativeAppError.server("CanvasPro took too long to respond. Please try again.")
            case .cannotFindHost, .cannotConnectToHost, .dnsLookupFailed:
                throw NativeAppError.server("Could not reach CanvasPro. Please try again in a moment.")
            default: throw error
            }
        }
        guard let http = response as? HTTPURLResponse else {
            throw NativeAppError.server("CanvasPro sent an unexpected response. Please try again.")
        }
        guard (200..<300).contains(http.statusCode) else {
            let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
            let text = object?["msg"] as? String ?? object?["error_description"] as? String ?? object?["message"] as? String ?? object?["error"] as? String ?? ""
            let code = object?["error_code"] as? String ?? (object?["code"] as? String) ?? text
            throw NativeAppError.http(
                status: http.statusCode,
                code: code,
                message: NativeErrorText.friendly(code: text.isEmpty ? code : text, status: http.statusCode)
            )
        }
        return data
    }

    func json(_ request: URLRequest) async throws -> Any {
        try JSONSerialization.jsonObject(with: await data(request))
    }

    private func session(from json: Any) throws -> NativeSession {
        guard let object = json as? [String: Any],
              let access = object["access_token"] as? String,
              let refresh = object["refresh_token"] as? String,
              let user = object["user"] as? [String: Any],
              let id = user["id"] as? String else { throw NativeAppError.server("The sign-in response was incomplete.") }
        let seconds = (object["expires_in"] as? NSNumber)?.doubleValue ?? 3600
        return NativeSession(accessToken: access, refreshToken: refresh, expiresAt: Date().addingTimeInterval(seconds), user: NativeUser(id: id, email: user["email"] as? String))
    }
}

@MainActor
final class NativeSessionStore: ObservableObject {
    @Published private(set) var session: NativeSession?
    @Published var isWorking = false
    @Published var errorMessage: String?
    let api: NativeAPI?
    let configurationError: String?
    private var refreshTask: Task<NativeSession, Error>?
    private var refreshingToken: String?
    private static let installMarkerKey = "CanvasProInstalled"

    init() {
        // Keychain items outlive deleting the app. A fresh install starts signed out
        // instead of silently restoring whoever used the app before.
        if !UserDefaults.standard.bool(forKey: Self.installMarkerKey) {
            SecureSessionStore.clear()
            UserDefaults.standard.set(true, forKey: Self.installMarkerKey)
        }
        do {
            let api = NativeAPI(configuration: try NativeConfiguration.load())
            self.api = api
            configurationError = nil
            session = SecureSessionStore.load()
        } catch {
            api = nil
            configurationError = error.localizedDescription
            session = nil
        }
    }

    /// Accepts an email address or a CanvasPro username, like the website.
    func signIn(identifier: String, password: String) async {
        guard !isWorking else { return }
        guard let api else { errorMessage = configurationError; return }
        isWorking = true
        errorMessage = nil
        defer { isWorking = false }
        do {
            let newSession = try await api.signIn(identifier: identifier.trimmingCharacters(in: .whitespacesAndNewlines), password: password)
            try SecureSessionStore.save(newSession)
            session = newSession
        } catch { errorMessage = error.localizedDescription }
    }

    func signUp(email: String, password: String, metadata: [String: Any]) async -> Bool {
        guard !isWorking else { return false }
        guard let api else { errorMessage = configurationError; return false }
        isWorking = true
        errorMessage = nil
        defer { isWorking = false }
        do {
            try await api.signUp(email: email.trimmingCharacters(in: .whitespacesAndNewlines), password: password, metadata: metadata)
            return true
        } catch {
            errorMessage = error.localizedDescription
            return false
        }
    }

    func sendPasswordReset(email: String) async -> Bool {
        guard !isWorking else { return false }
        guard let api else { errorMessage = configurationError; return false }
        isWorking = true
        errorMessage = nil
        defer { isWorking = false }
        do {
            try await api.sendPasswordReset(email: email.trimmingCharacters(in: .whitespacesAndNewlines))
            return true
        } catch {
            errorMessage = error.localizedDescription
            return false
        }
    }

    func accessToken() async throws -> String {
        guard let api, let current = session else { throw NativeAppError.signedOut }
        guard current.expiresAt.timeIntervalSinceNow < 90 else { return current.accessToken }
        // Content and preferences load concurrently; share one token refresh
        // rather than rotating the same refresh token in separate requests.
        let originalToken = current.refreshToken
        let task: Task<NativeSession, Error>
        if let existing = refreshTask, refreshingToken == originalToken {
            task = existing
        } else {
            task = Task { try await api.refresh(originalToken) }
            refreshTask = task
            refreshingToken = originalToken
        }
        defer {
            if refreshingToken == originalToken { refreshTask = nil; refreshingToken = nil }
        }
        let refreshed: NativeSession
        do {
            refreshed = try await task.value
        } catch let error as NativeAppError where error.isExpiredSignIn {
            // The server no longer accepts this sign-in (revoked, expired, or used
            // elsewhere). Retrying can never succeed, so return to the sign-in screen.
            if session?.refreshToken == originalToken { clearLocalSession() }
            throw NativeAppError.signedOut
        }
        guard let active = session, active.user.id == current.user.id else { throw NativeAppError.signedOut }
        // Another waiter may already have saved the result. An account change
        // must never let a delayed refresh overwrite the new session.
        guard active.refreshToken == originalToken else { return active.accessToken }
        try SecureSessionStore.save(refreshed)
        session = refreshed
        return refreshed.accessToken
    }

    func signOut() async {
        if let api, session != nil {
            do {
                let token = try await accessToken()
                if let deviceToken = UserDefaults.standard.string(forKey: "CanvasProNativePushToken") {
                    try? await api.deletePushToken(deviceToken, token: token)
                    UserDefaults.standard.removeObject(forKey: "CanvasProNativePushToken")
                }
                try? await api.signOut(token: token)
            } catch { /* Local sign-out must always succeed. */ }
        }
        clearLocalSession()
    }

    func deleteAccount() async {
        guard let api, session != nil else { return }
        isWorking = true
        errorMessage = nil
        defer { isWorking = false }
        do {
            try await api.deleteAccount(token: try await accessToken())
            clearLocalSession()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func clearLocalSession() {
        refreshTask?.cancel()
        refreshTask = nil
        refreshingToken = nil
        let previousUserID = session?.user.id
        UIApplication.shared.unregisterForRemoteNotifications()
        if let previousUserID {
            NativeCourseworkCacheStore.clear(userID: previousUserID)
            UserDefaults.standard.removeObject(forKey: "CanvasProNativeContentCache.\(previousUserID)")
            UserDefaults.standard.removeObject(forKey: "CanvasProNativeDigest.\(previousUserID)")
            UserDefaults.standard.removeObject(forKey: "CanvasProNativeGradeHistory.\(previousUserID)")
            UserDefaults.standard.removeObject(forKey: "CanvasProNativeStudySession.\(previousUserID)")
            for part in ["window", "skipped", "order", "date"] {
                UserDefaults.standard.removeObject(forKey: "CanvasProNativePlan.\(previousUserID).\(part)")
            }
        }
        for key in [
            "CanvasProNativeDigest", "CanvasProNativeGradeHistory", "CanvasProNativePushToken",
            "CanvasProPreviewStudySession", "CanvasProDismissedAnnouncements",
            "CanvasProPlanWindow", "CanvasProPlanSkipped", "CanvasProPlanOrder", "CanvasProPlanDate",
        ] { UserDefaults.standard.removeObject(forKey: key) }
        // Light/dark mode and palette are this device's display choices, so they stay.
        SecureSessionStore.clear()
        session = nil
    }
}

@MainActor
final class NativeContentStore: ObservableObject {
    @Published var bundle = CanvasBundle(courses: [], assignments: [], announcements: [], calendar: [], errors: nil)
    @Published var completed = Set<Int>()
    @Published var reopenedAt: [Int: Date] = [:]
    @Published var completionSavesInFlight = Set<Int>()
    /// The task finished most recently; the Undo bar shows it for a few seconds.
    @Published var undoItem: AssignmentItem?
    @Published var nicknames: [Int: ClassNickname] = [:]
    @Published var isLoading = false
    @Published var isShowingCachedData = false
    @Published var lastSyncedAt: Date?
    @Published var syncMessage: String?
    @Published var errorMessage: String?
    /// True when the account has no Canvas connection yet. The app shows a
    /// "Connect Canvas" step instead of an error.
    @Published var needsCanvasConnection = false
    /// False until the first refresh has finished (successfully or not).
    @Published var hasLoaded = false
    /// Why the very first load failed, when there is nothing saved to show instead.
    @Published var loadFailure: String?
    let isPreview: Bool

    /// Nothing to show yet and a refresh is on its way: screens show placeholders
    /// instead of misleading "no classes" messages.
    var isFirstLoad: Bool {
        (isLoading || !hasLoaded) && bundle.courses.isEmpty && bundle.assignments.isEmpty && !needsCanvasConnection && loadFailure == nil
    }
    private unowned let sessionStore: NativeSessionStore
    var persistenceScope: String { isPreview ? "preview" : (sessionStore.session?.user.id ?? "signed-out") }
    private let previewCompletedKey = "CanvasProPreviewCompleted"
    private let previewNicknamesKey = "CanvasProPreviewNicknames"

    init(sessionStore: NativeSessionStore, preview: Bool = false) {
        self.sessionStore = sessionStore
        isPreview = preview
        if preview {
            bundle = NativePreviewData.bundle
            hasLoaded = true
            if let saved = UserDefaults.standard.array(forKey: previewCompletedKey) as? [NSNumber] { completed = Set(saved.map(\.intValue)) }
            else { completed = [1005] }
            if let data = UserDefaults.standard.data(forKey: previewNicknamesKey),
               let saved = try? JSONDecoder().decode([Int: ClassNickname].self, from: data) { nicknames = saved }
            lastSyncedAt = Date()
        } else {
            loadCachedContent()
        }
    }

    func load() async {
        guard !isPreview else { return }
        guard let api = sessionStore.api, let user = sessionStore.session?.user else { return }
        guard !isLoading else { return }
        isLoading = true
        errorMessage = nil
        syncMessage = nil
        loadFailure = nil
        defer { isLoading = false; hasLoaded = true }
        do {
            let token = try await sessionStore.accessToken()
            async let bundleRequest = api.canvasBundle(token: token)
            async let completionRequest = api.completionState(token: token, userID: user.id)
            async let nicknameRequest = api.nicknames(token: token, userID: user.id)
            let freshBundle = try await bundleRequest
            var freshCompleted = completed
            var freshReopenedAt = reopenedAt
            var savedPreferenceWarning: String?

            do {
                let state = try await completionRequest
                freshCompleted = state.completed
                freshReopenedAt = state.reopenedAt
            } catch {
                savedPreferenceWarning = "Coursework refreshed. Saved completion state could not update."
            }

            do {
                let nicknameValues = try await nicknameRequest
                nicknames = Dictionary(nicknameValues.map { ($0.canvasCourseID, $0) }, uniquingKeysWith: { first, _ in first })
            } catch {
                savedPreferenceWarning = savedPreferenceWarning ?? "Coursework refreshed. Class nicknames could not update."
            }

            bundle = freshBundle
            completed = sanitizedCompletedIDs(freshCompleted, in: freshBundle)
            reopenedAt = freshReopenedAt
            lastSyncedAt = Date()
            isShowingCachedData = false
            needsCanvasConnection = false
            syncMessage = savedPreferenceWarning
            persistContentCache()
        } catch let error as NativeAppError where error.isCanvasNotConnected {
            // Not an error: this account simply hasn't connected Canvas yet.
            needsCanvasConnection = true
            isShowingCachedData = false
            syncMessage = nil
        } catch NativeAppError.signedOut {
            // The session store has already returned to the sign-in screen.
        } catch is CancellationError {
            // The screen went away mid-refresh; nothing to report.
        } catch let error as URLError where error.code == .cancelled {
            // A pull-to-refresh that was let go early; nothing to report.
        } catch {
            if bundle.courses.isEmpty && bundle.assignments.isEmpty {
                errorMessage = friendlySyncError(error)
                loadFailure = errorMessage
            } else {
                isShowingCachedData = true
                syncMessage = "Showing saved coursework. Pull to refresh when your connection is back."
            }
        }
    }

    func displayName(courseID: Int, fallback: String) -> String {
        if let nickname = nicknames[courseID]?.customName.trimmingCharacters(in: .whitespacesAndNewlines), !nickname.isEmpty {
            return cleanCourseTitle(nickname)
        }
        let course = bundle.courses.first { $0.id == courseID }
        let name = course?.name ?? fallback
        let code = course?.courseCode ?? ""
        return cleanCourseTitle(name.isEmpty ? (code.isEmpty ? "Course" : code) : name)
    }

    private func cleanCourseTitle(_ value: String) -> String {
        let title = value.trimmingCharacters(in: .whitespacesAndNewlines)
        let letters = title.filter { $0.isLetter }
        guard letters.count >= 3, letters == letters.uppercased() else { return title }
        let acronyms: Set<String> = ["CE", "CS", "IT", "AI", "EE", "ME", "BME", "ECE", "CIV", "CHM", "CHEM", "BIO", "ENG", "ENGR", "MATH", "PHY", "PHYS", "HUM", "HIST", "SOC", "PSY", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "AP", "IB", "GPA", "USA", "UK"]
        let minor: Set<String> = ["of", "and", "in", "to", "for", "with", "on", "at", "by", "from", "the", "a", "an"]
        return title.split(separator: " ", omittingEmptySubsequences: false).enumerated().map { index, part in
            let word = String(part)
            let clean = word.filter { $0.isLetter || $0.isNumber }.uppercased()
            if acronyms.contains(clean) { return word.uppercased() }
            let lower = word.lowercased()
            if index > 0 && minor.contains(lower) { return lower }
            return lower.prefix(1).uppercased() + String(lower.dropFirst())
        }.joined(separator: " ")
    }

    func toggle(_ assignment: AssignmentItem) async {
        if isPreview {
            if assignment.isFinished(in: self) { completed.remove(assignment.id); reopenedAt[assignment.id] = Date() }
            else { completed.insert(assignment.id); reopenedAt.removeValue(forKey: assignment.id); undoItem = assignment }
            UserDefaults.standard.set(Array(completed), forKey: previewCompletedKey)
            return
        }
        guard let api = sessionStore.api, let user = sessionStore.session?.user else { return }
        guard !completionSavesInFlight.contains(assignment.id) else { return }
        completionSavesInFlight.insert(assignment.id)
        defer { completionSavesInFlight.remove(assignment.id) }
        let next = !assignment.isFinished(in: self)
        let previousCompleted = completed.contains(assignment.id)
        let previousReopen = reopenedAt[assignment.id]
        if next { completed.insert(assignment.id); reopenedAt.removeValue(forKey: assignment.id) }
        else {
            completed.remove(assignment.id)
            if assignment.isCanvasFinished { reopenedAt[assignment.id] = Date() }
            else { reopenedAt.removeValue(forKey: assignment.id) }
        }
        do {
            try await api.setCompletion(next, assignment: assignment, reopenedAt: reopenedAt[assignment.id], token: try await sessionStore.accessToken(), userID: user.id)
            persistContentCache()
            undoItem = next ? assignment : nil
        } catch {
            if previousCompleted { completed.insert(assignment.id) } else { completed.remove(assignment.id) }
            reopenedAt[assignment.id] = previousReopen
            errorMessage = error.localizedDescription
        }
    }

    func saveNickname(course: CourseSummary, name: String) async throws {
        if isPreview {
            let row = ClassNickname(canvasCourseID: course.id, rawName: course.name, rawCode: course.courseCode, customName: name)
            if name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { nicknames.removeValue(forKey: course.id) }
            else { nicknames[course.id] = row }
            if let data = try? JSONEncoder().encode(nicknames) { UserDefaults.standard.set(data, forKey: previewNicknamesKey) }
            return
        }
        guard let api = sessionStore.api, let user = sessionStore.session?.user else { return }
        let row = ClassNickname(canvasCourseID: course.id, rawName: course.name, rawCode: course.courseCode, customName: name)
        try await api.saveNickname(row, token: try await sessionStore.accessToken(), userID: user.id)
        if name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { nicknames.removeValue(forKey: course.id) }
        else { nicknames[course.id] = row }
        persistContentCache()
    }

    func saveCanvas(domain: String, canvasToken: String) async throws {
        guard let api = sessionStore.api, let user = sessionStore.session?.user else { return }
        let cleanDomain = NativeContentStore.normalizedCanvasDomain(domain)
        guard cleanDomain.contains("."), cleanDomain.count >= 5 else {
            throw NativeAppError.server("Enter your Canvas URL like yourschool.instructure.com.")
        }
        let cleanToken = canvasToken.trimmingCharacters(in: .whitespacesAndNewlines)
        guard cleanToken.count >= 20 else {
            throw NativeAppError.server("Paste the full Canvas API token.")
        }
        try await api.saveCanvas(domain: cleanDomain, canvasToken: cleanToken, token: try await sessionStore.accessToken(), userID: user.id)
        needsCanvasConnection = false
        await load()
    }

    /// The school address this account is connected to, if any.
    func connectedCanvasDomain() async -> String? {
        guard !isPreview, let api = sessionStore.api, let user = sessionStore.session?.user,
              let token = try? await sessionStore.accessToken() else { return nil }
        return try? await api.canvasDomain(token: token, userID: user.id)
    }

    private func loadCachedContent() {
        guard let userID = sessionStore.session?.user.id,
              let data = NativeCourseworkCacheStore.load(userID: userID) ?? UserDefaults.standard.data(forKey: cacheKey(userID: userID)),
              let cache = try? JSONDecoder().decode(NativeContentCache.self, from: data) else { return }
        if NativeCourseworkCacheStore.save(data, userID: userID) {
            UserDefaults.standard.removeObject(forKey: cacheKey(userID: userID))
        }
        bundle = cache.bundle
        completed = sanitizedCompletedIDs(Set(cache.completed), in: cache.bundle)
        reopenedAt = cache.reopenedAt ?? [:]
        nicknames = cache.nicknames
        lastSyncedAt = cache.savedAt
        isShowingCachedData = true
    }

    private func persistContentCache() {
        guard !isPreview, let userID = sessionStore.session?.user.id else { return }
        let savedAt = lastSyncedAt ?? Date()
        let cache = NativeContentCache(savedAt: savedAt, bundle: bundle, completed: Array(sanitizedCompletedIDs(completed, in: bundle)), reopenedAt: reopenedAt, nicknames: nicknames)
        if let data = try? JSONEncoder().encode(cache) {
            NativeCourseworkCacheStore.save(data, userID: userID)
        }
    }

    private func cacheKey(userID: String) -> String {
        "CanvasProNativeContentCache.\(userID)"
    }

    private func sanitizedCompletedIDs(_ ids: Set<Int>, in bundle: CanvasBundle) -> Set<Int> {
        let assignmentIDs = Set(bundle.assignments.map(\.id))
        return ids.filter { assignmentIDs.contains($0) || $0 < 0 }
    }

    private static func normalizedCanvasDomain(_ raw: String) -> String {
        var value = raw.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        value = value.replacingOccurrences(of: "https://", with: "")
        value = value.replacingOccurrences(of: "http://", with: "")
        value = value.split(separator: "/").first.map(String.init) ?? value
        return value.trimmingCharacters(in: CharacterSet(charactersIn: "."))
    }

    private func friendlySyncError(_ error: Error) -> String {
        if let urlError = error as? URLError {
            switch urlError.code {
            case .notConnectedToInternet, .networkConnectionLost, .timedOut, .cannotFindHost, .cannotConnectToHost, .dnsLookupFailed:
                return "Could not refresh Canvas. Check your connection and try again."
            default:
                break
            }
        }
        if let appError = error as? NativeAppError, case .http(let status, let code, _) = appError,
           code.hasPrefix("Canvas API 401") || code.hasPrefix("Canvas API 403") || (status == 400 && code.hasPrefix("Canvas API")) {
            return "Canvas rejected the saved connection. Update your Canvas URL and token in Settings → Canvas connection."
        }
        return error.localizedDescription
    }
}
