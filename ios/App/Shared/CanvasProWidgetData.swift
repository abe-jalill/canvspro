import SwiftUI
import WidgetKit

// Shared by the app and the widget extension. The app writes a small snapshot of
// what's due and today's classes to the App Group after each sync; the widgets
// only read it, so they never sign in or reach Canvas themselves.

// MARK: - Snapshot

struct CanvasProWidgetSnapshot: Codable, Equatable {
    struct Assignment: Codable, Equatable, Identifiable {
        let id: Int
        let name: String
        let course: String
        let due: Date
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
    /// Unfinished work with a due date, soonest first.
    var assignments: [Assignment]
    /// Unfinished work already past due that is still worth catching up on.
    var overdueCount: Int
    var classes: [ClassMeeting]

    static let signedOut = CanvasProWidgetSnapshot(signedIn: false, palette: "forest", syncedAt: nil, assignments: [], overdueCount: 0, classes: [])

    func upcoming(at date: Date) -> [Assignment] {
        assignments.filter { $0.due > date }
    }

    func dueToday(at date: Date, calendar: Calendar = .current) -> [Assignment] {
        upcoming(at: date).filter { calendar.isDate($0.due, inSameDayAs: date) }
    }

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

// MARK: - Storage

enum CanvasProWidgetStore {
    static let appGroup = "group.app.canvaspro.mobile"
    static let dueSoonKind = "CanvasProDueSoon"
    static let nextClassKind = "CanvasProNextClass"
    private static let key = "CanvasProWidgetSnapshot"

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

    /// After sign-out the widgets must stop showing the previous student's work.
    static func clear() {
        save(.signedOut)
    }
}

// MARK: - Colors

/// The website's palettes, as on the app's themed screens.
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

    func background(_ scheme: ColorScheme) -> Color {
        scheme == .dark ? Self.hsl(hue, 0.24, 0.09) : Self.hsl(hue, 0.26, 0.96)
    }
    func foreground(_ scheme: ColorScheme) -> Color {
        scheme == .dark ? Self.hsl(hue, 0.10, 0.97) : Self.hsl(hue, 0.26, 0.12)
    }
    func muted(_ scheme: ColorScheme) -> Color {
        scheme == .dark ? Self.hsl(hue, 0.09, 0.67) : Self.hsl(hue, 0.14, 0.40)
    }
    func accent(_ scheme: ColorScheme) -> Color {
        Self.hsl(hue, saturation, scheme == .dark ? 0.72 : 0.32)
    }
    func line(_ scheme: ColorScheme) -> Color {
        foreground(scheme).opacity(0.10)
    }
    static func overdue(_ scheme: ColorScheme) -> Color {
        scheme == .dark ? hsl(351, 0.95, 0.71) : hsl(347, 0.77, 0.50)
    }

    private static func hsl(_ hue: Double, _ saturation: Double, _ lightness: Double) -> Color {
        let h = hue.truncatingRemainder(dividingBy: 360) / 60
        let c = (1 - abs(2 * lightness - 1)) * saturation
        let x = c * (1 - abs(h.truncatingRemainder(dividingBy: 2) - 1))
        let m = lightness - c / 2
        let rgb: (Double, Double, Double)
        switch h { case 0..<1: rgb = (c, x, 0); case 1..<2: rgb = (x, c, 0); case 2..<3: rgb = (0, c, x); case 3..<4: rgb = (0, x, c); case 4..<5: rgb = (x, 0, c); default: rgb = (c, 0, x) }
        return Color(.sRGB, red: rgb.0 + m, green: rgb.1 + m, blue: rgb.2 + m)
    }
}

// MARK: - Formatting

enum CanvasProWidgetFormat {
    /// "11:59 PM", "Tomorrow 9:00 AM", "Fri 5:00 PM", or "Oct 24".
    static func due(_ date: Date, now: Date, calendar: Calendar = .current) -> String {
        let time = date.formatted(date: .omitted, time: .shortened)
        if calendar.isDate(date, inSameDayAs: now) { return time }
        if let tomorrow = calendar.date(byAdding: .day, value: 1, to: now), calendar.isDate(date, inSameDayAs: tomorrow) { return "Tomorrow \(time)" }
        if date.timeIntervalSince(now) < 6 * 86_400 { return "\(date.formatted(.dateTime.weekday(.abbreviated))) \(time)" }
        return date.formatted(.dateTime.month(.abbreviated).day())
    }

    static func time(_ date: Date) -> String { date.formatted(date: .omitted, time: .shortened) }

