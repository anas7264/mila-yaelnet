const test = require("node:test");
const assert = require("node:assert/strict");

const Storage = require("../static/storage.js");
const catalog = require("../static/catalog.js");
const expanded = require("../static/expanded-vocabulary.js");
const academicData = require("../static/academic-stage-data.js");
require("../static/stage-vocabulary.js");

const officialWords = catalog.officialWords();
const normalizeHebrew = value => String(value ?? "").normalize("NFC")
  .replace(/[\u0591-\u05C7]/g, "")
  .replace(/[\u200e\u200f]/g, "")
  .replace(/\s+/g, " ")
  .trim()
  .toLocaleLowerCase("he");

const duplicateTerm = academicData.terms.find(term => {
  const canonical = officialWords.find(word => normalizeHebrew(word.he) === normalizeHebrew(term.he));
  return canonical && canonical.id !== term.id;
});
const uniqueTerm = academicData.terms.find(term => officialWords.some(word =>
  word.id === term.id && normalizeHebrew(word.he) === normalizeHebrew(term.he)
));

test("academic migration maps old duplicate IDs to their canonical stage word", () => {
  assert.ok(duplicateTerm, "fixture must include an academic term already present in an earlier stage");
  const canonical = officialWords.find(word => normalizeHebrew(word.he) === normalizeHebrew(duplicateTerm.he));
  const state = Storage.createDefaultState();
  state.progress[canonical.id] = {
    attempts: 9, correct: 7, incorrect: 2, mistakes: 2,
    favorite: false, mastered: false, dueAt: 900,
    lastAnswerAt: 6000, lastReviewedAt: 5000
  };
  state.progress[duplicateTerm.id] = {
    attempts: 4, correct: 3, incorrect: 1, favorite: true,
    mastered: true, dueAt: 700, lastReviewedAt: 4000
  };
  const legacy = {
    version: 1,
    progress: {
      [duplicateTerm.id]: {
        attempts: 6, correct: 5, incorrect: 1, favorite: false,
        mastered: true, dueAt: 500, lastReviewedAt: 5500
      }
    },
    adaptiveEvents: ["old-event-a"]
  };

  const result = Storage.migrateAcademicProgress(state, legacy, academicData.terms, officialWords);
  assert.equal(result.migrated, true);
  assert.equal(result.mappedTermCount, 377);
  assert.equal(result.skippedTermCount, 0);
  assert.equal(result.state.progress[canonical.id].attempts, 9);
  assert.equal(result.state.progress[canonical.id].correct, 7);
  assert.equal(result.state.progress[canonical.id].incorrect, 2);
  assert.equal(result.state.progress[canonical.id].favorite, true);
  assert.equal(result.state.progress[canonical.id].mastered, false);
  assert.equal(result.state.progress[canonical.id].dueAt, 500);
  assert.equal(result.state.progress[duplicateTerm.id], undefined);
});

test("academic migration keeps unique academic word IDs and combines their two progress stores safely", () => {
  assert.ok(uniqueTerm, "fixture must include an academic word with its original ID");
  const state = Storage.createDefaultState();
  state.progress[uniqueTerm.id] = {
    attempts: 3, correct: 2, incorrect: 1,
    favorite: false, mastered: false, dueAt: 1200, lastAnswerAt: 1000
  };
  const legacy = {
    version: 1,
    progress: {
      [uniqueTerm.id]: {
        attempts: 8, correct: 7, incorrect: 1,
        favorite: true, mastered: true, dueAt: 1500, lastReviewedAt: 2000
      }
    }
  };
  const result = Storage.migrateAcademicProgress(state, legacy, academicData.terms, officialWords);
  const progress = result.state.progress[uniqueTerm.id];
  assert.equal(result.migrated, true);
  assert.equal(progress.attempts, 8);
  assert.equal(progress.correct, 7);
  assert.equal(progress.incorrect, 1);
  assert.equal(progress.favorite, true);
  assert.equal(progress.mastered, true);
  assert.equal(progress.dueAt, 1200);
});

test("academic mistakes and session summaries use canonical stage IDs after migration", () => {
  const canonical = officialWords.find(word => normalizeHebrew(word.he) === normalizeHebrew(duplicateTerm.he));
  const state = Storage.createDefaultState();
  state.mistakes = [{
    id: "legacy-mistake-1", wordId: duplicateTerm.id,
    selectedWordId: uniqueTerm.id, createdAt: 1234, source: "مصطلحات أكاديمية"
  }];
  state.sessions = [{
    id: "session-legacy-1", title: "جلسة أكاديمية", startedAt: 100,
    finishedAt: 200, total: 2, correct: 1, incorrect: 1, accuracy: 50,
    wrongWordIds: [duplicateTerm.id, uniqueTerm.id], settings: { mode: "he-ar", source: "all" }
  }];
  state.lastSessionSummary = state.sessions[0];
  const result = Storage.migrateAcademicProgress(
    state,
    { version: 1, progress: {} },
    academicData.terms,
    officialWords
  );
  assert.equal(result.state.mistakes[0].wordId, canonical.id);
  assert.equal(result.state.mistakes[0].selectedWordId, uniqueTerm.id);
  assert.deepEqual(result.state.sessions[0].wrongWordIds, [canonical.id, uniqueTerm.id]);
  assert.deepEqual(result.state.lastSessionSummary.wrongWordIds, [canonical.id, uniqueTerm.id]);
});

