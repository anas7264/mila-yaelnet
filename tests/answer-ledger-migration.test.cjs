"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const migration = fs.readFileSync(path.join(__dirname, "../supabase/migrations/20261124150000_create_learning_answer_events.sql"), "utf8");

test("answer event ledger is append-only and protected by per-user RLS", () => {
  assert.match(migration, /create table if not exists public\.learning_answer_events/);
  assert.match(migration, /unique \(user_id, event_id\)/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /for insert to authenticated[\s\S]*?auth\.uid\(\)\) = user_id/);
  assert.match(migration, /for select to authenticated[\s\S]*?auth\.uid\(\)\) = user_id/);
  assert.match(migration, /grant select, insert on table public\.learning_answer_events to authenticated/);
  assert.doesNotMatch(migration, /grant update|grant delete/i);
});

test("analytics views are invoker-secured and separate difficulty from card self-ratings", () => {
  assert.match(migration, /learning_answer_word_stats[\s\S]*?security_invoker = true/);
  assert.match(migration, /event_type = 'answer' and payload ->> 'isCorrect' = 'true'/);
  assert.match(migration, /event_type = 'self-rating' and payload ->> 'selfRating' = 'again'/);
  assert.match(migration, /learning_answer_confusion_stats[\s\S]*?security_invoker = true/);
  assert.match(migration, /grant select on public\.learning_answer_word_stats to authenticated/);
  assert.match(migration, /grant select on public\.learning_answer_confusion_stats to authenticated/);
});
