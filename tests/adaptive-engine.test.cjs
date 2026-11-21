const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const syncCorePromise = import("../sync-core.mjs");
const Engine = require("../static/adaptive-engine.js");
const Storage = require("../static/storage.js");

const words = [
  { id: "w1", he: "מטרה", ar: "هدف" },
  { id: "w2", he: "תוצאה", ar: "نتيجة" },
  { id: "w3", he: "השפעה", ar: "تأثير" },
  { id: "w4", he: "מחקר", ar: "بحث" },
  { id: "w5", he: "יכולת", ar: "قدرة" },
  { id: "w6", he: "יתרון", ar: "ميزة" }
];
const fixedRandom = () => 0;
function start(direction = "he-ar", pool = words) {
  return Engine.startSession(Engine.createState(), pool, direction, fixedRandom);
}
function move(state, pool) {
  return Engine.advance(state, pool, fixedRandom).state;
}

test("incorrect answer is reinserted after 2–4 intervening questions", () => {
  let state = Engine.startSession(Engine.createState(), words, "he-ar", () => 0.999999999);
  const first = Engine.currentQuestion(state, words);
  const result = Engine.submitAnswer(state, words, "إجابة خاطئة", {
    questionId: first.questionId, now: 1000, random: () => 0.999999999
  });
  assert.equal(result.accepted, true);
  assert.equal(result.correct, false);
  assert.ok(result.retryAfter >= 2 && result.retryAfter <= 4);
  assert.equal(result.retryAfter, 4);
  assert.equal(result.state.session.queue.indexOf(first.wordId, 1), 5);
  state = move(result.state, words);
  while (Engine.currentQuestion(state, words).wordId !== first.wordId) {
    const intervening = Engine.currentQuestion(state, words);
    assert.notEqual(intervening.wordId, first.wordId);
    state = Engine.submitAnswer(state, words, intervening.word.ar, { questionId: intervening.questionId, now: 1100 }).state;
    state = move(state, words);
  }
  assert.equal(Engine.currentQuestion(state, words).wordId, first.wordId);
});

test("repeated errors increase the directional priority score", () => {
  let state = start();
  const first = Engine.currentQuestion(state, words);
  state = Engine.submitAnswer(state, words, "wrong", { questionId: first.questionId, now: 1000, random: fixedRandom }).state;
  const afterFirst = Engine.getCard(state, first.wordId, "he-ar").priority;
  state = move(state, words);
  while (Engine.currentQuestion(state, words).wordId !== first.wordId) {
    const intervening = Engine.currentQuestion(state, words);
    state = Engine.submitAnswer(state, words, intervening.word.ar, { questionId: intervening.questionId, now: 1500 }).state;
    state = move(state, words);
  }
  const retry = Engine.currentQuestion(state, words);
  assert.equal(retry.wordId, first.wordId);
  state = Engine.submitAnswer(state, words, "wrong again", { questionId: retry.questionId, now: 2000, random: fixedRandom }).state;
  const afterSecond = Engine.getCard(state, first.wordId, "he-ar").priority;
  assert.ok(afterSecond > afterFirst);
});

test("correct answers lower priority and do not enqueue an immediate retry", () => {
  const pool = [words[0]];
  let state = Engine.createState();
  state.progress.w1 = { heToAr: { priority: 7 }, arToHe: {} };
  state = Engine.startSession(state, pool, "he-ar", fixedRandom);
  const q = Engine.currentQuestion(state, pool);
  const result = Engine.submitAnswer(state, pool, "هدف", { questionId: q.questionId, now: 1000, random: fixedRandom });
  assert.equal(result.correct, true);
  assert.equal(result.state.session.queue.length, 1);
  assert.equal(Engine.getCard(result.state, "w1", "he-ar").priority, 6);
});

