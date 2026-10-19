import PhotosUI
import QuickLook
import SwiftUI
import UniformTypeIdentifiers
import VisionKit

// MARK: - Storage

/// Class files live in the student's own iCloud Drive when it's on for
/// CoursePro (so they sync to their iPad and Mac and survive a new phone), and
/// on this iPhone otherwise. Nothing is ever uploaded to CoursePro's servers.
@MainActor
final class NativeFileStore: ObservableObject {
    static let shared = NativeFileStore()
    @Published private(set) var root: URL?
    @Published private(set) var inICloud = false
    /// Bumped after every change, so every open folder reloads.
    @Published private(set) var revision = 0
    private var resolving: Task<Void, Never>?

    func prepare() async {
        if root == nil { await refresh() }
    }

    /// Re-checks iCloud (it can be turned on or off any time) and reloads folders.
    func refresh() async {
        if let resolving { await resolving.value; return }
        let task = Task {
            let resolved = await NativeFiles.background { NativeFiles.resolveRoot() }
            root = resolved.url
            inICloud = resolved.inICloud
            revision += 1
        }
        resolving = task
        await task.value
        resolving = nil
    }

    func changed() { revision += 1 }
}

struct NativeFileItem: Identifiable, Hashable {
    let url: URL
    let name: String
    let isFolder: Bool
    var size: Int? = nil
    var modified: Date? = nil
    /// False for an iCloud file that hasn't been downloaded to this iPhone yet.
    var isDownloaded = true
    var childCount: Int? = nil
    /// Search results: the folders it's in.
    var location: String? = nil
    var id: String { url.path }
}

struct NativeFolderChoice: Identifiable {
    let url: URL
    let name: String
    let depth: Int
    var id: String { url.path }
}

enum NativeFileError: LocalizedError {
    case nameTaken(String)
    case stillDownloading

    var errorDescription: String? {
        switch self {
        case .nameTaken(let name): return "There's already something called “\(name)” here."
        case .stillDownloading: return "This file is still downloading from iCloud. Try again in a moment."
        }
    }
}

/// File operations. Every one runs off the main thread (iCloud lookups can
/// block) and goes through a file coordinator, as iCloud Drive requires.
enum NativeFiles {
    static let containerID = "iCloud.app.canvaspro.mobile"
    private static let classFoldersKey = "CanvasProClassFolders"
    private static let keys: [URLResourceKey] = [.isDirectoryKey, .fileSizeKey, .contentModificationDateKey, .ubiquitousItemDownloadingStatusKey]

    static func background<T>(_ work: @escaping @Sendable () -> T) async -> T {
        await Task.detached(priority: .userInitiated) { work() }.value
    }

    static func backgroundThrowing<T>(_ work: @escaping @Sendable () throws -> T) async throws -> T {
        try await Task.detached(priority: .userInitiated) { try work() }.value
    }

    // MARK: Where files live

    static func resolveRoot() -> (url: URL, inICloud: Bool) {
        let manager = FileManager.default
        let local = manager.urls(for: .documentDirectory, in: .userDomainMask)[0]
        try? manager.createDirectory(at: local, withIntermediateDirectories: true)
        // Nil when iCloud Drive is off, signed out, or the build has no iCloud capability.
        if manager.ubiquityIdentityToken != nil, let container = manager.url(forUbiquityContainerIdentifier: containerID) {
            let documents = container.appendingPathComponent("Documents", isDirectory: true)
            if !isFolder(documents) {
                try? coordinated(documents) { try FileManager.default.createDirectory(at: $0, withIntermediateDirectories: true) }
            }
            // Anything saved on this iPhone before iCloud was on (or dropped into
            // On My iPhone › CoursePro in the Files app) moves into iCloud Drive.
            for item in visibleChildren(of: local) { moveIntoICloud(item, folder: documents) }
            return (documents, true)
        }
        return (local, false)
    }

    private static func moveIntoICloud(_ item: URL, folder: URL) {
        let destination = folder.appendingPathComponent(item.lastPathComponent)
        if isFolder(item) && isFolder(destination) {
            // Same folder on both sides (a class folder made on another device): merge.
            for child in visibleChildren(of: item) { moveIntoICloud(child, folder: destination) }
            try? FileManager.default.removeItem(at: item)
            return
        }
        let target = exists(destination) ? availableURL(for: item.lastPathComponent, in: folder) : destination
        try? FileManager.default.setUbiquitous(true, itemAt: item, destinationURL: target)
    }

