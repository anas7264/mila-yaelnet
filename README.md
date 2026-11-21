# Mila — Adaptive Vocabulary Preview

This branch contains an isolated P0 adaptive-recall mode built on the recovered browser application assets.

## What is included
- The existing Hebrew/Arabic learning UI and its existing vocabulary assets.
- A new opt-in-by-navigation adaptive recall screen for Hebrew → Arabic and Arabic → Hebrew.
- A separate versioned state key: `mila-yaelnet-adaptive-v1`.
- Independent direction-specific memory records.
- A bounded short-term retry queue (2–4 intervening questions; at most 3 retries per word in a cycle).
- Session persistence and duplicate-submission protection.
- Reuse of the existing Supabase snapshot synchronizer. The existing synchronizer includes keys beginning with `mila-yaelnet-`; no competing sync client or database migration is introduced.

## Important scope boundary
This is a **static Preview build** of the recovered client. The complete Flask entry point was not recoverable from the available deployment source endpoint, so this branch does not recreate or replace that backend. The preview serves the existing client assets statically and preserves the existing Supabase client-side synchronization path. Production remains untouched.

## Content quality
The current 377 academic terms are included from the deployed content set. They have not all undergone independent linguistic/editorial validation. The adaptive evaluator accepts exact normalized forms and explicitly listed slash/comma aliases only; it does not guess morphology, synonyms, or typo corrections.

## Scheduling
The P0 short-term queue is not FSRS. The legacy app scheduler remains unchanged. FSRS, contextual prompts, written production, validated morphology, and advanced analytics are deferred.

## Local checks
`npm test` runs the deterministic adaptive-engine tests with Node's built-in test runner.
