import wordCatalog from "../_shared/word-catalog.json" with { type: "json" };
import {
  CONTENT_SCHEMA_VERSION,
  DEFAULT_MODEL,
  PROMPT_VERSION,
  RESPONSE_SCHEMA,
  buildCacheKey,
  buildPrompt,
  normalizeLexeme,
  validateGeneratedContent
} from "../_shared/ai-content.mjs";

type CatalogEntry = { he: string; ar: string; source: string };
type Catalog = { catalogVersion: string; words: Record<string, CatalogEntry> };
const catalog = wordCatalog as Catalog;

const FUNCTION_NAME = "mila-ai-content";
const MAX_BODY_BYTES = 1024;
const USER_DAILY_LIMIT = 10;
const USER_PER_MINUTE_LIMIT = 2;
const PROJECT_DAILY_LIMIT = 500;
const CONSENT_VERSION = "gemini-free-v1-2026-11-22";
const GEMINI_TIMEOUT_MS = 20_000;

const json = (body: unknown, status = 200, headers: HeadersInit = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...headers
    }
  });

function parseKeyMap(raw: string | undefined): Record<string, string> {
  if (!raw) return {};
  try {
    const value = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.fromEntries(
      Object.entries(value).filter(([key, item]) =>
        typeof key === "string" && typeof item === "string" && item.length > 0
      )
    );
  } catch {
    return {};
  }
}

const env = {
  supabaseUrl: Deno.env.get("SUPABASE_URL")?.replace(/\/+$/u, "") ?? "",
  publishableKey: Deno.env.get("SUPABASE_ANON_KEY") ??
    parseKeyMap(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS")).default ?? "",
  serviceRoleKey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  geminiApiKey: Deno.env.get("GEMINI_API_KEY") ?? "",
  model: Deno.env.get("GEMINI_MODEL") ?? DEFAULT_MODEL,
  allowedOrigins: new Set(
    (Deno.env.get("MILA_ALLOWED_ORIGINS") ?? "")
      .split(",").map(value => value.trim()).filter(Boolean)
  )
};

function corsHeaders(origin: string | null): Record<string, string> | null {
  if (!origin) return {};
  if (!env.allowedOrigins.has(origin)) return null;
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Max-Age": "600",
    "Vary": "Origin"
  };
}

function serviceHeaders(extra: Record<string, string> = {}): HeadersInit {
  return {
    "apikey": env.serviceRoleKey,
    "Authorization": `Bearer ${env.serviceRoleKey}`,
    "Content-Type": "application/json",
    ...extra
  };
}

async function getVerifiedUserId(accessToken: string): Promise<string | null> {
  const response = await fetch(`${env.supabaseUrl}/auth/v1/user`, {
    method: "GET",
    headers: {
      "apikey": env.publishableKey,
      "Authorization": `Bearer ${accessToken}`
    }
  });
  if (!response.ok) return null;
  const user = await response.json();
  return typeof user?.id === "string" ? user.id : null;
}

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

