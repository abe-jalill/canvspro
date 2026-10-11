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
}

// MARK: - Style

/// The website's palettes, tuned for widgets: a deep tinted gradient, quiet
/// text, and the palette color kept for rings and the selected range.
struct CanvasProWidgetPalette {
    let hue: Double
    let saturation: Double

    init(_ name: String) {
        switch name {
        case "blue": hue = 214; saturation = 0.58
        case "violet": hue = 266; saturation = 0.48
        case "rose": hue = 340; saturation = 0.45
        default: hue = 148; saturation = 0.34
        }
    }

    func background(_ scheme: ColorScheme) -> LinearGradient {
        let colors = scheme == .dark
            ? [Self.hsl(hue, 0.20, 0.135), Self.hsl(hue, 0.26, 0.065)]
            : [Self.hsl(hue, 0.22, 0.985), Self.hsl(hue, 0.20, 0.935)]
        return LinearGradient(colors: colors, startPoint: .topLeading, endPoint: .bottomTrailing)
    }
    func foreground(_ scheme: ColorScheme) -> Color {
        scheme == .dark ? Self.hsl(hue, 0.12, 0.95) : Self.hsl(hue, 0.28, 0.13)
    }
    func muted(_ scheme: ColorScheme) -> Color {
        scheme == .dark ? Self.hsl(hue, 0.08, 0.62) : Self.hsl(hue, 0.12, 0.42)
    }
    func faint(_ scheme: ColorScheme) -> Color {
        foreground(scheme).opacity(scheme == .dark ? 0.09 : 0.07)
    }
    func accent(_ scheme: ColorScheme) -> Color {
        Self.hsl(hue, saturation + 0.12, scheme == .dark ? 0.70 : 0.38)
    }
    static func overdue(_ scheme: ColorScheme) -> Color {
        scheme == .dark ? hsl(351, 0.80, 0.72) : hsl(347, 0.65, 0.50)
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
        Text(text).font(.system(size: 9.5, weight: .semibold)).tracking(1.1).foregroundStyle(color).lineLimit(1)
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
            Circle().trim(from: 0, to: 0.75 * max(0.002, min(1, progress)))
                .stroke(color, style: StrokeStyle(lineWidth: lineWidth, lineCap: .round))
                .rotationEffect(.degrees(135))
                .widgetAccentable()
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

    private var palette: CanvasProWidgetPalette { CanvasProWidgetPalette(snapshot.palette) }
    private var fg: Color { palette.foreground(scheme) }
    private var muted: Color { palette.muted(scheme) }
    private var faint: Color { palette.faint(scheme) }
    private var accent: Color { palette.accent(scheme) }
    private var work: CanvasProWidgetSnapshot.Workload { snapshot.workload(range, at: date) }

    var body: some View {
        if !snapshot.signedIn && !family.isAccessory {
            CanvasProSignedOutView(palette: palette, symbol: "checklist", line: "Sign in to see what's due")
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
                Text("\(work.remaining.count)").font(.system(size: countSize, weight: .light)).monospacedDigit().foregroundStyle(fg)
                Text("left").font(.system(size: 8.5, weight: .medium)).foregroundStyle(muted)
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
                Button(intent: CanvasProSetWorkloadRange(option)) {
                    Text(option.title)
                        .font(.system(size: 9.5, weight: .semibold))
                        .foregroundStyle(option == range ? fg : muted)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 4)
                        .background {
                            if option == range { Capsule().fill(fg.opacity(scheme == .dark ? 0.12 : 0.08)) }
                        }
                        .contentShape(Capsule())
                }
                .buttonStyle(.plain)
            }
        }
        .padding(2)
        .background(Capsule().strokeBorder(fg.opacity(0.08), lineWidth: 0.5))
    }

    private func row(_ item: CanvasProWidgetSnapshot.Assignment) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 8) {
            Circle().fill(accent).frame(width: 4, height: 4).offset(y: -2).widgetAccentable()
            VStack(alignment: .leading, spacing: 1) {
                Text(item.name).font(.system(size: 12, weight: .medium)).foregroundStyle(fg).lineLimit(1)
                Text(item.course).font(.system(size: 10)).foregroundStyle(muted).lineLimit(1)
            }
            Spacer(minLength: 6)
            Text(CanvasProWidgetFormat.due(item.due, now: date))
                .font(.system(size: 10, weight: .medium)).monospacedDigit()
                .foregroundStyle(muted).lineLimit(1)
        }
    }

    private func list(limit: Int) -> some View {
        let items = Array(work.remaining.prefix(limit))
        return VStack(alignment: .leading, spacing: 0) {
            if items.isEmpty {
                Spacer(minLength: 0)
                Label(range.emptyLine, systemImage: "checkmark.circle")
                    .font(.system(size: 11, weight: .medium)).foregroundStyle(muted)
                Spacer(minLength: 0)
            } else {
                ForEach(Array(items.enumerated()), id: \.element.id) { index, item in
                    row(item)
                    if index < items.count - 1 {
                        Rectangle().fill(faint).frame(height: 0.5).padding(.vertical, 6).padding(.leading, 12)
                    }
                }
                if work.remaining.count > limit {
                    Text("+\(work.remaining.count - limit) more").font(.system(size: 9.5, weight: .medium)).foregroundStyle(muted)
                        .padding(.top, 6).padding(.leading, 12)
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
                    Text(work.remaining.count == 1 ? "assignment" : "assignments").font(.system(size: 11, weight: .medium)).foregroundStyle(fg)
                    Text(doneLine).font(.system(size: 10)).foregroundStyle(muted)
                }
            }
            Spacer(minLength: 0)
            if let next = work.remaining.first {
                Text(next.name).font(.system(size: 11.5, weight: .medium)).foregroundStyle(fg).lineLimit(1)
                Text("\(CanvasProWidgetFormat.due(next.due, now: date)) · \(next.course)").font(.system(size: 9.5)).monospacedDigit().foregroundStyle(muted).lineLimit(1)
            } else {
                Text(range.emptyLine).font(.system(size: 10.5, weight: .medium)).foregroundStyle(muted).lineLimit(2)
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
                    Text(doneLine).font(.system(size: 9.5)).foregroundStyle(muted).lineLimit(1)
                }
                .frame(width: 74)
                list(limit: 3)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }

    private var large: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 10) {
                CanvasProCaption(text: "WHAT'S DUE", color: muted)
                Spacer(minLength: 8)
                rangePicker.frame(width: 180)
            }
            HStack(alignment: .center, spacing: 16) {
                ring(size: 66, countSize: 22)
                VStack(alignment: .leading, spacing: 3) {
                    Text("\(work.remaining.count) \(work.remaining.count == 1 ? "assignment" : "assignments") \(range.phrase)")
                        .font(.system(size: 12.5, weight: .medium)).foregroundStyle(fg).lineLimit(1)
                    Text(doneLine).font(.system(size: 10.5)).foregroundStyle(muted)
                    if snapshot.overdueCount > 0 {
                        Text("\(snapshot.overdueCount) to catch up").font(.system(size: 10.5, weight: .medium)).foregroundStyle(CanvasProWidgetPalette.overdue(scheme))
                    }
                }
                Spacer(minLength: 0)
            }
            weekStrip
            Rectangle().fill(faint).frame(height: 0.5)
            list(limit: 5)
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
        .frame(height: 44, alignment: .bottom)
    }

    private func dayBar(_ entry: CanvasProWidgetSnapshot.DayLoad, peak: Int, inside: Bool) -> some View {
        let isToday = Calendar.current.isDate(entry.day, inSameDayAs: date)
        let height: CGFloat = entry.count == 0 ? 4 : 6 + 22 * CGFloat(entry.count) / CGFloat(peak)
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
        .accessibilityLabel(snapshot.signedIn ? "\(work.remaining.count) left \(range.phrase)" : "Sign in to CanvasPro")
    }

    private var rectangular: some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(snapshot.signedIn ? "\(range.title) · \(work.remaining.count) left" : "CanvasPro")
                .font(.system(size: 11, weight: .semibold)).widgetAccentable()
            if let next = work.remaining.first {
                Text(next.name).font(.system(size: 13, weight: .medium)).lineLimit(1)
                Text(CanvasProWidgetFormat.due(next.due, now: date)).font(.system(size: 11)).monospacedDigit().lineLimit(1)
            } else {
                Text(snapshot.signedIn ? range.emptyLine : "Sign in to see what's due").font(.system(size: 12, weight: .medium)).lineLimit(2)
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
            CanvasProSignedOutView(palette: palette, symbol: "chart.bar", line: "Sign in to see your grades")
        } else {
            switch family {
            case .accessoryCircular: circular
            case .accessoryRectangular: rectangular
            case .accessoryInline: inline
            case .systemSmall: small
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
                    Image(systemName: "eye.slash").font(.system(size: valueSize * 0.7, weight: .light)).foregroundStyle(muted)
                } else {
                    HStack(alignment: .firstTextBaseline, spacing: 1) {
                        Text(average.map(CanvasProWidgetFormat.score) ?? "—").font(.system(size: valueSize, weight: .light)).monospacedDigit().foregroundStyle(fg)
                        if average != nil { Text("%").font(.system(size: valueSize * 0.45, weight: .medium)).foregroundStyle(muted) }
                    }
                    .privacySensitive()
                }
                Text(hidden ? "HIDDEN" : CanvasProWidgetFormat.letter(average))
                    .font(.system(size: 9, weight: .semibold)).tracking(0.8)
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
            Text(classCount).font(.system(size: 10)).foregroundStyle(muted)
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
                Text(classCount).font(.system(size: 10)).foregroundStyle(muted)
            }
            .frame(width: 96, alignment: .leading)
            VStack(alignment: .leading, spacing: 9) {
                CanvasProCaption(text: "CLASSES", color: muted)
                if snapshot.courses.isEmpty {
                    Text("No classes yet").font(.system(size: 11, weight: .medium)).foregroundStyle(muted)
                }
                ForEach(snapshot.courses.prefix(4)) { course in courseRow(course) }
                Spacer(minLength: 0)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }

    private func courseRow(_ course: CanvasProWidgetSnapshot.Course) -> some View {
        let fraction = hidden ? 0 : min(1, max(0, (course.score ?? 0) / 100))
        return VStack(alignment: .leading, spacing: 4) {
            HStack(alignment: .firstTextBaseline) {
                Text(course.name).font(.system(size: 11, weight: .medium)).foregroundStyle(fg).lineLimit(1)
                Spacer(minLength: 6)
                Text(hidden ? "••" : course.score.map(CanvasProWidgetFormat.score) ?? "—")
                    .font(.system(size: 10.5, weight: .medium)).monospacedDigit().foregroundStyle(muted)
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
            Text("Average").font(.system(size: 11, weight: .semibold)).widgetAccentable()
            Text(hidden || !snapshot.signedIn ? "Hidden" : average.map { "\(CanvasProWidgetFormat.score($0))% · \(CanvasProWidgetFormat.letter($0))" } ?? "No grades yet")
                .font(.system(size: 15, weight: .medium)).monospacedDigit().privacySensitive()
            Text(classCount).font(.system(size: 11))
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
            CanvasProSignedOutView(palette: palette, symbol: "calendar", line: "Sign in to see your classes")
        } else {
            switch family {
            case .accessoryRectangular: rectangular
            case .accessoryInline: inline
            default: home
            }
        }
    }

    private func isNow(_ session: CanvasProWidgetSnapshot.Session) -> Bool { session.start <= date }

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
                    .font(.system(size: 11, weight: .medium)).foregroundStyle(muted)
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
            Text(session.meeting.name).font(.system(size: 14, weight: .semibold)).foregroundStyle(fg).lineLimit(2)
            if !session.meeting.location.isEmpty {
                Text(session.meeting.location).font(.system(size: 10.5)).foregroundStyle(muted).lineLimit(1).padding(.top, 2)
            }
            Spacer(minLength: 0)
            if isNow(session) {
                ProgressView(timerInterval: session.start...session.end, countsDown: false) {
                    EmptyView()
                } currentValueLabel: {
                    EmptyView()
                }
                .progressViewStyle(.linear)
                .tint(accent)
                .labelsHidden()
                (Text("Ends ") + Text(session.end, style: .relative))
                    .font(.system(size: 9.5)).monospacedDigit().foregroundStyle(muted).lineLimit(1).padding(.top, 4)
            } else {
                Text("\(CanvasProWidgetFormat.time(session.start)) – \(CanvasProWidgetFormat.time(session.end))")
                    .font(.system(size: 10.5, weight: .medium)).monospacedDigit().foregroundStyle(fg.opacity(0.85)).lineLimit(1)
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
                Text(item.meeting.name).font(.system(size: 11, weight: current ? .semibold : .medium)).foregroundStyle(past ? muted : fg).lineLimit(1)
                Text(CanvasProWidgetFormat.time(item.start)).font(.system(size: 9.5)).monospacedDigit().foregroundStyle(muted)
            }
            .padding(.bottom, 7)
        }
    }

    @ViewBuilder private var rectangular: some View {
        if snapshot.signedIn, let session {
            VStack(alignment: .leading, spacing: 1) {
                Text(isNow(session) ? "In class" : "\(CanvasProWidgetFormat.day(session.start, now: date)) · \(CanvasProWidgetFormat.time(session.start))")
                    .font(.system(size: 11, weight: .semibold)).widgetAccentable()
                Text(session.meeting.name).font(.system(size: 13, weight: .medium)).lineLimit(1)
                if !session.meeting.location.isEmpty { Text(session.meeting.location).font(.system(size: 11)).lineLimit(1) }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        } else {
            VStack(alignment: .leading, spacing: 1) {
                Text("Classes").font(.system(size: 11, weight: .semibold)).widgetAccentable()
                Text(snapshot.signedIn ? "No classes ahead" : "Sign in to CanvasPro").font(.system(size: 13, weight: .medium))
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
            Image(systemName: symbol).font(.system(size: 18, weight: .light)).foregroundStyle(palette.accent(scheme)).widgetAccentable()
            Text(line).font(.system(size: 11, weight: .medium)).foregroundStyle(palette.foreground(scheme)).lineLimit(2).padding(.top, 8)
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
                Assignment(id: 1, name: "Lab report", course: "BIO 110", due: tonight, done: false),
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
                ClassMeeting(id: "3", name: "Intro to Psychology", location: "Hall B", weekdays: [weekday, tomorrow], startMinutes: min(current + 150, 23 * 60), endMinutes: min(current + 200, 23 * 60 + 59)),
                ClassMeeting(id: "4", name: "Calculus II", location: "Math 310", weekdays: [tomorrow], startMinutes: 9 * 60, endMinutes: 10 * 60 + 15),
            ],
            courses: [
                Course(id: 1, name: "Biology", score: 94.2, letter: "A"),
                Course(id: 2, name: "College Writing", score: 89.1, letter: "B+"),
                Course(id: 3, name: "Calculus II", score: 82.4, letter: "B−"),
                Course(id: 4, name: "Data Structures", score: 91.6, letter: "A−"),
            ],
            hideGrades: false
        )
    }
}
