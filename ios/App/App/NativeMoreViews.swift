import SwiftUI
import UserNotifications

struct NativeMoreView: View {
    @Environment(\.colorScheme) private var scheme
    @ObservedObject var store: NativeContentStore
    @ObservedObject var features: NativeFeatureStore

    var body: some View {
        NavigationStack {
            ZStack {
                CPBackdrop()
                ScrollView {
                    VStack(spacing: 18) {
                        CPGlassCard {
                            link("Assignments", "checklist") { NativeAssignmentsView(store: store, features: features) }
                            link("Get It Done", "sparkles") { GetItDoneView(store: store, features: features) }
                            link("Calendar", "calendar") { CalendarView(store: store, features: features) }
                            link("Class Schedule", "calendar.badge.clock") { ClassScheduleView(features: features) }
                            link("Announcements", "megaphone") { AnnouncementsView(store: store, features: features) }
                        }
                        CPGlassCard {
                            link("Settings", "gearshape") { NativeSettingsView(contentStore: store, features: features) }
                        }
                    }
                    .padding(.horizontal, 14)
                    .padding(.top, 14)
                    .padding(.bottom, 28)
                }
            }
            .navigationTitle("More")
            .navigationBarTitleDisplayMode(.inline)
        }
    }

    private func link<Destination: View>(_ title: String, _ symbol: String, @ViewBuilder destination: () -> Destination) -> some View {
        NavigationLink(destination: destination()) {
            CPInsetRow {
                HStack(spacing: 12) {
                    Image(systemName: symbol).font(.system(size: 16)).frame(width: 24).foregroundStyle(CPTheme.primary(scheme: scheme))
                    Text(title).font(.system(size: 14, weight: .regular))
                    Spacer()
                    Image(systemName: "chevron.right").font(.system(size: 10)).foregroundStyle(CPTheme.muted(scheme))
                }
                .frame(minHeight: 32)
            }
        }
        .buttonStyle(.plain)
    }
}

struct NativeSettingsView: View {
    @Environment(\.colorScheme) private var scheme
    @ObservedObject var contentStore: NativeContentStore
    @ObservedObject var features: NativeFeatureStore

