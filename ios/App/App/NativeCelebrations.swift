import CoreHaptics
import SwiftUI
import UIKit
import UserNotifications

// Daily streaks (the website's src/lib/streak.ts) and the full-screen
// "Good job!!" confetti, with haptics timed to the same moments as the animation.

// MARK: - Dates

/// Calendar dates as `YYYY-MM-DD`, like the website and the database.
enum NativeDayKey {
    private static var utc: Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "UTC") ?? .current
        return calendar
    }

    private static func pad(_ value: Int) -> String { value < 10 ? "0\(value)" : "\(value)" }

    /// This phone's own date today.
    static func today(_ now: Date = Date()) -> String {
        let parts = Calendar.current.dateComponents([.year, .month, .day], from: now)
        return "\(parts.year ?? 2000)-\(pad(parts.month ?? 1))-\(pad(parts.day ?? 1))"
    }

    private static func components(_ key: String) -> DateComponents? {
        let parts = key.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3 else { return nil }
        return DateComponents(year: parts[0], month: parts[1], day: parts[2])
    }

    static func isKey(_ value: String) -> Bool {
        value.range(of: #"^\d{4}-\d{2}-\d{2}$"#, options: .regularExpression) != nil
    }

    static func add(_ key: String, _ days: Int) -> String {
        guard let parts = components(key), let date = utc.date(from: parts),
              let moved = utc.date(byAdding: .day, value: days, to: date) else { return key }
        let out = utc.dateComponents([.year, .month, .day], from: moved)
        return "\(out.year ?? 2000)-\(pad(out.month ?? 1))-\(pad(out.day ?? 1))"
    }

    /// 0 = Sunday.
    static func weekday(_ key: String) -> Int {
        guard let parts = components(key), let date = utc.date(from: parts) else { return 0 }
        return utc.component(.weekday, from: date) - 1
    }

    /// That date at `hour`:00 on this phone's clock.
    static func local(_ key: String, hour: Int) -> Date? {
        guard var parts = components(key) else { return nil }
        parts.hour = hour
        return Calendar.current.date(from: parts)
    }

    static func label(_ key: String, weekday: Bool = true) -> String {
        guard let date = local(key, hour: 12) else { return key }
        return weekday
            ? date.formatted(.dateTime.weekday(.abbreviated).month(.abbreviated).day())
            : date.formatted(.dateTime.month(.abbreviated).day())
    }

    static func nextMonthStart(_ key: String) -> String {
        guard let parts = components(key), let year = parts.year, let month = parts.month else { return key }
        return month == 12 ? "\(year + 1)-01-01" : "\(year)-\(pad(month + 1))-01"
    }
}

/// "Maya" from "Maya Chen"; nil for an empty name.
private func nativeFirstName(_ name: String?) -> String? {
    guard let word = name?.trimmingCharacters(in: .whitespacesAndNewlines).split(separator: " ").first else { return nil }
    return String(word)
}

// MARK: - Streak

struct NativeStreakDay: Identifiable {
    enum State { case active, frozen, missed, pending, future }
    let key: String
    let letter: String
    let state: State
    let isToday: Bool
    var id: String { key }
}

/// What `record_streak_activity(p_today)` returns.
struct NativeStreak: Equatable {
    var current: Int
    var longest: Int
    var previous: Int
    var extended: Bool
    var froze: String?
    var lost: Int
    var today: String
    var lastActiveOn: String?
    var freezeUsedOn: String?
    var freezeAvailable: Bool
    var recentDays: [String]
    var frozenDays: [String]

    static let milestones = [3, 7, 14, 30, 50, 100, 150, 200, 365, 500, 1000]

    init(current: Int, longest: Int, previous: Int, extended: Bool, froze: String?, lost: Int, today: String,
         lastActiveOn: String?, freezeUsedOn: String?, freezeAvailable: Bool, recentDays: [String], frozenDays: [String]) {
        self.current = current; self.longest = longest; self.previous = previous; self.extended = extended
        self.froze = froze; self.lost = lost; self.today = today; self.lastActiveOn = lastActiveOn
        self.freezeUsedOn = freezeUsedOn; self.freezeAvailable = freezeAvailable
        self.recentDays = recentDays; self.frozenDays = frozenDays
    }

    init?(json: Any) {
        guard let raw = json as? [String: Any], let today = Self.day(raw["today"]) else { return nil }
        self.init(
            current: Self.count(raw["current"]), longest: Self.count(raw["longest"]), previous: Self.count(raw["previous"]),
            extended: raw["extended"] as? Bool == true, froze: Self.day(raw["froze"]), lost: Self.count(raw["lost"]),
            today: today, lastActiveOn: Self.day(raw["last_active_on"]), freezeUsedOn: Self.day(raw["freeze_used_on"]),
            freezeAvailable: raw["freeze_available"] as? Bool ?? true,
            recentDays: (raw["recent_days"] as? [Any] ?? []).compactMap { Self.day($0) },
            frozenDays: (raw["frozen_days"] as? [Any] ?? []).compactMap { Self.day($0) }
        )
    }

    private static func count(_ value: Any?) -> Int { max(0, (value as? NSNumber)?.intValue ?? 0) }
    private static func day(_ value: Any?) -> String? {
        guard let text = value as? String, NativeDayKey.isKey(text) else { return nil }
        return text
    }

    /// The website's sample student: 12 days, this month's freeze covering one.
    static func preview(today: String = NativeDayKey.today()) -> NativeStreak {
        let frozen = NativeDayKey.add(today, -3)
        let active = (0..<13).map { NativeDayKey.add(today, -$0) }.filter { $0 != frozen }
        return NativeStreak(current: 12, longest: 21, previous: 11, extended: true, froze: nil, lost: 0, today: today,
                            lastActiveOn: today, freezeUsedOn: frozen, freezeAvailable: frozen.prefix(7) != today.prefix(7),
                            recentDays: active, frozenDays: [frozen])
    }

    var countedToday: Bool { lastActiveOn == today }

    static func freezeCovers(_ freezeUsedOn: String?, missed: String) -> Bool {
        guard let freezeUsedOn else { return true }
        return freezeUsedOn.prefix(7) != missed.prefix(7)
    }

