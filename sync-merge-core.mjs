import { createSnapshot, isSnapshot } from "./sync-core.mjs?v=5";

const MAIN_KEY = "mila-yaelnet-studio-v3";
const ADAPTIVE_KEY = "mila-yaelnet-adaptive-v1";
const EVENT_LIMIT = 2048;
const MISSING = Symbol("missing");
const DERIVED_PROGRESS_FIELDS = new Set([
  "attempts", "correct", "incorrect", "mistakes", "consecutiveCorrect",
  "dueAt", "intervalDays", "repetitions", "ease", "lapses",
  "lastReviewedAt", "lastAnswerAt", "mastered"
]);

const isObject = value => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const clone = value => value === MISSING ? MISSING : JSON.parse(JSON.stringify(value));
const equal = (a, b) => {
  if (a === MISSING || b === MISSING) return a === b;
  return JSON.stringify(a) === JSON.stringify(b);
};
const valueAt = (object, key) => Object.prototype.hasOwnProperty.call(object || {}, key) ? object[key] : MISSING;
const safeNumber = value => Number.isFinite(Number(value)) ? Number(value) : 0;

function addConflict(conflicts, path) {
  if (!conflicts.includes(path)) conflicts.push(path);
}

function mergeSetArray(base, local, remote, path, conflicts) {
  const b = new Set(base === MISSING ? [] : base);
  const l = new Set(local === MISSING ? [] : local);
  const r = new Set(remote === MISSING ? [] : remote);
  const all = new Set([...b, ...l, ...r]);
  const out = [];
  for (const value of all) {
    const bp = b.has(value), lp = l.has(value), rp = r.has(value);
    let include;
    if (lp === rp) include = lp;
    else if (lp === bp) include = rp;
    else if (rp === bp) include = lp;
    else {
      addConflict(conflicts, path);
      include = lp || rp;
    }
    if (include) out.push(value);
  }
  return out;
}

function mergeArrayById(base, local, remote, path, conflicts) {
  const toMap = values => new Map((values === MISSING ? [] : values).map(item => [String(item.id), item]));
  const b = toMap(base), l = toMap(local), r = toMap(remote);
  const ids = new Set([...b.keys(), ...l.keys(), ...r.keys()]);
  const out = [];
  for (const id of ids) {
    const merged = mergeValue(
      b.has(id) ? b.get(id) : MISSING,
      l.has(id) ? l.get(id) : MISSING,
      r.has(id) ? r.get(id) : MISSING,
      path + "[" + id + "]",
      conflicts
    );
    if (merged !== MISSING) out.push(merged);
  }
  return out;
}

function mergeValue(base, local, remote, path, conflicts) {
  if (equal(local, remote)) return clone(local);
  if (equal(local, base)) return clone(remote);
  if (equal(remote, base)) return clone(local);

  const bObject = base === MISSING ? {} : base;
  const lObject = local === MISSING ? {} : local;
  const rObject = remote === MISSING ? {} : remote;
  if (isObject(bObject) && isObject(lObject) && isObject(rObject)) {
    const out = {};
    const keys = new Set([...Object.keys(bObject), ...Object.keys(lObject), ...Object.keys(rObject)]);
    for (const key of keys) {
      const merged = mergeValue(valueAt(bObject, key), valueAt(lObject, key), valueAt(rObject, key), path + "." + key, conflicts);
      if (merged !== MISSING) out[key] = merged;
    }
    return out;
  }

  if (Array.isArray(base === MISSING ? [] : base) &&
      Array.isArray(local === MISSING ? [] : local) &&
      Array.isArray(remote === MISSING ? [] : remote)) {
    const b = base === MISSING ? [] : base;
    const l = local === MISSING ? [] : local;
    const r = remote === MISSING ? [] : remote;
    if ([...b, ...l, ...r].every(item => item === null || ["string", "number", "boolean"].includes(typeof item))) {
      return mergeSetArray(b, l, r, path, conflicts);
    }
    if ([...b, ...l, ...r].every(item => isObject(item) && item.id !== undefined)) {
      return mergeArrayById(b, l, r, path, conflicts);
    }
  }

  addConflict(conflicts, path);
  return clone(local);
}

function mergeEventMaps(baseEvents, localEvents, remoteEvents, conflicts) {
  const b = isObject(baseEvents) ? baseEvents : {};
  const l = isObject(localEvents) ? localEvents : {};
  const r = isObject(remoteEvents) ? remoteEvents : {};
  const out = {};
  const ids = new Set([...Object.keys(b), ...Object.keys(l), ...Object.keys(r)]);
  for (const id of ids) {
    const value = mergeValue(valueAt(b, id), valueAt(l, id), valueAt(r, id), "learningEvents." + id, conflicts);
    if (value !== MISSING) out[id] = value;
  }
  return Object.fromEntries(Object.entries(out)
    .sort((a, b) => safeNumber(a[1]?.at) - safeNumber(b[1]?.at) || a[0].localeCompare(b[0]))
    .slice(-EVENT_LIMIT));
}

