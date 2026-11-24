"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

test("automatic cloud synchronization never forces a page reload", () => {
  const sync = read("sync.js");
  const automaticSync = sync.replace("card$('mila-sync-retry').onclick=()=>location.reload();", "");
  assert.doesNotMatch(automaticSync, /location\\.reload\\s*\\(/);
  assert.match(sync, /card\\$\\('mila-sync-retry'\\)\\.onclick=\\(\\)=>location\\.reload\\(\\)/);
  assert.match(sync, /deferCloudUpdate/);
  assert.match(sync, /hasActiveLearningSession/);
  assert.match(sync, /mila:learning-session-change/);
  assert.match(sync, /applyCloudUpdate/);
});

test("both learning modes expose idle-only cloud refresh hooks", () => {
  const app = read("static/app.js");
  const adaptive = read("static/adaptive-ui.js");
  assert.match(app, /isSessionActive/);
  assert.match(app, /refreshFromStorage/);
  assert.match(adaptive, /MilaAdaptiveBridge/);
  assert.match(adaptive, /isSessionActive/);
  assert.match(adaptive, /refreshFromStorage/);
  assert.match(app, /mila:learning-session-change/);
  assert.match(adaptive, /mila:learning-session-change/);
});

test("new sync script is cache-busted and precached", () => {
  const html = read("index.html");
  const sw = read("static/sw.js");
  assert.match(html, /\\/sync\\.js\\?v=11/);
  assert.match(sw, /mila-yaelnet-v39/);
  assert.match(sw, /\\/sync\\.js\\?v=11/);
});
