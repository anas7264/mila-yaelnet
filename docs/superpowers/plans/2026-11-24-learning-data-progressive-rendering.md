# Learning Data and Progressive Rendering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify the vocabulary index, durably record every learning answer locally and in Supabase after session completion, and progressively render long lists without blocking the UI.

**Architecture:** Keep `YaelWordIndex` as the canonical catalog and expose it to the adaptive trainer through a narrow bridge. Add a durable append-only local answer journal and a dedicated RLS-protected Supabase event table, uploaded in idempotent batches only at session boundaries. Add a reusable IntersectionObserver-based 20-item progressive renderer for the library and other audited heavy lists.

**Tech Stack:** Vanilla JavaScript, browser localStorage, Supabase JS v2, PostgreSQL migrations, Node built-in test runner.

**Spec:** `docs/superpowers/specs/2026-11-24-learning-data-deferred-sync-progressive-rendering-design.md`

## Global Constraints

- Never delete or rewrite existing `learning_state` or `private.learning_mutations` records.
- Persist every accepted answer locally before advancing the question; no network request in the answer-submission path.
- Upload answer events only after session completion/end; retain all unacknowledged events locally.
- Use unique event IDs and idempotent server insertion; no duplicate cloud events on retries.
- RLS must scope inserts and reads to `auth.uid()`; no client update/delete policy on the append-only event table.
- Keep the existing vanilla-JS architecture and do not add dependencies.
- Keep the existing learning progress and snapshot sync behavior compatible.
- Progressive rendering starts at 20 items and adds 20 at a time; clean up observers on navigation.
- Preserve PWA/offline behavior and bump affected cache-busting references.

## Review Focus

- Storage quota failure while writing a new event: do not advance the question or lose earlier queued events.
- User changes account while unsynced events exist: never upload them under another account.
- A session is abandoned, resumed, or finished twice: event batches remain complete and idempotent.
- A typed answer contains markup-like characters or long input: store bounded text safely and render escaped.
- Search/filter changes while the sentinel is intersecting: do not append stale or duplicate rows.
- IntersectionObserver is unavailable or the user uses keyboard navigation: provide a usable load-more fallback.
- Existing expanded/extra word ID collisions: deterministic merge without dropping distinct meanings.

---

### Task 1: Make the word index canonical for adaptive training

**Files:**
- Modify: `static/app.js`
- Modify: `static/adaptive-ui.js`
- Modify: `static/word-index.js` only if a shared bridge or safe invalidation API is required
- Modify: `tests/adaptive-vocabulary-refresh.test.cjs`
- Modify: `tests/word-index.test.cjs`

**Interfaces:**
- Produces: a main-app bridge exposing the canonical word array/map and a refresh operation to the adaptive UI.
- Consumes: existing `YaelWordIndex.create({ officialWords, getExtras, mergeExpanded })`.

- [ ] Add regression tests proving main and adaptive consumers receive identical IDs, including user-added and expanded words.
- [ ] Run the focused tests and confirm they fail because adaptive training still builds a separate vocabulary.
- [ ] Replace adaptive `collectWords()` source aggregation with the shared canonical bridge; retain legacy academic ID migration only where still required and test it.
- [ ] Verify index invalidation after successful add/edit/delete operations refreshes adaptive state without losing the current session or progress.
- [ ] Run focused vocabulary tests and the full `npm test` suite.

### Task 2: Add a durable local answer-event journal

**Files:**
- Modify: `static/storage.js`
- Modify: `static/app.js`
- Modify: `static/adaptive-ui.js`
- Modify: `static/adaptive-engine.js` only if answer grading data needs a narrow exposed interface
- Create: `static/answer-journal.js` if separation from general storage is justified by tests
- Modify: `index.html`
- Create/modify tests: `tests/learning-events.test.cjs`, `tests/answer-persistence.test.cjs`, plus focused journal tests

**Interfaces:**
- Produces: `appendAnswerEvent(event, storage)`, `listPendingAnswerEvents(storage, options)`, and `acknowledgeAnswerEvents(eventIds, storage)`.
- Event shape: `{ eventId, sessionId, occurredAt, mode, direction, eventType, wordId, prompt, choices, correctAnswer, selectedAnswer, typedAnswer, isCorrect, timedOut, selfRating }`.
- `selfRating` is one of `again | hard | good | easy`; card ratings are not coerced into boolean correctness.