function mergeIdMap(baseMap, localMap, remoteMap) {
  const b = isObject(baseMap) ? baseMap : {};
  const l = isObject(localMap) ? localMap : {};
  const r = isObject(remoteMap) ? remoteMap : {};
  const out = {};
  for (const id of new Set([...Object.keys(b), ...Object.keys(l), ...Object.keys(r)])) {
    const times = [b[id], l[id], r[id]].map(safeNumber);
    const at = Math.max(...times);
    if (at > 0) out[id] = at;
  }
  return Object.fromEntries(Object.entries(out).sort((a, b) => a[1] - b[1]).slice(-EVENT_LIMIT));
}

function eventsAddedSince(baseEvents, sideEvents) {
  const base = isObject(baseEvents) ? baseEvents : {};
  const side = isObject(sideEvents) ? sideEvents : {};
  return Object.entries(side)
    .filter(([id]) => !Object.prototype.hasOwnProperty.call(base, id))
    .map(([, event]) => event)
    .filter(event => isObject(event) && typeof event.wordId === "string" && typeof event.correct === "boolean");
}

function replayMainProgress(baseProgress, events, scheduleReview) {
  let progress = { ...(isObject(baseProgress) ? baseProgress : {}) };
  for (const event of events) {
    const at = safeNumber(event.at);
    if (!at) return null;
    const previous = progress;
    const next = {
      ...previous,
      attempts: safeNumber(previous.attempts) + 1,
      correct: safeNumber(previous.correct) + (event.correct ? 1 : 0),
      incorrect: safeNumber(previous.incorrect) + (event.correct ? 0 : 1),
      mistakes: safeNumber(previous.mistakes) + (event.correct ? 0 : 1),
      consecutiveCorrect: event.correct ? safeNumber(previous.consecutiveCorrect) + 1 : 0,
      lastAnswerAt: at
    };
    const schedule = scheduleReview(previous, event.correct ? "good" : "again", at);
    if (!isObject(schedule)) return null;
    Object.assign(next, schedule);
    if (event.correct && next.repetitions >= 3 && next.intervalDays >= 6) next.mastered = true;
    progress = next;
  }
  return progress;
}

function replayAdaptiveCard(baseCard, events) {
  const card = {
    attempts: safeNumber(baseCard?.attempts),
    correct: safeNumber(baseCard?.correct),
    incorrect: safeNumber(baseCard?.incorrect),
    consecutiveCorrect: safeNumber(baseCard?.consecutiveCorrect),
    failures: safeNumber(baseCard?.failures),
    priority: Math.max(0, Math.min(100, safeNumber(baseCard?.priority))),
    cooldownCycles: safeNumber(baseCard?.cooldownCycles),
    lastSeenAt: safeNumber(baseCard?.lastSeenAt),
    lastResult: baseCard?.lastResult === "correct" || baseCard?.lastResult === "incorrect" ? baseCard.lastResult : null
  };
  for (const event of events) {
    const at = safeNumber(event.at);
    if (!at) return null;
    card.attempts += 1;
    card.lastSeenAt = at;
    card.lastResult = event.correct ? "correct" : "incorrect";
    if (event.correct) {
      card.correct += 1;
      card.consecutiveCorrect += 1;
      card.priority = Math.max(0, card.priority - (card.consecutiveCorrect >= 3 ? 2 : 1));
      card.cooldownCycles = card.consecutiveCorrect >= 5 ? 2 : card.consecutiveCorrect >= 3 ? 1 : 0;
    } else {
      card.incorrect += 1;
      card.failures += 1;
      card.consecutiveCorrect = 0;
      card.cooldownCycles = 0;
      card.priority = Math.min(100, card.priority + 2 + Math.min(card.failures, 3));
    }
  }
  return card;
}

