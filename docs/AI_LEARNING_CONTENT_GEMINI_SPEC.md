# MILA — Gemini AI Learning Content & Safe Storage Specification

**Status:** Design specification only — not implemented  
**Date checked:** 2026-11-22  
**Target:** MILA YAELNET static PWA, current main baseline `72f94ae4620872cdabbc940449f0a02d03677054`

> **Production protection:** This document does not apply a Supabase migration, deploy an Edge Function, create or change secrets, alter Vercel, or change the production app. Implementation must happen in an isolated branch and pass the acceptance tests in this document before any production release.

## 1. Decision and non-negotiable boundary

Use the **Gemini Developer API free tier** as a provider for generating reusable learning material, subject to the eligibility/terms gate below. The selected initial model is `gemini-3.5-flash-lite`: Google currently lists it as a stable model optimized for translation and simple data processing, with free standard input/output tokens. Model, quota and availability must remain server-configurable because Google's free-tier model access and quotas can change.

Gemini is a **content authoring service only**. It may create a short Hebrew example, Arabic translation, usage explanation and a small set of collocations. It must never:
- grade a learner's answer or decide whether an answer is accepted;
- change the adaptive scheduler, retries, priorities, progress, mistakes or session analytics;
- receive a learner's entered answer, learning history, weak-word list, analytics, account details or authentication token;
- become a runtime dependency for starting or continuing a normal learning session.

The existing deterministic evaluator and adaptive engine remain the source of truth. Existing learning and sync behavior must continue unchanged when AI is disabled, unavailable, offline or quota-limited.

## 2. Mandatory Google terms and audience gate

The current Gemini API Additional Terms (effective 2026-03-23) state that API users must be at least 18, prohibit using the services in an application directed to or likely to be accessed by people under 18, and state that the services are for developers building with Google AI models for professional or business purposes, not consumer use.

The unpaid/free tier also allows Google to use submitted prompts and generated responses to provide, improve and develop Google products and machine-learning technologies. Human reviewers may read, annotate and process API inputs and outputs. The terms explicitly say not to submit sensitive, confidential or personal information to unpaid services.

**Release gate G-LEGAL (blocking):**
1. Before enabling the integration for any shared/public MILA audience, verify and document that the application and its likely audience satisfy the current Gemini Additional Terms. A simple checkbox or an age-gate is not a substitute if the app is in fact directed at or likely to be accessed by under-18 users.
2. The same terms also state that Gemini API is for developers building with Google AI models for **professional or business purposes, not consumer use**. Because MILA is currently a personal learning workspace, this is a separate eligibility question that the age-18 confirmation does not resolve. Confirm that the API client/use is genuinely within Google's professional/business scope. If it is a private consumer/personal-use app and Google's terms do not permit that use, **do not enable Gemini Developer API**. Keep the AI feature disabled and use curated/static content or select a provider/service whose terms permit the intended use.
3. Before first use, show a separate, explicit AI consent notice. Cloud-sync login is not consent to send content to Google. The notice must state that the feature sends only a canonical Hebrew vocabulary item and its Arabic gloss, and that free-tier prompts/responses may be used by Google and reviewed by humans.
4. Do not ask for or send a date of birth to Gemini. Do not send personal, sensitive, confidential or user-entered material.
5. Re-check the terms and available-region page before production enablement. Israel is currently listed as an available Gemini API / AI Studio country, but regional availability is not a data-residency guarantee.

Official references:
- Gemini API Additional Terms: https://ai.google.dev/gemini-api/terms
- Gemini API pricing and free-tier data-use disclosure: https://ai.google.dev/gemini-api/docs/pricing
- Gemini API available regions: https://ai.google.dev/gemini-api/docs/available-regions
- Structured output: https://ai.google.dev/gemini-api/docs/structured-output

## 3. Current MILA / Supabase baseline inspected

Read-only inspection found:
- Supabase project `mila-yaelnet` is `ACTIVE_HEALTHY`, PostgreSQL 17.11, region `ap-southeast-2`.
- The only table currently listed in `public` is `public.learning_state`. It is RLS-enabled and stores one revisioned snapshot per authenticated user.
- `learning_state` has a user-owned row keyed by `user_id`; current SELECT / INSERT / UPDATE policies constrain ownership using `auth.uid()`.
- Existing RPC: `public.sync_learning_state(p_state jsonb, p_expected_revision bigint, p_mutation_id uuid, p_device_id uuid, p_schema_version integer)`; inspected as **SECURITY INVOKER**. Preserve its signature and behavior.
- Two migrations are recorded in the live database: `20261114144743_create_private_learning_state_sync` and `20261114160330_harden_learning_state_rpc_with_invoker_rls`.
- No Edge Functions are currently deployed in this project.
- The browser sync client snapshots app localStorage keys and includes keys beginning with `mila-yaelnet-`. Therefore AI content must not be stored under that namespace or added to the snapshot.

