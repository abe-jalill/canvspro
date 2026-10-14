import ActivityKit
import AppIntents
import SwiftUI
import WidgetKit

// Shared by the app and the widget extension. The app writes a small snapshot of
// coursework, grades and classes to the App Group after each sync; the widgets
// only read it, so they never sign in or reach Canvas themselves.

// MARK: - Snapshot

struct CanvasProWidgetSnapshot: Codable, Equatable {
    struct Assignment: Codable, Equatable, Identifiable {
        let id: Int
        let name: String
        let course: String
        let due: Date
        /// Finished work stays in the snapshot for a week so progress can count it.
        let done: Bool
    }

    struct Course: Codable, Equatable, Identifiable {
        let id: Int
        let name: String
        let score: Double?
        let letter: String
    }

    struct ClassMeeting: Codable, Equatable, Identifiable {
        let id: String
        let name: String
        let location: String
        /// Calendar weekdays, Sunday = 1.
        let weekdays: [Int]
        let startMinutes: Int
        let endMinutes: Int
    }

    var signedIn: Bool
    var palette: String
    /// When the app last synced with Canvas.
    var syncedAt: Date?
    var assignments: [Assignment]
    /// Unfinished work already past due that is still worth catching up on.
    var overdueCount: Int
    var classes: [ClassMeeting]
    var courses: [Course]
    /// "Hide grades until tapped" in the app's settings.
    var hideGrades: Bool

    static let signedOut = CanvasProWidgetSnapshot(signedIn: false, palette: "forest", syncedAt: nil, assignments: [], overdueCount: 0, classes: [], courses: [], hideGrades: false)

    // Workload

    struct Workload {
        let range: CanvasProWorkloadRange
        /// Unfinished work still ahead in the range, soonest first.
        let remaining: [Assignment]
        let done: Int
        var total: Int { remaining.count + done }
        var progress: Double { total == 0 ? 1 : Double(done) / Double(total) }
    }

    func workload(_ range: CanvasProWorkloadRange, at date: Date, calendar: Calendar = .current) -> Workload {
        let start = calendar.startOfDay(for: date)
        let end = range.end(from: date, calendar: calendar)
        let inRange = assignments.filter { $0.due >= start && $0.due < end }
        let remaining = inRange.filter { !$0.done && $0.due > date }.sorted { $0.due < $1.due }
        return Workload(range: range, remaining: remaining, done: inRange.filter(\.done).count)
    }

    struct DayLoad {
        let day: Date
        let count: Int
    }

    /// Unfinished work due on each of the next seven days, today first.
    func week(at date: Date, calendar: Calendar = .current) -> [DayLoad] {
        let today = calendar.startOfDay(for: date)
        return (0..<7).compactMap { offset in
            guard let day = calendar.date(byAdding: .day, value: offset, to: today) else { return nil }
            let count = assignments.filter { !$0.done && $0.due > date && calendar.isDate($0.due, inSameDayAs: day) }.count
            return DayLoad(day: day, count: count)
        }
    }

    // Grades

    var scoredCourses: [Course] { courses.filter { $0.score != nil } }
    var average: Double? {
        let scores = scoredCourses.compactMap(\.score)
        return scores.isEmpty ? nil : scores.reduce(0, +) / Double(scores.count)
    }

    // Classes

    /// A class meeting on a given day, with real start and end times.
    struct Session: Equatable {
        let meeting: ClassMeeting
        let start: Date
        let end: Date
    }

    func sessions(on day: Date, calendar: Calendar = .current) -> [Session] {
        let weekday = calendar.component(.weekday, from: day)
        let midnight = calendar.startOfDay(for: day)
        return classes
            .filter { $0.weekdays.contains(weekday) && (0..<1_440).contains($0.startMinutes) && $0.endMinutes > $0.startMinutes }
            .compactMap { meeting in
                guard let start = calendar.date(byAdding: .minute, value: meeting.startMinutes, to: midnight),
                      let end = calendar.date(byAdding: .minute, value: meeting.endMinutes, to: midnight) else { return nil }
                return Session(meeting: meeting, start: start, end: end)
            }
            .sorted { $0.start < $1.start }
    }

    /// The class in progress, or the next one in the coming week.
    func currentOrNextClass(at date: Date, calendar: Calendar = .current) -> Session? {
        for offset in 0..<8 {
            guard let day = calendar.date(byAdding: .day, value: offset, to: date) else { continue }
            if let session = sessions(on: day, calendar: calendar).first(where: { $0.end > date }) { return session }
        }
        return nil
    }
}

/// How far ahead What's Due looks. Switched from the widget itself.
enum CanvasProWorkloadRange: String, CaseIterable, Codable {
    case tonight, twoDays, week

    var title: String {
        switch self { case .tonight: "Tonight"; case .twoDays: "2 Days"; case .week: "Week" }
    }
    var heading: String {
        switch self { case .tonight: "TONIGHT"; case .twoDays: "NEXT 2 DAYS"; case .week: "THIS WEEK" }
    }
    var phrase: String {
        switch self { case .tonight: "tonight"; case .twoDays: "in 2 days"; case .week: "this week" }
    }
    var emptyLine: String { "Nothing due \(phrase)" }
    var next: CanvasProWorkloadRange {
        switch self { case .tonight: .twoDays; case .twoDays: .week; case .week: .tonight }
    }
    /// Midnight after the last day in the range: tonight, tomorrow night, or a week out.
    func end(from date: Date, calendar: Calendar = .current) -> Date {
        let days = self == .tonight ? 1 : self == .twoDays ? 2 : 7
        return calendar.date(byAdding: .day, value: days, to: calendar.startOfDay(for: date)) ?? date
    }
}

/// The range buttons on What's Due. Runs in the widget, then the widget redraws.
struct CanvasProSetWorkloadRange: AppIntent {
    static let title: LocalizedStringResource = "Show work due"
    static let isDiscoverable = false

    @Parameter(title: "Range") var range: String

    init() {}
    init(_ range: CanvasProWorkloadRange) { self.range = range.rawValue }

    func perform() async throws -> some IntentResult {
        CanvasProWidgetStore.setWorkloadRange(CanvasProWorkloadRange(rawValue: range) ?? .tonight)
        return .result()
    }
}

// MARK: - Storage

enum CanvasProWidgetStore {
    static let appGroup = "group.app.canvaspro.mobile"
    static let dueSoonKind = "CanvasProDueSoon"
    static let gradesKind = "CanvasProGrades"
    static let nextClassKind = "CanvasProNextClass"
    private static let key = "CanvasProWidgetSnapshot.v2"
    private static let rangeKey = "CanvasProWorkloadRange"

    private static var defaults: UserDefaults? { UserDefaults(suiteName: appGroup) }

    static func load() -> CanvasProWidgetSnapshot? {
        guard let data = defaults?.data(forKey: key) else { return nil }
        return try? JSONDecoder().decode(CanvasProWidgetSnapshot.self, from: data)
    }

    /// Saves and refreshes the widgets, only when something they show changed.
    static func save(_ snapshot: CanvasProWidgetSnapshot) {
        guard snapshot != load(), let data = try? JSONEncoder().encode(snapshot) else { return }
        defaults?.set(data, forKey: key)
        WidgetCenter.shared.reloadAllTimelines()
    }

    static func updatePalette(_ palette: String) {
        guard var snapshot = load(), snapshot.palette != palette else { return }
        snapshot.palette = palette
        save(snapshot)
    }

    static func updateHideGrades(_ hide: Bool) {
        guard var snapshot = load(), snapshot.hideGrades != hide else { return }
        snapshot.hideGrades = hide
        save(snapshot)
    }

    /// After sign-out the widgets must stop showing the previous student's work.
    static func clear() {
        save(.signedOut)
    }

    static var workloadRange: CanvasProWorkloadRange {
        defaults?.string(forKey: rangeKey).flatMap(CanvasProWorkloadRange.init(rawValue:)) ?? .tonight
    }

    static func setWorkloadRange(_ range: CanvasProWorkloadRange) {
        defaults?.set(range.rawValue, forKey: rangeKey)
    }

    // Check-offs from a widget

