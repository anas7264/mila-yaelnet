"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = fs.readFileSync(path.join(__dirname, "..", "static/app.js"), "utf8");

test("library initially renders only 20 words and exposes a progressive sentinel", () => {
  assert.match(app, /libraryVisibleCount:\s*20/);
  assert.match(app, /wordListMarkup\(words\.slice\(0, ui\.libraryVisibleCount \|\| 20\)\)/);
  assert.match(app, /libraryLoadMoreSentinel/);
  assert.match(app, /new IntersectionObserver/);
});

test("library loads another 20 only when its sentinel is reached and resets after filters", () => {
  assert.match(app, /libraryVisibleCount = Math\.min\(\(ui\.libraryVisibleCount \|\| 20\) \+ 20/);
  assert.match(app, /ui\.libraryVisibleCount=20;renderLibrary\(\)/);
  assert.match(app, /ui\.libraryObserver\?\.disconnect\(\)/);
});
