"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const STORE = require("../static/storage.js");

const ADAPTIVE_KEY = "mila-yaelnet-adaptive-v1";

function createStorage() {
  const values = new Map();
  let shouldFailAdaptive = false;
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) {
      if (key === ADAPTIVE_KEY && shouldFailAdaptive) {
        shouldFailAdaptive = false;
        throw new Error("quota exceeded");
      }
      values.set(key, String(value));
    },
    removeItem(key) { values.delete(key); },
    dump(key) { return values.get(key) ?? null; },
    failNextAdaptiveWrite() { shouldFailAdaptive = true; }
  };
}

const adaptiveState = {
  version: 1,
  progress: {
    "word-1": {
      heToAr: { attempts: 4, correct: 3, incorrect: 1 },
      arToHe: { attempts: 2, correct: 1, incorrect: 1 }
    }
  },
  policy: { minDelay: 2, maxDelay: 4, maxRetries: 3 },
  migrations: {},
  session: null
};

test("JSON backup includes adaptive progress and restores it with main progress", () => {
  const storage = createStorage();
  const mainState = STORE.createDefaultState();
  const backup = STORE.exportBackup(mainState, adaptiveState);
  const parsed = JSON.parse(backup);
  assert.deepEqual(parsed.adaptive, adaptiveState);

  const validated = STORE.validateBackup(backup);
  assert.equal(validated.ok, true);
  assert.deepEqual(validated.adaptiveState, adaptiveState);

  const imported = STORE.importBackup(backup, storage);
  assert.equal(imported.ok, true);
  assert.deepEqual(JSON.parse(storage.dump(ADAPTIVE_KEY)), adaptiveState);
  assert.ok(storage.dump("mila-yaelnet-studio-v3"));
});

test("legacy backup without adaptive data preserves current adaptive progress", () => {
  const storage = createStorage();
  storage.setItem(ADAPTIVE_KEY, JSON.stringify(adaptiveState));
  const backup = STORE.exportBackup(STORE.createDefaultState());
  const imported = STORE.importBackup(backup, storage);
  assert.equal(imported.ok, true);
  assert.deepEqual(JSON.parse(storage.dump(ADAPTIVE_KEY)), adaptiveState);
});

test("adaptive write failure rolls back the main learning state", () => {
  const storage = createStorage();
  const previousMain = JSON.stringify(STORE.createDefaultState());
  const previousAdaptive = JSON.stringify(adaptiveState);
  storage.setItem("mila-yaelnet-studio-v3", previousMain);
  storage.setItem(ADAPTIVE_KEY, previousAdaptive);
  storage.failNextAdaptiveWrite();

  const nextState = STORE.createDefaultState();
  nextState.settings.theme = "dark";
  const result = STORE.importBackup(STORE.exportBackup(nextState, {
    ...adaptiveState,
    progress: {}
  }), storage);

  assert.equal(result.ok, false);
  assert.equal(storage.dump("mila-yaelnet-studio-v3"), previousMain);
  assert.equal(storage.dump(ADAPTIVE_KEY), previousAdaptive);
});