test("migration is idempotent and its marker survives storage sanitization and reload", () => {
  const initial = Storage.createDefaultState();
  const legacy = { version: 1, progress: { [uniqueTerm.id]: { attempts: 4, correct: 3, incorrect: 1 } } };
  const first = Storage.migrateAcademicProgress(initial, legacy, academicData.terms, officialWords);
  assert.equal(first.migrated, true);
  const storage = {
    value: null,
    setItem(key, value) { this.value = value; },
    getItem() { return this.value; }
  };
  assert.equal(Storage.saveState(first.state, storage), true);
  const reloaded = Storage.loadState(storage, officialWords);
  assert.ok(reloaded.migrations.academicProgressV1);
  const second = Storage.migrateAcademicProgress(reloaded, legacy, academicData.terms, officialWords);
  assert.equal(second.migrated, false);
  assert.equal(second.alreadyMigrated, true);
  assert.equal(second.state.progress[uniqueTerm.id].attempts, 4);
});

test("missing legacy academic state leaves migration pending and does not mark it complete", () => {
  const initial = Storage.createDefaultState();
  const result = Storage.migrateAcademicProgress(initial, null, academicData.terms, officialWords);
  assert.equal(result.migrated, false);
  assert.equal(result.pending, true);
  assert.equal(result.state.migrations.academicProgressV1, undefined);
});

test("adaptive cards, saved queue, retries, and results remap old academic IDs without losing attempts", () => {
  const Engine = require("../static/adaptive-engine.js");
  const state = Engine.createState();
  state.progress["academic-duplicate"] = {
    heToAr: { attempts: 2, correct: 1, incorrect: 1, failures: 1, priority: 4, lastSeenAt: 100 },
    arToHe: { attempts: 1, correct: 1, incorrect: 0, consecutiveCorrect: 1, lastSeenAt: 200, lastResult: "correct" }
  };
  state.progress["canonical-stage-word"] = {
    heToAr: { attempts: 5, correct: 4, incorrect: 1, failures: 1, priority: 2, lastSeenAt: 300 },
    arToHe: { attempts: 3, correct: 2, incorrect: 1, failures: 1, priority: 3, lastSeenAt: 250 }
  };
  state.session = {
    id: "adaptive-preserved", direction: "he-ar",
    queue: ["academic-duplicate", "canonical-stage-word", "academic-duplicate"],
    cursor: 1, cycle: 2, retryCounts: { "academic-duplicate": 2 },
    answered: true, paused: true, questionId: "adaptive-preserved:2:1:canonical-stage-word",
    attempts: 3, correct: 2, incorrect: 1, startedAt: 50,
    results: [{ questionId: "q-old", wordId: "academic-duplicate", correct: false, at: 100, direction: "he-ar" }],
    wrongWordIds: ["academic-duplicate"],
    lastResult: { wordId: "academic-duplicate", correct: false, at: 100 }
  };

  const result = Engine.migrateWordIds(state, { "academic-duplicate": "canonical-stage-word" });
  assert.equal(result.migrated, true);
  assert.equal(result.mappedProgressCount, 1);
  assert.equal(result.mappedSessionReferenceCount, 2);
  assert.equal(result.state.progress["academic-duplicate"], undefined);
  assert.equal(result.state.progress["canonical-stage-word"].heToAr.attempts, 7);
  assert.equal(result.state.progress["canonical-stage-word"].heToAr.correct, 5);
  assert.equal(result.state.progress["canonical-stage-word"].heToAr.incorrect, 2);
  assert.equal(result.state.progress["canonical-stage-word"].arToHe.attempts, 4);
  assert.deepEqual(result.state.session.queue, [
    "canonical-stage-word", "canonical-stage-word", "canonical-stage-word"
  ]);
  assert.equal(result.state.session.retryCounts["canonical-stage-word"], 2);
  assert.equal(result.state.session.results[0].wordId, "canonical-stage-word");
  assert.deepEqual(result.state.session.wrongWordIds, ["canonical-stage-word"]);
  assert.equal(result.state.session.lastResult.wordId, "canonical-stage-word");
  const reloaded = Engine.normalizeState(JSON.parse(JSON.stringify(result.state)));
  assert.equal(reloaded.migrations.academicWordIdsV1, true);
  const repeated = Engine.migrateWordIds(reloaded, { "academic-duplicate": "canonical-stage-word" });
  assert.equal(repeated.alreadyMigrated, true);
  assert.equal(repeated.state.progress["canonical-stage-word"].heToAr.attempts, 7);
});
