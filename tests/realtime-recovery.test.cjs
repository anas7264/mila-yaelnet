"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

function createFakeTimers() {
  let nextId = 1;
  const timers = new Map();

  return {
    setTimeoutImpl(callback, delay) {
      const id = nextId++;
      timers.set(id, { callback, delay });
      return id;
    },
    clearTimeoutImpl(id) {
      timers.delete(id);
    },
    get delays() {
      return [...timers.values()].map(({ delay }) => delay);
    },
    async runNext() {
      const next = timers.entries().next();
      if (next.done) return false;
      const [id, timer] = next.value;
      timers.delete(id);
      await timer.callback();
      return true;
    }
  };
}

test("the app declares its existing SVG as the browser favicon", () => {
  const html = read("index.html");
  assert.match(html, /<link rel="icon" type="image\/svg\+xml" href="\/static\/icon\.svg">/);
  assert.ok(fs.existsSync(path.join(__dirname, "../static/icon.svg")));
});

test("the service worker and document use fresh, matching sync module versions", () => {
  const html = read("index.html");
  const sync = read("sync.js");
  const merge = read("sync-merge-core.mjs");
  const sw = read("static/sw.js");

  assert.match(html, /\/sync\.js\?v=13/);
  assert.match(sync, /\.\/sync-core\.mjs\?v=8/);
  assert.match(sync, /\.\/sync-merge-core\.mjs\?v=3/);
  assert.match(merge, /\.\/sync-core\.mjs\?v=8/);
  assert.match(sw, /const CACHE_NAME = "mila-yaelnet-v44"/);
  assert.ok(sw.includes('"/sync.js?v=13"'));
  assert.ok(sw.includes('"/sync-core.mjs?v=8"'));
  assert.ok(sw.includes('"/sync-merge-core.mjs?v=3"'));
});

test("Realtime failures remove their channel and retry with capped exponential backoff", async () => {
  const { createRealtimeRetryManager } = await import("../sync-core.mjs");
  const timers = createFakeTimers();
  const channels = [];
  const removed = [];
  const reported = [];

  const manager = createRealtimeRetryManager({
    createChannel(onStatus) {
      const channel = { onStatus };
      channels.push(channel);
      return channel;
    },
    removeChannel(channel) {
      removed.push(channel);
    },
    canConnect: () => true,
    onStatus: (state, error, retryDelay) => reported.push({ state, message: error?.message, retryDelay }),
    setTimeoutImpl: timers.setTimeoutImpl,
    clearTimeoutImpl: timers.clearTimeoutImpl
  });

  manager.start();
  assert.equal(channels.length, 1);
  channels[0].onStatus("CHANNEL_ERROR", new Error("socket handshake failed"));
  assert.equal(manager.getChannel(), null);
  assert.deepEqual(timers.delays, [1000]);
  assert.equal(manager.getRetryCount(), 1);

  await timers.runNext();
  assert.equal(channels.length, 2);
  assert.equal(removed[0], channels[0]);

  channels[1].onStatus("TIMED_OUT", new Error("join timed out"));
  assert.deepEqual(timers.delays, [2000]);
  await timers.runNext();
  assert.equal(channels.length, 3);

  channels[2].onStatus("CHANNEL_ERROR", new Error("still unavailable"));
  assert.deepEqual(timers.delays, [4000]);
  await timers.runNext();

  assert.equal(channels.length, 4);
  const expectedDelays = [8000, 16000, 30000, 30000, 30000];
  for (const expectedDelay of expectedDelays) {
    const currentChannel = channels[channels.length - 1];
    currentChannel.onStatus("CHANNEL_ERROR", new Error("retry remains bounded"));
    assert.deepEqual(timers.delays, [expectedDelay]);
    await timers.runNext();
  }
  channels[channels.length - 1].onStatus("SUBSCRIBED");
  assert.equal(manager.getRetryCount(), 0);
  assert.deepEqual(timers.delays, []);
  assert.ok(reported.some((entry) => entry.message === "socket handshake failed" && entry.retryDelay === 1000));

  await manager.stop();
  assert.equal(manager.getChannel(), null);
});

test("stopping Realtime cancels pending retries and ignores late channel callbacks", async () => {
  const { createRealtimeRetryManager } = await import("../sync-core.mjs");
  const timers = createFakeTimers();
  const channels = [];
  const removed = [];
  const manager = createRealtimeRetryManager({
    createChannel(onStatus) {
      const channel = { onStatus };
      channels.push(channel);
      return channel;
    },
    removeChannel(channel) {
      removed.push(channel);
    },
    canConnect: () => true,
    setTimeoutImpl: timers.setTimeoutImpl,
    clearTimeoutImpl: timers.clearTimeoutImpl
  });

  manager.start();
  const staleChannel = channels[0];
  staleChannel.onStatus("CHANNEL_ERROR");
  assert.deepEqual(timers.delays, [1000]);

  const stopPromise = manager.stop();
  assert.deepEqual(removed, [staleChannel]);
  await stopPromise;
  assert.deepEqual(timers.delays, []);
  staleChannel.onStatus("SUBSCRIBED");
  assert.equal(manager.getChannel(), null);
  assert.equal(channels.length, 1);
  assert.deepEqual(removed, [staleChannel]);
});

