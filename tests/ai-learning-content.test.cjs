const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const { buildManifest } = require("../scripts/build-ai-word-catalog.cjs");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "supabase/functions/_shared/word-catalog.json"), "utf8"));
const aiClient = fs.readFileSync(path.join(root, "static/ai-learning-content.js"), "utf8");
const adaptiveUi = fs.readFileSync(path.join(root, "static/adaptive-ui.js"), "utf8");
const sync = fs.readFileSync(path.join(root, "sync.js"), "utf8");
const edge = fs.readFileSync(path.join(root, "supabase/functions/mila-ai-content/index.ts"), "utf8");
const indexHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");
const serviceWorker = fs.readFileSync(path.join(root, "static/sw.js"), "utf8");

let contractPromise;
function contract() {
  contractPromise ||= import("../supabase/functions/_shared/ai-content.mjs");
  return contractPromise;
}

const validPayload = () => ({
  definition_ar: "هدف أو غاية يسعى الشخص إلى تحقيقها.",
  example_he: "המטרה של התוכנית היא לשפר את איכות החיים.",
  example_ar: "هدف البرنامج هو تحسين جودة الحياة.",
  usage_note_ar: "تُستخدم الكلمة للدلالة على النتيجة المراد الوصول إليها.",
  collocations: [
    { he: "להשיג מטרה", ar: "يحقق هدفًا" },
    { he: "מטרה מרכזית", ar: "هدف رئيسي" }
  ]
});

test("server manifest is reproducible from MILA's source vocabulary files", () => {
  const rebuilt = buildManifest();
  assert.deepEqual(rebuilt, manifest);
  assert.equal(Object.keys(manifest.words).length, 1442);
  assert.equal(new Set(Object.keys(manifest.words)).size, 1442);
  assert.ok(Object.values(manifest.words).every(word =>
    ["stage", "academic", "expanded"].includes(word.source) &&
    typeof word.he === "string" && word.he.length > 0 &&
    typeof word.ar === "string" && word.ar.length > 0
  ));
});

test("AI cache key separates corpus, word fingerprint and content versions", async () => {
  const api = await contract();
  const first = api.buildCacheKey({ catalogVersion: "v1", wordId: "academic-001", fingerprint: "a".repeat(64) });
  const changedCorpus = api.buildCacheKey({ catalogVersion: "v2", wordId: "academic-001", fingerprint: "a".repeat(64) });
  const changedPair = api.buildCacheKey({ catalogVersion: "v1", wordId: "academic-001", fingerprint: "b".repeat(64) });
  assert.notEqual(first, changedCorpus);
  assert.notEqual(first, changedPair);
  assert.throws(() => api.buildCacheKey({ wordId: "academic-001" }), /Missing cache-key component/);
});

test("Gemini prompt contains only the canonical language pair and fixed learning instructions", async () => {
  const api = await contract();
  const prompt = api.buildPrompt({ he: "מטרה", ar: "هدف" });
  assert.match(prompt, /מטרה/u);
  assert.match(prompt, /هدف/u);
  assert.match(prompt, /JSON object/u);
  assert.doesNotMatch(prompt, /session|userId|email|answerHistory|analytics|deviceId/iu);
  assert.throws(() => api.buildPrompt(null), /canonical vocabulary entry/);
});

test("valid Hebrew-Arabic generated content is accepted and normalized", async () => {
  const api = await contract();
  const result = api.validateGeneratedContent(validPayload());
  assert.equal(result.ok, true);
  assert.equal(result.value.collocations.length, 2);
  assert.deepEqual(Object.keys(result.value), [
    "definition_ar", "example_he", "example_ar", "usage_note_ar", "collocations"
  ]);
});

test("generated content rejects HTML, wrong scripts, extra fields and malformed collocations", async () => {
  const api = await contract();
  const html = validPayload();
  html.example_he = "<script>alert(1)</script>";
  assert.equal(api.validateGeneratedContent(html).ok, false);

  const wrongLanguage = validPayload();
  wrongLanguage.example_he = "This sentence is English.";
  assert.equal(api.validateGeneratedContent(wrongLanguage).ok, false);

  const extra = { ...validPayload(), raw_provider_response: "unexpected" };
  assert.equal(api.validateGeneratedContent(extra).ok, false);

  const malformed = validPayload();
  malformed.collocations = [{ he: "מטרה", ar: "هدف", note: "extra" }];
  assert.equal(api.validateGeneratedContent(malformed).ok, false);

  const empty = validPayload();
  empty.definition_ar = "   ";
  assert.equal(api.validateGeneratedContent(empty).ok, false);
});

