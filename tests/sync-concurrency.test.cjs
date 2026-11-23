"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const sync = fs.readFileSync(path.join(__dirname, "..", "sync.js"), "utf8");

test("older sync responses cannot regress a newer local revision", () => {
  assert.match(sync, /current\.revision>r/);
  assert.match(sync, /writeMeta\(data\.revision,data\.state\|\|v,owner\)/);
});

test("a completed request only clears its own pending mutation", () => {
  assert.match(sync, /storedPending\?\.mutationId===mutationId/);
  assert.match(sync, /if\(pending\?\.mutationId===mutationId\)pending=null/);
});

test("sync reads the shared pending envelope and ignores stale account responses", () => {
  assert.match(sync, /normalizePendingMutation\(parse\(localStorage\.getItem\(PENDING\)\)\|\|pending/);
  assert.match(sync, /activationVersion!==generation\)return\{stale:true,data\}/);
  assert.match(sync, /if\(r\.stale\)return/);
  assert.match(sync, /if\(result\.stale\)return false/);
});

test("failed requests retain their original mutation and schedule a retry", () => {
  assert.match(sync, /if\(!stored\|\|stored\.mutationId===mutation\.mutationId\)/);
  assert.match(sync, /timer=setTimeout\(flush,3000\)/);
});
