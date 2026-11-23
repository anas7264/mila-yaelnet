"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const read = (relativePath) => fs.readFileSync(
  path.join(__dirname, "..", relativePath),
  "utf8"
);

const app = read("static/app.js");
const index = read("index.html");
const workflow = read(".github/workflows/verify.yml");

test("dashboard explains account-gated automatic synchronization", () => {
  assert.match(
    app,
    /عند تسجيل الدخول إلى الحساب نفسه على أجهزتك، تُزامن التغييرات تلقائيًا/
  );
  assert.doesNotMatch(app, /لا توجد مزامنة تلقائية/);
  assert.doesNotMatch(app, /localStorage على المتصفح الحالي فقط/);
});

test("settings distinguish local-first storage from signed-in cloud sync", () => {
  assert.match(app, /يُحفظ تقدمك محليًا أولًا، ثم يُزامن إلى حسابك عند تسجيل الدخول/);
  assert.match(app, /سجّل الدخول إلى الحساب نفسه على كل جهاز/);
  assert.match(app, /تُستأنف المزامنة تلقائيًا عند عودة الاتصال/);
  assert.doesNotMatch(app, /محلي على هذا الجهاز<\/span>/);
});

test("footer does not describe the application as local-only", () => {
  assert.match(index, /حفظ محلي تلقائي · مزامنة تلقائية عند تسجيل الدخول/);
  assert.doesNotMatch(index, /بياناتك محفوظة محليًا على هذا الجهاز/);
});

test("verification workflow runs on main branch pushes", () => {
  const push = workflow.match(/push:\s*\n\s*branches:\s*\[([^\]]+)\]/);
  assert.ok(push, "push branch filter must exist");
  const branches = push[1].split(",").map((branchName) => branchName.trim());
  assert.ok(branches.includes("main"), "main must trigger verification");
});

test("CI uses maintained Node LTS versions and current action runtimes", () => {
  const runtimeWorkflow = read(".github/workflows/pr-0-ci.yml");
  const verifyWorkflow = read(".github/workflows/verify.yml");

  assert.match(runtimeWorkflow, /actions\/checkout@v7/);
  assert.match(runtimeWorkflow, /actions\/setup-node@v7/);
  assert.match(runtimeWorkflow, /node-version:\s*26\b/);
  assert.doesNotMatch(runtimeWorkflow, /node-version:\s*20\b/);
  assert.match(runtimeWorkflow, /ci\/pr-0-node26-runtime-baseline/);
  assert.doesNotMatch(runtimeWorkflow, /node20-test-baseline/);

  assert.match(verifyWorkflow, /actions\/checkout@v7/);
  assert.match(verifyWorkflow, /actions\/setup-node@v7/);
  assert.match(verifyWorkflow, /node-version:\s*22\b/);
});