    var body: some View {
        ZStack {
            CPBackdrop()
            ScrollView {
                LazyVStack(spacing: 18) {
                    AppearanceSettingsCard()
                    CPGlassCard(title: "Classes") {
                        settingsLink("Announcement history", "clock.arrow.circlepath") { AnnouncementWindowSettingsView() }
                        settingsLink("Class names", "character.cursor.ibeam") { ClassNamesView(store: contentStore) }
                        settingsLink("Hidden classes", "eye.slash") { HiddenCoursesView(store: contentStore, features: features) }
                    }
                    CPGlassCard(title: "Legal") {
                        settingsLink("Privacy Policy", "hand.raised") { NativeLegalView(title: "Privacy Policy") }
                        settingsLink("Terms of Service", "doc.text") { NativeLegalView(title: "Terms of Service") }
                    }
                    Text("Preview uses sample data saved on this iPhone.")
                        .font(.system(size: 11))
                        .foregroundStyle(CPTheme.muted(scheme))
                        .frame(maxWidth: .infinity, alignment: .center)
                }
                .padding(.horizontal, 14)
                .padding(.top, 14)
                .padding(.bottom, 28)
            }
        }
        .navigationTitle("Settings")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func settingsLink<Destination: View>(_ title: String, _ symbol: String, @ViewBuilder destination: () -> Destination) -> some View {
        NavigationLink(destination: destination()) { CPInsetRow { HStack(spacing: 10) { Image(systemName: symbol).font(.system(size: 14)).frame(width: 20).foregroundStyle(CPTheme.primary(scheme: scheme)); Text(title).font(.system(size: 13, weight: .regular)); Spacer(); Image(systemName: "chevron.right").font(.system(size: 10, weight: .regular)).foregroundStyle(CPTheme.muted(scheme)) } } }.buttonStyle(.plain)
    }
}

private struct GetItDoneView: View {
    @Environment(\.colorScheme) private var scheme
    @ObservedObject var store: NativeContentStore
    @ObservedObject var features: NativeFeatureStore
    @AppStorage("CanvasProPlanWindow") private var window = 7
    @AppStorage("CanvasProPlanSkipped") private var skippedRaw = ""
    @AppStorage("CanvasProPlanOrder") private var orderRaw = ""
    @AppStorage("CanvasProPlanDate") private var planDate = ""
    @State private var choiceOffset = 0
    @State private var editingEstimate: Int?
    @State private var estimateMinutes = 30
    private var skipped: Set<Int> { Set(skippedRaw.split(separator: ",").compactMap { Int($0) }) }
    private var manualOrder: [Int] { orderRaw.split(separator: ",").compactMap { Int($0) } }
    private var allAssignments: [AssignmentItem] {
        store.bundle.assignments + features.customAssignments.map { item in AssignmentItem.custom(item, course: store.bundle.courses.first { $0.id == item.courseID }) }
    }
    private var visibleAssignments: [AssignmentItem] {
        let end = NativeParity.endOfUpcomingDay(window)
        return allAssignments.filter { item in
            guard !features.hiddenCourseIDs.contains(item.courseID), let due = item.dueDate else { return false }
            return due >= Date() && due <= end
        }
    }
    private var candidates: [AssignmentItem] {
        visibleAssignments.filter { $0.isVisible(in: store) && !skipped.contains($0.id) }
            .sorted { score($0) > score($1) }
    }
    private var recommendation: AssignmentItem? { candidates.isEmpty ? nil : candidates[choiceOffset % candidates.count] }
    private var plan: [AssignmentItem] {
        let ordered = candidates.sorted { lhs, rhs in
            let left = manualOrder.firstIndex(of: lhs.id)
            let right = manualOrder.firstIndex(of: rhs.id)
            if let left, let right { return left < right }
            if left != nil { return true }
            if right != nil { return false }
            return score(lhs) > score(rhs)
        }
        var result: [AssignmentItem] = []
        var total = 0
        for item in ordered {
            let minutes = features.estimates[item.id].flatMap { $0 > 0 ? $0 : nil } ?? NativeParity.defaultEstimate(item)
            let dueSoon = item.dueDate.map { $0 <= Date().addingTimeInterval(3 * 86400) } ?? false
            if !dueSoon && result.count >= 3 { continue }
            if result.count >= 3 && total + minutes > 240 { continue }
            result.append(item)
            total += minutes
            if result.count >= 6 { break }
        }
        return result
    }
    private func score(_ item: AssignmentItem) -> Double {
        let count = candidatesDueSoonCount(for: item)
        return NativeParity.getItDoneScore(item, estimate: features.estimates[item.id], dueSoonCount: count)
    }
    private func candidatesDueSoonCount(for item: AssignmentItem) -> Int {
        visibleAssignments.filter { $0.courseID == item.courseID && $0.isVisible(in: store) && !skipped.contains($0.id) && ($0.dueDate ?? .distantFuture) <= Date().addingTimeInterval(3 * 86400) }.count
    }
    var body: some View {
        ZStack {
            CPBackdrop()
            ScrollView {
                LazyVStack(spacing: 14) {
                    HStack(spacing: 8) { ForEach([7, 14], id: \.self) { value in Button { window = value; choiceOffset = 0; orderRaw = "" } label: { CPChip(text: value == 7 ? "1 week" : "2 weeks", selected: window == value) }.buttonStyle(.plain) } }
                    planCard
                    if let first = recommendation {
                        CPGlassCard(title: "Start here", strong: true) {
                            NativeAssignmentRow(assignment: first, store: store)
                            Text(NativeParity.recommendationReason(first, estimate: features.estimates[first.id], dueSoonCount: candidatesDueSoonCount(for: first))).font(.system(size: 12, weight: .regular)).foregroundStyle(CPTheme.muted(scheme))
                            HStack { Button("Choose another") { choiceOffset = candidates.count <= 1 ? 0 : (choiceOffset + 1) % candidates.count }; Spacer(); Button("Skip today") { skip(first.id) } }.font(.system(size: 12, weight: .regular))
                        }
                    } else { CPGlassCard(strong: true) { NativeEmptyState(title: "Nothing needs your attention right now.", symbol: "checkmark.circle") } }
                }.padding(14).padding(.bottom, 20)
            }
        }.navigationTitle("Get It Done").navigationBarTitleDisplayMode(.inline)
            .onAppear { let today = String(Int(Calendar.current.startOfDay(for: Date()).timeIntervalSince1970)); if planDate != today { skippedRaw = ""; orderRaw = ""; planDate = today } }
            .alert("Estimated time", isPresented: Binding(get: { editingEstimate != nil }, set: { if !$0 { editingEstimate = nil } })) {
                TextField("Minutes", value: $estimateMinutes, format: .number).keyboardType(.numberPad)
                Button("Save") { if let id = editingEstimate, let item = allAssignments.first(where: { $0.id == id }) { Task { try? await features.saveEstimate(max(5, estimateMinutes), for: item) } }; editingEstimate = nil }
                Button("Cancel", role: .cancel) { editingEstimate = nil }
            }
    }
    private var planCard: some View {
        CPGlassCard(title: "Today’s Plan") {
            LazyVGrid(columns: phoneMetricColumns, spacing: 8) {
                PlanMetricTile(value: "\(plan.reduce(0) { $0 + estimate(for: $1) })m", label: "Remaining workload")
                PlanMetricTile(value: "\(plan.count)", label: "Tasks ready")
                PlanMetricTile(value: "\(window)d", label: "Planning window")
            }
            HStack { Spacer(); Button("Regenerate plan") { skippedRaw = ""; orderRaw = ""; choiceOffset = 0 }.font(.system(size: 11, weight: .regular)) }
            ForEach(plan.indices, id: \.self) { index in planRow(plan[index], index: index) }
            if plan.isEmpty { NativeEmptyState(title: "No plan needed.", symbol: "checkmark.circle", detail: "Everything urgent is complete, skipped, or already submitted.") }
        }
    }
    private func planRow(_ item: AssignmentItem, index: Int) -> some View {
        CPInsetRow {
            VStack(alignment: .leading, spacing: 7) {
                NativeAssignmentRow(assignment: item, store: store)
                Text("Estimated \(estimate(for: item)) minutes").font(.system(size: 11)).foregroundStyle(CPTheme.muted(scheme))
                HStack(spacing: 14) {
                    Button { move(item.id, direction: -1) } label: { Image(systemName: "arrow.up") }.disabled(index == 0)
                    Button { move(item.id, direction: 1) } label: { Image(systemName: "arrow.down") }.disabled(index == plan.count - 1)
                    Button("Estimate") { estimateMinutes = estimate(for: item); editingEstimate = item.id }
                    Spacer()
                }
                HStack { if let url = URL(string: item.htmlURL), url.scheme == "https" { Link("Start", destination: url) }; Spacer(); Button("Skip today") { skip(item.id) } }
            }.font(.system(size: 11, weight: .regular))
        }
    }
    private func estimate(for item: AssignmentItem) -> Int { features.estimates[item.id].flatMap { $0 > 0 ? $0 : nil } ?? NativeParity.defaultEstimate(item) }
    private func skip(_ id: Int) { skippedRaw = (skipped.union([id])).sorted().map { String($0) }.joined(separator: ","); orderRaw = manualOrder.filter { $0 != id }.map { String($0) }.joined(separator: ","); choiceOffset = 0 }
    private func move(_ id: Int, direction: Int) { var ids = plan.map(\.id); guard let index = ids.firstIndex(of: id), ids.indices.contains(index + direction) else { return }; ids.swapAt(index, index + direction); orderRaw = ids.map { String($0) }.joined(separator: ",") }
    private var phoneMetricColumns: [GridItem] { [GridItem(.flexible(minimum: 0), spacing: 8), GridItem(.flexible(minimum: 0), spacing: 8)] }
}

struct FocusView: View {
    @Environment(\.colorScheme) private var scheme
    @ObservedObject var store: NativeContentStore
    @ObservedObject var features: NativeFeatureStore
    @State private var window = "7"
    @State private var showCompleted = false
    private var items: [AssignmentItem] {
        let custom = features.customAssignments.map { item in AssignmentItem.custom(item, course: store.bundle.courses.first { $0.id == item.courseID }) }
        return (store.bundle.assignments + custom).filter { item in
            !features.hiddenCourseIDs.contains(item.courseID) &&
            NativeParity.isInFocusWindow(item, window: window) &&
            item.isVisible(in: store, showCompleted: showCompleted)
        }.sorted(by: AssignmentItem.dueSort)
    }
    var body: some View {
        ZStack {
            CPBackdrop()
            ScrollView {
                LazyVStack(spacing: 14) {
                    ScrollView(.horizontal, showsIndicators: false) { HStack(spacing: 8) { ForEach(["all", "7", "overdue", "3", "2", "1"], id: \.self) { value in Button { window = value } label: { CPChip(text: focusLabel(value), selected: window == value) }.buttonStyle(.plain) } } }
                    Toggle("Show completed", isOn: $showCompleted).font(.system(size: 12, weight: .regular))
                    CPGlassCard {
                        if items.isEmpty { NativeEmptyState(title: "You’re all caught up.", symbol: "checkmark", detail: "No assignments match this view. Choose All dates to check other deadlines.") }
                        VStack(spacing: 8) { ForEach(items) { item in CPInsetRow { VStack(alignment: .leading, spacing: 6) { NativeAssignmentRow(assignment: item, store: store); HStack { NavigationLink { AssignmentDetailView(assignment: item, store: store, features: features) } label: { Label("Description", systemImage: "doc.text") }; Spacer(); if let url = URL(string: item.htmlURL), !item.htmlURL.isEmpty { Link(destination: url) { Label("Open", systemImage: "arrow.up.right") } } }.font(.system(size: 11, weight: .regular)) } } } }
                    }
                }.padding(14).padding(.bottom, 20)
            }
        }.navigationTitle("Focus").navigationBarTitleDisplayMode(.inline)
    }
    private func focusLabel(_ value: String) -> String { value == "all" ? "All dates" : value == "7" ? "1 week" : value == "overdue" ? "Overdue" : "\(value) day\(value == "1" ? "" : "s")" }
}

private struct PlanMetricTile: View {
    @Environment(\.colorScheme) private var scheme
    let value: String; let label: String
    var body: some View { VStack(alignment: .leading, spacing: 4) { Text(label.uppercased()).font(.system(size: 8, weight: .regular)).tracking(1).foregroundStyle(CPTheme.muted(scheme)).lineLimit(2); Text(value).font(.system(size: 16, weight: .regular)).monospacedDigit() }.padding(10).frame(maxWidth: .infinity, minHeight: 64, alignment: .leading).background(CPTheme.inset(scheme), in: RoundedRectangle(cornerRadius: 15)).overlay(RoundedRectangle(cornerRadius: 15).stroke(CPTheme.insetBorder(scheme))) }
}

struct NativeCalendarEntry: Identifiable {
    let id: String
    let date: Date
    let title: String
    let context: String
    let kind: String
    let url: URL?
    let pickID: Int?
}

private struct CalendarDayGroup: Identifiable {
    var id: Date { day }
    let day: Date
    let items: [NativeCalendarEntry]
}

struct CalendarView: View {
    @Environment(\.colorScheme) private var scheme
    @ObservedObject var store: NativeContentStore
    @ObservedObject var features: NativeFeatureStore
    @State private var showCompleted = false
    @State private var editingPick: CalendarPick?
    @State private var pickedTime = Date()
    @State private var selectedDate: Date? = Calendar.current.startOfDay(for: Date())
    @State private var currentWeekOffset = 0

