"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const Rules = require("../static/integrity/integrity-rules.js");
const Monitor = require("../static/integrity/integrity-monitor.js");
const Engine = require("../static/adaptive-engine.js");

function state(overrides = {}) {
  const session = {
    id: "session-a", direction: "he-ar", queue: ["w1", "w2", "w1"],
    cursor: 0, cycle: 1, retryCounts: {}, answered: false, paused: false,
    questionId: "session-a:1:0:w1", attempts: 0, correct: 0, incorrect: 0,
    results: [], startedAt: 1000, ...(overrides.session || {})
  };
  return { version: 1, policy: { minDelay: 2, maxDelay: 4, maxRetries: 3 },
    progress: {}, ...overrides, session };
}

test("LIM emits ten checks and never mutates its input", () => {
  const input = state();
  const before = JSON.stringify(input);
  const report = Monitor.create({ localState: input });
  assert.equal(report.checks.length, 10);
  assert.equal(report.mode, "read-only");
  assert.equal(JSON.stringify(input), before);
  assert.equal(report.summary.total, 10);
});

test("session accounting detects inconsistent counters", () => {
  const report = Rules.run({ localState: state({ session: { attempts: 2, correct: 2, incorrect: 1 } }) });
  assert.equal(report.checks.find(x => x.id === "answer_accounting").status, "FAIL");
});

test("cursor bounds reject an index beyond the queue", () => {
  const report = Rules.run({ localState: state({ session: { cursor: 4 } }) });
  assert.equal(report.checks.find(x => x.id === "cursor_bounds").status, "FAIL");
});

test("result consistency validates retained result totals and shape", () => {
  const report = Rules.run({ localState: state({ session: {
    attempts: 1, correct: 1, incorrect: 0,
    results: [{ questionId: "q", wordId: "w1", correct: false }]
  } }) });
  assert.equal(report.checks.find(x => x.id === "result_consistency").status, "FAIL");
});

test("retry limits validate persisted retry counters without guessing retry timing", () => {
  const report = Rules.run({ localState: state({ session: { retryCounts: { w1: 4 } } }) });
  assert.equal(report.checks.find(x => x.id === "retry_limits").status, "FAIL");
  const valid = Rules.run({ localState: state() });
  assert.equal(valid.checks.find(x => x.id === "retry_eligibility").status, "UNKNOWN");
});

test("question identity rejects stale or mismatched current-question IDs", () => {
  const report = Rules.run({ localState: state({ session: { questionId: "old-question" } }) });
  assert.equal(report.checks.find(x => x.id === "question_identity").status, "FAIL");
});

test("event consistency detects duplicate event identifiers without exposing event contents", () => {
  const report = Rules.run({ localState: state(), events: [{ eventId: "e1" }, { eventId: "e1" }], eventIds: { e1: true } });
  const check = report.checks.find(x => x.id === "event_consistency");
  assert.equal(check.status, "FAIL");
  assert.equal(JSON.stringify(report).includes("word prompt"), false);
});

test("equal revisions with different snapshots fail; unequal revisions warn", () => {
  const sameRevision = Rules.run({ localState: state(), localSnapshot: { progress: { w1: 1 } },
    cloudSnapshot: { progress: { w1: 2 } }, localRevision: 4, cloudRevision: 4 });
  assert.equal(sameRevision.checks.find(x => x.id === "snapshot_consistency").status, "FAIL");
  const different = Rules.run({ localState: state(), localSnapshot: {}, cloudSnapshot: {},
    localRevision: 5, cloudRevision: 4 });
  assert.equal(different.checks.find(x => x.id === "snapshot_consistency").status, "WARN");
});

test("sync ledger detects revision mismatches and warns for historical gaps", () => {
  const invalid = Rules.run({ localState: state(), syncLedger: {
    snapshotRevision: 8, ledgerCount: 7, minRevision: 1, maxRevision: 7,
    distinctRevisions: 7, lastMutationPresent: true
  } });
  assert.equal(invalid.checks.find(x => x.id === "sync_integrity").status, "FAIL");
  const gap = Rules.run({ localState: state(), syncLedger: {
    snapshotRevision: 186, ledgerCount: 160, minRevision: 27, maxRevision: 186,
    distinctRevisions: 160, lastMutationPresent: true
  } });
  assert.equal(gap.checks.find(x => x.id === "sync_integrity").status, "WARN");
});

test("storage adapter is read-only and handles invalid JSON", () => {
  let writes = 0;
  const storage = { getItem: () => "{broken", setItem: () => { writes += 1; } };
  assert.equal(Monitor.inspectLocalStorage(storage, "key").reason, "invalid-json");
  assert.equal(writes, 0);
});

test("missing optional data is UNKNOWN rather than a false failure", () => {
  const report = Rules.run({ localState: state() });
  assert.equal(report.checks.find(x => x.id === "event_consistency").status, "UNKNOWN");
  assert.equal(report.checks.find(x => x.id === "snapshot_consistency").status, "UNKNOWN");
  assert.equal(report.checks.find(x => x.id === "sync_integrity").status, "UNKNOWN");
});