    var usedFreezeThisMonth: Bool {
        guard let freezeUsedOn else { return false }
        return !freezeAvailable && freezeUsedOn.prefix(7) == today.prefix(7)
    }

    /// Sunday to Saturday, like Duolingo's streak calendar.
    var week: [NativeStreakDay] {
        let active = Set(recentDays), frozen = Set(frozenDays)
        let start = NativeDayKey.add(today, -NativeDayKey.weekday(today))
        let letters = ["S", "M", "T", "W", "T", "F", "S"]
        return (0..<7).map { i in
            let key = NativeDayKey.add(start, i)
            let isToday = key == today
            let state: NativeStreakDay.State
            if active.contains(key) { state = .active }
            else if frozen.contains(key) { state = .frozen }
            else if key > today { state = .future }
            else if isToday { state = .pending }
            else { state = .missed }
            return NativeStreakDay(key: key, letter: letters[i], state: state, isToday: isToday)
        }
    }

    static func nextMilestone(_ current: Int) -> Int {
        milestones.first { $0 > current } ?? (current / 100 + 1) * 100
    }

    /// The celebration's headline and line, the same as the website's.
    func celebrationCopy(name: String?) -> (title: String, line: String) {
        let first = nativeFirstName(name)
        func named(_ with: String, _ without: String) -> String {
            guard let first else { return without }
            return with.replacingOccurrences(of: "{name}", with: first)
        }
        let n = current
        if let froze {
            let names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
            let day = names[NativeDayKey.weekday(froze)]
            return ("Streak freeze saved you!",
                    named("Your freeze covered \(day), {name}. \(n) days and still burning.",
                          "Your freeze covered \(day). \(n) days and still burning."))
        }
        if lost > 1 {
            return ("Day 1. Let's go again.",
                    named("Your \(lost)-day streak ended, but the comeback starts now, {name}. See you tomorrow?",
                          "Your \(lost)-day streak ended, but the comeback starts now. See you tomorrow?"))
        }
        if n <= 1 {
            return ("Streak started!", named("Day 1, {name}! Open CoursePro tomorrow to make it 2.",
                                             "Day 1! Open CoursePro tomorrow to make it 2."))
        }
        if Self.milestones.contains(n) {
            let special: [Int: (String, String)] = [
                3: ("Three days in a row, {name}. A habit is forming.", "Three days in a row. A habit is forming."),
                7: ("A full week, {name}! You're officially on a roll.", "A full week! You're officially on a roll."),
                14: ("Two weeks straight, {name}. Unstoppable.", "Two weeks straight. Unstoppable."),
                30: ("A whole month, {name}. That's legendary.", "A whole month. That's legendary."),
                100: ("One hundred days, {name}. Hall of fame.", "One hundred days. Hall of fame."),
                365: ("A full year, {name}. Absolutely iconic.", "A full year. Absolutely iconic."),
            ]
            let line = special[n] ?? ("\(n) days in a row, {name}. That's real dedication.", "\(n) days in a row. That's real dedication.")
            return ("\(n)-day milestone!", named(line.0, line.1))
        }
        let next = Self.nextMilestone(n), left = next - n
        let days = left == 1 ? "day" : "days"
        let lines: [(String, String)] = [
            ("On fire, {name}! Come back tomorrow for day \(n + 1).", "On fire! Come back tomorrow for day \(n + 1)."),
            ("\(left) more \(days) to your \(next)-day milestone, {name}.", "\(left) more \(days) to your \(next)-day milestone."),
            ("Look at you go, {name}. Day \(n + 1) is waiting tomorrow.", "Look at you go. Day \(n + 1) is waiting tomorrow."),
            ("Your future self says thanks, {name}. Keep it burning.", "Your future self says thanks. Keep it burning."),
        ]
        let line = lines[n % lines.count]
        return ("\(n) day streak!", named(line.0, line.1))
    }
}

extension NativeAPI {
    /// Counts today toward the streak. Nil while the streak isn't deployed yet.
    func recordStreakActivity(today: String, token: String) async throws -> NativeStreak? {
        var request = try request(path: "/rest/v1/rpc/record_streak_activity", token: token)
        request.httpMethod = "POST"
        request.httpBody = try JSONSerialization.data(withJSONObject: ["p_today": today])
        do {
            return NativeStreak(json: try await json(request))
        } catch NativeAppError.http(let status, let code, _) where status == 404 || code == "PGRST202" {
            return nil
        }
    }
}

/// The signed-in student's streak, counted once a day when the app opens.
@MainActor
final class NativeStreakStore: ObservableObject {
    static let shared = NativeStreakStore()
    @Published private(set) var streak: NativeStreak?
    /// Set when today just counted; the celebration shows once a day.
    @Published var celebration: NativeStreak?
    private var scope = ""
    private var inFlight = false

    func refresh(sessionStore: NativeSessionStore, preview: Bool) async {
        let today = NativeDayKey.today()
        let nextScope = preview ? "preview" : (sessionStore.session?.user.id ?? "")
        if nextScope != scope { streak = nil; celebration = nil; scope = nextScope }
        guard !scope.isEmpty, streak?.today != today, !inFlight else { return }
        inFlight = true
        defer { inFlight = false }
        let fresh: NativeStreak?
        if preview {
            fresh = NativeStreak.preview(today: today)
        } else {
            guard let api = sessionStore.api else { return }
            do {
                let token = try await sessionStore.accessToken()
                fresh = try await api.recordStreakActivity(today: today, token: token)
            } catch { return }
        }
        guard let fresh else { return }
        streak = fresh
        let key = "CoursePro.streakCelebrated.\(scope)"
        if fresh.extended && UserDefaults.standard.string(forKey: key) != fresh.today {
            UserDefaults.standard.set(fresh.today, forKey: key)
            celebration = fresh
        }
    }
}

/// "Don't break your streak!!!" at 6 PM, set on this phone so it arrives with the
/// app closed. Opening the app counts the day and moves it to tomorrow.
enum NativeStreakReminders {
    static let prefix = "coursepro.streak."
    static let hour = 18
    static let title = "Don't break your streak!!!"

