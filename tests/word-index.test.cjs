"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createWordIndex } = require("../static/word-index.js");

test("word catalogue and ID index are built once and reused across renders", () => {
  const official = [{ id: "official-1", he: "מילה", ar: "كلمة" }];
  const extras = [{ id: "extra-1", he: "תוצאה", ar: "نتيجة" }];
  let mergeCalls = 0;
  const index = createWordIndex({
    officialWords: official,
    getExtras: () => extras,
    mergeExpanded: words => {
      mergeCalls += 1;
      return [...words, { id: "expanded-1", he: "השפעה", ar: "تأثير" }];
    }
  });

  const firstWords = index.getWords();
  const firstMap = index.getMap();
  for (let i = 0; i < 100; i += 1) {
    assert.equal(index.getWords(), firstWords);
    assert.equal(index.getMap(), firstMap);
    assert.equal(index.getMap().get("expanded-1").he, "השפעה");
  }

  assert.equal(mergeCalls, 1);
  assert.equal(firstWords.length, 3);
});

test("invalidating after vocabulary changes rebuilds the index with new words", () => {
  const extras = [{ id: "extra-1", he: "תוצאה", ar: "نتيجة" }];
  let mergeCalls = 0;
  const index = createWordIndex({
    officialWords: [],
    getExtras: () => extras,
    mergeExpanded: words => {
      mergeCalls += 1;
      return words;
    }
  });

  assert.equal(index.getMap().has("extra-2"), false);
  extras.push({ id: "extra-2", he: "השפעה", ar: "تأثير" });
  index.invalidate();

  assert.equal(index.getMap().has("extra-2"), true);
  assert.equal(mergeCalls, 2);
});

test("word index preserves duplicate-ID last-write behavior from the app catalogue", () => {
  const index = createWordIndex({
    officialWords: [{ id: "same", he: "old", ar: "قديم" }],
    getExtras: () => [{ id: "same", he: "new", ar: "جديد" }],
    mergeExpanded: words => words
  });

  assert.equal(index.getMap().get("same").he, "new");
});
