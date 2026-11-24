(function attachWordIndex(root) {
  "use strict";

  function createWordIndex({ officialWords = [], getExtras = () => [], mergeExpanded = words => words } = {}) {
    if (!Array.isArray(officialWords)) throw new TypeError("officialWords must be an array");
    if (typeof getExtras !== "function" || typeof mergeExpanded !== "function") {
      throw new TypeError("getExtras and mergeExpanded must be functions");
    }

    let words = null;
    let byId = null;

    function build() {
      if (words) return;
      const extras = getExtras().map(word => ({
        ...word,
        source: "extra",
        stageId: null,
        stageTitle: "كلمات إضافية",
        category: word.category || "إضافية"
      }));
      const base = [...new Map([...officialWords, ...extras].map(word => [word.id, word])).values()];
      words = mergeExpanded(base);
      byId = new Map(words.map(word => [word.id, word]));
    }

    return Object.freeze({
      getWords() {
        build();
        return words;
      },
      getMap() {
        build();
        return byId;
      },
      invalidate() {
        words = null;
        byId = null;
      }
    });
  }

  const api = { create: createWordIndex, createWordIndex };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.YaelWordIndex = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
