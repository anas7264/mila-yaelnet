"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const read = file => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
const handler = require("../api/monitoring-config.js");

function invokeConfig(method, env) {
  const previous = { ...process.env };
  for (const key of ["GLITCHTIP_DSN", "VERCEL_ENV", "VERCEL_GIT_COMMIT_SHA"]) delete process.env[key];
  Object.assign(process.env, env || {});
  const headers = {};
  const res = {
    statusCode: 200,
    body: null,
    setHeader(key, value) { headers[key] = value; },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return value; }
  };
  try {
    handler({ method }, res);
    return { statusCode: res.statusCode, body: res.body, headers };
  } finally {
    for (const key of Object.keys(process.env)) {
      if (!(key in previous)) delete process.env[key];
    }
    Object.assign(process.env, previous);
  }
}

test("monitoring config accepts only public HTTPS DSNs without query or secret components", () => {
  assert.equal(handler.parsePublicDsn("https://public-key@errors.example.com/42"), "https://public-key@errors.example.com/42");
  assert.equal(handler.parsePublicDsn("http://public-key@errors.example.com/42"), null);
  assert.equal(handler.parsePublicDsn("https://errors.example.com/42"), null);
  assert.equal(handler.parsePublicDsn("https://public-key:private@errors.example.com/42"), null);
  assert.equal(handler.parsePublicDsn("https://public-key@errors.example.com/42?secret=x"), null);
});

test("monitoring config is disabled without DSN and exposes no server secrets", () => {
  const result = invokeConfig("GET", {
    VERCEL_ENV: "production",
    VERCEL_GIT_COMMIT_SHA: "a".repeat(40),
    SUPABASE_SERVICE_ROLE_KEY: "must-never-be-returned"
  });
  assert.equal(result.statusCode, 200);
  assert.equal(result.body.enabled, false);
  assert.equal(result.body.environment, "production");
  assert.equal(result.body.release, "a".repeat(40));
  assert.equal(Object.hasOwn(result.body, "dsn"), false);
  assert.equal(JSON.stringify(result.body).includes("must-never-be-returned"), false);
  assert.equal(result.headers["Cache-Control"].includes("no-store"), true);
});

test("monitoring config rejects non-GET methods", () => {
  const result = invokeConfig("POST", { GLITCHTIP_DSN: "https://public-key@errors.example.com/42" });
  assert.equal(result.statusCode, 405);
  assert.equal(result.body.enabled, false);
  assert.equal(result.headers.Allow, "GET");
});

async function loadMonitor(config) {
  let appendedScripts = 0;
  const listeners = new Map();
  const captures = [];
  let initOptions = null;
  const sentry = {
    init(options) { initOptions = options; },
    withScope(callback) { callback({ setTag() {} }); },
    captureException(error) { captures.push(error); }
  };
  const context = {
    console,
    URL,
    fetch: async () => ({ ok: true, json: async () => config }),
    document: {
      createElement() { return {}; },
      head: {
        appendChild(script) {
          appendedScripts += 1;
          context.Sentry = sentry;
          script.onload?.();
        }
      }
    },
    addEventListener(type, callback) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(callback);
    }
  };
  context.window = context;
  vm.runInNewContext(read("static/error-monitoring.js"), context, { filename: "static/error-monitoring.js" });
  await new Promise(resolve => setImmediate(resolve));
  return { context, appendedScripts, listeners, captures, getInitOptions: () => initOptions };
}

test("monitoring stays dormant and makes no third-party SDK request without a configured DSN", async () => {
  const monitor = await loadMonitor({ enabled: false });
  assert.equal(monitor.context.MilaErrorMonitor.isEnabled(), false);
  assert.equal(monitor.appendedScripts, 0);
});

test("GlitchTip SDK is pinned, error-only, and scrubs request and personal data before sending", async () => {
  const monitor = await loadMonitor({
    enabled: true,
    dsn: "https://public-key@errors.example.com/42",
    environment: "production",
    release: "b".repeat(40)
  });
  assert.equal(monitor.appendedScripts, 1);
  assert.equal(monitor.context.MilaErrorMonitor.isEnabled(), true);
  const options = monitor.getInitOptions();
  assert.equal(options.sendDefaultPii, false);
  assert.equal(options.autoSessionTracking, false);
  assert.equal(options.tracesSampleRate, 0);
  assert.equal(options.maxBreadcrumbs, 0);
  assert.equal(options.defaultIntegrations, false);
  assert.deepEqual(options.integrations, []);
  assert.match(read("static/error-monitoring.js"), /browser\.sentry-cdn\.com\/11\.17\.0\/bundle\.min\.js/);

  const event = {
    message: "Failure for learner@example.com Bearer abc.def.ghi",
    user: { email: "learner@example.com" },
    request: { url: "https://app.example.com/?token=private" },
    breadcrumbs: [{ message: "typed input" }],
    extra: { password: "private" },
    tags: { area: "adaptive", email: "learner@example.com" },
    exception: { values: [{
      value: "access_token=secret-value",
      stacktrace: { frames: [{ filename: "https://app.example.com/app.js?token=private", vars: { answer: "private" } }] }
    }] }
  };
  const scrubbed = options.beforeSend(event);
  assert.equal(Object.hasOwn(scrubbed, "user"), false);
  assert.equal(Object.hasOwn(scrubbed, "request"), false);
  assert.equal(Object.hasOwn(scrubbed, "breadcrumbs"), false);
  assert.equal(Object.hasOwn(scrubbed, "extra"), false);
  assert.equal(scrubbed.message, "JavaScript exception message redacted");
  assert.equal(scrubbed.message.includes("learner@example.com"), false);
  assert.equal(scrubbed.exception.values[0].value, "Error: [message redacted]");
  assert.equal(Object.hasOwn(scrubbed.exception.values[0].stacktrace.frames[0], "vars"), false);
  assert.equal(scrubbed.exception.values[0].stacktrace.frames[0].filename.includes("?"), false);
  assert.deepEqual(scrubbed.tags, { area: "adaptive" });

  monitor.context.MilaErrorMonitor.captureException(new Error("unexpected failure"), { area: "adaptive", action: "session" });
  assert.equal(monitor.captures.length, 1);
});

test("index loads the monitor before app scripts and the service worker caches its local loader", () => {
  const html = read("index.html");
  const sw = read("static/sw.js");
  assert.ok(html.indexOf("static/error-monitoring.js?v=1") < html.indexOf("static/app.js"));
  assert.ok(sw.includes("mila-yaelnet-v43"));
  assert.ok(sw.includes("/static/error-monitoring.js?v=1"));
});
