# Automatic Three-Way Sync Merge — Design

**Date:** 2026-11-22  
**Project:** MILA YAELNet  
**Base:** `main` at `9a108e10ef05c72867a1809edf3d95efc8cb8922`

## Intent

When a device's local learning snapshot and the authenticated cloud snapshot diverge, MILA must merge compatible changes automatically instead of asking the learner to choose a complete snapshot. The primary invariant is that learning progress must not be silently overwritten or counted twice.

## Current behavior and root cause

- `sync.js` stores all `mila-yaelnet-*` localStorage keys in one revisioned snapshot and sends writes through the existing `sync_learning_state` RPC.
- `loginSync`, realtime `remote`, and the RPC conflict path currently call `showConflict`; the UI exposes “use cloud” and “use device”.
- `sync-core.mjs` validates snapshots but has no merge operation.
- `static/storage.js` already contains a migration-only `mergeProgressWithoutDoubleCounting`, but max-counter merging cannot add independent progress safely.
- The main learning state has progress, mistakes, sessions, extras, settings, daily stats and an adaptive answer/session idempotency ledger. Normal quiz answers do not yet receive stable event IDs.
- The adaptive engine stores its own progress and one resumable session. Different active sessions cannot be represented by simply overwriting one `session` object.

## Goals

1. Automatically merge local and cloud snapshots at login, realtime update, and optimistic-revision conflict.
2. Use the last acknowledged common snapshot as a three-way merge base when available.
3. Preserve independent learning events and deduplicate repeated events by stable IDs.
4. Never add counters by summing two complete snapshots; derive deltas from the common base and deduplicated event IDs.
5. Preserve completed sessions, mistakes, personal words, settings, and adaptive progress.
6. Preserve multiple active adaptive-session branches instead of silently discarding one; expose a safe way to resume an archived branch if needed.
7. Make autosave single-flight, generation-aware, durable offline, and retry-safe.
8. Back up both pre-merge snapshots locally before applying a merged snapshot.
9. Keep Supabase schema/RLS/Auth/RPC unchanged in this phase; use the existing revision-checked RPC only.
10. Keep production unchanged. Work on a feature branch, require automated tests and a Vercel Preview, and leave the PR unmerged for the user.

## Non-goals

- No production deployment or merge to `main`.
- No Supabase DDL, migration, policy, RPC, or production-data mutation.
- No replacement of localStorage, the current application storage schemas, or the existing Supabase provider.
- No automatic deletion of unknown learning keys or malformed-but-preservable source values.

## Merge rules

### Snapshot envelope

- Validate format/version and reject duplicate or invalid keys before merge.
- Index entries by key; compare local/cloud values with the acknowledged baseline.
- If only one side changed from baseline, keep that side.
- If both sides changed identically, keep the common value.
- If both sides changed differently, dispatch to a schema-aware merge.
- With no usable baseline (first sign-in or legacy device), use conservative union/max rules; never sum counters from two full snapshots.

### Main learning state (v3)

- Progress counters: use baseline-relative deltas only when event identities make the delta safe; deduplicate answer events by stable event ID. Legacy counters without event coverage use conservative maxima, not sums.
- Progress scheduling fields: select the side with the latest review/answer timestamp; merge monotonic fields conservatively; preserve favorites with logical OR.
- Mistakes and completed session summaries: union by stable record ID; never duplicate an ID.
- Personal vocabulary: union by stable word ID; preserve distinct records and validate before writing.
- Adaptive idempotency ledger: union keys by ID and keep the latest timestamp.
- Daily stats: merge baseline-relative increments where supported; streak/date fields use the latest valid date and preserve the highest defensible streak.
- Settings: merge field-by-field; one-sided changes win. For simultaneous different values, use a deterministic last-writer rule based on recorded modification metadata, with a documented deterministic fallback.
- Migrations and unknown fields: preserve compatible fields; do not drop unknown data.

### Adaptive state (v1)

- Merge per-word card counters relative to baseline when event/result identities allow it; otherwise use conservative maxima.
- Union session results by `questionId`.
- Preserve both distinct active session branches in a bounded recovery collection; keep one primary session for backward compatibility and provide a way to resume a preserved branch. If two copies of the same session diverged, retain both branches rather than guessing that a cursor is safe to overwrite.
- Validate queues, cursors, word IDs and policy bounds before accepting a session.

### Other learning keys

- Apply three-way field merge for compatible JSON objects.
- For unsupported divergent values, retain both original values in a bounded merge-recovery archive and choose a deterministic active value; never silently discard the alternate value.

## Autosave and retry rules

- Maintain a monotonically increasing local dirty generation.
- Debounce frequent writes, but also enforce a maximum save delay.
- Permit only one remote write at a time. If data changes during a write, immediately schedule another flush after the acknowledgement.
- Persist a pending envelope (snapshot, expected revision, stable mutation ID, generation) before sending.
- Reuse the same mutation ID for retries of the same pending operation. On a confirmed revision conflict, fetch the returned current cloud snapshot, merge, then create a new mutation ID for the merged payload.
- Do not clear pending state or mark clean unless the RPC confirms the expected mutation/revision.
- On offline/page-hidden transitions, preserve pending data locally and flush/recover when online and visible.
- Realtime updates must use the same merge path; a dirty local snapshot must never be overwritten by a remote event.

## Safe local application

- Persist a bounded pre-merge backup containing local and cloud snapshots before changing learning keys.
- Validate merged snapshot and payload size before applying.
- Apply with rollback protection. If any localStorage write fails, restore the pre-merge state and retain the backup for recovery.
- Update sync metadata only after local application and remote acknowledgement are confirmed.

## Verification

Automated tests must cover: clean/equal snapshots; local-only/cloud-only changes; simultaneous independent progress; duplicate event IDs; legacy/no-baseline merge; mistakes/sessions/extras union; settings conflicts; unknown keys; malformed snapshots; payload bounds; active adaptive sessions on both devices; rapid consecutive edits during a pending write; stale revision conflicts; duplicate RPC retries; offline recovery; pagehide/visibility; failed localStorage writes and rollback.

Run the complete existing `npm test` suite plus new sync merge tests. Verify GitHub Actions and Vercel Preview. Browser-level iPhone/Safari and weak-network behavior must be reported as verified only if actually exercised.

## Architecture decision

Use schema-aware three-way merge in a small pure module (testable under Node) called by the existing sync coordinator. Keep the existing Supabase RPC and revision contract. Avoid schema changes until tests demonstrate a requirement that cannot be met client-side.