    struct Planned { let id: String; let fireAt: Date; let body: String }

    static func plan(_ streak: NativeStreak, prefs: NotificationPreferences, now: Date = Date()) -> [Planned] {
        guard prefs.enabled, prefs.streakReminder, streak.countedToday, streak.current > 0 else { return [] }
        let n = streak.current
        var out: [Planned] = []
        let tomorrow = NativeDayKey.add(streak.today, 1)
        if let when = NativeDayKey.local(tomorrow, hour: hour), when > now, !NativeLocalReminders.isQuiet(when, prefs: prefs) {
            out.append(Planned(id: tomorrow, fireAt: when, body: n == 1
                ? "Make it 2 days in a row 🔥 Open CoursePro before midnight."
                : "Your \(n)-day streak ends at midnight 🔥 Open CoursePro to keep it alive."))
        }
        // Miss tomorrow and this month's freeze holds the streak one more day.
        let dayAfter = NativeDayKey.add(streak.today, 2)
        if NativeStreak.freezeCovers(streak.freezeUsedOn, missed: tomorrow),
           let when = NativeDayKey.local(dayAfter, hour: hour), !NativeLocalReminders.isQuiet(when, prefs: prefs) {
            out.append(Planned(id: dayAfter, fireAt: when,
                               body: "Your streak freeze is holding your \(n)-day streak 🧊 Open CoursePro before midnight to keep it."))
        }
        return out
    }

    static func schedule(_ streak: NativeStreak?, prefs: NotificationPreferences) {
        let planned = streak.map { plan($0, prefs: prefs) } ?? []
        let allowed = NativeLocalReminders.deviceEnabled
        Task {
            let center = UNUserNotificationCenter.current()
            let old = await center.pendingNotificationRequests().map(\.identifier).filter { $0.hasPrefix(prefix) }
            if !old.isEmpty { center.removePendingNotificationRequests(withIdentifiers: old) }
            guard allowed else { return }
            let status = await center.notificationSettings().authorizationStatus
            guard status == .authorized || status == .provisional || status == .ephemeral else { return }
            for reminder in planned {
                let content = UNMutableNotificationContent()
                content.title = title
                content.body = reminder.body
                content.sound = .default
                content.threadIdentifier = "streak"
                content.userInfo = ["to_path": "/dashboard"]
                let when = Calendar.current.dateComponents([.year, .month, .day, .hour, .minute], from: reminder.fireAt)
                let trigger = UNCalendarNotificationTrigger(dateMatching: when, repeats: false)
                try? await center.add(UNNotificationRequest(identifier: prefix + reminder.id, content: content, trigger: trigger))
            }
        }
    }
}

// MARK: - Streak views

enum NativeStreakColors {
    static let orange = Color(red: 1.0, green: 0.54, blue: 0.0)
    static let flameTop = Color(red: 1.0, green: 0.69, blue: 0.13)
    static let flameBottom = Color(red: 1.0, green: 0.35, blue: 0.0)
    static let coreTop = Color(red: 1.0, green: 0.94, blue: 0.48)
    static let coreBottom = Color(red: 1.0, green: 0.72, blue: 0.0)
    static let iceTop = Color(red: 0.66, green: 0.86, blue: 1.0)
    static let iceBottom = Color(red: 0.31, green: 0.69, blue: 0.96)
    static let shadow = Color(red: 0.76, green: 0.27, blue: 0.0)
}

/// The flame outline (32 × 40 artwork, the website's SVG).
struct NativeFlameShape: Shape {
    var core = false
    func path(in rect: CGRect) -> Path {
        let sx = rect.width / 32, sy = rect.height / 40
        func p(_ x: CGFloat, _ y: CGFloat) -> CGPoint { CGPoint(x: rect.minX + x * sx, y: rect.minY + y * sy) }
        var path = Path()
        if core {
            path.move(to: p(16.4, 18.5))
            path.addCurve(to: p(21.4, 26.5), control1: p(17.2, 21.8), control2: p(20.0, 23.7))
            path.addCurve(to: p(16.0, 34.0), control1: p(22.9, 29.5), control2: p(21.2, 34.0))
            path.addCurve(to: p(10.4, 27.0), control1: p(11.4, 34.0), control2: p(9.4, 30.4))
            path.addCurve(to: p(12.7, 23.6), control1: p(10.8, 25.6), control2: p(11.6, 24.5))
            path.addCurve(to: p(14.7, 26.5), control1: p(12.9, 25.0), control2: p(13.6, 26.0))
            path.addCurve(to: p(16.4, 18.5), control1: p(14.4, 23.5), control2: p(15.1, 20.9))
        } else {
            path.move(to: p(16, 1.5))
            path.addCurve(to: p(25.3, 15.1), control1: p(17.2, 7.1), control2: p(22.1, 10.4))
            path.addCurve(to: p(28.5, 26.7), control1: p(27.9, 18.9), control2: p(29.0, 22.7))
            path.addCurve(to: p(16, 39), control1: p(27.6, 34.3), control2: p(22.4, 39))
            path.addCurve(to: p(3.5, 26.7), control1: p(9.6, 39), control2: p(4.4, 34.3))
            path.addCurve(to: p(7.7, 14.3), control1: p(2.9, 22.1), control2: p(4.5, 17.8))
            path.addCurve(to: p(11.6, 19.9), control1: p(8.2, 16.9), control2: p(9.5, 18.9))
            path.addCurve(to: p(16, 1.5), control1: p(11.0, 13.4), control2: p(13.0, 7.5))
        }
        path.closeSubpath()
        return path
    }
}

