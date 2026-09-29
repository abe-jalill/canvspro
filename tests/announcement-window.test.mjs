import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ANNOUNCEMENT_WINDOW_DEFAULT,
  withinAnnouncementWindow,
} from "../src/lib/announcement-window-policy.ts";

const day = 24 * 60 * 60 * 1000;
const now = Date.parse("2026-09-29T12:00:00.000Z");

test("announcements default to one week", () => {
  assert.equal(ANNOUNCEMENT_WINDOW_DEFAULT, 1);
  assert.equal(withinAnnouncementWindow(new Date(now - 6 * day).toISOString(), 1, now), true);
  assert.equal(withinAnnouncementWindow(new Date(now - 8 * day).toISOString(), 1, now), false);
});

test("two weeks, one month, and all use their full selected window", () => {
  assert.equal(withinAnnouncementWindow(new Date(now - 13 * day).toISOString(), 2, now), true);
  assert.equal(withinAnnouncementWindow(new Date(now - 20 * day).toISOString(), 2, now), false);
  assert.equal(withinAnnouncementWindow(new Date(now - 27 * day).toISOString(), 4, now), true);
  assert.equal(withinAnnouncementWindow(new Date(now - 1000 * day).toISOString(), 0, now), true);
});
