"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

test("app entrypoint does not load cloud sync or Supabase", () => {
  const html = read("index.html");
  assert.doesNotMatch(html, /sync-config|\/sync\.js|supabase|mila-sync/i);
  assert.match(html, /static\/storage\.js/);
  assert.match(html, /static\/adaptive-ui\.js/);
});

test("service worker no longer precaches cloud sync assets", () => {
  const sw = read("static/sw.js");
  assert.match(sw, /mila-yaelnet-v23/);
  assert.doesNotMatch(sw, /sync-config|sync\.js|sync-core|supabase/i);
});

test("adaptive answers still flow through the local platform bridge", () => {
  const ui = read("static/adaptive-ui.js");
  const app = read("static/app.js");
  assert.match(ui, /bridge\.recordAdaptiveAnswer/);
  assert.match(app, /function recordAdaptiveAnswer\(event\)/);
  assert.match(app, /STORE\.saveState\(state, localStorage\)/);
});