    private static let pendingKey = "CanvasProPendingCompletions"

    /// Work checked off on a widget that the app hasn't saved to the account
    /// yet, with each one's due date.
    static var pendingCompletions: [Int: Date] {
        let raw = defaults?.dictionary(forKey: pendingKey) as? [String: Double] ?? [:]
        var result: [Int: Date] = [:]
        for (key, value) in raw { if let id = Int(key) { result[id] = Date(timeIntervalSince1970: value) } }
        return result
    }

    /// Shows the assignment as done on every widget at once, and leaves it for
    /// the app to save.
    static func markDone(_ id: Int, due: Date) {
        var raw = defaults?.dictionary(forKey: pendingKey) as? [String: Double] ?? [:]
        raw[String(id)] = due.timeIntervalSince1970
        defaults?.set(raw, forKey: pendingKey)
        guard var snapshot = load(), let index = snapshot.assignments.firstIndex(where: { $0.id == id }) else { return }
        let item = snapshot.assignments[index]
        snapshot.assignments[index] = CanvasProWidgetSnapshot.Assignment(id: item.id, name: item.name, course: item.course, due: item.due, done: true)
        save(snapshot)
    }

    /// The app saved these to the account.
    static func clearPending(_ ids: [Int]) {
        var raw = defaults?.dictionary(forKey: pendingKey) as? [String: Double] ?? [:]
        for id in ids { raw.removeValue(forKey: String(id)) }
        defaults?.set(raw, forKey: pendingKey)
    }
}

// MARK: - Style

/// Widgets are black and white: near-black or white surfaces, white or black
/// text, grays for everything secondary. Grades are the only color, red through
/// green as on the Grades tab. The account's color theme is not used here.
struct CanvasProWidgetPalette {
    /// Kept so callers can pass the account theme; widgets stay black and white.
    init(_ name: String = "") {}

    func background(_ scheme: ColorScheme) -> LinearGradient {
        let colors = scheme == .dark
            ? [Color(white: 0.12), Color(white: 0.035)]
            : [Color(white: 1.0), Color(white: 0.945)]
        return LinearGradient(colors: colors, startPoint: .topLeading, endPoint: .bottomTrailing)
    }
    func foreground(_ scheme: ColorScheme) -> Color {
        scheme == .dark ? Color(white: 0.97) : Color(white: 0.06)
    }
    func muted(_ scheme: ColorScheme) -> Color {
        scheme == .dark ? Color(white: 0.58) : Color(white: 0.44)
    }
    func faint(_ scheme: ColorScheme) -> Color {
        foreground(scheme).opacity(scheme == .dark ? 0.11 : 0.08)
    }
    /// Rings, dots and the selected range: the text color itself.
    func accent(_ scheme: ColorScheme) -> Color {
        foreground(scheme)
    }
    static func overdue(_ scheme: ColorScheme) -> Color {
        scheme == .dark ? Color(white: 0.97) : Color(white: 0.06)
    }
    /// Red through green, as on the Grades tab, a little softer.
    static func grade(_ score: Double?, scheme: ColorScheme) -> Color {
        guard let score, score.isFinite else { return hsl(215, 0.12, scheme == .dark ? 0.60 : 0.45) }
        let hue = (min(93, max(63, score)) - 63) / 30 * 142
        return scheme == .dark ? hsl(hue, 0.40, 0.64) : hsl(hue, 0.45, 0.38)
    }

    static func hsl(_ hue: Double, _ saturation: Double, _ lightness: Double) -> Color {
        let h = hue.truncatingRemainder(dividingBy: 360) / 60
        let c = (1 - abs(2 * lightness - 1)) * min(1, saturation)
        let x = c * (1 - abs(h.truncatingRemainder(dividingBy: 2) - 1))
        let m = lightness - c / 2
        let rgb: (Double, Double, Double)
        switch h { case 0..<1: rgb = (c, x, 0); case 1..<2: rgb = (x, c, 0); case 2..<3: rgb = (0, c, x); case 3..<4: rgb = (0, x, c); case 4..<5: rgb = (x, 0, c); default: rgb = (c, 0, x) }
        return Color(.sRGB, red: rgb.0 + m, green: rgb.1 + m, blue: rgb.2 + m)
    }
}

/// Small caps label used at the top of every widget.
private struct CanvasProCaption: View {
    let text: String
    let color: Color
    var body: some View {
        Text(text).font(.system(size: 9.5, weight: .bold)).tracking(1.1).foregroundStyle(color).lineLimit(1).minimumScaleFactor(0.9)
    }
}

/// A thin progress ring.
private struct CanvasProRing<Center: View>: View {
    let progress: Double
    let color: Color
    let track: Color
    var lineWidth: CGFloat = 4
    @ViewBuilder let center: () -> Center

    var body: some View {
        ZStack {
            Circle().stroke(track, lineWidth: lineWidth)
            Circle()
                .trim(from: 0, to: max(0.002, min(1, progress)))
                .stroke(color, style: StrokeStyle(lineWidth: lineWidth, lineCap: .round))
                .rotationEffect(.degrees(-90))
                .widgetAccentable()
            center()
        }
    }
}

/// A three-quarter arc, open at the bottom, for grade averages.
private struct CanvasProArc<Center: View>: View {
    let progress: Double
    let color: Color
    let track: Color
    var lineWidth: CGFloat = 5
    @ViewBuilder let center: () -> Center

    var body: some View {
        ZStack {
            Circle().trim(from: 0, to: 0.75)
                .stroke(track, style: StrokeStyle(lineWidth: lineWidth, lineCap: .round))
                .rotationEffect(.degrees(135))
            // No arc at all when there's nothing to show (hidden grades), not even a dot.
            if progress > 0 {
                Circle().trim(from: 0, to: 0.75 * min(1, progress))
                    .stroke(color, style: StrokeStyle(lineWidth: lineWidth, lineCap: .round))
                    .rotationEffect(.degrees(135))
                    .widgetAccentable()
            }
            center()
        }
    }
}

// MARK: - Formatting

enum CanvasProWidgetFormat {
    static func time(_ date: Date) -> String { date.formatted(date: .omitted, time: .shortened) }

    /// "11:59 PM" today, "Tmrw 9:00 AM", then "Thu 5:00 PM".
    static func due(_ date: Date, now: Date, calendar: Calendar = .current) -> String {
        if calendar.isDate(date, inSameDayAs: now) { return time(date) }
        if let tomorrow = calendar.date(byAdding: .day, value: 1, to: now), calendar.isDate(date, inSameDayAs: tomorrow) { return "Tmrw \(time(date))" }
        return "\(date.formatted(.dateTime.weekday(.abbreviated))) \(time(date))"
    }

    static func day(_ date: Date, now: Date, calendar: Calendar = .current) -> String {
        if calendar.isDate(date, inSameDayAs: now) { return "Today" }
        if let tomorrow = calendar.date(byAdding: .day, value: 1, to: now), calendar.isDate(date, inSameDayAs: tomorrow) { return "Tomorrow" }
        return date.formatted(.dateTime.weekday(.wide))
    }

    static func score(_ value: Double) -> String { value.formatted(.number.precision(.fractionLength(1))) }

    static func letter(_ score: Double?) -> String {
        guard let score, score.isFinite else { return "—" }
        return score >= 93 ? "A" : score >= 90 ? "A−" : score >= 87 ? "B+" : score >= 83 ? "B" : score >= 80 ? "B−" : score >= 77 ? "C+" : score >= 73 ? "C" : score >= 70 ? "C−" : score >= 67 ? "D+" : score >= 63 ? "D" : score >= 60 ? "D−" : "F"
    }
}

// MARK: - What's Due

struct CanvasProDueSoonView: View {
    @Environment(\.colorScheme) private var scheme
    let snapshot: CanvasProWidgetSnapshot
    let date: Date
    let family: WidgetFamily
    var range: CanvasProWorkloadRange = .tonight
    /// False under Siri's answer, where buttons can't be tapped.
    var interactive = true