function mergeProgress(baseProgress, localProgress, remoteProgress, baseEvents, localEvents, remoteEvents, conflicts, scheduleReview, mode) {
  const b = isObject(baseProgress) ? baseProgress : {};
  const l = isObject(localProgress) ? localProgress : {};
  const r = isObject(remoteProgress) ? remoteProgress : {};
  const localAdded = eventsAddedSince(baseEvents, localEvents);
  const remoteAdded = eventsAddedSince(baseEvents, remoteEvents);
  const allAdded = new Map();
  for (const event of [...localAdded, ...remoteAdded]) {
    const id = String(event.eventId || "");
    if (!id) continue;
    if (allAdded.has(id) && !equal(allAdded.get(id), event)) {
      addConflict(conflicts, "learningEvents." + id);
      continue;
    }
    allAdded.set(id, event);
  }

  const words = new Set([...Object.keys(b), ...Object.keys(l), ...Object.keys(r)]);
  const result = {};
  for (const wordId of words) {
    const baseRecord = isObject(b[wordId]) ? b[wordId] : {};
    const localRecord = valueAt(l, wordId);
    const remoteRecord = valueAt(r, wordId);
    const added = [...allAdded.values()].filter(event => event.wordId === wordId &&
      (mode === "main" || event.direction === mode));
    if (!added.length) {
      const merged = mergeValue(valueAt(b, wordId), localRecord, remoteRecord, "progress." + wordId, conflicts);
      if (merged !== MISSING) result[wordId] = merged;
      continue;
    }

    if (mode === "main") {
      if (typeof scheduleReview !== "function") {
        addConflict(conflicts, "progress." + wordId + ".schedule");
        continue;
      }
      const localCount = localAdded.filter(event => event.wordId === wordId).length;
      const remoteCount = remoteAdded.filter(event => event.wordId === wordId).length;
      const expectedLocal = safeNumber(baseRecord.attempts) + localCount;
      const expectedRemote = safeNumber(baseRecord.attempts) + remoteCount;
      if (safeNumber(localRecord === MISSING ? 0 : localRecord?.attempts) !== expectedLocal ||
          safeNumber(remoteRecord === MISSING ? 0 : remoteRecord?.attempts) !== expectedRemote) {
        addConflict(conflicts, "progress." + wordId + ".missing-event-payload");
        continue;
      }
      added.sort((a, b) => safeNumber(a.at) - safeNumber(b.at) || String(a.eventId).localeCompare(String(b.eventId)));
      const replayed = replayMainProgress(baseRecord, added, scheduleReview);
      if (!replayed) {
        addConflict(conflicts, "progress." + wordId + ".replay");
        continue;
      }
      const extras = {};
      const keys = new Set([
        ...Object.keys(baseRecord),
        ...(localRecord === MISSING ? [] : Object.keys(localRecord || {})),
        ...(remoteRecord === MISSING ? [] : Object.keys(remoteRecord || {}))
      ]);
      for (const key of keys) {
        if (DERIVED_PROGRESS_FIELDS.has(key)) continue;
        const merged = mergeValue(
          valueAt(baseRecord, key),
          valueAt(localRecord === MISSING ? {} : localRecord, key),
          valueAt(remoteRecord === MISSING ? {} : remoteRecord, key),
          "progress." + wordId + "." + key,
          conflicts
        );
        if (merged !== MISSING) extras[key] = merged;
      }
      result[wordId] = { ...replayed, ...extras };
    } else {
      const cardKey = mode === "he-ar" ? "heToAr" : "arToHe";
      const otherCardKey = mode === "he-ar" ? "arToHe" : "heToAr";
      const baseCard = baseRecord[cardKey] || {};
      const localCard = localRecord === MISSING ? {} : (localRecord?.[cardKey] || {});
      const remoteCard = remoteRecord === MISSING ? {} : (remoteRecord?.[cardKey] || {});
      const localCount = localAdded.filter(event => event.wordId === wordId && event.direction === mode).length;
      const remoteCount = remoteAdded.filter(event => event.wordId === wordId && event.direction === mode).length;
      if (safeNumber(localCard.attempts) !== safeNumber(baseCard.attempts) + localCount ||
          safeNumber(remoteCard.attempts) !== safeNumber(baseCard.attempts) + remoteCount) {
        addConflict(conflicts, "adaptive.progress." + wordId + "." + mode + ".missing-event-payload");
        continue;
      }
      const relevant = added.filter(event => event.direction === mode)
        .sort((a, b) => safeNumber(a.at) - safeNumber(b.at) || String(a.eventId).localeCompare(String(b.eventId)));
      const replayed = replayAdaptiveCard(baseCard, relevant);
      if (!replayed) {
        addConflict(conflicts, "adaptive.progress." + wordId + "." + mode + ".replay");
        continue;
      }
      const other = mergeValue(
        valueAt(baseRecord, otherCardKey),
        valueAt(localRecord === MISSING ? {} : localRecord, otherCardKey),
        valueAt(remoteRecord === MISSING ? {} : remoteRecord, otherCardKey),
        "adaptive.progress." + wordId + "." + otherCardKey,
        conflicts
      );
      result[wordId] = { [cardKey]: replayed };
      if (other !== MISSING) result[wordId][otherCardKey] = other;
    }
  }
  return result;
}

