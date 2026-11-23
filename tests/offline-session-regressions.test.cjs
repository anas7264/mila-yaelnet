"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

test("beginSession defines a JSON-safe config before storing it", () => {
  const app = read("static/app.js");
  const start = app.indexOf("function beginSession(");
  const end = app.indexOf("function startStudioSession(", start);
  assert.notEqual(start, -1, "beginSession must exist");
  assert.ok(end > start, "startStudioSession must follow beginSession");

  const body = app.slice(start, end);
  const configStart = body.indexOf("const persistableConfig = {");
  const sessionStart = body.indexOf("ui.session = {");
  assert.ok(configStart >= 0 && configStart < sessionStart);

  const config = body.slice(configStart, sessionStart);
  for (const key of [
    "mode", "source", "stageId", "stageIds", "scopeStageOnly",
    "excludeMastered", "search", "category", "count", "optionCount",
    "difficulty", "timerSeconds", "feedback", "shuffle", "noRepeat",
    "distractorScope"
  ]) {
    assert.ok(config.includes(key + ":") || config.includes(key + ","), "persistableConfig must include " + key);
  }
  assert.equal(config.includes("distractorPool"), false);
  assert.equal(config.includes("currentWord"), false);
  assert.ok(body.slice(sessionStart).includes(
    "config: { ...persistableConfig, mode, targetCount: targetIds.length }"
  ));
});



test("service-worker cache version invalidates the previous cache and excludes cloud sync", () => {
  const sw = read("static/sw.js");
  assert.ok(sw.includes('const CACHE_NAME = "mila-yaelnet-v23"'));
  assert.doesNotMatch(sw, /sync-config|sync\.js|supabase/i);
});