test("Hebrew-to-Arabic and Arabic-to-Hebrew histories are independent", () => {
  const pool = [words[0]];
  let state = Engine.startSession(Engine.createState(), pool, "he-ar", fixedRandom);
  const q1 = Engine.currentQuestion(state, pool);
  state = Engine.submitAnswer(state, pool, "wrong", { questionId: q1.questionId, now: 1000, random: fixedRandom }).state;
  state = Engine.startSession(state, pool, "ar-he", fixedRandom);
  assert.equal(Engine.getCard(state, "w1", "he-ar").incorrect, 1);
  assert.equal(Engine.getCard(state, "w1", "ar-he").incorrect, 0);
  const q2 = Engine.currentQuestion(state, pool);
  const result = Engine.submitAnswer(state, pool, "מטרה", { questionId: q2.questionId, now: 2000 });
  assert.equal(result.correct, true);
  assert.equal(Engine.getCard(result.state, "w1", "ar-he").correct, 1);
  assert.equal(Engine.getCard(result.state, "w1", "he-ar").incorrect, 1);
});

test("duplicate or stale submissions cannot update progress twice", () => {
  let state = start();
  const q = Engine.currentQuestion(state, words);
  const first = Engine.submitAnswer(state, words, "wrong", { questionId: q.questionId, now: 1000, random: fixedRandom });
  const second = Engine.submitAnswer(first.state, words, "wrong", { questionId: q.questionId, now: 1001, random: fixedRandom });
  assert.equal(first.accepted, true);
  assert.equal(second.accepted, false);
  assert.equal(Engine.getCard(second.state, q.wordId, "he-ar").attempts, 1);
});

test("serialized state restores the exact interrupted queue and current question", () => {
  let state = start();
  const q = Engine.currentQuestion(state, words);
  state = Engine.submitAnswer(state, words, "wrong", { questionId: q.questionId, now: 1000, random: fixedRandom }).state;
  state = move(state, words);
  const restored = Engine.normalizeState(JSON.parse(JSON.stringify(state)));
  assert.deepEqual(restored.session.queue, state.session.queue);
  assert.equal(Engine.currentQuestion(restored, words).wordId, Engine.currentQuestion(state, words).wordId);
  assert.equal(restored.session.cursor, state.session.cursor);
});

test("a completed queue starts another continuous cycle without a fixed question cap", () => {
  const pool = [words[0], words[1]];
  let state = Engine.startSession(Engine.createState(), pool, "he-ar", fixedRandom);
  for (let i = 0; i < 2; i += 1) {
    const q = Engine.currentQuestion(state, pool);
    state = Engine.submitAnswer(state, pool, q.word.ar, { questionId: q.questionId, now: 1000 + i }).state;
    state = move(state, pool);
  }
  assert.equal(state.session.cycle, 2);
  assert.equal(state.session.queue.length, pool.length);
  assert.equal(Engine.currentQuestion(state, pool).position, 1);
});

test("Arabic aliases and Unicode diacritics are normalized conservatively", () => {
  assert.equal(Engine.gradeAnswer({ he: "מטרה", ar: "يُركّز / التركيز" }, "he-ar", "التركيز"), true);
  assert.equal(Engine.gradeAnswer({ he: "מטרה", ar: "يُركّز / التركيز" }, "he-ar", "يركز"), true);
  assert.equal(Engine.gradeAnswer({ he: "מטרה", ar: "هدف" }, "he-ar", "تأثير"), false);
});

test("consistently remembered words are skipped in short-term cycles", () => {
  const pool = [words[0], words[1]];
  let state = Engine.createState();
  state.progress.w1 = { heToAr: { consecutiveCorrect: 4 }, arToHe: {} };
  state = Engine.startSession(state, pool, "he-ar", fixedRandom);
  while (state.session.cycle === 1) {
    const q = Engine.currentQuestion(state, pool);
    state = Engine.submitAnswer(state, pool, q.word.ar, { questionId: q.questionId, now: 3000 }).state;
    state = move(state, pool);
  }
  assert.deepEqual(state.session.queue, ["w2"]);
  assert.equal(Engine.getCard(state, "w1", "he-ar").cooldownCycles, 1);
});