    private var calendar: Calendar { Calendar.current }
    private var today: Date { calendar.startOfDay(for: Date()) }

    private var weekDates: [Date] {
        let weekday = calendar.component(.weekday, from: today)
        let monday = calendar.date(byAdding: .day, value: -((weekday + 5) % 7) + (currentWeekOffset * 7), to: today) ?? today
        return (0..<7).compactMap { calendar.date(byAdding: .day, value: $0, to: monday) }
    }

    private var allAssignments: [AssignmentItem] {
        store.bundle.assignments + features.customAssignments.map { item in
            AssignmentItem.custom(item, course: store.bundle.courses.first { $0.id == item.courseID })
        }
    }
    private var visibleAssignments: [AssignmentItem] {
        allAssignments.filter { !features.hiddenCourseIDs.contains($0.courseID) && $0.isVisible(in: store, showCompleted: showCompleted) }
    }
    private var agenda: [NativeCalendarEntry] {
        let pickedIDs = Set(features.calendarPicks.map(\.assignmentID))
        var result = visibleAssignments.compactMap { item -> NativeCalendarEntry? in
            guard !pickedIDs.contains(item.id), let date = item.dueDate, date >= Date().addingTimeInterval(-86400) else { return nil }
            return NativeCalendarEntry(id: "assignment-\(item.id)", date: date, title: item.name, context: item.courseName, kind: "Assignment due", url: URL(string: item.htmlURL), pickID: nil)
        }
        result += store.bundle.calendar.compactMap { event in
            guard let raw = event.startAt, let date = ISO8601DateFormatter.canvasDate(from: raw), date >= Date().addingTimeInterval(-86400) else { return nil }
            return NativeCalendarEntry(id: "event-\(event.id)", date: date, title: event.title, context: event.contextName ?? event.locationName ?? "Canvas event", kind: "Canvas event", url: event.htmlURL.flatMap { URL(string: $0) }, pickID: nil)
        }
        result += features.calendarPicks.compactMap { pick in
            if let assignment = allAssignments.first(where: { $0.id == pick.assignmentID }), !assignment.isVisible(in: store, showCompleted: showCompleted) { return nil }
            guard let date = ISO8601DateFormatter.canvasDate(from: pick.at), date >= Date().addingTimeInterval(-12 * 3600) else { return nil }
            return NativeCalendarEntry(id: "pick-\(pick.id)", date: date, title: pick.title, context: pick.context, kind: "Planned work", url: nil, pickID: pick.id)
        }
        return result.sorted { $0.date < $1.date }
    }

    private func itemsFor(day: Date) -> [NativeCalendarEntry] {
        agenda.filter { calendar.isDate($0.date, inSameDayAs: day) }
    }

    private var upcomingDayGroups: [CalendarDayGroup] {
        let uniqueDays = Array(Set(agenda.map { calendar.startOfDay(for: $0.date) })).sorted()
        return uniqueDays.compactMap { day in
            let items = itemsFor(day: day)
            return items.isEmpty ? nil : CalendarDayGroup(day: day, items: items)
        }
    }