    /// The folder for a class, made the first time it's needed. Remembered by
    /// class ID so a renamed class keeps its folder, and a folder with the
    /// class's name (made on another device) is reused instead of duplicated.
    static func classFolders(root: URL, classes: [(id: Int, name: String)]) -> [Int: URL] {
        let defaults = UserDefaults.standard
        var saved = defaults.dictionary(forKey: classFoldersKey) as? [String: String] ?? [:]
        var result: [Int: URL] = [:]
        for entry in classes {
            let key = String(entry.id)
            if let name = saved[key], isFolder(root.appendingPathComponent(name, isDirectory: true)) {
                result[entry.id] = root.appendingPathComponent(name, isDirectory: true)
                continue
            }
            let taken = Set(saved.filter { $0.key != key }.map(\.value))
            let base = cleanName(entry.name)
            var name = base
            var number = 2
            while taken.contains(name) { name = "\(base) \(number)"; number += 1 }
            let url = root.appendingPathComponent(name, isDirectory: true)
            if !isFolder(url) {
                try? coordinated(url) { try FileManager.default.createDirectory(at: $0, withIntermediateDirectories: true) }
            }
            saved[key] = name
            result[entry.id] = url
        }
        defaults.set(saved, forKey: classFoldersKey)
        return result
    }

    // MARK: Reading

    static func items(in folder: URL) -> [NativeFileItem] {
        guard let urls = try? FileManager.default.contentsOfDirectory(at: folder, includingPropertiesForKeys: keys, options: []) else { return [] }
        var byName: [String: NativeFileItem] = [:]
        for url in urls {
            guard let item = item(at: url, in: folder) else { continue }
            // A downloaded copy wins over its iCloud placeholder.
            if byName[item.name]?.isDownloaded != true { byName[item.name] = item }
        }
        return sorted(Array(byName.values))
    }

    static func sorted(_ items: [NativeFileItem]) -> [NativeFileItem] {
        items.sorted { first, second in
            if first.isFolder != second.isFolder { return first.isFolder }
            return first.name.localizedStandardCompare(second.name) == .orderedAscending
        }
    }

    private static func item(at url: URL, in folder: URL, countChildren: Bool = true) -> NativeFileItem? {
        let raw = url.lastPathComponent
        if raw.hasPrefix(".") {
            // An iCloud file that isn't on this iPhone yet shows up as ".Notes.pdf.icloud".
            guard raw.hasSuffix(".icloud"), raw.count > 8 else { return nil }
            let name = String(raw.dropFirst().dropLast(7))
            return NativeFileItem(url: folder.appendingPathComponent(name), name: name, isFolder: false, isDownloaded: false)
        }
        let values = try? url.resourceValues(forKeys: Set(keys))
        let folderItem = values?.isDirectory ?? false
        let status = values?.ubiquitousItemDownloadingStatus
        return NativeFileItem(
            url: url, name: raw, isFolder: folderItem,
            size: values?.fileSize, modified: values?.contentModificationDate,
            isDownloaded: folderItem || status == nil || status != .notDownloaded,
            childCount: folderItem && countChildren ? childCount(of: url) : nil
        )
    }

    private static func childCount(of folder: URL) -> Int {
        let names = (try? FileManager.default.contentsOfDirectory(atPath: folder.path)) ?? []
        return names.filter { !$0.hasPrefix(".") || $0.hasSuffix(".icloud") }.count
    }

    private static func visibleChildren(of folder: URL) -> [URL] {
        ((try? FileManager.default.contentsOfDirectory(at: folder, includingPropertiesForKeys: nil, options: [])) ?? [])
            .filter { !$0.lastPathComponent.hasPrefix(".") }
    }

    static func search(_ query: String, in root: URL) -> [NativeFileItem] {
        let needle = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !needle.isEmpty, let enumerator = FileManager.default.enumerator(at: root, includingPropertiesForKeys: keys) else { return [] }
        let rootParts = root.resolvingSymlinksInPath().pathComponents
        var results: [NativeFileItem] = []
        while let url = enumerator.nextObject() as? URL {
            let name = url.lastPathComponent
            if name.hasPrefix(".") && !name.hasSuffix(".icloud") { enumerator.skipDescendants(); continue }
            let folder = url.deletingLastPathComponent()
            guard var item = item(at: url, in: folder, countChildren: false), item.name.localizedCaseInsensitiveContains(needle) else { continue }
            let parts = folder.resolvingSymlinksInPath().pathComponents
            item.location = parts.count > rootParts.count ? parts.dropFirst(rootParts.count).joined(separator: " › ") : "Files"
            results.append(item)
            if results.count >= 100 { break }
        }
        return sorted(results)
    }

    /// Every folder a file could move to, as an indented tree. The item itself
    /// (and anything inside it) is left out.
    static func folderTree(root: URL, excluding item: URL) -> [NativeFolderChoice] {
        var choices = [NativeFolderChoice(url: root, name: "Files", depth: 0)]
        func walk(_ folder: URL, depth: Int) {
            let children = visibleChildren(of: folder).filter { isFolder($0) && !samePath($0, item) }
                .sorted { $0.lastPathComponent.localizedStandardCompare($1.lastPathComponent) == .orderedAscending }
            for child in children {
                choices.append(NativeFolderChoice(url: child, name: child.lastPathComponent, depth: depth))
                walk(child, depth: depth + 1)
            }
        }
        walk(root, depth: 1)
        return choices
    }

