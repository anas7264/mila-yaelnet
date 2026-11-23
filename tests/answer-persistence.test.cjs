"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = fs.readFileSync(path.join(__dirname, "..", "static/app.js"), "utf8");

function section(start, end) {
  const a = app.indexOf(start);
  const b = app.indexOf(end, a + start.length);
  assert.notEqual(a, -1, "missing " + start);
  assert.notEqual(b, -1, "missing " + end);
  return app.slice(a, b);
}

test("quiz and typed answers roll back progress and session state on local save failure", () => {
  for (const name of ["function submitCurrent", "function answerTyped"]) {
    const code = section(name, name === "function submitCurrent" ? "function answerChoice" : "function createMatchRound");
    assert.match(code, /captureLearningCheckpoint/);
    assert.match(code, /if \(!persist\(\)\)/);
    assert.match(code, /restoreLearningCheckpoint/);
  }
});

test("matching and flashcard answers roll back on local save failure", () => {
  const matching = section("function handleMatch", "function rateFlashcard");
  const flashcard = section("function rateFlashcard", "function nextQuestion");
  for (const code of [matching, flashcard]) {
    assert.match(code, /captureLearningCheckpoint/);
    assert.match(code, /if \(!persist\(\)\)/);
    assert.match(code, /restoreLearningCheckpoint/);
  }
});

test("session completion is persisted as one transaction with its final answer", () => {
  const next = section("function nextQuestion", "function finishSession");
  const finish = section("function finishSession", "function renderSessionSummary");
  assert.match(next, /captureLearningCheckpoint/);
  assert.match(next, /finishSession\(false\)/);
  assert.match(next, /if \(!persist\(\)\)/);
  assert.match(next, /restoreLearningCheckpoint/);
  assert.match(finish, /persistState && !persist\(\)/);
  assert.match(finish, /restoreLearningCheckpoint/);
});
