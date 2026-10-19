import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// Source checks for Sign in with Apple (App Review Guidelines 4.8 and 5.1.1(v)).
// Swift itself is compiled by Codemagic.
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const core = read("ios/App/App/NativeCore.swift");
const views = read("ios/App/App/NativeViews.swift");
const more = read("ios/App/App/NativeMoreViews.swift");

test("the app has the Sign in with Apple capability and Apple's own button", () => {
  assert.match(
    read("ios/App/App/App.entitlements"),
    /<key>com\.apple\.developer\.applesignin<\/key>\s*<array>\s*<string>Default<\/string>/,
  );
  assert.match(views, /SignInWithAppleButton\(label\)/);
  assert.match(views, /signInWithAppleButtonStyle\(scheme == \.dark \? \.white : \.black\)/);
  // As large as the main button, on the same screen.
  assert.match(views, /NativeAppleSignInButton\(sessionStore: sessionStore, label:/);
  assert.match(views, /\.frame\(height: 50\)/);
});

test("Supabase gets the raw nonce and Apple its SHA-256", () => {
  assert.match(views, /request\.nonce = nonce\.hashed/);
  assert.match(core, /"grant_type", value: "id_token"/);
  assert.match(core, /"provider": "apple", "id_token": idToken, "nonce": rawNonce/);
  assert.match(core, /SHA256\.hash\(data: Data\(raw\.utf8\)\)/);
});

test("Apple's name is saved once and never asked for again", () => {
  assert.match(core, /credential\.fullName\?\.givenName/);
  assert.match(core, /fields\["profile_setup_prompted"\] = true/);
});

test("a new Apple account confirms age and terms like an email sign-up, or is deleted", () => {
  assert.match(core, /metadata\["legal_accepted_at"\] == nil \|\| metadata\["age_18_or_older_confirmed"\] as\? Bool != true/);
  for (const key of ["age_18_or_older_confirmed", "age_confirmed_at", "terms_accepted_version", "privacy_accepted_version", "legal_accepted_at"]) {
    assert.ok(core.includes(`"${key}"`), key);
  }
  assert.match(views, /\.disabled\(!ageConfirmed \|\| !legalAccepted \|\| sessionStore\.isWorking\)/);
  assert.match(core, /func declinePendingAppleAccount[\s\S]*?deleteAccount\(token: pending\.session\.accessToken, appleAuthorizationCode: pending\.authorizationCode\)/);
});

test("deleting an Apple account confirms with Apple so the server can revoke it", () => {
  assert.match(more, /if sessionStore\.session\?\.user\.usesApple == true/);
  assert.match(more, /sessionStore\.deleteAccount\(appleAuthorizationCode: code\)/);
  assert.match(core, /body\["appleAuthorizationCode"\] = appleAuthorizationCode/);
});

test("stopping Sign in with Apple in Settings signs the app out", () => {
  assert.match(views, /credentialRevokedNotification/);
  assert.match(core, /if state == \.revoked \|\| state == \.notFound \{ await signOut\(\) \}/);
});
