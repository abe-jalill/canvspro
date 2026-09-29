import Foundation
import Security
import UIKit
import Combine

enum NativeAppError: LocalizedError {
    case configuration(String)
    case server(String)
    case signedOut

    var errorDescription: String? {
        switch self {
        case .configuration(let message), .server(let message): return message
        case .signedOut: return "Please sign in again."
        }
    }
}

struct NativeConfiguration {
    let supabaseURL: URL
    let publishableKey: String

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

    static func save(_ session: NativeSession) throws {
        let data = try JSONEncoder().encode(session)
        SecItemDelete(query() as CFDictionary)
        var item = query()
        item[kSecValueData as String] = data
        item[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        let status = SecItemAdd(item as CFDictionary, nil)
        guard status == errSecSuccess else { throw NativeAppError.server("Could not securely save your session.") }
    }

    static func load() -> NativeSession? {
        var item = query()
        item[kSecReturnData as String] = true
        item[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: CFTypeRef?
        guard SecItemCopyMatching(item as CFDictionary, &result) == errSecSuccess,
              let data = result as? Data else { return nil }
        return try? JSONDecoder().decode(NativeSession.self, from: data)
    }

    static func clear() { SecItemDelete(query() as CFDictionary) }

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

    enum CodingKeys: String, CodingKey {
        case id, name
        case courseCode = "course_code"
        case currentScore = "current_score"
        case currentGrade = "current_grade"
        case finalScore = "final_score"
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

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        if let string = try? container.decode(String.self, forKey: .id) { id = string }
        else { id = String(try container.decode(Int.self, forKey: .id)) }
        title = try container.decode(String.self, forKey: .title)
        startAt = try container.decodeIfPresent(String.self, forKey: .startAt)
        endAt = try container.decodeIfPresent(String.self, forKey: .endAt)
        htmlURL = try container.decodeIfPresent(String.self, forKey: .htmlURL)
    }

    private enum CodingKeys: String, CodingKey {
        case id, title
        case startAt = "start_at"
        case endAt = "end_at"
        case htmlURL = "html_url"
    }
}

struct CanvasBundle: Codable {
    let courses: [CourseSummary]
    let assignments: [AssignmentItem]
    let announcements: [AnnouncementItem]
    let calendar: [CalendarEventItem]
    let errors: [String: String]?
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

    func signIn(email: String, password: String) async throws -> NativeSession {
        var request = try request(path: "/auth/v1/token", query: [URLQueryItem(name: "grant_type", value: "password")])
        request.httpMethod = "POST"
        request.httpBody = try JSONSerialization.data(withJSONObject: ["email": email, "password": password])
        let json = try await json(request)
        return try session(from: json)
    }

    func signUp(email: String, password: String, metadata: [String: Any]) async throws {
        var request = try request(path: "/auth/v1/signup")
        request.httpMethod = "POST"
        request.httpBody = try JSONSerialization.data(withJSONObject: ["email": email, "password": password, "data": metadata])
        _ = try await data(request)
    }

    func sendPasswordReset(email: String) async throws {
        var request = try request(path: "/auth/v1/recover")
        request.httpMethod = "POST"
        request.httpBody = try JSONSerialization.data(withJSONObject: ["email": email])
        _ = try await data(request)
    }

    func signOut(token: String) async throws {
        var request = try request(path: "/auth/v1/logout", token: token)
        request.httpMethod = "POST"
        _ = try await data(request)
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

    func completionIDs(token: String, userID: String) async throws -> Set<Int> {
        let rows = try await restRows(path: "/rest/v1/user_preferences", token: token, query: [
            .init(name: "select", value: "key,value"),
            .init(name: "user_id", value: "eq.\(userID)"),
            .init(name: "key", value: "like.assignment-completion:%"),
        ])
        var result = Set<Int>()
        for row in rows {
            guard let key = row["key"] as? String,
                  let value = row["value"] as? [String: Any],
                  value["completed"] as? Bool == true,
                  let id = Int(key.replacingOccurrences(of: "assignment-completion:", with: "")) else { continue }
            result.insert(id)
        }
        return result
    }

    func setCompletion(_ completed: Bool, assignment: AssignmentItem, token: String, userID: String) async throws {
        let value: [String: Any] = [
            "completed": completed,
            "completedAt": completed ? ISO8601DateFormatter().string(from: Date()) : NSNull(),
            "dueAt": assignment.dueAt as Any? ?? NSNull(),
        ]
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
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
            let message = object?["msg"] as? String ?? object?["error_description"] as? String ?? object?["error"] as? String ?? "The server rejected this request."
            throw NativeAppError.server(message)
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

    init() {
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

    func signIn(email: String, password: String) async {
        guard let api else { return }
        isWorking = true
        errorMessage = nil
        defer { isWorking = false }
        do {
            let newSession = try await api.signIn(email: email, password: password)
            try SecureSessionStore.save(newSession)
            session = newSession
        } catch { errorMessage = error.localizedDescription }
    }

    func signUp(email: String, password: String, metadata: [String: Any]) async -> Bool {
        guard let api else { return false }
        isWorking = true
        errorMessage = nil
        defer { isWorking = false }
        do {
            try await api.signUp(email: email, password: password, metadata: metadata)
            return true
        } catch {
            errorMessage = error.localizedDescription
            return false
        }
    }

    func sendPasswordReset(email: String) async -> Bool {
        guard let api else { return false }
        isWorking = true
        errorMessage = nil
        defer { isWorking = false }
        do {
            try await api.sendPasswordReset(email: email)
            return true
        } catch {
            errorMessage = error.localizedDescription
            return false
        }
    }

    func accessToken() async throws -> String {
        guard let api, var current = session else { throw NativeAppError.signedOut }
        if current.expiresAt.timeIntervalSinceNow < 90 {
            current = try await api.refresh(current.refreshToken)
            try SecureSessionStore.save(current)
            session = current
        }
        return current.accessToken
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
        UIApplication.shared.unregisterForRemoteNotifications()
        SecureSessionStore.clear()
        session = nil
    }
}

@MainActor
final class NativeContentStore: ObservableObject {
    @Published var bundle = CanvasBundle(courses: [], assignments: [], announcements: [], calendar: [], errors: nil)
    @Published var completed = Set<Int>()
    @Published var nicknames: [Int: ClassNickname] = [:]
    @Published var isLoading = false
    @Published var errorMessage: String?
    private unowned let sessionStore: NativeSessionStore

    init(sessionStore: NativeSessionStore) { self.sessionStore = sessionStore }

    func load() async {
        guard let api = sessionStore.api, let user = sessionStore.session?.user else { return }
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            let token = try await sessionStore.accessToken()
            async let canvas = api.canvasBundle(token: token)
            async let completionRows = api.completionIDs(token: token, userID: user.id)
            async let nicknameRows = api.nicknames(token: token, userID: user.id)
            bundle = try await canvas
            completed = try await completionRows
            let nicknameValues = try await nicknameRows
            nicknames = Dictionary(uniqueKeysWithValues: nicknameValues.map { ($0.canvasCourseID, $0) })
        } catch { errorMessage = error.localizedDescription }
    }

    func displayName(courseID: Int, fallback: String) -> String { nicknames[courseID]?.customName ?? fallback }

    func toggle(_ assignment: AssignmentItem) async {
        guard let api = sessionStore.api, let user = sessionStore.session?.user else { return }
        let next = !completed.contains(assignment.id)
        if next { completed.insert(assignment.id) } else { completed.remove(assignment.id) }
        do {
            try await api.setCompletion(next, assignment: assignment, token: try await sessionStore.accessToken(), userID: user.id)
        } catch {
            if next { completed.remove(assignment.id) } else { completed.insert(assignment.id) }
            errorMessage = error.localizedDescription
        }
    }

    func saveNickname(course: CourseSummary, name: String) async throws {
        guard let api = sessionStore.api, let user = sessionStore.session?.user else { return }
        let row = ClassNickname(canvasCourseID: course.id, rawName: course.name, rawCode: course.courseCode, customName: name)
        try await api.saveNickname(row, token: try await sessionStore.accessToken(), userID: user.id)
        if name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { nicknames.removeValue(forKey: course.id) }
        else { nicknames[course.id] = row }
    }

    func saveCanvas(domain: String, canvasToken: String) async throws {
        guard let api = sessionStore.api, let user = sessionStore.session?.user else { return }
        try await api.saveCanvas(domain: domain, canvasToken: canvasToken, token: try await sessionStore.accessToken(), userID: user.id)
        await load()
    }
}