    static func samePath(_ first: URL, _ second: URL) -> Bool {
        first.resolvingSymlinksInPath().standardizedFileURL.path == second.resolvingSymlinksInPath().standardizedFileURL.path
    }

    static func isFolder(_ url: URL) -> Bool {
        var directory: ObjCBool = false
        return FileManager.default.fileExists(atPath: url.path, isDirectory: &directory) && directory.boolValue
    }

    /// Also true for an iCloud file that's only a placeholder on this iPhone.
    static func exists(_ url: URL) -> Bool {
        if FileManager.default.fileExists(atPath: url.path) { return true }
        return FileManager.default.fileExists(atPath: placeholder(for: url).path)
    }

    private static func placeholder(for url: URL) -> URL {
        url.deletingLastPathComponent().appendingPathComponent(".\(url.lastPathComponent).icloud")
    }

    // MARK: Downloading from iCloud

    static func isAvailable(_ url: URL) -> Bool {
        guard FileManager.default.fileExists(atPath: url.path) else { return false }
        var fresh = url
        fresh.removeAllCachedResourceValues()
        guard let values = try? fresh.resourceValues(forKeys: [.isUbiquitousItemKey, .ubiquitousItemDownloadingStatusKey]),
              values.isUbiquitousItem == true else { return true }
        return values.ubiquitousItemDownloadingStatus != .notDownloaded
    }

    /// Waits (up to two minutes) for an iCloud file to arrive on this iPhone.
    static func ensureDownloaded(_ url: URL) async throws {
        if await background({ isAvailable(url) }) { return }
        try await backgroundThrowing { try FileManager.default.startDownloadingUbiquitousItem(at: url) }
        for _ in 0..<480 {
            try await Task.sleep(for: .milliseconds(250))
            if await background({ isAvailable(url) }) { return }
        }
        throw NativeFileError.stillDownloading
    }

    // MARK: Writing

    static func cleanName(_ raw: String) -> String {
        var name = raw.replacingOccurrences(of: "/", with: "-").replacingOccurrences(of: ":", with: "-")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        while name.hasPrefix(".") { name.removeFirst() }
        if name.count > 120 { name = String(name.prefix(120)) }
        return name.isEmpty ? "Untitled" : name
    }

    /// "Notes.pdf", or "Notes 2.pdf" when that's taken.
    static func availableURL(for name: String, in folder: URL) -> URL {
        let ext = (name as NSString).pathExtension
        let base = ext.isEmpty ? name : (name as NSString).deletingPathExtension
        var candidate = folder.appendingPathComponent(name)
        var number = 2
        while exists(candidate) {
            candidate = folder.appendingPathComponent(ext.isEmpty ? "\(base) \(number)" : "\(base) \(number).\(ext)")
            number += 1
        }
        return candidate
    }

    static func coordinated(_ url: URL, _ options: NSFileCoordinator.WritingOptions = [], _ work: (URL) throws -> Void) throws {
        var coordinationError: NSError?
        var workError: Error?
        NSFileCoordinator(filePresenter: nil).coordinate(writingItemAt: url, options: options, error: &coordinationError) { url in
            do { try work(url) } catch { workError = error }
        }
        if let coordinationError { throw coordinationError }
        if let workError { throw workError }
    }

    @discardableResult
    static func createFolder(named raw: String, in folder: URL) throws -> URL {
        let url = availableURL(for: cleanName(raw), in: folder)
        try coordinated(url) { try FileManager.default.createDirectory(at: $0, withIntermediateDirectories: true) }
        return url
    }

    static func save(_ data: Data, named raw: String, in folder: URL) throws {
        let url = availableURL(for: cleanName(raw), in: folder)
        try coordinated(url, .forReplacing) { try data.write(to: $0, options: .atomic) }
    }

    /// Copies a file picked in the Files app (which may itself be in iCloud Drive).
    static func importFile(_ source: URL, into folder: URL) throws {
        let scoped = source.startAccessingSecurityScopedResource()
        defer { if scoped { source.stopAccessingSecurityScopedResource() } }
        let url = availableURL(for: cleanName(source.lastPathComponent), in: folder)
        var readError: NSError?
        var copyError: Error?
        NSFileCoordinator(filePresenter: nil).coordinate(readingItemAt: source, options: .withoutChanges, error: &readError) { readable in
            do { try coordinated(url, .forReplacing) { try FileManager.default.copyItem(at: readable, to: $0) } } catch { copyError = error }
        }
        if let readError { throw readError }
        if let copyError { throw copyError }
    }

