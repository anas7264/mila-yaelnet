"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

test("beginSession defines a JSON-safe config before storing it", () => {
  const app = read("static/app.js");
  const start = app.indexOf("function beginSession(");
  const end = app.indexOf("function startStudioSession(", start);
  assert.notEqual(start, -1, "beginSession must exist");
  assert.ok(end > start, "startStudioSession must follow beginSession");

  const body = app.slice(start, end);
  const configStart = body.indexOf("const persistableConfig = {");
  const sessionStart = body.indexOf("ui.session = {");
  assert.ok(configStart >= 0 && configStart < sessionStart);

  const config = body.slice(configStart, sessionStart);
  for (const key of [
    "mode", "source", "stageId", "stageIds", "scopeStageOnly",
    "excludeMastered", "search", "category", "count", "optionCount",
    "difficulty", "timerSeconds", "feedback", "shuffle", "noRepeat",
    "distractorScope"
  ]) {
    assert.match(config, new RegExp("\\b" + key + "\\s*:"));
  }
  assert.doesNotMatch(config, /distractorPool|currentWord|function/);
  assert.match(body.slice(sessionStart), /config:\\s*\\{\\s*\\.\\.\\.persistableConfig,\\s*mode,\\s*targetCount:/);
});

test("network lifecycle pauses Supabase auth refresh offline and while hidden", async () => {
  const { createNetworkLifecycle } = await import("../sync-core.mjs");
  const createTarget = () => {
    const listeners = new Map();
    return {
      addEventListener(type, callback) {
        const list = listeners.get(type) || [];
        list.push(callback);
        listeners.set(type, list);
      },
      removeEventListener(type, callback) {
        listeners.set(type, (listeners.get(type) || []).filter((item) => item !== callback));
      },
      emit(type) {
        for (const callback of listeners.get(type) || []) callback();
      }
    };
  };

  const win = createTarget();
  const doc = createTarget();
  let online = false;
  let visibility = "visible";
  Object.defineProperty(doc, "visibilityState", { get: () => visibility });
  const nav = { get onLine() { return online; } };
  const calls = [];
  const lifecycle = createNetworkLifecycle({
    auth: {
      startAutoRefresh: () => calls.push("start"),
      stopAutoRefresh: () => calls.push("stop")
    },
    windowRef: win,
    documentRef: doc,
    navigatorRef: nav,
    onOnline: () => calls.push("resume"),
    onOffline: () => calls.push("pause")
  });

  assert.deepEqual(calls, ["stop", "pause"]);
  online = true;
  win.emit("online");
  assert.deepEqual(calls, ["stop", "pause", "start", "resume"]);

  visibility = "hidden";
  doc.emit("visibilitychange");
  assert.deepEqual(calls, ["stop", "pause", "start", "resume", "stop"]);

  visibility = "visible";
  doc.emit("visibilitychange");
  assert.deepEqual(calls, ["stop", "pause", "start", "resume", "stop", "start", "resume"]);

  online = false;
  win.emit("offline");
  assert.deepEqual(calls, ["stop", "pause", "start", "resume", "stop", "start", "resume", "stop", "pause"]);

  lifecycle.dispose();
  const disposedCalls = calls.length;
  online = true;
  win.emit("online");
  doc.emit("visibilitychange");
  assert.equal(calls.length, disposedCalls + 1); // dispose performs one final stop
  assert.equal(calls.at(-1), "stop");
});

test("sync tears down realtime offline and restores it after connectivity returns", () => {
  const sync = read("sync.js");
  assert.match(sync, /const pauseRealtime=/);
  assert.match(sync, /sb\\.removeChannel\\(active\\)/);
  assert.match(sync, /navigator\\.onLine===false/);
  assert.match(sync, /createNetworkLifecycle\\(\\{/);
  assert.match(sync, /onOffline:[\\s\\S]*?pauseRealtime/);
  assert.match(sync, /onOnline:[\\s\\S]*?recoverOnline/);
  assert.match(sync, /await realtimeCleanup/);
});

test("service-worker cache version invalidates the previous static script cache", () => {
  const sw = read("static/sw.js");
  assert.match(sw, /const CACHE_NAME = "mila-yaelnet-v16"/);
});