test("AI content is separate from adaptive correctness and scheduling", () => {
  assert.match(adaptiveUi, /MilaAIContent\?\.renderSlot\?\.\(q\.word\)/);
  assert.match(aiClient, /indexedDB\.open\(DB_NAME, DB_VERSION\)/);
  assert.match(aiClient, /mila-ai-content-v1/);
  assert.doesNotMatch(aiClient, /mila-yaelnet-[a-z0-9-]+/u);
  assert.match(aiClient, /textContent = String\(value/);
  assert.match(aiClient, /MILA_AI_CONTENT_ENABLED === true/);
  assert.match(indexHtml, /MILA_AI_CONTENT_ENABLED = false/);
  assert.match(indexHtml, /ai-learning-content\.js\?v=1/);
  assert.match(serviceWorker, /mila-yaelnet-v15/);
  assert.match(serviceWorker, /ai-learning-content\.js\?v=1/);
});

test("browser sends only canonical word ID and action; server resolves source text", () => {
  assert.match(sync, /invokeAiContent: async \(\{ wordId, action = "generate" \}\s*=\s*\{\}\)/);
  assert.match(sync, /body: \{ wordId, action \}/);
  assert.doesNotMatch(sync.slice(sync.indexOf("window.MilaSyncBridge"), sync.indexOf("let device=")), /he:|ar:|answer|progress|session/i);
  assert.match(edge, /getVerifiedUserId/);
  assert.match(edge, /catalog\.words\[requestBody\.wordId\]/);
  assert.match(edge, /buildPrompt\(word\)/);
  assert.match(edge, /validateGeneratedContent\(decoded\)/);
  assert.match(edge, /x-goog-api-key/);
  assert.match(edge, /MILA_ALLOWED_ORIGINS/);
  assert.match(edge, /MAX_BODY_BYTES/);
  assert.match(edge, /rpc\/record_mila_ai_content_report/);
  assert.match(edge, /p_min_reports: 3/);
  assert.doesNotMatch(edge, /console\.log\([^\n]*(?:prompt|payload|authorization|apiKey)/i);
});

test("generated text cannot mix Hebrew into Arabic fields or Arabic into Hebrew fields", async () => {
  const api = await contract();
  const mixedHebrew = validPayload();
  mixedHebrew.example_he = "המשפט טוב ومعه كلمة عربية";
  assert.equal(api.validateGeneratedContent(mixedHebrew).ok, false);

  const mixedArabic = validPayload();
  mixedArabic.usage_note_ar = "تُستخدم الكلمة مع מילה عبرية";
  assert.equal(api.validateGeneratedContent(mixedArabic).ok, false);
});

test("IndexedDB cache success is reported only after transaction commit", () => {
  assert.match(aiClient, /transaction\.oncomplete = \(\) => \{[\s\S]*?resolve\(failed \? null/);
  assert.match(aiClient, /transaction\.onabort = \(\) => \{ failed = true/);
});

test("AI calls obtain a fresh Supabase auth session and never sync the AI cache", () => {
  assert.match(sync, /invokeAiContent:[\s\S]*?sb\.auth\.getSession\(\)/);
  assert.match(sync, /sb\.functions\.invoke\("mila-ai-content"/);
  assert.match(aiClient, /mila-ai-content-v1/);
  assert.doesNotMatch(sync, /mila-ai-content-v1/);
});

test("AI database migration is isolated and grants no client access", () => {
  const migration = fs.readFileSync(path.join(root, "supabase/migrations/20261122090650_add_ai_learning_content_cache.sql"), "utf8");
  assert.match(migration, /create table if not exists public\.ai_learning_content/);
  assert.match(migration, /create table if not exists public\.ai_generation_usage/);
  assert.match(migration, /alter table public\.ai_learning_content enable row level security/);
  assert.match(migration, /revoke all on table public\.ai_learning_content from public, anon, authenticated/);
  assert.match(migration, /grant select, insert, update, delete on table public\.ai_learning_content to service_role/);
  assert.match(migration, /create table if not exists public\.ai_learning_content_reports/);
  assert.match(migration, /primary key \(cache_key, user_id\)/);
  assert.match(migration, /record_mila_ai_content_report/);
  assert.match(migration, /security invoker/);
  assert.doesNotMatch(migration, /(?:alter|drop|truncate)\s+(?:table|function)\s+(?:public\.)?(?:learning_state|sync_learning_state)/i);
  assert.doesNotMatch(migration, /security definer/);
});

test("Gemini configuration selects the documented free translation model", async () => {
  const api = await contract();
  assert.equal(api.DEFAULT_MODEL, "gemini-3.5-flash-lite");
  assert.match(edge, /DEFAULT_MODEL/);
  assert.doesNotMatch(edge, /gemini-3\\.8-flash/);
});

test("AI content consent is account-level and revocation never touches learning progress", () => {
  assert.match(aiClient, /async function revokeConsent\(card, wordId\)/);
  assert.match(aiClient, /localStorage\.removeItem\(CONSENT_KEY\)/);
  assert.match(aiClient, /target\.replaceChildren\(\)/);
  assert.match(aiClient, /data-mila-ai-disable/);
  assert.doesNotMatch(aiClient, /localStorage\.clear\(/);
  assert.doesNotMatch(aiClient, /mila-yaelnet-studio-v3|learning_state/);
});

test("AI consent revoke control becomes visible immediately after opt-in", () => {
  assert.match(aiClient, /if \(disable\) disable\.hidden = false/);
  assert.match(aiClient, /if \(disable\) disable\.hidden = true/);
});

test("server requires active account-level Gemini consent before serving or generating content", () => {
  const migration = fs.readFileSync(path.join(root, "supabase/migrations/20261122090650_add_ai_learning_content_cache.sql"), "utf8");
  assert.match(migration, /create table if not exists public\.ai_user_consents/);
  assert.match(migration, /alter table public\.ai_user_consents enable row level security/);
  assert.match(migration, /revoke all on table public\.ai_user_consents from public, anon, authenticated/);
  assert.match(migration, /grant select, insert, update, delete on table public\.ai_user_consents to service_role/);
  assert.match(edge, /async function storeUserConsent\(userId: string, accepted: boolean\)/);
  assert.match(edge, /async function hasCurrentUserConsent\(userId: string\)/);
  assert.match(edge, /action === "consent-status"/);
  assert.match(edge, /if \(!consent\)[\s\S]*?consent_required/);
  assert.match(sync, /"consent-status"/);
  assert.match(aiClient, /invoke\(wordId, "consent-status"\)/);
  assert.match(aiClient, /invoke\(wordId, "revoke-consent"\)/);
});

test("offline AI content can be served only from IndexedDB when local consent remains active", () => {
  const start = aiClient.indexOf("async function loadForWord");
  const end = aiClient.indexOf("async function acceptConsent", start);
  const loader = aiClient.slice(start, end);
  assert.match(loader, /const cached = await storeOperation\("readonly", key\)/);
  assert.match(loader, /if \(!navigator\.onLine\)[\s\S]*?cached\?\.payload[\s\S]*?renderPayload/);
  assert.match(loader, /invoke\(wordId, "consent-status"\)[\s\S]*?if \(cached\?\.payload\)/);
});

test("account consent is stored locally before the server-side consent grant is requested", () => {
  const start = aiClient.indexOf("async function acceptConsent");
  const end = aiClient.indexOf("async function report", start);
  const accept = aiClient.slice(start, end);
  assert.ok(accept.indexOf("if (!saveConsent())") < accept.indexOf('invoke(wordId, "consent")'));
  assert.match(accept, /localStorage\.removeItem\(CONSENT_KEY\)/);
});

test("online cached content is checked against server consent; offline mode uses IndexedDB only", () => {
  const start = aiClient.indexOf("async function loadForWord");
  const end = aiClient.indexOf("async function acceptConsent", start);
  const loader = aiClient.slice(start, end);
  assert.ok(loader.indexOf('if (!navigator.onLine)') < loader.indexOf('invoke(wordId, "consent-status")'));
  const consentCheck = loader.indexOf('invoke(wordId, "consent-status")');
  const onlineCacheRead = loader.indexOf('if (cached?.payload)', consentCheck);
  assert.ok(consentCheck >= 0 && consentCheck < onlineCacheRead);
});


test("one account cannot suppress shared AI content with a single report", () => {
  const migration = fs.readFileSync(path.join(root, "supabase/migrations/20261122090650_add_ai_learning_content_cache.sql"), "utf8");
  assert.match(edge, /record_mila_ai_content_report/);
  assert.match(migration, /primary key \(cache_key, user_id\)/);
  assert.match(migration, /v_report_count >= p_min_reports/);
  assert.match(aiClient, /result\?\.status === "reported"/);
  assert.match(aiClient, /result\?\.status === "received"/);
  assert.match(aiClient, /سيبقى المحتوى متاحًا مؤقتًا/);
});


test("online cached content checks shared status and evicts content disabled by reports", () => {
  const start = aiClient.indexOf("async function loadForWord");
  const end = aiClient.indexOf("async function acceptConsent", start);
  const loader = aiClient.slice(start, end);
  const consent = loader.indexOf('invoke(wordId, "consent-status")');
  const check = loader.indexOf('invoke(wordId, "check-content")');
  const renderCached = loader.indexOf("renderPayload(card, cached.payload)");
  assert.ok(consent >= 0 && check > consent && renderCached > check);
  assert.match(loader, /remoteStatus\?\.status === "unavailable"[\s\S]*?storeOperation\("readwrite", key, null\)/);
  assert.match(edge, /action === "check-content"[\s\S]*?checkCachedContent\(cacheKey, cors\)/);
  assert.match(edge, /status === "reported" \|\| status === "rejected"/);
});