/// The streak flame, flickering when today counted; grey when it hasn't yet.
struct NativeStreakFlame: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    var lit = true
    @State private var flicker = false

    var body: some View {
        ZStack {
            NativeFlameShape()
                .fill(LinearGradient(colors: [NativeStreakColors.flameTop, NativeStreakColors.flameBottom], startPoint: .top, endPoint: .bottom))
            NativeFlameShape(core: true)
                .fill(LinearGradient(colors: [NativeStreakColors.coreTop, NativeStreakColors.coreBottom], startPoint: .top, endPoint: .bottom))
                .scaleEffect(x: flicker ? 0.9 : 1, y: flicker ? 1.08 : 1, anchor: .bottom)
        }
        .scaleEffect(x: flicker ? 1.03 : 0.98, y: flicker ? 0.97 : 1.04, anchor: .bottom)
        .saturation(lit ? 1 : 0)
        .opacity(lit ? 1 : 0.55)
        .onAppear {
            guard lit, !reduceMotion else { return }
            withAnimation(.easeInOut(duration: 0.8).repeatForever(autoreverses: true)) { flicker = true }
        }
        .accessibilityHidden(true)
    }
}

struct NativeStreakWeek: View {
    let days: [NativeStreakDay]
    var onDark = false
    /// Today's circle pops in during the celebration.
    var todayShown = true

    var body: some View {
        HStack(spacing: 0) {
            ForEach(days) { day in
                VStack(spacing: 6) {
                    Text(day.letter)
                        .cpFont(12, .bold, design: .rounded)
                        .foregroundStyle(letterColor(day))
                    circle(day)
                        .scaleEffect(day.isToday && day.state == .active && !todayShown ? 0.3 : 1)
                }
                .frame(maxWidth: .infinity)
                .accessibilityElement(children: .ignore)
                .accessibilityLabel("\(NativeDayKey.label(day.key)): \(label(day.state))")
            }
        }
    }

    private func letterColor(_ day: NativeStreakDay) -> Color {
        if day.isToday { return NativeStreakColors.orange }
        return onDark ? Color.white.opacity(0.55) : Color.secondary
    }

    private func label(_ state: NativeStreakDay.State) -> String {
        switch state {
        case .active: return "streak kept"
        case .frozen: return "covered by a streak freeze"
        case .missed: return "missed"
        case .pending: return "not yet"
        case .future: return "coming up"
        }
    }

    @ViewBuilder private func circle(_ day: NativeStreakDay) -> some View {
        let faint = onDark ? Color.white.opacity(0.14) : Color.secondary.opacity(0.18)
        ZStack {
            switch day.state {
            case .active:
                Circle().fill(LinearGradient(colors: [NativeStreakColors.flameTop, NativeStreakColors.flameBottom], startPoint: .top, endPoint: .bottom))
                Image(systemName: "checkmark").cpIconFont(13, .heavy).foregroundStyle(.white)
            case .frozen:
                Circle().fill(LinearGradient(colors: [NativeStreakColors.iceTop, NativeStreakColors.iceBottom], startPoint: .top, endPoint: .bottom))
                Image(systemName: "snowflake").cpIconFont(13, .bold).foregroundStyle(.white)
            case .missed:
                Circle().fill(faint)
            case .pending:
                Circle().strokeBorder(NativeStreakColors.orange, style: StrokeStyle(lineWidth: 2, dash: [3, 3]))
            case .future:
                Circle().strokeBorder(faint, lineWidth: 2.5)
            }
        }
        .frame(width: 30, height: 30)
        .overlay {
            if day.isToday { Circle().strokeBorder(NativeStreakColors.orange.opacity(0.35), lineWidth: 2.5).padding(-4) }
        }
    }
}

/// The flame and day count on Today; opens this week's streak.
struct NativeStreakChip: View {
    @ObservedObject private var streaks = NativeStreakStore.shared
    @Environment(\.colorScheme) private var scheme
    @State private var showDetails = false

    var body: some View {
        if let streak = streaks.streak {
            Button {
                CPHaptics.tap()
                showDetails = true
            } label: {
                HStack(spacing: 4) {
                    NativeStreakFlame(lit: streak.countedToday).frame(width: 13, height: 16)
                    Text("\(streak.current)")
                        .cpFont(14, .heavy, design: .rounded).monospacedDigit()
                        .foregroundStyle(NativeStreakColors.orange)
                }
                .padding(.horizontal, 10)
                .frame(minHeight: 30)
                .background(NativeStreakColors.orange.opacity(scheme == .dark ? 0.18 : 0.12), in: Capsule())
                .frame(minHeight: 44)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("\(streak.current) day streak")
            .sheet(isPresented: $showDetails) {
                NativeStreakDetails(streak: streak)
                    .presentationDetents([.medium, .large])
                    .presentationDragIndicator(.visible)
            }
        }
    }
}

/// The streak as a More row (the website's account menu has the same row);
/// opens this week's streak. Hidden until the streak has loaded.
struct NativeStreakRow: View {
    @ObservedObject private var streaks = NativeStreakStore.shared
    @Environment(\.colorScheme) private var scheme
    @Environment(\.cpPalette) private var paletteDependency
    @State private var showDetails = false

    var body: some View {
        if let streak = streaks.streak {
            Button {
                CPHaptics.tap()
                showDetails = true
            } label: {
                HStack(spacing: 12) {
                    NativeStreakFlame(lit: streak.countedToday)
                        .frame(width: 15, height: 18)
                        .frame(width: 32, height: 32)
                        .background(NativeStreakColors.orange.opacity(scheme == .dark ? 0.18 : 0.12), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                    VStack(alignment: .leading, spacing: 1) {
                        Text("\(streak.current) day streak").cpFont(13, .medium).foregroundStyle(CPTheme.foreground(scheme))
                        Text(streak.countedToday ? "Today counts. See you tomorrow." : "Open today to keep it going.")
                            .cpFont(11).foregroundStyle(CPTheme.muted(scheme)).lineLimit(1)
                    }
                    Spacer(minLength: 8)
                    Image(systemName: "chevron.right").cpIconFont(9, .bold).foregroundStyle(CPTheme.faint(scheme))
                }
                .frame(minHeight: 56)
                .contentShape(Rectangle())
            }
            .buttonStyle(CPPressStyle())
            .accessibilityLabel("\(streak.current) day streak")
            .accessibilityHint("Shows this week's streak")
            .sheet(isPresented: $showDetails) {
                NativeStreakDetails(streak: streak)
                    .presentationDetents([.medium, .large])
                    .presentationDragIndicator(.visible)
            }
        }
    }
}

private struct NativeStreakDetails: View {
    let streak: NativeStreak
    @ObservedObject private var celebrations = NativeCelebrations.shared