    var body: some View {
        ZStack {
            CPBackdrop()
            ScrollView {
                LazyVStack(spacing: 14) {
                    calendarStrip

                    if agenda.isEmpty {
                        CPGlassCard {
                            NativeEmptyState(
                                title: "Nothing scheduled",
                                symbol: "calendar",
                                detail: "No upcoming assignments or events on your Canvas calendar."
                            )
                        }
                    } else if let selected = selectedDate {
                        // Selected Day View
                        let dayItems = itemsFor(day: selected)
                        CPGlassCard(
                            title: selected.formatted(.dateTime.weekday(.wide).month(.abbreviated).day()),
                            subtitle: dayItems.isEmpty ? "No deadlines scheduled" : "\(dayItems.count) \(dayItems.count == 1 ? "item" : "items")"
                        ) {
                            if dayItems.isEmpty {
                                HStack(spacing: 10) {
                                    Image(systemName: "checkmark.circle")
                                        .font(.system(size: 20))
                                        .foregroundStyle(CPTheme.primary(scheme: scheme))
                                    Text("Your schedule is clear for this day.")
                                        .font(.system(size: 13))
                                        .foregroundStyle(CPTheme.muted(scheme))
                                }
                                .padding(.vertical, 8)
                            } else {
                                VStack(spacing: 8) {
                                    ForEach(dayItems) { item in
                                        agendaItemRow(item)
                                    }
                                }
                            }
                        }
                    } else {
                        // All Upcoming Days View
                        ForEach(upcomingDayGroups) { group in
                            CPGlassCard(
                                title: group.day.formatted(.dateTime.weekday(.wide).month(.abbreviated).day()),
                                subtitle: "\(group.items.count) \(group.items.count == 1 ? "item" : "items")"
                            ) {
                                VStack(spacing: 8) {
                                    ForEach(group.items) { item in
                                        agendaItemRow(item)
                                    }
                                }
                            }
                        }
                    }

                    CPGlassCard(title: "Workload Overview", subtitle: "Assignment load over next 4 weeks") {
                        WorkloadView(assignments: visibleAssignments)
                    }
                }
                .padding(14)
                .padding(.bottom, 24)
            }
        }
        .navigationTitle("Calendar")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(item: $editingPick) { pick in
            NavigationStack {
                Form {
                    DatePicker("Planned time", selection: $pickedTime)
                }
                .navigationTitle("Change time")
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Cancel") { editingPick = nil }
                    }
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Save") {
                            let updated = features.calendarPicks.map { existing in
                                var value = existing
                                if existing.id == pick.id {
                                    value.at = ISO8601DateFormatter().string(from: pickedTime)
                                }
                                return value
                            }
                            Task {
                                try? await features.savePreference("calendar-picks", updated)
                            }
                            editingPick = nil
                        }
                    }
                }
            }
        }
    }

    private var calendarStrip: some View {
        CPGlassCard(strong: true) {
            VStack(spacing: 12) {
                // Header with Month and Week Navigation
                HStack {
                    if let firstDate = weekDates.first {
                        Text(firstDate.formatted(.dateTime.month(.wide).year()))
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundStyle(CPTheme.foreground(scheme))
                    }
                    Spacer()
                    HStack(spacing: 6) {
                        Button {
                            withAnimation(.easeInOut(duration: 0.2)) {
                                currentWeekOffset -= 1
                            }
                        } label: {
                            Image(systemName: "chevron.left")
                                .font(.system(size: 12, weight: .semibold))
                                .frame(width: 30, height: 30)
                                .background(CPTheme.inset(scheme), in: Circle())
                        }
                        .buttonStyle(.plain)

                        Button {
                            withAnimation(.easeInOut(duration: 0.2)) {
                                currentWeekOffset = 0
                                selectedDate = today
                            }
                        } label: {
                            Text("Today")
                                .font(.system(size: 11, weight: .medium))
                                .padding(.horizontal, 8)
                                .frame(height: 30)
                                .background(CPTheme.inset(scheme), in: Capsule())
                        }
                        .buttonStyle(.plain)

                        Button {
                            withAnimation(.easeInOut(duration: 0.2)) {
                                currentWeekOffset += 1
                            }
                        } label: {
                            Image(systemName: "chevron.right")
                                .font(.system(size: 12, weight: .semibold))
                                .frame(width: 30, height: 30)
                                .background(CPTheme.inset(scheme), in: Circle())
                        }
                        .buttonStyle(.plain)
                    }
                }

                // 7-day row
                HStack(spacing: 4) {
                    ForEach(weekDates, id: \.self) { date in
                        dateButton(date)
                    }
                }

                // Filter / View selector row
                HStack(spacing: 8) {
                    Button {
                        withAnimation { selectedDate = nil }
                    } label: {
                        CPChip(text: "All Upcoming", selected: selectedDate == nil)
                    }
                    .buttonStyle(.plain)

                    Spacer()

                    Toggle("Completed", isOn: $showCompleted)
                        .font(.system(size: 12, weight: .regular))
                        .tint(CPTheme.primary(scheme: scheme))
                }
            }
        }
    }

    @ViewBuilder
    private func dateButton(_ date: Date) -> some View {
        let isSelected = selectedDate != nil && calendar.isDate(selectedDate!, inSameDayAs: date)
        let isToday = calendar.isDate(date, inSameDayAs: today)
        let hasItems = !itemsFor(day: date).isEmpty

        Button {
            withAnimation(.easeInOut(duration: 0.15)) {
                if isSelected {
                    selectedDate = nil
                } else {
                    selectedDate = date
                }
            }
        } label: {
            VStack(spacing: 5) {
                Text(date.formatted(.dateTime.weekday(.narrow)))
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(isToday && !isSelected ? CPTheme.primary(scheme: scheme) : CPTheme.muted(scheme))

                ZStack {
                    if isSelected {
                        Circle()
                            .fill(CPTheme.primary(scheme: scheme))
                            .frame(width: 32, height: 32)
                    } else if isToday {
                        Circle()
                            .stroke(CPTheme.primary(scheme: scheme), lineWidth: 1.5)
                            .frame(width: 32, height: 32)
                    }

                    Text("\(calendar.component(.day, from: date))")
                        .font(.system(size: 13, weight: isSelected || isToday ? .bold : .medium))
                        .foregroundStyle(
                            isSelected ? CPTheme.background(scheme) :
                            isToday ? CPTheme.primary(scheme: scheme) :
                            CPTheme.foreground(scheme)
                        )
                }
                .frame(height: 32)

                Circle()
                    .fill(
                        isSelected ? CPTheme.background(scheme) :
                        hasItems ? CPTheme.primary(scheme: scheme) :
                        Color.clear
                    )
                    .frame(width: 4, height: 4)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 6)
            .background(
                isSelected ? CPTheme.primary(scheme: scheme).opacity(0.12) : Color.clear,
                in: RoundedRectangle(cornerRadius: 12, style: .continuous)
            )
        }
        .buttonStyle(.plain)
    }

    private func agendaItemRow(_ item: NativeCalendarEntry) -> some View {
        HStack(alignment: .top, spacing: 12) {
            ZStack {
                Circle()
                    .fill(
                        item.kind.contains("Assignment")
                            ? CPTheme.primary(scheme: scheme).opacity(0.14)
                            : Color.blue.opacity(0.14)
                    )
                    .frame(width: 32, height: 32)

                Image(systemName: item.kind.contains("Assignment") ? "checklist" : "calendar")
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(
                        item.kind.contains("Assignment")
                            ? CPTheme.primary(scheme: scheme)
                            : Color.blue
                    )
            }

            VStack(alignment: .leading, spacing: 4) {
                Text(item.title)
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(CPTheme.foreground(scheme))
                    .fixedSize(horizontal: false, vertical: true)

                Text(item.context)
                    .font(.system(size: 12))
                    .foregroundStyle(CPTheme.muted(scheme))

                HStack(spacing: 8) {
                    if let pickID = item.pickID {
                        Button("Change time") {
                            if let pick = features.calendarPicks.first(where: { $0.id == pickID }) {
                                pickedTime = item.date
                                editingPick = pick
                            }
                        }
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(CPTheme.primary(scheme: scheme))

                        Button("Remove", role: .destructive) {
                            removePick(pickID)
                        }
                        .font(.system(size: 11, weight: .medium))
                    } else if let url = item.url, url.scheme == "https" {
                        Link(destination: url) {
                            HStack(spacing: 3) {
                                Text("Open Canvas")
                                Image(systemName: "arrow.up.right")
                            }
                            .font(.system(size: 11, weight: .medium))
                            .foregroundStyle(CPTheme.primary(scheme: scheme))
                        }
                    }
                }
                .padding(.top, 2)
            }

            Spacer(minLength: 8)

            VStack(alignment: .trailing, spacing: 2) {
                Text(item.date, format: .dateTime.hour().minute())
                    .font(.system(size: 13, weight: .semibold))
                    .monospacedDigit()
                    .foregroundStyle(CPTheme.foreground(scheme))

                Text(item.kind.contains("Assignment") ? "Due" : "Event")
                    .font(.system(size: 10, weight: .medium))
                    .foregroundStyle(CPTheme.muted(scheme))
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(CPTheme.inset(scheme), in: RoundedRectangle(cornerRadius: 15, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 15, style: .continuous).stroke(CPTheme.insetBorder(scheme), lineWidth: 1))
    }

    private func removePick(_ id: Int) {
        Task {
            try? await features.savePreference("calendar-picks", features.calendarPicks.filter { $0.id != id })
        }
    }
}

private struct WeekSummary: Identifiable {
    var id: String { name }
    let name: String
    let range: String
    let count: Int
    let assignments: [AssignmentItem]
}

struct WorkloadView: View {
    @Environment(\.colorScheme) private var scheme
    let assignments: [AssignmentItem]
    private var calendar: Calendar { Calendar.current }
    private var today: Date { calendar.startOfDay(for: Date()) }
    private var monday: Date {
        let weekday = calendar.component(.weekday, from: today)
        return calendar.date(byAdding: .day, value: -((weekday + 5) % 7), to: today) ?? today
    }

    private var weekSummaries: [WeekSummary] {
        (0..<4).compactMap { weekIndex -> WeekSummary? in
            guard let start = calendar.date(byAdding: .day, value: weekIndex * 7, to: monday),
                  let end = calendar.date(byAdding: .day, value: 7, to: start) else { return nil }
            let items = assignments.filter {
                guard let due = $0.dueDate else { return false }
                return due >= start && due < end
            }
            let label = weekIndex == 0 ? "This Week" : weekIndex == 1 ? "Next Week" : "Week \(weekIndex + 1)"
            let rangeStr = "\(start.formatted(.dateTime.month(.abbreviated).day())) – \(calendar.date(byAdding: .day, value: 6, to: start)?.formatted(.dateTime.month(.abbreviated).day()) ?? "")"
            return WeekSummary(name: label, range: rangeStr, count: items.count, assignments: items)
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("Upcoming 4-Week Load")
                    .font(.system(size: 13, weight: .medium))
                Spacer()
                Text("\(assignments.count) total items")
                    .font(.system(size: 11))
                    .foregroundStyle(CPTheme.muted(scheme))
            }

            VStack(spacing: 8) {
                ForEach(weekSummaries) { week in
                    HStack(spacing: 12) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(week.name)
                                .font(.system(size: 13, weight: .medium))
                                .foregroundStyle(CPTheme.foreground(scheme))
                            Text(week.range)
                                .font(.system(size: 11))
                                .foregroundStyle(CPTheme.muted(scheme))
                        }

                        Spacer()

                        ZStack(alignment: .leading) {
                            Capsule()
                                .fill(Color.white.opacity(scheme == .dark ? 0.06 : 0.08))
                                .frame(width: 70, height: 6)
                            Capsule()
                                .fill(week.count > 4 ? CPTheme.danger : (week.count > 0 ? CPTheme.primary(scheme: scheme) : Color.clear))
                                .frame(width: max(week.count > 0 ? 8 : 0, min(70, 70 * CGFloat(week.count) / 6.0)), height: 6)
                        }

                        Text("\(week.count) due")
                            .font(.system(size: 12, weight: .semibold))
                            .monospacedDigit()
                            .foregroundStyle(week.count > 4 ? CPTheme.danger : week.count > 0 ? CPTheme.foreground(scheme) : CPTheme.muted(scheme))
                            .frame(width: 48, alignment: .trailing)
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(CPTheme.inset(scheme), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).stroke(CPTheme.insetBorder(scheme), lineWidth: 1))
                }
            }
        }
    }
}

