"""Run the actual Swift session-store code against controlled Keychain failures.

Requires Apple's Swift/Foundation compiler (run in Codemagic before xcodebuild).
Security calls are mocked; this tests our error handling, not OS entitlements.
"""
import pathlib
import subprocess
import tempfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
source = (ROOT / "ios/App/App/NativeCore.swift").read_text(encoding="utf-8")
errors = source[source.index("enum NativeAppError:"):source.index("struct NativeConfiguration")]
models = source[source.index("struct NativeUser:"):source.index("private enum SecureSessionStore")]
store = source[source.index("private enum SecureSessionStore"):source.index("struct CourseSummary:")]
store = store.replace("#if targetEnvironment(simulator)", "#if SIMULATOR_TEST")

mocks = r'''
import Foundation
import CoreFoundation
typealias OSStatus = Int32
let errSecSuccess: OSStatus = 0
let errSecItemNotFound: OSStatus = -25300
let kSecValueData = "value"
let kSecAttrAccessible = "accessible"
let kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly = "device-only"
let kSecReturnData = "return-data"
let kSecMatchLimit = "limit"
let kSecMatchLimitOne = "one"
let kSecClass = "class"
let kSecClassGenericPassword = "password"
let kSecAttrService = "service"
let kSecAttrAccount = "account"
var updateStatus: OSStatus = errSecSuccess
var addStatus: OSStatus = errSecSuccess
var loadData: Data?
var updateCalls = 0
var addCalls = 0
var deleteCalls = 0
func SecItemUpdate(_ query: CFDictionary, _ attributes: CFDictionary) -> OSStatus {
    updateCalls += 1
    return updateStatus
}
func SecItemAdd(_ query: CFDictionary, _ result: UnsafeMutablePointer<CFTypeRef?>?) -> OSStatus {
    addCalls += 1
    return addStatus
}
@discardableResult func SecItemDelete(_ query: CFDictionary) -> OSStatus {
    deleteCalls += 1
    loadData = nil
    return errSecSuccess
}
func SecItemCopyMatching(_ query: CFDictionary, _ result: UnsafeMutablePointer<CFTypeRef?>) -> OSStatus {
    guard let loadData else { return errSecItemNotFound }
    result.pointee = loadData as NSData
    return errSecSuccess
}
func expect(_ condition: @autoclosure () -> Bool, _ message: String) {
    precondition(condition(), message)
}
'''

checks = r'''
let first = NativeSession(accessToken: "test-access", refreshToken: "test-refresh", expiresAt: Date(timeIntervalSince1970: 10000), user: NativeUser(id: "first", email: "test@example.com"))
let second = NativeSession(accessToken: "new-access", refreshToken: "new-refresh", expiresAt: Date(timeIntervalSince1970: 20000), user: first.user)
try SecureSessionStore.save(first)
expect(updateCalls == 1 && addCalls == 0 && deleteCalls == 0, "Updating must not delete or recreate a stored session")
updateStatus = errSecItemNotFound
try SecureSessionStore.save(second)
expect(addCalls == 1 && deleteCalls == 0, "Only missing items should be inserted")
loadData = try JSONEncoder().encode(second)
expect(SecureSessionStore.load() == second, "Stored session must round-trip")

// Entitlement errors must never erase an existing session.
updateStatus = -34018
addCalls = 0
#if SIMULATOR_TEST
try SecureSessionStore.save(first)
expect(SecureSessionStore.load() == first, "Unsigned simulator must retain authenticated session in memory")
#else
do {
    try SecureSessionStore.save(first)
    fatalError("Device must refuse insecure fallback")
} catch {
    expect(error.localizedDescription.contains("-34018"), "Device error must identify storage failure")
}
expect(SecureSessionStore.load() == second, "Failed device save must preserve previous Keychain session")
#endif
expect(addCalls == 0 && deleteCalls == 0, "Entitlement failure must not add or delete items")

// A failed insert also supports hosted previews, but never real devices.
updateStatus = errSecItemNotFound
addStatus = -25291
#if SIMULATOR_TEST
try SecureSessionStore.save(first)
expect(SecureSessionStore.load() == first, "Simulator fallback also covers failed inserts")
#else
do {
    try SecureSessionStore.save(first)
    fatalError("Failed device insert must throw")
} catch {
    expect(error.localizedDescription.contains("-25291"), "Device insert error must retain OS status")
}
#endif

updateStatus = errSecSuccess
loadData = try JSONEncoder().encode(second)
try SecureSessionStore.save(second)
expect(SecureSessionStore.load() == second, "Successful save must replace any stale simulator fallback")
SecureSessionStore.clear()
expect(SecureSessionStore.load() == nil, "Sign-out must clear memory and Keychain")
expect(deleteCalls == 1, "Only explicit sign-out should delete the session")
print("Session storage checks passed")
'''

with tempfile.TemporaryDirectory(prefix="native-session-check-") as scratch:
    swift_file = pathlib.Path(scratch) / "SessionChecks.swift"
    swift_file.write_text(mocks + errors + models + store + checks, encoding="utf-8")
    for mode in ("device", "simulator"):
        executable = pathlib.Path(scratch) / mode
        command = ["swiftc", "-swift-version", "5", str(swift_file), "-o", str(executable)]
        if mode == "simulator":
            command += ["-D", "SIMULATOR_TEST"]
        subprocess.run(command, check=True)
        subprocess.run([str(executable)], check=True)
