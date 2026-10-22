import Foundation
import Security
import SwiftUI
import UIKit
import Combine
import AuthenticationServices
import CryptoKit
import UserNotifications

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
            return "CoursePro can’t connect to that Canvas address yet. Check it, or email support@canvaspro.app to add your school."
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
            return "CoursePro had a problem. Please try again in a moment."
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
            throw NativeAppError.configuration("CoursePro’s native backend configuration is missing from this build.")
        }
        return NativeConfiguration(supabaseURL: url, publishableKey: key)
    }
}

struct NativeUser: Codable, Equatable {
    let id: String
    let email: String?
    /// "apple" for accounts made with Sign in with Apple. Optional so sessions
    /// saved before it existed still load.
    var provider: String? = nil

    var usesApple: Bool { provider == "apple" }
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
    /// When the grade was released to the student (a teacher can grade first
    /// and post later). Missing on older saved data.
    var postedAt: String? = nil

    enum CodingKeys: String, CodingKey {
        case workflowState = "workflow_state"
        case submittedAt = "submitted_at"
        case score
        case gradedAt = "graded_at"
        case grade, missing, excused, late
        case postedAt = "posted_at"
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
    /// When Canvas opens it ("Available from", or the module's unlock date).
    /// Missing on older data and custom work, which count as open.
    var unlockAt: String? = nil
    var estimatedMinutes: Int? = nil

    enum CodingKeys: String, CodingKey {
        case id, name, description
        case dueAt = "due_at"
        case htmlURL = "html_url"
        case pointsPossible = "points_possible"
        case courseID = "course_id"
        case courseName = "course_name"
        case courseCode = "course_code"
        case submission
        case unlockAt = "unlock_at"
        case estimatedMinutes = "estimated_minutes"
    }
}

extension AssignmentItem {
    var unlockDate: Date? { unlockAt.flatMap { ISO8601DateFormatter.canvasDate(from: $0) } }

    /// Canvas hasn't opened it yet: kept off the dashboard, labelled elsewhere.
    func notYetOpen(now: Date = Date()) -> Bool {
        guard let opens = unlockDate else { return false }
        return opens > now
    }

