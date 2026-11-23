"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");

test("pending mutation preserves its snapshot, revision, and id across retries", async () => {
  const { createSnapshot, createPendingMutation, normalizePendingMutation } = await import("../sync-core.mjs");
  const snapshot = createSnapshot([["mila-yaelnet-v1", "{\"version\":3}"]]);
  const mutation = createPendingMutation(snapshot, 7, "mutation-stable-1", 1234);
  const retry = normalizePendingMutation(mutation, 99, () => "new-id");
  assert.equal(retry.mutationId, "mutation-stable-1");
  assert.equal(retry.expectedRevision, 7);
  assert.equal(retry.createdAt, 1234);
  assert.deepEqual(retry.snapshot, snapshot);
});

test("legacy pending snapshots migrate to a stable mutation envelope", async () => {
  const { createSnapshot, normalizePendingMutation } = await import("../sync-core.mjs");
  const snapshot = createSnapshot([["mila-yaelnet-v1", "{}"]]);
  const mutation = normalizePendingMutation(snapshot, 4, () => "legacy-upgraded");
  assert.equal(mutation.mutationId, "legacy-upgraded");
  assert.equal(mutation.expectedRevision, 4);
  assert.deepEqual(mutation.snapshot, snapshot);
});

test("invalid pending mutation is rejected without manufacturing a new write", async () => {
  const { normalizePendingMutation } = await import("../sync-core.mjs");
  assert.equal(normalizePendingMutation({ version: 1, snapshot: null }, 0, () => "id"), null);
});