test("short-term retries are bounded and defer when there is not enough spacing left", () => {
  const pool = [...words, { id: "w7", he: "שינוי", ar: "تغيير" }, { id: "w8", he: "הצלחה", ar: "نجاح" },
    { id: "w9", he: "סביבה", ar: "بيئة" }, { id: "w10", he: "חברה", ar: "مجتمع" }];
  const random = () => 0.999999999;
  let state = Engine.startSession(Engine.createState(), pool, "he-ar", random);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const q = Engine.currentQuestion(state, pool);
    assert.equal(q.wordId, "w1");
    state = Engine.submitAnswer(state, pool, "wrong", { questionId: q.questionId, now: 5000 + attempt, random }).state;
    if (attempt < 2) {
      state = move(state, pool);
      while (Engine.currentQuestion(state, pool).wordId !== "w1") {
        const other = Engine.currentQuestion(state, pool);
        state = Engine.submitAnswer(state, pool, other.word.ar, { questionId: other.questionId, now: 6000 + attempt }).state;
        state = move(state, pool);
      }
    }
  }
  assert.equal(state.session.retryCounts.w1, 2);
  assert.equal(state.session.queue.slice(state.session.cursor + 1).filter(id => id === "w1").length, 0);
});


test("adaptive session persists start time and a deduplicatable answer history", () => {
  let state = Engine.startSession(Engine.createState(), [words[0]], "he-ar", fixedRandom);
  const startedAt = state.session.startedAt;
  const q = Engine.currentQuestion(state, [words[0]]);
  const result = Engine.submitAnswer(state, [words[0]], "هدف", { questionId: q.questionId, now: 123456 });
  assert.equal(result.accepted, true);
  assert.equal(result.state.session.startedAt, startedAt);
  assert.deepEqual(result.state.session.results, [{
    questionId: q.questionId, wordId: "w1", correct: true, at: 123456, direction: "he-ar"
  }]);
  const restored = Engine.normalizeState(JSON.parse(JSON.stringify(result.state)));
  assert.deepEqual(restored.session.results, result.state.session.results);
});

test("main storage preserves adaptive idempotency keys and long session totals", () => {
  const raw = Storage.createDefaultState();
  raw.adaptiveEventIds = { "answer:q-1": 100, "session:s-1": 200 };
  raw.sessions = [{
    id: "adaptive-s-1", title: "التدريب التكيفي", startedAt: 1, finishedAt: 2,
    total: 850, correct: 700, incorrect: 150, accuracy: 82,
    wrongWordIds: ["academic-001"], settings: { mode: "adaptive-he-ar", source: "adaptive" }
  }];
  const clean = Storage.sanitizeState(raw);
  assert.equal(clean.adaptiveEventIds["answer:q-1"], 100);
  assert.equal(clean.adaptiveEventIds["session:s-1"], 200);
  assert.equal(clean.sessions[0].total, 850);
  assert.equal(clean.sessions[0].incorrect, 150);
  assert.equal(clean.lastSessionSummary, null);
});

test("adaptive integration writes to canonical and academic progress without replacing the adaptive view", () => {
  const app = fs.readFileSync(path.join(__dirname, "../static/app.js"), "utf8");
  const academic = fs.readFileSync(path.join(__dirname, "../academic-terms.js"), "utf8");
  const adaptive = fs.readFileSync(path.join(__dirname, "../static/adaptive-ui.js"), "utf8");
  const html = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
  assert.match(app, /window\.MilaLearningBridge = Object\.freeze/);
  assert.match(app, /recordAdaptiveAnswer/);
  assert.match(app, /recordAdaptiveSession/);
  assert.match(app, /source: "academic"/);
  assert.match(academic, /window\.MilaAcademicProgressBridge/);
  assert.match(academic, /academicViewOpen && ui\.mode === "list"/);
  assert.match(adaptive, /bridge\?\.recordAdaptiveAnswer/);
  assert.match(adaptive, /bridge\?\.recordAdaptiveSession/);
  assert.ok(html.indexOf("academic-terms.js") < html.indexOf("static/app.js"));
});

