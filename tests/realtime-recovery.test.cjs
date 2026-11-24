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
  assert.match(sync, /\.\/sync-core\.mjs\?v=9/);
  assert.match(sync, /\.\/sync-merge-core\.mjs\?v=4/);
  assert.match(merge, /\.\/sync-core\.mjs\?v=7/);
  assert.match(sw, /const CACHE_NAME = "mila-yaelnet-v47"/);
  assert.ok(sw.includes('"/sync.js?v=14"'));
  assert.ok(sw.includes('"/sync-core.mjs?v=9"'));
  assert.ok(sw.includes('"/sync-merge-core.mjs?v=4"'));
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

  await manager.stop();
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