function mergeDaily(baseDaily, localDaily, remoteDaily, newEvents, conflicts) {
  if (!newEvents.length || newEvents.some(event => !/^\d{4}-\d{2}-\d{2}$/.test(String(event.date || "")))) {
    return mergeValue(baseDaily, localDaily, remoteDaily, "daily", conflicts);
  }
  const daily = {
    lastDate: String(baseDaily?.lastDate || ""),
    streak: safeNumber(baseDaily?.streak),
    completed: safeNumber(baseDaily?.completed)
  };
  const groups = new Map();
  for (const event of newEvents) {
    const date = String(event.date);
    groups.set(date, (groups.get(date) || 0) + 1);
  }
  const dateValue = value => {
    const [y,m,d] = value.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  for (const [date, count] of [...groups].sort((a,b)=>a[0].localeCompare(b[0]))) {
    if (!daily.lastDate || date > daily.lastDate) {
      const nextDay = daily.lastDate ? dateValue(date) - dateValue(daily.lastDate) === 86400000 : false;
      daily.streak = nextDay ? daily.streak + 1 : 1;
      daily.lastDate = date;
      daily.completed = count;
    } else if (date === daily.lastDate) {
      daily.completed += count;
    }
  }
  return daily;
}

function defaultMainState() {
  return {
    version: 3, migrations: {}, extras: [], progress: {}, mistakes: [], sessions: [],
    settings: { theme: "light", dailyGoal: 10, defaultCount: 10, defaultMode: "he-ar",
      timerSeconds: 0, feedbackTiming: "instant", focusMode: false, sound: false, largeText: false },
    daily: { lastDate: "", streak: 0, completed: 0 }, legacyTotals: null,
    adaptiveEventIds: {}, learningEvents: {}, lastSessionSummary: null, completedStageIds: []
  };
}
function defaultAdaptiveState() {
  return { version: 1, progress: {}, session: null,
    policy: { minDelay: 2, maxDelay: 6, maxRetries: 3 }, migrations: {} };
}

function mergeMainState(base, local, remote, scheduleReview, conflicts) {
  const b = isObject(base) ? base : defaultMainState();
  const l = isObject(local) ? local : defaultMainState();
  const r = isObject(remote) ? remote : defaultMainState();
  const mergedEvents = mergeEventMaps(b.learningEvents, l.learningEvents, r.learningEvents, conflicts);
  const newEvents = Object.entries(mergedEvents)
    .filter(([id]) => !Object.prototype.hasOwnProperty.call(b.learningEvents || {}, id))
    .map(([, event]) => event);
  const out = {};
  const special = new Set(["progress", "learningEvents", "adaptiveEventIds", "mistakes", "sessions", "lastSessionSummary", "daily", "extras", "completedStageIds"]);
  const keys = new Set([...Object.keys(b), ...Object.keys(l), ...Object.keys(r)]);
  for (const key of keys) {
    if (special.has(key)) continue;
    const merged = mergeValue(valueAt(b, key), valueAt(l, key), valueAt(r, key), "main." + key, conflicts);
    if (merged !== MISSING) out[key] = merged;
  }
  out.learningEvents = mergedEvents;
  out.adaptiveEventIds = mergeIdMap(b.adaptiveEventIds, l.adaptiveEventIds, r.adaptiveEventIds);
  out.progress = mergeProgress(b.progress, l.progress, r.progress, b.learningEvents, l.learningEvents, r.learningEvents, conflicts, scheduleReview, "main");
  out.daily = mergeDaily(b.daily, l.daily, r.daily, newEvents, conflicts);
  for (const key of ["mistakes", "sessions", "extras", "completedStageIds"]) {
    const merged = mergeValue(valueAt(b, key), valueAt(l, key), valueAt(r, key), "main." + key, conflicts);
    if (merged !== MISSING) out[key] = merged;
  }
  out.mistakes = (out.mistakes || []).slice(-500);
  out.sessions = (out.sessions || []).slice(-500);
  out.extras = (out.extras || []).slice(0, 5000);
  out.completedStageIds = (out.completedStageIds || []).slice(0, 100);
  const sessions = out.sessions;
  out.lastSessionSummary = sessions.reduce((winner, item) =>
    !winner || safeNumber(item.finishedAt) > safeNumber(winner.finishedAt) ? item : winner, null);
  return out;
}

function mergeAdaptiveState(base, local, remote, baseEvents, localEvents, remoteEvents, scheduleReview, conflicts) {
  const b = isObject(base) ? base : defaultAdaptiveState();
  const l = isObject(local) ? local : defaultAdaptiveState();
  const r = isObject(remote) ? remote : defaultAdaptiveState();
  const out = {};
  for (const key of new Set([...Object.keys(b), ...Object.keys(l), ...Object.keys(r)])) {
    if (key === "progress") continue;
    const merged = mergeValue(valueAt(b, key), valueAt(l, key), valueAt(r, key), "adaptive." + key, conflicts);
    if (merged !== MISSING) out[key] = merged;
  }
  out.progress = {};
  for (const direction of ["he-ar", "ar-he"]) {
    const progress = mergeProgress(b.progress, l.progress, r.progress, baseEvents, localEvents, remoteEvents, conflicts, scheduleReview, direction);
    for (const [wordId, cardPair] of Object.entries(progress)) {
      if (!out.progress[wordId]) out.progress[wordId] = {};
      const cardKey = direction === "he-ar" ? "heToAr" : "arToHe";
      const other = direction === "he-ar" ? "arToHe" : "heToAr";
      if (cardPair[cardKey]) out.progress[wordId][cardKey] = cardPair[cardKey];
      if (cardPair[other] && !out.progress[wordId][other]) out.progress[wordId][other] = cardPair[other];
    }
  }
  return out;
}

export function mergeSnapshots(baseSnapshot, localSnapshot, remoteSnapshot, options = {}) {
  if (!isSnapshot(localSnapshot) || !isSnapshot(remoteSnapshot) ||
      (baseSnapshot !== null && baseSnapshot !== undefined && !isSnapshot(baseSnapshot))) {
    return { ok: false, snapshot: null, conflicts: ["invalid-snapshot"] };
  }
  const baseEntries = new Map((baseSnapshot?.entries || []).map(([key, value]) => [key, value]));
  const localEntries = new Map(localSnapshot.entries);
  const remoteEntries = new Map(remoteSnapshot.entries);
  const keys = new Set([...baseEntries.keys(), ...localEntries.keys(), ...remoteEntries.keys()]);
  const conflicts = [];
  const mergedEntries = [];
  const readMain = entries => {
    if (!entries.has(MAIN_KEY)) return defaultMainState();
    try { return JSON.parse(entries.get(MAIN_KEY)); } catch { return defaultMainState(); }
  };
  const baseMain = readMain(baseEntries), localMain = readMain(localEntries), remoteMain = readMain(remoteEntries);
  for (const key of keys) {
    const b = baseEntries.has(key) ? baseEntries.get(key) : MISSING;
    const l = localEntries.has(key) ? localEntries.get(key) : MISSING;
    const r = remoteEntries.has(key) ? remoteEntries.get(key) : MISSING;
    if (equal(l, r) || equal(l, b) || equal(r, b)) {
      const merged = mergeValue(b, l, r, key, conflicts);
      if (merged !== MISSING) mergedEntries.push([key, String(merged)]);
      continue;
    }
    if (key === MAIN_KEY || key === ADAPTIVE_KEY) {
      const parse = value => {
        if (value === MISSING) return key === MAIN_KEY ? defaultMainState() : defaultAdaptiveState();
        try { return JSON.parse(value); } catch { return null; }
      };
      const mergedBase = parse(b), mergedLocal = parse(l), mergedRemote = parse(r);
      if (!isObject(mergedBase) || !isObject(mergedLocal) || !isObject(mergedRemote)) {
        addConflict(conflicts, key + ".invalid-json");
        continue;
      }
      const scheduleReview = options.scheduleReview;
      const value = key === MAIN_KEY
        ? mergeMainState(mergedBase, mergedLocal, mergedRemote, scheduleReview, conflicts)
        : mergeAdaptiveState(
            mergedBase, mergedLocal, mergedRemote,
            baseMain.learningEvents || {}, localMain.learningEvents || {}, remoteMain.learningEvents || {},
            options.scheduleReview, conflicts
          );
      mergedEntries.push([key, JSON.stringify(value)]);
    } else {
      const parsed = value => {
        if (value === MISSING) return MISSING;
        try { return JSON.parse(value); } catch { return value; }
      };
      const merged = mergeValue(parsed(b), parsed(l), parsed(r), key, conflicts);
      if (merged !== MISSING) mergedEntries.push([key, typeof merged === "string" ? merged : JSON.stringify(merged)]);
    }
  }
  if (conflicts.length) return { ok: false, snapshot: null, conflicts };
  return { ok: true, snapshot: createSnapshot(mergedEntries), conflicts: [] };
}