test("Realtime does not connect while the page is ineligible and can resume later", async () => {
  const { createRealtimeRetryManager } = await import("../sync-core.mjs");
  let canConnect = false;
  const channels = [];
  const manager = createRealtimeRetryManager({
    createChannel(onStatus) {
      const channel = { onStatus };
      channels.push(channel);
      return channel;
    },
    removeChannel: () => {},
    canConnect: () => canConnect
  });

  manager.start();
  assert.equal(channels.length, 0);
  canConnect = true;
  manager.start();
  assert.equal(channels.length, 1);
  await manager.stop();
});


function createEventTarget() {
  const listeners = new Map();
  return {
    addEventListener(type, callback) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(callback);
    },
    removeEventListener(type, callback) {
      listeners.get(type)?.delete(callback);
    },
    dispatch(type, event = {}) {
      for (const callback of [...(listeners.get(type) || [])]) callback(event);
    },
    listenerCount(type) {
      return listeners.get(type)?.size || 0;
    }
  };
}

test("network lifecycle suspends on pagehide/freeze and resumes once after BFCache restore", async () => {
  const { createNetworkLifecycle } = await import("../sync-core.mjs");
  const windowRef = createEventTarget();
  const documentRef = Object.assign(createEventTarget(), { visibilityState: "visible" });
  const navigatorRef = { onLine: true };
  const authCalls = [];
  const pageEvents = [];
  const lifecycle = createNetworkLifecycle({
    auth: {
      startAutoRefresh() { authCalls.push("start"); },
      stopAutoRefresh() { authCalls.push("stop"); }
    },
    windowRef,
    documentRef,
    navigatorRef,
    onSuspend: event => pageEvents.push(["suspend", event?.persisted ?? null]),
    onResume: event => pageEvents.push(["resume", event?.persisted ?? null])
  });

  assert.equal(authCalls[0], "start");
  windowRef.dispatch("pagehide", { persisted: true });
  assert.equal(authCalls.at(-1), "stop");
  assert.deepEqual(pageEvents, [["suspend", true]]);

  // Chrome may emit both pagehide and freeze for a BFCache transition.
  documentRef.dispatch("freeze", {});
  assert.deepEqual(pageEvents, [["suspend", true]]);

  windowRef.dispatch("pageshow", { persisted: true });
  assert.equal(authCalls.at(-1), "start");
  assert.deepEqual(pageEvents, [["suspend", true], ["resume", true]]);

  documentRef.dispatch("resume", {});
  assert.deepEqual(pageEvents, [["suspend", true], ["resume", true]]);

  lifecycle.dispose();
  assert.equal(windowRef.listenerCount("pagehide"), 0);
  assert.equal(windowRef.listenerCount("pageshow"), 0);
  assert.equal(documentRef.listenerCount("visibilitychange"), 0);
  assert.equal(documentRef.listenerCount("freeze"), 0);
  assert.equal(documentRef.listenerCount("resume"), 0);
  assert.equal(authCalls.at(-1), "stop");
});

test("visibility transitions suspend and resume without misreporting network offline", async () => {
  const { createNetworkLifecycle } = await import("../sync-core.mjs");
  const windowRef = createEventTarget();
  const documentRef = Object.assign(createEventTarget(), { visibilityState: "visible" });
  const navigatorRef = { onLine: true };
  const pageEvents = [];
  const networkEvents = [];
  createNetworkLifecycle({
    auth: { startAutoRefresh() {}, stopAutoRefresh() {} },
    windowRef,
    documentRef,
    navigatorRef,
    onSuspend: () => pageEvents.push("suspend"),
    onResume: () => pageEvents.push("resume"),
    onOffline: () => networkEvents.push("offline")
  });

  documentRef.visibilityState = "hidden";
  documentRef.dispatch("visibilitychange", {});
  windowRef.dispatch("pagehide", { persisted: true });
  assert.deepEqual(pageEvents, ["suspend"]);
  assert.deepEqual(networkEvents, []);

  documentRef.visibilityState = "visible";
  windowRef.dispatch("pageshow", { persisted: true });
  documentRef.dispatch("visibilitychange", {});
  assert.deepEqual(pageEvents, ["suspend", "resume"]);
  assert.deepEqual(networkEvents, []);
});
