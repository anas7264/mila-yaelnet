(function attachAnswerJournal(root) {
  "use strict";
  const KEY_PREFIX = "mila-yaelnet-answer-event:";
  const MAX_EVENT_BYTES = 12000;
  const MAX_PENDING_EVENTS = 50000;
  const ratings = new Set(["again", "hard", "good", "easy"]);
  const eventKey = id => KEY_PREFIX + encodeURIComponent(String(id));

  function listEvents(storage) {
    const events = [];
    for (let index = 0; index < storage.length; index++) {
      const key = storage.key(index);
      if (!key || !key.startsWith(KEY_PREFIX)) continue;
      try {
        const item = JSON.parse(storage.getItem(key) || "null");
        if (item && typeof item === "object" && typeof item.eventId === "string") events.push({ key, item });
      } catch { /* Ignore a corrupt individual entry without hiding other events. */ }
    }
    return events;
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
    const key = eventKey(event.eventId);
    if (target.getItem(key)) return { inserted: false, event };
    if (target.length >= MAX_PENDING_EVENTS + 100 && listEvents(target).length >= MAX_PENDING_EVENTS) {
      throw new RangeError("Answer journal capacity reached; sync is required before continuing");
    }
    target.setItem(key, JSON.stringify(event));
    return { inserted: true, event };
  }

  function pending(storage, sessionId = null) {
    const target = storage || root.localStorage;
    return listEvents(target).map(entry => entry.item)
      .filter(item => !item.syncedAt && (!sessionId || item.sessionId === sessionId));
  }

  function completeSession(sessionId, storage, completedAt = Date.now()) {
    const target = storage || root.localStorage;
    const id = String(sessionId || "").trim();
    if (!target || !id) return 0;
    let count = 0;
    for (const { key, item } of listEvents(target)) {
      if (item.sessionId !== id || item.completedAt) continue;
      target.setItem(key, JSON.stringify({ ...item, completedAt }));
      count++;
    }
    return count;
  }

  function claimUnownedEvents(ownerId, storage) {
    const target = storage || root.localStorage;
    const owner = String(ownerId || "").trim();
    if (!target || !owner || owner.length > 80) return 0;
    let count = 0;
    for (const { key, item } of listEvents(target)) {
      if (item.ownerId || item.syncedAt) continue;
      target.setItem(key, JSON.stringify({ ...item, ownerId: owner }));
      count++;
    }
    return count;
  }

  function acknowledge(eventIds, storage) {
    const target = storage || root.localStorage;
    const ids = new Set((Array.isArray(eventIds) ? eventIds : []).map(String));
    if (!ids.size) return 0;
    let count = 0;
    for (const id of ids) {
      const key = eventKey(id);
      if (target.getItem(key) !== null) { target.removeItem(key); count++; }
    }
    return count;
  }

  function remove(eventId, storage) {
    const target = storage || root.localStorage;
    const key = eventKey(eventId);
    if (target.getItem(key) === null) return false;
    target.removeItem(key);
    return true;
  }

  const api = Object.freeze({ key: KEY_PREFIX, append, pending, completeSession, claimUnownedEvents, acknowledge, remove, normalizeEvent });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.MilaAnswerJournal = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
