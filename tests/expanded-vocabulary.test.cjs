const test = require("node:test");
const assert = require("node:assert/strict");
const Vocabulary = require("../static/expanded-vocabulary.js");

function normalizeHebrew(value) {
  return String(value ?? "").normalize("NFC")
    .replace(/[\\u0591-\\u05C7]/g, "")
    .replace(/[\\u200e\\u200f]/g, "")
    .replace(/\\s+/g, " ").trim().toLocaleLowerCase();
}

test("expanded vocabulary contains 21 thematic groups and exactly 1,050 entries", () => {
  assert.equal(Vocabulary.groups.length, 21);
  assert.equal(Vocabulary.rawCount, 1050);
  for (const group of Vocabulary.groups) {
    assert.equal(group.terms.length, 50, group.title);
    assert.ok(group.terms.every(term => term.he && term.ar && term.id));
  }
});

test("merged vocabulary contains one trainable entry per Hebrew headword", () => {
  const merged = Vocabulary.merge([]);
  const keys = merged.map(term => normalizeHebrew(term.he));
  assert.equal(new Set(keys).size, merged.length);
  assert.equal(new Set(merged.map(term => term.id)).size, merged.length);
  assert.ok(merged.every(term => term.source === "expanded"));
});

test("existing catalog IDs are preserved and expansion topics remain discoverable", () => {
  const existing = { id: "existing-reason", he: "סיבה", ar: "سبب", category: "كلمات أساسية", source: "stage" };
  const merged = Vocabulary.merge([existing]);
  const matches = merged.filter(term => normalizeHebrew(term.he) === normalizeHebrew("סיבה"));
  assert.equal(matches.length, 1);
  assert.equal(matches[0].id, "existing-reason");
  assert.equal(matches[0].source, "stage");
  assert.ok(matches[0].expandedTopics.includes("أسماء مجرّدة وتحليلية"));
});

test("repeated group entries do not create duplicate prompts", () => {
  const merged = Vocabulary.merge([]);
  const matches = merged.filter(term => normalizeHebrew(term.he) === normalizeHebrew("השפעה"));
  assert.equal(matches.length, 1);
  assert.equal(matches[0].ar.includes("تأثير"), true);
});

test("new vocabulary is loaded before app code and is merged into both training paths", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const html = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
  const app = fs.readFileSync(path.join(__dirname, "../static/app.js"), "utf8");
  const adaptive = fs.readFileSync(path.join(__dirname, "../static/adaptive-ui.js"), "utf8");
  assert.ok(html.indexOf("static/expanded-vocabulary.js") < html.indexOf("static/app.js"));
  assert.match(app, /YaelExpandedVocabulary\?\.merge/);
  assert.match(app, /expandedTopics/);
  assert.match(adaptive, /YaelExpandedVocabulary\?\.merge/);
});
