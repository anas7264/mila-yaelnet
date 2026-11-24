"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = fs.readFileSync(path.join(__dirname, "../static/app.js"), "utf8");
const sync = fs.readFileSync(path.join(__dirname, "../sync.js"), "utf8");

test("analytics loads cloud answer aggregates and classifies difficulty using minimum sample sizes", () => {
  assert.match(sync, /getAnswerAnalytics:async/);
  assert.match(sync, /learning_answer_word_stats/);
  assert.match(sync, /learning_answer_confusion_stats/);
  assert.match(app, /id="answerEventAnalytics"/);
  assert.match(app, /item\.attempts >= 3/);
  assert.match(app, /item\.attempts >= 5 && item\.accuracy >= 0\.85/);
  assert.match(app, /الخيارات الخاطئة المتكررة/);
});