    private var longest: Int { max(streak.longest, streak.current) }
    private var next: Int { NativeStreak.nextMilestone(streak.current) }
    private var progress: Double {
        let floor = NativeStreak.milestones.last { $0 <= streak.current } ?? 0
        return max(0.06, Double(streak.current - floor) / Double(max(1, next - floor)))
    }
    private var line: String {
        let name = nativeFirstName(celebrations.firstName).map { ", \($0)" } ?? ""
        return streak.countedToday
            ? "You're on fire\(name)! Open CoursePro tomorrow to make it \(streak.current + 1)."
            : "Open CoursePro today to keep your streak going\(name)."
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                HStack(spacing: 14) {
                    NativeStreakFlame(lit: streak.countedToday).frame(width: 46, height: 58)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("\(streak.current)")
                            .cpFont(44, .heavy, design: .rounded).monospacedDigit()
                            .foregroundStyle(NativeStreakColors.orange)
                        Text("day streak").font(.subheadline.weight(.semibold)).foregroundStyle(.secondary)
                    }
                }
                Text(line).font(.body)
                NativeStreakWeek(days: streak.week)
                milestone
                freeze
                Text("Longest streak: \(longest) \(longest == 1 ? "day" : "days")")
                    .font(.footnote).foregroundStyle(.secondary)
            }
            .padding(20)
        }
    }

    private var milestone: some View {
        let left = next - streak.current
        return VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text("\(left) \(left == 1 ? "day" : "days") to \(next)").font(.footnote.weight(.semibold))
                Spacer()
                Text("Next milestone").font(.footnote).foregroundStyle(.secondary)
            }
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule().fill(Color.secondary.opacity(0.18))
                    Capsule()
                        .fill(LinearGradient(colors: [NativeStreakColors.flameTop, NativeStreakColors.flameBottom], startPoint: .leading, endPoint: .trailing))
                        .frame(width: geo.size.width * progress)
                }
            }
            .frame(height: 10)
        }
    }

    private var freeze: some View {
        HStack(spacing: 12) {
            Image(systemName: "snowflake")
                .cpIconFont(17, .bold).foregroundStyle(.white)
                .frame(width: 38, height: 38)
                .background(LinearGradient(colors: [NativeStreakColors.iceTop, NativeStreakColors.iceBottom], startPoint: .top, endPoint: .bottom),
                            in: RoundedRectangle(cornerRadius: 11, style: .continuous))
                .saturation(streak.usedFreezeThisMonth ? 0.1 : 1)
                .opacity(streak.usedFreezeThisMonth ? 0.55 : 1)
            VStack(alignment: .leading, spacing: 2) {
                if streak.usedFreezeThisMonth, let used = streak.freezeUsedOn {
                    Text("Freeze used \(NativeDayKey.label(used))").font(.footnote.weight(.semibold))
                    Text("A new one arrives \(NativeDayKey.label(NativeDayKey.nextMonthStart(streak.today), weekday: false)).")
                        .font(.footnote).foregroundStyle(.secondary)
                } else {
                    Text("Streak freeze ready").font(.footnote.weight(.semibold))
                    Text("Miss a day and it saves your streak. One every month.").font(.footnote).foregroundStyle(.secondary)
                }
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.secondary.opacity(0.08), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
    }
}

/// Duolingo's moment: the flame pops, sparks burst, the number rolls over,
/// today's circle fills. Shown once a day, the first time the app opens.
struct NativeStreakCelebrationView: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    let streak: NativeStreak
    let name: String?
    let onDone: () -> Void
    @State private var flame = false
    @State private var sparks = false
    @State private var rolled = false
    @State private var words = false
    @State private var today = false
    @State private var button = false

    private var from: Int { streak.lost > 0 ? 0 : streak.previous }

    var body: some View {
        ZStack {
            Color(red: 0.04, green: 0.03, blue: 0.02).opacity(0.95).ignoresSafeArea()
            RadialGradient(colors: [NativeStreakColors.orange.opacity(0.38), .clear], center: UnitPoint(x: 0.5, y: 0.3), startRadius: 0, endRadius: 380)
                .ignoresSafeArea()
            VStack(spacing: 0) {
                Spacer(minLength: 20)
                hero
                number
                copyBlock(streak.celebrationCopy(name: name))
                Spacer(minLength: 20)
                Button(action: onDone) {
                    Text("KEEP IT GOING")
                        .cpFont(16, .heavy, design: .rounded).tracking(1)
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity, minHeight: 54)
                        .background(NativeStreakColors.orange, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                        .background(NativeStreakColors.shadow.offset(y: 4).clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous)))
                }
                .buttonStyle(.plain)
                .opacity(button ? 1 : 0)
            }
            .frame(maxWidth: 440)
            .padding(.horizontal, 24)
            .padding(.bottom, 20)
        }
        .accessibilityAddTraits(.isModal)
        .task { await play() }
    }

    private var hero: some View {
        ZStack {
            ForEach(0..<16, id: \.self) { i in
                let angle = Double(i) * 22.5 * Double.pi / 180
                let distance = 92 + Double(i % 3) * 26
                let size = CGFloat(6 + (i % 3) * 3)
                Circle()
                    .fill(i % 3 == 0 ? NativeStreakColors.flameBottom : NativeStreakColors.coreTop)
                    .frame(width: size, height: size)
                    .offset(x: sparks ? cos(angle) * distance : 0, y: sparks ? sin(angle) * distance : 0)
                    .scaleEffect(sparks ? 1 : 0.01)
                    .opacity(sparks ? 0 : 1)
            }
            NativeStreakFlame(lit: true)
                .frame(width: 118, height: 148)
                .shadow(color: NativeStreakColors.flameBottom.opacity(0.6), radius: 26, y: 10)
                .scaleEffect(flame ? 1 : 0.01)
                .rotationEffect(.degrees(flame ? 0 : -14))
                .opacity(flame ? 1 : 0)
            if streak.froze != nil {
                Image(systemName: "snowflake")
                    .cpIconFont(22, .bold).foregroundStyle(.white)
                    .frame(width: 46, height: 46)
                    .background(LinearGradient(colors: [NativeStreakColors.iceTop, NativeStreakColors.iceBottom], startPoint: .top, endPoint: .bottom),
                                in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                    .offset(x: 62, y: -58)
                    .scaleEffect(flame ? 1 : 0.2)
                    .opacity(flame ? 1 : 0)
            }
        }
        .frame(height: 176)
        .accessibilityHidden(true)
    }

    private var number: some View {
        let same = from == streak.current
        return ZStack {
            Text("\(from)").offset(y: rolled ? -96 : 0).opacity(rolled || same ? 0 : 1)
            Text("\(streak.current)").offset(y: rolled || same ? 0 : 96)
        }
        .cpFont(80, .heavy, design: .rounded).monospacedDigit()
        .foregroundStyle(NativeStreakColors.orange)
        .shadow(color: NativeStreakColors.shadow, radius: 0, x: 0, y: 4)
        .frame(height: 100)
        .clipped()
        .opacity(flame ? 1 : 0)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(streak.current) day streak")
    }

    private func copyBlock(_ copy: (title: String, line: String)) -> some View {
        VStack(spacing: 0) {
            Text(copy.title)
                .cpFont(30, .heavy, design: .rounded)
                .foregroundStyle(.white)
                .multilineTextAlignment(.center)
                .padding(.top, 6)
            Text(copy.line)
                .cpFont(17, .medium, design: .rounded)
                .foregroundStyle(.white.opacity(0.8))
                .multilineTextAlignment(.center)
                .padding(.top, 8)
            NativeStreakWeek(days: streak.week, onDark: true, todayShown: today)
                .padding(.vertical, 16)
                .padding(.horizontal, 10)
                .background(Color.white.opacity(0.06), in: RoundedRectangle(cornerRadius: 20, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).strokeBorder(Color.white.opacity(0.12)))
                .padding(.top, 22)
        }
        .opacity(words ? 1 : 0)
        .offset(y: words ? 0 : 14)
    }

    private func wait(_ seconds: Double) async { try? await Task.sleep(for: .seconds(seconds)) }

    private func play() async {
        if reduceMotion {
            flame = true; rolled = true; words = true; today = true; button = true
            CPHaptics.success()
            return
        }
        NativeCelebrationHaptics.shared.playStreak()
        withAnimation(.spring(response: 0.45, dampingFraction: 0.5)) { flame = true }
        await wait(0.3)
        withAnimation(.easeOut(duration: 0.9)) { sparks = true }
        await wait(0.6)
        withAnimation(.spring(response: 0.4, dampingFraction: 0.6)) { rolled = true }
        await wait(0.2)
        withAnimation(.easeOut(duration: 0.4)) { words = true }
        await wait(0.6)
        withAnimation(.spring(response: 0.35, dampingFraction: 0.45)) { today = true }
        await wait(0.25)
        withAnimation(.easeOut(duration: 0.3)) { button = true }
    }
}

