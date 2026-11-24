"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const read = file => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

test("adaptive word pool refreshes newly persisted custom vocabulary without a page reload", () => {
  const values = new Map();
  const storage = {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, value); },
    removeItem(key) { values.delete(key); }
  };
  const document = {
    readyState: "loading",
    getElementById() { return null; },
    querySelector() { return null; },
    addEventListener() {}
  };
  const context = {
    document,
    localStorage: storage,
    console,
    navigator: {},
    crypto: { randomUUID: () => "adaptive-vocabulary-refresh-test" },
    addEventListener() {},
    setTimeout,
    clearTimeout
  };
  context.window = context;
  vm.createContext(context);

  const dependencies = [
    "static/catalog.js",
    "static/expanded-vocabulary.js",
    "static/academic-stage-data.js",
    "static/stage-vocabulary.js",
    "static/storage.js",
    "static/adaptive-engine.js"
  ];
  for (const file of dependencies) {
    vm.runInContext(read(file), context, { filename: file });
  }
  assert.equal(context.YaelStorage.saveState(context.YaelStorage.createDefaultState(), storage), true);
  context.MilaLearningBridge = {
    getCanonicalWords() {
      const current = context.YaelStorage.loadState(storage, context.YaelCatalog.officialWords());
      const base = [...context.YaelCatalog.officialWords(), ...(current.extras || [])];
      return context.YaelExpandedVocabulary.merge(base);
    }
  };
  vm.runInContext(read("static/adaptive-ui.js"), context, { filename: "static/adaptive-ui.js" });

  assert.equal(typeof context.MilaAdaptiveBridge.refreshVocabulary, "function");
  const before = context.MilaAdaptiveBridge.refreshVocabulary();
  const mainState = context.YaelStorage.loadState(storage, context.YaelCatalog.officialWords());
  mainState.extras.push({
    id: "extra-adaptive-refresh-proof",
    he: "מונח ייחודי לבדיקת שילוב אימון 2026",
    ar: "مصطلح فريد لاختبار دمج التدريب",
    source: "extra",
    tags: []
  });
  assert.equal(context.YaelStorage.saveState(mainState, storage), true);

  const after = context.MilaAdaptiveBridge.refreshVocabulary();
  assert.equal(after, before + 1, "adaptive vocabulary must include the word added after initial page load");
});

test("adaptive entry and new-session creation refresh the word pool before use", () => {
  const adaptive = read("static/adaptive-ui.js");
  const openStart = adaptive.indexOf("function openMode()");
  const startStart = adaptive.indexOf("function start(", openStart);
  const submitStart = adaptive.indexOf("function submitAdaptiveAnswer(", startStart);
  assert.ok(openStart >= 0 && startStart > openStart && submitStart > startStart);
  assert.match(adaptive.slice(openStart, startStart), /refreshVocabulary\(false\)/);
  assert.match(adaptive.slice(startStart, submitStart), /refreshVocabulary\(false\)[\s\S]*?Engine\.startSession\(state, words, direction\)/);
  assert.match(adaptive, /event\.key === "mila-yaelnet-studio-v3"[\s\S]*?refreshVocabulary\(\)/);
});

test("all platform vocabulary mutations notify the adaptive vocabulary index", () => {
  const app = read("static/app.js");
  const helperStart = app.indexOf("function invalidateWordIndex()");
  const helperEnd = app.indexOf("\n  }", helperStart);
  assert.ok(helperStart >= 0 && helperEnd > helperStart, "shared invalidation helper must exist");
  const helper = app.slice(helperStart, helperEnd);
  assert.match(helper, /wordIndex\.invalidate\(\);/);
  assert.match(helper, /window\.MilaAdaptiveBridge\?\.refreshVocabulary\?\.\(\);/);
  assert.equal((app.match(/wordIndex\.invalidate\(\);/g) || []).length, 1,
    "mutation paths must use the shared invalidation helper");
  assert.ok((app.match(/invalidateWordIndex\(\);/g) || []).length >= 5,
    "storage refresh, add, edit, delete and bulk import must invalidate both word indexes");
});
