const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const catalog = require("../static/catalog.js");
const expanded = require("../static/expanded-vocabulary.js");
const academicData = require("../static/academic-stage-data.js");
const baselineWords = catalog.officialWords();

const normalizeHebrew = value => String(value ?? "").normalize("NFC")
  .replace(/[\u0591-\u05C7]/g, "")
  .replace(/[\u200e\u200f]/g, "")
  .replace(/\s+/g, " ")
  .trim()
  .toLocaleLowerCase("he");

const staged = require("../static/stage-vocabulary.js");
const officialWords = catalog.officialWords();
const academicStages = staged.academicStages;

test("the former academic vocabulary is loaded as data, not as a standalone page", () => {
  assert.equal(academicData.groups.length, 5);
  assert.equal(academicData.terms.length, 377);
  assert.deepEqual(academicData.groups.map(group => group.id), [
    "general", "math-physics", "electronics", "computing", "verbs-adjectives"
  ]);
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const sw = fs.readFileSync(path.join(root, "static/sw.js"), "utf8");
  assert.ok(!html.includes("academic-terms.js"));
  assert.ok(!html.includes("academic-terms.css"));
  assert.ok(!sw.includes("academic-terms.js"));
  assert.ok(!sw.includes("academic-terms.css"));
  assert.ok(html.indexOf("static/academic-stage-data.js") < html.indexOf("static/stage-vocabulary.js"));
  assert.ok(html.indexOf("static/stage-vocabulary.js") < html.indexOf("static/app.js"));
  assert.match(sw, /mila-yaelnet-v18/);
  assert.ok(sw.includes("/static/academic-stage-data.js?v=1"));
});

test("the 1,250-word expansion remains intact and duplicate-free", () => {
  assert.equal(staged.meta.stageCount, 10);
  assert.equal(staged.meta.addedWordCount, 1250);
  assert.equal(staged.stages.length, 10);
  assert.ok(staged.stages.every(stage => stage.words.length >= 100));
  const keys = staged.stages.flatMap(stage => stage.words).map(word => normalizeHebrew(word.he));
  assert.equal(keys.length, new Set(keys).size);
  assert.ok(keys.every(key => key && !baselineWords.some(word => normalizeHebrew(word.he) === key)));
});

test("all five academic groups are represented beside the other learning stages", () => {
  assert.equal(academicStages.length, 5);
  assert.equal(academicStages.reduce((sum, stage) => sum + stage.words.length, 0), 357);
  assert.deepEqual(academicStages.map(stage => stage.number), [12, 13, 14, 15, 16]);
  assert.deepEqual(academicStages.map(stage => stage.id), [
    "stage-academic-general",
    "stage-academic-math-physics",
    "stage-academic-electronics",
    "stage-academic-computing",
    "stage-academic-verbs-adjectives"
  ]);
  assert.deepEqual(academicStages.map(stage => stage.words.length), [61, 61, 84, 42, 109]);
  assert.equal(staged.academicMeta.rawTermCount, 377);
  assert.equal(staged.academicMeta.addedWordCount, 357);
  assert.equal(staged.academicMeta.mergedTermCount, 20);
  assert.equal(staged.academicMeta.invalidCount, 0);
});

test("academic terms merge into one official word per Hebrew headword", () => {
  const keys = officialWords.map(word => normalizeHebrew(word.he));
  assert.equal(keys.length, new Set(keys).size);
  assert.equal(new Set(officialWords.map(word => word.id)).size, officialWords.length);
  assert.ok(academicStages.flatMap(stage => stage.words).every(word =>
    word.id.startsWith("academic-") &&
    word.source === "stage" &&
    word.stageId?.startsWith("stage-academic-") &&
    word.stageTitle === word.category &&
    word.he?.trim() &&
    word.ar?.trim()
  ));
});

test("academic terms already present in older stages map to the canonical word and retain their group metadata", () => {
  const merged = staged.academicMeta.mergedTerms;
  assert.equal(merged.length, 20);
  for (const item of merged) {
    const word = officialWords.find(candidate => candidate.id === item.canonicalWordId);
    assert.ok(word, `canonical word missing for ${item.termId}`);
    assert.ok(word.academicGroups?.includes(item.groupId));
  }
});

test("the official learning path has sixteen stages and every former academic term is represented", () => {
  assert.equal(catalog.stages.length, 16);
  assert.equal(officialWords.length, baselineWords.length + 1250 + 357);
  const officialByHebrew = new Set(officialWords.map(word => normalizeHebrew(word.he)));
  assert.ok(academicData.terms.every(term => officialByHebrew.has(normalizeHebrew(term.he))));
});

test("new stage modules pass syntax and service-worker cache expectations", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  assert.match(pkg.scripts.test, /static\/academic-stage-data\.js/);
  assert.match(pkg.scripts.test, /static\/stage-vocabulary\.js/);
});
