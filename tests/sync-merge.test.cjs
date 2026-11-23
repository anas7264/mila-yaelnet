"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
let createSnapshot;
let mergeSnapshots;
test.before(async () => {
  ({ createSnapshot } = await import("../sync-core.mjs"));
  ({ mergeSnapshots } = await import("../sync-merge-core.mjs"));
});

const MAIN = "mila-yaelnet-studio-v3";
const ADAPTIVE = "mila-yaelnet-adaptive-v1";
const scheduleReview = (previous, grade, at) => ({
  rating: grade,
  intervalDays: grade === "again" ? 0.01 : (Number(previous.repetitions) || 0) + 1,
  dueAt: at + 60000,
  repetitions: grade === "again" ? 0 : (Number(previous.repetitions) || 0) + 1,
  ease: 2.3,
  lapses: (Number(previous.lapses) || 0) + (grade === "again" ? 1 : 0),
  lastReviewedAt: at
});
const snapshot = (main, adaptive = null) => createSnapshot([
  [MAIN, JSON.stringify(main)],
  ...(adaptive ? [[ADAPTIVE, JSON.stringify(adaptive)]] : [])
]);
const baseProgress = {
  attempts: 2, correct: 1, incorrect: 1, mistakes: 1, consecutiveCorrect: 0,
  dueAt: 100, intervalDays: 1, repetitions: 1, ease: 2.3, lapses: 0,
  lastReviewedAt: 100, lastAnswerAt: 100, favorite: false, mastered: false
};
const baseMain = () => ({
  version: 3, migrations: {}, extras: [], progress: { "word-1": { ...baseProgress } },
  mistakes: [], sessions: [], settings: { theme: "light", dailyGoal: 10 },
  daily: { lastDate: "2026-11-22", streak: 3, completed: 2 },
  legacyTotals: null, adaptiveEventIds: { "answer:old": 100 },
  learningEvents: {
    "answer:old": { eventId: "old", wordId: "word-1", correct: false, at: 100, date: "2026-11-22", direction: null }
  },
  lastSessionSummary: null, completedStageIds: []
});
const event = (eventId, correct, at, direction = null) => ({
  eventId, wordId: "word-1", correct, selectedWordId: null,
  source: "test", at, date: "2026-11-23", direction
});
const applyOne = (previous, correct, at) => {
  const next = {
    ...previous,
    attempts: previous.attempts + 1,
    correct: previous.correct + (correct ? 1 : 0),
    incorrect: previous.incorrect + (correct ? 0 : 1),
    mistakes: previous.mistakes + (correct ? 0 : 1),
    consecutiveCorrect: correct ? previous.consecutiveCorrect + 1 : 0,
    lastAnswerAt: at
  };
  Object.assign(next, scheduleReview(previous, correct ? "good" : "again", at));
  return next;
};

test("three-way merge replays independent answer events instead of maxing counters", () => {
  const base = baseMain();
  const one = event("event-1", true, 200, "he-ar");
  const two = event("event-2", false, 300, "ar-he");
  const local = structuredClone(base);
  const remote = structuredClone(base);
  local.learningEvents["answer:event-1"] = one;
  local.adaptiveEventIds["answer:event-1"] = 200;
  local.progress["word-1"] = { ...applyOne(baseProgress, true, 200), favorite: true };
  local.daily = { lastDate: "2026-11-23", streak: 4, completed: 1 };
  local.sessions = [{ id: "session-local", finishedAt: 220, total: 1 }];
  remote.learningEvents["answer:event-2"] = two;
  remote.adaptiveEventIds["answer:event-2"] = 300;
  remote.progress["word-1"] = applyOne(baseProgress, false, 300);
  remote.daily = { lastDate: "2026-11-23", streak: 4, completed: 1 };
  remote.mistakes = [{ id: "mistake-remote", wordId: "word-1", createdAt: 300 }];
  remote.sessions = [{ id: "session-remote", finishedAt: 310, total: 1 }];

  const baseAdaptive = {
    version: 1,
    progress: { "word-1": {
      heToAr: { attempts: 1, correct: 1, incorrect: 0, consecutiveCorrect: 1, failures: 0, priority: 2, cooldownCycles: 0, lastSeenAt: 100, lastResult: "correct" },
      arToHe: { attempts: 1, correct: 0, incorrect: 1, consecutiveCorrect: 0, failures: 1, priority: 3, cooldownCycles: 0, lastSeenAt: 100, lastResult: "incorrect" }
    } },
    session: null, policy: { minDelay: 2, maxDelay: 6, maxRetries: 3 }, migrations: {}
  };
  const localAdaptive = structuredClone(baseAdaptive);
  localAdaptive.progress["word-1"].heToAr = {
    attempts: 2, correct: 2, incorrect: 0, consecutiveCorrect: 2, failures: 0, priority: 1, cooldownCycles: 0, lastSeenAt: 200, lastResult: "correct"
  };
  const remoteAdaptive = structuredClone(baseAdaptive);
  remoteAdaptive.progress["word-1"].arToHe = {
    attempts: 2, correct: 0, incorrect: 2, consecutiveCorrect: 0, failures: 2, priority: 7, cooldownCycles: 0, lastSeenAt: 300, lastResult: "incorrect"
  };

  const result = mergeSnapshots(
    snapshot(base, baseAdaptive),
    snapshot(local, localAdaptive),
    snapshot(remote, remoteAdaptive),
    { scheduleReview }
  );
  assert.equal(result.ok, true, result.conflicts?.join(", "));
  const mergedEntries = Object.fromEntries(result.snapshot.entries);
  const mergedMain = JSON.parse(mergedEntries[MAIN]);
  const mergedAdaptive = JSON.parse(mergedEntries[ADAPTIVE]);
  assert.equal(mergedMain.progress["word-1"].attempts, 4);
  assert.equal(mergedMain.progress["word-1"].correct, 2);
  assert.equal(mergedMain.progress["word-1"].incorrect, 2);
  assert.equal(mergedMain.progress["word-1"].favorite, true);
  assert.deepEqual(mergedMain.daily, { lastDate: "2026-11-23", streak: 4, completed: 2 });
  assert.deepEqual(mergedMain.sessions.map(item => item.id).sort(), ["session-local", "session-remote"]);
  assert.equal(mergedMain.mistakes.length, 1);
  assert.equal(mergedAdaptive.progress["word-1"].heToAr.attempts, 2);
  assert.equal(mergedAdaptive.progress["word-1"].arToHe.attempts, 2);
});

