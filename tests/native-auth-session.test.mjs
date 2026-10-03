import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Source invariants supplement the executable Swift checks run in Codemagic.
const read = file => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const core = read("ios/App/App/NativeCore.swift");
const views = read("ios/App/App/NativeViews.swift");
const secure = core.slice(core.indexOf("private enum SecureSessionStore"), core.indexOf("struct CourseSummary"));
const auth = views.slice(views.indexOf("private struct NativeAuthView"), views.indexOf("private struct NativeAuthBrand"));

test("session storage preserves existing credentials and confines volatile fallback to simulators", () => {
  const device = secure.replace(/#if targetEnvironment\(simulator\)([\s\S]*?)#endif/g,
    (_, block) => block.includes("#else") ? block.split("#else")[1] : "");
  assert.doesNotMatch(device, /previewSession/);
  assert.match(device, /throw NativeAppError\.server/);
  assert.doesNotMatch(secure, /UserDefaults\.standard|\.write\(/);
  const save = secure.slice(secure.indexOf("static func save"), secure.indexOf("static func load"));
  assert.doesNotMatch(save, /SecItemDelete/);
  assert.match(save, /SecItemUpdate/);
  assert.match(save, /if status == errSecItemNotFound/);
  assert.match(secure.slice(secure.indexOf("static func clear")), /previewSession = nil/);
});

test("successful login still authenticates remotely and saves before publishing the session", () => {
  const signIn = core.slice(core.indexOf("    func signIn(email", core.indexOf("final class NativeSessionStore")), core.indexOf("    func signUp(email", core.indexOf("final class NativeSessionStore")));
  const request = signIn.indexOf("try await api.signIn");
  const save = signIn.indexOf("try SecureSessionStore.save");
  const publish = signIn.indexOf("session = newSession");
  assert.ok(request >= 0 && save > request && publish > save);
  assert.match(signIn, /guard !isWorking/);
  assert.match(signIn, /trimmingCharacters\(in: \.whitespacesAndNewlines\)/);
});

test("concurrent account loads share refresh and cannot restore a signed-out session", () => {
  const refresh = core.slice(core.indexOf("    func accessToken"), core.indexOf("    func signOut() async", core.indexOf("final class NativeSessionStore")));
  assert.match(refresh, /if let existing = refreshTask, refreshingToken == originalToken/);
  assert.match(refresh, /guard let active = session, active.user.id == current.user.id/);
  assert.match(refresh, /guard active.refreshToken == originalToken/);
  assert.match(core, /refreshTask\?\.cancel\(\)/);
});

test("signup keeps required consent and metadata while login accepts existing passwords", () => {
  assert.match(auth, /mode == \.signIn \|\| \(password.count >= 6/);
  assert.match(auth, /ageConfirmed && legalAccepted/);
  assert.match(auth, /guard canSubmit else/);
  for (const key of ["first_name", "last_name", "age_13_or_older_confirmed", "age_confirmed_at", "terms_accepted_version", "privacy_accepted_version", "legal_accepted_at"]) {
    assert.ok(auth.includes(`"${key}"`), key);
  }
  assert.match(auth, /typeSize.isAccessibilitySize/);
  assert.match(auth, /focused\(\$focusedField/);
});

test("reset failures are visible and duplicate reset requests are disabled", () => {
  const reset = views.slice(views.indexOf("private struct PasswordResetSheet"), views.indexOf("private enum NativeTab"));
  assert.match(reset, /sessionStore.errorMessage \?\? sessionStore.configurationError/);
  assert.match(reset, /!sessionStore.isWorking/);
  assert.match(reset, /guard canSend else/);
  const workflow = read("codemagic.yaml");
  assert.equal((workflow.match(/python3 scripts\/test-native-session-store.py/g) ?? []).length, 2);
});
