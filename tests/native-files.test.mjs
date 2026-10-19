import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// Class files on iPhone: the student's iCloud Drive when it's on, this iPhone
// otherwise. Nothing goes to CoursePro's servers.
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const files = read("ios/App/App/NativeFiles.swift");
const views = read("ios/App/App/NativeViews.swift");
const plist = read("ios/App/App/Info.plist");
const entitlements = read("ios/App/App/App.entitlements");
const privacy = read("ios/App/App/PrivacyInfo.xcprivacy");
const project = read("ios/App/App.xcodeproj/project.pbxproj");

test("files go to iCloud Drive when it's available, and stay on the iPhone when it isn't", () => {
  assert.match(files, /static let containerID = "iCloud\.app\.canvaspro\.mobile"/);
  assert.match(files, /manager\.ubiquityIdentityToken != nil, let container = manager\.url\(forUbiquityContainerIdentifier: containerID\)/);
  assert.match(files, /return \(documents, true\)\s*\}\s*return \(local, false\)/);
  // Saved on the iPhone first, then iCloud turned on: those files move over.
  assert.match(files, /for item in visibleChildren\(of: local\) \{ moveIntoICloud\(item, folder: documents\) \}/);
  assert.match(files, /setUbiquitous\(true, itemAt: item, destinationURL: target\)/);
  // The iCloud lookup can block, so it never runs on the main thread.
  assert.match(files, /await NativeFiles\.background \{ NativeFiles\.resolveRoot\(\) \}/);
  assert.match(files, /Task\.detached\(priority: \.userInitiated\)/);
  assert.match(files, /NSFileCoordinator\(filePresenter: nil\)\.coordinate\(writingItemAt:/);
  // Nothing uploads: there's no network call in the Files code.
  assert.doesNotMatch(files, /URLSession|api\.|supabase/i);
});

test("the iCloud container, Files app folder and camera are declared", () => {
  for (const key of ["com.apple.developer.icloud-container-identifiers", "com.apple.developer.ubiquity-container-identifiers"]) {
    assert.match(entitlements, new RegExp(`<key>${key.replace(/\./g, "\\.")}</key>\\s*<array>\\s*<string>iCloud\\.app\\.canvaspro\\.mobile</string>`));
  }
  assert.match(entitlements, /<key>com\.apple\.developer\.icloud-services<\/key>\s*<array>\s*<string>CloudDocuments<\/string>/);
  assert.match(plist, /<key>NSUbiquitousContainerIsDocumentScopePublic<\/key>\s*<true\/>/);
  assert.match(plist, /<key>UIFileSharingEnabled<\/key>\s*<true\/>/);
  assert.match(plist, /<key>LSSupportsOpeningDocumentsInPlace<\/key>\s*<true\/>/);
  assert.match(plist, /<key>NSCameraUsageDescription<\/key>\s*<string>CoursePro uses the camera to scan paper handouts/);
  assert.match(privacy, /NSPrivacyAccessedAPICategoryFileTimestamp/);
  assert.equal((project.match(/NativeFiles\.swift in Sources \*\/,/g) ?? []).length, 1, "compiled into the app only");
});

test("Files is a tab, and every class page has its folder", () => {
  assert.match(views, /NativeFilesView\(store: contentStore, features: featureStore\)\s*\.tabItem \{ Label\("Files", systemImage: "folder"\) \}\.tag\(NativeTab\.files\)/);
  assert.match(views, /announcements = "Announcements", files = "Files"/);
  assert.match(views, /case \.files: NativeClassFilesSection\(courseID: course\.id, name: courseName\)/);
  // One folder per class, remembered by class ID so a renamed class keeps it.
  assert.match(files, /static func classFolders\(root: URL, classes: \[\(id: Int, name: String\)\]\) -> \[Int: URL\]/);
  assert.match(files, /private static let classFoldersKey = "CanvasProClassFolders"/);
});

test("folders hold files, photos, scans and subfolders", () => {
  for (const label of ["Import from Files", "Choose photos", "Scan a document", "New folder", "Rename", "Move", "Share", "Delete"]) {
    assert.ok(files.includes(`"${label}"`), label);
  }
  assert.match(files, /\.fileImporter\(isPresented: \$showImporter, allowedContentTypes: \[\.item\], allowsMultipleSelection: true\)/);
  assert.match(files, /if VNDocumentCameraViewController\.isSupported/);
  assert.match(files, /\.quickLookPreview\(\$preview\)/);
  // A subfolder opens its own page with the same list, so folders nest as deep as needed.
  assert.match(files, /NavigationLink \{ NativeFolderView\(folder: item\.url, title: item\.name\) \}/);
  assert.match(files, /NativeFolderList\(folder: folder, title: "In this folder"\)/);
  // iCloud files not on this iPhone yet download when opened.
  assert.match(files, /try await NativeFiles\.ensureDownloaded\(item\.url\)\s*preview = item\.url/);
  assert.match(files, /guard raw\.hasSuffix\("\.icloud"\)/);
});

test("file names stay safe and never overwrite each other", () => {
  assert.match(files, /replacingOccurrences\(of: "\/", with: "-"\)\.replacingOccurrences\(of: ":", with: "-"\)/);
  assert.match(files, /while exists\(candidate\)/);
  assert.match(files, /throw NativeFileError\.nameTaken\(name\)/);
});