private struct AnnouncementsView: View {
    @Environment(\.colorScheme) private var scheme
    @ObservedObject var store: NativeContentStore
    @ObservedObject var features: NativeFeatureStore
    @AppStorage("CanvasProAnnouncementWeeks") private var weeks = 1
    @AppStorage("CanvasProDismissedAnnouncements") private var dismissedRaw = ""
    @State private var search = ""
    @State private var courseFilter: Int?
    @State private var expanded = Set<Int>()
    private var dismissed: Set<Int> { Set(dismissedRaw.split(separator: ",").compactMap { Int($0) }) }
    private var items: [AnnouncementItem] {
        store.bundle.announcements.filter { item in
            !features.hiddenCourseIDs.contains(item.courseID) && !dismissed.contains(item.id) && item.isWithin(weeks: weeks) && (search.isEmpty || item.title.localizedCaseInsensitiveContains(search) || item.courseName.localizedCaseInsensitiveContains(search))
        }.sorted { $0.postedAt > $1.postedAt }
    }
    private var feed: [AnnouncementItem] { items.filter { courseFilter == nil || $0.courseID == courseFilter } }
    private var courses: [Int] { Array(Set(items.map(\.courseID))).sorted { name(for: $0) < name(for: $1) } }
    private func name(for id: Int) -> String { store.displayName(courseID: id, fallback: items.first(where: { $0.courseID == id })?.courseName ?? "Class") }
    private var courseCount: Int { Set(items.map(\.courseID)).count }
    var body: some View {
        ZStack {
            CPBackdrop()
            ScrollView {
                LazyVStack(spacing: 14) {
                    CPGlassCard(strong: true) {
                        VStack(alignment: .leading, spacing: 14) {
                            Text(weeks == 0 ? "All announcements" : weeks == 1 ? "Past week" : weeks == 4 ? "Past month" : "Past \(weeks) weeks").font(.system(size: 15, weight: .regular))
                            HStack(spacing: 8) { announcementMetric(items.count, "Recent posts"); announcementMetric(courseCount, "Active courses") }
                        }
                    }.overlay(alignment: .topTrailing) { Circle().fill(CPTheme.primary(scheme: scheme).opacity(0.15)).frame(width: 260, height: 260).blur(radius: 70).offset(x: 95, y: -95).allowsHitTesting(false) }
                    ScrollView(.horizontal, showsIndicators: false) { HStack(spacing: 8) {
                        Button { courseFilter = nil } label: { CPChip(text: "All updates \(items.count)", selected: courseFilter == nil) }.buttonStyle(.plain)
                        ForEach(courses, id: \.self) { id in Button { courseFilter = id } label: { CPChip(text: "\(name(for: id)) \(items.filter { $0.courseID == id }.count)", selected: courseFilter == id) }.buttonStyle(.plain) }
                        if !dismissed.isEmpty { Button("Restore \(dismissed.count)") { dismissedRaw = "" }.font(.system(size: 11, weight: .regular)) }
                    } }
                    CPGlassCard {
                        VStack(spacing: 0) {
                            ForEach(feed) { item in VStack(alignment: .leading, spacing: 7) {
                                HStack(alignment: .top, spacing: 12) {
                                    VStack(alignment: .leading, spacing: 3) { Text(announcementDate(item)).font(.system(size: 12, weight: .regular)).monospacedDigit(); Text(announcementTime(item)).font(.system(size: 10, weight: .regular)).foregroundStyle(CPTheme.muted(scheme)) }.frame(width: 54, alignment: .leading)
                                    VStack(alignment: .leading, spacing: 5) { Text(name(for: item.courseID)).font(.system(size: 10, weight: .regular)).foregroundStyle(CPTheme.primary(scheme: scheme)); Text(item.title).font(.system(size: 13, weight: .regular)); Text(item.message.strippingHTML).font(.system(size: 11, weight: .regular)).foregroundStyle(CPTheme.muted(scheme)).lineLimit(expanded.contains(item.id) ? nil : 3) }.frame(maxWidth: .infinity, alignment: .leading)
                                    Button { dismissedRaw = dismissed.union([item.id]).sorted().map { String($0) }.joined(separator: ",") } label: { Image(systemName: "xmark").font(.system(size: 11)) }.accessibilityLabel("Dismiss \(item.title)")
                                }
                                if item.message.strippingHTML.count > 180 { Button(expanded.contains(item.id) ? "Show less" : "Read full update") { if expanded.contains(item.id) { expanded.remove(item.id) } else { expanded.insert(item.id) } }.font(.system(size: 11, weight: .regular)) }
                                if let course = store.bundle.courses.first(where: { $0.id == item.courseID }) { NavigationLink { CourseDetailView(course: course, store: store, features: features) } label: { Label("Open class", systemImage: "arrow.up.right").font(.system(size: 11)) } }
                            }.padding(.vertical, 10); if item.id != feed.last?.id { Divider().overlay(CPTheme.foreground(scheme).opacity(0.10)) } }
                        }
                        if feed.isEmpty { NativeEmptyState(title: "No announcements in this view", symbol: "megaphone") }
                    }
                }.padding(14).padding(.bottom, 20)
            }.searchable(text: $search).refreshable { await store.load() }
        }.navigationTitle("Announcements").navigationBarTitleDisplayMode(.inline)
    }
    private func announcementMetric(_ value: Int, _ label: String) -> some View { VStack(alignment: .leading, spacing: 3) { Text("\(value)").font(.system(size: 21, weight: .regular)).tracking(-0.6); Text(label).font(.system(size: 10, weight: .regular)).foregroundStyle(CPTheme.muted(scheme)) }.padding(10).frame(maxWidth: .infinity, alignment: .leading).background(CPTheme.background(scheme).opacity(0.35), in: RoundedRectangle(cornerRadius: 14)).overlay(RoundedRectangle(cornerRadius: 14).stroke(CPTheme.foreground(scheme).opacity(0.10))) }
    private func announcementDate(_ item: AnnouncementItem) -> String { ISO8601DateFormatter.canvasDate(from: item.postedAt)?.formatted(.dateTime.month(.abbreviated).day()) ?? "Recent" }
    private func announcementTime(_ item: AnnouncementItem) -> String { ISO8601DateFormatter.canvasDate(from: item.postedAt)?.formatted(.dateTime.hour().minute()) ?? "" }
}