    /// Renames in place. A file keeps its extension even if it's left off.
    static func rename(_ item: NativeFileItem, to raw: String) throws {
        var name = cleanName(raw)
        let ext = item.url.pathExtension
        if !item.isFolder && !ext.isEmpty && (name as NSString).pathExtension.lowercased() != ext.lowercased() { name += ".\(ext)" }
        guard name != item.name else { return }
        let destination = item.url.deletingLastPathComponent().appendingPathComponent(name, isDirectory: item.isFolder)
        if exists(destination) && name.lowercased() != item.name.lowercased() { throw NativeFileError.nameTaken(name) }
        try move(item.url, to: destination)
    }

    static func move(_ item: NativeFileItem, into folder: URL) throws {
        try move(item.url, to: availableURL(for: item.name, in: folder))
    }

    private static func move(_ source: URL, to destination: URL) throws {
        var coordinationError: NSError?
        var moveError: Error?
        NSFileCoordinator(filePresenter: nil).coordinate(writingItemAt: source, options: .forMoving, writingItemAt: destination, options: .forReplacing, error: &coordinationError) { from, to in
            do { try FileManager.default.moveItem(at: from, to: to) } catch { moveError = error }
        }
        if let coordinationError { throw coordinationError }
        if let moveError { throw moveError }
    }

    static func delete(_ item: NativeFileItem) throws {
        let url = FileManager.default.fileExists(atPath: item.url.path) ? item.url : placeholder(for: item.url)
        try coordinated(url, .forDeleting) { try FileManager.default.removeItem(at: $0) }
    }

    // MARK: Scans and photos

    /// Scanned pages as one PDF, letter width, JPEG-compressed so a 10-page
    /// handout stays a few megabytes.
    static func pdf(from pages: [UIImage]) -> Data {
        let width: CGFloat = 612
        let renderer = UIGraphicsPDFRenderer(bounds: CGRect(x: 0, y: 0, width: 612, height: 792))
        return renderer.pdfData { context in
            for page in pages {
                let image = page.jpegData(compressionQuality: 0.75).flatMap { UIImage(data: $0) } ?? page
                let bounds = CGRect(x: 0, y: 0, width: width, height: width * page.size.height / max(page.size.width, 1))
                context.beginPage(withBounds: bounds, pageInfo: [:])
                image.draw(in: bounds)
            }
        }
    }

    private static let stampFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd 'at' h.mm.ss a"
        return formatter
    }()

    static func stamp(_ date: Date = Date()) -> String { stampFormatter.string(from: date) }

    // MARK: Display

    static func symbol(for item: NativeFileItem) -> String {
        if item.isFolder { return "folder" }
        guard let type = UTType(filenameExtension: item.url.pathExtension) else { return "doc" }
        if type.conforms(to: .pdf) { return "doc.richtext" }
        if type.conforms(to: .image) { return "photo" }
        if type.conforms(to: .movie) { return "film" }
        if type.conforms(to: .audio) { return "waveform" }
        if type.conforms(to: .presentation) { return "rectangle.on.rectangle" }
        if type.conforms(to: .spreadsheet) { return "tablecells" }
        if type.conforms(to: .archive) { return "doc.zipper" }
        if type.conforms(to: .text) { return "doc.text" }
        return "doc"
    }

    static func detail(for item: NativeFileItem) -> String {
        var parts: [String] = []
        if let location = item.location { parts.append(location) }
        if item.isFolder {
            if let count = item.childCount { parts.append(count == 0 ? "Empty" : "\(count) item\(count == 1 ? "" : "s")") }
        } else if !item.isDownloaded {
            parts.append("In iCloud, tap to download")
        } else {
            if let size = item.size { parts.append(ByteCountFormatter.string(fromByteCount: Int64(size), countStyle: .file)) }
            if let modified = item.modified { parts.append(modified.formatted(.dateTime.month(.abbreviated).day())) }
        }
        return parts.joined(separator: " · ")
    }
}

// MARK: - Files tab

@MainActor
struct NativeFilesView: View {
    @Environment(\.colorScheme) private var scheme
    @Environment(\.cpPalette) private var paletteDependency
    @Environment(\.scenePhase) private var scenePhase
    @ObservedObject var store: NativeContentStore
    @ObservedObject var features: NativeFeatureStore
    @ObservedObject private var files = NativeFileStore.shared
    @State private var classFolders: [Int: URL] = [:]
    @State private var classCounts: [Int: Int] = [:]
    @State private var classesLoaded = false
    @State private var query = ""
    @State private var results: [NativeFileItem] = []
    @State private var searching = false

