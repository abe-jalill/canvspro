import ActivityKit
import SwiftUI
import WidgetKit

@main
struct CanvasProWidgets: WidgetBundle {
    var body: some Widget {
        CanvasProTodayWidget()
        CanvasProTodoWidget()
        CanvasProDueSoonWidget()
        CanvasProGradesWidget()
        CanvasProStudyLiveActivity()
        CanvasProTonightLiveActivity()
        if #available(iOS 18.0, *) {
            CanvasProFocusControl()
            CanvasProWhatsDueControl()
        }
    }
}

// MARK: - Controls (Control Center, Lock Screen, Action button)

@available(iOS 18.0, *)
struct CanvasProFocusControl: ControlWidget {
    var body: some ControlWidgetConfiguration {
        StaticControlConfiguration(kind: "CanvasProFocusControl") {
            ControlWidgetButton(action: CanvasProStartFocus()) {
                Label("Start Focus", systemImage: "timer")
            }
        }
        .displayName("Start Focus")
        .description("Starts a Pomodoro focus session in CoursePro.")
    }
}

@available(iOS 18.0, *)
struct CanvasProWhatsDueControl: ControlWidget {
    var body: some ControlWidgetConfiguration {
        StaticControlConfiguration(kind: "CanvasProWhatsDueControl") {
            ControlWidgetButton(action: CanvasProOpenWhatsDue()) {
                Label("What's Due", systemImage: "checklist")
            }
        }
        .displayName("What's Due")
        .description("Opens your assignments in CoursePro.")
    }
}

// MARK: - Live Activities

struct CanvasProStudyLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: CanvasProStudyActivity.self) { context in
            CanvasProStudyLockView(state: context.state, stale: context.isStale)
                .activityBackgroundTint(Color.black.opacity(0.82))
                .activitySystemActionForegroundColor(.white)
                .widgetURL(URL(string: "canvaspro://study-session"))
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    CanvasProLogoMark(size: 34).padding(.leading, 4)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    CanvasProIslandBadge(symbol: context.state.finished || context.isStale ? "checkmark" : context.state.running ? "timer" : "pause.fill")
                        .padding(.trailing, 4)
                }
                DynamicIslandExpandedRegion(.center) {
                    CanvasProIslandHeading(caption: CanvasProStudyLockView.caption(context.state, stale: context.isStale), title: context.state.title, detail: context.state.detail)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    CanvasProStudyIslandBottom(state: context.state, stale: context.isStale).padding(.top, 4)
                }
            } compactLeading: {
                // Bold like the expanded view; the compact pill is read at a glance.
                Image(systemName: context.state.finished || context.isStale ? "checkmark" : context.state.running ? "timer" : "pause.fill")
                    .font(.system(size: 13, weight: .bold)).foregroundStyle(.white)
            } compactTrailing: {
                CanvasProStudyClock(state: context.state, size: 14, weight: .bold, stale: context.isStale)
            } minimal: {
                Image(systemName: context.state.finished || context.isStale ? "checkmark" : context.state.running ? "timer" : "pause.fill")
                    .font(.system(size: 12, weight: .bold)).foregroundStyle(.white)
            }
            .widgetURL(URL(string: "canvaspro://study-session"))
            .keylineTint(.white)
        }
    }
}

struct CanvasProTonightLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: CanvasProTonightActivity.self) { context in
            CanvasProTonightLockView(state: context.state, stale: context.isStale)
                .activityBackgroundTint(Color.black.opacity(0.82))
                .activitySystemActionForegroundColor(.white)
                .widgetURL(URL(string: "canvaspro://assignments"))
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    CanvasProLogoMark(size: 34).padding(.leading, 4)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Group {
                        if context.isStale { CanvasProIslandBadge(symbol: "checkmark") } else { CanvasProIslandBadge(count: context.state.remaining) }
                    }
                    .padding(.trailing, 4)
                }
                DynamicIslandExpandedRegion(.center) {
                    CanvasProIslandHeading(
                        caption: "DUE TONIGHT",
                        title: context.isStale ? "Tonight's over" : context.state.remaining == 0 ? "All done" : "\(context.state.remaining) left · \(context.state.done) done"
                    )
                }
                DynamicIslandExpandedRegion(.bottom) {
                    CanvasProTonightIslandBottom(state: context.state, stale: context.isStale).padding(.top, 4)
                }
            } compactLeading: {
                Image(systemName: "checklist").font(.system(size: 13, weight: .bold)).foregroundStyle(.white)
            } compactTrailing: {
                if context.isStale {
                    Image(systemName: "checkmark").font(.system(size: 13, weight: .bold)).foregroundStyle(.white)
                } else {
                    Text("\(context.state.remaining)").font(.system(size: 14, weight: .bold)).monospacedDigit().foregroundStyle(.white)
                }
            } minimal: {
                if context.isStale {
                    Image(systemName: "checkmark").font(.system(size: 12, weight: .bold)).foregroundStyle(.white)
                } else {
                    Text("\(context.state.remaining)").font(.system(size: 13, weight: .bold)).monospacedDigit().foregroundStyle(.white)
                }
            }
            .widgetURL(URL(string: "canvaspro://assignments"))
            .keylineTint(.white)
        }
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
        // The Today widget's greeting changes at noon and 6 PM.
        for hour in [12, 18] {
            if let turn = calendar.date(bySettingHour: hour, minute: 0, second: 0, of: now) { moments.insert(turn) }
        }
        for item in snapshot.assignments where item.due > now && item.due < horizon {
            moments.insert(item.due.addingTimeInterval(1))
        }
        for item in snapshot.todo ?? [] where item.due > now && item.due < horizon {
            moments.insert(item.due.addingTimeInterval(1))
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
                ZStack {
                    CanvasProWidgetPalette(palette).background(scheme)
                    // A soft light from the top, for depth.
                    LinearGradient(colors: [Color.white.opacity(scheme == .dark ? 0.06 : 0.45), .clear], startPoint: .top, endPoint: .center)
                }
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

// MARK: - Today

struct CanvasProTodayWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: CanvasProWidgetStore.todayKind, provider: CanvasProProvider()) { entry in
            CanvasProTodayEntryView(entry: entry)
        }
        .configurationDisplayName("Today")
        .description("Your dashboard greeting with what's due today, this week and overdue.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}

private struct CanvasProTodayEntryView: View {
    @Environment(\.widgetFamily) private var family
    let entry: CanvasProEntry

    var body: some View {
        CanvasProTodayView(snapshot: entry.snapshot, date: entry.date, family: family)
            .widgetURL(URL(string: "canvaspro://dashboard"))
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
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge, .accessoryCircular, .accessoryRectangular, .accessoryInline])
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

// MARK: - To-Do

struct CanvasProTodoWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: CanvasProWidgetStore.todoKind, provider: CanvasProProvider()) { entry in
            CanvasProTodoEntryView(entry: entry)
        }
        .configurationDisplayName("To-Do")
        .description("What's left on To-Do today, with tomorrow on the large size. Tap a circle to tick it off.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge, .accessoryCircular, .accessoryRectangular, .accessoryInline])
    }
}

private struct CanvasProTodoEntryView: View {
    @Environment(\.widgetFamily) private var family
    let entry: CanvasProEntry

    var body: some View {
        CanvasProTodoView(snapshot: entry.snapshot, date: entry.date, family: family)
            .widgetURL(URL(string: "canvaspro://todo"))
            .modifier(CanvasProWidgetBackground(palette: entry.snapshot.palette))
    }
}