// MARK: - Confetti

/// When each part of the confetti happens. The haptics use the same numbers.
enum NativeConfettiTiming {
    static let titlePop = 0.16
    static let titleLand = 0.36
    static let notePop = 0.42
    static let fadeOut = 2.55
    static let total = 3.0
}

struct NativeCelebration: Identifiable, Equatable {
    enum Kind: Equatable {
        case study(minutes: Int, tasks: Int)
        case assignment(String)
    }
    let id: UUID
    let kind: Kind
    let title: String
    let note: String
    let symbol: String

    init(kind: Kind, name: String?) {
        id = UUID()
        self.kind = kind
        title = "Good job!!"
        let first = nativeFirstName(name)
        func named(_ with: String, _ without: String) -> String {
            guard let first else { return without }
            return with.replacingOccurrences(of: "{name}", with: first)
        }
        var options: [String]
        switch kind {
        case .study(let minutes, let tasks):
            symbol = "timer"
            options = [named("Future you says thanks, {name}.", "Future you says thanks.")]
            if minutes > 0 {
                options.append(named("\(minutes) minutes of real focus, {name}. That's how it's done.", "\(minutes) minutes of real focus. That's how it's done."))
                options.append(named("{name}, you just put in \(minutes) focused minutes. Take a breather.", "You just put in \(minutes) focused minutes. Take a breather."))
            }
            if tasks > 0 {
                let what = "\(tasks) \(tasks == 1 ? "task" : "tasks")"
                options.append(named("\(what) knocked out, {name}. You're on a roll.", "\(what) knocked out. You're on a roll."))
            }
        case .assignment(let name):
            symbol = "checkmark.seal.fill"
            let short = name.count > 42 ? String(name.prefix(40)) + "…" : name
            options = [
                named("“\(short)” is done, {name}. One less thing on your plate.", "“\(short)” is done. One less thing on your plate."),
                named("Checked off! You're crushing it, {name}.", "Checked off! You're crushing it."),
                named("Another one down, {name}. Keep that momentum.", "Another one down. Keep that momentum."),
            ]
        }
        note = options.randomElement() ?? options[0]
    }
}

/// Shows the confetti from anywhere (the study timer, a checkbox, a swipe),
/// in its own window above sheets so it really covers the whole screen.
@MainActor
final class NativeCelebrations: ObservableObject {
    static let shared = NativeCelebrations()
    @Published private(set) var current: NativeCelebration?
    /// The name the dashboard greets with.
    @Published var firstName: String?
    private var window: UIWindow?

    func studyFinished(minutes: Int, tasks: Int) { show(.study(minutes: minutes, tasks: tasks)) }
    func assignmentCompleted(_ name: String) { show(.assignment(name)) }

    private func show(_ kind: NativeCelebration.Kind) {
        current = NativeCelebration(kind: kind, name: firstName)
        attachWindow()
        window?.isHidden = false
    }

    func dismiss(_ id: UUID) {
        guard current?.id == id else { return }
        current = nil
        window?.isHidden = true
    }

