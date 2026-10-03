import { test } from "node:test";
import assert from "node:assert/strict";
import {
  POMODORO_LIMITS,
  POMODORO_PRESETS,
  advanceSession,
  buildPomodoroPlan,
  createStudySession,
  isBreak,
  isStudySessionSnapshot,
  phaseOf,
  remainingForSession,
  skipBreak,
} from "../src/lib/study-session.ts";

const MIN = 60_000;
const plan = POMODORO_PRESETS[0].plan; // 25 focus, 5 short break, 15 long break, long every 4th
const items = [{ id: "manual:1", name: "Read chapter 3", source: "manual" }];
const t0 = Date.UTC(2026, 9, 5, 14, 0, 0);

const fresh = () => createStudySession(items, 25, t0, plan);

test("a pomodoro session starts with a focus block", () => {
  const session = fresh();
  assert.equal(phaseOf(session), "focus");
  assert.equal(session.round, 0);
  assert.equal(session.durationMs, 25 * MIN);
  assert.equal(session.endsAt, t0 + 25 * MIN);
  assert.equal(isBreak(session), false);
});

test("nothing changes before the block runs out", () => {
  const session = fresh();
  const result = advanceSession(session, t0 + 25 * MIN - 1);
  assert.equal(result.changed, false);
  assert.equal(result.session, session);
});

test("focus is followed by a short break that starts exactly where focus ended", () => {
  const { session, changed } = advanceSession(fresh(), t0 + 25 * MIN + 4_000);
  assert.equal(changed, true);
  assert.equal(phaseOf(session), "short-break");
  assert.equal(isBreak(session), true);
  assert.equal(session.round, 1);
  assert.equal(session.durationMs, 5 * MIN);
  assert.equal(session.endsAt, t0 + 30 * MIN, "no drift from the late check");
});

test("a break is followed by focus, and the round count stays put", () => {
  let session = advanceSession(fresh(), t0 + 25 * MIN).session;
  session = advanceSession(session, t0 + 30 * MIN).session;
  assert.equal(phaseOf(session), "focus");
  assert.equal(session.round, 1);
  assert.equal(session.endsAt, t0 + 55 * MIN);
});

test("every fourth focus block earns the long break, then the cycle restarts", () => {
  let session = fresh();
  const phases = [];
  let now = t0;
  for (let i = 0; i < 9; i += 1) {
    now = session.endsAt;
    session = advanceSession(session, now).session;
    phases.push(phaseOf(session));
  }
  assert.deepEqual(phases, [
    "short-break", // after focus 1
    "focus",
    "short-break", // after focus 2
    "focus",
    "short-break", // after focus 3
    "focus",
    "long-break", // after focus 4
    "focus",
    "short-break", // after focus 5: a new cycle
  ]);
  assert.equal(session.round, 5);
});

test("a paused session never advances", () => {
  const paused = { ...fresh(), status: "paused", remainingMs: 3 * MIN };
  const result = advanceSession(paused, t0 + 5 * 60 * MIN);
  assert.equal(result.changed, false);
  assert.equal(remainingForSession(paused, t0 + 99 * MIN), 3 * MIN);
});

test("coming back after a long absence lands in a sensible block, not a replay", () => {
  const { session } = advanceSession(fresh(), t0 + 10 * 60 * MIN);
  assert.ok(session.endsAt > t0 + 10 * 60 * MIN, "the current block ends in the future");
  assert.ok(session.endsAt - (t0 + 10 * 60 * MIN) <= session.durationMs);
  assert.ok(session.round >= 1);
  assert.equal(session.remainingMs, session.durationMs);
});

test("a late check that spans two blocks keeps the timeline continuous", () => {
  // 25 focus + 5 break are both over; we are 2 minutes into the second focus block.
  const { session } = advanceSession(fresh(), t0 + 32 * MIN);
  assert.equal(phaseOf(session), "focus");
  assert.equal(session.round, 1);
  assert.equal(session.endsAt, t0 + 55 * MIN);
});

test("skipping a break starts the next focus block immediately", () => {
  const onBreak = advanceSession(fresh(), t0 + 25 * MIN).session;
  const now = t0 + 26 * MIN;
  const resumed = skipBreak(onBreak, now);
  assert.equal(phaseOf(resumed), "focus");
  assert.equal(resumed.round, 1);
  assert.equal(resumed.endsAt, now + 25 * MIN);
  assert.equal(resumed.status, "running");
});

