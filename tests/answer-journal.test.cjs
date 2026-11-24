"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const Journal = require("../static/answer-journal.js");

function memoryStorage() {
  const values = new Map();
  return {
    get length() { return values.size; },
    key: index => [...values.keys()][index] ?? null,
    getItem: key => values.get(key) ?? null,
    setItem: (key,value) => values.set(key,String(value)),
    removeItem: key => values.delete(key)
  };
}
const event = (id="event-1", extra={}) => ({
  eventId:id, sessionId:"session-1", wordId:"word-1", mode:"typed-he-ar",
  direction:"he-ar", prompt:"שלום", typedAnswer:"hello", correctAnswer:"مرحبا",
  isCorrect:false, ...extra
});

test("answer journal preserves incorrect and typed answers independently of progress snapshots", () => {
  const storage = memoryStorage();
  Journal.append(event(), storage);
  const [saved] = Journal.pending(storage);
  assert.equal(saved.typedAnswer, "hello");
  assert.equal(saved.isCorrect, false);
  assert.equal(saved.syncedAt, undefined);
});

test("answer journal records self-rating separately from correctness", () => {
  const normalized = Journal.normalizeEvent(event("rating-1", { selfRating:"hard", isCorrect:true }));
  assert.equal(normalized.selfRating, "hard");
  assert.equal(normalized.isCorrect, null);
});

test("answer journal is idempotent by event ID and acknowledges only confirmed IDs", () => {
  const storage = memoryStorage();
  assert.equal(Journal.append(event(), storage).inserted, true);
  assert.equal(Journal.append(event(), storage).inserted, false);
  assert.equal(Journal.acknowledge(["missing"], storage), 0);
  assert.equal(Journal.pending(storage).length, 1);
  assert.equal(Journal.acknowledge(["event-1"], storage), 1);
  assert.equal(Journal.pending(storage).length, 0);
});

test("answer journal rejects malformed or oversized events", () => {
  assert.throws(() => Journal.normalizeEvent({}), /identifier/);
  const bounded = Journal.normalizeEvent(event("large", { typedAnswer:"x".repeat(13000) }));
  assert.equal(bounded.typedAnswer.length, 500);
});

test("failed local writes propagate instead of silently accepting an answer", () => {
  const storage = { length: 0, key: () => null, getItem: () => null, setItem() { throw new Error("quota"); }, removeItem() {} };
  assert.throws(() => Journal.append(event(), storage), /quota/);
});

test("only completed sessions are eligible for cloud upload and unowned events require explicit adoption", () => {
  const storage = memoryStorage();
  Journal.append(event("event-a"), storage);
  Journal.append(event("event-b", { sessionId:"session-2" }), storage);
  assert.equal(Journal.completeSession("session-1", storage), 1);
  const pending = Journal.pending(storage);
  assert.ok(pending.find(item => item.eventId === "event-a").completedAt);
  assert.equal(pending.find(item => item.eventId === "event-b").completedAt, undefined);
  assert.equal(Journal.claimUnownedEvents("user-a", storage), 2);
  assert.ok(Journal.pending(storage).every(item => item.ownerId === "user-a"));
});
