const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const catalog = require("../static/catalog.js");
const expanded = require("../static/expanded-vocabulary.js");

// Load the exact academic content without initializing its browser-only UI.
const academicSource = fs.readFileSync(path.join(root, "academic-terms.js"), "utf8");
const groupsSource = academicSource.match(/const GROUPS = (\\[.*?\\]);\\s*const TERMS/s)?.[1];
assert.ok(groupsSource, "academic group data must be parseable");
globalThis.YaelAcademicTerms = JSON.parse(groupsSource).flatMap(group => group.terms);

const existingWords = [
  ...catalog.officialWords(),
  ...globalThis.YaelAcademicTerms,
  ...expanded.terms
];
const normalizeHebrew = value => String(value ?? "").normalize("NFC")
  .replace(/[\\u0591-\\u05C7]/g, "")
  .replace(/[\\u200e\\u200f]/g, "")
  .replace(/\\s+/g, " ")
  .trim()
  .toLocaleLowerCase("he");
const existingHeadwords = new Set(existingWords.map(word => normalizeHebrew(word.he)));

const added = require("../static/stage-vocabulary.js");
const addedWords = added.stages.flatMap(stage => stage.words);

test("adds at least 1,000 new unique Hebrew headwords in ten progressive stages", () => {
  assert.equal(added.meta.stageCount, 10);
  assert.equal(added.stages.length, 10);
  assert.ok(added.meta.addedWordCount >= 1000, `expected at least 1,000 new words, got ${added.meta.addedWordCount}`);
  assert.equal(added.meta.addedWordCount, addedWords.length);
  assert.equal(added.meta.invalidCount, 0);
  assert.deepEqual(added.meta.invalidRows, []);
});

test("new headwords do not duplicate the existing stage, academic, or expanded catalog", () => {
  const keys = addedWords.map(word => normalizeHebrew(word.he));
  assert.equal(keys.length, new Set(keys).size, "new stages must not duplicate each other");
  assert.ok(keys.every(key => key && !existingHeadwords.has(key)), "all new headwords must be absent from prior vocabulary");
  assert.equal(added.meta.duplicateCount, added.meta.duplicates.length);
});

test("each new vocabulary item has stable identity, a translation, and stage metadata", () => {
  const ids = addedWords.map(word => word.id);
  assert.equal(ids.length, new Set(ids).size);
  assert.ok(addedWords.every(word =>
    word.he?.trim() &&
    word.ar?.trim() &&
    word.id?.startsWith(word.stageId + "-w") &&
    word.source === "stage" &&
    added.stages.some(stage => stage.id === word.stageId && stage.title === word.stageTitle)
  ));
  assert.deepEqual(added.stages.map(stage => stage.number), [2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
});

test("new stages join the official stage path before the application loads", () => {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const sw = fs.readFileSync(path.join(root, "static/sw.js"), "utf8");
  const catalogIndex = html.indexOf('src="/static/catalog.js"');
  const expandedIndex = html.indexOf('src="/static/expanded-vocabulary.js?v=1"');
  const stagedIndex = html.indexOf('src="/static/stage-vocabulary.js?v=1"');
  const appIndex = html.indexOf('src="/static/app.js"');
  assert.ok(catalogIndex >= 0 && expandedIndex > catalogIndex);
  assert.ok(stagedIndex > expandedIndex && appIndex > stagedIndex);
  assert.match(sw, /mila-yaelnet-v17/);
  assert.match(sw, /"\\/static\\/stage-vocabulary\\.js\\?v=1"/);
  assert.equal(catalog.officialWords().length, existingWords.length - globalThis.YaelAcademicTerms.length - expanded.terms.length + addedWords.length);
});