    private var classes: [CourseSummary] { store.bundle.courses.filter { !features.hiddenCourseIDs.contains($0.id) } }
    private var classFolderNames: Set<String> { Set(classFolders.values.map(\.lastPathComponent)) }
    private var classKey: String {
        "\(files.root?.path ?? "")-\(files.revision)-" + classes.map { "\($0.id):\(store.displayName(courseID: $0.id, fallback: $0.name))" }.joined(separator: ",")
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVStack(alignment: .leading, spacing: CPLayout.stack) {
                    if let root = files.root {
                        if query.trimmingCharacters(in: .whitespaces).isEmpty {
                            storageCard
                            if !classes.isEmpty { classesSection }
                            // Waits for the class folders, so they aren't listed here for a moment too.
                            if classes.isEmpty || classesLoaded {
                                NativeFolderList(folder: root, title: classes.isEmpty ? "Your files" : "Other files", hiddenNames: classFolderNames)
                            }
                        } else {
                            searchResults
                        }
                    } else {
                        CPSkeletonCard()
                    }
                }
                .cpPagePadding()
            }
            .background(CPBackdrop())
            .cpNavigationTitle("Files")
            .searchable(text: $query, prompt: "Search your files")
            .refreshable { await files.refresh() }
            .task { await files.prepare() }
            .task(id: classKey) { await loadClassFolders() }
            .task(id: "\(query)-\(files.revision)") { await runSearch() }
            .onChange(of: scenePhase) { _, phase in
                if phase == .active { Task { @MainActor in await files.refresh() } }
            }
        }
    }

    private var storageCard: some View {
        HStack(alignment: .top, spacing: 12) {
            CPIconBadge(symbol: files.inICloud ? "icloud" : "iphone")
            VStack(alignment: .leading, spacing: 2) {
                Text(files.inICloud ? "Saved in your iCloud Drive" : "Saved on this iPhone")
                    .cpFont(13, .medium).foregroundStyle(CPTheme.foreground(scheme))
                Text(files.inICloud
                     ? "They sync to your other Apple devices. CoursePro never uploads your files."
                     : "Turn on iCloud Drive in your iPhone's Settings to back them up and sync them. CoursePro never uploads your files.")
                    .cpFont(11).lineSpacing(2).foregroundStyle(CPTheme.muted(scheme))
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .cpSurface()
        .accessibilityElement(children: .combine)
    }

    private var classesSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            CPSectionLabel("Classes", count: classes.count)
            VStack(spacing: 0) {
                ForEach(Array(classes.enumerated()), id: \.element.id) { index, course in
                    let name = store.displayName(courseID: course.id, fallback: course.name)
                    if let folder = classFolders[course.id] {
                        NavigationLink { NativeFolderView(folder: folder, title: name) } label: {
                            NativeMenuRow(title: name, detail: classDetail(course.id), symbol: "folder")
                        }
                        .buttonStyle(CPPressStyle())
                    } else {
                        NativeMenuRow(title: name, symbol: "folder").opacity(0.5)
                    }
                    if index < classes.count - 1 { CPRowDivider(leading: 44) }
                }
            }
            .padding(.horizontal, 14)
            .cpSurface()
        }
    }

    private func classDetail(_ id: Int) -> String? {
        guard let count = classCounts[id] else { return nil }
        return count == 0 ? "Empty" : "\(count) item\(count == 1 ? "" : "s")"
    }

    private var searchResults: some View {
        VStack(alignment: .leading, spacing: 8) {
            CPSectionLabel("Results", count: searching ? nil : results.count)
            if results.isEmpty && !searching {
                CPGlassCard { NativeEmptyState(title: "No files match “\(query)”", symbol: "magnifyingglass") }
            } else {
                NativeFileRows(items: results)
            }
        }
    }

    private func loadClassFolders() async {
        await files.prepare()
        guard let root = files.root else { return }
        let entries = classes.map { (id: $0.id, name: store.displayName(courseID: $0.id, fallback: $0.name)) }
        let folders = await NativeFiles.background { NativeFiles.classFolders(root: root, classes: entries) }
        let counts = await NativeFiles.background { folders.mapValues { NativeFiles.items(in: $0).count } }
        classFolders = folders
        classCounts = counts
        classesLoaded = true
    }

    private func runSearch() async {
        let text = query
        guard let root = files.root, !text.trimmingCharacters(in: .whitespaces).isEmpty else { results = []; searching = false; return }
        searching = true
        try? await Task.sleep(for: .milliseconds(200))
        guard !Task.isCancelled else { return }
        let found = await NativeFiles.background { NativeFiles.search(text, in: root) }
        guard !Task.isCancelled else { return }
        results = found
        searching = false
    }
}

/// A folder's own page: its subfolders and files.
@MainActor
struct NativeFolderView: View {
    @ObservedObject private var files = NativeFileStore.shared
    let folder: URL
    let title: String