test("same answer event arriving on both devices is replayed only once", () => {
  const base = baseMain();
  const shared = event("same-event", true, 200);
  const local = structuredClone(base);
  const remote = structuredClone(base);
  for (const state of [local, remote]) {
    state.learningEvents["answer:same-event"] = shared;
    state.adaptiveEventIds["answer:same-event"] = 200;
    state.progress["word-1"] = applyOne(baseProgress, true, 200);
  }
  const result = mergeSnapshots(snapshot(base), snapshot(local), snapshot(remote), { scheduleReview });
  assert.equal(result.ok, true, result.conflicts?.join(", "));
  const merged = JSON.parse(Object.fromEntries(result.snapshot.entries)[MAIN]);
  assert.equal(merged.progress["word-1"].attempts, 3);
  assert.equal(Object.keys(merged.learningEvents).filter(id => id === "answer:same-event").length, 1);
});

test("concurrent legacy progress changes without event payloads remain a conflict", () => {
  const base = baseMain();
  const local = structuredClone(base);
  const remote = structuredClone(base);
  local.progress["word-1"] = { ...baseProgress, attempts: 3, correct: 2 };
  remote.progress["word-1"] = { ...baseProgress, attempts: 3, incorrect: 2 };
  const result = mergeSnapshots(snapshot(base), snapshot(local), snapshot(remote), { scheduleReview });
  assert.equal(result.ok, false);
  assert.ok(result.conflicts.some(path => path.includes("progress.word-1")));
});

test("independent settings and append-only arrays merge without conflict", () => {
  const base = baseMain();
  const local = structuredClone(base);
  const remote = structuredClone(base);
  local.settings.theme = "dark";
  local.sessions.push({ id: "local", finishedAt: 100 });
  remote.settings.dailyGoal = 20;
  remote.sessions.push({ id: "remote", finishedAt: 200 });
  const result = mergeSnapshots(snapshot(base), snapshot(local), snapshot(remote), { scheduleReview });
  assert.equal(result.ok, true, result.conflicts?.join(", "));
  const merged = JSON.parse(Object.fromEntries(result.snapshot.entries)[MAIN]);
  assert.equal(merged.settings.theme, "dark");
  assert.equal(merged.settings.dailyGoal, 20);
  assert.deepEqual(merged.sessions.map(item => item.id).sort(), ["local", "remote"]);
});

test("same-field concurrent settings edits are not silently overwritten", () => {
  const base = baseMain();
  const local = structuredClone(base);
  const remote = structuredClone(base);
  local.settings.theme = "dark";
  remote.settings.theme = "contrast";
  const result = mergeSnapshots(snapshot(base), snapshot(local), snapshot(remote), { scheduleReview });
  assert.equal(result.ok, false);
  assert.ok(result.conflicts.some(path => path.includes("settings.theme")));
});