- [ ] Write tests for append-only behavior, stable UUID deduplication, bounded payload validation, retrieval, acknowledgement, reload persistence, and storage quota failure.
- [ ] Run tests and verify they fail before implementation.
- [ ] Implement a separate journal storage key; do not apply the old 2,048-event truncation limit to the new journal.
- [ ] Instrument every answer path (choice, typed, timeout, matching, adaptive answer, and card self-rating) to append the event before the UI advances.
- [ ] Keep current aggregate progress/mistake updates unchanged for compatibility.
- [ ] Run focused tests and the full `npm test` suite.

### Task 3: Add Supabase event storage and session-boundary synchronization

**Files:**
- Create: `supabase/migrations/<timestamp>_create_learning_answer_events.sql`
- Modify: `sync.js`
- Modify: `sync-core.mjs` or create `answer-sync-core.mjs` if pure queue/batch logic merits isolation
- Modify: `index.html` for versioned module references
- Create: `tests/answer-sync.test.cjs`
- Create/modify: SQL migration verification tests or repository's existing migration test pattern

**Interfaces:**
- Produces: a flush operation that accepts a completed session ID, authenticated user ID, and batch size; returns acknowledged event IDs only after successful upsert.
- Consumes: Task 2 journal methods.
- Table: `public.learning_answer_events`, unique `event_id`, `user_id`, `session_id`, `occurred_at`, `event_type`, `payload jsonb`, `created_at`.

- [ ] Write tests that prove no upload is requested during an active session, completion triggers a bounded upload, errors leave events pending, retries do not duplicate events, and account changes prevent cross-account upload.
- [ ] Run tests and verify the expected failures.
- [ ] Add migration with RLS enabled, authenticated-only insert/select policies using `auth.uid()`, no update/delete policies, indexes for user/session/time, and explicit grants only after checking Data API exposure.
- [ ] Implement batched idempotent upload using the authenticated Supabase client and `event_id` conflict handling.
- [ ] Acknowledge only IDs included in a successful response; preserve unsynced IDs and local journal rows.
- [ ] Trigger event upload only from session completion/explicit end, after local session state is persisted; use non-blocking background work.
- [ ] Verify schema, RLS policies, grants, indexes, and sample authenticated/unauthenticated behavior in Supabase; run security/performance advisors.
- [ ] Run the full `npm test` suite.

### Task 4: Progressive rendering for the library and audited heavy pages

**Files:**
- Create: `static/progressive-list.js`
- Modify: `static/app.js`
- Modify: `static/style.css`
- Modify: `index.html`
- Modify: `static/sw.js`
- Modify tests: `tests/progressive-list.test.cjs`, plus library rendering tests

**Interfaces:**
- Produces: a reusable progressive-list controller that accepts a container, item array, renderer, initial batch size (20), batch size (20), and lifecycle cleanup.
- Consumes: filtered/sorted arrays from existing page logic; does not alter the underlying word catalog or quiz question selection.

- [ ] Write tests for initial 20, next 20 on demand, no duplicate append, filter reset, end state, observer cleanup, and manual fallback.
- [ ] Run tests and verify they fail before implementation.
- [ ] Implement IntersectionObserver sentinel loading with a bounded root margin and explicit cleanup.
- [ ] Integrate the library without changing search/filter semantics; reset to 20 on query/filter changes.
- [ ] Audit other page renderers for large repeated DOM collections and apply the controller only where initial DOM size is materially high.
- [ ] Verify keyboard/accessibility fallback, empty results, and mobile scrolling.
- [ ] Update static asset cache versions and run the full `npm test` suite.

### Task 5: Final integration verification

**Files:** all changed files and tests from Tasks 1–4.

- [ ] Inspect the complete diff for data loss, account isolation, stale observer callbacks, and unexpected eager sync.
- [ ] Run the full `npm test` command from `package.json`.
- [ ] Run Supabase security, performance, and health advisors; resolve new critical/important findings.
- [ ] Confirm production build/deployment preview behavior without promoting to production.
- [ ] Request a fresh code review before merge; do not merge or deploy until review findings are resolved and the user authorizes production release.
