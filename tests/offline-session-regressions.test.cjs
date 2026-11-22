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
    assert.ok(config.includes(key + ":") || config.includes(key + ","), "persistableConfig must include " + key);
  }
  assert.equal(config.includes("distractorPool"), false);
  assert.equal(config.includes("currentWord"), false);
  assert.ok(body.slice(sessionStart).includes(
    "config: { ...persistableConfig, mode, targetCount: targetIds.length }"
  ));
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
  assert.equal(calls.length, disposedCalls);
  assert.equal(calls.at(-1), "stop");
});

test("sync tears down realtime offline and restores it after connectivity returns", () => {
  const sync = read("sync.js");
  assert.ok(sync.includes("autoRefreshToken:false"), "auth refresh must be controlled by network lifecycle");
  for (const required of [
    "const pauseRealtime=",
    "sb.removeChannel(active)",
    "navigator.onLine===false",
    "createNetworkLifecycle({",
    "await realtimeCleanup",
    "onOffline:()=>{",
    "void pauseRealtime()",
    "onOnline:()=>{void recoverOnline()}"
  ]) {
    assert.ok(sync.includes(required), "sync.js must include " + required);
  }
});

test("service-worker cache version invalidates the previous static script cache", () => {
  const sw = read("static/sw.js");
  assert.ok(sw.includes('const CACHE_NAME = "mila-yaelnet-v21"'));
  assert.ok(sw.includes('"/sync.js?v=6"'));
});

test("sync card remains visually light and independent of the application dark theme", () => {
  const sync = read("sync.js");
  const index = read("index.html");
  const cardRuleStart = sync.indexOf("#mila-sync-card{");
  assert.notEqual(cardRuleStart, -1, "sync card CSS rule must exist");
  const cardRule = sync.slice(cardRuleStart, sync.indexOf("}", cardRuleStart));

  for (const required of [
    "color-scheme:light!important",
    "--bg:#fff",
    "--surface:#fff",
    "--ink:#172338",
    "--line:#d9deea",
    "background:#fff!important",
    "color:#17233a!important"
  ]) {
    assert.ok(cardRule.includes(required), "sync card must explicitly reset " + required);
  }

  for (const required of [
    "#mila-sync-card *{box-sizing:border-box;color-scheme:light!important}",
    "#mila-sync-card input{",
    "background:#fff!important;color:#17233a!important",
    "#mila-sync-card .status[data-state=ok]",
    "#mila-sync-card .status[data-state=error]",
    "#mila-sync-card .conflict{"
  ]) {
    assert.ok(sync.includes(required), "sync card child styling must include " + required);
  }

  assert.ok(index.includes("background:#fff;color:#17233a;color-scheme:light"),
    "the sync-load fallback card must stay light too");
  assert.ok(index.includes("import('/sync.js?v=6')"),
    "the updated sync stylesheet must bypass a cached older module");
});


test("session restoration timeout settles a never-resolving auth initialization", async () => {
  const { withTimeout } = await import("../sync-core.mjs");
  await assert.rejects(
    withTimeout(new Promise(() => {}), 5, "restore timed out"),
    (error) => error.name === "TimeoutError" && error.message === "restore timed out"
  );
});

test("session restoration helper clears its timer after a successful result", async () => {
  const { withTimeout } = await import("../sync-core.mjs");
  assert.deepEqual(await withTimeout(Promise.resolve({ session: null }), 100, "timeout"), { session: null });
});

test("sync distinguishes a signed-out user from an offline signed-in user and bounds session restoration", () => {
  const sync = read("sync.js");
  const core = read("sync-core.mjs");
  const listenerAt = sync.indexOf("sb.auth.onAuthStateChange(");
  const restoreAt = sync.indexOf("sb.auth.getSession()");
  assert.ok(listenerAt >= 0 && listenerAt < restoreAt,
    "the auth-state listener must be attached before the explicit session read");
  assert.ok(sync.includes("event==='INITIAL_SESSION'"),
    "INITIAL_SESSION must be able to settle the initial UI state");
  assert.ok(sync.includes("if(activationVersion===0)"),
    "late initial-session events must not overwrite a newer user action");
  assert.ok(sync.includes("status=(m,s='info')=>statusController.set(m,s)"),
    "all status writes must update the controller's stored state");
  assert.equal(sync.includes("e.textContent=m;e.dataset.state=s"), false,
    "status updates must not bypass the controller and become stale on rerender");
  assert.ok(sync.includes("await withTimeout("), "initial auth restoration must be bounded");
  assert.ok(sync.includes("10000,"), "initial auth restoration must have a finite timeout");
  assert.ok(sync.includes("لم تسجّل الدخول حاليًا"), "a missing session must have an explicit signed-out state");
  assert.ok(sync.includes("أنت مسجّل الدخول، لكن لا يوجد اتصال بالإنترنت"), "offline and signed-out states must not share wording");
  assert.ok(sync.includes("card$('mila-sync-retry').hidden=false"), "failed restoration must expose retry");
  assert.ok(core.includes("export function withTimeout"), "the timeout helper must be testable");
});