    /// "Opens today at 9:00 AM", "Opens tomorrow at 9:00 AM" or "Opens Tue, Oct 20 at 9:00 AM".
    func opensLabel(now: Date = Date(), calendar: Calendar = .current) -> String? {
        guard let opens = unlockDate, opens > now else { return nil }
        let time = opens.formatted(date: .omitted, time: .shortened)
        if calendar.isDate(opens, inSameDayAs: now) { return "Opens today at \(time)" }
        if let tomorrow = calendar.date(byAdding: .day, value: 1, to: now), calendar.isDate(opens, inSameDayAs: tomorrow) {
            return "Opens tomorrow at \(time)"
        }
        return "Opens \(opens.formatted(.dateTime.weekday(.abbreviated).month(.abbreviated).day())) at \(time)"
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

extension CalendarEventItem {
    /// Builds an event in code (the sample student's calendar).
    init(id: String, title: String, startAt: String?, endAt: String?, htmlURL: String? = nil, contextCode: String?, contextName: String?, locationName: String?) {
        self.id = id
        self.title = title
        self.startAt = startAt
        self.endAt = endAt
        self.htmlURL = htmlURL
        self.contextCode = contextCode
        self.contextName = contextName
        self.locationName = locationName
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

extension CanvasBundle {
    /// A fresh bundle with every part Canvas couldn't send this time (named in
    /// `errors`) taken from the previous one, instead of an empty list that
    /// would read as "nothing due". The same for a class that's still listed
    /// but whose assignments all came back empty when it had three or more
    /// before: the server drops a class whose own request failed without
    /// saying so, and a real class never loses all its work at once.
    func keepingWhatFailed(from previous: CanvasBundle) -> CanvasBundle {
        let failed = errors ?? [:]
        var keptAssignments = failed["assignments"] != nil ? previous.assignments : assignments
        if failed["assignments"] == nil && failed["courses"] == nil {
            // Canvas assignments only (planner items have negative ids).
            let fresh = Set(assignments.filter { $0.id > 0 }.map(\.courseID))
            let listed = Set(courses.map(\.id))
            let before = Dictionary(grouping: previous.assignments.filter { $0.id > 0 }, by: \.courseID)
            for (courseID, items) in before where items.count >= 3 && listed.contains(courseID) && !fresh.contains(courseID) {
                keptAssignments += items
            }
        }
        return CanvasBundle(
            courses: failed["courses"] != nil ? previous.courses : courses,
            assignments: keptAssignments,
            announcements: failed["announcements"] != nil ? previous.announcements : announcements,
            calendar: failed["calendar"] != nil ? previous.calendar : calendar,
            errors: errors
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
            submission: (try? c.decodeIfPresent(AssignmentSubmission.self, forKey: .submission)),
            // Without this, work Canvas hasn't opened yet looked open everywhere.
            unlockAt: (try? c.decodeIfPresent(String.self, forKey: .unlockAt)),
            estimatedMinutes: (try? c.decodeIfPresent(Int.self, forKey: .estimatedMinutes))
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
    var completedAt: [Int: Date]? = nil
}

struct NativeCompletionState {
    let completed: Set<Int>
    let reopenedAt: [Int: Date]
    var completedAt: [Int: Date] = [:]
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

/// The sample student (Maya Chen): the same classes, work, announcements and
/// events the website shows App Review's account (src/lib/demo-mode.ts), so the
/// app and the site tell one story. Dates are relative to today. Links are left
/// empty: the sample school isn't a real Canvas.
enum NativePreviewData {
    /// `days` from today at `hour`:`minute`, local time.
    private static func at(_ days: Int, _ hour: Int, _ minute: Int = 0) -> String {
        let day = Calendar.current.date(byAdding: .day, value: days, to: Date()) ?? Date()
        let time = Calendar.current.date(bySettingHour: hour, minute: minute, second: 0, of: day) ?? day
        return ISO8601DateFormatter().string(from: time)
    }

    private struct Row {
        let id: Int, courseID: Int, name: String, due: String, points: Double, score: Double?
        init(_ id: Int, _ courseID: Int, _ name: String, _ due: String, _ points: Double, graded score: Double? = nil) {
            self.id = id; self.courseID = courseID; self.name = name; self.due = due; self.points = points; self.score = score
        }
    }

    private static let courses = [
        CourseSummary(id: 9101, name: "Cell Biology", courseCode: "BIO 201", currentScore: 93.4, currentGrade: "A", finalScore: 93.4),
        CourseSummary(id: 9102, name: "Introduction to Psychology", courseCode: "PSY 101", currentScore: 88.1, currentGrade: "B+", finalScore: 88.1),
        CourseSummary(id: 9103, name: "General Chemistry", courseCode: "CHEM 110", currentScore: 81.6, currentGrade: "B-", finalScore: 81.6),
        CourseSummary(id: 9104, name: "College Writing", courseCode: "ENG 102", currentScore: 95.2, currentGrade: "A", finalScore: 95.2),
        CourseSummary(id: 9105, name: "Calculus I", courseCode: "MATH 151", currentScore: 90.3, currentGrade: "A-", finalScore: 90.3),
    ]

    private static func courseFor(_ id: Int) -> CourseSummary { courses.first { $0.id == id } ?? courses[0] }

    static var bundle: CanvasBundle {
        let rows = [
            // Graded work from the last two weeks.
            Row(8001, 9101, "Lab 3: Microscopy", at(-6, 23, 59), 50, graded: 47),
            Row(8002, 9102, "Chapter 4 Quiz", at(-4, 11), 20, graded: 18),
            Row(8003, 9104, "Personal Narrative Draft", at(-8, 23, 59), 100, graded: 95),
            Row(8004, 9103, "Problem Set 3", at(-5, 23, 59), 50, graded: 40),
            Row(8005, 9105, "Quiz 2: Limits", at(-3, 10), 30, graded: 27),
            // One item to catch up on.
            Row(8006, 9103, "Lab Report 2", at(-1, 18), 40),
            // The weeks ahead.
            Row(8007, 9105, "WebAssign 3.4: Derivatives", at(0, 23, 59), 20),
            Row(8008, 9102, "Reading Response 5", at(0, 23, 59), 10),
            Row(8009, 9101, "Lab 4: Osmosis Prelab", at(1, 11, 59), 15),
            Row(8010, 9104, "Annotated Bibliography", at(2, 23, 59), 50),
            Row(8011, 9103, "Quiz 4: Stoichiometry", at(2, 9), 25),
            Row(8012, 9105, "Problem Set 4", at(3, 23, 59), 40),
            Row(8013, 9102, "Research Methods Worksheet", at(4, 17), 30),
            Row(8014, 9101, "Cell Signaling Case Study", at(5, 23, 59), 60),
            Row(8015, 9103, "Problem Set 5", at(6, 14), 50),
            Row(8016, 9104, "Argument Essay Outline", at(8, 23, 59), 40),
            Row(8017, 9105, "Midterm Review Packet", at(9, 23, 59), 25),
            Row(8018, 9101, "Midterm Exam", at(12, 9, 30), 100),
            Row(8019, 9102, "Chapter 6 Quiz", at(13, 11), 20),
        ]
        // The latest graded work came back a few hours ago, so New grades has one.
        let newestGraded = rows.filter { $0.score != nil }.max { $0.due < $1.due }?.id
        let gradedRecently = ISO8601DateFormatter().string(from: Date().addingTimeInterval(-3 * 3600))
        let assignments = rows.map { row -> AssignmentItem in
            let course = courseFor(row.courseID)
            let submission = row.score.map { score in
                AssignmentSubmission(workflowState: "graded", submittedAt: row.due, score: score, gradedAt: row.id == newestGraded ? gradedRecently : row.due, grade: String(Int(score)), missing: nil, excused: nil, late: nil)
            } ?? AssignmentSubmission(workflowState: "unsubmitted", submittedAt: nil, score: nil, gradedAt: nil, grade: nil, missing: nil, excused: nil, late: nil)
            return AssignmentItem(id: row.id, name: row.name, description: "<p>\(row.name) for \(course.name).</p>", dueAt: row.due, htmlURL: "", pointsPossible: row.points, courseID: course.id, courseName: course.name, courseCode: course.courseCode, submission: submission)
        }
        let announcements = [
            announcement(7001, 9101, "Lab 4 moved to Thursday", "The osmosis lab will run Thursday this week.", at(-1, 9, 15)),
            announcement(7002, 9104, "Peer review partners posted", "Check the Discussions page for your partner.", at(-2, 14)),
            announcement(7003, 9105, "Office hours this week", "Extra office hours Wednesday 3-5 PM before Problem Set 4.", at(0, 8, 30)),
        ]
        let calendar = [
            CalendarEventItem(id: "e1", title: "BIO 201 Study Group", startAt: at(1, 18), endAt: at(1, 19, 30), contextCode: "course_9101", contextName: "Cell Biology", locationName: "Library 204"),
            CalendarEventItem(id: "e2", title: "Calculus Office Hours", startAt: at(2, 15), endAt: at(2, 17), contextCode: "course_9105", contextName: "Calculus I", locationName: "Math 112"),
            CalendarEventItem(id: "e3", title: "Midterm Exam", startAt: at(12, 9, 30), endAt: at(12, 11), contextCode: "course_9101", contextName: "Cell Biology", locationName: "Science Hall 101"),
        ]
        return CanvasBundle(courses: courses, assignments: assignments, announcements: announcements, calendar: calendar, errors: nil)
    }

    private static func announcement(_ id: Int, _ courseID: Int, _ title: String, _ message: String, _ posted: String) -> AnnouncementItem {
        let course = courseFor(courseID)
        return AnnouncementItem(id: id, title: title, message: "<p>\(message)</p>", postedAt: posted, htmlURL: "", contextCode: "course_\(courseID)", courseID: courseID, courseName: course.name, courseCode: course.courseCode)
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

    /// Sign in with Apple: Supabase checks Apple's identity token (its audience
    /// is this app's bundle ID) and the nonce, then signs in or creates the account.
    func signInWithApple(idToken: String, rawNonce: String) async throws -> NativeSession {
        var request = try request(path: "/auth/v1/token", query: [URLQueryItem(name: "grant_type", value: "id_token")])
        request.httpMethod = "POST"
        request.httpBody = try JSONSerialization.data(withJSONObject: ["provider": "apple", "id_token": idToken, "nonce": rawNonce])
        return try session(from: try await json(request))
    }

    func userMetadata(token: String) async throws -> [String: Any] {
        let object = try await json(request(path: "/auth/v1/user", token: token)) as? [String: Any] ?? [:]
        return object["user_metadata"] as? [String: Any] ?? [:]
    }

    /// Merges these fields into the account's metadata.
    func updateUserMetadata(_ fields: [String: Any], token: String) async throws {
        var request = try request(path: "/auth/v1/user", token: token)
        request.httpMethod = "PUT"
        request.httpBody = try JSONSerialization.data(withJSONObject: ["data": fields])
        _ = try await data(request)
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

    /// Ends this sign-in only. Without a scope the server ends every device's.
    func signOut(token: String) async throws {
        var request = try request(path: "/auth/v1/logout", token: token, query: [.init(name: "scope", value: "local")])
        request.httpMethod = "POST"
        _ = try await data(request)
    }

    /// Uses the website's account deletion, so the app and the website remove
    /// exactly the same data. Apple accounts also send a fresh Apple
    /// authorization code, which the server uses to revoke Sign in with Apple.
    func deleteAccount(token: String, appleAuthorizationCode: String? = nil) async throws {
        var deleteRequest = URLRequest(url: NativeConfiguration.websiteURL.appendingPathComponent("api/mobile/delete-account"))
        deleteRequest.httpMethod = "POST"
        deleteRequest.timeoutInterval = 30
        deleteRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
        deleteRequest.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        var body: [String: Any] = ["confirm": "DELETE"]
        if let appleAuthorizationCode { body["appleAuthorizationCode"] = appleAuthorizationCode }
        deleteRequest.httpBody = try JSONSerialization.data(withJSONObject: body)
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
        var completedAt: [Int: Date] = [:]
        for row in rows {
            guard let key = row["key"] as? String,
                  let value = row["value"] as? [String: Any],
                  let id = Int(key.replacingOccurrences(of: "assignment-completion:", with: "")) else { continue }
            if value["completed"] as? Bool == true {
                result.insert(id)
                if let text = value["completedAt"] as? String, let date = ISO8601DateFormatter.canvasDate(from: text) { completedAt[id] = date }
            }
            else if let text = value["reopenedAt"] as? String,
                    let date = ISO8601DateFormatter.canvasDate(from: text) { reopenedAt[id] = date }
        }
        return NativeCompletionState(completed: result, reopenedAt: reopenedAt, completedAt: completedAt)
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

    /// Atomic patch: changing another setting must not upload a stale all-devices switch.
    func syncNotificationPreferences(_ changes: [String: Any], token: String, userID: String) async throws {
        var request = try request(path: "/rest/v1/rpc/patch_notification_preferences", token: token)
        request.httpMethod = "POST"
        request.httpBody = try JSONSerialization.data(withJSONObject: [
            "changes": changes,
            "device_timezone_offset": TimeZone.current.secondsFromGMT() / -60,
        ])
        _ = try await data(request)
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
                throw NativeAppError.server("CoursePro took too long to respond. Please try again.")
            case .cannotFindHost, .cannotConnectToHost, .dnsLookupFailed:
                throw NativeAppError.server("Could not reach CoursePro. Please try again in a moment.")
            default: throw error
            }
        }
        guard let http = response as? HTTPURLResponse else {
            throw NativeAppError.server("CoursePro sent an unexpected response. Please try again.")
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
        let appMetadata = user["app_metadata"] as? [String: Any] ?? [:]
        let providers = appMetadata["providers"] as? [String] ?? []
        let provider = providers.contains("apple") ? "apple" : appMetadata["provider"] as? String
        return NativeSession(accessToken: access, refreshToken: refresh, expiresAt: Date().addingTimeInterval(seconds), user: NativeUser(id: id, email: user["email"] as? String, provider: provider))
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
    /// The one sign-in the app uses, shared with Siri and widget buttons so a
    /// token refresh never happens twice at once.
    static let shared = NativeSessionStore()

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

    /// Accepts an email address or a CoursePro username, like the website.
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

    // MARK: Sign in with Apple

    /// A brand-new Apple account waits here, signed in but not yet in the app,
    /// until the person confirms their age and accepts the Terms like an email
    /// sign-up does. Declining deletes it again.
    struct PendingAppleAccount: Identifiable {
        let session: NativeSession
        let authorizationCode: String?
        var id: String { session.user.id }
    }

    @Published var pendingAppleAccount: PendingAppleAccount?
    private static let appleUserKey = "CanvasProAppleUserID"

    /// A fresh random nonce for an Apple request. Apple gets its SHA-256 (in
    /// `request.nonce`), Supabase the raw value, and Supabase checks they match.
    static func makeNonce() -> (raw: String, hashed: String) {
        var bytes = [UInt8](repeating: 0, count: 32)
        if SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes) != errSecSuccess {
            bytes = (0..<32).map { _ in UInt8.random(in: .min ... .max) }
        }
        let raw = bytes.map { String(format: "%02x", $0) }.joined()
        let hashed = SHA256.hash(data: Data(raw.utf8)).map { String(format: "%02x", $0) }.joined()
        return (raw, hashed)
    }

    func signInWithApple(_ credential: ASAuthorizationAppleIDCredential, rawNonce: String) async {
        guard !isWorking else { return }
        guard let api else { errorMessage = configurationError; return }
        guard let tokenData = credential.identityToken, let idToken = String(data: tokenData, encoding: .utf8) else {
            errorMessage = "Apple didn't return a sign-in token. Please try again."
            return
        }
        isWorking = true
        errorMessage = nil
        defer { isWorking = false }
        do {
            let newSession = try await api.signInWithApple(idToken: idToken, rawNonce: rawNonce)
            UserDefaults.standard.set(credential.user, forKey: Self.appleUserKey)
            // Apple shares the name only the first time; save it then and never ask again.
            let given = credential.fullName?.givenName?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            let family = credential.fullName?.familyName?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            let metadata = try await api.userMetadata(token: newSession.accessToken)
            var fields: [String: Any] = [:]
            // Never prompt an Apple account for profile details it may have chosen to hide.
            if metadata["profile_setup_prompted"] == nil { fields["profile_setup_prompted"] = true }
            let savedName = (metadata["first_name"] as? String ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            if savedName.isEmpty && (!given.isEmpty || !family.isEmpty) {
                fields["first_name"] = given
                fields["last_name"] = family
                fields["full_name"] = [given, family].filter { !$0.isEmpty }.joined(separator: " ")
                fields["profile_setup_completed"] = true
            }
            if !fields.isEmpty { try? await api.updateUserMetadata(fields, token: newSession.accessToken) }
            let code = credential.authorizationCode.flatMap { String(data: $0, encoding: .utf8) }
            if metadata["legal_accepted_at"] == nil || metadata["age_18_or_older_confirmed"] as? Bool != true {
                pendingAppleAccount = PendingAppleAccount(session: newSession, authorizationCode: code)
                return
            }
            try SecureSessionStore.save(newSession)
            session = newSession
        } catch { errorMessage = error.localizedDescription }
    }

    /// The same consent an email sign-up records (src/lib/signup-age.ts, src/lib/legal-consent.ts).
    func acceptPendingAppleAccount() async {
        guard let pending = pendingAppleAccount, let api, !isWorking else { return }
        isWorking = true
        errorMessage = nil
        defer { isWorking = false }
        let now = ISO8601DateFormatter().string(from: Date())
        do {
            try await api.updateUserMetadata([
                "age_18_or_older_confirmed": true, "age_confirmation_version": 2, "age_confirmed_at": now,
                "terms_accepted_version": "2026-10-12", "privacy_accepted_version": "2026-10-12", "legal_accepted_at": now,
            ], token: pending.session.accessToken)
            try SecureSessionStore.save(pending.session)
            pendingAppleAccount = nil
            session = pending.session
        } catch { errorMessage = error.localizedDescription }
    }

    /// Declining removes the account that was just made, and revokes Apple.
    func declinePendingAppleAccount() async {
        guard let pending = pendingAppleAccount else { return }
        pendingAppleAccount = nil
        UserDefaults.standard.removeObject(forKey: Self.appleUserKey)
        try? await api?.deleteAccount(token: pending.session.accessToken, appleAuthorizationCode: pending.authorizationCode)
    }

    /// Signs out when the person stopped using Sign in with Apple for CoursePro
    /// (Settings > Apple Account > Sign in with Apple), as Apple asks.
    /// Back to sign-in when another device ended this sign-in (Settings >
    /// Signed-in devices, here or on the website). Only a clear "no" from the
    /// server counts: offline, a failed check or an older server change nothing.
    func checkSignInStillActive() async {
        guard let api, session != nil, UIApplication.shared.applicationState == .active,
              let token = try? await accessToken() else { return }
        guard await api.sessionIsActive(token: token) == false, session != nil else { return }
        await signOut()
        errorMessage = "You were signed out from another device."
    }

    /// Checks every minute while the app is open.
    func watchSignIn() async {
        while !Task.isCancelled {
            await checkSignInStillActive()
            try? await Task.sleep(for: .seconds(60))
        }
    }

    func checkAppleCredential() async {
        guard session?.user.usesApple == true, let appleUser = UserDefaults.standard.string(forKey: Self.appleUserKey) else { return }
        let state = try? await ASAuthorizationAppleIDProvider().credentialState(forUserID: appleUser)
        if state == .revoked || state == .notFound { await signOut() }
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

    func deleteAccount(appleAuthorizationCode: String? = nil) async {
        guard let api, session != nil else { return }
        isWorking = true
        errorMessage = nil
        defer { isWorking = false }
        do {
            try await api.deleteAccount(token: try await accessToken(), appleAuthorizationCode: appleAuthorizationCode)
            UserDefaults.standard.removeObject(forKey: Self.appleUserKey)
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
        // The previous student's reminders must not keep arriving on this phone:
        // due-date reminders, streak reminders, a study "time's up" alert, and
        // banners already in Notification Center.
        NativeLocalReminders.replace(with: [])
        NativeStreakReminders.schedule(nil, prefs: NotificationPreferences())
        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: ["canvaspro.study.block"])
        UNUserNotificationCenter.current().removeAllDeliveredNotifications()
        NativeStreakStore.shared.reset()
        // Nor their work stay on the home screen or lock screen.
        CanvasProWidgetStore.clear()
        NativeLiveActivities.endAll()
        if let previousUserID {
            NativeCourseworkCacheStore.clear(userID: previousUserID)
            UserDefaults.standard.removeObject(forKey: "CanvasProNativeContentCache.\(previousUserID)")
            UserDefaults.standard.removeObject(forKey: NativeFeatureStore.savedStateKey(userID: previousUserID))
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
    /// When each task was marked done here, for the Completed page.
    @Published var completedAt: [Int: Date] = [:]
    @Published var completionSavesInFlight = Set<Int>()
    /// Ticked off a moment ago: the row shows its tick, then folds away.
    @Published var completing = Set<Int>()
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
    /// A pull to refresh is running.
    @Published private(set) var isRefreshing = false
    /// True from launch until this launch's first sync of coursework and the
    /// account's settings (hidden classes, own work, progress) has finished.
    /// Screens show placeholders meanwhile, so nothing is counted from half the
    /// data, such as saved coursework with last week's ticks.
    @Published var isSyncingAtLaunch = true
    /// Loading placeholders: the launch sync, the first load, or a pull to refresh.
    var showsSkeleton: Bool { isFirstLoad || ((isSyncingAtLaunch || isRefreshing) && !needsCanvasConnection && loadFailure == nil) }
    private unowned let sessionStore: NativeSessionStore
    var persistenceScope: String { isPreview ? "preview" : (sessionStore.session?.user.id ?? "signed-out") }
    // Versioned: saves from the earlier, smaller sample set are ignored.
    private let previewCompletedKey = "CanvasProPreviewCompleted2"
    private let previewNicknamesKey = "CanvasProPreviewNicknames2"

    init(sessionStore: NativeSessionStore, preview: Bool = false) {
        self.sessionStore = sessionStore
        isPreview = preview
        if preview {
            bundle = NativePreviewData.bundle
            hasLoaded = true
            isSyncingAtLaunch = false
            if let saved = UserDefaults.standard.array(forKey: previewCompletedKey) as? [NSNumber] { completed = Set(saved.map(\.intValue)) }
            else { completed = [] }
            if let data = UserDefaults.standard.data(forKey: previewNicknamesKey),
               let saved = try? JSONDecoder().decode([Int: ClassNickname].self, from: data) { nicknames = saved }
            lastSyncedAt = Date()
        } else {
            loadCachedContent()
        }
    }

    /// Loads to the end even if the screen that asked redraws or goes away.
    /// SwiftUI cancels a pull-to-refresh's task when the view updates, which used
    /// to stop the reload half-way and report "cancelled".
    /// A second request while one is running waits for it instead of returning at once.
    func load() async {
        if let running = currentLoad { await running.value; return }
        let task = Task { await performLoad() }
        currentLoad = task
        await task.value
        currentLoad = nil
    }
    private var currentLoad: Task<Void, Never>?

    /// Pull to refresh: the screens show their loading placeholders meanwhile.
    func refresh() async {
        guard !isPreview else { return }
        isRefreshing = true
        defer { isRefreshing = false }
        await load()
    }

    private func performLoad() async {
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
            var freshCompletedAt = completedAt
            var savedPreferenceWarning: String?

            do {
                let state = try await completionRequest
                freshCompleted = state.completed
                freshReopenedAt = state.reopenedAt
                freshCompletedAt = state.completedAt
            } catch {
                savedPreferenceWarning = "Coursework refreshed. Saved completion state could not update."
            }

            do {
                let nicknameValues = try await nicknameRequest
                nicknames = Dictionary(nicknameValues.map { ($0.canvasCourseID, $0) }, uniquingKeysWith: { first, _ in first })
            } catch {
                savedPreferenceWarning = savedPreferenceWarning ?? "Coursework refreshed. Class nicknames could not update."
            }

            // A part Canvas couldn't send this time keeps what was there before.
            let merged = freshBundle.keepingWhatFailed(from: bundle)
            bundle = merged
            completed = sanitizedCompletedIDs(freshCompleted, in: merged)
            reopenedAt = freshReopenedAt
            completedAt = freshCompletedAt
            lastSyncedAt = Date()
            isShowingCachedData = false
            needsCanvasConnection = false
            let partial = (freshBundle.errors?.isEmpty == false) ? "Some Canvas data couldn't update. Pull down to try again." : nil
            syncMessage = savedPreferenceWarning ?? partial
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

    /// How long a finished row keeps its tick on screen before folding away.
    static let completionHold: Duration = .milliseconds(450)
    private var completionMotion: Animation? {
        UIAccessibility.isReduceMotionEnabled ? nil : .spring(duration: 0.42, bounce: 0)
    }

    func toggle(_ assignment: AssignmentItem) async {
        // Tapped again while its tick is still showing: nothing was saved yet.
        if completing.contains(assignment.id) { cancelCompletion(assignment.id); return }
        let id = assignment.id
        let next = !assignment.isFinished(in: self)
        if next {
            // The tick and the Undo bar show right away; the row folds away a
            // moment later, so lists don't jump the instant it's tapped.
            undoItem = assignment
            if !UIAccessibility.isReduceMotionEnabled {
                completing.insert(id)
                try? await Task.sleep(for: Self.completionHold)
                guard completing.contains(id) else { return }
            }
        }
        if isPreview {
            withAnimation(completionMotion) {
                completing.remove(id)
                if next { completed.insert(id); reopenedAt.removeValue(forKey: id); completedAt[id] = Date(); NativeCelebrations.shared.assignmentCompleted(assignment.name) }
                else { completed.remove(id); reopenedAt[id] = Date(); completedAt.removeValue(forKey: id) }
            }
            if !next && undoItem?.id == id { undoItem = nil }
            UserDefaults.standard.set(Array(completed), forKey: previewCompletedKey)
            return
        }
        guard let api = sessionStore.api, let user = sessionStore.session?.user,
              !completionSavesInFlight.contains(id) else { cancelCompletion(id); return }
        completionSavesInFlight.insert(id)
        defer { completionSavesInFlight.remove(id) }
        let previousCompleted = completed.contains(id)
        let previousReopen = reopenedAt[id]
        let previousDate = completedAt[id]
        withAnimation(completionMotion) {
            completing.remove(id)
            if next {
                completed.insert(id); reopenedAt.removeValue(forKey: id); completedAt[id] = Date()
                NativeCelebrations.shared.assignmentCompleted(assignment.name)
            }
            else {
                completed.remove(id)
                completedAt.removeValue(forKey: id)
                if assignment.isCanvasFinished { reopenedAt[id] = Date() }
                else { reopenedAt.removeValue(forKey: id) }
            }
        }
        do {
            try await api.setCompletion(next, assignment: assignment, reopenedAt: reopenedAt[id], token: try await sessionStore.accessToken(), userID: user.id)
            persistContentCache()
            if !next && undoItem?.id == id { undoItem = nil }
        } catch {
            withAnimation(completionMotion) {
                if previousCompleted { completed.insert(id) } else { completed.remove(id) }
                reopenedAt[id] = previousReopen
                completedAt[id] = previousDate
            }
            if undoItem?.id == id { undoItem = nil }
            errorMessage = error.localizedDescription
        }
    }

    private func cancelCompletion(_ id: Int) {
        withAnimation(completionMotion) { _ = completing.remove(id) }
        if undoItem?.id == id { undoItem = nil }
    }

    /// The Undo bar: before the save it just cancels; after, it marks the task not done.
    func undo(_ assignment: AssignmentItem) async {
        if undoItem?.id == assignment.id { undoItem = nil }
        if completing.contains(assignment.id) { cancelCompletion(assignment.id); return }
        if assignment.isFinished(in: self) { await toggle(assignment) }
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
        completedAt = cache.completedAt ?? [:]
        nicknames = cache.nicknames
        lastSyncedAt = cache.savedAt
        isShowingCachedData = true
    }

    private func persistContentCache() {
        guard !isPreview, let userID = sessionStore.session?.user.id else { return }
        let savedAt = lastSyncedAt ?? Date()
        let cache = NativeContentCache(savedAt: savedAt, bundle: bundle, completed: Array(sanitizedCompletedIDs(completed, in: bundle)), reopenedAt: reopenedAt, nicknames: nicknames, completedAt: completedAt)
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
