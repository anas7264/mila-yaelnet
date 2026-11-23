"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

test("browser sync runtime parses as an ES module", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "sync.js"), "utf8");
  const result = spawnSync(process.execPath, ["--check", "--input-type=module"], {
    input: source,
    encoding: "utf8"
  });
  assert.equal(result.status, 0, result.stderr || result.stdout || "sync.js syntax check failed");
});
