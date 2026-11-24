"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

test("app entrypoint loads the automatic sync runtime", () => {
  const html = read("index.html");
  assert.match(html, /sync-config\.js/);
  assert.match(html, /import\(['"]\/sync\.js\?v=10['"]\)/);
  assert.match(html, /static\/storage\.js/);
  assert.match(html, /static\/adaptive-ui\.js/);
});

test("service worker precaches sync runtime and local Supabase SDK", () => {
  const sw = read("static/sw.js");
  assert.match(sw, /mila-yaelnet-v37/);
  assert.match(sw, /sync-config\.js/);
  assert.match(sw, /sync\.js/);
  assert.match(sw, /sync-core\.mjs/);
  assert.match(sw, /sync-merge-core\.mjs\?v=3/);
  assert.match(sw, /static\/vendor\/supabase\.umd\.js/);
});

test("sync retries persist a stable mutation id and original snapshot", () => {
  const sync = read("sync.js");
  assert.match(sync, /createPendingMutation/);
  assert.match(sync, /mergeSnapshots/);
  assert.match(sync, /const autoMerge=async/);
  assert.match(sync, /await autoMerge\(snap\(\),r\.data\.state,r\.data\.revision\)/);
  assert.match(sync, /normalizePendingMutation/);
  assert.match(sync, /p_mutation_id:mutationId/);
  assert.match(sync, /makeMutation\(c\.local,c\.revision,uuid\(\)\)/);
  assert.match(sync, /normalized\.userId!==session\.user\.id/);
  assert.doesNotMatch(sync, /p_mutation_id:uuid\(\)/);
  assert.match(sync, /data\.status==='duplicate'&&data\.state&&!isSameSnapshot/);
  assert.match(sync, /makeMutation\(c\.local,c\.revision,uuid\(\)\)/);
});

test("platform reuses the expanded vocabulary index instead of rebuilding it per render", () => {
  const html = read("index.html");
  const app = read("static/app.js");
  const sw = read("static/sw.js");
  assert.match(html, /static\/word-index\.js\?v=1/);
  assert.match(app, /YaelWordIndex\.create/);
  assert.match(app, /wordIndex\.invalidate\(\)/);
  assert.match(sw, /static\/word-index\.js\?v=1/);
});

test("adaptive answers still flow through the local platform bridge", () => {
  const ui = read("static/adaptive-ui.js");
  const app = read("static/app.js");
  assert.match(ui, /bridge\?\.recordAdaptiveAnswer|bridge\.recordAdaptiveAnswer/);
  assert.match(app, /function recordAdaptiveAnswer\(event\)/);
  assert.match(app, /STORE\.saveState\(state, localStorage\)/);
});