    static func day(_ date: Date, now: Date, calendar: Calendar = .current) -> String {
        if calendar.isDate(date, inSameDayAs: now) { return "Today" }
        if let tomorrow = calendar.date(byAdding: .day, value: 1, to: now), calendar.isDate(date, inSameDayAs: tomorrow) { return "Tomorrow" }
        return date.formatted(.dateTime.weekday(.wide))
    }
}

// MARK: - Due Soon views

struct CanvasProDueSoonView: View {
    @Environment(\.colorScheme) private var scheme
    let snapshot: CanvasProWidgetSnapshot
    let date: Date
    let family: WidgetFamily

    private var palette: CanvasProWidgetPalette { CanvasProWidgetPalette(snapshot.palette) }
    private var upcoming: [CanvasProWidgetSnapshot.Assignment] { snapshot.upcoming(at: date) }

    var body: some View {
        switch family {
        case .accessoryCircular: circular
        case .accessoryRectangular: rectangular
        case .accessoryInline: inline
        default: home
        }
    }

    // Home screen

    private var rowLimit: Int {
        switch family {
        case .systemSmall: 1
        case .systemMedium: 3
        default: 6
        }
    }

    @ViewBuilder private var home: some View {
        if !snapshot.signedIn {
            CanvasProWidgetMessage(symbol: "person.crop.circle", title: "Sign in to CanvasPro", detail: "See what's due right here.", palette: palette)
        } else if family == .systemSmall {
            small
        } else {
            VStack(alignment: .leading, spacing: family == .systemLarge ? 10 : 7) {
                header
                if upcoming.isEmpty {
                    Spacer(minLength: 0)
                    Text("Nothing due. Enjoy the quiet.").font(.subheadline).foregroundStyle(palette.muted(scheme))
                    Spacer(minLength: 0)
                } else {
                    ForEach(upcoming.prefix(rowLimit)) { item in
                        Link(destination: URL(string: "canvaspro://assignments")!) { row(item) }
                        if item.id != upcoming.prefix(rowLimit).last?.id {
                            Rectangle().fill(palette.line(scheme)).frame(height: 0.5)
                        }
                    }
                    Spacer(minLength: 0)
                }
                if family == .systemLarge, snapshot.overdueCount > 0 {
                    Text("\(snapshot.overdueCount) to catch up")
                        .font(.caption.weight(.medium))
                        .foregroundStyle(CanvasProWidgetPalette.overdue(scheme))
                }
            }
        }
    }

    private var header: some View {
        HStack(alignment: .firstTextBaseline) {
            Text("Due soon").font(.caption.weight(.semibold)).foregroundStyle(palette.accent(scheme)).widgetAccentable()
            Spacer()
            let today = snapshot.dueToday(at: date).count
            Text(today == 0 ? "None today" : "\(today) today").font(.caption).foregroundStyle(palette.muted(scheme))
        }
    }

    private func row(_ item: CanvasProWidgetSnapshot.Assignment) -> some View {
        HStack(alignment: .center, spacing: 10) {
            Capsule().fill(palette.accent(scheme)).frame(width: 3, height: 28).widgetAccentable()
            VStack(alignment: .leading, spacing: 1) {
                Text(item.name).font(.subheadline.weight(.medium)).foregroundStyle(palette.foreground(scheme)).lineLimit(1)
                Text(item.course).font(.caption2).foregroundStyle(palette.muted(scheme)).lineLimit(1)
            }
            Spacer(minLength: 6)
            Text(CanvasProWidgetFormat.due(item.due, now: date))
                .font(.caption.weight(.medium)).monospacedDigit()
                .foregroundStyle(palette.foreground(scheme).opacity(0.8))
                .lineLimit(1)
        }
    }