**Do not modify** `learning_state`, `sync_learning_state`, its current RLS policies, sync revisioning, sync conflict resolution, or the existing user progress records for this feature.


### Migration-history reconciliation (blocking)

Read-only production inspection confirms that the live project records these migrations:
- `20261114144743_create_private_learning_state_sync`
- `20261114160330_harden_learning_state_rpc_with_invoker_rls`

The corresponding SQL migration files were not found in the current repository paths during this implementation review. Do not apply the new AI migration with Supabase CLI or through any database write workflow until the exact existing migration SQL has been recovered from the original source / Supabase history and committed in the repository. Then compare migration history, schema and policies against the live project and a fresh staging branch. Do not reconstruct or replace the old migrations by guesswork, and do not reset or repair the production migration history automatically.

## 4. Target architecture

```text
MILA PWA
  ├─ existing learning engine / local learning state (unchanged)
  ├─ explicit AI opt-in + authenticated session required for cache misses
  ├─ IndexedDB read-through cache (device-local, not cloud-sync data)
  └─ Supabase Edge Function: generate-learning-content
       ├─ verify Supabase user JWT; reject unauthenticated requests
       ├─ validate canonical vocabulary entry against server-side manifest
       ├─ read shared Supabase content cache
       ├─ atomically reserve per-user/global generation quota + cache lease
       ├─ call Gemini with minimal fixed prompt and strict JSON schema
       ├─ validate and normalize output
       └─ write only validated content to the dedicated AI cache
              └─ Gemini Developer API (key held only in Edge Function secrets)
```

### Data sent to Gemini

Only these fields for a single approved catalogue entry:
- the canonical Hebrew headword;
- its canonical Arabic gloss;
- a fixed, versioned instruction describing the educational output required.

The request must **not** include word performance, correctness history, review timing, session state, user notes, free-text answers, names, email, user ID, device ID, JWT, IP address, sync snapshot or any other account-linked data. Do not use Google Search grounding, file upload, audio/image input or conversation history for this workflow.

The Edge Function must resolve and verify the pair against a versioned server-side manifest derived from MILA's official and academic vocabulary sources. It must not blindly trust arbitrary `he` / `ar` text from a browser. User-added/custom vocabulary is excluded from V1; do not put private custom words in the shared cache.

### Edge Function security

- One POST endpoint only; reject unsupported methods, oversized bodies and unknown fields.
- Keep platform JWT verification enabled. Require a valid signed-in Supabase user for cache misses and generation. If the learner is signed out, show cached device content if present and otherwise continue without AI.
- Validate the user token before any privileged database operation. Do not trust user-editable metadata as an authorization claim.
- Keep `GEMINI_API_KEY` in Supabase Function Secrets. Keep any database administrative credential exclusively server-side. Neither key may appear in Git, Vercel public/client environment variables, `sync-config.js`, browser bundles, HTML, logs or API responses.
- Use the least-privilege database access practical for this function. If a server-side elevated Supabase key is required, it must be used only inside this one function, with fixed table/RPC operations and no user-controlled table names, SQL or schema names.
- Restrict CORS to the exact MILA origins required for development/staging/production. Do not use wildcard CORS with credentialed requests.
- Apply per-user and project-wide quotas in the database, not in in-memory Edge Function state (instances are distributed and may restart).
- Use atomic cache-claim/lease logic so concurrent misses for the same word do not trigger duplicate Gemini calls. Expire abandoned leases and allow bounded retry.
- Never log request bodies, prompt text, generated content, authorization headers, API keys or personal identifiers. Log only request ID, status category, cache hit/miss, model name, latency and non-identifying operational counts.
- Return stable error codes and safe messages. Never return Gemini raw error payloads or secrets to the browser.

## 5. Shared server cache and local offline cache

### Supabase shared cache

Create a new, dedicated table for reusable generated content. This table must be independent from `learning_state` and must not be included in the existing snapshot RPC.

Proposed table: `public.ai_learning_content`

| Column | Purpose |
|---|---|
| `id` | UUID primary key |
| `catalog_version` | Version/hash of the source vocabulary corpus |
| `word_id` | Stable ID from the approved corpus |
| `word_fingerprint` | SHA-256 of normalized Hebrew + Arabic pair; protects against a reused ID with changed text |
| `content_schema_version` | Version of the JSON payload contract |
| `prompt_version` | Version of the generation instruction |
| `model_name` | Model identifier used to generate the content |
| `payload` | Validated JSONB learning content only |
| `status` | `pending`, `ready`, `reported` or `rejected` |
| `lease_until` | Expiration for a pending generation claim |
| `attempt_count` | Bounded generation attempts for this cache key |
| `generated_at`, `updated_at` | Audit timestamps |