    private var palette: CanvasProWidgetPalette { CanvasProWidgetPalette(snapshot.palette) }
    private var fg: Color { palette.foreground(scheme) }
    private var muted: Color { palette.muted(scheme) }
    private var faint: Color { palette.faint(scheme) }
    private var accent: Color { palette.accent(scheme) }
    private var work: CanvasProWidgetSnapshot.Workload { snapshot.workload(range, at: date) }

    var body: some View {
        if !snapshot.signedIn && !family.isAccessory {
            CanvasProSignedOutView(palette: palette, symbol: "checklist", line: "Open CanvasPro to see what's due")
        } else {
            switch family {
            case .accessoryCircular: circular
            case .accessoryRectangular: rectangular
            case .accessoryInline: inline
            case .systemSmall: small
            case .systemLarge: large
            default: medium
            }
        }
    }

    // Pieces

    private func ring(size: CGFloat, countSize: CGFloat) -> some View {
        CanvasProRing(progress: work.progress, color: accent, track: faint, lineWidth: size > 60 ? 4.5 : 4) {
            VStack(spacing: -1) {
                Text("\(work.remaining.count)").font(.system(size: countSize, weight: .bold)).monospacedDigit().foregroundStyle(fg)
                Text("left").font(.system(size: 8.5, weight: .semibold)).foregroundStyle(muted)
            }
        }
        .frame(width: size, height: size)
    }

    private var doneLine: String {
        work.total == 0 ? "All clear" : "\(work.done) of \(work.total) done"
    }

    private var rangePicker: some View {
        HStack(spacing: 2) {
            ForEach(CanvasProWorkloadRange.allCases, id: \.self) { option in
                if interactive {
                    Button(intent: CanvasProSetWorkloadRange(option)) { rangeLabel(option) }.buttonStyle(.plain)
                } else {
                    rangeLabel(option)
                }
            }
        }
        .padding(2)
        .background(Capsule().strokeBorder(fg.opacity(0.08), lineWidth: 0.5))
    }

