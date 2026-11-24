"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = fs.readFileSync(path.join(__dirname, "..", "static/app.js"), "utf8");
const sync = fs.readFileSync(path.join(__dirname, "..", "sync.js"), "utf8");
const adaptive = fs.readFileSync(path.join(__dirname, "..", "static/adaptive-ui.js"), "utf8");

test("answer journal stores event context and only syncs after a completed session", () => {
  assert.match(app, /MilaAnswerJournal\.append/);
  assert.match(app, /typedAnswer: String\(metadata\?\.typedAnswer/);
  assert.match(app, /selfRating: metadata\?\.selfRating/);
  assert.match(app, /mila:session-completed/);
  assert.match(sync, /hasActiveLearningSession\(\)\)return/);
  assert.match(sync, /uploadAnswerEvents/);
  assert.match(sync, /mila:session-completed/);
  assert.match(sync, /ownerId===owner/);
  assert.match(adaptive, /hasUnfinishedSession: \(\) => Boolean\(state\.session\)/);
});

test("matching mistakes are recorded as individual attempts, not only the first wrong selection", () => {
  const start = app.indexOf("function handleMatch");
  const end = app.indexOf("function rateFlashcard", start);
  assert.ok(start >= 0 && end > start);
  const matching = app.slice(start, end);
  assert.match(matching, /matching-wrong:" \+ uid\(\)/);
  assert.doesNotMatch(matching, /if \(!session\.results\[idx\]\)\s*\{[\s\S]*?recordAnswer\(leftId, false/);
});
