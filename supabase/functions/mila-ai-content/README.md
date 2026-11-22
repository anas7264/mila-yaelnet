# mila-ai-content Edge Function

This function is staged source code only. It is not deployed by committing this file.

## Required environment

Supabase Edge Function runtime provides the project URL and the configured Supabase auth/API keys. The function additionally requires:

- `GEMINI_API_KEY`: Google AI Studio API key. Store it as a Supabase Function Secret; never commit it or send it in chat.
- `GEMINI_MODEL`: optional; defaults to `gemini-3.5-flash-lite`.
- `MILA_ALLOWED_ORIGINS`: comma-separated exact origins, for example `https://mila.example`. Include only the production domain and explicitly controlled staging/local origins. No wildcard.

Example command (run only against an approved staging Supabase project):

```bash
supabase secrets set GEMINI_API_KEY=YOUR_KEY --project-ref YOUR_STAGING_REF
supabase secrets set GEMINI_MODEL=gemini-3.5-flash-lite --project-ref YOUR_STAGING_REF
supabase secrets set MILA_ALLOWED_ORIGINS=https://YOUR_STAGING_HOST --project-ref YOUR_STAGING_REF
```

Do not put the secret value in source control, Vercel client environment variables, the browser, HTML, logs, or a support ticket. The Gemini API key must remain on this function only.

## Deploy / migration order

1. Confirm the Google terms eligibility gate in `docs/AI_LEARNING_CONTENT_GEMINI_SPEC.md`.
2. Use a separate Supabase development branch or project. Do not run the migration against the production project during development.
3. Apply `supabase/migrations/20261122090650_add_ai_learning_content_cache.sql` to that staging database.
4. Inspect the resulting tables, grants, RLS and Security Advisor output.
5. Configure the secrets above in the staging project.
6. Deploy only this function to staging, using the project config where `verify_jwt = true`.
7. Exercise auth rejection, quota limits, concurrent claims, cache hits, reports and provider failures.
8. Only after browser/offline/mobile checks pass should a separate production release be proposed.

## Request contract

POST JSON body:

```json
{ "wordId": "academic-001", "action": "generate" }
```

or:

```json
{ "wordId": "academic-001", "action": "report" }
```

The browser supplies no Hebrew/Arabic text. The function resolves the ID from the committed server-side manifest and sends only the canonical Hebrew headword, Arabic gloss, and fixed prompt to Gemini.

## Safety defaults

- Requires an authenticated Supabase user (JWT verification plus a server-side Auth user lookup).
- Only IDs in the committed vocabulary manifest are accepted; custom words are not accepted.
- No prompt, response, answer history, email or personal text is logged.
- Database API calls use a server-only credential. Browser users have no direct table grants.
- Daily and per-minute user caps plus a project-wide daily cap are enforced in a transaction.
- Client feature flag remains false until the release gate is passed.
