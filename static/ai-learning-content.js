(function attachMilaAIContent(root) {
  "use strict";
  if (!root || !root.document) return;

  const CONSENT_KEY = "mila-ai-consent-v1";
  const CONSENT_VERSION = "gemini-free-v1-2026-11-22";
  const DB_NAME = "mila-ai-content-v1";
  const DB_VERSION = 1;
  const STORE_NAME = "contents";
  const CATALOG_VERSION = "mila-vocab-2026-11-22-v1";
  const CONTENT_SCHEMA_VERSION = 1;
  const PROMPT_VERSION = "mila-he-ar-learning-v1";
  const ALLOWED_SOURCES = new Set(["stage", "academic", "expanded"]);
  const $ = selector => document.querySelector(selector);

  const escapeAttribute = value => String(value ?? "").replace(/[&<>"']/gu, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);

  function enabled() {
    return root.MILA_AI_CONTENT_ENABLED === true;
  }

  function hasConsent() {
    try { return localStorage.getItem(CONSENT_KEY) === CONSENT_VERSION; }
    catch { return false; }
  }

  function saveConsent() {
    try {
      localStorage.setItem(CONSENT_KEY, CONSENT_VERSION);
      return true;
    } catch {
      return false;
    }
  }

  function cacheKey(wordId) {
    return [CATALOG_VERSION, wordId, CONTENT_SCHEMA_VERSION, PROMPT_VERSION].join(":");
  }

  function openDatabase() {
    return new Promise((resolve, reject) => {
      if (!root.indexedDB) return resolve(null);
      let request;
      try { request = indexedDB.open(DB_NAME, DB_VERSION); }
      catch { return resolve(null); }
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "key" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    });
  }

  async function storeOperation(mode, key, value) {
    const db = await openDatabase();
    if (!db) return null;
    return await new Promise(resolve => {
      let transaction;
      let result = null;
      let failed = false;
      try { transaction = db.transaction(STORE_NAME, mode); }
      catch { db.close(); return resolve(null); }
      const store = transaction.objectStore(STORE_NAME);
      let request;
      try {
        request = mode === "readonly" ? store.get(key) :
          value === null ? store.delete(key) : store.put(value);
      } catch {
        db.close();
        return resolve(null);
      }
      request.onsuccess = () => {
        if (mode === "readonly") result = request.result ?? null;
      };
      request.onerror = () => { failed = true; };
      transaction.oncomplete = () => {
        db.close();
        resolve(failed ? null : mode === "readonly" ? result : true);
      };
      transaction.onerror = () => { failed = true; db.close(); resolve(null); };
      transaction.onabort = () => { failed = true; db.close(); resolve(null); };
    });
  }

  function renderSlot(word) {
    if (!enabled() || !word || !ALLOWED_SOURCES.has(word.source) || typeof word.id !== "string") return "";
    const wordId = escapeAttribute(word.id);
    return `
      <aside class="adaptive-ai-card" data-mila-ai-card data-word-id="${wordId}" aria-label="محتوى تعليمي سياقي">
        <div class="adaptive-ai-heading">
          <span class="adaptive-ai-mark" aria-hidden="true">✦</span>
          <div><strong>مثال وسياق</strong><small>محتوى تعليمي إضافي اختياري</small></div>
        </div>
        <p class="adaptive-ai-notice">يمكنك طلب مثال عبري مع ترجمته وشرح استعمال الكلمة. لا يؤثر هذا المحتوى في تصحيح الإجابة أو ترتيب المراجعة.</p>
        <div class="adaptive-ai-consent" data-mila-ai-consent-panel hidden>
          <p>عند التفعيل، يُرسل إلى Gemini نص المفردة العبرية ومعناها العربي فقط. في الخطة المجانية، قد تستخدم Google المدخلات والمخرجات لتحسين منتجاتها وقد يراجعها أشخاص. لن نرسل إجاباتك أو سجل تعلمك أو بيانات حسابك إلى Gemini. يتطلب حفظ الموافقة تسجيل الدخول، وسنخزن رقم نسخة الموافقة وتاريخ قبولها أو إلغائها في MILA فقط لإدارة الموافقة بين أجهزتك.</p>
          <button class="adaptive-ai-action" type="button" data-mila-ai-consent>أوافق وأفعّل المحتوى الذكي</button>
          <button class="adaptive-ai-cancel" type="button" data-mila-ai-cancel>إلغاء</button>
        </div>
        <div class="adaptive-ai-status" data-mila-ai-status role="status" aria-live="polite">المحتوى السياقي اختياري ولا يوقف التدريب.</div>
        <div class="adaptive-ai-content" data-mila-ai-content hidden></div>
        <div class="adaptive-ai-actions">
          <button class="adaptive-ai-action" type="button" data-mila-ai-load>عرض المثال والسياق</button>
          <button class="adaptive-ai-disable" type="button" data-mila-ai-disable ${hasConsent() ? "" : "hidden"}>إيقاف المحتوى الذكي</button>
        </div>
      </aside>`;
  }

  async function revokeConsent(card, wordId) {
    if (!navigator.onLine) {
      setStatus(card, "يلزم الاتصال بالإنترنت لإلغاء الموافقة من حسابك على جميع الأجهزة.", "error");
      return false;
    }
    const button = card.querySelector("[data-mila-ai-disable]");
    if (button) button.disabled = true;
    try {
      const result = await invoke(wordId, "revoke-consent");
      if (result?.status !== "revoked") throw new Error("consent_storage_unavailable");
      localStorage.removeItem(CONSENT_KEY);
    } catch (error) {
      setStatus(card, explainError(error), "error");
      if (button) button.disabled = false;
      return false;
    }
    const panel = card.querySelector("[data-mila-ai-consent-panel]");
    const target = card.querySelector("[data-mila-ai-content]");
    const load = card.querySelector("[data-mila-ai-load]");
    const disable = card.querySelector("[data-mila-ai-disable]");
    if (panel) panel.hidden = true;
    if (target) {
      target.replaceChildren();
      target.hidden = true;
    }
    if (disable) disable.hidden = true;
    if (load) load.disabled = false;
    setStatus(card, "ألغيت الموافقة من حسابك. لن تُقبل طلبات Gemini جديدة على أي جهاز حتى توافق مجددًا.", "ok");
    return true;
  }

  function setStatus(card, message, state = "info") {
    const status = card.querySelector("[data-mila-ai-status]");
    if (!status) return;
    status.textContent = message;
    status.dataset.state = state;
  }

  function appendText(parent, tag, className, value, language, direction) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (language) element.lang = language;
    if (direction) element.dir = direction;
    element.textContent = String(value ?? "");
    parent.append(element);
    return element;
  }

  function renderPayload(card, payload) {
    const target = card.querySelector("[data-mila-ai-content]");
    if (!target) return;
    target.replaceChildren();

    appendText(target, "p", "adaptive-ai-definition", payload.definition_ar, "ar", "rtl");

    const example = document.createElement("div");
    example.className = "adaptive-ai-example";
    appendText(example, "span", "adaptive-ai-label", "مثال بالعبرية", "ar", "rtl");
    appendText(example, "p", "adaptive-ai-hebrew", payload.example_he, "he", "ltr");
    appendText(example, "p", "adaptive-ai-translation", payload.example_ar, "ar", "rtl");
    target.append(example);

    const usage = document.createElement("p");
    usage.className = "adaptive-ai-usage";
    appendText(usage, "strong", "", "ملاحظة استعمال", "ar", "rtl");
    appendText(usage, "span", "", payload.usage_note_ar, "ar", "rtl");
    target.append(usage);

    const list = document.createElement("div");
    list.className = "adaptive-ai-collocations";
    appendText(list, "strong", "", "تراكيب شائعة", "ar", "rtl");
    for (const item of payload.collocations) {
      const row = document.createElement("p");
      appendText(row, "bdi", "", item.he, "he", "ltr");
      appendText(row, "span", "", " — " + item.ar, "ar", "rtl");
      list.append(row);
    }
    target.append(list);

    const footer = document.createElement("div");
    footer.className = "adaptive-ai-footer";
    appendText(footer, "span", "", "محتوى مولّد بالذكاء الاصطناعي؛ قد يحتاج إلى مراجعة لغوية.", "ar", "rtl");
    const report = document.createElement("button");
    report.type = "button";
    report.className = "adaptive-ai-report";
    report.dataset.milaAiReport = "";
    report.textContent = "الإبلاغ عن خطأ";
    footer.append(report);
    target.append(footer);
    target.hidden = false;
  }

  async function invoke(wordId, action) {
    const bridge = root.MilaSyncBridge;
    if (!bridge || typeof bridge.invokeAiContent !== "function") {
      const error = new Error("auth_required");
      error.code = "auth_required";
      throw error;
    }
    return await bridge.invokeAiContent({ wordId, action });
  }

  function explainError(error) {
    const code = error?.code || error?.message || "";
    if (code === "consent_required") return "لا توجد موافقة فعّالة لهذا الحساب، أو ربما أُلغيت من جهاز آخر. اقرأ الإشعار ووافق مجددًا قبل طلب محتوى جديد." ;
    if (code === "consent_storage_unavailable" || code === "consent_check_unavailable") return "تعذر التحقق من موافقة حسابك الآن. لا نرسل طلب التوليد إلى Gemini حتى ينجح التحقق.";
    if (code === "consent_local_storage_unavailable") return "تعذر حفظ الموافقة على هذا الجهاز؛ لم نفعّل المحتوى الذكي. تحقّق من إعدادات التخزين ثم أعد المحاولة." ;
    if (code === "auth_required" || code === "FunctionsHttpError") {
      return "سجّل الدخول إلى حسابك لتوليد المحتوى وحفظه في المكتبة المشتركة.";
    }
    if (code === "generation_limit_reached" || code.includes("429")) {
      return "وصلت إلى حد التوليد المتاح حاليًا. المحتوى المحفوظ يظل متاحًا.";
    }
    if (code === "generation_in_progress" || code.includes("202")) {
      return "يجري إنشاء هذا المحتوى بالفعل. أعد المحاولة بعد قليل.";
    }
    if (!navigator.onLine) return "أنت غير متصل. جرّب مجددًا عند عودة الإنترنت.";
    return "تعذر إنشاء المحتوى الآن. يمكنك متابعة التدريب كالمعتاد.";
  }

  async function loadForWord(card, wordId) {
    if (!hasConsent()) {
      const panel = card.querySelector("[data-mila-ai-consent-panel]");
      if (panel) panel.hidden = false;
      return;
    }

    const key = cacheKey(wordId);
    const cached = await storeOperation("readonly", key);

    if (!navigator.onLine) {
      if (cached?.payload) {
        renderPayload(card, cached.payload);
        setStatus(card, "لا يوجد اتصال؛ عُرض المثال المحفوظ على هذا الجهاز دون الاتصال بـ Gemini.", "ok");
      } else {
        setStatus(card, "لا يوجد اتصال ولا توجد نسخة محفوظة لهذه المفردة. تابع التدريب دون المحتوى السياقي.", "error");
      }
      return;
    }

    const button = card.querySelector("[data-mila-ai-load]");
    if (button) button.disabled = true;
    setStatus(card, "جارٍ التحقق من موافقة الحساب…");
    try {
      const consent = await invoke(wordId, "consent-status");
      if (consent?.status !== "consented" || consent.consentVersion !== CONSENT_VERSION) {
        const error = new Error("consent_required");
        error.code = "consent_required";
        throw error;
      }

      if (cached?.payload) {
        const remoteStatus = await invoke(wordId, "check-content");
        if (remoteStatus?.status === "ready") {
          renderPayload(card, cached.payload);
          setStatus(card, "تم تحميل المحتوى من الذاكرة المحلية بعد التحقق من موافقة الحساب وصلاحية المحتوى المشترك.", "ok");
          return;
        }
        if (remoteStatus?.status === "unavailable") {
          await storeOperation("readwrite", key, null);
          const target = card.querySelector("[data-mila-ai-content]");
          if (target) target.hidden = true;
          setStatus(card, "أوقفنا عرض هذا المحتوى المشترك بعد مراجعة البلاغات.", "error");
          return;
        }
        if (!["pending", "not_found"].includes(String(remoteStatus?.status))) {
          const error = new Error(remoteStatus?.code || "cache_status_unavailable");
          error.code = remoteStatus?.code || "cache_status_unavailable";
          throw error;
        }
        await storeOperation("readwrite", key, null);
      }

      setStatus(card, "جارٍ إعداد المثال والشرح لهذه المفردة…");
      const result = await invoke(wordId, "generate");
      if (!result || result.status !== "ready" || !result.payload) {
        const error = new Error(result?.code || "invalid_response");
        error.code = result?.code || "invalid_response";
        throw error;
      }
      const entry = {
        key,
        payload: result.payload,
        cachedAt: Date.now(),
        model: typeof result.model === "string" ? result.model : "shared-cache"
      };
      const storedLocally = await storeOperation("readwrite", key, entry);
      renderPayload(card, result.payload);
      const message = result.cached ? "تم استرجاع المحتوى من المكتبة المشتركة." : "تم إنشاء المحتوى وحفظه في المكتبة المشتركة.";
      setStatus(card, storedLocally ? message + " وحُفظ على هذا الجهاز." : message + "؛ سيُسترجع من الخادم عند الحاجة.", "ok");
    } catch (error) {
      if (error?.code === "consent_required") {
        try { localStorage.removeItem(CONSENT_KEY); } catch {}
        const panel = card.querySelector("[data-mila-ai-consent-panel]");
        const disable = card.querySelector("[data-mila-ai-disable]");
        const target = card.querySelector("[data-mila-ai-content]");
        if (panel) panel.hidden = false;
        if (disable) disable.hidden = true;
        if (target) target.hidden = true;
      }
      setStatus(card, explainError(error), "error");
    } finally {
      if (button) button.disabled = false;
    }
  }

  async function acceptConsent(card, wordId) {
    const button = card.querySelector("[data-mila-ai-consent]");
    if (button) button.disabled = true;
    setStatus(card, "جارٍ حفظ موافقتك على مستوى الحساب…");
    if (!saveConsent()) {
      setStatus(card, explainError(new Error("consent_local_storage_unavailable")), "error");
      if (button) button.disabled = false;
      return;
    }
    try {
      const result = await invoke(wordId, "consent");
      if (result?.status !== "consented" || result.consentVersion !== CONSENT_VERSION) {
        throw new Error("consent_storage_unavailable");
      }
      const panel = card.querySelector("[data-mila-ai-consent-panel]");
      const disable = card.querySelector("[data-mila-ai-disable]");
      if (panel) panel.hidden = true;
      if (disable) disable.hidden = false;
      await loadForWord(card, wordId);
    } catch (error) {
      try { localStorage.removeItem(CONSENT_KEY); } catch {}
      setStatus(card, explainError(error), "error");
    } finally {
      if (button) button.disabled = false;
    }
  }

  async function report(card, wordId) {
    const button = card.querySelector("[data-mila-ai-report]");
    if (button) button.disabled = true;
    try {
      const result = await invoke(wordId, "report");
      if (result?.status === "reported") {
        await storeOperation("readwrite", cacheKey(wordId), null);
        const target = card.querySelector("[data-mila-ai-content]");
        if (target) target.hidden = true;
        setStatus(card, "تم تسجيل بلاغات كافية وإيقاف عرض هذا المحتوى المشترك.", "ok");
        return;
      }
      if (result?.status === "received") {
        setStatus(card, "تم استلام بلاغك. سيبقى المحتوى متاحًا مؤقتًا إلى أن تكتمل مراجعة البلاغات.", "ok");
        return;
      }
      throw new Error("invalid_report_response");
    } catch {
      setStatus(card, "تعذر إرسال البلاغ الآن. يمكنك المحاولة مجددًا لاحقًا.", "error");
      if (button) button.disabled = false;
    }
  }

  function handleClick(event) {
    const button = event.target instanceof Element ? event.target.closest("[data-mila-ai-load],[data-mila-ai-consent],[data-mila-ai-cancel],[data-mila-ai-report],[data-mila-ai-disable]") : null;
    if (!button) return;
    const card = button.closest("[data-mila-ai-card]");
    const wordId = card?.dataset.wordId;
    if (!card || !wordId) return;

    if (button.hasAttribute("data-mila-ai-consent")) {
      event.preventDefault();
      void acceptConsent(card, wordId);
      return;
    }
    if (button.hasAttribute("data-mila-ai-cancel")) {
      event.preventDefault();
      const panel = card.querySelector("[data-mila-ai-consent-panel]");
      if (panel) panel.hidden = true;
      return;
    }
    if (button.hasAttribute("data-mila-ai-disable")) {
      event.preventDefault();
      void revokeConsent(card, wordId);
      return;
    }
    if (button.hasAttribute("data-mila-ai-report")) {
      event.preventDefault();
      void report(card, wordId);
      return;
    }
    if (button.hasAttribute("data-mila-ai-load")) {
      event.preventDefault();
      if (!hasConsent()) {
        const panel = card.querySelector("[data-mila-ai-consent-panel]");
        if (panel) panel.hidden = false;
        setStatus(card, "اقرأ إشعار الخصوصية قبل تفعيل الاتصال بخدمة Gemini.");
        return;
      }
      void loadForWord(card, wordId);
    }
  }

  document.addEventListener("click", handleClick, true);

  root.MilaAIContent = Object.freeze({ renderSlot, hasConsent });
})(typeof window !== "undefined" ? window : null);