async function supabaseRest(path: string, init: RequestInit): Promise<Response> {
  return await fetch(`${env.supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: serviceHeaders(init.headers as Record<string, string> | undefined)
  });
}

async function releaseLease(cacheKey: string, leaseToken: string): Promise<void> {
  try {
    const query = new URLSearchParams({
      cache_key: `eq.${cacheKey}`,
      lease_token: `eq.${leaseToken}`,
      status: "eq.pending"
    });
    await supabaseRest(`ai_learning_content?${query.toString()}`, {
      method: "PATCH",
      headers: { "Prefer": "return=minimal" },
      body: JSON.stringify({
        lease_token: null,
        lease_until: new Date(Date.now() - 1000).toISOString(),
        updated_at: new Date().toISOString()
      })
    });
  } catch {
    // Lease expiry is the fallback if the cleanup request itself fails.
  }
}

async function reportContent(
  cacheKey: string,
  userId: string,
  cors: Record<string, string>
): Promise<Response> {
  const response = await supabaseRest("rpc/record_mila_ai_content_report", {
    method: "POST",
    body: JSON.stringify({
      p_cache_key: cacheKey,
      p_user_id: userId,
      p_min_reports: 3
    })
  });
  if (!response.ok) return json({ code: "report_storage_unavailable" }, 503, cors);

  const result = await response.json();
  if (result?.status === "not_found") {
    return json({ code: "content_not_found" }, 404, cors);
  }
  if (result?.status === "reported") {
    return json({ status: "reported" }, 200, cors);
  }
  if (result?.status === "received") {
    return json({ status: "received" }, 202, cors);
  }
  return json({ code: "invalid_report_response" }, 503, cors);
}

async function storeUserConsent(userId: string, accepted: boolean): Promise<boolean> {
  const now = new Date().toISOString();
  const response = await supabaseRest("ai_user_consents?on_conflict=user_id", {
    method: "POST",
    headers: { "Prefer": "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({
      user_id: userId,
      consent_version: CONSENT_VERSION,
      accepted_at: accepted ? now : null,
      revoked_at: accepted ? null : now,
      updated_at: now
    })
  });
  return response.ok;
}

async function hasCurrentUserConsent(userId: string): Promise<boolean | null> {
  const query = new URLSearchParams({
    user_id: `eq.${userId}`,
    consent_version: `eq.${CONSENT_VERSION}`,
    accepted_at: "not.is.null",
    revoked_at: "is.null",
    select: "user_id",
    limit: "1"
  });
  const response = await supabaseRest(`ai_user_consents?${query.toString()}`, {
    method: "GET"
  });
  if (!response.ok) return null;
  const rows = await response.json();
  return Array.isArray(rows) && rows.length === 1;
}

async function claimGeneration(input: {
  cacheKey: string;
  wordId: string;
  fingerprint: string;
  userId: string;
  leaseToken: string;
}): Promise<Record<string, unknown> | null> {
  const response = await supabaseRest("rpc/claim_mila_ai_generation", {
    method: "POST",
    body: JSON.stringify({
      p_cache_key: input.cacheKey,
      p_catalog_version: catalog.catalogVersion,
      p_word_id: input.wordId,
      p_word_fingerprint: input.fingerprint,
      p_content_schema_version: CONTENT_SCHEMA_VERSION,
      p_prompt_version: PROMPT_VERSION,
      p_model_name: env.model,
      p_user_id: input.userId,
      p_lease_token: input.leaseToken,
      p_max_daily: USER_DAILY_LIMIT,
      p_max_per_minute: USER_PER_MINUTE_LIMIT,
      p_max_global_daily: PROJECT_DAILY_LIMIT
    })
  });
  if (!response.ok) return null;
  const result = await response.json();
  return result && typeof result === "object" && !Array.isArray(result) ? result : null;
}

async function generateWithGemini(word: CatalogEntry): Promise<
  { ok: true; value: Record<string, unknown> } |
  { ok: false; code: "provider_rate_limited" | "provider_unavailable" | "invalid_provider_output" }
> {
  const prompt = buildPrompt(word);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(env.model)}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": env.geminiApiKey
        },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.25,
            maxOutputTokens: 500,
            responseMimeType: "application/json",
            responseSchema: RESPONSE_SCHEMA
          }
        })
      }
    );

    if (response.status === 429) return { ok: false, code: "provider_rate_limited" };
    if (!response.ok) return { ok: false, code: "provider_unavailable" };

    const providerData = await response.json();
    const rawText = providerData?.candidates?.[0]?.content?.parts
      ?.filter((part: { text?: unknown }) => typeof part?.text === "string")
      .map((part: { text: string }) => part.text)
      .join("");
    if (typeof rawText !== "string" || rawText.length === 0 || rawText.length > 12_000) {
      return { ok: false, code: "invalid_provider_output" };
    }

    let decoded: unknown;
    try { decoded = JSON.parse(rawText); }
    catch { return { ok: false, code: "invalid_provider_output" }; }

    const validated = validateGeneratedContent(decoded);
    if (!validated.ok) return { ok: false, code: "invalid_provider_output" };
    return { ok: true, value: validated.value };
  } catch {
    return { ok: false, code: "provider_unavailable" };
  } finally {
    clearTimeout(timeout);
  }
}

Deno.serve(async request => {
  const origin = request.headers.get("Origin");
  const cors = corsHeaders(origin);
  if (cors === null) return json({ code: "origin_not_allowed" }, 403);

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }
  if (request.method !== "POST") {
    return json({ code: "method_not_allowed" }, 405, cors);
  }

  if (!env.supabaseUrl || !env.publishableKey || !env.serviceRoleKey ||
      !env.geminiApiKey || !env.allowedOrigins.size) {
    console.error("mila_ai_configuration_missing");
    return json({ code: "service_not_configured" }, 503, cors);
  }

  const contentType = request.headers.get("Content-Type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    return json({ code: "invalid_content_type" }, 415, cors);
  }

  const authorization = request.headers.get("Authorization") ?? "";
  const tokenMatch = authorization.match(/^Bearer\s+(.+)$/iu);
  if (!tokenMatch) return json({ code: "unauthorized" }, 401, cors);

  let userId: string | null;
  try { userId = await getVerifiedUserId(tokenMatch[1]); }
  catch { userId = null; }
  if (!userId) return json({ code: "unauthorized" }, 401, cors);

  const declaredLength = Number(request.headers.get("Content-Length") ?? 0);
  if (declaredLength > MAX_BODY_BYTES) {
    return json({ code: "request_too_large" }, 413, cors);
  }

  let body: unknown;
  try {
    if (!request.body) return json({ code: "invalid_json" }, 400, cors);
    const reader = request.body.getReader();
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      totalBytes += part.value.byteLength;
      if (totalBytes > MAX_BODY_BYTES) {
        await reader.cancel();
        return json({ code: "request_too_large" }, 413, cors);
      }
      chunks.push(part.value);
    }
    const bytes = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    const raw = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    body = JSON.parse(raw);
  } catch {
    return json({ code: "invalid_json" }, 400, cors);
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return json({ code: "invalid_request" }, 400, cors);
  }

  const requestBody = body as Record<string, unknown>;
  if (Object.keys(requestBody).some(key => !["wordId", "action"].includes(key)) ||
      typeof requestBody.wordId !== "string" ||
      requestBody.wordId.length < 1 || requestBody.wordId.length > 120) {
    return json({ code: "invalid_request" }, 400, cors);
  }

  const action = requestBody.action === undefined ? "generate" : requestBody.action;
  if (typeof action !== "string" ||
      !["generate", "report", "consent", "revoke-consent", "consent-status"].includes(action)) {
    return json({ code: "invalid_action" }, 400, cors);
  }

  const word = catalog.words[requestBody.wordId];
  if (!word || !["stage", "academic", "expanded"].includes(word.source)) {
    return json({ code: "word_not_supported" }, 404, cors);
  }

  const fingerprint = await sha256(
    normalizeLexeme(word.he) + "\u001f" + normalizeLexeme(word.ar)
  );
  const cacheKey = buildCacheKey({
    catalogVersion: catalog.catalogVersion,
    wordId: requestBody.wordId,
    fingerprint
  });

  if (action === "consent" || action === "revoke-consent") {
    let saved: boolean;
    try {
      saved = await storeUserConsent(userId, action === "consent");
    } catch {
      saved = false;
    }
    if (!saved) return json({ code: "consent_storage_unavailable" }, 503, cors);
    return json({
      status: action === "consent" ? "consented" : "revoked",
      consentVersion: CONSENT_VERSION
    }, 200, cors);
  }

  if (action === "consent-status") {
    let consentStatus: boolean | null;
    try {
      consentStatus = await hasCurrentUserConsent(userId);
    } catch {
      consentStatus = null;
    }
    if (consentStatus === null) {
      return json({ code: "consent_check_unavailable" }, 503, cors);
    }
    return json({
      status: consentStatus ? "consented" : "consent_required",
      consentVersion: CONSENT_VERSION
    }, 200, cors);
  }

  if (action === "report") {
    return await reportContent(cacheKey, userId, cors);
  }

  let consent: boolean | null;
  try {
    consent = await hasCurrentUserConsent(userId);
  } catch {
    consent = null;
  }
  if (consent === null) {
    return json({ code: "consent_check_unavailable" }, 503, cors);
  }
  if (!consent) {
    return json({ code: "consent_required" }, 403, cors);
  }

  const leaseToken = crypto.randomUUID();
  let claim: Record<string, unknown> | null;
  try {
    claim = await claimGeneration({
      cacheKey, wordId: requestBody.wordId, fingerprint, userId, leaseToken
    });
  } catch {
    claim = null;
  }
  if (!claim) return json({ code: "cache_unavailable" }, 503, cors);

  if (claim.status === "ready" && claim.payload) {
    return json({ status: "ready", payload: claim.payload, cached: true }, 200, cors);
  }
  if (claim.status === "reported" || claim.status === "rejected") {
    return json({ code: "content_unavailable" }, 410, cors);
  }
  if (claim.status === "in_progress") {
    return json({ code: "generation_in_progress" }, 202, cors);
  }
  if (["global_limit", "user_daily_limit", "user_rate_limit"].includes(String(claim.status))) {
    return json({ code: "generation_limit_reached" }, 429, cors);
  }
  if (claim.status !== "claimed") {
    return json({ code: "cache_unavailable" }, 503, cors);
  }

  const generated = await generateWithGemini(word);
  if (!generated.ok) {
    await releaseLease(cacheKey, leaseToken);
    const status = generated.code === "provider_rate_limited" ? 429 : 503;
    return json({ code: generated.code }, status, cors);
  }

  const saved = await supabaseRest(
    `ai_learning_content?${new URLSearchParams({
      cache_key: `eq.${cacheKey}`,
      lease_token: `eq.${leaseToken}`,
      status: "eq.pending"
    }).toString()}`,
    {
      method: "PATCH",
      headers: { "Prefer": "return=representation" },
      body: JSON.stringify({
        status: "ready",
        payload: generated.value,
        lease_token: null,
        lease_until: null,
        generated_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
    }
  );

  if (!saved.ok) {
    await releaseLease(cacheKey, leaseToken);
    return json({ code: "cache_write_failed" }, 503, cors);
  }

  const savedRows = await saved.json();
  if (!Array.isArray(savedRows) || savedRows.length !== 1) {
    return json({ code: "generation_claim_expired" }, 409, cors);
  }

  return json({
    status: "ready",
    payload: generated.value,
    cached: false,
    model: env.model
  }, 200, cors);
});