    private func attachWindow() {
        guard window == nil else { return }
        let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
        guard let scene = scenes.first(where: { $0.activationState == .foregroundActive }) ?? scenes.first else { return }
        let window = UIWindow(windowScene: scene)
        window.windowLevel = .alert + 1
        window.backgroundColor = .clear
        let host = UIHostingController(rootView: NativeConfettiLayer())
        host.view.backgroundColor = .clear
        window.rootViewController = host
        self.window = window
    }
}

private struct NativeConfettiLayer: View {
    @ObservedObject private var celebrations = NativeCelebrations.shared
    var body: some View {
        ZStack {
            if let celebration = celebrations.current {
                NativeConfettiOverlay(celebration: celebration) { celebrations.dismiss(celebration.id) }
                    .id(celebration.id)
            }
        }
        .ignoresSafeArea()
    }
}

struct NativeConfettiPiece {
    enum Kind { case strip, square, circle }
    var origin: CGPoint
    var velocity: CGVector
    var delay: Double
    var spin: Double
    var flip: Double
    var phase: Double
    var sway: Double
    var size: CGSize
    var color: Color
    var kind: Kind

    func draw(in context: GraphicsContext, at time: Double) {
        let t = time - delay
        guard t > 0 else { return }
        // Air drag slows the launch; gravity takes over and settles to a drift.
        let drag = 1.9
        let travel = (1 - exp(-drag * t)) / drag
        let x = origin.x + velocity.dx * travel + sway * sin(phase + t * 3.2)
        let y = origin.y + velocity.dy * travel + 310 * t * t / (1 + t * 0.9)
        var ctx = context
        ctx.translateBy(x: x, y: y)
        ctx.rotate(by: .radians(phase + spin * t))
        ctx.scaleBy(x: cos(phase + flip * t * 2 * Double.pi), y: 1)
        let rect = CGRect(x: -size.width / 2, y: -size.height / 2, width: size.width, height: size.height)
        switch kind {
        case .circle: ctx.fill(Path(ellipseIn: rect), with: .color(color))
        case .strip, .square: ctx.fill(Path(roundedRect: rect, cornerRadius: 1.5), with: .color(color))
        }
    }

    static func burst(in size: CGSize) -> [NativeConfettiPiece] {
        let colors: [Color] = [
            Color(red: 0.13, green: 0.77, blue: 0.37), Color(red: 0.06, green: 0.73, blue: 0.51),
            Color(red: 0.64, green: 0.90, blue: 0.21), Color(red: 0.98, green: 0.80, blue: 0.08),
            Color(red: 0.98, green: 0.57, blue: 0.24), Color(red: 0.96, green: 0.45, blue: 0.71),
            Color(red: 0.38, green: 0.65, blue: 0.98), Color.white,
        ]
        let scale = max(0.85, min(1.4, Double(size.height) / 844))
        func piece(_ origin: CGPoint, _ velocity: CGVector, _ delay: Double) -> NativeConfettiPiece {
            let kinds: [Kind] = [.strip, .strip, .square, .circle]
            let kind = kinds.randomElement() ?? .strip
            let base: CGSize
            switch kind {
            case .strip: base = CGSize(width: 7, height: 14)
            case .square: base = CGSize(width: 9, height: 9)
            case .circle: base = CGSize(width: 8, height: 8)
            }
            return NativeConfettiPiece(
                origin: origin, velocity: velocity, delay: delay,
                spin: Double.random(in: -7...7), flip: Double.random(in: 0.6...2.2),
                phase: Double.random(in: 0...(2 * Double.pi)), sway: Double.random(in: 4...16),
                size: CGSize(width: base.width * scale, height: base.height * scale),
                color: colors.randomElement() ?? Color.white, kind: kind
            )
        }
        var pieces: [NativeConfettiPiece] = []
        // Two cannons, low in each corner, aimed up and in.
        for side in [1.0, -1.0] {
            for _ in 0..<55 {
                let angle = Double.random(in: 58...84) * Double.pi / 180
                let speed = Double.random(in: 1500...2200) * scale
                let x = side > 0 ? -8.0 : Double(size.width) + 8
                pieces.append(piece(CGPoint(x: x, y: Double(size.height) * 0.94),
                                    CGVector(dx: cos(angle) * speed * side, dy: -sin(angle) * speed),
                                    Double.random(in: 0...0.07)))
            }
        }
        // Then a shower from the top, so the whole screen fills.
        for _ in 0..<55 {
            pieces.append(piece(CGPoint(x: Double.random(in: 0...max(1, Double(size.width))), y: Double.random(in: -90 ... -10)),
                                CGVector(dx: Double.random(in: -60...60), dy: Double.random(in: 30...150)),
                                Double.random(in: 0.18...0.6)))
        }
        return pieces
    }
}

