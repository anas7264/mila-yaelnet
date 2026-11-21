(function attachMilaAdaptive(root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.MilaAdaptiveEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createMilaAdaptiveEngine() {
  "use strict";
  const VERSION = 1;
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
      lastSeenAt: Number(source.lastSeenAt) || 0,
      lastResult: source.lastResult === "correct" || source.lastResult === "incorrect" ? source.lastResult : null
    };
  }
  function normalizeState(raw) {
    const state = createState();
    if (!raw || raw.version !== VERSION || typeof raw !== "object" || Array.isArray(raw)) return state;
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
        cursor: Math.round(clamp(session.cursor, 0, Math.max(0, queue.length))),
        cycle: Math.max(1, Math.round(clamp(session.cycle, 1, 1000000))),
        retryCounts: session.retryCounts && typeof session.retryCounts === "object" ? { ...session.retryCounts } : {},
        answered: Boolean(session.answered), paused: Boolean(session.paused),
        questionId: typeof session.questionId === "string" ? session.questionId.slice(0, 180) : "",
        attempts: clamp(session.attempts, 0, 10000000),
        correct: clamp(session.correct, 0, 10000000),
        incorrect: clamp(session.incorrect, 0, 10000000),
        startedAt: Math.max(0, Number(session.startedAt) || 0),
        results: Array.isArray(session.results) ? session.results.slice(-10000).filter(item => item && typeof item.questionId === "string" && typeof item.wordId === "string" && typeof item.correct === "boolean").map(item => ({ questionId: item.questionId.slice(0, 180), wordId: item.wordId.slice(0, 120), correct: item.correct, at: Math.max(0, Number(item.at) || 0), direction: DIRECTIONS.includes(item.direction) ? item.direction : session.direction })) : [],
        lastResult: session.lastResult && typeof session.lastResult === "object" ? { ...session.lastResult } : null
      };
      if (state.session.cursor >= state.session.queue.length) state.session.answered = true;
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
  function startSession(rawState, words, direction, random = Math.random) {
    if (!DIRECTIONS.includes(direction)) throw new TypeError("Unsupported recall direction");
    const state = normalizeState(rawState), pool = uniqueWords(words);
    if (!pool.length) throw new Error("No valid vocabulary words");
    const id = "adaptive-" + Date.now().toString(36) + "-" + Math.floor(random() * 0x7fffffff).toString(36);
    const session = {
      id, direction, queue: shuffle(pool.map(word => word.id), random), cursor: 0, cycle: 1,
      retryCounts: {}, answered: false, paused: false, questionId: "",
      attempts: 0, correct: 0, incorrect: 0, startedAt: Date.now(), results: [], lastResult: null
    };
    session.questionId = makeQuestionId(session);
    state.session = session;
    return state;
  }
  function currentQuestion(rawState, words) {
    const state = normalizeState(rawState), session = state.session;
    if (!session || session.cursor >= session.queue.length) return null;
    const wordId = session.queue[session.cursor], word = uniqueWords(words).find(item => item.id === wordId);
    if (!word) return null;
    return { word, wordId, direction: session.direction, questionId: session.questionId || makeQuestionId(session),
      position: session.cursor + 1, cycle: session.cycle, totalInCycle: session.queue.length,
      answered: session.answered, paused: session.paused };
  }
  function submitAnswer(rawState, words, answer, options = {}) {
    const state = normalizeState(rawState), session = state.session;
    if (!session || session.paused || session.answered || !options.questionId || options.questionId !== session.questionId)
      return { state, accepted: false, reason: "duplicate-or-stale" };
    const pool = uniqueWords(words), word = pool.find(item => item.id === session.queue[session.cursor]);
    if (!word) return { state, accepted: false, reason: "word-unavailable" };
    const now = Number(options.now) || Date.now(), random = typeof options.random === "function" ? options.random : Math.random;
    const correct = gradeAnswer(word, session.direction, answer), card = cardFor(state, word.id, session.direction);
    card.attempts += 1; card.lastSeenAt = now; card.lastResult = correct ? "correct" : "incorrect";
    if (correct) {
      card.correct += 1; card.consecutiveCorrect += 1;
      card.priority = Math.max(0, card.priority - (card.consecutiveCorrect >= 3 ? 2 : 1));
      card.cooldownCycles = card.consecutiveCorrect >= 5 ? 2 : card.consecutiveCorrect >= 3 ? 1 : 0;
    } else {
      card.incorrect += 1; card.failures += 1; card.consecutiveCorrect = 0; card.cooldownCycles = 0;
      card.priority = Math.min(100, card.priority + 2 + Math.min(card.failures, 3));
    }
    session.attempts += 1;
    if (correct) session.correct += 1; else session.incorrect += 1;
    session.answered = true; session.lastResult = { wordId: word.id, correct, at: now };
    session.results.push({ questionId: session.questionId, wordId: word.id, correct, at: now, direction: session.direction });
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
    if (session.cursor >= session.queue.length) {
      const ids = uniqueWords(words).map(word => word.id);
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
    setPaused, endSession, getCard };
});