Use a unique cache key across `catalog_version`, `word_id`, `word_fingerprint`, `content_schema_version` and `prompt_version`. A changed vocabulary pair, prompt or payload contract must produce a cache miss rather than silently reusing stale content.

The table contains **shared, non-user-specific learning content**. It must not have user progress, account, device or session fields. Enable RLS. Revoke direct INSERT / UPDATE / DELETE from `anon` and `authenticated`; do not create client write policies. The Edge Function is the only writer. Prefer a non-exposed schema or tightly restricted server-side access if the selected Edge Function/database access pattern supports it without introducing broad privileges.

Use an atomic database claim operation (transaction/RPC) restricted to the server-side worker to:
1. return an existing `ready` cache entry;
2. create or take over an expired `pending` lease for a cache miss;
3. tell concurrent callers that generation is already in progress;
4. write `ready` only after validation succeeds;
5. release or expire the lease on timeout/failure.

Do not use a publicly callable `SECURITY DEFINER` function as a shortcut. Prefer invoker rights. If a definer function is proven necessary, put it in a non-exposed schema, explicitly revoke execution from `PUBLIC`, `anon` and `authenticated`, grant only the intended server role, and add an explicit authorization guard.

### Usage / abuse-control table

Create a separate `public.ai_generation_usage` table containing only:
- `user_id` (FK to `auth.users`, cascade on account deletion),
- UTC usage date,
- generation-attempt count,
- timestamps.

Unique key: `(user_id, usage_date)`. No prompt, word answer, content, IP address, email or history is stored here. Retain only a short rolling period (initial target 30 days) and delete old counters periodically. RLS enabled; no client policies or direct client grants. Update quota atomically from the Edge Function.

