# Mila Realtime and Static Asset Recovery Plan

> **For agentic workers:** Native implementation in this session. Tasks are test-first and independently verifiable.

**Goal:** Eliminate the avoidable favicon 404, ensure updated sync modules replace stale service-worker assets, and recover safely from transient Supabase Realtime subscription failures.

**Architecture:** Keep the static Vercel app and browser-side Supabase client. Add a small, dependency-free retry manager to `sync-core.mjs`; integrate it around the existing per-user Postgres Changes channel. Explicitly reference the existing SVG favicon and version all changed browser modules.

**Tech Stack:** Vanilla JavaScript ES modules, Node.js built-in test runner, Supabase JS 2.x, Vercel static deployment.

**Spec:** User-reported production errors on `mila-yaelnet-vocabulary.vercel.app`: generic resource 404 and Supabase Realtime WebSocket closing before connection establishment.

## Global Constraints

- Do not modify user learning data, database rows, RLS policies, API keys, or migrations.
- Preserve local-first learning and the existing RPC-based cloud synchronization.
- Keep a bounded reconnect backoff (1s initial, exponential, capped at 30s).
- A failed Realtime channel must be removed before a replacement is created.
- Pausing for sign-out/offline must cancel pending retries and prevent stale callbacks from reconnecting.

## Review Focus

- Missing default browser favicon request — test that the existing SVG is declared explicitly.
- Stale service-worker/module cache — test cache generation and synchronized query-string versions.
- Realtime handshake failure — test cleanup, backoff, retry, success reset, and stop cancellation.
- Offline/hidden tab during retry — do not reconnect until the app becomes eligible again.
- A late callback from a removed channel — ignore it by generation/channel identity.

---

### Task 1: Regression tests

**Files:**
- Create: `tests/realtime-recovery.test.cjs`
- Test: Node built-in test runner

- [ ] Add tests for the favicon link and module/cache version alignment.
- [ ] Add deterministic fake-timer tests for Realtime retry, removal, capped exponential backoff, success reset, and stop cancellation.
- [ ] Run `npm test`; verify the new tests fail for the missing behavior before implementation.

### Task 2: Realtime retry manager

**Files:**
- Modify: `sync-core.mjs`
- Modify: `sync.js`
- Test: `tests/realtime-recovery.test.cjs`

- [ ] Export `createRealtimeRetryManager({ createChannel, removeChannel, canConnect, onStatus, setTimeoutImpl, clearTimeoutImpl, baseDelayMs, maxDelayMs })`.
- [ ] Ensure only one active channel/retry timer exists; remove failed channels before retry; invalidate delayed callbacks on stop.
- [ ] Wire the manager to the existing `learning_state` subscription without changing the cloud-write path.
- [ ] Run `npm test` and verify the retry tests pass.

### Task 3: Static asset recovery

**Files:**
- Modify: `index.html`
- Modify: `sync.js`
- Modify: `static/sw.js`
- Modify: `tests/adaptive-engine.test.cjs`
- Test: `tests/realtime-recovery.test.cjs`

- [ ] Link `/static/icon.svg` as the document favicon.
- [ ] Bump the sync module imports to `sync.js?v=10` and `sync-core.mjs?v=7`.
- [ ] Bump the service-worker cache to `mila-yaelnet-v37` and precache both exact versioned module URLs.
- [ ] Update the cache-version regression assertion and run the complete `npm test` command.

### Task 4: Review and deployment verification

- [ ] Review the full diff and verify no DB or user-data changes are included.
- [ ] Open a PR to `main`; require GitHub Actions tests to pass.
- [ ] Verify the Vercel preview deployment is ready. Do not claim a live browser/WebSocket smoke test unless it is actually performed.
