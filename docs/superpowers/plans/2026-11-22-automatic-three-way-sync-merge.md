# Automatic Sync Merge Implementation Plan

> **For agentic workers:** Use the native in-session implementation workflow task-by-task. Keep all changes on the feature branch; do not merge or deploy to production.

**Goal:** Automatically merge local and cloud learning data and make autosave durable without user snapshot selection.

**Architecture:** Add a pure, tested three-way merge module and stable learning-event identities, then route login, realtime, and RPC conflicts through one serialized coordinator. Preserve the current Supabase revision RPC and add bounded local recovery backups.

**Tech Stack:** Browser JavaScript ES modules, Node.js built-in test runner, localStorage, Supabase JS v2, existing Supabase RPC, Vercel Preview.

**Spec:** `docs/superpowers/specs/2026-11-22-automatic-three-way-sync-merge-design.md`

## Global Constraints

- Base branch is `main`; starting SHA is `9a108e10ef05c72867a1809edf3d95efc8cb8922`.
- Do not modify `main`, merge a PR, or deploy to production.
- Do not change Supabase schema, RLS, Auth, RPC, or production data.
- Preserve existing localStorage keys and current data.
- Keep all 27+ current tests passing; run the full `npm test` suite.
- No new runtime dependency.

## Review Focus

- Two devices answer the same question/event: must count once.
- Two devices independently answer different questions: both increments must survive.
- No baseline/legacy snapshot: must not double-count whole snapshots.
- Edits made while an RPC write is in flight: must be saved in a subsequent flush.
- One device has an active adaptive session while the other has another active session: neither branch may be silently discarded.

---

### Task 1: Pure snapshot merge engine

**Files:**
- Create: `sync-merge-core.mjs`
- Create: `tests/sync-merge.test.cjs`
- Modify: `sync-core.mjs` only if shared snapshot validation needs a narrowly scoped helper.

**Interfaces:**
- `mergeSnapshots({ local, cloud, baseline, localUpdatedAt, cloudUpdatedAt })` returns `{ snapshot, merged, conflicts, warnings }`.
- The function must be pure and must never mutate inputs.
- Entry-level merge uses baseline comparison first; domain handlers merge known keys; legacy fallback is conservative.

- [ ] Write tests for equal snapshots, one-sided changes, and independent keys.
- [ ] Run the targeted test and verify it fails because the merge function is missing.
- [ ] Add three-way key selection and strict snapshot validation.
- [ ] Add tests for main-state counters, mistakes, sessions, extras, settings, unknown fields, invalid JSON and no-baseline behavior.
- [ ] Implement domain-aware main-state merging and conservative legacy behavior.
- [ ] Add tests for adaptive card merging, duplicate question results, and preserving two divergent active session branches.
- [ ] Implement bounded adaptive session recovery and validation.
- [ ] Run targeted tests and the full `npm test` suite.

### Task 2: Stable learning event IDs

**Files:**
- Modify: `static/storage.js`
- Modify: `static/app.js`
- Modify: `static/adaptive-engine.js` only if session branch serialization requires it.
- Modify: `tests/sync-merge.test.cjs` and add focused storage/app regression tests.

**Interfaces:**
- Each accepted answer must carry a stable event ID derived from its persisted session/question identity.
- The main state ledger stores answer IDs and timestamps, bounded to the existing ledger limit.
- Existing adaptive answer IDs remain compatible.

- [ ] Test duplicate answer event rejection and distinct answer acceptance.
- [ ] Verify the duplicate test fails on the current code.
- [ ] Add event ID recording to all normal answer modes and adaptive answers.
- [ ] Ensure failed local persistence rolls back progress and event ledger together.
- [ ] Run all tests.

### Task 3: Serialized merge coordinator and durable autosave

**Files:**
- Modify: `sync.js`
- Modify: `sync-core.mjs` for pure queue/retry helpers if required.
- Create or modify: sync coordinator tests.

**Interfaces:**
- One merge path is used by login reconciliation, realtime updates, and RPC revision conflicts.
- One in-flight save at a time; dirty generation tracks writes that occur during a request.
- Pending record persists snapshot, generation, expected revision and stable mutation ID.
- Conflict retries merge against the latest server snapshot and use a new mutation ID only for the new merged payload.

- [ ] Add failing tests for overlapping flush calls, edits during a pending write, stale revision conflict and retry idempotency.
- [ ] Implement a single-flight flush queue and durable pending envelope.
- [ ] Replace conflict-choice UI with automatic merge status and recovery messaging.
- [ ] Route realtime updates through the merge coordinator.
- [ ] Ensure no reload occurs before merged data and metadata are safely applied.
- [ ] Test offline/online, hidden/visible and storage-event scheduling behavior.

### Task 4: Safe apply, backup, and full verification

**Files:**
- Modify: `sync.js`
- Modify: `static/sw.js` to bump cache version and include the new module.
- Modify: relevant test files.

- [ ] Add tests for backup-before-apply, quota/write failure rollback, payload bounds and malformed cloud data.
- [ ] Implement bounded local pre-merge backup and rollback-safe apply.
- [ ] Add the merge module to the service-worker precache and bump its cache version.
- [ ] Run `npm test` and all JavaScript syntax checks.
- [ ] Inspect the complete diff for accidental changes to app logic, secrets, or Supabase config.
- [ ] Verify GitHub Actions on the feature branch.
- [ ] Verify Vercel Preview is READY and production alias/deployment remain unchanged.
- [ ] Leave the PR open and unmerged for user review.

## Completion criteria

- No snapshot-choice prompt for normal mergeable conflicts.
- No lost local/cloud learning events in tested merge scenarios.
- Duplicate events are counted once.
- Autosave serializes requests and does not clear newer dirty changes.
- Offline edits survive reload and are retried.
- Full test suite passes.
- Preview is available; production remains untouched.
