# Mila — YAELNET Learning Studio

Mila is a browser-based Hebrew vocabulary and YAELNET learning workspace. The current release is served as a static Vercel application; learning progress and account synchronization remain client-side and use the existing Supabase project.

## Current release

- Main vocabulary workspace with stages, custom vocabulary, review, analytics, and settings.
- 377 former academic terms moved into five official learning stages (general academic vocabulary, mathematics and physics, electrical engineering, computing, and academic verbs/adjectives). 357 unique entries become stage words; entries already present in earlier stages or duplicated within the academic set are merged into their existing canonical word.
- 1,050 supplied vocabulary entries across 21 thematic groups, integrated into the main library, custom practice, typed answers, and adaptive recall. Repeated Hebrew headwords are consolidated into one trainable entry while their topic tags and distinct glosses are retained.
- 1,250 additional unique Hebrew headwords arranged in 10 progressive learning stages (from daily vocabulary to advanced reading and analytical expressions). The new stages are part of the official stage path, independent stage quizzes, progress, mistakes, review, and adaptive practice.
- Adaptive active recall in both directions: Hebrew → Arabic and Arabic → Hebrew.
- Direction-specific adaptive scheduling and short-term retry queue (2–4 intervening questions, at most 3 retries per word per cycle).
- Resumable adaptive sessions with duplicate/stale answer protection.
- Adaptive answers update the canonical learning progress, daily goal, general review/mistakes, and session analytics across every stage, including the former academic vocabulary.
- The one-time academic-progress migration maps old academic IDs to canonical stage-word IDs, merges overlapping counters without double-counting shared adaptive answers, and records a migration marker in the main store. The original academic storage key is retained.

## Data and synchronization

The browser uses these local storage namespaces:

- `mila-yaelnet-studio-v3` — canonical progress, mistakes, daily goal, sessions, settings, and adaptive idempotency ledger.
- `mila-yaelnet-academic-v1` — retained as a read-only legacy source until its progress has been migrated into the main stage progress store. It is not deleted, so the original academic records remain recoverable.
- `mila-yaelnet-adaptive-v1` — direction-specific adaptive scheduling and resumable queue.

The existing Supabase snapshot synchronizer includes all keys beginning with `mila-yaelnet-`. It uses the existing `public.learning_state` table and `sync_learning_state` RPC. No competing sync client, schema migration, RLS change, or database write is introduced by this release.

The Supabase publishable key in `sync-config.js` is a browser key; never put a service-role key or other secret in client files.

## Hosting

The current Vercel release is static:

- `index.html` is the application entry point.
- `vercel.json` maps `/manifest`, `/sw.js`, and `/health` to their static assets.
- Browser-side synchronization connects directly to Supabase.
- No Flask runtime or server-side API is required by the current client.

The earlier Flask deployment wrapper served the browser assets. The current release replaces that serving layer with Vercel static hosting; it does not modify the Supabase data model.

## Content and limitations

The 377 former academic terms are represented in five official stages. After normalized deduplication, 357 unique academic headwords are added as stage words; overlapping entries preserve their additional Arabic gloss and group metadata on the existing canonical word. The additional 1,050 entries remain organized into 21 thematic groups. Neither collection has undergone a complete independent linguistic/editorial review. The adaptive evaluator accepts normalized exact forms and explicitly listed aliases; it does not infer morphology, synonyms, or typo corrections.

The adaptive scheduler is a bounded P0 short-term scheduler, not FSRS. Contextual prompts, written production, validated morphology, and advanced analytics remain outside this release.

## Verification

Run:

```bash
npm test
```

The suite uses Node's built-in test runner and checks adaptive scheduling, persistence, bridge idempotency, academic progress, synchronization namespace inclusion, PWA assets, and static route rewrites.