/// Full screen, three seconds: confetti bursts, "Good job!!" pops, a note
/// with the student's name, then it fades. A tap ends it early.
struct NativeConfettiOverlay: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    let celebration: NativeCelebration
    let onDone: () -> Void
    @State private var start = Date()
    @State private var pieces: [NativeConfettiPiece] = []
    @State private var titleShown = false
    @State private var noteShown = false
    @State private var leaving = false

    var body: some View {
        GeometryReader { geo in
            ZStack {
                Color.black.opacity(0.55)
                RadialGradient(colors: [Color(red: 0.13, green: 0.77, blue: 0.37).opacity(0.35), .clear], center: .center,
                               startRadius: 0, endRadius: max(geo.size.width, geo.size.height) * 0.6)
                if !reduceMotion {
                    TimelineView(.animation) { timeline in
                        Canvas { context, _ in
                            let t = timeline.date.timeIntervalSince(start)
                            for piece in pieces { piece.draw(in: context, at: t) }
                        }
                    }
                    .allowsHitTesting(false)
                }
                message
            }
            .frame(width: geo.size.width, height: geo.size.height)
            .opacity(leaving ? 0 : 1)
            .contentShape(Rectangle())
            .onTapGesture { onDone() }
            .task { await play(size: geo.size) }
        }
        .ignoresSafeArea()
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isModal)
    }

    private var message: some View {
        VStack(spacing: 14) {
            Image(systemName: celebration.symbol)
                .cpIconFont(40, .bold)
                .foregroundStyle(.white)
                .scaleEffect(titleShown ? 1 : 0.2)
                .opacity(titleShown ? 1 : 0)
            // The app's own type, not a rounded display face.
            Text(celebration.title)
                .cpFont(44, .semibold).tracking(-1)
                .foregroundStyle(.white)
                .shadow(color: .black.opacity(0.35), radius: 12, x: 0, y: 6)
                .scaleEffect(titleShown ? 1 : 0.3)
                .rotationEffect(.degrees(titleShown ? 0 : -8))
                .opacity(titleShown ? 1 : 0)
            Text(celebration.note)
                .cpFont(17, .medium)
                .foregroundStyle(.white.opacity(0.93))
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)
                .opacity(noteShown ? 1 : 0)
                .offset(y: noteShown ? 0 : 14)
        }
        .frame(maxWidth: 520)
    }

    private func play(size: CGSize) async {
        pieces = reduceMotion ? [] : NativeConfettiPiece.burst(in: size)
        start = Date()
        NativeCelebrationHaptics.shared.playConfetti()
        UIAccessibility.post(notification: .announcement, argument: "\(celebration.title) \(celebration.note)")
        withAnimation(.spring(response: 0.38, dampingFraction: 0.5).delay(NativeConfettiTiming.titlePop)) { titleShown = true }
        withAnimation(.easeOut(duration: 0.35).delay(NativeConfettiTiming.notePop)) { noteShown = true }
        try? await Task.sleep(for: .seconds(NativeConfettiTiming.fadeOut))
        guard !Task.isCancelled else { return }
        withAnimation(.easeIn(duration: NativeConfettiTiming.total - NativeConfettiTiming.fadeOut)) { leaving = true }
        try? await Task.sleep(for: .seconds(NativeConfettiTiming.total - NativeConfettiTiming.fadeOut))
        guard !Task.isCancelled else { return }
        onDone()
    }
}

// MARK: - Haptics

/// Vibration patterns that match the animations beat for beat. Phones without
/// Core Haptics get a few taps at the same moments.
@MainActor
final class NativeCelebrationHaptics {
    static let shared = NativeCelebrationHaptics()
    private var engine: CHHapticEngine?

    private static func tap(_ time: Double, _ intensity: Float, _ sharpness: Float) -> CHHapticEvent {
        CHHapticEvent(eventType: .hapticTransient, parameters: [
            CHHapticEventParameter(parameterID: .hapticIntensity, value: intensity),
            CHHapticEventParameter(parameterID: .hapticSharpness, value: sharpness),
        ], relativeTime: time)
    }

    private static func rumble(_ time: Double, _ duration: Double, _ intensity: Float, _ sharpness: Float) -> CHHapticEvent {
        CHHapticEvent(eventType: .hapticContinuous, parameters: [
            CHHapticEventParameter(parameterID: .hapticIntensity, value: intensity),
            CHHapticEventParameter(parameterID: .hapticSharpness, value: sharpness),
        ], relativeTime: time, duration: duration)
    }

    private func readyEngine() -> CHHapticEngine? {
        guard CHHapticEngine.capabilitiesForHardware().supportsHaptics else { return nil }
        if let engine { return engine }
        guard let created = try? CHHapticEngine() else { return nil }
        created.isAutoShutdownEnabled = true
        created.resetHandler = { [weak self] in
            Task { @MainActor in self?.engine = nil }
        }
        engine = created
        return created
    }

    private func play(_ events: [CHHapticEvent], curves: [CHHapticParameterCurve] = [],
                      fallback: [(Double, UIImpactFeedbackGenerator.FeedbackStyle, CGFloat)]) {
        if let engine = readyEngine() {
            do {
                try engine.start()
                let pattern = try CHHapticPattern(events: events, parameterCurves: curves)
                let player = try engine.makePlayer(with: pattern)
                try player.start(atTime: CHHapticTimeImmediate)
                return
            } catch {}
        }
        for (time, style, intensity) in fallback {
            DispatchQueue.main.asyncAfter(deadline: .now() + time) {
                UIImpactFeedbackGenerator(style: style).impactOccurred(intensity: intensity)
            }
        }
    }

    /// Cannon thump and rumble, a pop as "Good job!!" lands, then light ticks
    /// that thin out as the confetti falls, ending when it fades.
    func playConfetti() {
        var events = [
            Self.tap(0, 1.0, 0.75),
            Self.rumble(0, 0.32, 0.75, 0.3),
            Self.tap(NativeConfettiTiming.titlePop + 0.06, 0.9, 0.5),
            Self.tap(NativeConfettiTiming.titleLand, 0.5, 0.85),
        ]
        var time = 0.5
        var intensity: Float = 0.42
        while time < NativeConfettiTiming.fadeOut {
            events.append(Self.tap(time, intensity, 0.95))
            time += Double.random(in: 0.09...0.2)
            intensity = max(0.1, intensity * 0.9)
        }
        let decay = CHHapticParameterCurve(parameterID: .hapticIntensityControl, controlPoints: [
            CHHapticParameterCurve.ControlPoint(relativeTime: 0, value: 1),
            CHHapticParameterCurve.ControlPoint(relativeTime: 0.32, value: 0.2),
        ], relativeTime: 0)
        play(events, curves: [decay], fallback: [
            (0, .heavy, 1), (NativeConfettiTiming.titlePop + 0.06, .medium, 0.9), (NativeConfettiTiming.titleLand, .light, 0.6),
            (0.8, .soft, 0.5), (1.3, .soft, 0.4), (1.9, .soft, 0.3),
        ])
    }

    /// The flame landing, the number rolling over, today's circle filling.
    func playStreak() {
        play([
            Self.rumble(0, 0.3, 0.45, 0.2),
            Self.tap(0.22, 1.0, 0.6),
            Self.tap(1.1, 0.75, 0.9),
            Self.tap(2.0, 0.6, 0.7),
        ], fallback: [(0.22, .heavy, 1), (1.1, .rigid, 0.8), (2.0, .medium, 0.7)])
    }
}