    var body: some View {
        ScrollView {
            NativeFolderList(folder: folder, title: "In this folder")
                .cpPagePadding()
        }
        .background(CPBackdrop())
        .cpNavigationTitle(title)
        .navigationBarTitleDisplayMode(.inline)
        .refreshable { await files.refresh() }
    }
}

/// The Files section on a class page: that class's folder, right there.
@MainActor
struct NativeClassFilesSection: View {
    @ObservedObject private var files = NativeFileStore.shared
    let courseID: Int
    let name: String
    @State private var folder: URL?

    var body: some View {
        Group {
            if let folder {
                NativeFolderList(folder: folder, title: "Files")
            } else {
                CPSkeletonCard()
            }
        }
        .task(id: files.root) {
            await files.prepare()
            guard let root = files.root else { return }
            let id = courseID
            let entry = [(id: id, name: name)]
            folder = await NativeFiles.background { NativeFiles.classFolders(root: root, classes: entry)[id] }
        }
    }
}

// MARK: - Folder contents

/// A folder's items with the Add menu, used on the Files tab, folder pages and class pages.
@MainActor
struct NativeFolderList: View {
    @Environment(\.scenePhase) private var scenePhase
    @ObservedObject private var files = NativeFileStore.shared
    let folder: URL
    var title = "Files"
    /// Root only: class folders are listed in their own section above.
    var hiddenNames: Set<String> = []
    @State private var items: [NativeFileItem] = []
    @State private var loaded = false
    @State private var busy = false
    @State private var showImporter = false
    @State private var showPhotos = false
    @State private var photoItems: [PhotosPickerItem] = []
    @State private var showScanner = false
    @State private var showNewFolder = false
    @State private var newFolderName = ""
    @State private var errorMessage: String?

    private var shown: [NativeFileItem] { items.filter { !($0.isFolder && hiddenNames.contains($0.name)) } }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            CPSectionLabel(title, count: loaded ? shown.count : nil) {
                if busy { ProgressView().controlSize(.small) }
                addMenu
            }
            if !loaded {
                CPSkeletonCard()
            } else if shown.isEmpty {
                CPGlassCard {
                    NativeEmptyState(title: "No files yet", symbol: "folder")
                }
            } else {
                NativeFileRows(items: shown)
            }
        }
        .task(id: "\(folder.path)-\(files.revision)") { await reload() }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active { Task { @MainActor in await reload() } }
        }
        .fileImporter(isPresented: $showImporter, allowedContentTypes: [.item], allowsMultipleSelection: true) { result in
            guard case .success(let urls) = result else { return }
            let folder = folder
            perform { for url in urls { try NativeFiles.importFile(url, into: folder) } }
        }
        .photosPicker(isPresented: $showPhotos, selection: $photoItems, maxSelectionCount: 30, matching: .images)
        .onChange(of: photoItems) { _, picked in
            guard !picked.isEmpty else { return }
            photoItems = []
            Task { @MainActor in await savePhotos(picked) }
        }
        .fullScreenCover(isPresented: $showScanner) {
            NativeDocumentScanner { pages in
                showScanner = false
                guard !pages.isEmpty else { return }
                let name = "Scan \(NativeFiles.stamp()).pdf"
                let folder = folder
                perform { try NativeFiles.save(NativeFiles.pdf(from: pages), named: name, in: folder) }
            }
            .ignoresSafeArea()
        }
        .alert("New folder", isPresented: $showNewFolder) {
            TextField("Folder name", text: $newFolderName)
            Button("Create") {
                let name = newFolderName
                let folder = folder
                perform { try NativeFiles.createFolder(named: name, in: folder) }
            }
            Button("Cancel", role: .cancel) {}
        }
        .alert("Couldn't finish that", isPresented: Binding(get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } })) {
            Button("OK", role: .cancel) {}
        } message: { Text(errorMessage ?? "") }
    }

    private var addMenu: some View {
        Menu {
            Button { showImporter = true } label: { Label("Import from Files", systemImage: "folder") }
            Button { showPhotos = true } label: { Label("Choose photos", systemImage: "photo.on.rectangle") }
            if VNDocumentCameraViewController.isSupported {
                Button { showScanner = true } label: { Label("Scan a document", systemImage: "doc.viewfinder") }
            }
            Divider()
            Button { newFolderName = ""; showNewFolder = true } label: { Label("New folder", systemImage: "folder.badge.plus") }
        } label: {
            CPLinkLabel(text: "Add", symbol: "plus")
        }
        .accessibilityLabel("Add to \(title)")
    }

    private func reload() async {
        let folder = folder
        let found = await NativeFiles.background { NativeFiles.items(in: folder) }
        items = found
        loaded = true
    }

    private func perform(_ work: @escaping @Sendable () throws -> Void) {
        busy = true
        Task { @MainActor in
            do { try await NativeFiles.backgroundThrowing(work) } catch { errorMessage = error.localizedDescription }
            busy = false
            files.changed()
        }
    }

    private func savePhotos(_ picked: [PhotosPickerItem]) async {
        busy = true
        let stamp = NativeFiles.stamp()
        for (offset, item) in picked.enumerated() {
            guard let data = try? await item.loadTransferable(type: Data.self) else { continue }
            let ext = item.supportedContentTypes.first?.preferredFilenameExtension ?? "jpg"
            let name = "Photo \(stamp)\(picked.count > 1 ? " \(offset + 1)" : "").\(ext)"
            let folder = folder
            do { try await NativeFiles.backgroundThrowing { try NativeFiles.save(data, named: name, in: folder) } }
            catch { errorMessage = error.localizedDescription }
        }
        busy = false
        files.changed()
    }
}

