(function attachStorage(root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.YaelStorage = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createStorage() {
  "use strict";
  const STATE_KEY = "mila-yaelnet-studio-v3";
  const LEGACY_PROGRESS_KEY = "mila-yaelnet-progress-v2";
  const LEGACY_EXTRAS_KEY = "mila-yaelnet-extra-words-v1";
  const LEGACY_ENVELOPE_KEY = "mila-yaelnet-v1";
  const MAX_BACKUP_CHARS = 4_000_000;
  const MAX_STATE_CHARS = 2_000_000;
  const MAX_ADAPTIVE_BACKUP_CHARS = 1_800_000;
  const ADAPTIVE_STATE_KEY = "mila-yaelnet-adaptive-v1";
  const MAX_WORDS = 5000;
  const MAX_SESSIONS = 500;
  const MAX_LEARNING_EVENTS = 2048;

  const parse = (raw, fallback) => {
    try { return raw ? JSON.parse(raw) : fallback; } catch { return fallback; }
  };
  const safeGet = (storage, key) => {
    try { return storage?.getItem(key) ?? null; } catch { return null; }
  };
  const makeId = () => `extra-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  const normalize = (value) => String(value ?? "").normalize("NFC").replace(/\s+/g, " ").trim().toLocaleLowerCase();

  function createDefaultState() {
    return {
      version: 3,
      migrations: {},
      extras: [],
      progress: {},
      mistakes: [],
      sessions: [],
      settings: {
        theme: "light",
        dailyGoal: 10,
        defaultCount: 10,
        defaultMode: "he-ar",
        timerSeconds: 0,
        feedbackTiming: "instant",
        focusMode: false,
        sound: false,
        largeText: false
      },
      daily: { lastDate: "", streak: 0, completed: 0 },
      legacyTotals: null,
      adaptiveEventIds: {},
      learningEvents: {}
    };
  }

  function normalizeWord(word) {
    if (!word || typeof word !== "object" || Array.isArray(word)) return null;
    const he = String(word.he ?? "").normalize("NFC").trim();
    const ar = String(word.ar ?? "").normalize("NFC").trim();
    if (!he || !ar || he.length > 100 || ar.length > 240 || /[<>]/.test(he + ar)) return null;
    const id = String(word.id || makeId()).slice(0, 120);
    return {
      id,
      he,
      ar,
      source: "extra",
      tags: Array.isArray(word.tags) ? word.tags.filter((x) => typeof x === "string").slice(0, 10) : [],
      notes: typeof word.notes === "string" ? word.notes.slice(0, 500) : ""
    };
  }

  function uniqueExtras(extras) {
    const ids = new Set();
    const terms = new Set();
    const pairs = new Set();
    const result = [];
    for (const candidate of Array.isArray(extras) ? extras : []) {
      const word = normalizeWord(candidate);
      if (!word) continue;
      const term = normalize(word.he);
      const pair = term + "|" + normalize(word.ar);
      if (ids.has(word.id) || terms.has(term) || pairs.has(pair)) continue;
      ids.add(word.id);
      terms.add(term);
      pairs.add(pair);
      result.push(word);
      if (result.length >= MAX_WORDS) break;
    }
    return result;
  }

  function migrateLegacy(storage, officialWords = []) {
    const state = createDefaultState();
    const oldExtras = parse(safeGet(storage, LEGACY_EXTRAS_KEY), []);
    state.extras = uniqueExtras(oldExtras);
    const oldProgress = parse(safeGet(storage, LEGACY_PROGRESS_KEY), {});
    if (oldProgress && typeof oldProgress === "object" && !Array.isArray(oldProgress)) {
      state.legacyTotals = {
        correct: Math.max(0, Number(oldProgress.correct) || 0),
        attempted: Math.max(0, Number(oldProgress.attempted) || 0)
      };
      state.completedStageIds = Array.isArray(oldProgress.completedStages)
        ? oldProgress.completedStages.filter((id) => typeof id === "string") : [];
      state.mistakes = Array.isArray(oldProgress.mistakes) ? oldProgress.mistakes.slice(-500).map((item, index) => ({
        id: String(item?.id || `legacy-mistake-${index}`),
        wordId: String(item?.termId || item?.targetWordId || item?.wordId || ""),
        selectedWordId: item?.selectedWordId ? String(item.selectedWordId) : null,
        correctWordId: String(item?.correctWordId || item?.termId || ""),
        createdAt: Number(item?.createdAt || item?.timestamp) || Date.now(),
        source: "legacy"
      })).filter((item) => item.wordId) : [];
      for (const item of state.mistakes) {
        const previous = state.progress[item.wordId] || {};
        state.progress[item.wordId] = {
          ...previous,
          attempts: (Number(previous.attempts) || 0) + 1,
          incorrect: (Number(previous.incorrect) || 0) + 1,
          mistakes: (Number(previous.mistakes) || 0) + 1
        };
      }
    }
    const legacyEnvelope = parse(safeGet(storage, LEGACY_ENVELOPE_KEY), null);
    if (legacyEnvelope && typeof legacyEnvelope === "object" && !Array.isArray(legacyEnvelope)) {
      state.migration = { legacyEnvelopeFound: true, migratedAt: Date.now(), officialWordCount: officialWords.length };
    }
    return state;
  }

  function sanitizeState(raw) {
    const base = createDefaultState();
    if (!raw || typeof raw !== "object" || Array.isArray(raw) || raw.version !== 3) return null;
    const progress = raw.progress && typeof raw.progress === "object" && !Array.isArray(raw.progress) ? raw.progress : {};
    const cleanedProgress = Object.create(null);
    for (const [id, item] of Object.entries(progress).slice(0, 10000)) {
      if (!id || ["__proto__", "constructor", "prototype"].includes(id) || !item || typeof item !== "object" || Array.isArray(item)) continue;
      cleanedProgress[id] = {
        attempts: Math.min(1000000, Math.max(0, Number(item.attempts) || 0)),
        correct: Math.min(1000000, Math.max(0, Number(item.correct) || 0)),
        incorrect: Math.min(1000000, Math.max(0, Number(item.incorrect) || 0)),
        mistakes: Math.min(1000000, Math.max(0, Number(item.mistakes) || 0)),
        favorite: Boolean(item.favorite),
        mastered: Boolean(item.mastered),
        dueAt: Number.isFinite(Number(item.dueAt)) ? Number(item.dueAt) : 0,
        intervalDays: Math.min(36500, Math.max(0, Number(item.intervalDays) || 0)),
        repetitions: Math.min(1000000, Math.max(0, Number(item.repetitions) || 0)),
        ease: Math.min(3, Math.max(1.3, Number(item.ease) || 2.3)),
        lapses: Math.max(0, Number(item.lapses) || 0),
        lastReviewedAt: Math.max(0, Number(item.lastReviewedAt) || 0),
        lastAnswerAt: Math.max(0, Number(item.lastAnswerAt) || 0)
      };
    }
    const settings = raw.settings && typeof raw.settings === "object" && !Array.isArray(raw.settings) ? raw.settings : {};
    const daily = raw.daily && typeof raw.daily === "object" && !Array.isArray(raw.daily) ? raw.daily : {};
    const presets = Array.isArray(settings.presets) ? settings.presets.slice(-20).filter((item) =>
      item && typeof item === "object" && typeof item.name === "string" && item.name.trim()
    ).map((item) => {
      const config = item.config && typeof item.config === "object" && !Array.isArray(item.config) ? item.config : {};
      const sources = new Set(["all", "stage", "selected-stages", "extra", "weak", "due", "mistakes", "favorites", "new"]);
      const modes = new Set(["he-ar", "ar-he", "typed-he-ar", "typed-ar-he", "flashcards", "matching"]);
      const difficulties = new Set(["easy", "medium", "hard", "adaptive", "custom"]);
      return {
        id: String(item.id || makeId()).slice(0, 120),
        name: item.name.trim().slice(0, 50),
        config: {
          source: sources.has(config.source) ? config.source : "all",
          stageId: typeof config.stageId === "string" ? config.stageId.slice(0, 120) : "",
          stageIds: Array.isArray(config.stageIds) ? config.stageIds.filter((id) => typeof id === "string").slice(0, 50) : [],
          mode: modes.has(config.mode) ? config.mode : "he-ar",
          count: config.count === "all" ? "all" : Math.max(1, Math.min(200, Number(config.count) || 10)),
          optionCount: Math.max(2, Math.min(5, Number(config.optionCount) || 4)),
          difficulty: difficulties.has(config.difficulty) ? config.difficulty : "medium",
          timerSeconds: [0, 10, 15, 20, 30, 45, 60].includes(Number(config.timerSeconds)) ? Number(config.timerSeconds) : 0,
          shuffle: config.shuffle !== false,
          noRepeat: config.noRepeat !== false,
          feedback: config.feedback === "end" ? "end" : "instant",
          excludeMastered: Boolean(config.excludeMastered),
          distractorScope: config.distractorScope === "question-source" ? "question-source" : "library"
        }
      };
    }) : [];
    const sessions = Array.isArray(raw.sessions) ? raw.sessions.slice(-MAX_SESSIONS).filter((item) =>
      item && typeof item === "object" && !Array.isArray(item)
    ).map((item) => ({
      id: String(item.id || makeId()).slice(0, 120),
      title: String(item.title || "جلسة تدريب").slice(0, 100),
      startedAt: Math.max(0, Number(item.startedAt) || 0),
      finishedAt: Math.max(0, Number(item.finishedAt) || 0),
      total: Math.max(0, Math.min(10000000, Number(item.total) || 0)),
      correct: Math.max(0, Math.min(10000000, Number(item.correct) || 0)),
      incorrect: Math.max(0, Math.min(10000000, Number(item.incorrect) || 0)),
      accuracy: Math.max(0, Math.min(100, Number(item.accuracy) || 0)),
      wrongWordIds: Array.isArray(item.wrongWordIds) ? [...new Set(item.wrongWordIds.filter((id) => typeof id === "string").map((id) => id.slice(0, 120)))].slice(0, 200) : [],
      settings: item.settings && typeof item.settings === "object" && !Array.isArray(item.settings) ? {
        mode: String(item.settings.mode || "he-ar").slice(0, 30),
        source: String(item.settings.source || "all").slice(0, 30)
      } : {}
    })) : [];
    const adaptiveEventIds = Object.create(null);
    if (raw.adaptiveEventIds && typeof raw.adaptiveEventIds === "object" && !Array.isArray(raw.adaptiveEventIds)) {
      for (const [id, at] of Object.entries(raw.adaptiveEventIds).slice(-10000)) {
        if (id && id.length <= 200 && !["__proto__", "constructor", "prototype"].includes(id)) adaptiveEventIds[id] = Math.max(0, Number(at) || 0);
      }
    }
    const learningEvents = Object.create(null);
    if (raw.learningEvents && typeof raw.learningEvents === "object" && !Array.isArray(raw.learningEvents)) {
      for (const [id, item] of Object.entries(raw.learningEvents).slice(-MAX_LEARNING_EVENTS)) {
        if (!id || !id.startsWith("answer:") || id.length > 200 ||
            ["__proto__", "constructor", "prototype"].includes(id) ||
            !item || typeof item !== "object" || Array.isArray(item) ||
            typeof item.wordId !== "string" || !item.wordId || item.wordId.length > 120 ||
            typeof item.correct !== "boolean") continue;
        learningEvents[id] = {
          eventId: String(item.eventId || id.slice(7)).slice(0, 180),
          wordId: item.wordId,
          correct: item.correct,
          selectedWordId: typeof item.selectedWordId === "string" ? item.selectedWordId.slice(0, 120) : null,
          source: typeof item.source === "string" ? item.source.slice(0, 100) : "",
          at: Math.max(0, Number(item.at) || 0),
          date: typeof item.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(item.date) ? item.date : "",
          direction: item.direction === "he-ar" || item.direction === "ar-he" ? item.direction : null
        };
      }
    }
    const legacyTotals = raw.legacyTotals && typeof raw.legacyTotals === "object" ? {
      correct: Math.max(0, Number(raw.legacyTotals.correct) || 0),
      attempted: Math.max(0, Number(raw.legacyTotals.attempted) || 0)
    } : null;
    return {
      ...base,
      version: 3,
      migrations: (() => {
        const value = raw.migrations && typeof raw.migrations === "object" && !Array.isArray(raw.migrations)
          ? raw.migrations.academicProgressV1 : null;
        return value && typeof value === "object" && !Array.isArray(value) ? {
          academicProgressV1: {
            completedAt: Math.max(0, Number(value.completedAt) || 0),
            migratedTermCount: Math.max(0, Math.min(1000, Number(value.migratedTermCount) || 0)),
            mappedTermCount: Math.max(0, Math.min(1000, Number(value.mappedTermCount) || 0)),
            mergedProgressCount: Math.max(0, Math.min(1000, Number(value.mergedProgressCount) || 0)),
            skippedTermCount: Math.max(0, Math.min(1000, Number(value.skippedTermCount) || 0))
          }
        } : {};
      })(),
      extras: uniqueExtras(raw.extras),
      progress: cleanedProgress,
      mistakes: Array.isArray(raw.mistakes) ? raw.mistakes.slice(-500).filter((m) => m && typeof m.wordId === "string").map((m) => ({
        id: String(m.id || makeId()).slice(0, 120), wordId: String(m.wordId).slice(0, 120), selectedWordId: m.selectedWordId ? String(m.selectedWordId).slice(0, 120) : null,
        createdAt: Number(m.createdAt) || Date.now(), source: String(m.source || "app").slice(0, 100)
      })) : [],
      sessions,
      settings: {
        ...base.settings,
        theme: settings.theme === "dark" ? "dark" : "light",
        dailyGoal: Math.max(1, Math.min(100, Number(settings.dailyGoal) || 10)),
        defaultCount: Math.max(1, Math.min(200, Number(settings.defaultCount) || 10)),
        defaultMode: typeof settings.defaultMode === "string" ? settings.defaultMode.slice(0, 30) : "he-ar",
        timerSeconds: [0, 10, 15, 20, 30, 45, 60].includes(Number(settings.timerSeconds)) ? Number(settings.timerSeconds) : 0,
        feedbackTiming: settings.feedbackTiming === "end" ? "end" : "instant",
        focusMode: Boolean(settings.focusMode),
        sound: Boolean(settings.sound),
        largeText: Boolean(settings.largeText),
        presets
      },
      daily: {
        lastDate: typeof daily.lastDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(daily.lastDate) ? daily.lastDate : "",
        streak: Math.max(0, Math.min(10000, Number(daily.streak) || 0)),
        completed: Math.max(0, Math.min(10000, Number(daily.completed) || 0))
      },
      legacyTotals,
      adaptiveEventIds,
      learningEvents,
      lastSessionSummary: raw.lastSessionSummary && typeof raw.lastSessionSummary === "object" && !Array.isArray(raw.lastSessionSummary)
        ? sessions.find((item) => item.id === raw.lastSessionSummary.id) || null : null,
      completedStageIds: Array.isArray(raw.completedStageIds) ? raw.completedStageIds.filter((id) => typeof id === "string").slice(0, 100) : []
    };
  }

  function normalizeHebrewHeadword(value) {
    return String(value ?? "").normalize("NFC")
      .replace(/[\u0591-\u05C7]/g, "")
      .replace(/[\u200e\u200f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLocaleLowerCase("he");
  }

  function mergeProgressWithoutDoubleCounting(...records) {
    const valid = records.filter((item) => item && typeof item === "object" && !Array.isArray(item));
    if (!valid.length) return null;
    const latest = valid.reduce((winner, item) => {
      const winnerAt = Math.max(Number(winner?.lastReviewedAt) || 0, Number(winner?.lastAnswerAt) || 0);
      const itemAt = Math.max(Number(item?.lastReviewedAt) || 0, Number(item?.lastAnswerAt) || 0);
      return itemAt >= winnerAt ? item : winner;
    }, valid[0]);
    const positiveDueDates = valid.map(item => Number(item.dueAt) || 0).filter(value => value > 0);
    return {
      attempts: Math.max(0, ...valid.map(item => Number(item.attempts) || 0)),
      correct: Math.max(0, ...valid.map(item => Number(item.correct) || 0)),
      incorrect: Math.max(0, ...valid.map(item => Number(item.incorrect) || 0)),
      mistakes: Math.max(0, ...valid.map(item => Number(item.mistakes) || Number(item.incorrect) || 0)),
      favorite: valid.some(item => Boolean(item.favorite)),
      mastered: Boolean(latest.mastered),
      dueAt: positiveDueDates.length ? Math.min(...positiveDueDates) : 0,
      intervalDays: Math.max(0, ...valid.map(item => Number(item.intervalDays) || 0)),
      repetitions: Math.max(0, ...valid.map(item => Number(item.repetitions) || 0)),
      ease: Number(latest.ease) || Math.max(1.3, ...valid.map(item => Number(item.ease) || 2.3)),
      lapses: Math.max(0, ...valid.map(item => Number(item.lapses) || 0)),
      lastReviewedAt: Math.max(0, ...valid.map(item => Number(item.lastReviewedAt) || 0)),
      lastAnswerAt: Math.max(0, ...valid.map(item => Number(item.lastAnswerAt) || 0))
    };
  }

  function migrateAcademicProgress(state, academicSnapshot, academicTerms, officialWords = []) {
    const next = sanitizeState({ ...state, version: 3 });
    if (!next) return { state: null, migrated: false, reason: "invalid-main-state" };
    if (next.migrations?.academicProgressV1) return { state: next, migrated: false, alreadyMigrated: true };
    if (!academicSnapshot || academicSnapshot.version !== 1 ||
        !academicSnapshot.progress || typeof academicSnapshot.progress !== "object" ||
        Array.isArray(academicSnapshot.progress) || !Array.isArray(academicTerms) ||
        !academicTerms.length || !Array.isArray(officialWords) || !officialWords.length) {
      return { state: next, migrated: false, pending: true, reason: "academic-data-not-ready" };
    }

    const byHebrew = new Map();
    const byId = new Map();
    for (const word of officialWords) {
      if (!word || typeof word.id !== "string") continue;
      byId.set(word.id, word);
      const key = normalizeHebrewHeadword(word.he);
      if (key && !byHebrew.has(key)) byHebrew.set(key, word);
    }

    const idMap = new Map();
    let mappedTermCount = 0;
    let skippedTermCount = 0;
    for (const term of academicTerms) {
      if (!term || typeof term.id !== "string") { skippedTermCount += 1; continue; }
      const target = byHebrew.get(normalizeHebrewHeadword(term.he)) || byId.get(term.id);
      if (!target) { skippedTermCount += 1; continue; }
      idMap.set(term.id, target.id);
      mappedTermCount += 1;
    }

    if (!mappedTermCount) {
      return { state: next, migrated: false, pending: true, reason: "no-academic-terms-matched" };
    }

    const migratedTargets = new Set();
    let mergedProgressCount = 0;
    for (const term of academicTerms) {
      const targetId = idMap.get(term?.id);
      if (!targetId) continue;
      const oldAcademicProgress = academicSnapshot.progress[term.id];
      const mainAcademicProgress = next.progress[term.id];
      const currentTargetProgress = next.progress[targetId];
      if (oldAcademicProgress || mainAcademicProgress || currentTargetProgress) {
        const merged = mergeProgressWithoutDoubleCounting(
          currentTargetProgress,
          mainAcademicProgress,
          oldAcademicProgress
        );
        if (merged) next.progress[targetId] = merged;
        mergedProgressCount += 1;
      }
      if (targetId !== term.id) delete next.progress[term.id];
      migratedTargets.add(targetId);
    }

    next.mistakes = next.mistakes.map(item => ({
      ...item,
      wordId: idMap.get(item.wordId) || item.wordId,
      selectedWordId: item.selectedWordId ? (idMap.get(item.selectedWordId) || item.selectedWordId) : null
    }));
    next.sessions = next.sessions.map(item => ({
      ...item,
      wrongWordIds: item.wrongWordIds.map(id => idMap.get(id) || id)
    }));
    next.lastSessionSummary = next.lastSessionSummary ? {
      ...next.lastSessionSummary,
      wrongWordIds: next.lastSessionSummary.wrongWordIds.map(id => idMap.get(id) || id)
    } : null;
    next.migrations = {
      ...next.migrations,
      academicProgressV1: {
        completedAt: Date.now(),
        migratedTermCount: academicTerms.length,
        mappedTermCount,
        mergedProgressCount,
        skippedTermCount
      }
    };
    return {
      state: next,
      migrated: true,
      mappedTermCount,
      mergedProgressCount,
      skippedTermCount,
      canonicalWordCount: migratedTargets.size
    };
  }

  function saveState(state, storage) {
    try {
      const target = storage || (typeof localStorage !== "undefined" ? localStorage : null);
      if (!target) return false;
      const clean = sanitizeState({ ...state, version: 3 });
      if (!clean) return false;
      const serialized = JSON.stringify(clean);
      if (serialized.length > MAX_STATE_CHARS) return false;
      target.setItem(STATE_KEY, serialized);
      return true;
    } catch {
      return false;
    }
  }

  function loadState(storage, officialWords = []) {
    const target = storage || (typeof localStorage !== "undefined" ? localStorage : null);
    const raw = safeGet(target, STATE_KEY);
    const parsed = parse(raw, null);
    const normalized = sanitizeState(parsed);
    if (normalized) return normalized;
    const migrated = migrateLegacy(target, officialWords);
    saveState(migrated, target);
    return migrated;
  }

  function validateBackup(input) {
    let raw = input;
    if (typeof raw === "string") {
      if (raw.length > MAX_BACKUP_CHARS) return { ok: false, error: "حجم النسخة الاحتياطية أكبر من الحد المسموح." };
      raw = parse(raw, null);
      if (!raw) return { ok: false, error: "ملف النسخة الاحتياطية ليس JSON صالحًا." };
    }
    const state = sanitizeState(raw);
    if (!state) return { ok: false, error: "نسخة غير متوافقة أو بياناتها غير مكتملة." };
    const hasAdaptive = Object.prototype.hasOwnProperty.call(raw, "adaptive");
    let adaptiveState;
    if (hasAdaptive) {
      const adaptive = raw.adaptive;
      if (!adaptive || typeof adaptive !== "object" || Array.isArray(adaptive) || adaptive.version !== 1) {
        return { ok: false, error: "بيانات التدريب التكيفي في النسخة غير صالحة أو غير متوافقة." };
      }
      try {
        adaptiveState = JSON.parse(JSON.stringify(adaptive));
        if (JSON.stringify(adaptiveState).length > MAX_ADAPTIVE_BACKUP_CHARS) {
          return { ok: false, error: "حجم بيانات التدريب التكيفي في النسخة يتجاوز الحد المسموح." };
        }
      } catch {
        return { ok: false, error: "تعذرت قراءة بيانات التدريب التكيفي في النسخة." };
      }
    }
    return { ok: true, state, ...(hasAdaptive ? { adaptiveState } : {}) };
  }

  function exportBackup(state, adaptiveState) {
    const clean = sanitizeState({ ...state, version: 3 });
    if (!clean) throw new Error("لا يمكن تصدير حالة غير صالحة.");
    const backup = { ...clean, exportedAt: new Date().toISOString(), app: "mila-yaelnet-studio" };
    if (adaptiveState !== undefined && adaptiveState !== null) {
      const adaptive = adaptiveState && typeof adaptiveState === "object" && !Array.isArray(adaptiveState) && adaptiveState.version === 1
        ? JSON.parse(JSON.stringify(adaptiveState))
        : null;
      if (!adaptive || JSON.stringify(adaptive).length > MAX_ADAPTIVE_BACKUP_CHARS) {
        throw new Error("بيانات التدريب التكيفي غير صالحة أو تتجاوز حد النسخة الاحتياطية.");
      }
      backup.adaptive = adaptive;
    }
    const serialized = JSON.stringify(backup, null, 2);
    if (serialized.length > MAX_BACKUP_CHARS) throw new Error("حجم النسخة الاحتياطية أكبر من الحد المسموح.");
    return serialized;
  }

  function importBackup(input, storage) {
    const result = validateBackup(input);
    if (!result.ok) return result;
    const target = storage || (typeof localStorage !== "undefined" ? localStorage : null);
    if (!target) return { ok: false, error: "التخزين المحلي غير متاح." };
    const previousMain = safeGet(target, STATE_KEY);
    const previousAdaptive = safeGet(target, ADAPTIVE_STATE_KEY);
    if (!saveState(result.state, target)) return { ok: false, error: "تعذر حفظ النسخة؛ قد تكون مساحة التخزين ممتلئة." };
    try {
      if (result.adaptiveState) target.setItem(ADAPTIVE_STATE_KEY, JSON.stringify(result.adaptiveState));
    } catch {
      try {
        if (previousMain === null) target.removeItem(STATE_KEY);
        else target.setItem(STATE_KEY, previousMain);
        if (previousAdaptive === null) target.removeItem(ADAPTIVE_STATE_KEY);
        else target.setItem(ADAPTIVE_STATE_KEY, previousAdaptive);
      } catch {}
      return { ok: false, error: "تعذر حفظ بيانات التدريب التكيفي؛ أُعيدت بيانات المنصة السابقة قدر الإمكان." };
    }
    return { ok: true, state: result.state, adaptiveState: result.adaptiveState || null };
  }

  return {
    STATE_KEY,
    LEGACY_PROGRESS_KEY,
    LEGACY_EXTRAS_KEY,
    createDefaultState,
    normalizeWord,
    uniqueExtras,
    migrateLegacy,
    sanitizeState,
    migrateAcademicProgress,
    saveState,
    loadState,
    validateBackup,
    exportBackup,
    importBackup
  };
});