struct AnnouncementDetailView: View {
    let item: AnnouncementItem
    var body: some View { ZStack { CPBackdrop(); ScrollView { CPGlassCard(title: item.title, subtitle: item.courseName, strong: true) { Text(item.message.strippingHTML).textSelection(.enabled); if let url = URL(string: item.htmlURL), !item.htmlURL.isEmpty { Link("Open in Canvas", destination: url) } }.padding() } }.navigationTitle("Announcement").navigationBarTitleDisplayMode(.inline) }
}

private struct NotificationsView: View {
    @ObservedObject var sessionStore: NativeSessionStore
    @ObservedObject var features: NativeFeatureStore
    @State private var status: String?
    @State private var syncing = false
    var body: some View {
        Form {
            Section("Master") {
                Toggle("Notifications", isOn: bind(\.enabled)); Toggle("App icon badge", isOn: bind(\.badge)); Toggle("Quiet hours", isOn: bind(\.quietEnabled))
                if features.notificationPreferences.quietEnabled { Stepper("Starts at \(features.notificationPreferences.quietStart):00", value: bind(\.quietStart), in: 0...23); Stepper("Ends at \(features.notificationPreferences.quietEnd):00", value: bind(\.quietEnd), in: 0...23) }
            }
            Section("Due date reminders") { Toggle("1 week before", isOn: bind(\.due1w)); Toggle("3 days before", isOn: bind(\.due3d)); Toggle("2 days before", isOn: bind(\.due2d)); Toggle("1 day before", isOn: bind(\.due1d)) }
            Section("Canvas updates") { Toggle("Grades", isOn: bind(\.grades)); Toggle("Announcements", isOn: bind(\.announcements)); if features.notificationPreferences.grades { Stepper("Grade threshold: \(Int(features.notificationPreferences.gradeThreshold))%", value: bind(\.gradeThreshold), in: 0...100, step: 5) } }
            Section("Class schedule") { Toggle("Class countdown", isOn: bind(\.countdownClass)); Toggle("Tonight’s deadlines", isOn: bind(\.countdownTonight)) }
            Section { Button { save() } label: { HStack { Spacer(); if syncing { ProgressView() } else { Text("Save Notification Settings") }; Spacer() } }.disabled(syncing) }
            Section("History") { ForEach(features.alerts) { alert in VStack(alignment: .leading) { Text(alert.title).font(.system(size: 13, weight: .regular)); Text(alert.body).font(.system(size: 12, weight: .regular)); Text(alert.sentAt == nil ? "Scheduled" : "Sent").font(.system(size: 10, weight: .regular)).foregroundStyle(.secondary) } }; if features.alerts.isEmpty { Text("No notification history").foregroundStyle(.secondary) } }
            if let status { Section { Text(status).foregroundStyle(.secondary) } }
        }
        .cpListScreen()
        .navigationTitle("Notifications")
        .onReceive(NotificationCenter.default.publisher(for: .nativeDeviceToken)) { note in
            if let token = note.object as? String { Task { await register(token) } }
            else if let error = note.object as? Error { status = error.localizedDescription }
        }
    }
    private func bind<T>(_ path: WritableKeyPath<NotificationPreferences, T>) -> Binding<T> { Binding(get: { features.notificationPreferences[keyPath: path] }, set: { features.notificationPreferences[keyPath: path] = $0 }) }
    private func save() {
        if features.isPreview {
            status = "Preview settings saved on this simulator."
            return
        }
        syncing = true
        Task {
            defer { syncing = false }
            do {
                if features.notificationPreferences.enabled {
                    let granted = try await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound])
                    if granted { UIApplication.shared.registerForRemoteNotifications() } else { features.notificationPreferences.enabled = false }
                } else {
                    UIApplication.shared.unregisterForRemoteNotifications()
                    if let deviceToken = UserDefaults.standard.string(forKey: "CanvasProNativePushToken"), let api = sessionStore.api {
                        let access = try await sessionStore.accessToken()
                        try await api.deletePushToken(deviceToken, token: access)
                        UserDefaults.standard.removeObject(forKey: "CanvasProNativePushToken")
                    }
                }
                try await features.saveNotifications(); status = "Notification settings saved."
            } catch { status = error.localizedDescription }
        }
    }
    private func register(_ deviceToken: String) async {
        guard let api = sessionStore.api, let user = sessionStore.session?.user else { return }
        do { try await api.upsertPushToken(deviceToken, token: try await sessionStore.accessToken(), userID: user.id); UserDefaults.standard.set(deviceToken, forKey: "CanvasProNativePushToken"); status = "Push notifications enabled." }
        catch { status = error.localizedDescription }
    }
}

private struct AppearanceView: View {
    var body: some View { ZStack { CPBackdrop(); ScrollView { AppearanceSettingsCard().padding(14) } }.navigationTitle("Appearance").navigationBarTitleDisplayMode(.inline) }
}

private struct AppearanceSettingsCard: View {
    @Environment(\.colorScheme) private var resolvedScheme
    @AppStorage("CanvasProColorScheme") private var scheme = "system"
    @AppStorage("CanvasProPalette") private var palette = "forest"
    private let columns = [GridItem(.flexible()), GridItem(.flexible())]
    var body: some View {
        CPGlassCard(title: "Appearance", strong: true) {
                    Text("THEME").font(.system(size: 10, weight: .regular)).tracking(1.5).foregroundStyle(CPTheme.muted(resolvedScheme))
                    LazyVGrid(columns: columns, spacing: 11) {
                        ForEach(CPPalette.allCases) { option in
                            Button { palette = option.rawValue } label: { PaletteOption(option: option, selected: palette == option.rawValue) }.buttonStyle(.plain)
                        }
                    }
                    Text("MODE").font(.system(size: 10, weight: .regular)).tracking(1.5).foregroundStyle(CPTheme.muted(resolvedScheme)).padding(.top, 4)
                    LazyVGrid(columns: [GridItem(.flexible(minimum: 0), spacing: 9), GridItem(.flexible(minimum: 0), spacing: 9), GridItem(.flexible(minimum: 0))], spacing: 9) {
                        appearanceButton("light", "Light", "sun.max")
                        appearanceButton("dark", "Dark", "moon")
                        appearanceButton("system", "System", "desktopcomputer")
                    }
                    if scheme == "system" { Text("Follows your iPhone.").font(.system(size: 11)).foregroundStyle(CPTheme.muted(resolvedScheme)) }
        }
    }
    private func appearanceButton(_ value: String, _ title: String, _ symbol: String) -> some View {
        Button { scheme = value } label: {
            VStack(spacing: 6) { Image(systemName: symbol).font(.system(size: 14)); Text(title).font(.system(size: 11, weight: .regular)); if scheme == value { Image(systemName: "checkmark").font(.system(size: 9, weight: .regular)) } }
                .frame(maxWidth: .infinity, minHeight: 66).foregroundStyle(scheme == value ? CPTheme.primary(scheme: resolvedScheme) : CPTheme.foreground(resolvedScheme)).background(scheme == value ? CPTheme.primary(scheme: resolvedScheme).opacity(0.10) : CPTheme.inset(resolvedScheme), in: RoundedRectangle(cornerRadius: 12)).overlay(RoundedRectangle(cornerRadius: 12).stroke(scheme == value ? CPTheme.primary(scheme: resolvedScheme).opacity(0.55) : CPTheme.insetBorder(resolvedScheme)))
        }.buttonStyle(.plain)
    }
}