    @ViewBuilder private var small: some View {
        VStack(alignment: .leading, spacing: 4) {
            header
            Spacer(minLength: 0)
            if let next = upcoming.first {
                Text(next.name).font(.headline).foregroundStyle(palette.foreground(scheme)).lineLimit(3).minimumScaleFactor(0.85)
                Text(next.course).font(.caption).foregroundStyle(palette.muted(scheme)).lineLimit(1)
                Text(CanvasProWidgetFormat.due(next.due, now: date))
                    .font(.caption.weight(.semibold)).monospacedDigit()
                    .foregroundStyle(palette.accent(scheme)).widgetAccentable()
                    .padding(.top, 2)
            } else {
                Text("Nothing due").font(.headline).foregroundStyle(palette.foreground(scheme))
                Text("Enjoy the quiet.").font(.caption).foregroundStyle(palette.muted(scheme))
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    }

    // Lock screen

    private var circular: some View {
        ZStack {
            AccessoryWidgetBackground()
            VStack(spacing: 0) {
                Text(snapshot.signedIn ? "\(snapshot.dueToday(at: date).count)" : "–").font(.title2.weight(.semibold)).monospacedDigit()
                Text("due").font(.caption2)
            }
        }
        .accessibilityLabel(snapshot.signedIn ? "\(snapshot.dueToday(at: date).count) due today" : "Sign in to CanvasPro")
    }

    @ViewBuilder private var rectangular: some View {
        if !snapshot.signedIn {
            Text("Sign in to CanvasPro").font(.headline)
        } else if let next = upcoming.first {
            VStack(alignment: .leading, spacing: 1) {
                Text(CanvasProWidgetFormat.due(next.due, now: date)).font(.caption.weight(.semibold)).widgetAccentable()
                Text(next.name).font(.headline).lineLimit(1)
                Text(next.course).font(.caption).lineLimit(1)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        } else {
            VStack(alignment: .leading, spacing: 1) {
                Text("CanvasPro").font(.caption.weight(.semibold)).widgetAccentable()
                Text("Nothing due").font(.headline)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private var inline: some View {
        if !snapshot.signedIn { return Text("CanvasPro") }
        if let next = upcoming.first { return Text("\(next.name) · \(CanvasProWidgetFormat.due(next.due, now: date))") }
        return Text("Nothing due")
    }
}

// MARK: - Next Class views

struct CanvasProNextClassView: View {
    @Environment(\.colorScheme) private var scheme
    let snapshot: CanvasProWidgetSnapshot
    let date: Date
    let family: WidgetFamily

    private var palette: CanvasProWidgetPalette { CanvasProWidgetPalette(snapshot.palette) }
    private var session: CanvasProWidgetSnapshot.Session? { snapshot.currentOrNextClass(at: date) }

    var body: some View {
        switch family {
        case .accessoryRectangular: rectangular
        case .accessoryInline: inline
        default: home
        }
    }

    private func status(_ session: CanvasProWidgetSnapshot.Session) -> String {
        if session.start <= date { return "Now · until \(CanvasProWidgetFormat.time(session.end))" }
        return "\(CanvasProWidgetFormat.day(session.start, now: date)) · \(CanvasProWidgetFormat.time(session.start))"
    }

    @ViewBuilder private var home: some View {
        if !snapshot.signedIn {
            CanvasProWidgetMessage(symbol: "person.crop.circle", title: "Sign in to CanvasPro", detail: "Your next class shows here.", palette: palette)
        } else if snapshot.classes.isEmpty {
            CanvasProWidgetMessage(symbol: "calendar", title: "No classes yet", detail: "Add your schedule in CanvasPro.", palette: palette)
        } else if let session {
            HStack(alignment: .top, spacing: 14) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(session.start <= date ? "Class now" : "Next class")
                        .font(.caption.weight(.semibold)).foregroundStyle(palette.accent(scheme)).widgetAccentable()
                    Spacer(minLength: 0)
                    Text(session.meeting.name).font(.headline).foregroundStyle(palette.foreground(scheme)).lineLimit(2).minimumScaleFactor(0.85)
                    if !session.meeting.location.isEmpty {
                        Label(session.meeting.location, systemImage: "mappin").font(.caption).foregroundStyle(palette.muted(scheme)).lineLimit(1)
                    }
                    Text(status(session)).font(.caption.weight(.semibold)).monospacedDigit().foregroundStyle(palette.foreground(scheme).opacity(0.85)).lineLimit(1)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
                if family != .systemSmall { laterToday(after: session) }
            }
        } else {
            CanvasProWidgetMessage(symbol: "calendar", title: "No classes this week", detail: "Enjoy the break.", palette: palette)
        }
    }

    /// The rest of that day's classes, beside the next one.
    private func laterToday(after session: CanvasProWidgetSnapshot.Session) -> some View {
        let later = snapshot.sessions(on: session.start).filter { $0.start > session.start }.prefix(3)
        return VStack(alignment: .leading, spacing: 8) {
            Text(later.isEmpty ? "Then" : "Later").font(.caption.weight(.semibold)).foregroundStyle(palette.muted(scheme))
            if later.isEmpty {
                Text("Nothing else \(CanvasProWidgetFormat.day(session.start, now: date).lowercased())").font(.caption).foregroundStyle(palette.muted(scheme))
            }
            ForEach(Array(later), id: \.start) { item in
                VStack(alignment: .leading, spacing: 1) {
                    Text(item.meeting.name).font(.caption.weight(.medium)).foregroundStyle(palette.foreground(scheme)).lineLimit(1)
                    Text(CanvasProWidgetFormat.time(item.start)).font(.caption2).monospacedDigit().foregroundStyle(palette.muted(scheme))
                }
            }
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .padding(.leading, 12)
        .overlay(alignment: .leading) { Rectangle().fill(palette.line(scheme)).frame(width: 0.5) }
    }

    @ViewBuilder private var rectangular: some View {
        if snapshot.signedIn, let session {
            VStack(alignment: .leading, spacing: 1) {
                Text(status(session)).font(.caption.weight(.semibold)).widgetAccentable()
                Text(session.meeting.name).font(.headline).lineLimit(1)
                if !session.meeting.location.isEmpty { Text(session.meeting.location).font(.caption).lineLimit(1) }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        } else {
            VStack(alignment: .leading, spacing: 1) {
                Text("CanvasPro").font(.caption.weight(.semibold)).widgetAccentable()
                Text(snapshot.signedIn ? "No classes ahead" : "Sign in to CanvasPro").font(.headline)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private var inline: some View {
        guard snapshot.signedIn, let session else { return Text("CanvasPro") }
        return Text("\(session.meeting.name) · \(session.start <= date ? "now" : CanvasProWidgetFormat.time(session.start))")
    }
}

// MARK: - Shared pieces

struct CanvasProWidgetMessage: View {
    @Environment(\.colorScheme) private var scheme
    let symbol: String
    let title: String
    let detail: String
    let palette: CanvasProWidgetPalette

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Image(systemName: symbol).font(.title3).foregroundStyle(palette.accent(scheme)).widgetAccentable()
            Spacer(minLength: 0)
            Text(title).font(.headline).foregroundStyle(palette.foreground(scheme)).lineLimit(2)
            Text(detail).font(.caption).foregroundStyle(palette.muted(scheme)).lineLimit(2)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    }
}

extension CanvasProWidgetSnapshot {
    /// Sample work for the widget gallery and placeholders.
    static func sample(now: Date = Date(), calendar: Calendar = .current) -> CanvasProWidgetSnapshot {
        let today = calendar.startOfDay(for: now)
        func at(_ day: Int, _ hour: Int, _ minute: Int) -> Date {
            calendar.date(byAdding: .minute, value: day * 1_440 + hour * 60 + minute, to: today) ?? now
        }
        let weekday = calendar.component(.weekday, from: now)
        let tomorrow = weekday % 7 + 1
        // The first class starts a little after "now", on the quarter hour.
        let nowMinutes = calendar.component(.hour, from: now) * 60 + calendar.component(.minute, from: now)
        let soon = min((nowMinutes + 44) / 15 * 15, 22 * 60)
        return CanvasProWidgetSnapshot(
            signedIn: true,
            palette: "forest",
            syncedAt: now,
            assignments: [
                Assignment(id: 1, name: "Lab report", course: "BIO 110", due: max(at(0, 23, 59), now.addingTimeInterval(3_600))),
                Assignment(id: 2, name: "Research outline", course: "ENG 102", due: at(1, 9, 0)),
                Assignment(id: 3, name: "Problem set 4", course: "MATH 210", due: at(2, 17, 0)),
                Assignment(id: 4, name: "Reading response", course: "PSY 101", due: at(3, 23, 59)),
                Assignment(id: 5, name: "Quiz 3", course: "CS 230", due: at(4, 10, 0)),
                Assignment(id: 6, name: "Final project proposal", course: "ENG 102", due: at(6, 23, 59)),
            ],
            overdueCount: 1,
            classes: [
                ClassMeeting(id: "1", name: "Data Structures", location: "Science 204", weekdays: [weekday], startMinutes: soon, endMinutes: soon + 75),
                ClassMeeting(id: "2", name: "College Writing", location: "Humanities 118", weekdays: [weekday], startMinutes: soon + 90, endMinutes: soon + 140),
                ClassMeeting(id: "3", name: "Intro to Psychology", location: "Hall B", weekdays: [weekday, tomorrow], startMinutes: min(soon + 150, 23 * 60), endMinutes: min(soon + 200, 23 * 60 + 59)),
                ClassMeeting(id: "4", name: "Calculus II", location: "Math 310", weekdays: [tomorrow], startMinutes: 9 * 60, endMinutes: 10 * 60 + 15),
            ]
        )
    }
}
