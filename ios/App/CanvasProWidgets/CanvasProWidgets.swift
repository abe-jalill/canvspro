import SwiftUI
import WidgetKit

@main
struct CanvasProWidgets: WidgetBundle {
    var body: some Widget {
        CanvasProDueSoonWidget()
        CanvasProGradesWidget()
        CanvasProNextClassWidget()
    }
}

// MARK: - Timeline

struct CanvasProEntry: TimelineEntry {
    let date: Date
    let snapshot: CanvasProWidgetSnapshot
    let range: CanvasProWorkloadRange
}

/// Reads the snapshot the app saved and plans redraws for the moments the
/// widgets change: when work comes due, when a class starts or ends, and at
/// midnight (so "Tomorrow" becomes "Today").
struct CanvasProProvider: TimelineProvider {
    func placeholder(in context: Context) -> CanvasProEntry {
        CanvasProEntry(date: Date(), snapshot: .sample(), range: .tonight)
    }

    func getSnapshot(in context: Context, completion: @escaping (CanvasProEntry) -> Void) {
        let now = Date()
        let saved = CanvasProWidgetStore.load()
        // The widget gallery shows sample work until the student has signed in.
        let snapshot: CanvasProWidgetSnapshot = context.isPreview && saved?.signedIn != true ? .sample(now: now) : (saved ?? .signedOut)
        completion(CanvasProEntry(date: now, snapshot: snapshot, range: CanvasProWidgetStore.workloadRange))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<CanvasProEntry>) -> Void) {
        let now = Date()
        let calendar = Calendar.current
        let snapshot = CanvasProWidgetStore.load() ?? .signedOut
        let range = CanvasProWidgetStore.workloadRange
        let horizon = now.addingTimeInterval(24 * 3_600)
        var moments: Set<Date> = [now]
        if let midnight = calendar.date(byAdding: .day, value: 1, to: calendar.startOfDay(for: now)) { moments.insert(midnight) }
        for item in snapshot.assignments where item.due > now && item.due < horizon {
            moments.insert(item.due.addingTimeInterval(1))
        }
        for offset in 0...1 {
            guard let day = calendar.date(byAdding: .day, value: offset, to: now) else { continue }
            for session in snapshot.sessions(on: day, calendar: calendar) {
                moments.insert(session.start)
                moments.insert(session.end)
            }
        }
        let entries = moments.filter { $0 >= now && $0 <= horizon }.sorted().map { CanvasProEntry(date: $0, snapshot: snapshot, range: range) }
        completion(Timeline(entries: entries, policy: .atEnd))
    }
}

/// Home screen widgets sit on the account's theme gradient; lock screen ones
/// stay clear so iOS can tint them.
private struct CanvasProWidgetBackground: ViewModifier {
    @Environment(\.widgetFamily) private var family
    @Environment(\.colorScheme) private var scheme
    let palette: String

    func body(content: Content) -> some View {
        content.containerBackground(for: .widget) {
            if family.isAccessory {
                Color.clear
            } else {
                CanvasProWidgetPalette(palette).background(scheme)
            }
        }
    }
}

// MARK: - What's Due

struct CanvasProDueSoonWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: CanvasProWidgetStore.dueSoonKind, provider: CanvasProProvider()) { entry in
            CanvasProDueSoonEntryView(entry: entry)
        }
        .configurationDisplayName("What's Due")
        .description("Work due tonight, in the next 2 days, or this week. Tap the range to switch.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge, .accessoryCircular, .accessoryRectangular, .accessoryInline])
    }
}

private struct CanvasProDueSoonEntryView: View {
    @Environment(\.widgetFamily) private var family
    let entry: CanvasProEntry

    var body: some View {
        CanvasProDueSoonView(snapshot: entry.snapshot, date: entry.date, family: family, range: entry.range)
            .widgetURL(URL(string: "canvaspro://assignments"))
            .modifier(CanvasProWidgetBackground(palette: entry.snapshot.palette))
    }
}

// MARK: - Grades

struct CanvasProGradesWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: CanvasProWidgetStore.gradesKind, provider: CanvasProProvider()) { entry in
            CanvasProGradesEntryView(entry: entry)
        }
        .configurationDisplayName("Grades")
        .description("Your average and each class at a glance. Hidden while your iPhone is locked.")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryCircular, .accessoryRectangular, .accessoryInline])
    }
}

private struct CanvasProGradesEntryView: View {
    @Environment(\.widgetFamily) private var family
    let entry: CanvasProEntry

    var body: some View {
        CanvasProGradesView(snapshot: entry.snapshot, family: family)
            .widgetURL(URL(string: "canvaspro://grades"))
            .modifier(CanvasProWidgetBackground(palette: entry.snapshot.palette))
    }
}

// MARK: - Next Class

struct CanvasProNextClassWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: CanvasProWidgetStore.nextClassKind, provider: CanvasProProvider()) { entry in
            CanvasProNextClassEntryView(entry: entry)
        }
        .configurationDisplayName("Next Class")
        .description("The class you're in, or the next one, and the rest of the day.")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular, .accessoryInline])
    }
}

private struct CanvasProNextClassEntryView: View {
    @Environment(\.widgetFamily) private var family
    let entry: CanvasProEntry

    var body: some View {
        CanvasProNextClassView(snapshot: entry.snapshot, date: entry.date, family: family)
            .widgetURL(URL(string: "canvaspro://dashboard"))
            .modifier(CanvasProWidgetBackground(palette: entry.snapshot.palette))
    }
}
