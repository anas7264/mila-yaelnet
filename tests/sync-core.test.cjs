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

test("production sync migration enforces durable idempotency and RPC-only writes", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const sql = fs.readFileSync(path.join(__dirname, "..", "supabase/migrations/20261123073929_add_learning_mutation_idempotency.sql"), "utf8");
  assert.match(sql, /private\.learning_mutations/);
  assert.match(sql, /set search_path = ''/i);
  assert.match(sql, /payload_hash/);
  assert.ok(sql.indexOf("if found then") < sql.indexOf("if v_row.revision <> p_expected_revision"));

  const hardening = fs.readFileSync(path.join(__dirname, "..", "supabase/migrations/20261123074041_restore_invoker_sync_mutation_ledger.sql"), "utf8");
  assert.match(hardening, /security invoker/i);
  assert.match(hardening, /create policy "Users can read their own sync mutations"/i);
  assert.match(hardening, /create policy "Users can insert their own sync mutations"/i);
  assert.match(hardening, /grant select, insert, update on table public\.learning_state to authenticated/i);
});
