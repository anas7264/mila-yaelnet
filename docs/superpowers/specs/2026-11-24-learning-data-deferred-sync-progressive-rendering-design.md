# Learning Data, Deferred Sync, and Progressive Rendering Design

## Intent

Make the vocabulary experience use one canonical word index, preserve every learning answer for durable analysis, defer Supabase writes until a learning session ends, and prevent long pages from rendering all rows at once. The objective is reliable learning analytics without harming interaction latency or existing user data.

## Goals

- Use `YaelWordIndex` as the sole vocabulary source for the main app and adaptive trainer, including official, expanded, and user-added words.
- Record each submitted answer locally immediately, including incorrect attempts, repeated attempts where the UI permits them, typed input, selected choice, timeout, and card self-rating.
- Keep answer events append-only and separate from the bounded 2,048-event legacy summary in `learningEvents`.
- Upload queued answer events to a dedicated Supabase table only after a learning session completes or is explicitly ended, in small non-blocking batches.
- Keep unsent events durable locally across refreshes, tab closes, offline periods, and account changes.
- Make retries idempotent and scope all cloud rows to the authenticated user with RLS.
- Render the first 20 library items, then append further chunks of 20 as the user approaches the end of the list.
- Reuse a measured progressive-rendering primitive on other genuinely heavy list/table pages.

## Non-goals

- Do not replace or delete `learning_state`, `private.learning_mutations`, or any existing user learning data.
- Do not change the existing snapshot sync protocol except where needed to ensure answer-event uploads happen after session completion.
- Do not upload every answer while the user is in an active test.
- Do not paginate the static vocabulary source itself or change question generation semantics.
- Do not apply progressive rendering to short pages where it adds complexity without measurable benefit.

## Approaches considered

1. **Keep duplicate vocabulary collectors and reconcile them periodically.** Rejected because the two sources can drift again and create different training/library inventories.
2. **Make the main app's `YaelWordIndex` canonical and expose a refreshable shared bridge to adaptive training.** Chosen because the project already has this abstraction and it avoids a second index or dependency.
3. **Upload each answer immediately.** Rejected because it creates network work during tests and conflicts with the requested session-boundary sync.
4. **Append local answer events, then upload after session completion in idempotent batches.** Chosen because local durability is immediate and network work is deferred.
5. **Render all library words and rely on browser optimizations.** Rejected because it retains the long main-thread/DOM task.
6. **Client-side chunked rendering with an IntersectionObserver sentinel.** Chosen for the static local-first catalog; a reusable renderer will append 20 items at a time and be applied to other measured heavy lists.

## Architecture

### Canonical vocabulary
- `YaelWordIndex` owns the canonical list and ID map.
- The adaptive UI obtains the canonical list through a narrow bridge registered by the main app; it no longer reads catalog, extras, and expanded vocabulary independently.
- Extra-word changes invalidate the shared index and refresh the adaptive consumer only after local persistence succeeds.
- Preserve existing IDs and merge rules; do not silently discard words with different meanings. Collision handling must be deterministic and tested.

### Answer event journal
- Add a separate local append-only event journal with UUID event IDs and a session ID.
- Event payload captures event type/mode/direction, canonical word ID, a snapshot of the prompt/choices/correct answer, selected or typed answer, correctness or self-rating, timeout, and timestamps.
- Keep raw typed input only for the learning answer itself; exclude credentials, auth tokens, and unrelated free-form data.
- Keep existing aggregate progress updates for current UI compatibility.
- Journal storage must not be truncated at 2,048 entries. Use a dedicated storage key/structure with safe size handling and preserve queued events on quota errors.

### Deferred cloud synchronization
- Add a dedicated `public.learning_answer_events` table with unique `event_id`, `user_id`, `session_id`, event timestamp, event type, and structured JSON payload.
- Enable RLS; authenticated users may insert and read only rows whose `user_id = auth.uid()`. No anonymous access and no update/delete policy for append-only semantics.
- Explicitly grant only required Data API privileges after verifying the project's Data API exposure settings.
- Flush queued events only after a session completion/end boundary. Use bounded batches and `upsert(..., { onConflict: 'event_id', ignoreDuplicates: true })` or equivalent idempotent insertion. Acknowledged IDs are removed from the local pending queue only after the server confirms success.
- Existing `learning_state` sync remains intact and must not overwrite or delete the event journal.

### Progressive rendering
- Library initial render displays 20 records.
- An IntersectionObserver sentinel with a modest root margin requests the next 20 only when the user approaches the list end.
- Search/filter changes reset the visible count; appending must not rebuild or duplicate previously rendered rows.
- Disconnect observers on view changes and rebind after rendering; provide a manual "load more" fallback for unsupported observers.
- Audit other large pages and use the same primitive only where item counts/DOM cost justify it.

## Constraints

- Preserve existing PWA, local-first, offline, and account-isolation behavior.
- No destructive database operations, reset, or user-data migration that rewrites existing learning state.
- No network request in the answer submission critical path.
- No unbounded DOM insertion; maintain keyboard accessibility and correct empty/end states.
- Use the project's existing vanilla JavaScript and Node test conventions; do not add a framework or dependency for this work.
- Bump service-worker cache/version references for changed static assets.
- Run the full `npm test` suite and Supabase security/performance advisors before requesting merge.

## Acceptance criteria

- Main library and adaptive trainer return the same canonical word IDs and include user-added words.
- Every accepted answer event survives reload and is queued locally before the UI advances.
- No answer-event network request occurs during an active session.
- Session completion triggers background upload; failed uploads remain queued and retry without duplicate cloud rows.
- RLS prevents cross-user reads/inserts and the table is append-only to clients.
- The first 20 library entries render initially; scrolling loads the next 20 without rendering the remainder up front.
- Other pages selected for progressive rendering demonstrate reduced initial DOM count and do not regress navigation, search, filters, or accessibility.
- Existing tests and user learning data remain intact.