    private func rangeLabel(_ option: CanvasProWorkloadRange) -> some View {
        Text(option.title)
            .font(.system(size: 9.5, weight: .bold))
            .foregroundStyle(option == range ? fg : muted)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 4)
            .background {
                if option == range { Capsule().fill(fg.opacity(scheme == .dark ? 0.12 : 0.08)) }
            }
            .contentShape(Capsule())
    }

    private var checkCircle: some View {
        Circle()
            .strokeBorder(muted, lineWidth: 1)
            .frame(width: 14, height: 14)
            .padding(5)
            .contentShape(Rectangle())
            .padding(-5)
            .widgetAccentable()
    }

    /// Tap to mark the assignment done, right from the widget.
    @ViewBuilder private func checkButton(_ item: CanvasProWidgetSnapshot.Assignment) -> some View {
        if interactive {
            Button(intent: CanvasProCompleteAssignment(item)) { checkCircle }
                .buttonStyle(.plain)
                .accessibilityLabel("Mark \(item.name) done")
        } else {
            checkCircle
        }
    }

    private func row(_ item: CanvasProWidgetSnapshot.Assignment) -> some View {
        HStack(alignment: .center, spacing: 9) {
            checkButton(item)
            VStack(alignment: .leading, spacing: 1) {
                Text(item.name).font(.system(size: 12, weight: .semibold)).foregroundStyle(fg).lineLimit(1).minimumScaleFactor(0.9)
                Text(item.course).font(.system(size: 10, weight: .medium)).foregroundStyle(muted).lineLimit(1).minimumScaleFactor(0.9)
            }
            Spacer(minLength: 6)
            // The time keeps its room; a long name truncates first.
            Text(CanvasProWidgetFormat.due(item.due, now: date))
                .font(.system(size: 10, weight: .semibold)).monospacedDigit()
                .foregroundStyle(muted).lineLimit(1).minimumScaleFactor(0.9)
                .layoutPriority(1)
        }
    }

    private func list(limit: Int, gap: CGFloat = 6) -> some View {
        let items = Array(work.remaining.prefix(limit))
        return VStack(alignment: .leading, spacing: 0) {
            if items.isEmpty {
                Spacer(minLength: 0)
                Label(range.emptyLine, systemImage: "checkmark.circle")
                    .font(.system(size: 11, weight: .semibold)).foregroundStyle(muted)
                Spacer(minLength: 0)
            } else {
                ForEach(Array(items.enumerated()), id: \.element.id) { index, item in
                    row(item)
                    if index < items.count - 1 {
                        Rectangle().fill(faint).frame(height: 0.5).padding(.vertical, gap).padding(.leading, 23)
                    }
                }
                if work.remaining.count > limit {
                    Text("+\(work.remaining.count - limit) more").font(.system(size: 10, weight: .semibold)).foregroundStyle(muted)
                        .padding(.top, gap).padding(.leading, 23)
                }
                Spacer(minLength: 0)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }

    // Home screen

    private var small: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Tapping the heading moves to the next range.
            Button(intent: CanvasProSetWorkloadRange(range.next)) {
                HStack(spacing: 4) {
                    CanvasProCaption(text: range.heading, color: muted)
                    Spacer(minLength: 4)
                    HStack(spacing: 3) {
                        ForEach(CanvasProWorkloadRange.allCases, id: \.self) { option in
                            Capsule().fill(option == range ? accent : faint).frame(width: option == range ? 10 : 4, height: 4)
                        }
                    }
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            Spacer(minLength: 0)
            HStack(spacing: 12) {
                ring(size: 54, countSize: 19)
                VStack(alignment: .leading, spacing: 2) {
                    Text(work.remaining.count == 1 ? "assignment" : "assignments").font(.system(size: 11, weight: .semibold)).foregroundStyle(fg)
                    Text(doneLine).font(.system(size: 10, weight: .medium)).foregroundStyle(muted)
                }
            }
            Spacer(minLength: 0)
            if let next = work.remaining.first {
                HStack(alignment: .center, spacing: 8) {
                    VStack(alignment: .leading, spacing: 0) {
                        Text(next.name).font(.system(size: 11.5, weight: .semibold)).foregroundStyle(fg).lineLimit(1).minimumScaleFactor(0.9)
                        Text("\(CanvasProWidgetFormat.due(next.due, now: date)) · \(next.course)").font(.system(size: 9.5, weight: .medium)).monospacedDigit().foregroundStyle(muted).lineLimit(1).minimumScaleFactor(0.9)
                    }
                    Spacer(minLength: 4)
                    checkButton(next)
                }
            } else {
                Text(range.emptyLine).font(.system(size: 10.5, weight: .semibold)).foregroundStyle(muted).lineLimit(2)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    }

    private var medium: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 10) {
                CanvasProCaption(text: "WHAT'S DUE", color: muted)
                Spacer(minLength: 8)
                rangePicker.frame(width: 172)
            }
            HStack(alignment: .top, spacing: 16) {
                VStack(spacing: 7) {
                    ring(size: 62, countSize: 21)
                    Text(doneLine).font(.system(size: 9.5, weight: .medium)).foregroundStyle(muted).lineLimit(1).minimumScaleFactor(0.9)
                }
                .frame(width: 74)
                // Two rows with room to breathe; the rest is "+N more".
                list(limit: 2, gap: 9)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }

    private var large: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 10) {
                CanvasProCaption(text: "WHAT'S DUE", color: muted)
                Spacer(minLength: 8)
                rangePicker.frame(width: 180)
            }
            HStack(alignment: .center, spacing: 16) {
                ring(size: 58, countSize: 20)
                VStack(alignment: .leading, spacing: 3) {
                    Text("\(work.remaining.count) \(work.remaining.count == 1 ? "assignment" : "assignments") \(range.phrase)")
                        .font(.system(size: 12.5, weight: .semibold)).foregroundStyle(fg).lineLimit(1).minimumScaleFactor(0.9)
                    Text(doneLine).font(.system(size: 10.5, weight: .medium)).foregroundStyle(muted)
                    if snapshot.overdueCount > 0 {
                        Text("\(snapshot.overdueCount) to catch up").font(.system(size: 10.5, weight: .semibold)).foregroundStyle(CanvasProWidgetPalette.overdue(scheme))
                    }
                }
                Spacer(minLength: 0)
            }
            weekStrip
            Rectangle().fill(faint).frame(height: 0.5)
            list(limit: 4, gap: 7)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }

    /// Seven slim bars, one per day; days outside the range fade back.
    private var weekStrip: some View {
        let days = snapshot.week(at: date)
        let peak = max(1, days.map(\.count).max() ?? 1)
        let end = range.end(from: date)
        return HStack(alignment: .bottom, spacing: 0) {
            ForEach(days, id: \.day) { entry in
                dayBar(entry, peak: peak, inside: entry.day < end)
            }
        }
        .frame(height: 36, alignment: .bottom)
    }

    private func dayBar(_ entry: CanvasProWidgetSnapshot.DayLoad, peak: Int, inside: Bool) -> some View {
        let isToday = Calendar.current.isDate(entry.day, inSameDayAs: date)
        let height: CGFloat = entry.count == 0 ? 4 : 6 + 14 * CGFloat(entry.count) / CGFloat(peak)
        let fill: Color = entry.count == 0 ? faint : (inside ? accent : muted.opacity(0.35))
        return VStack(spacing: 5) {
            Capsule().fill(fill).frame(width: 5, height: height).widgetAccentable(inside)
            Text(entry.day.formatted(.dateTime.weekday(.narrow)))
                .font(.system(size: 9, weight: isToday ? .bold : .medium))
                .foregroundStyle(inside ? fg.opacity(0.8) : muted.opacity(0.6))
        }
        .frame(maxWidth: .infinity)
    }

    // Lock screen

    private var circular: some View {
        Gauge(value: Double(work.done), in: 0...Double(max(1, work.total))) {
            Text("due")
        } currentValueLabel: {
            Text(snapshot.signedIn ? "\(work.remaining.count)" : "–").monospacedDigit()
        }
        .gaugeStyle(.accessoryCircularCapacity)
        .accessibilityLabel(snapshot.signedIn ? "\(work.remaining.count) left \(range.phrase)" : "Open CanvasPro")
    }

    private var rectangular: some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(snapshot.signedIn ? "\(range.title) · \(work.remaining.count) left" : "CanvasPro")
                .font(.system(size: 11, weight: .bold)).widgetAccentable()
            if let next = work.remaining.first {
                Text(next.name).font(.system(size: 13, weight: .semibold)).lineLimit(1).minimumScaleFactor(0.9)
                Text(CanvasProWidgetFormat.due(next.due, now: date)).font(.system(size: 11, weight: .medium)).monospacedDigit().lineLimit(1).minimumScaleFactor(0.9)
            } else {
                Text(snapshot.signedIn ? range.emptyLine : "Open CanvasPro to see what's due").font(.system(size: 12, weight: .semibold)).lineLimit(2)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var inline: some View {
        if !snapshot.signedIn { return Text("CanvasPro") }
        if let next = work.remaining.first { return Text("\(work.remaining.count) due · \(next.name)") }
        return Text(range.emptyLine)
    }
}

// MARK: - Grades

struct CanvasProGradesView: View {
    @Environment(\.colorScheme) private var scheme
    let snapshot: CanvasProWidgetSnapshot
    let family: WidgetFamily

    private var palette: CanvasProWidgetPalette { CanvasProWidgetPalette(snapshot.palette) }
    private var fg: Color { palette.foreground(scheme) }
    private var muted: Color { palette.muted(scheme) }
    private var faint: Color { palette.faint(scheme) }
    private var average: Double? { snapshot.average }
    private var hidden: Bool { snapshot.hideGrades }

    var body: some View {
        if !snapshot.signedIn && !family.isAccessory {
            CanvasProSignedOutView(palette: palette, symbol: "chart.bar", line: "Open CanvasPro to see your grades")
        } else {
            switch family {
            case .accessoryCircular: circular
            case .accessoryRectangular: rectangular
            case .accessoryInline: inline
            case .systemSmall: small
            case .systemLarge: large
            default: medium
            }
        }
    }

    private var classCount: String {
        let count = snapshot.scoredCourses.count
        return count == 0 ? "No grades yet" : "\(count) \(count == 1 ? "class" : "classes")"
    }

    private var gradeColor: Color { CanvasProWidgetPalette.grade(average, scheme: scheme) }

    private func gauge(size: CGFloat, valueSize: CGFloat) -> some View {
        CanvasProArc(progress: hidden ? 0 : (average ?? 0) / 100, color: gradeColor, track: faint, lineWidth: 5) {
            VStack(spacing: 1) {
                if hidden {
                    Image(systemName: "eye.slash").font(.system(size: valueSize * 0.7, weight: .bold)).foregroundStyle(muted)
                } else {
                    HStack(alignment: .firstTextBaseline, spacing: 1) {
                        Text(average.map(CanvasProWidgetFormat.score) ?? "—").font(.system(size: valueSize, weight: .bold)).monospacedDigit().foregroundStyle(fg)
                        if average != nil { Text("%").font(.system(size: valueSize * 0.45, weight: .semibold)).foregroundStyle(muted) }
                    }
                    .privacySensitive()
                }
                Text(hidden ? "HIDDEN" : CanvasProWidgetFormat.letter(average))
                    .font(.system(size: 9, weight: .bold)).tracking(0.8)
                    .foregroundStyle(hidden ? muted : gradeColor)
                    .privacySensitive()
            }
            .offset(y: 2)
        }
        .frame(width: size, height: size)
    }

    private var small: some View {
        VStack(alignment: .leading, spacing: 0) {
            CanvasProCaption(text: "AVERAGE", color: muted)
            Spacer(minLength: 0)
            gauge(size: 92, valueSize: 21).frame(maxWidth: .infinity)
            Spacer(minLength: 0)
            Text(classCount).font(.system(size: 10, weight: .medium)).foregroundStyle(muted)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    }

    private var medium: some View {
        HStack(alignment: .top, spacing: 18) {
            VStack(alignment: .leading, spacing: 0) {
                CanvasProCaption(text: "AVERAGE", color: muted)
                Spacer(minLength: 0)
                gauge(size: 92, valueSize: 21)
                Spacer(minLength: 0)
                Text(classCount).font(.system(size: 10, weight: .medium)).foregroundStyle(muted)
            }
            .frame(width: 96, alignment: .leading)
            VStack(alignment: .leading, spacing: 9) {
                CanvasProCaption(text: "CLASSES", color: muted)
                if snapshot.courses.isEmpty {
                    Text("No classes yet").font(.system(size: 11, weight: .semibold)).foregroundStyle(muted)
                }
                ForEach(snapshot.courses.prefix(4)) { course in courseRow(course) }
                Spacer(minLength: 0)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }

    /// Every class, under the average. Seven fit; beyond that the last line
    /// says how many more there are.
    private var large: some View {
        let courses = snapshot.courses
        let fits = 7
        let shown = courses.count > fits ? Array(courses.prefix(fits - 1)) : courses
        return VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .center, spacing: 16) {
                gauge(size: 84, valueSize: 19)
                VStack(alignment: .leading, spacing: 4) {
                    CanvasProCaption(text: "AVERAGE", color: muted)
                    Text(hidden ? "Hidden" : average.map { "\(CanvasProWidgetFormat.letter($0)) overall" } ?? "No grades yet")
                        .font(.system(size: 18, weight: .bold)).foregroundStyle(fg)
                        .lineLimit(1).minimumScaleFactor(0.9)
                        .privacySensitive()
                    Text(classCount).font(.system(size: 11, weight: .semibold)).foregroundStyle(muted)
                }
                Spacer(minLength: 0)
            }
            Rectangle().fill(faint).frame(height: 0.5)
            VStack(alignment: .leading, spacing: 10) {
                CanvasProCaption(text: "ALL CLASSES", color: muted)
                if courses.isEmpty {
                    Text("No classes yet").font(.system(size: 12, weight: .semibold)).foregroundStyle(muted)
                }
                ForEach(shown) { course in courseRow(course) }
                if courses.count > shown.count {
                    Text("+\(courses.count - shown.count) more").font(.system(size: 10, weight: .semibold)).foregroundStyle(muted)
                }
            }
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }

    private func courseRow(_ course: CanvasProWidgetSnapshot.Course) -> some View {
        let fraction = hidden ? 0 : min(1, max(0, (course.score ?? 0) / 100))
        return VStack(alignment: .leading, spacing: 4) {
            HStack(alignment: .firstTextBaseline) {
                Text(course.name).font(.system(size: 11, weight: .semibold)).foregroundStyle(fg).lineLimit(1).minimumScaleFactor(0.9)
                Spacer(minLength: 6)
                Text(hidden ? "••" : course.score.map(CanvasProWidgetFormat.score) ?? "—")
                    .font(.system(size: 10.5, weight: .semibold)).monospacedDigit().foregroundStyle(muted)
                    .privacySensitive()
            }
            GeometryReader { bar in
                ZStack(alignment: .leading) {
                    Capsule().fill(faint)
                    Capsule()
                        .fill(CanvasProWidgetPalette.grade(course.score, scheme: scheme))
                        .frame(width: bar.size.width * fraction)
                        .widgetAccentable()
                }
            }
            .frame(height: 3)
            .privacySensitive()
        }
    }

    // Lock screen

    private var circular: some View {
        Gauge(value: hidden ? 0 : min(100, max(0, average ?? 0)), in: 0...100) {
            Text("avg")
        } currentValueLabel: {
            Text(hidden || !snapshot.signedIn ? "–" : CanvasProWidgetFormat.letter(average)).privacySensitive()
        }
        .gaugeStyle(.accessoryCircular)
    }

    private var rectangular: some View {
        VStack(alignment: .leading, spacing: 1) {
            Text("Average").font(.system(size: 11, weight: .bold)).widgetAccentable()
            Text(hidden || !snapshot.signedIn ? "Hidden" : average.map { "\(CanvasProWidgetFormat.score($0))% · \(CanvasProWidgetFormat.letter($0))" } ?? "No grades yet")
                .font(.system(size: 15, weight: .semibold)).monospacedDigit().privacySensitive()
            Text(classCount).font(.system(size: 11, weight: .medium))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var inline: some View {
        guard snapshot.signedIn, !hidden, let average else { return Text("CanvasPro grades") }
        return Text("Average \(CanvasProWidgetFormat.score(average))% · \(CanvasProWidgetFormat.letter(average))")
    }
}

// MARK: - Next Class

struct CanvasProNextClassView: View {
    @Environment(\.colorScheme) private var scheme
    let snapshot: CanvasProWidgetSnapshot
    let date: Date
    let family: WidgetFamily

    private var palette: CanvasProWidgetPalette { CanvasProWidgetPalette(snapshot.palette) }
    private var fg: Color { palette.foreground(scheme) }
    private var muted: Color { palette.muted(scheme) }
    private var faint: Color { palette.faint(scheme) }
    private var accent: Color { palette.accent(scheme) }
    private var session: CanvasProWidgetSnapshot.Session? { snapshot.currentOrNextClass(at: date) }

    var body: some View {
        if !snapshot.signedIn && !family.isAccessory {
            CanvasProSignedOutView(palette: palette, symbol: "calendar", line: "Open CanvasPro to see your classes")
        } else {
            switch family {
            case .accessoryRectangular: rectangular
            case .accessoryInline: inline
            default: home
            }
        }
    }

    private func isNow(_ session: CanvasProWidgetSnapshot.Session) -> Bool { session.start <= date }

    private func elapsed(_ session: CanvasProWidgetSnapshot.Session) -> CGFloat {
        let length = session.end.timeIntervalSince(session.start)
        guard length > 0 else { return 0 }
        return CGFloat(min(1, max(0, date.timeIntervalSince(session.start) / length)))
    }

    @ViewBuilder private var home: some View {
        if let session {
            HStack(alignment: .top, spacing: 18) {
                summary(session)
                if family != .systemSmall { dayTimeline(for: session) }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        } else {
            VStack(alignment: .leading, spacing: 0) {
                CanvasProCaption(text: "CLASSES", color: muted)
                Spacer(minLength: 0)
                Label(snapshot.classes.isEmpty ? "Add your schedule in CanvasPro" : "No classes this week", systemImage: "calendar")
                    .font(.system(size: 11, weight: .semibold)).foregroundStyle(muted)
                Spacer(minLength: 0)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        }
    }

    private func summary(_ session: CanvasProWidgetSnapshot.Session) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 5) {
                if isNow(session) { Circle().fill(accent).frame(width: 5, height: 5).widgetAccentable() }
                CanvasProCaption(text: isNow(session) ? "IN CLASS" : CanvasProWidgetFormat.day(session.start, now: date).uppercased(), color: isNow(session) ? accent : muted)
            }
            Spacer(minLength: 0)
            Text(session.meeting.name).font(.system(size: 14, weight: .bold)).foregroundStyle(fg).lineLimit(2)
            if !session.meeting.location.isEmpty {
                Text(session.meeting.location).font(.system(size: 10.5, weight: .medium)).foregroundStyle(muted).lineLimit(1).minimumScaleFactor(0.9).padding(.top, 2)
            }
            Spacer(minLength: 0)
            if isNow(session) {
                // Steps forward with the timeline, every five minutes of class.
                GeometryReader { bar in
                    ZStack(alignment: .leading) {
                        Capsule().fill(faint)
                        Capsule().fill(accent).frame(width: bar.size.width * elapsed(session)).widgetAccentable()
                    }
                }
                .frame(height: 3)
                Text("Until \(CanvasProWidgetFormat.time(session.end))")
                    .font(.system(size: 9.5, weight: .semibold)).monospacedDigit().foregroundStyle(muted).lineLimit(1).minimumScaleFactor(0.9).padding(.top, 5)
            } else {
                Text("\(CanvasProWidgetFormat.time(session.start)) – \(CanvasProWidgetFormat.time(session.end))")
                    .font(.system(size: 10.5, weight: .semibold)).monospacedDigit().foregroundStyle(fg.opacity(0.85)).lineLimit(1).minimumScaleFactor(0.9)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    }

    /// That day's classes on a thin timeline.
    private func dayTimeline(for session: CanvasProWidgetSnapshot.Session) -> some View {
        let day = Array(snapshot.sessions(on: session.start).prefix(4))
        return VStack(alignment: .leading, spacing: 0) {
            CanvasProCaption(text: CanvasProWidgetFormat.day(session.start, now: date).uppercased(), color: muted)
                .padding(.bottom, 8)
            ForEach(Array(day.enumerated()), id: \.offset) { index, item in
                timelineRow(item, current: item.start == session.start, last: index == day.count - 1)
            }
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }

    private func timelineRow(_ item: CanvasProWidgetSnapshot.Session, current: Bool, last: Bool) -> some View {
        let past = item.end <= date
        let dot: Color = current ? accent : (past ? faint : muted.opacity(0.5))
        return HStack(alignment: .top, spacing: 9) {
            VStack(spacing: 0) {
                Circle().fill(dot).frame(width: 6, height: 6).padding(.top, 3).widgetAccentable(current)
                if !last { Rectangle().fill(faint).frame(width: 1).frame(maxHeight: .infinity) }
            }
            .frame(width: 6)
            VStack(alignment: .leading, spacing: 1) {
                Text(item.meeting.name).font(.system(size: 11, weight: current ? .bold : .semibold)).foregroundStyle(past ? muted : fg).lineLimit(1).minimumScaleFactor(0.9)
                Text(CanvasProWidgetFormat.time(item.start)).font(.system(size: 9.5, weight: .medium)).monospacedDigit().foregroundStyle(muted).lineLimit(1)
            }
            .padding(.bottom, 7)
        }
    }

    @ViewBuilder private var rectangular: some View {
        if snapshot.signedIn, let session {
            VStack(alignment: .leading, spacing: 1) {
                Text(isNow(session) ? "In class" : "\(CanvasProWidgetFormat.day(session.start, now: date)) · \(CanvasProWidgetFormat.time(session.start))")
                    .font(.system(size: 11, weight: .bold)).widgetAccentable()
                Text(session.meeting.name).font(.system(size: 13, weight: .semibold)).lineLimit(1).minimumScaleFactor(0.9)
                if !session.meeting.location.isEmpty { Text(session.meeting.location).font(.system(size: 11, weight: .medium)).lineLimit(1).minimumScaleFactor(0.9) }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        } else {
            VStack(alignment: .leading, spacing: 1) {
                Text("Classes").font(.system(size: 11, weight: .bold)).widgetAccentable()
                Text(snapshot.signedIn ? "No classes ahead" : "Open CanvasPro").font(.system(size: 13, weight: .semibold))
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private var inline: some View {
        guard snapshot.signedIn, let session else { return Text("CanvasPro") }
        return Text("\(session.meeting.name) · \(isNow(session) ? "now" : CanvasProWidgetFormat.time(session.start))")
    }
}

// MARK: - Shared pieces

private struct CanvasProSignedOutView: View {
    @Environment(\.colorScheme) private var scheme
    let palette: CanvasProWidgetPalette
    let symbol: String
    let line: String

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            CanvasProCaption(text: "CANVASPRO", color: palette.muted(scheme))
            Spacer(minLength: 0)
            Image(systemName: symbol).font(.system(size: 18, weight: .bold)).foregroundStyle(palette.accent(scheme)).widgetAccentable()
            Text(line).font(.system(size: 11, weight: .semibold)).foregroundStyle(palette.foreground(scheme)).lineLimit(2).padding(.top, 8)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    }
}

extension WidgetFamily {
    var isAccessory: Bool {
        switch self {
        case .accessoryCircular, .accessoryRectangular, .accessoryInline: true
        default: false
        }
    }
}

extension CanvasProWidgetSnapshot {
    /// Sample data for the widget gallery and placeholders.
    static func sample(now: Date = Date(), calendar: Calendar = .current) -> CanvasProWidgetSnapshot {
        let today = calendar.startOfDay(for: now)
        func at(_ day: Int, _ hour: Int, _ minute: Int) -> Date {
            calendar.date(byAdding: .minute, value: day * 1_440 + hour * 60 + minute, to: today) ?? now
        }
        let weekday = calendar.component(.weekday, from: now)
        let tomorrow = weekday % 7 + 1
        // The first class started a little before "now", so one is in session.
        let nowMinutes = calendar.component(.hour, from: now) * 60 + calendar.component(.minute, from: now)
        let current = max(0, min(nowMinutes - 20, 21 * 60))
        let tonight = max(at(0, 23, 59), now.addingTimeInterval(3_600))
        return CanvasProWidgetSnapshot(
            signedIn: true,
            palette: "forest",
            syncedAt: now,
            assignments: [
                Assignment(id: 1, name: "Lab report: enzyme kinetics and reaction rates", course: "BIO 110", due: tonight, done: false),
                Assignment(id: 2, name: "Reading quiz", course: "PSY 101", due: tonight.addingTimeInterval(-60), done: false),
                Assignment(id: 3, name: "Discussion post", course: "ENG 102", due: tonight, done: true),
                Assignment(id: 4, name: "Research outline", course: "ENG 102", due: at(1, 9, 0), done: false),
                Assignment(id: 5, name: "Problem set 4", course: "MATH 210", due: at(1, 17, 0), done: false),
                Assignment(id: 6, name: "Lab prep", course: "BIO 110", due: at(1, 20, 0), done: true),
                Assignment(id: 7, name: "Reading response", course: "PSY 101", due: at(3, 23, 59), done: false),
                Assignment(id: 8, name: "Quiz 3", course: "CS 230", due: at(4, 10, 0), done: false),
                Assignment(id: 9, name: "Project proposal", course: "ENG 102", due: at(4, 23, 59), done: false),
                Assignment(id: 10, name: "Problem set 5", course: "MATH 210", due: at(6, 17, 0), done: false),
            ],
            overdueCount: 1,
            classes: [
                ClassMeeting(id: "1", name: "Data Structures", location: "Science 204", weekdays: [weekday], startMinutes: current, endMinutes: current + 75),
                ClassMeeting(id: "2", name: "College Writing", location: "Humanities 118", weekdays: [weekday], startMinutes: min(current + 90, 22 * 60), endMinutes: min(current + 140, 23 * 60)),
                ClassMeeting(id: "3", name: "Transportation Engineering Fundamentals", location: "Hall B", weekdays: [weekday, tomorrow], startMinutes: min(current + 150, 23 * 60), endMinutes: min(current + 200, 23 * 60 + 59)),
                ClassMeeting(id: "4", name: "Calculus II", location: "Math 310", weekdays: [tomorrow], startMinutes: 9 * 60, endMinutes: 10 * 60 + 15),
            ],
            courses: [
                Course(id: 1, name: "Biology", score: 94.2, letter: "A"),
                Course(id: 2, name: "College Writing", score: 89.1, letter: "B+"),
                Course(id: 3, name: "Calculus II", score: 82.4, letter: "B−"),
                Course(id: 4, name: "Fundamentals of Engineering Design Projects", score: 91.6, letter: "A−"),
                Course(id: 5, name: "Physics Lab", score: 82.8, letter: "B"),
                Course(id: 6, name: "Graphics Lab", score: 92.5, letter: "A−"),
                Course(id: 7, name: "Modern Texts", score: 90.9, letter: "A−"),
            ],
            hideGrades: false
        )
    }
}

// MARK: - Live Activities
//
// The app starts and updates these; the widget extension draws them on the lock
// screen and in the Dynamic Island. Both stay black and white, like the widgets.

/// A study session or Pomodoro, counting down on its own between updates.
struct CanvasProStudyActivity: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        /// The assignment being worked on, or "Study session".
        var title: String
        /// Course, and "2 of 3" when the session covers several assignments.
        var detail: String
        /// "Focus", "Short break", "Long break" or "Studying".
        var phase: String
        /// "Focus block 2 of 4" in a Pomodoro.
        var step: String?
        var running: Bool
        /// The current block, while running. Both are the same fixed date when paused.
        var blockStart: Date
        var blockEnd: Date
        /// Seconds left and the block's length, for the paused view and its bar.
        var remaining: Int
        var total: Int
        var finished: Bool
    }
}

/// Work still due before midnight, from 9 PM.
struct CanvasProTonightActivity: ActivityAttributes {
    struct Item: Codable, Hashable {
        let name: String
        let course: String
        let due: Date
    }

    struct ContentState: Codable, Hashable {
        /// The next few unfinished assignments, soonest first.
        var items: [Item]
        var remaining: Int
        var done: Int
    }

    /// The night this covers, as the start of that day.
    var day: Date
}

enum CanvasProActivityFormat {
    static func clock(_ seconds: Int) -> String {
        let value = max(0, seconds)
        return value >= 3_600
            ? String(format: "%d:%02d:%02d", value / 3_600, value % 3_600 / 60, value % 60)
            : String(format: "%d:%02d", value / 60, value % 60)
    }
}

/// The study timer: counts down live while running, holds still when paused.
struct CanvasProStudyClock: View {
    let state: CanvasProStudyActivity.ContentState
    var size: CGFloat = 30
    var weight: Font.Weight = .light
    var alignment: TextAlignment = .trailing

    var body: some View {
        Group {
            if state.finished {
                Image(systemName: "checkmark").font(.system(size: size * 0.62, weight: weight))
            } else if state.running && state.blockEnd > state.blockStart {
                Text(timerInterval: state.blockStart...state.blockEnd, countsDown: true)
                    .font(.system(size: size, weight: weight)).monospacedDigit()
            } else {
                Text(CanvasProActivityFormat.clock(state.remaining))
                    .font(.system(size: size, weight: weight)).monospacedDigit()
            }
        }
        .foregroundStyle(.white)
        .multilineTextAlignment(alignment)
        .lineLimit(1)
    }
}

/// How far into the current block, as a hairline bar.
struct CanvasProStudyBar: View {
    let state: CanvasProStudyActivity.ContentState

    var body: some View {
        if state.running && !state.finished && state.blockEnd > state.blockStart {
            ProgressView(timerInterval: state.blockStart...state.blockEnd, countsDown: false) {
                EmptyView()
            } currentValueLabel: {
                EmptyView()
            }
            .progressViewStyle(.linear)
            .tint(.white)
            .labelsHidden()
        } else {
            let fraction = state.finished ? 1 : (state.total > 0 ? 1 - Double(state.remaining) / Double(state.total) : 0)
            GeometryReader { bar in
                ZStack(alignment: .leading) {
                    Capsule().fill(Color.white.opacity(0.18))
                    Capsule().fill(Color.white.opacity(state.finished ? 1 : 0.55)).frame(width: bar.size.width * min(1, max(0, fraction)))
                }
            }
            .frame(height: 4)
        }
    }
}

private struct CanvasProActivityCaption: View {
    let text: String
    var body: some View {
        Text(text).font(.system(size: 10, weight: .semibold)).tracking(1.1).foregroundStyle(.white.opacity(0.6)).lineLimit(1)
    }
}

struct CanvasProStudyLockView: View {
    let state: CanvasProStudyActivity.ContentState

    static func caption(_ state: CanvasProStudyActivity.ContentState) -> String {
        if state.finished { return "SESSION DONE" }
        guard let step = state.step?.uppercased() else { return state.running ? state.phase.uppercased() : "PAUSED" }
        if !state.running { return "PAUSED · \(step)" }
        // "Focus block 2 of 4" already says Focus.
        return step.hasPrefix(state.phase.uppercased()) ? step : "\(state.phase.uppercased()) · \(step)"
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .center, spacing: 14) {
                VStack(alignment: .leading, spacing: 3) {
                    HStack(spacing: 6) {
                        Circle().fill(Color.white.opacity(state.running && !state.finished ? 1 : 0.35)).frame(width: 5, height: 5)
                        CanvasProActivityCaption(text: Self.caption(state))
                    }
                    Text(state.title).font(.system(size: 15, weight: .semibold)).foregroundStyle(.white).lineLimit(1)
                    if !state.detail.isEmpty {
                        Text(state.detail).font(.system(size: 12)).foregroundStyle(.white.opacity(0.6)).lineLimit(1)
                    }
                }
                Spacer(minLength: 8)
                CanvasProStudyClock(state: state, size: 30)
            }
            CanvasProStudyBar(state: state)
        }
        .padding(16)
    }
}

/// A countdown to the next deadline tonight; never runs backwards.
struct CanvasProTonightCountdown: View {
    let due: Date
    var size: CGFloat = 13
    var weight: Font.Weight = .light
    var alignment: TextAlignment = .trailing

    var body: some View {
        Text(timerInterval: min(Date(), due)...due, countsDown: true)
            .font(.system(size: size, weight: weight)).monospacedDigit()
            .foregroundStyle(.white)
            .multilineTextAlignment(alignment)
            .lineLimit(1)
    }
}

struct CanvasProTonightLockView: View {
    let state: CanvasProTonightActivity.ContentState

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .firstTextBaseline) {
                CanvasProActivityCaption(text: "DUE TONIGHT")
                Spacer(minLength: 8)
                Text(state.remaining == 0 ? "All done" : "\(state.remaining) left · \(state.done) done")
                    .font(.system(size: 11, weight: .medium)).foregroundStyle(.white.opacity(0.6))
            }
            if state.items.isEmpty {
                Text("Everything due tonight is done.").font(.system(size: 14, weight: .medium)).foregroundStyle(.white)
            } else {
                VStack(alignment: .leading, spacing: 7) {
                    ForEach(state.items, id: \.self) { item in
                        HStack(alignment: .firstTextBaseline, spacing: 8) {
                            Circle().fill(Color.white).frame(width: 4, height: 4).offset(y: -2)
                            Text(item.name).font(.system(size: 13.5, weight: .medium)).foregroundStyle(.white).lineLimit(1)
                            Text(item.course).font(.system(size: 11)).foregroundStyle(.white.opacity(0.5)).lineLimit(1)
                            Spacer(minLength: 6)
                            Text(CanvasProWidgetFormat.time(item.due)).font(.system(size: 12, weight: .medium)).monospacedDigit().foregroundStyle(.white.opacity(0.7))
                        }
                    }
                }
                if let next = state.items.first?.due {
                    HStack(spacing: 5) {
                        Text("Next due in").font(.system(size: 11)).foregroundStyle(.white.opacity(0.6))
                        CanvasProTonightCountdown(due: next, size: 11).frame(maxWidth: 70, alignment: .leading)
                        Spacer(minLength: 0)
                    }
                }
            }
        }
        .padding(16)
    }
}

// MARK: - Dynamic Island, expanded

/// The CanvasPro mark (the app icon's three bars in a ring), drawn in SwiftUI
/// so the widget extension needs no image asset.
struct CanvasProLogoMark: View {
    var size: CGFloat = 34
    static let mint = Color(red: 0.49, green: 0.84, blue: 0.65)
    static let teal = Color(red: 0.30, green: 0.72, blue: 0.70)
    private let heights: [CGFloat] = [0.32, 0.70, 0.51]

    var body: some View {
        ZStack {
            Circle().fill(Color(red: 0, green: 0.184, blue: 0.125))
            Circle().stroke(
                AngularGradient(colors: [Self.mint, Self.teal, Self.mint], center: .center),
                lineWidth: size * 0.05
            )
            HStack(alignment: .bottom, spacing: size * 0.07) {
                ForEach(0..<3, id: \.self) { index in
                    RoundedRectangle(cornerRadius: size * 0.04, style: .continuous)
                        .fill(index == 1 ? Self.mint : Color.white)
                        .frame(width: size * 0.13, height: size * heights[index] * 0.85)
                }
            }
            .rotationEffect(.degrees(-16))
            .offset(y: size * 0.02)
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }
}

/// Top of the expanded island: what's going on, bold and centred.
struct CanvasProIslandHeading: View {
    let caption: String
    let title: String

    var body: some View {
        VStack(spacing: 2) {
            Text(caption)
                .font(.system(size: 10, weight: .heavy)).tracking(1.2)
                .foregroundStyle(CanvasProLogoMark.mint)
                .lineLimit(1).minimumScaleFactor(0.8)
            Text(title)
                .font(.system(size: 16, weight: .bold))
                .foregroundStyle(.white)
                .lineLimit(1).minimumScaleFactor(0.8)
        }
        .multilineTextAlignment(.center)
        .frame(maxWidth: .infinity)
    }
}

/// A round badge on the island's right: a status symbol or a count.
struct CanvasProIslandBadge: View {
    var symbol: String? = nil
    var count: Int? = nil

    var body: some View {
        ZStack {
            Circle().fill(Color.white.opacity(0.14))
            if let symbol {
                Image(systemName: symbol).font(.system(size: 14, weight: .bold))
            } else if let count {
                Text("\(count)").font(.system(size: 16, weight: .heavy)).monospacedDigit()
            }
        }
        .foregroundStyle(.white)
        .frame(width: 34, height: 34)
    }
}

/// Bottom of the study island: the big countdown, centred, over the block bar.
struct CanvasProStudyIslandBottom: View {
    let state: CanvasProStudyActivity.ContentState

    var body: some View {
        VStack(spacing: 8) {
            CanvasProStudyClock(state: state, size: 34, weight: .bold, alignment: .center)
                .frame(maxWidth: .infinity)
            CanvasProStudyBar(state: state).padding(.horizontal, 6)
            if !state.detail.isEmpty {
                Text(state.detail)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(.white.opacity(0.65))
                    .lineLimit(1).minimumScaleFactor(0.9)
            }
        }
        .frame(maxWidth: .infinity)
    }
}

/// Bottom of the tonight island: what's left, centred, and the next deadline.
struct CanvasProTonightIslandBottom: View {
    let state: CanvasProTonightActivity.ContentState

    var body: some View {
        VStack(spacing: 5) {
            if state.items.isEmpty {
                Text("Everything due tonight is done.")
                    .font(.system(size: 13, weight: .bold)).foregroundStyle(.white)
            } else {
                ForEach(state.items.prefix(2), id: \.self) { item in
                    Text("\(item.name) · \(CanvasProWidgetFormat.time(item.due))")
                        .font(.system(size: 13, weight: .bold)).monospacedDigit()
                        .foregroundStyle(.white)
                        .lineLimit(1).minimumScaleFactor(0.85)
                }
                if let next = state.items.first?.due {
                    HStack(spacing: 4) {
                        Text("Next due in").font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(.white.opacity(0.65))
                        CanvasProTonightCountdown(due: next, size: 11, weight: .bold, alignment: .leading)
                            .fixedSize()
                    }
                    .padding(.top, 2)
                }
            }
        }
        .multilineTextAlignment(.center)
        .frame(maxWidth: .infinity)
    }
}

extension CanvasProStudyActivity.ContentState {
    /// A focus block twelve minutes in, for the screenshot gallery.
    static func sample(now: Date = Date()) -> Self {
        Self(title: "Lab report", detail: "BIO 110 · 1 of 2", phase: "Focus", step: "Focus block 2 of 4", running: true, blockStart: now.addingTimeInterval(-12 * 60), blockEnd: now.addingTimeInterval(13 * 60), remaining: 13 * 60, total: 25 * 60, finished: false)
    }
}

extension CanvasProTonightActivity.ContentState {
    static func sample(now: Date = Date()) -> Self {
        let midnight = Calendar.current.date(byAdding: .day, value: 1, to: Calendar.current.startOfDay(for: now)) ?? now
        return Self(items: [
            .init(name: "Reading quiz", course: "PSY 101", due: midnight.addingTimeInterval(-120)),
            .init(name: "Lab report", course: "BIO 110", due: midnight.addingTimeInterval(-60)),
        ], remaining: 2, done: 1)
    }
}

// MARK: - Siri, Shortcuts, Control Center and widget buttons
//
// These intents are compiled into the app and the widget extension. Anything
// that needs the student's sign-in runs in the app: the app registers the
// handlers in `CanvasProIntentBridge` when it launches.

/// Work the app does on behalf of an intent. Set by the app at launch; empty in
/// the widget extension.
@MainActor
enum CanvasProIntentBridge {
    /// Opens a page in the app ("/pomodoro", "/assignments").
    static var open: (@MainActor (String) -> Void)?
    /// Saves completions made from a widget to the account.
    static var saveCompletions: (@MainActor () async -> Void)?
}

extension CanvasProWorkloadRange: AppEnum {
    static let typeDisplayRepresentation: TypeDisplayRepresentation = "Range"
    static let caseDisplayRepresentations: [CanvasProWorkloadRange: DisplayRepresentation] = [
        .tonight: DisplayRepresentation(title: "tonight", synonyms: ["today", "by tonight", "by midnight", "tonight at midnight", "later today", "this evening", "right now", "soon"]),
        .twoDays: DisplayRepresentation(title: "in the next 2 days", synonyms: ["in 2 days", "in two days", "in the next two days", "in the next couple days", "in the next couple of days", "by tomorrow", "tomorrow", "by tomorrow night", "tonight and tomorrow", "the next 48 hours"]),
        .week: DisplayRepresentation(title: "this week", synonyms: ["in the next week", "for the week", "this coming week", "in the next 7 days", "in the next seven days", "over the next week", "next week", "before the weekend", "all week"]),
    ]
}

/// "What's due tonight in CanvasPro?" Answers from the last sync, without
/// opening the app.
struct CanvasProWhatsDue: AppIntent {
    static let title: LocalizedStringResource = "What's Due"
    static let description = IntentDescription("Tells you what's due tonight, in the next 2 days, or this week.")

    @Parameter(title: "When", default: .tonight) var range: CanvasProWorkloadRange

    init() {}

    func perform() async throws -> some IntentResult & ProvidesDialog & ShowsSnippetView {
        let now = Date()
        let snapshot = CanvasProWidgetStore.load().flatMap { $0.signedIn ? $0 : nil }
        let dialog: String
        if let snapshot {
            let work = snapshot.workload(range, at: now)
            if work.remaining.isEmpty {
                dialog = work.done > 0 ? "You're all done \(range.phrase). \(work.done) finished." : "Nothing due \(range.phrase)."
            } else {
                let names = work.remaining.prefix(3).map { "\($0.name), \(CanvasProWidgetFormat.due($0.due, now: now))" }
                let more = work.remaining.count > 3 ? ", and \(work.remaining.count - 3) more" : ""
                let count = work.remaining.count == 1 ? "1 assignment" : "\(work.remaining.count) assignments"
                dialog = "You have \(count) due \(range.phrase): \(names.joined(separator: "; "))\(more)."
            }
        } else {
            dialog = "Open CanvasPro and sign in first."
        }
        return .result(dialog: IntentDialog(stringLiteral: dialog), view: CanvasProDueSnippet(snapshot: snapshot, date: now, range: range))
    }
}

/// What's Due under Siri's answer: the medium widget, without its buttons.
private struct CanvasProDueSnippet: View {
    let snapshot: CanvasProWidgetSnapshot?
    let date: Date
    let range: CanvasProWorkloadRange

    var body: some View {
        if let snapshot {
            CanvasProDueSoonView(snapshot: snapshot, date: date, family: .systemMedium, range: range, interactive: false)
                .padding(16)
                .frame(height: 170)
        }
    }
}

/// "What's my average in CanvasPro?" Respects "Hide grades until tapped".
struct CanvasProGradeAverage: AppIntent {
    static let title: LocalizedStringResource = "Grade Average"
    static let description = IntentDescription("Tells you your current average across your classes.")

    init() {}

    func perform() async throws -> some IntentResult & ProvidesDialog {
        let dialog: String
        if let snapshot = CanvasProWidgetStore.load(), snapshot.signedIn {
            if snapshot.hideGrades {
                dialog = "Your grades are hidden. Open CanvasPro to see them."
            } else if let average = snapshot.average {
                let classes = snapshot.scoredCourses.count
                let letter = CanvasProWidgetFormat.letter(average).replacingOccurrences(of: "−", with: " minus")
                dialog = "Your average is \(CanvasProWidgetFormat.score(average)) percent, a \(letter), across \(classes) \(classes == 1 ? "class" : "classes")."
            } else {
                dialog = "No grades yet."
            }
        } else {
            dialog = "Open CanvasPro and sign in first."
        }
        return .result(dialog: IntentDialog(stringLiteral: dialog))
    }
}

/// Opens Study Session and starts a Pomodoro. Used by Siri, Control Center and
/// the Action button.
struct CanvasProStartFocus: AppIntent {
    static let title: LocalizedStringResource = "Start Focus Session"
    static let description = IntentDescription("Opens CanvasPro and starts a Pomodoro focus session.")
    static let openAppWhenRun = true

    init() {}

    @MainActor
    func perform() async throws -> some IntentResult {
        CanvasProIntentBridge.open?("/pomodoro")
        return .result()
    }
}

/// Opens the assignment list. Used by Control Center and the Action button.
struct CanvasProOpenWhatsDue: AppIntent {
    static let title: LocalizedStringResource = "Open What's Due"
    static let description = IntentDescription("Opens your assignments in CanvasPro.")
    static let openAppWhenRun = true

    init() {}

    @MainActor
    func perform() async throws -> some IntentResult {
        CanvasProIntentBridge.open?("/assignments")
        return .result()
    }
}

/// The circle beside an assignment on What's Due. A Live Activity intent, so iOS
/// runs it in the app (which holds the sign-in) even when tapped on a widget.
/// The widget updates at once; the app saves it to the account.
struct CanvasProCompleteAssignment: LiveActivityIntent {
    static let title: LocalizedStringResource = "Mark Assignment Done"
    static let isDiscoverable = false

    @Parameter(title: "Assignment") var assignmentID: Int
    @Parameter(title: "Due") var due: Date

    init() {}
    init(_ item: CanvasProWidgetSnapshot.Assignment) {
        assignmentID = item.id
        due = item.due
    }

    @MainActor
    func perform() async throws -> some IntentResult {
        CanvasProWidgetStore.markDone(assignmentID, due: due)
        await CanvasProIntentBridge.saveCompletions?()
        return .result()
    }
}