private struct AnnouncementWindowSettingsView: View {
    @Environment(\.colorScheme) private var scheme
    @AppStorage("CanvasProAnnouncementWeeks") private var weeks = 1
    var body: some View {
        ZStack {
            CPBackdrop()
            ScrollView {
                CPGlassCard(title: "Announcement history", strong: true) {
                    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) { ForEach([1, 2, 4, 0], id: \.self) { value in Button { weeks = value } label: { CPChip(text: value == 0 ? "All" : value == 4 ? "1 month" : "\(value) week\(value == 1 ? "" : "s")", selected: weeks == value).frame(maxWidth: .infinity) }.buttonStyle(.plain) } }
                }.padding(14)
            }
        }.navigationTitle("Announcements").navigationBarTitleDisplayMode(.inline)
    }
}

private struct PaletteOption: View {
    @Environment(\.colorScheme) private var scheme
    let option: CPPalette; let selected: Bool
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            ZStack(alignment: .bottomTrailing) {
                HStack(spacing: 6) { RoundedRectangle(cornerRadius: 4).fill(option.swatch.opacity(0.20)).frame(width: 24); VStack(spacing: 6) { RoundedRectangle(cornerRadius: 4).fill(option.swatch.opacity(0.42)); RoundedRectangle(cornerRadius: 4).fill(option.swatch.opacity(0.13)) } }.padding(9).frame(height: 72).background(Color.hsl(option.hue, 0.12, 0.075), in: RoundedRectangle(cornerRadius: 9))
                if selected { Image(systemName: "checkmark").font(.system(size: 10, weight: .regular)).foregroundStyle(Color.hsl(option.hue, 0.28, 0.08)).frame(width: 20, height: 20).background(option.swatch, in: Circle()).padding(7) }
            }
            Text(option.name).font(.system(size: 12, weight: .regular)).foregroundStyle(CPTheme.foreground(scheme))
        }.padding(8).frame(maxWidth: .infinity, alignment: .leading).background(CPTheme.background(scheme).opacity(0.55), in: RoundedRectangle(cornerRadius: 14)).overlay(RoundedRectangle(cornerRadius: 14).stroke(selected ? CPTheme.primary(option, scheme: scheme) : CPTheme.border(scheme), lineWidth: selected ? 2 : 1))
    }
}

private struct ProfileView: View {
    @ObservedObject var features: NativeFeatureStore
    let email: String?
    @State private var username = ""
    @State private var status: String?
    var body: some View { Form { Section("Account") { LabeledContent("Email", value: email ?? "—"); TextField("Username", text: $username).textInputAutocapitalization(.never); Button("Save username") { Task { do { try await features.saveUsername(username); status = "Profile saved." } catch { status = error.localizedDescription } } } }; if let status { Section { Text(status).foregroundStyle(.secondary) } } }.cpListScreen().navigationTitle("Profile").onAppear { username = features.profile.username ?? "" } }
}

private struct ClassNamesView: View {
    @ObservedObject var store: NativeContentStore
    @State private var drafts: [Int: String] = [:]
    @State private var status: String?
    var body: some View { Form { Section("Class names") { ForEach(store.bundle.courses) { course in VStack(alignment: .leading) { Text(course.name).font(.caption).foregroundStyle(.secondary); TextField("Nickname", text: Binding(get: { drafts[course.id] ?? store.nicknames[course.id]?.customName ?? "" }, set: { drafts[course.id] = $0 })).onSubmit { save(course) } } } }; Section { Button("Save Class Names") { saveAll() }.disabled(drafts.isEmpty) }; if let status { Section { Text(status) } } }.cpListScreen().navigationTitle("Class Names") }
    private func save(_ course: CourseSummary) { Task { do { try await store.saveNickname(course: course, name: drafts[course.id] ?? ""); status = "Saved." } catch { status = error.localizedDescription } } }
    private func saveAll() { Task { do { for course in store.bundle.courses where drafts[course.id] != nil { try await store.saveNickname(course: course, name: drafts[course.id] ?? "") }; drafts.removeAll(); status = "Class names saved." } catch { status = error.localizedDescription } } }
}

private struct HiddenCoursesView: View {
    @ObservedObject var store: NativeContentStore
    @ObservedObject var features: NativeFeatureStore
    @State private var hidden = Set<Int>()
    var body: some View {
        List(store.bundle.courses) { course in
            Toggle(store.displayName(courseID: course.id, fallback: course.name), isOn: Binding(get: { hidden.contains(course.id) }, set: { value in if value { hidden.insert(course.id) } else { hidden.remove(course.id) }; Task { try? await features.savePreference("hidden-courses", Array(hidden)) } }))
        }.cpListScreen().navigationTitle("Hidden Courses").onAppear { if case .some(.array(let values)) = features.preferences["hidden-courses"] { hidden = Set(values.compactMap { if case .number(let id) = $0 { return Int(id) }; return nil }) } }
    }
}

private struct CanvasSettingsView: View {
    @ObservedObject var store: NativeContentStore
    @State private var domain = ""; @State private var canvasToken = ""; @State private var working = false; @State private var status: String?
    var body: some View {
        Form {
            Section {
                TextField("yourschool.instructure.com", text: $domain).textInputAutocapitalization(.never).keyboardType(.URL)
                SecureField("Canvas API token", text: $canvasToken)
                Button("Validate and Save") { save() }.disabled(domain.isEmpty || canvasToken.isEmpty || working)
            } header: {
                Text("Canvas connection")
            } footer: {
                Text("The token is validated through CanvasPro and stored securely on the server, not on this device.")
            }
            if let status { Section { Text(status).foregroundStyle(.secondary) } }
            Section("How to get a token") { Text("In Canvas on the web, open Account → Settings → Approved Integrations → New Access Token. Copy it here once; CanvasPro cannot read it back later.") }
        }.cpListScreen().navigationTitle("Canvas")
    }
    private func save() { working = true; Task { defer { working = false }; do { try await store.saveCanvas(domain: domain, canvasToken: canvasToken); canvasToken = ""; status = "Canvas connection saved." } catch { status = error.localizedDescription } } }
}

struct ClassScheduleView: View {
    @ObservedObject var features: NativeFeatureStore
    @State private var showAdd = false
    @State private var editing: ClassScheduleEntry?
    private let days = [("M", "Monday"), ("T", "Tuesday"), ("W", "Wednesday"), ("R", "Thursday"), ("F", "Friday"), ("S", "Saturday"), ("U", "Sunday")]
    private var credits: Double { var seen = Set<String>(); return features.schedule.reduce(0) { total, entry in let key = entry.title.lowercased(); guard seen.insert(key).inserted else { return total }; return total + entry.credits } }
    private var conflicts: [String] { var result: [String] = []; for i in features.schedule.indices { for j in features.schedule.indices where j > i { let a = features.schedule[i], b = features.schedule[j]; if a.title != b.title && !Set(a.days).isDisjoint(with: b.days) && a.startMinutes < b.endMinutes && b.startMinutes < a.endMinutes { result.append("\(a.title) overlaps \(b.title)") } } }; return result }
    var body: some View {
        List {
            Section { LabeledContent("Classes", value: "\(Set(features.schedule.map { $0.title.lowercased() }).count)"); LabeledContent("Credits", value: credits.formatted()); if !conflicts.isEmpty { ForEach(conflicts, id: \.self) { Text($0).font(.system(size: 11)).foregroundStyle(.orange) } } }
            ForEach(days.indices, id: \.self) { index in
                let day = days[index]
                let meetings = features.schedule.filter { $0.days.contains(day.0) }.sorted { $0.startMinutes < $1.startMinutes }
                if !meetings.isEmpty { Section(day.1) { ForEach(meetings) { item in Button { editing = item } label: { VStack(alignment: .leading, spacing: 3) { Text(item.title).font(.system(size: 13, weight: .regular)); Text("\(time(item.startMinutes))–\(time(item.endMinutes))").font(.system(size: 12, weight: .regular)); Text([item.code, item.location, item.instructor].filter { !$0.isEmpty }.joined(separator: " · ")).font(.system(size: 10, weight: .regular)).foregroundStyle(.secondary) } }.buttonStyle(.plain) } } }
            }
            Section("Edit or remove") { ForEach(features.schedule) { item in Button { editing = item } label: { HStack { Text(item.title); Spacer(); Text(item.days.joined(separator: ", ")).foregroundStyle(.secondary) } } }
                .onDelete { indexes in Task {
                    if features.isPreview { features.schedule.remove(atOffsets: indexes); features.persistPreviewState(); return }
                    for index in indexes {
                        let item = features.schedule[index]
                        if let api = features.sessionStore.api {
                            let token = try await features.sessionStore.accessToken()
                            try? await api.deleteScheduleEntry(id: item.id, token: token)
                        }
                    }
                    await features.load()
                } } }
            if features.schedule.isEmpty { NativeEmptyState(title: "No class schedule", symbol: "calendar.badge.plus") }
        }.cpListScreen().navigationTitle("Class Schedule").toolbar { Button { showAdd = true } label: { Image(systemName: "plus") } }.sheet(isPresented: $showAdd) { AddScheduleView(features: features) }.sheet(item: $editing) { AddScheduleView(features: features, editing: $0) }
    }
    private func time(_ minutes: Int) -> String { let hour = minutes / 60; let minute = minutes % 60; return String(format: "%d:%02d %@", hour % 12 == 0 ? 12 : hour % 12, minute, hour < 12 ? "AM" : "PM") }
}