/// Rows in one card. A folder opens its page; a file opens full screen.
@MainActor
struct NativeFileRows: View {
    @Environment(\.colorScheme) private var scheme
    @Environment(\.cpPalette) private var paletteDependency
    @ObservedObject private var files = NativeFileStore.shared
    let items: [NativeFileItem]
    @State private var preview: URL?
    @State private var opening: String?
    @State private var renaming: NativeFileItem?
    @State private var showRename = false
    @State private var renameDraft = ""
    @State private var moving: NativeFileItem?
    @State private var deleting: NativeFileItem?
    @State private var errorMessage: String?

    var body: some View {
        VStack(spacing: 0) {
            ForEach(Array(items.enumerated()), id: \.element.id) { index, item in
                HStack(spacing: 4) {
                    if item.isFolder {
                        NavigationLink { NativeFolderView(folder: item.url, title: item.name) } label: { label(item) }
                            .buttonStyle(CPPressStyle())
                    } else {
                        Button { open(item) } label: { label(item) }
                            .buttonStyle(CPPressStyle())
                    }
                    Menu { actions(item) } label: {
                        Image(systemName: "ellipsis").cpIconFont(13, .medium)
                            .foregroundStyle(CPTheme.muted(scheme))
                            .frame(width: 44, height: 44)
                            .contentShape(Rectangle())
                    }
                    .accessibilityLabel("More for \(item.name)")
                }
                .contextMenu { actions(item) }
                if index < items.count - 1 { CPRowDivider(leading: 44) }
            }
        }
        .padding(.leading, 14).padding(.trailing, 4)
        .cpSurface()
        .quickLookPreview($preview)
        .alert("Rename", isPresented: $showRename) {
            TextField("Name", text: $renameDraft)
            Button("Save") {
                guard let item = renaming else { return }
                let draft = renameDraft
                perform(item) { try NativeFiles.rename(item, to: draft) }
            }
            Button("Cancel", role: .cancel) {}
        }
        .sheet(item: $moving) { item in
            if let root = files.root {
                NativeMovePicker(item: item, root: root) { destination in
                    moving = nil
                    perform(item) { try NativeFiles.move(item, into: destination) }
                }
            }
        }
        .confirmationDialog(deleting.map { "Delete “\($0.name)”?" } ?? "", isPresented: Binding(get: { deleting != nil }, set: { if !$0 { deleting = nil } }), titleVisibility: .visible, presenting: deleting) { item in
            Button("Delete", role: .destructive) { perform(item, needsDownload: false) { try NativeFiles.delete(item) } }
            Button("Cancel", role: .cancel) {}
        } message: { item in
            Text(deleteMessage(item))
        }
        .alert("Couldn't finish that", isPresented: Binding(get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } })) {
            Button("OK", role: .cancel) {}
        } message: { Text(errorMessage ?? "") }
    }

    private func label(_ item: NativeFileItem) -> some View {
        HStack(spacing: 12) {
            CPIconBadge(symbol: NativeFiles.symbol(for: item))
            VStack(alignment: .leading, spacing: 1) {
                Text(item.name).cpFont(13, .medium).foregroundStyle(CPTheme.foreground(scheme))
                    .lineLimit(2).truncationMode(.middle)
                let detail = NativeFiles.detail(for: item)
                if !detail.isEmpty { Text(detail).cpFont(11).foregroundStyle(CPTheme.muted(scheme)).lineLimit(1) }
            }
            Spacer(minLength: 4)
            if opening == item.id {
                ProgressView().controlSize(.small)
            } else if !item.isDownloaded {
                Image(systemName: "icloud.and.arrow.down").cpIconFont(12).foregroundStyle(CPTheme.faint(scheme))
            } else if item.isFolder {
                Image(systemName: "chevron.right").cpIconFont(9, .bold).foregroundStyle(CPTheme.faint(scheme))
            }
        }
        .frame(minHeight: 56)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
    }

    @ViewBuilder private func actions(_ item: NativeFileItem) -> some View {
        if !item.isFolder {
            Button { open(item) } label: { Label("Open", systemImage: "eye") }
            if item.isDownloaded {
                ShareLink(item: item.url) { Label("Share", systemImage: "square.and.arrow.up") }
            }
        }
        Button {
            renameDraft = item.isFolder ? item.name : (item.name as NSString).deletingPathExtension
            renaming = item
            showRename = true
        } label: { Label("Rename", systemImage: "pencil") }
        Button { moving = item } label: { Label("Move", systemImage: "folder") }
        Divider()
        Button(role: .destructive) { deleting = item } label: { Label("Delete", systemImage: "trash") }
    }

    private func deleteMessage(_ item: NativeFileItem) -> String {
        let what = item.isFolder ? "This folder and everything in it" : "This file"
        return files.inICloud ? "\(what) will be removed from iCloud Drive on all your devices." : "\(what) will be removed from this iPhone."
    }

    private func open(_ item: NativeFileItem) {
        guard opening == nil else { return }
        opening = item.id
        Task { @MainActor in
            do {
                try await NativeFiles.ensureDownloaded(item.url)
                preview = item.url
            } catch { errorMessage = error.localizedDescription }
            opening = nil
            if !item.isDownloaded { files.changed() }
        }
    }

    /// iCloud files are brought down first so renaming or moving acts on the real file.
    private func perform(_ item: NativeFileItem, needsDownload: Bool = true, _ work: @escaping @Sendable () throws -> Void) {
        Task { @MainActor in
            do {
                if needsDownload && !item.isDownloaded && !item.isFolder { try await NativeFiles.ensureDownloaded(item.url) }
                try await NativeFiles.backgroundThrowing(work)
            } catch { errorMessage = error.localizedDescription }
            files.changed()
        }
    }
}

