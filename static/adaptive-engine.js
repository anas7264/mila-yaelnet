(function attachMilaAdaptive(root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.MilaAdaptiveEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createMilaAdaptiveEngine() {
  "use strict";
  const VERSION = 2;
  const DIRECTIONS = Object.freeze(["he-ar", "ar-he"]);
  const DEFAULT_POLICY = Object.freeze({ minDelay: 2, maxDelay: 4, maxRetries: 3 });
  const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));
  const randomIndex = (random, min, max) => min + Math.floor(clamp(random(), 0, 0.999999999) * (max - min + 1));

  function normalizeText(value) {
    return String(value ?? "").normalize("NFC").toLocaleLowerCase()
      .replace(/[\u0591-\u05C7]/g, "")
      .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
      .replace(/[.,،؛:!?؟()[\]{}"'«»/|\\_–—-]/g, " ")
      .replace(/\s+/g, " ").trim();
  }
  function aliases(value) {
    return String(value ?? "").split(/[\/|،,;؛]+/u).map(normalizeText).filter(Boolean);
  }
  function uniqueWords(words) {
    const seen = new Set();
    return (Array.isArray(words) ? words : []).filter(word => {
      if (!word || typeof word.id !== "string" || !word.id || seen.has(word.id)) return false;
      if (!String(word.he ?? "").trim() || !String(word.ar ?? "").trim()) return false;
      seen.add(word.id); return true;
    });
  }
  function gradeAnswer(word, direction, answer) {
    if (!word || !DIRECTIONS.includes(direction)) return false;
    return Boolean(normalizeText(answer)) && aliases(word[direction === "he-ar" ? "ar" : "he"]).includes(normalizeText(answer));
  }
  function createState() {
    return { version: VERSION, progress: {}, session: null, policy: { ...DEFAULT_POLICY } };
  }
  function normalizeCard(card) {
    const source = card && typeof card === "object" ? card : {};
    return {
      attempts: clamp(source.attempts, 0, 1000000),
      correct: clamp(source.correct, 0, 1000000),
      incorrect: clamp(source.incorrect, 0, 1000000),
      consecutiveCorrect: clamp(source.consecutiveCorrect, 0, 1000000),
      failures: clamp(source.failures, 0, 1000000),
      priority: clamp(source.priority, 0, 100),
      cooldownCycles: Math.round(clamp(source.cooldownCycles, 0, 20)),
      intervalDays: clamp(source.intervalDays, 0, 36500),
      dueAt: Math.max(0, Number(source.dueAt) || 0),
      ease: clamp(source.ease ?? 2.3, 1.3, 3),
      lastSeenAt: Number(source.lastSeenAt) || 0,
      lastResult: source.lastResult === "correct" || source.lastResult === "incorrect" ? source.lastResult : null
    };
  }
  function normalizeState(raw) {
    const state = createState();
    // Version 1 data is migrated in place; existing counters and sessions survive.
    if (!raw || ![1, VERSION].includes(raw.version) || typeof raw !== "object" || Array.isArray(raw)) return state;
    if (raw.progress && typeof raw.progress === "object" && !Array.isArray(raw.progress)) {
      for (const [wordId, value] of Object.entries(raw.progress)) {
        if (!wordId || wordId.length > 120 || !value || typeof value !== "object") continue;
        state.progress[wordId] = { heToAr: normalizeCard(value.heToAr), arToHe: normalizeCard(value.arToHe) };
      }
    }
    const policy = raw.policy && typeof raw.policy === "object" ? raw.policy : {};
    state.policy = {
      minDelay: Math.round(clamp(policy.minDelay ?? DEFAULT_POLICY.minDelay, 1, 8)),
      maxDelay: Math.round(clamp(policy.maxDelay ?? DEFAULT_POLICY.maxDelay, 2, 12)),
      maxRetries: Math.round(clamp(policy.maxRetries ?? DEFAULT_POLICY.maxRetries, 1, 5))
    };
    if (state.policy.maxDelay < state.policy.minDelay) state.policy.maxDelay = state.policy.minDelay;
    const session = raw.session;
    if (session && typeof session === "object" && DIRECTIONS.includes(session.direction) &&
        Array.isArray(session.queue) && session.queue.every(id => typeof id === "string") && session.queue.length <= 10000) {
      const queue = [...session.queue];
      state.session = {
        id: typeof session.id === "string" ? session.id.slice(0, 100) : "resumed",
        direction: session.direction, queue,
        wordIds: Array.isArray(session.wordIds)
          ? [...new Set(session.wordIds.filter(id => typeof id === "string").map(id => id.slice(0, 120)))].slice(0, 10000)
          : [...new Set(queue)],
        mode: ["smart", "due", "weak", "new", "all"].includes(session.mode) ? session.mode : "all",
        cursor: Math.round(clamp(session.cursor, 0, Math.max(0, queue.length))),
        cycle: Math.max(1, Math.round(clamp(session.cycle, 1, 1000000))),
        retryCounts: session.retryCounts && typeof session.retryCounts === "object" ? { ...session.retryCounts } : {},
        answered: Boolean(session.answered), paused: Boolean(session.paused),
        completed: Boolean(session.completed),
        questionId: typeof session.questionId === "string" ? session.questionId.slice(0, 180) : "",
        attempts: clamp(session.attempts, 0, 10000000),
        correct: clamp(session.correct, 0, 10000000),
        incorrect: clamp(session.incorrect, 0, 10000000),
        startedAt: Math.max(0, Number(session.startedAt) || 0),
        results: Array.isArray(session.results) ? session.results.slice(-10000).filter(item => item && typeof item.questionId === "string" && typeof item.wordId === "string" && typeof item.correct === "boolean").map(item => ({ questionId: item.questionId.slice(0, 180), wordId: item.wordId.slice(0, 120), correct: item.correct, at: Math.max(0, Number(item.at) || 0), direction: DIRECTIONS.includes(item.direction) ? item.direction : session.direction })) : [],
        wrongWordIds: Array.isArray(session.wrongWordIds) ? [...new Set(session.wrongWordIds.filter(id => typeof id === "string").map(id => id.slice(0, 120)))].slice(0, 200) : [],
        lastResult: session.lastResult && typeof session.lastResult === "object" ? { ...session.lastResult } : null
      };
      if (state.session.cursor >= state.session.queue.length) {
        state.session.answered = true;
        if (state.session.mode !== "all") state.session.completed = true;
      }
    }
    return state;
  }
  function shuffle(items, random) {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i -= 1) {
      const j = Math.floor(clamp(random(), 0, 0.999999999) * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
  function cardFor(state, wordId, direction) {
    if (!state.progress[wordId]) state.progress[wordId] = { heToAr: normalizeCard(), arToHe: normalizeCard() };
    const key = direction === "he-ar" ? "heToAr" : "arToHe";
    if (!state.progress[wordId][key]) state.progress[wordId][key] = normalizeCard();
    return state.progress[wordId][key];
  }
  function makeQuestionId(session) {
    return session.id + ":" + session.cycle + ":" + session.cursor + ":" + session.queue[session.cursor];
  }
  function masteryOf(rawCard, now = Date.now()) {
    const card = normalizeCard(rawCard);
    if (!card.attempts) return "new";
    if ((card.priority >= 5 && card.consecutiveCorrect < 3) || card.incorrect > card.correct) return "weak";
    if (card.consecutiveCorrect >= 5 && card.intervalDays >= 14) return "mastered";
    if (card.consecutiveCorrect > 0) return "saved";
    if (card.dueAt > 0 && card.dueAt > now) return "scheduled";
    return "learning";
  }
  function getStats(rawState, words, direction, now = Date.now()) {
    const state = normalizeState(rawState), key = direction === "he-ar" ? "heToAr" : "arToHe";
    const stats = { total: uniqueWords(words).length, new: 0, weak: 0, due: 0, scheduled: 0, mastered: 0, learning: 0 };
    for (const word of uniqueWords(words)) {
      const card = normalizeCard(state.progress[word.id]?.[key]);
      const mastery = masteryOf(card, now);
      stats[mastery] = (stats[mastery] || 0) + 1;
      if (card.attempts > 0 && (!card.dueAt || card.dueAt <= now)) stats.due += 1;
    }
    return stats;
  }
  function selectWords(rawState, words, direction, mode = "smart", now = Date.now(), limit = 30, random = Math.random) {
    if (!DIRECTIONS.includes(direction)) throw new TypeError("Unsupported recall direction");
    const state = normalizeState(rawState), pool = uniqueWords(words);
    const key = direction === "he-ar" ? "heToAr" : "arToHe";
    const enriched = pool.map(word => {
      const card = normalizeCard(state.progress[word.id]?.[key]);
      const due = card.attempts > 0 && (!card.dueAt || card.dueAt <= now);
      const weak = card.attempts > 0 && ((card.priority >= 5 && card.consecutiveCorrect < 3) || card.incorrect > card.correct);
      return { word, card, due, weak, weakEligible: weak && due, fresh: card.attempts === 0 };
    });
    let selected;
    if (mode === "all") selected = enriched;
    else if (mode === "due") selected = enriched.filter(item => item.due);
    else if (mode === "weak") selected = enriched.filter(item => item.weakEligible);
    else if (mode === "new") selected = enriched.filter(item => item.fresh);
    else {
      selected = enriched.filter(item => item.due || item.weakEligible);
      const fresh = enriched.filter(item => item.fresh);
      if (!selected.length) selected = fresh;
      else if (selected.length < clamp(limit, 1, 100)) selected = selected.concat(
        shuffle(fresh, random).slice(0, Math.max(0, Math.round(clamp(limit, 1, 100)) - selected.length))
      );
      if (!selected.length) selected = enriched.filter(item => item.card.attempts > 0)
        .sort((a, b) => a.card.dueAt - b.card.dueAt || b.card.priority - a.card.priority);
    }
    const cap = Math.round(clamp(limit, 1, 100));
    const ordered = shuffle(selected, random).sort((a, b) => {
      const overdueA = a.due ? Math.max(0, now - (a.card.dueAt || 0)) / 3600000 : 0;
      const overdueB = b.due ? Math.max(0, now - (b.card.dueAt || 0)) / 3600000 : 0;
      const scoreA = a.card.priority * 3 + a.card.failures * 2 + overdueA;
      const scoreB = b.card.priority * 3 + b.card.failures * 2 + overdueB;
      return scoreB - scoreA;
    });
    return ordered.slice(0, cap).map(item => item.word);
  }
  function startSession(rawState, words, direction, random = Math.random, options = {}) {
    if (!DIRECTIONS.includes(direction)) throw new TypeError("Unsupported recall direction");
    const state = normalizeState(rawState);
    const mode = ["smart", "due", "weak", "new", "all"].includes(options.mode) ? options.mode : "all";
    const pool = mode === "all" ? uniqueWords(words) : selectWords(state, words, direction, mode, Number(options.now) || Date.now(), options.limit ?? 30, random);
    if (!pool.length) throw new Error(mode === "due" ? "لا توجد كلمات مستحقة للمراجعة الآن." : mode === "weak" ? "لا توجد كلمات ضعيفة مسجّلة بعد." : mode === "new" ? "لا توجد كلمات جديدة في المكتبة." : "لا توجد كلمات متاحة لهذا التدريب.");
    const id = "adaptive-" + Date.now().toString(36) + "-" + Math.floor(random() * 0x7fffffff).toString(36);
    const session = {
      id, direction, mode, wordIds: pool.map(word => word.id),
      queue: pool.map(word => word.id), cursor: 0, cycle: 1,
      retryCounts: {}, answered: false, paused: false, questionId: "",
      attempts: 0, correct: 0, incorrect: 0, startedAt: Date.now(), results: [], wrongWordIds: [], lastResult: null
    };
    state.session = session;
    session.queue = prioritizeCycle(state, session.wordIds, random);
    session.questionId = makeQuestionId(session);
    return state;
  }
  function currentQuestion(rawState, words) {
    const state = normalizeState(rawState), session = state.session;
    if (!session || session.completed || session.cursor >= session.queue.length) return null;
    const wordId = session.queue[session.cursor], word = uniqueWords(words).find(item => item.id === wordId);
    if (!word) return null;
    return { word, wordId, direction: session.direction, questionId: session.questionId || makeQuestionId(session),
      position: session.cursor + 1, cycle: session.cycle, totalInCycle: session.queue.length,
      answered: session.answered, paused: session.paused };
  }
  function submitAnswer(rawState, words, answer, options = {}) {
    const state = normalizeState(rawState), session = state.session;
    if (!session || session.completed || session.paused || session.answered || !options.questionId || options.questionId !== session.questionId)
      return { state, accepted: false, reason: "duplicate-or-stale" };
    const pool = uniqueWords(words), word = pool.find(item => item.id === session.queue[session.cursor]);
    if (!word) return { state, accepted: false, reason: "word-unavailable" };
    const now = Number(options.now) || Date.now(), random = typeof options.random === "function" ? options.random : Math.random;
    const correct = gradeAnswer(word, session.direction, answer), card = cardFor(state, word.id, session.direction);
    card.attempts += 1; card.lastSeenAt = now; card.lastResult = correct ? "correct" : "incorrect";
    if (correct) {
      card.correct += 1; card.consecutiveCorrect += 1;
      card.ease = Math.min(3, Number((card.ease + 0.02).toFixed(2)));
      // A correct recall is provisionally saved, then re-tested after ten minutes.
      // Keep the long-term interval dormant until a later scheduling policy is introduced.
      card.intervalDays = 0;
      card.dueAt = now + 10 * 60 * 1000;
      card.priority = Math.max(0, card.priority - (card.consecutiveCorrect >= 3 ? 2 : 1));
      card.cooldownCycles = card.consecutiveCorrect >= 5 ? 2 : card.consecutiveCorrect >= 3 ? 1 : 0;
    } else {
      card.incorrect += 1; card.failures += 1; card.consecutiveCorrect = 0; card.cooldownCycles = 0;
      card.intervalDays = 0;
      // Wrong answers stay immediately eligible for in-session retries (2–4 questions later).
      card.dueAt = now;
      card.ease = Math.max(1.3, Number((card.ease - 0.2).toFixed(2)));
      card.priority = Math.min(100, card.priority + 2 + Math.min(card.failures, 3));
    }
    session.attempts += 1;
    if (correct) session.correct += 1; else session.incorrect += 1;
    session.answered = true; session.lastResult = { wordId: word.id, correct, at: now };
    session.results.push({ questionId: session.questionId, wordId: word.id, correct, at: now, direction: session.direction });
    if (!correct && !session.wrongWordIds.includes(word.id) && session.wrongWordIds.length < 200) session.wrongWordIds.push(word.id);
    if (session.results.length > 10000) session.results.splice(0, session.results.length - 10000);
    let retryAfter = null;
    if (!correct) {
      const retries = Math.max(0, Number(session.retryCounts[word.id]) || 0);
      if (retries < state.policy.maxRetries) {
        const delay = randomIndex(random, state.policy.minDelay, state.policy.maxDelay);
        const availableIntervening = session.queue.length - session.cursor - 1;
        if (availableIntervening >= delay) {
          const insertAt = session.cursor + delay + 1;
          session.queue.splice(insertAt, 0, word.id);
          session.retryCounts[word.id] = retries + 1;
          retryAfter = delay;
        }
      }
    }
    return { state, accepted: true, correct, word, retryAfter };
  }
  function prioritizeCycle(state, ids, random) {
    const eligible = [];
    for (const id of ids) {
      const card = cardFor(state, id, state.session.direction);
      if (card.cooldownCycles > 0) card.cooldownCycles -= 1;
      else eligible.push(id);
    }
    const pool = eligible.length ? eligible : ids;
    return shuffle(pool, random).sort((a, b) => {
      const ca = cardFor(state, a, state.session.direction), cb = cardFor(state, b, state.session.direction);
      const scoreA = ca.priority + Math.min(ca.failures, 10) * 0.15 - Math.min(ca.consecutiveCorrect, 5) * 0.2;
      const scoreB = cb.priority + Math.min(cb.failures, 10) * 0.15 - Math.min(cb.consecutiveCorrect, 5) * 0.2;
      return scoreB - scoreA;
    });
  }
  function advance(rawState, words, random = Math.random) {
    const state = normalizeState(rawState), session = state.session;
    if (!session || !session.answered || session.paused) return { state, advanced: false };
    session.cursor += 1;
    let newCycle = false;
    if (session.cursor >= session.queue.length && session.mode !== "all") {
      session.completed = true;
      session.answered = false;
      return { state, advanced: false, completed: true };
    }
    if (session.cursor >= session.queue.length) {
      const available = new Set(uniqueWords(words).map(word => word.id));
      const ids = (Array.isArray(session.wordIds) ? session.wordIds : uniqueWords(words).map(word => word.id))
        .filter(id => available.has(id));
      if (!ids.length) return { state, advanced: false };
      session.cycle += 1; session.queue = prioritizeCycle(state, ids, random);
      session.cursor = 0; session.retryCounts = {}; newCycle = true;
    }
    session.answered = false; session.lastResult = null; session.questionId = makeQuestionId(session);
    return { state, advanced: true, newCycle };
  }
  function setPaused(rawState, paused) {
    const state = normalizeState(rawState);
    if (state.session) state.session.paused = Boolean(paused);
    return state;
  }
  function endSession(rawState) {
    const state = normalizeState(rawState); state.session = null; return state;
  }
  function getCard(rawState, wordId, direction) {
    const state = normalizeState(rawState), record = state.progress[wordId];
    return normalizeCard(record?.[direction === "he-ar" ? "heToAr" : "arToHe"]);
  }
  return { VERSION, DIRECTIONS, DEFAULT_POLICY, normalizeText, aliases, uniqueWords, gradeAnswer,
    createState, normalizeState, startSession, currentQuestion, submitAnswer, advance,
    setPaused, endSession, getCard, masteryOf, getStats, selectWords };
});
