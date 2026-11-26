"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

test("automatic cloud synchronization never forces a page reload", () => {
  const sync = read("sync.js");
  const explicitRetry = "card$('mila-sync-retry').onclick=()=>location.reload();";
  assert.equal(sync.includes(explicitRetry), true, "manual retry remains available");
  assert.equal(sync.replace(explicitRetry, "").includes("location.reload("), false);
  assert.equal(sync.includes("deferCloudUpdate"), true);
  assert.equal(sync.includes("hasActiveLearningSession"), true);
  assert.equal(sync.includes("mila:learning-session-change"), true);
  assert.equal(sync.includes("applyCloudUpdate"), true);
  assert.equal(sync.includes("deferredCloudUpdate||deferredAccountSession"), true, "uploads wait until deferred remote state is reconciled");
});

test("both learning modes expose idle-only cloud refresh hooks", () => {
  const app = read("static/app.js");
  const adaptive = read("static/adaptive-ui.js");
  assert.equal(app.includes("isSessionActive"), true);
  assert.equal(app.includes("!ui.session.paused"), true);
  assert.equal(app.includes("refreshFromStorage"), true);
  assert.equal(adaptive.includes("MilaAdaptiveBridge"), true);
  assert.equal(adaptive.includes("isSessionActive"), true);
  assert.equal(adaptive.includes("!state.session.paused"), true);
  assert.equal(adaptive.includes("refreshFromStorage"), true);
  assert.equal(app.includes("mila:learning-session-change"), true);
  assert.equal(app.includes("ui.session?.finished && ui.session.summary"), true, "completed quiz summaries survive background refresh");
  assert.equal(adaptive.includes("mila:learning-session-change"), true);
});

test("sync card mounts only after app render instead of observing the whole document", () => {
  const sync = read("sync.js");
  const app = read("static/app.js");
  assert.equal(sync.includes("new MutationObserver"), false);
  assert.equal(sync.includes("getClientRects"), false);
  assert.equal(sync.includes("mila:app-render"), true);
  assert.equal(app.includes("mila:app-render"), true);
  assert.equal(app.includes("renderEvent.view = ui.view"), true);
});

test("new sync script is cache-busted and precached", () => {
  const html = read("index.html");
  const sw = read("static/sw.js");
  assert.equal(html.includes("import('/sync.js?v=13')"), true);
  assert.equal(sw.includes("mila-yaelnet-v44"), true);
  assert.equal(sw.includes('"/sync.js?v=13"'), true);
});
