"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("account identity guard only treats known, different user IDs as a switch", async () => {
  const { isDifferentAccount } = await import("../sync-core.mjs");
  assert.equal(isDifferentAccount(null, "user-a"), false);
  assert.equal(isDifferentAccount(undefined, "user-a"), false);
  assert.equal(isDifferentAccount("user-a", "user-a"), false);
  assert.equal(isDifferentAccount("user-a", "user-b"), true);
});

test("sync stores account-scoped local recovery before changing accounts", () => {
  const sync = fs.readFileSync(path.join(__dirname, "..", "sync.js"), "utf8");
  assert.match(sync, /ACCOUNT_BACKUP_PREFIX=P\+'account_backup_v1_'/);
  assert.match(sync, /if\(isDifferentAccount\(m\.userId,userId\)\)/);
  assert.match(sync, /snapshot:l,meta:m,pending:parse\(localStorage\.getItem\(PENDING\)\)/);
  assert.match(sync, /writeMeta\(Number\.isInteger\(data\?\.revision\)\?data\.revision:0,remoteSnapshot,userId\)/);
  assert.match(sync, /userId,deviceId:device/);
});

test("account switching never uploads the previous account snapshot to the new account", () => {
  const sync = fs.readFileSync(path.join(__dirname, "..", "sync.js"), "utf8");
  const switchAt = sync.indexOf("if(isDifferentAccount(m.userId,userId)){");
  const uploadAt = sync.indexOf("const initial=normalizePendingMutation", switchAt);
  const cloudApplyAt = sync.indexOf("apply(remoteSnapshot)", switchAt);
  assert.ok(switchAt >= 0);
  assert.ok(cloudApplyAt > switchAt);
  assert.ok(uploadAt > cloudApplyAt);
});

test("account isolation runs before the offline early return", () => {
  const sync = fs.readFileSync(path.join(__dirname, "..", "sync.js"), "utf8");
  const activateAt = sync.indexOf("const activate=async s=>");
  const isolateAt = sync.indexOf("isolateLocalAccount(s.user.id)", activateAt);
  const offlineAt = sync.indexOf("if(navigator.onLine===false)", activateAt);
  assert.ok(activateAt >= 0);
  assert.ok(isolateAt > activateAt);
  assert.ok(offlineAt > isolateAt);
});
