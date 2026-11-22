"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const read = (relativePath) => fs.readFileSync(path.join(__dirname, "..", relativePath), "utf8");
const app = read("static/app.js");
const sync = read("sync.js");
const styles = read("static/style.css");
const serviceWorker = read("static/sw.js");

test("beginSession defines an explicit serializable config before storing it", () => {
  const start = app.indexOf("function beginSession(");
  const end = app.indexOf("function startStudioSession(", start);
  assert.notEqual(start, -1, "beginSession must exist");
  assert.ok(end > start, "startStudioSession must follow beginSession");
  const body = app.slice(start, end);
  const configStart = body.indexOf("const persistableConfig = {");
  const sessionStart = body.indexOf("ui.session = {");
  assert.ok(configStart >= 0 && configStart < sessionStart, "persistableConfig must be initialized before ui.session");
  for (const key of ["mode", "source", "stageId", "stageIds", "count", "optionCount", "difficulty", "timerSeconds", "feedback", "shuffle", "noRepeat", "distractorScope"]) {
    assert.match(body.slice(configStart, sessionStart), new RegExp("\\b" + key + "\\s*:"));
  }
  assert.match(body.slice(sessionStart), /config:\s*\{\s*\.\.\.persistableConfig,\s*mode,\s*targetCount:/);
});

test("all sync status writes use the status controller as their single source of truth", () => {
  assert.match(sync, /const status=\(m,state='info'\)=>statusController\.set\(m,state\)/);
  assert.match(sync, /statusController\.render\(\)/);
  assert.doesNotMatch(sync, /e\.textContent=m/);
  assert.doesNotMatch(sync, /e\.dataset\.state=s/);
});

test("sync panel styling follows application theme tokens", () => {
  assert.match(sync, /background:var\(--surface,#fff\)/);
  assert.match(sync, /color:var\(--ink,#17233a\)/);
  assert.match(sync, /var\(--surface-2,/);
  assert.doesNotMatch(sync, /--mila-sync-(?:surface|text|border|input)/);
});

test("mobile toast reserves scroll space and respects the device safe area", () => {
  assert.match(app, /classList\.add\("toast-visible"\)/);
  assert.match(app, /classList\.remove\("toast-visible"\)/);
  assert.match(styles, /body\.toast-visible \.app-view\{padding-bottom:/);
  assert.match(styles, /env\(safe-area-inset-bottom/);
  assert.match(styles, /pointer-events:none/);
});

test("service worker cache version changes with the UI fix", () => {
  assert.match(serviceWorker, /const CACHE_NAME = "mila-yaelnet-v13"/);
});

test("status controller retains and re-renders the latest synchronization state", async () => {
  const { createStatusController } = await import("../sync-core.mjs");
  const element = { textContent: "", dataset: {} };
  const controller = createStatusController(() => element);
  controller.set("اكتشفنا تعارضًا بين نسختين.", "conflict");
  controller.render();
  assert.equal(element.textContent, "اكتشفنا تعارضًا بين نسختين.");
  assert.equal(element.dataset.state, "conflict");
});