private struct AddScheduleView: View {
    @Environment(\.dismiss) private var dismiss
    @ObservedObject var features: NativeFeatureStore
    var editing: ClassScheduleEntry? = nil
    @State private var title = ""; @State private var code = ""; @State private var location = ""; @State private var instructor = ""; @State private var credits = ""; @State private var selectedDays = Set<String>(); @State private var start = Date(); @State private var end = Date().addingTimeInterval(3600); @State private var error: String?
    @State private var perDay = false
    @State private var dayStarts: [String: Date] = [:]
    @State private var dayEnds: [String: Date] = [:]
    @State private var loaded = false
    private let days = ["M", "T", "W", "R", "F", "S", "U"]
    var body: some View {
        NavigationStack {
            Form {
                Section("Class") { TextField("Title", text: $title); TextField("Course code", text: $code); TextField("Credits", text: $credits).keyboardType(.decimalPad); TextField("Location", text: $location); TextField("Instructor", text: $instructor) }
                Section("Meets") { LazyVGrid(columns: Array(repeating: GridItem(.flexible(minimum: 0)), count: 4), spacing: 8) { ForEach(days, id: \.self) { day in Button(day) { if selectedDays.contains(day) { selectedDays.remove(day) } else { selectedDays.insert(day); dayStarts[day] = start; dayEnds[day] = end } }.buttonStyle(.borderedProminent).tint(selectedDays.contains(day) ? Color.accentColor : .gray).frame(maxWidth: .infinity) } }; Toggle("Different times by day", isOn: $perDay); if perDay { ForEach(days.filter { selectedDays.contains($0) }, id: \.self) { day in Text(day).font(.system(size: 11)).foregroundStyle(.secondary); DatePicker("Starts", selection: Binding(get: { dayStarts[day] ?? start }, set: { dayStarts[day] = $0 }), displayedComponents: .hourAndMinute); DatePicker("Ends", selection: Binding(get: { dayEnds[day] ?? end }, set: { dayEnds[day] = $0 }), displayedComponents: .hourAndMinute) } } else { DatePicker("Starts", selection: $start, displayedComponents: .hourAndMinute); DatePicker("Ends", selection: $end, displayedComponents: .hourAndMinute) } }
                if let error { Section { Text(error).foregroundStyle(.red) } }
            }.cpListScreen().navigationTitle(editing == nil ? "Add Class" : "Edit Class").toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }; ToolbarItem(placement: .confirmationAction) { Button("Save") { save() }.disabled(title.trimmingCharacters(in: .whitespaces).isEmpty || selectedDays.isEmpty) } }.onAppear { loadEditing() }
        }
    }
    private func save() {
        let cal = Calendar.current
        let chosenDays = days.filter(selectedDays.contains)
        let groups = perDay ? chosenDays.map { [$0] } : [chosenDays]
        let entries: [ClassScheduleEntry] = groups.compactMap { group in
            let startDate = perDay ? (dayStarts[group[0]] ?? start) : start
            let endDate = perDay ? (dayEnds[group[0]] ?? end) : end
            let startMinutes = cal.component(.hour, from: startDate) * 60 + cal.component(.minute, from: startDate)
            let endMinutes = cal.component(.hour, from: endDate) * 60 + cal.component(.minute, from: endDate)
            guard endMinutes > startMinutes else { return nil }
            return ClassScheduleEntry(id: group == groups.first ? (editing?.id ?? "") : "", code: code, section: editing?.section ?? "", title: title.trimmingCharacters(in: .whitespaces), crn: editing?.crn ?? "", credits: Double(credits) ?? 0, instructor: instructor, location: location, campus: editing?.campus ?? "", scheduleType: editing?.scheduleType ?? "Lecture", days: group, startMinutes: startMinutes, endMinutes: endMinutes, term: editing?.term ?? "", dateRange: editing?.dateRange ?? "", canvasCourseID: editing?.canvasCourseID)
        }
        guard entries.count == groups.count else { error = "End time must be after start time on every selected day."; return }
        Task {
            do {
                if features.isPreview {
                    if let editing { features.schedule.removeAll { $0.id == editing.id } }
                    features.schedule += entries.map { entry in var value = entry; if value.id.isEmpty { value.id = "preview-\(UUID().uuidString)" }; return value }
                    features.persistPreviewState()
                    dismiss()
                    return
                }
                guard let api = features.sessionStore.api, let user = features.sessionStore.session?.user else { return }
                let token = try await features.sessionStore.accessToken()
                for entry in entries { try await api.saveScheduleEntry(entry, token: token, userID: user.id) }
                await features.load()
                dismiss()
            } catch { self.error = error.localizedDescription }
        }
    }
    private func loadEditing() { guard !loaded, let editing else { return }; loaded = true; title = editing.title; code = editing.code; location = editing.location; instructor = editing.instructor; credits = editing.credits == 0 ? "" : editing.credits.formatted(); selectedDays = Set(editing.days); start = timeDate(editing.startMinutes); end = timeDate(editing.endMinutes); for day in editing.days { dayStarts[day] = start; dayEnds[day] = end } }
    private func timeDate(_ minutes: Int) -> Date { Calendar.current.date(bySettingHour: minutes / 60, minute: minutes % 60, second: 0, of: Date()) ?? Date() }
}

struct NativeLegalView: View {
    let title: String
    var body: some View {
        ZStack {
            CPBackdrop()
            ScrollView {
                CPGlassCard(title: title, strong: true) {
                    Text("CanvasPro stores the account and coursework settings needed to provide the service. Canvas credentials are stored server-side and used only to retrieve your Canvas data. You may delete your account and its stored data from CanvasPro. Use of CanvasPro is subject to school and Canvas policies.")
                    Text("The complete, current policy is also available on canvaspro.app.").foregroundStyle(.secondary)
                    if let url = URL(string: title == "Privacy Policy" ? "https://canvaspro.app/privacy" : "https://canvaspro.app/terms") { Link("View current \(title)", destination: url) }
                }.padding()
            }
        }.navigationTitle(title).navigationBarTitleDisplayMode(.inline)
    }
}
