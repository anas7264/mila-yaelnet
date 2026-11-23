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
  assert.match(sync, /snapshot:currentSnapshot,meta:currentMeta,pending:parse\(localStorage\.getItem\(PENDING\)\)/);
  assert.match(sync, /writeMeta\(0,empty,userId\)/);
  assert.match(sync, /if\(isDifferentAccount\(meta\(\)\.userId,userId\)\)throw Error/);
  assert.match(sync, /userId,deviceId:device/);
});

test("account switching never uploads the previous account snapshot to the new account", () => {
  const sync = fs.readFileSync(path.join(__dirname, "..", "sync.js"), "utf8");
  const isolateAt = sync.indexOf("const isolateLocalAccount=userId=>");
  const backupAt = sync.indexOf("localStorage.setItem(backupKey,JSON.stringify(backup))", isolateAt);
  const emptyApplyAt = sync.indexOf("apply(empty)", isolateAt);
  const activateAt = sync.indexOf("const activate=async s=>");
  const isolateCallAt = sync.indexOf("isolateLocalAccount(s.user.id)", activateAt);
  const offlineAt = sync.indexOf("if(navigator.onLine===false)", activateAt);
  const loginAt = sync.indexOf("const loginSync=async()=>");
  const guardAt = sync.indexOf("isDifferentAccount(meta().userId,userId)", loginAt);
  const cloudReadAt = sync.indexOf("sb.from('learning_state')", loginAt);
  assert.ok(isolateAt >= 0 && backupAt > isolateAt && emptyApplyAt > backupAt);
  assert.ok(isolateCallAt > activateAt && offlineAt > isolateCallAt);
  assert.ok(guardAt > loginAt && cloudReadAt > guardAt);
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

test("sync flush refuses to send queued mutations for a different account", () => {
  const sync = fs.readFileSync(path.join(__dirname, "..", "sync.js"), "utf8");
  assert.match(sync, /if\(isDifferentAccount\(meta\(\)\.userId,session\.user\.id\)\)/);
  assert.match(sync, /أوقفنا كل عمليات المزامنة/);
});
