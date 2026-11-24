"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const read = file => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

test("adaptive training consumes the platform canonical vocabulary bridge", () => {
  const app = read("static/app.js");
  const adaptive = read("static/adaptive-ui.js");
  assert.match(app, /getCanonicalWords\s*:/);
  assert.match(app, /getCanonicalWordMap\s*:/);
  assert.match(adaptive, /window\.MilaLearningBridge\?\.getCanonicalWords\?\.\(\)/);
  assert.doesNotMatch(adaptive, /window\.YaelCatalog\?\.officialWords\?\.\(\)/);
  assert.doesNotMatch(adaptive, /window\.YaelExpandedVocabulary\?\.merge/);
});
