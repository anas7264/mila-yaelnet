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
  const MAX_BACKUP_CHARS = 2_000_000;
  const MAX_WORDS = 5000;
  const MAX_SESSIONS = 500;

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
      legacyTotals: null
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
      total: Math.max(0, Math.min(200, Number(item.total) || 0)),
      correct: Math.max(0, Math.min(200, Number(item.correct) || 0)),
      incorrect: Math.max(0, Math.min(200, Number(item.incorrect) || 0)),
      accuracy: Math.max(0, Math.min(100, Number(item.accuracy) || 0)),
      wrongWordIds: Array.isArray(item.wrongWordIds) ? [...new Set(item.wrongWordIds.filter((id) => typeof id === "string").map((id) => id.slice(0, 120)))].slice(0, 200) : [],
      settings: item.settings && typeof item.settings === "object" && !Array.isArray(item.settings) ? {
        mode: String(item.settings.mode || "he-ar").slice(0, 30),
        source: String(item.settings.source || "all").slice(0, 30)
      } : {}
    })) : [];
    const legacyTotals = raw.legacyTotals && typeof raw.legacyTotals === "object" ? {
      correct: Math.max(0, Number(raw.legacyTotals.correct) || 0),
      attempted: Math.max(0, Number(raw.legacyTotals.attempted) || 0)
    } : null;
    return {
      ...base,
      version: 3,
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
      completedStageIds: Array.isArray(raw.completedStageIds) ? raw.completedStageIds.filter((id) => typeof id === "string").slice(0, 100) : []
    };
  }

  function saveState(state, storage) {
    try {
      const target = storage || (typeof localStorage !== "undefined" ? localStorage : null);
      if (!target) return false;
      const clean = sanitizeState({ ...state, version: 3 });
      if (!clean) return false;
      const serialized = JSON.stringify(clean);
      if (serialized.length > MAX_BACKUP_CHARS) return false;
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
    return { ok: true, state };
  }

  function exportBackup(state) {
    const clean = sanitizeState({ ...state, version: 3 });
    if (!clean) throw new Error("لا يمكن تصدير حالة غير صالحة.");
    return JSON.stringify({ ...clean, exportedAt: new Date().toISOString(), app: "mila-yaelnet-studio" }, null, 2);
  }

  function importBackup(input, storage) {
    const result = validateBackup(input);
    if (!result.ok) return result;
    if (!saveState(result.state, storage)) return { ok: false, error: "تعذر حفظ النسخة؛ قد تكون مساحة التخزين ممتلئة." };
    return { ok: true, state: result.state };
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
    saveState,
    loadState,
    validateBackup,
    exportBackup,
    importBackup
  };
});
