(function attachQuizEngine(root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.VocabularyQuizEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createQuizEngine() {
  "use strict";

  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const DAY = 24 * 60 * 60 * 1000;
  const HOUR = 60 * 60 * 1000;

  function normalizeText(value) {
    return String(value ?? "")
      .normalize("NFC")
      .toLocaleLowerCase()
      .replace(/[\u0591-\u05C7]/g, "")
      .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
      .replace(/[.,،؛:!?؟()[\]{}"'«»/|\\_–—-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function aliases(word, field = "ar") {
    return String(word?.[field] ?? "")
      .split(/[\/|،;؛]+/g)
      .map(normalizeText)
      .filter(Boolean);
  }

  function haveMeaningConflict(a, b) {
    if (!a || !b || a.id === b.id) return false;
    if (a.conceptGroup && b.conceptGroup && a.conceptGroup === b.conceptGroup) return true;
    const aa = aliases(a);
    const bb = aliases(b);
    return aa.some((item) => bb.includes(item));
  }

  function shuffle(items, random = Math.random) {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i -= 1) {
      const sample = Number(random());
      const j = Math.floor(clamp(Number.isFinite(sample) ? sample : 0, 0, 0.999999999) * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  function uniqueWords(words) {
    const seen = new Set();
    return (Array.isArray(words) ? words : []).filter((word) => {
      if (!word || typeof word.id !== "string" || !word.id || seen.has(word.id)) return false;
      if (!String(word.he ?? "").trim() || !String(word.ar ?? "").trim()) return false;
      seen.add(word.id);
      return true;
    });
  }

  function buildQuestion(target, pool, options = {}) {
    if (!target?.id || !String(target.he ?? "").trim() || !String(target.ar ?? "").trim()) return null;
    const random = typeof options.random === "function" ? options.random : Math.random;
    const mode = options.mode === "ar-he" ? "ar-he" : "he-ar";
    const requested = clamp(Number(options.optionCount) || 4, 2, 5);
    const words = uniqueWords(pool);
    const distractors = shuffle(words.filter((item) =>
      item.id !== target.id && !haveMeaningConflict(target, item)
    ), random);
    const selected = [];
    for (const candidate of distractors) {
      if (selected.every((item) => !haveMeaningConflict(item, candidate))) selected.push(candidate);
      if (selected.length >= requested - 1) break;
    }
    if (!selected.length) return null;
    const choiceField = mode === "ar-he" ? "he" : "ar";
    const promptField = mode === "ar-he" ? "ar" : "he";
    const choices = shuffle(
      [target, ...selected].map((word) => ({ wordId: word.id, text: String(word[choiceField]).trim() })),
      random
    );
    return {
      id: `q-${target.id}-${Math.floor(random() * 0x7fffffff).toString(36)}`,
      targetWordId: target.id,
      correctWordId: target.id,
      mode,
      prompt: String(target[promptField]).trim(),
      choices,
      warnings: choices.length < requested ? [`تم تقليل عدد الخيارات إلى ${choices.length} لعدم توفر مشتتات كافية غير ملتبسة.`] : []
    };
  }

  function buildSession(sourceWords, config = {}) {
    const source = uniqueWords(sourceWords);
    const targets = uniqueWords(config.targetWords || source);
    const pool = uniqueWords(config.distractorPool || source);
    const random = typeof config.random === "function" ? config.random : Math.random;
    const count = config.count === "all" ? targets.length : clamp(Number(config.count) || 10, 1, 200);
    const ordered = config.shuffle === false ? [...targets] : shuffle(targets, random);
    const selected = config.noRepeat === false
      ? Array.from({ length: count }, (_, i) => targets[i % Math.max(1, targets.length)]).filter(Boolean)
      : ordered.slice(0, count);
    const questions = [];
    const warnings = [];
    const optionCount = config.optionCount || (config.difficulty === "easy" ? 2 : config.difficulty === "medium" ? 3 : config.difficulty === "hard" ? 5 : 4);
    for (const target of selected) {
      const question = buildQuestion(target, pool, { ...config, optionCount, random });
      if (question) {
        questions.push(question);
        warnings.push(...question.warnings);
      } else {
        warnings.push(`تعذر إنشاء سؤال للكلمة: ${target.he}`);
      }
    }
    return {
      id: `session-${Date.now().toString(36)}-${Math.floor(random() * 1e9).toString(36)}`,
      questions,
      sourceCount: targets.length,
      poolCount: pool.length,
      skippedCount: selected.length - questions.length,
      warnings: [...new Set(warnings)],
      settings: {
        mode: config.mode === "ar-he" ? "ar-he" : "he-ar",
        count: config.count ?? 10,
        optionCount: clamp(Number(optionCount) || 4, 2, 5),
        difficulty: config.difficulty || "medium",
        shuffle: config.shuffle !== false,
        noRepeat: config.noRepeat !== false
      }
    };
  }

  function filterWords(words, progress = {}, filters = {}) {
    const now = Number.isFinite(filters.now) ? filters.now : Date.now();
    const stageIds = Array.isArray(filters.stageIds) ? new Set(filters.stageIds) : null;
    const query = normalizeText(filters.search || "");
    const mistakes = Array.isArray(progress.mistakes) ? progress.mistakes : [];
    const mistakeIds = new Set(mistakes.map((m) => m?.termId || m?.targetWordId || m?.wordId).filter(Boolean));
    return uniqueWords(words).filter((word) => {
      const p = progress[word.id] || {};
      if (filters.stageId && word.stageId !== filters.stageId) return false;
      if (stageIds && !stageIds.has(word.stageId) && !(filters.includeExtras && word.source === "extra")) return false;
      if (filters.source === "extra" && word.source !== "extra") return false;
      if (filters.source === "stage" && word.source === "extra") return false;
      if (filters.favoritesOnly && !p.favorite) return false;
      if (filters.learnedOnly && !p.mastered) return false;
      if (filters.newOnly && (Number(p.attempts) || 0) > 0) return false;
      if (filters.dueOnly && (!p.dueAt || Number(p.dueAt) > now)) return false;
      if (filters.weakOnly) {
        const attempts = Number(p.attempts) || 0;
        const rate = attempts ? (Number(p.correct) || 0) / attempts : 1;
        if (!attempts || rate >= 0.7) return false;
      }
      if (filters.mistakesOnly && !(Number(p.mistakes) > 0 || mistakeIds.has(word.id))) return false;
      if (query && !normalizeText(word.he).includes(query) && !normalizeText(word.ar).includes(query)) return false;
      return true;
    });
  }

  function checkTypedAnswer(word, input, mode = "he-ar") {
    const expectedRaw = mode === "ar-he" ? word?.he : word?.ar;
    const alternatives = String(expectedRaw ?? "").split(/[\/|،;؛]+/g).map(normalizeText).filter(Boolean);
    const actual = normalizeText(input);
    return {
      correct: Boolean(actual) && alternatives.includes(actual),
      expected: String(expectedRaw ?? ""),
      normalized: actual
    };
  }

  function gradeAnswer(question, selectedWordId) {
    const valid = question?.choices?.some((choice) => choice.wordId === selectedWordId);
    return {
      correct: Boolean(valid && selectedWordId === question.correctWordId),
      targetWordId: question?.targetWordId ?? null,
      correctWordId: question?.correctWordId ?? null,
      selectedWordId: valid ? selectedWordId : null
    };
  }

  function scheduleReview(previous = {}, rating = "good", now = Date.now()) {
    const allowed = new Set(["again", "hard", "good", "easy"]);
    const grade = allowed.has(rating) ? rating : "good";
    const repetitions = Math.max(0, Number(previous.repetitions) || 0);
    const priorInterval = Math.max(0, Number(previous.intervalDays) || 0);
    const ease = clamp(Number(previous.ease) || 2.3, 1.3, 3.0);
    let intervalDays;
    let nextEase = ease;
    let nextRepetitions = repetitions + 1;
    let lapses = Math.max(0, Number(previous.lapses) || 0);
    let dueAt;
    if (grade === "again") {
      intervalDays = 10 / (24 * 60);
      dueAt = now + 10 * 60 * 1000;
      nextRepetitions = 0;
      nextEase = Math.max(1.3, ease - 0.2);
      lapses += 1;
    } else if (grade === "hard") {
      intervalDays = repetitions === 0 ? 0.75 : Math.max(1, priorInterval * 1.2);
      dueAt = now + intervalDays * DAY;
      nextEase = Math.max(1.3, ease - 0.15);
    } else if (grade === "easy") {
      intervalDays = repetitions === 0 ? 3 : Math.max(3, priorInterval * (ease + 0.4));
      dueAt = now + intervalDays * DAY;
      nextEase = Math.min(3.0, ease + 0.15);
    } else {
      intervalDays = repetitions === 0 ? 1 : repetitions === 1 ? 3 : Math.max(1, priorInterval * ease);
      dueAt = now + intervalDays * DAY;
      nextEase = Math.min(3.0, ease + 0.02);
    }
    return {
      rating: grade,
      intervalDays: Number(intervalDays.toFixed(3)),
      dueAt: Math.round(dueAt),
      repetitions: nextRepetitions,
      ease: Number(nextEase.toFixed(2)),
      lapses,
      lastReviewedAt: now
    };
  }

  function summarizeSession(results = []) {
    const list = Array.isArray(results) ? results : [];
    const correct = list.filter((item) => item?.correct).length;
    const incorrect = list.length - correct;
    return {
      total: list.length,
      correct,
      incorrect,
      accuracy: list.length ? Math.round((correct / list.length) * 100) : 0,
      wrongWordIds: [...new Set(list.filter((item) => !item?.correct).map((item) => item.targetWordId).filter(Boolean))]
    };
  }

  return {
    normalizeText,
    haveMeaningConflict,
    shuffle,
    buildQuestion,
    buildSession,
    filterWords,
    checkTypedAnswer,
    gradeAnswer,
    scheduleReview,
    summarizeSession
  };
});