// Keep this deterministic suite runnable with Node's built-in test runner.

test("adaptive namespace remains inside the existing sync snapshot filter", async () => {
  const sync = await syncCorePromise;
  const snapshot = sync.createSnapshot([
    ["mila-yaelnet-studio-v3", "{\"version\":3}"],
    ["mila-yaelnet-academic-v1", "{\"version\":1}"],
    ["mila-yaelnet-adaptive-v1", "{\"version\":1}"],
    ["__mila_sync_meta_v1", "{\"internal\":true}"]
  ]);
  assert.deepEqual(snapshot.entries.map(([key]) => key), [
    "mila-yaelnet-academic-v1",
    "mila-yaelnet-adaptive-v1",
    "mila-yaelnet-studio-v3"
  ]);
  assert.equal(sync.isLearningStorageKey("mila-yaelnet-adaptive-v1"), true);
  assert.equal(sync.isLearningStorageKey("__mila_sync_meta_v1"), false);
});

test("preview entry point keeps RTL and loads both adaptive modules", () => {
  const html = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
  assert.match(html, /html lang="ar" dir="rtl"/);
  assert.match(html, /MILA_ADAPTIVE_ENABLED = true/);
  assert.match(html, /static\/adaptive-engine\.js/);
  assert.match(html, /static\/adaptive-ui\.js/);
  const css = fs.readFileSync(path.join(__dirname, "../static/adaptive.css"), "utf8");
  assert.match(css, /@media\(max-width:760px\)/);
});

test("main application dispatches UI interactions in capture phase and reports handler failures", () => {
  const app = fs.readFileSync(path.join(__dirname, "../static/app.js"), "utf8");
  assert.match(app, /document\.addEventListener\("click",\s*\(event\)=>[\s\S]*?\},\s*true\);/);
  assert.match(app, /event\.target instanceof Element/);
  assert.match(app, /Mila action failed:/);
  assert.match(app, /document\.addEventListener\("submit",\s*\(event\)=>[\s\S]*?\},\s*true\);/);
});

test("studio form contains unique stage picker identifiers and valid container structure", () => {
  const app = fs.readFileSync(path.join(__dirname, "../static/app.js"), "utf8");
  assert.equal((app.match(/id="singleStagePicker"/g) || []).length, 1);
  assert.equal((app.match(/id="singleStageSelect"/g) || []).length, 1);
  assert.equal((app.match(/id="stagePicker"/g) || []).length, 1);
  assert.doesNotMatch(app, /stageOptions\}<\/div><\/div><\/div>/);
});

test("adaptive controls dispatch in capture phase and protect touch interactions", () => {
  const ui = fs.readFileSync(path.join(__dirname, "../static/adaptive-ui.js"), "utf8");
  assert.match(ui, /document\.addEventListener\("click",\s*event\s*=>[\s\S]*?\},\s*true\);/);
  assert.match(ui, /event\.target instanceof Element/);
  assert.match(ui, /Adaptive action failed:/);
  assert.match(ui, /document\.addEventListener\("submit",\s*event\s*=>[\s\S]*?\},\s*true\);/);
});

test("service worker cache is versioned so updated scripts replace stale cached assets", () => {
  const sw = fs.readFileSync(path.join(__dirname, "../static/sw.js"), "utf8");
  assert.match(sw, /const CACHE_NAME = "mila-yaelnet-v10"/);
  assert.match(sw, /cache\.add\(asset\)/);
  assert.match(sw, /key !== CACHE_NAME\)\.map\(\(key\) => caches\.delete\(key\)\)/);
  assert.match(sw, /await self\.skipWaiting\(\)/);
  assert.match(sw, /await self\.clients\.claim\(\)/);
});