Initial app-level safety defaults (configurable, not Google's published quota): at most 10 uncached generation attempts per account per UTC day, at most 2 generation attempts per minute per account, one active generation per cache key, plus a conservative project-wide daily ceiling. Cache hits do not consume a generation allowance. Return HTTP 429 with a bounded retry hint when a cap is reached. Never spin automatic client retries on 429/503.

### Browser cache

Use IndexedDB with a distinct database name such as `mila-ai-content-v1`. Do not add AI payloads to localStorage keys beginning with `mila-yaelnet-`, because the existing snapshot sync currently includes that namespace. Do not change the snapshot filter to include the AI cache.

Use read-through behavior:
1. check IndexedDB;
2. request the Edge Function when online, consented, eligible and signed in;
3. persist validated response in IndexedDB;
4. on offline/network/quota/provider failure, render any cached item or fall back to the current card.

IndexedDB is device-local and does not sync in V1. When online, the client rechecks the account-level consent state before displaying locally cached content. When offline, it may display only content already cached on that device while its local consent remains active; server-side revocation cannot be observed until the device reconnects. Server cache is the shared source for newly generated content. Do not store API keys or authorization tokens in IndexedDB.

## 6. Generated payload contract

Start with compact, text-only material. For example:

```json
{
  "definition_ar": "شرح عربي موجز ودقيق للمعنى المقصود",
  "example_he": "משפט קצר וטבעי בעברית.",
  "example_ar": "ترجمة عربية طبيعية للجملة.",
  "usage_note_ar": "ملاحظة قصيرة تشرح السياق أو الاستعمال.",
  "collocations": [
    { "he": "צירוף נפוץ", "ar": "ترجمة التركيب" }
  ]
}
```

Requirements:
- Request `application/json` with Gemini `responseSchema`; do not depend on free-form text or markdown parsing.
- Validate the output again on the server. Enforce required fields, types, allowed array size, maximum string lengths, no HTML, no control characters and no unexpected properties.
- Require Hebrew text for Hebrew fields and Arabic text for Arabic fields; reject empty or mismatched fields.
- Set a small output-token ceiling and fixed generation parameters. Do not use tools/grounding.
- Store only normalized validated fields and essential model/version metadata; never store the raw provider response, prompt or provider diagnostic payload.
- Mark output as **AI-generated** in the UI. It is not automatically linguistically verified. Provide a report action and prevent reported/rejected content from being served as ready.
- Do not inject model strings as HTML. Render with text nodes / `textContent`; never trust model output for markup, attributes, URLs, code or event handlers.
- Do not add generated translations or synonyms to the canonical answer-alias list. Generated content must never expand what the deterministic evaluator accepts.
- Use browser Speech Synthesis for optional pronunciation rather than uploading learner audio or synthesizing/storing audio in V1.

## 7. Frontend experience and consent

- The AI feature is optional and off by default until the legal gate and explicit opt-in are satisfied. The Edge Function must require an active account-level consent record for generation and cached-content requests; a client-side localStorage flag alone is not sufficient.
- Consent is separate from account sign-in and cloud sync. Explain the unpaid-tier data use before the first request; allow disabling the feature at any time. Persist only the consent version and acceptance/revocation timestamps in a dedicated account-level table so the Edge Function can reject generation after revocation from any device. This consent ledger never leaves Supabase and is never sent to Google.
- Do not persist the consent toggle in the main learning snapshot. Use a separate, clearly named local preference or account setting only after its privacy implications are reviewed.
- Show a clear loading state, a retry action after transient failure, and an unobtrusive “AI content unavailable” fallback.
- Do not block typing, question submission, next-word navigation, session restoration or offline training while content is loading.
- Do not make the learner wait for AI before the first question. Start the learning session immediately and load optional content asynchronously.
- Expose the generated example and context in the vocabulary card; keep the current answer and feedback controls visually primary.
- When consent is off, the age/terms gate fails, the user is signed out, or no connectivity exists, the app must use current non-AI content only.

## 8. Test and release gates

The existing main baseline at the time of this specification is 34 passing CI tests. Preserve every existing test. Implementation is not complete until all relevant new tests pass.

### Unit / contract tests
- Server manifest accepts only exact official/academic word ID + canonical pair + catalog version; custom vocabulary and altered pairs are rejected.
- Gemini request contains only the canonical Hebrew term, Arabic gloss and fixed instructions; it contains no user answer/history/identity/session details.
- JSON schema, Hebrew/Arabic language checks, field-size limits, unexpected keys, HTML payloads and malformed responses are rejected.
- Provider 429, 503, timeout, malformed JSON and empty response return safe error codes without writing a ready cache record.
- Invalid/missing JWT returns 401; signed-in request passes the user identity obtained from verified auth, not user-supplied fields.
- Quota reservation is atomic under concurrent requests; rate limits cannot be bypassed by parallel Edge Function instances.
- Two simultaneous misses for the same cache key result in one active Gemini call; later requests use the shared cache.
- Cache hit does not call Gemini or consume generation quota.
- Reported/rejected content is not served.

### Integration / regression tests
- Existing `npm test` suite remains green (do not reduce or skip existing tests).
- AI failure does not stop existing adaptive sessions, typed answers, retry queue, progress updates, analytics or persistence.
- New IndexedDB data does not enter `mila-yaelnet-*` localStorage snapshots or cause sync revision/conflict changes.
- No write/read changes to `learning_state` or `sync_learning_state` are needed for AI content.
- Offline reload still opens the app and uses locally cached AI material or the current non-AI card.
- Test responsive card rendering on desktop and iPhone-sized viewports, keyboard navigation and accessible loading/error announcements.
- Verify no Gemini key or Supabase privileged key appears in Git history, browser source, page source, network request payloads or client environment.
- Verify logs never contain prompt/output/token/JWT/API key or personal identifiers.

### Staging / production gates
1. Implement in a dedicated Git branch with new migration and Edge Function files; do not change the deployed Supabase project.
2. Apply migrations only to a separate Supabase development branch/project and inspect RLS, grants and Advisors there.
3. Deploy the Edge Function to staging only; add the Gemini secret through the Supabase secrets UI/CLI, never in chat or Git.
4. Run the full unit, integration, browser, offline/PWA, quota, concurrency and security tests.
5. Inspect the PR diff and live staging behavior. Confirm the legal/audience gate in writing.
6. Only after these checks, prepare a separate production rollout plan. Production migration, secrets, function deployment and Vercel deployment each require an explicit release approval. A passing test suite alone is not permission to deploy.

## 9. Not in V1

- Custom/user-created vocabulary sent to Gemini.
- User answer evaluation or personalized AI feedback using attempt history.
- Chatbot conversations, live voice, audio uploads, generated audio files, image input, web search grounding, file uploads or vector search.
- AI-generated mastery scores, spaced-repetition intervals or answer aliases.
- Automatic translation of the entire 1,400+ word catalogue. Generate on demand and reuse shared cache entries.

## 10. References and operational notes

- Supabase project inspection on 2026-11-22 was read-only. No schema, data, policy, function, secret, branch or production setting was changed.
- Supabase Security guidance: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase Edge Function auth guidance: https://supabase.com/docs/guides/functions/auth
- Supabase API key guidance: https://supabase.com/docs/guides/getting-started/api-keys
- Google states Gemini Developer API model access is global; an available country does not guarantee regional data residency: https://firebase.google.com/docs/ai-logic/locations

**Implementation status (branch only):** schema, Edge Function, client card, IndexedDB cache and automated contract tests have been added to the unmerged implementation PR. No migration has been applied and no Edge Function deployed. Production activation remains blocked on the service eligibility gate, a separate staging database, a Gemini API secret and browser/integration testing.
