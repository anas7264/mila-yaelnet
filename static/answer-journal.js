(function attachAnswerJournal(root) {
  "use strict";
  const KEY = "mila-yaelnet-answer-journal-v1";
  const MAX_EVENT_BYTES = 12000;
  const MAX_PENDING_EVENTS = 50000;
  const ratings = new Set(["again", "hard", "good", "easy"]);

  function safeRead(storage) {
    try {
      const parsed = JSON.parse(storage.getItem(KEY) || "[]");
      return Array.isArray(parsed) ? parsed.filter(item => item && typeof item === "object" && typeof item.eventId === "string") : [];
    } catch { return []; }
  }

  function normalizeEvent(input) {
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new TypeError("Invalid answer event");
    const eventId = String(input.eventId || "").trim();
    const sessionId = String(input.sessionId || "").trim();
    const wordId = String(input.wordId || "").trim();
    if (!eventId || eventId.length > 180 || !sessionId || sessionId.length > 120 || !wordId || wordId.length > 120) {
      throw new TypeError("Answer event is missing a valid identifier");
    }
    const rating = ratings.has(input.selfRating) ? input.selfRating : null;
    const event = {
      eventId, sessionId, wordId,
      ownerId: typeof input.ownerId === "string" && input.ownerId.length <= 80 ? input.ownerId : null,
      occurredAt: Math.max(0, Number(input.occurredAt) || Date.now()),
      mode: String(input.mode || "unknown").slice(0, 40),
      direction: ["he-ar", "ar-he"].includes(input.direction) ? input.direction : null,
      eventType: String(input.eventType || "answer").slice(0, 40),
      prompt: String(input.prompt || "").slice(0, 500),
      choices: Array.isArray(input.choices) ? input.choices.slice(0, 10).map(choice => ({
        wordId: String(choice?.wordId || "").slice(0, 120),
        text: String(choice?.text || "").slice(0, 300)
      })) : [],
      correctAnswer: String(input.correctAnswer || "").slice(0, 500),
      selectedAnswer: String(input.selectedAnswer || "").slice(0, 500),
      typedAnswer: String(input.typedAnswer || "").slice(0, 500),
      isCorrect: typeof input.isCorrect === "boolean" ? input.isCorrect : null,
      timedOut: Boolean(input.timedOut),
      selfRating: rating
    };
    if (rating) event.isCorrect = null;
    if (JSON.stringify(event).length > MAX_EVENT_BYTES) throw new RangeError("Answer event exceeds the safe size limit");
    return event;
  }

  function append(input, storage) {
    const target = storage || root.localStorage;
    if (!target) throw new Error("Local storage is unavailable");
    const event = normalizeEvent(input);
    const events = safeRead(target);
    if (events.some(item => item.eventId === event.eventId)) return { inserted: false, event };
    if (events.length >= MAX_PENDING_EVENTS) throw new RangeError("Answer journal capacity reached; sync is required before continuing");
    events.push({ ...event, syncedAt: null });
    target.setItem(KEY, JSON.stringify(events));
    return { inserted: true, event };
  }

  function pending(storage, sessionId = null) {
    const events = safeRead(storage || root.localStorage).filter(item => !item.syncedAt);
    return sessionId ? events.filter(item => item.sessionId === sessionId) : events;
  }

  function completeSession(sessionId, storage, completedAt = Date.now()) {
    const target = storage || root.localStorage;
    const id = String(sessionId || "").trim();
    if (!target || !id) return 0;
    const events = safeRead(target);
    let count = 0;
    const next = events.map(item => {
      if (item.sessionId === id && !item.completedAt) { count++; return { ...item, completedAt }; }
      return item;
    });
    if (count) target.setItem(KEY, JSON.stringify(next));
    return count;
  }

  function acknowledge(eventIds, storage) {
    const target = storage || root.localStorage;
    const ids = new Set((Array.isArray(eventIds) ? eventIds : []).map(String));
    if (!ids.size) return 0;
    const events = safeRead(target);
    const next = events.filter(item => !ids.has(item.eventId));
    const count = events.length - next.length;
    if (count) target.setItem(KEY, JSON.stringify(next));
    return count;
  }

  function remove(eventId, storage) {
    const target = storage || root.localStorage;
    const events = safeRead(target);
    const next = events.filter(item => item.eventId !== String(eventId));
    if (next.length !== events.length) target.setItem(KEY, JSON.stringify(next));
    return next.length !== events.length;
  }

  const api = Object.freeze({ key: KEY, append, pending, completeSession, acknowledge, remove, normalizeEvent });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.MilaAnswerJournal = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
