"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const core = require("../sync-core.mjs");

test("answer journal is excluded from local-first snapshot synchronization", () => {
  const key = "mila-yaelnet-answer-journal-v1";
  assert.equal(core.isLearningStorageKey(key), false);
  assert.equal(core.isInternalStorageKey(key), true);
  const snapshot = core.createSnapshot([[key, '[{"eventId":"not-yet-synced"}]'], ["mila-yaelnet-v3", "{}"]]);
  assert.deepEqual(snapshot.entries.map(entry => entry[0]), ["mila-yaelnet-v3"]);
});