test("real adaptive-engine session state satisfies LIM invariants without mutation", () => {
  const words = [
    { id: "w1", he: "מטרה", ar: "هدف" },
    { id: "w2", he: "תוצאה", ar: "نتيجة" },
    { id: "w3", he: "השפעה", ar: "تأثير" }
  ];
  const started = Engine.startSession(Engine.createState(), words, "he-ar", () => 0);
  const question = Engine.currentQuestion(started, words);
  const answered = Engine.submitAnswer(started, words, "wrong", {
    questionId: question.questionId, now: 1700000000000, random: () => 0
  });
  assert.equal(answered.accepted, true);
  const before = JSON.stringify(answered.state);
  const report = Monitor.create({ localState: answered.state });
  assert.equal(JSON.stringify(answered.state), before);
  assert.equal(report.checks.find(x => x.id === "session_structure").status, "PASS");
  assert.equal(report.checks.find(x => x.id === "cursor_bounds").status, "PASS");
  assert.equal(report.checks.find(x => x.id === "answer_accounting").status, "PASS");
  assert.equal(report.checks.find(x => x.id === "result_consistency").status, "PASS");
  assert.equal(report.checks.find(x => x.id === "retry_limits").status, "PASS");
  assert.equal(report.checks.find(x => x.id === "question_identity").status, "PASS");
  assert.equal(report.checks.find(x => x.id === "retry_eligibility").status, "UNKNOWN");
});

test("event consistency understands MILA's real keyed learningEvents storage shape", () => {
  const id = "mila-answer-v1:session%3A1%3A0%3Aw1";
  const key = "answer:" + id;
  const report = Rules.run({
    localState: state(),
    learningEvents: {
      [key]: { eventId: id, wordId: "w1", correct: false, at: 1700000000000 }
    },
    adaptiveEventIds: { [key]: 1700000000000 }
  });
  assert.equal(report.checks.find(x => x.id === "event_consistency").status, "PASS");
});

test("event consistency detects orphaned and mismatched MILA event keys", () => {
  const report = Rules.run({
    localState: state(),
    learningEvents: {
      "answer:event-a": { eventId: "event-b", wordId: "w1", correct: true }
    },
    adaptiveEventIds: { "answer:event-a": 1700000000000, "answer:orphan": 1700000000001 }
  });
  assert.equal(report.checks.find(x => x.id === "event_consistency").status, "FAIL");
});

test("MILA storage adapter reads only the two known state keys and never writes", () => {
  const values = {
    "mila-yaelnet-adaptive-v1": JSON.stringify(Engine.createState()),
    "mila-yaelnet-studio-v3": JSON.stringify({
      version: 3,
      learningEvents: { "answer:e1": { eventId: "e1", wordId: "w1", correct: true } },
      adaptiveEventIds: { "answer:e1": 1700000000000 }
    })
  };
  const reads = [];
  let writes = 0;
  const storage = {
    getItem(key) { reads.push(key); return values[key] ?? null; },
    setItem() { writes += 1; },
    removeItem() { writes += 1; },
    clear() { writes += 1; }
  };
  const snapshot = Monitor.inspectMilaStorage(storage);
  assert.equal(snapshot.available, true);
  assert.equal(snapshot.eventSourceAvailable, true);
  assert.deepEqual(reads.sort(), ["mila-yaelnet-adaptive-v1", "mila-yaelnet-studio-v3"]);
  assert.equal(writes, 0);
  reads.length = 0;
  const report = Monitor.createFromStorage(storage);
  assert.equal(report.checks.find(x => x.id === "event_consistency").status, "PASS");
  assert.deepEqual(reads.sort(), ["mila-yaelnet-adaptive-v1", "mila-yaelnet-studio-v3"]);
  assert.equal(writes, 0);
});

test("retry policy outside adaptive-engine bounds fails closed", () => {
  const report = Rules.run({
    localState: state({ policy: { minDelay: 9, maxDelay: 4, maxRetries: 3 } })
  });
  assert.equal(report.checks.find(x => x.id === "retry_limits").status, "FAIL");
});

test("overall report status gives confirmed failures precedence over unknown evidence", () => {
  const report = Rules.run({
    localState: state({ session: { attempts: 1, correct: 1, incorrect: 0, results: [{ questionId: "session-a:1:0:w1", wordId: "w1", correct: true }] } })
  });
  assert.equal(report.checks.find(x => x.id === "answer_accounting").status, "PASS");
  assert.equal(report.checks.find(x => x.id === "event_consistency").status, "UNKNOWN");
  assert.equal(report.status, "UNKNOWN");
  assert.equal(report.summary.total, 10);
  assert.equal(report.summary.pass + report.summary.fail + report.summary.warn + report.summary.unknown, 10);
});