/// "Move to…": every folder as an indented list.
@MainActor
struct NativeMovePicker: View {
    @Environment(\.colorScheme) private var scheme
    @Environment(\.cpPalette) private var paletteDependency
    @Environment(\.dismiss) private var dismiss
    let item: NativeFileItem
    let root: URL
    let onPick: (URL) -> Void
    @State private var choices: [NativeFolderChoice] = []

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 0) {
                    ForEach(Array(choices.enumerated()), id: \.element.id) { index, choice in
                        let current = NativeFiles.samePath(choice.url, item.url.deletingLastPathComponent())
                        Button { onPick(choice.url) } label: {
                            HStack(spacing: 12) {
                                CPIconBadge(symbol: choice.depth == 0 ? "tray.full" : "folder")
                                Text(choice.name).cpFont(13, .medium).foregroundStyle(CPTheme.foreground(scheme)).lineLimit(1)
                                Spacer(minLength: 8)
                                if current { Text("Current folder").cpFont(11).foregroundStyle(CPTheme.faint(scheme)) }
                            }
                            .padding(.leading, CGFloat(choice.depth) * 18)
                            .frame(minHeight: 52)
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(CPPressStyle())
                        .disabled(current)
                        if index < choices.count - 1 { CPRowDivider(leading: 44) }
                    }
                }
                .padding(.horizontal, 14)
                .cpSurface()
                .cpPagePadding()
            }
            .background(CPBackdrop())
            .cpNavigationTitle("Move “\(item.name)”")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } } }
            .task {
                let root = root, excluded = item.url
                choices = await NativeFiles.background { NativeFiles.folderTree(root: root, excluding: excluded) }
            }
        }
    }
}

/// Apple's document scanner (the one in Notes). Hands back the pages, or none if cancelled.
struct NativeDocumentScanner: UIViewControllerRepresentable {
    let onFinish: ([UIImage]) -> Void

    func makeUIViewController(context: Context) -> VNDocumentCameraViewController {
        let controller = VNDocumentCameraViewController()
        controller.delegate = context.coordinator
        return controller
    }

    func updateUIViewController(_ controller: VNDocumentCameraViewController, context: Context) {}

    func makeCoordinator() -> Coordinator { Coordinator(onFinish: onFinish) }

    final class Coordinator: NSObject, VNDocumentCameraViewControllerDelegate {
        let onFinish: ([UIImage]) -> Void
        init(onFinish: @escaping ([UIImage]) -> Void) { self.onFinish = onFinish }

        func documentCameraViewController(_ controller: VNDocumentCameraViewController, didFinishWith scan: VNDocumentCameraScan) {
            onFinish((0..<scan.pageCount).map { scan.imageOfPage(at: $0) })
        }

        func documentCameraViewControllerDidCancel(_ controller: VNDocumentCameraViewController) { onFinish([]) }

        func documentCameraViewController(_ controller: VNDocumentCameraViewController, didFailWithError error: Error) { onFinish([]) }
    }
}
