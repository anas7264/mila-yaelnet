const fs = require("node:fs");
const path = require("node:path");
const { officialWords } = require("../static/catalog.js");
const { terms: expandedTerms } = require("../static/expanded-vocabulary.js");

const ROOT = path.resolve(__dirname, "..");
const CATALOG_VERSION = "mila-vocab-2026-11-22-v1";

function loadAcademicTerms() {
  const source = fs.readFileSync(path.join(ROOT, "academic-terms.js"), "utf8");
  const match = source.match(/const GROUPS = ([\s\S]*?);\s*const TERMS/);
  if (!match) throw new Error("Could not locate the canonical academic terms array");
  const groups = JSON.parse(match[1]);
  if (!Array.isArray(groups)) throw new Error("Academic terms must be an array of groups");
  return groups.flatMap(group => {
    if (!Array.isArray(group.terms)) throw new Error("Academic group is missing terms: " + group.id);
    return group.terms.map(term => ({
      id: term.id,
      he: term.he,
      ar: term.ar,
      source: "academic"
    }));
  });
}

function buildManifest() {
  const core = officialWords().map(word => ({
    id: word.id,
    he: word.he,
    ar: word.ar,
    source: "stage"
  }));
  const academic = loadAcademicTerms();
  const expanded = expandedTerms.map(word => ({
    id: word.id,
    he: word.he,
    ar: word.ar,
    source: "expanded"
  }));
  const records = [...core, ...academic, ...expanded];
  const seen = new Set();
  const words = {};
  for (const word of records) {
    if (!word.id || !word.he || !word.ar || seen.has(word.id)) continue;
    seen.add(word.id);
    words[word.id] = { he: word.he, ar: word.ar, source: word.source };
  }
  return { catalogVersion: CATALOG_VERSION, words };
}

if (require.main === module) {
  const manifest = buildManifest();
  const outputPath = path.join(ROOT, "supabase/functions/_shared/word-catalog.json");
  if (process.argv.includes("--write")) {
    fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2) + "\n");
    process.stdout.write("Wrote " + Object.keys(manifest.words).length + " words to " + outputPath + "\n");
  } else {
    process.stdout.write(JSON.stringify({
      catalogVersion: manifest.catalogVersion,
      wordCount: Object.keys(manifest.words).length,
      usage: "Run with --write to update the committed manifest."
    }, null, 2) + "\n");
  }
}

module.exports = { buildManifest, loadAcademicTerms };