test("skipping does nothing during focus or on a plain timer", () => {
  const focus = fresh();
  assert.equal(skipBreak(focus, t0 + MIN), focus);
  const plain = createStudySession(items, 25, t0);
  assert.equal(skipBreak(plain, t0 + MIN), plain);
});

test("a plain timer is exactly what it was before", () => {
  const plain = createStudySession(items, 45, t0);
  assert.equal(plain.pomodoro, undefined);
  assert.equal(plain.phase, undefined);
  assert.equal(plain.durationMs, 45 * MIN);
  assert.equal(advanceSession(plain, t0 + 90 * MIN).changed, false);
  assert.equal(isBreak(plain), false);
  assert.equal(phaseOf(plain), "focus");
});

test("old saved sessions and new pomodoro sessions both load", () => {
  assert.equal(isStudySessionSnapshot(createStudySession(items, 25, t0)), true);
  assert.equal(isStudySessionSnapshot(fresh()), true);
  const advanced = advanceSession(fresh(), t0 + 25 * MIN).session;
  assert.equal(isStudySessionSnapshot(JSON.parse(JSON.stringify(advanced))), true);
});

test("a malformed pomodoro is rejected instead of trusted", () => {
  const bad = (patch) => isStudySessionSnapshot({ ...fresh(), ...patch });
  assert.equal(bad({ phase: "nap" }), false);
  assert.equal(bad({ round: -1 }), false);
  assert.equal(bad({ round: 1.5 }), false);
  assert.equal(bad({ pomodoro: { ...plan, focusMs: 0 } }), false);
  assert.equal(bad({ pomodoro: { ...plan, roundsBeforeLongBreak: 0 } }), false);
  assert.equal(bad({ pomodoro: "yes" }), false);
});

test("the 50 minute preset keeps its own break lengths", () => {
  const deep = createStudySession(items, 25, t0, POMODORO_PRESETS[1].plan);
  assert.equal(deep.durationMs, 50 * MIN);
  const afterFocus = advanceSession(deep, t0 + 50 * MIN).session;
  assert.equal(afterFocus.durationMs, 10 * MIN);
});

test("a custom plan uses exactly what was typed", () => {
  const custom = buildPomodoroPlan({ focus: "40", shortBreak: "8", longBreak: "20", rounds: "3" });
  assert.deepEqual(custom, {
    focusMs: 40 * MIN,
    shortBreakMs: 8 * MIN,
    longBreakMs: 20 * MIN,
    roundsBeforeLongBreak: 3,
  });
});

test("custom values are rounded to whole numbers and kept inside the limits", () => {
  const wild = buildPomodoroPlan({ focus: 9999, shortBreak: 0, longBreak: -5, rounds: 100 });
  assert.equal(wild.focusMs, POMODORO_LIMITS.focus.max * MIN);
  assert.equal(wild.shortBreakMs, POMODORO_LIMITS.shortBreak.min * MIN);
  assert.equal(wild.longBreakMs, POMODORO_LIMITS.longBreak.min * MIN);
  assert.equal(wild.roundsBeforeLongBreak, POMODORO_LIMITS.rounds.max);
  assert.equal(buildPomodoroPlan({ focus: 24.6, shortBreak: 5, longBreak: 15, rounds: 4 }).focusMs, 25 * MIN);
  assert.equal(buildPomodoroPlan({ focus: 25, shortBreak: 5, longBreak: 15, rounds: 1 }).roundsBeforeLongBreak, 2);
});

test("empty or invalid fields fall back to the classic plan", () => {
  const fallback = buildPomodoroPlan({ focus: "", shortBreak: undefined, longBreak: "abc", rounds: null });
  assert.deepEqual(fallback, POMODORO_PRESETS[0].plan);
});

test("a custom plan runs through the whole cycle and survives saving", () => {
  const custom = buildPomodoroPlan({ focus: 10, shortBreak: 2, longBreak: 6, rounds: 2 });
  let session = createStudySession(items, 25, t0, custom);
  assert.equal(isStudySessionSnapshot(JSON.parse(JSON.stringify(session))), true);
  const phases = [];
  for (let i = 0; i < 5; i += 1) {
    session = advanceSession(session, session.endsAt).session;
    phases.push(`${phaseOf(session)}:${Math.round(session.durationMs / MIN)}`);
  }
  // Long break after every 2nd focus block.
  assert.deepEqual(phases, ["short-break:2", "focus:10", "long-break:6", "focus:10", "short-break:2"]);
});
