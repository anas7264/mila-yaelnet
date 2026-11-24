"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const STORE = require("../static/storage.js");

test("learning answer events survive state sanitization with bounded validated payloads", () => {
  const state = STORE.createDefaultState();
  state.learningEvents = {
    "answer:event-1": {
      eventId: "event-1",
      wordId: "word-1",
      correct: false,
      selectedWordId: "word-2",
      source: "التدريب التكيفي",
      at: 1730000000000,
      date: "2026-11-23",
      direction: "ar-he"
    },
    "answer:bad": { wordId: {}, correct: "yes" },
    "__proto__": { wordId: "word-3", correct: true }
  };
  const clean = STORE.sanitizeState(state);
  assert.deepEqual(clean.learningEvents["answer:event-1"], {
    eventId: "event-1",
    wordId: "word-1",
    correct: false,
    selectedWordId: "word-2",
    source: "التدريب التكيفي",
    at: 1730000000000,
    date: "2026-11-23",
    direction: "ar-he"
  });
  assert.equal(clean.learningEvents["answer:bad"], undefined);
  assert.equal(Object.keys(clean.learningEvents).length, 1);
});

test("learning answer event journal is bounded to the latest 2048 events", () => {
  const state = STORE.createDefaultState();
  state.learningEvents = {};
  for (let i = 0; i < 2050; i++) {
    state.learningEvents["answer:event-" + i] = {
      eventId: "event-" + i, wordId: "word-" + i, correct: true, at: i
    };
  }
  const clean = STORE.sanitizeState(state);
  assert.equal(Object.keys(clean.learningEvents).length, 2048);
  assert.equal(clean.learningEvents["answer:event-0"], undefined);
  assert.ok(clean.learningEvents["answer:event-2049"]);
});

test("answer recording attaches event payload and adaptive direction metadata", () => {
  const app = fs.readFileSync(path.join(__dirname, "..", "static/app.js"), "utf8");
  assert.match(app, /state\.learningEvents\[ledgerKey\] = \{/);
  assert.match(app, /direction: metadata\?\.direction/);
  assert.match(app, /recordAnswer\(wordId, event\.correct, null, "التدريب التكيفي", eventId, \{[\s\S]*?direction: event\.direction[\s\S]*?sessionId: event\.sessionId/);
  assert.match(app, /state\.learningEvents = previousLearningEvents/);
});
