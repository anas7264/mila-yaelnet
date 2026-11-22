(() => {
  "use strict";
  if (window.MILA_ADAPTIVE_ENABLED === false) return;
  const Engine = window.MilaAdaptiveEngine;
  if (!Engine) return;
  const STORAGE_KEY = "mila-yaelnet-adaptive-v1";
  const $ = (id) => document.getElementById(id);
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
  })[ch]);
  const normalize = (raw) => {
    try { return Engine.normalizeState(JSON.parse(raw || "null")); }
    catch { return Engine.createState(); }
  };
  let state = normalize(localStorage.getItem(STORAGE_KEY));
  let words = [];
  let wordMap = new Map();

  function collectWords() {
    const core = window.YaelCatalog?.officialWords?.() || [];
    let extras = [];
    try {
      const legacy = window.YaelStorage?.loadState?.(localStorage, core);
      extras = Array.isArray(legacy?.extras) ? legacy.extras.map(item => ({
        ...item, category: "كلمات شخصية", level: "مخصص", source: "extra"
      })) : [];
    } catch (_) {}
    const base = [...core, ...extras];
    const combined = window.YaelExpandedVocabulary?.merge ? window.YaelExpandedVocabulary.merge(base) : base;
    const seen = new Set();
    words = combined.filter(word => {
      if (!word?.id || seen.has(word.id) || !String(word.he || "").trim() || !String(word.ar || "").trim()) return false;
      seen.add(word.id);
      return true;
    });
    wordMap = new Map(words.map(word => [word.id, word]));
    if (state.session) {
      state.session.queue = state.session.queue.filter(id => wordMap.has(id));
      state.session.cursor = Math.min(state.session.cursor, Math.max(0, state.session.queue.length - 1));
      if (!state.session.queue.length) state.session = null;
    }
  }

  function save() {
    try {
      const payload = JSON.stringify(state);
      if (payload.length > 1800000) throw new Error("حجم تقدم الوضع التكيفي تجاوز الحد الوقائي.");
      localStorage.setItem(STORAGE_KEY, payload);
      return true;
    } catch (error) {
      console.error("Adaptive progress save failed", error);
      toast(error.message || "تعذر حفظ التقدم محليًا. صدّر نسخة احتياطية من الإعدادات.", true);
      return false;
    }
  }

  function toast(message, isError = false) {
    const node = $("toast");
    if (!node) return;
    node.textContent = message;
    node.className = "toast " + (isError ? "error" : "success");
    node.hidden = false;
    window.clearTimeout(toast.timer);
    toast.timer = window.setTimeout(() => { node.hidden = true; }, 3600);
  }

  function directionLabel(direction) {
    return direction === "he-ar" ? "من العبرية إلى العربية" : "من العربية إلى العبرية";
  }

  function cardStats(direction) {
    const key = direction === "he-ar" ? "heToAr" : "arToHe";
    return words.reduce((sum, word) => {
      const card = state.progress[word.id]?.[key] || {};
      sum.attempts += Number(card.attempts) || 0;
      sum.correct += Number(card.correct) || 0;
      sum.mistakes += Number(card.incorrect) || 0;
      if ((Number(card.attempts) || 0) > 0) sum.practiced += 1;
      return sum;
    }, { attempts: 0, correct: 0, mistakes: 0, practiced: 0 });
  }

  function navButton() {
    let button = $("adaptiveNavButton");
    if (button) return button;
    const nav = $("mainNav");
    if (!nav) return null;
    button = document.createElement("button");
    button.id = "adaptiveNavButton";
    button.type = "button";
    button.className = "nav-item adaptive-nav-item";
    button.setAttribute("data-adaptive-open", "true");
    button.innerHTML = '<span class="nav-icon" aria-hidden="true">↻</span><span>التدريب التكيفي</span><span class="nav-chip">NEW</span>';
    const review = nav.querySelector('[data-view="review"]');
    if (review) review.insertAdjacentElement("beforebegin", button);
    else nav.appendChild(button);
    return button;
  }

  function setNavActive(active) {
    document.querySelectorAll("#mainNav .nav-item").forEach(button => button.classList.toggle("active", active && button.id === "adaptiveNavButton"));
    const button = navButton();
    if (button) {
      const hasSession = Boolean(state.session);
      button.querySelector("span:nth-child(2)").textContent = hasSession ? "استكمال التدريب" : "التدريب التكيفي";
    }
  }

  function renderHome() {
    const heAr = cardStats("he-ar"), arHe = cardStats("ar-he");
    const resume = state.session ? `
      <section class="adaptive-resume">
        <div><span class="adaptive-eyebrow">جلسة محفوظة</span><h2>${directionLabel(state.session.direction)}</h2>
        <p>الدورة ${state.session.cycle} · السؤال ${Math.min(state.session.cursor + 1, state.session.queue.length)} من ${state.session.queue.length} في الدورة</p></div>
        <button class="adaptive-button adaptive-primary" data-adaptive-action="resume">استكمال الجلسة</button>
      </section>` : "";
    $("appView").innerHTML = `
      <section class="adaptive-page" dir="rtl">
        <header class="adaptive-heading">
          <div><div class="adaptive-eyebrow">MILA · ADAPTIVE RECALL</div><h1>التدريب التكيفي</h1>
          <p>استدعاء نشط مستمر. الكلمات التي تخطئ فيها تعود بعد فاصل قصير، والكلمات التي تتقنها تقلّ مراجعتها.</p></div>
          <button class="adaptive-button adaptive-quiet" data-adaptive-action="exit">العودة إلى المنصة</button>
        </header>
        <div class="adaptive-notice"><strong>ملاحظة المحتوى:</strong> يتضمن هذا الوضع المفردات الأساسية والموسّعة و377 مصطلحًا أكاديميًا. جرى دمج الكلمات المكررة في مدخل واحد، لكن القائمة الجديدة لم تخضع بعد لمراجعة لغوية مستقلة شاملة.</div>
        ${resume}
        <div class="adaptive-direction-grid">
          <button class="adaptive-direction-card" data-adaptive-start="he-ar">
            <span class="adaptive-card-label">ACTIVE RECALL · 01</span><strong>عبري ← عربي</strong>
            <span class="adaptive-direction-example" dir="ltr">מטרה</span><small>اكتب المعنى العربي من الذاكرة</small>
            <span class="adaptive-card-stat">${heAr.practiced} كلمة جُرّبت · ${heAr.attempts} محاولة</span>
          </button>
          <button class="adaptive-direction-card" data-adaptive-start="ar-he">
            <span class="adaptive-card-label">ACTIVE RECALL · 02</span><strong>عربي ← عبري</strong>
            <span class="adaptive-direction-example" dir="rtl">هدف</span><small>اكتب الكلمة العبرية من الذاكرة</small>
            <span class="adaptive-card-stat">${arHe.practiced} كلمة جُرّبت · ${arHe.attempts} محاولة</span>
          </button>
        </div>
        <div class="adaptive-footer-note"><span>✓ حفظ تلقائي بعد كل إجابة</span><span>✓ سجل مستقل لكل اتجاه</span><span>✓ لا يوجد حد ثابت للأسئلة</span></div>
      </section>`;
  }

  function renderSession() {
    const session = state.session;
    if (!session) return renderHome();
    const q = Engine.currentQuestion(state, words);
    if (!q) {
      state.session = null;
      save();
      return renderHome();
    }
    const promptField = q.direction === "he-ar" ? "he" : "ar";
    const answerField = q.direction === "he-ar" ? "ar" : "he";
    const promptDir = q.direction === "he-ar" ? "ltr" : "rtl";
    const answerDir = q.direction === "he-ar" ? "rtl" : "ltr";
    const card = Engine.getCard(state, q.wordId, q.direction);
    const pct = Math.round((session.cursor / Math.max(1, session.queue.length)) * 100);
    const result = session.lastResult;
    const feedback = session.answered && result ? `
      <div class="adaptive-feedback ${result.correct ? "is-correct" : "is-wrong"}" role="status" aria-live="polite">
        <strong>${result.correct ? "إجابة صحيحة" : "ليست مطابقة للإجابة المسجلة"}</strong>
        <span class="adaptive-answer" dir="${answerDir}">${esc(q.word[answerField])}</span>
        <small>${result.correct ? "أحسنت. لن نعيد الكلمة الآن." : "سنعيد هذه الكلمة بعد عدة أسئلة، بحد أقصى للمحاولات القصيرة."}</small>
      </div>
      <button class="adaptive-button adaptive-primary adaptive-full" data-adaptive-action="next">السؤال التالي <span aria-hidden="true">←</span></button>` : `
      <form id="adaptiveAnswerForm" class="adaptive-answer-form" autocomplete="off">
        <label for="adaptiveAnswer">${q.direction === "he-ar" ? "اكتب الترجمة العربية" : "اكتب الكلمة العبرية"}</label>
        <input id="adaptiveAnswer" name="answer" type="text" dir="${answerDir}" lang="${q.direction === "he-ar" ? "ar" : "he"}" autocapitalize="off" spellcheck="false" required maxlength="240" placeholder="${q.direction === "he-ar" ? "اكتب المعنى بالعربية…" : "اكتب الكلمة بالعبرية…"}">
        <div class="adaptive-answer-actions">
          <button class="adaptive-button adaptive-forgot" type="button" data-adaptive-action="forgot" aria-keyshortcuts="Alt+N">
            نسيت <kbd class="adaptive-shortcut" aria-hidden="true">Alt + N</kbd>
          </button>
          <button class="adaptive-button adaptive-primary adaptive-submit" type="submit">تحقّق من الإجابة</button>
        </div>
      </form>`;
    $("appView").innerHTML = `
      <section class="adaptive-page adaptive-study" dir="rtl">
        <header class="adaptive-session-top">
          <div><div class="adaptive-eyebrow">جلسة استدعاء نشط · ${directionLabel(q.direction)}</div><h1>تذكّر قبل أن تكشف الإجابة</h1></div>
          <div class="adaptive-session-actions">
            <button class="adaptive-button adaptive-quiet" data-adaptive-action="pause">${session.paused ? "متابعة" : "إيقاف مؤقت"}</button>
            <button class="adaptive-button adaptive-quiet" data-adaptive-action="exit">إيقاف والخروج</button><button class="adaptive-button adaptive-quiet" data-adaptive-action="end">إنهاء الجلسة</button>
          </div>
        </header>
        <div class="adaptive-progress"><span>الدورة ${session.cycle}</span><span>السؤال ${q.position} · ${q.totalInCycle}</span><div><i style="width:${pct}%"></i></div></div>
        <article class="adaptive-question">
          <span class="adaptive-question-label">${q.word.source === "expanded" ? "مفردة موسّعة" : q.word.source === "extra" ? "كلمة شخصية" : "مفردة من مرحلة"}</span>
          <div class="adaptive-prompt" dir="${promptDir}" lang="${q.direction === "he-ar" ? "he" : "ar"}">${esc(q.word[promptField])}</div>
          <div class="adaptive-meta"><span>${esc(q.word.category || "مفردات")}</span><span>محاولات هذه الكلمة: ${card.attempts}</span><span>أخطاء: ${card.incorrect}</span></div>
          ${session.paused ? '<div class="adaptive-paused" role="status">الجلسة متوقفة. تقدمك محفوظ ويمكنك المتابعة في أي وقت.</div>' : feedback}
        </article>
        <div class="adaptive-session-stats"><span>الإجابات الصحيحة <b>${session.correct}</b></span><span>الأخطاء <b>${session.incorrect}</b></span><span>إجمالي المحاولات <b>${session.attempts}</b></span></div>
        <p class="adaptive-session-hint">لا تُحتسب المحاولة مرتين. تُحفظ الإجابة والطابور محليًا، وتدخل بيانات الوضع ضمن مزامنة Mila الحالية.</p>
      </section>`;
    if (!session.answered && !session.paused) $("adaptiveAnswer")?.focus({ preventScroll: true });
  }

  function openMode() {
    setNavActive(true);
    if (state.session && !state.session.paused) renderSession();
    else renderHome();
    $("appView")?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function start(direction) {
    if (state.session && !window.confirm("بدء جلسة جديدة سيستبدل طابور الجلسة المحفوظة. هل تريد المتابعة؟")) return;
    try {
      state = Engine.startSession(state, words, direction);
      if (!save()) return;
      openMode();
      renderSession();
    } catch (error) { toast(error.message || "تعذر بدء الجلسة.", true); }
  }

  function submitAdaptiveAnswer(answer) {
    if (!state.session || state.session.answered || state.session.paused) return;
    const q = Engine.currentQuestion(state, words);
    if (!q) {
      toast("تعذر تحديد السؤال الحالي. أعد تحميل الصفحة لاستعادة الجلسة.", true);
      return;
    }
    const result = Engine.submitAnswer(state, words, answer, { questionId: q.questionId });
    if (!result.accepted) {
      toast("تم تجاهل الإرسال المكرر أو القديم.", true);
      return;
    }
    const bridge = window.MilaLearningBridge;
    const integrated = bridge?.recordAdaptiveAnswer({
      eventId: q.questionId,
      wordId: q.wordId,
      correct: result.correct,
      direction: q.direction,
      at: result.state.session?.lastResult?.at
    });
    if (!integrated?.accepted) {
      toast("لم تُحفظ هذه الإجابة في سجل المنصة الرئيسي؛ أعد المحاولة دون الانتقال للسؤال التالي.", true);
      return;
    }
    state = result.state;
    if (!save()) toast("حُفظت النتيجة العامة، لكن تعذر حفظ حالة الطابور التكيفي محليًا.", true);
    renderSession();
  }

  function handleAction(action) {
    if (action === "exit") {
      if (state.session) {
        const previousState = state;
        state = Engine.setPaused(state, true);
        if (!save()) {
          // Keep the visible controls and engine state in sync if local storage
          // rejects the pause write (for example, quota or privacy-mode errors).
          state = previousState;
          renderSession();
          return;
        }
      }
      setNavActive(false);
      const restored = window.MilaLearningBridge?.returnToPlatform?.();
      if (!restored) {
        setNavActive(true);
        try {
          if (state.session) renderSession();
          else renderHome();
        } catch (renderError) {
          console.error("Adaptive view recovery failed:", renderError);
        }
        toast("تعذرت العودة إلى المنصة دون إعادة تحميل. بقيت جلستك محفوظة؛ حاول مرة أخرى.", true);
      }
      return;
    }
    if (action === "resume") {
      state = Engine.setPaused(state, false);
      save();
      renderSession();
      return;
    }
    if (action === "forgot") {
      submitAdaptiveAnswer("");
      return;
    }
    if (action === "pause") {
      state = Engine.setPaused(state, !state.session?.paused);
      save();
      renderSession();
      return;
    }
    if (action === "next") {
      const result = Engine.advance(state, words);
      state = result.state;
      save();
      renderSession();
      return;
    }
    if (action === "end") {
      const session = state.session;
      if (!session) return;
      const wrongWordIds = Array.isArray(session.wrongWordIds) ? session.wrongWordIds : [...new Set(session.results.filter(item => !item.correct).map(item => item.wordId))];
      const bridge = window.MilaLearningBridge;
      const saved = session.attempts > 0 ? bridge?.recordAdaptiveSession({
        sessionId: session.id,
        direction: session.direction,
        startedAt: session.startedAt,
        finishedAt: Date.now(),
        total: session.attempts,
        correct: session.correct,
        wrongWordIds
      }) : { accepted: true, skipped: true };
      if (!saved?.accepted) {
        toast("تعذر تسجيل ملخص الجلسة في سجل المنصة الرئيسية. لم يتم إنهاء الجلسة؛ حاول مجددًا.", true);
        return;
      }
      state = Engine.endSession(state);
      if (!save()) {
        toast("سُجل ملخص الجلسة، لكن تعذر حفظ إغلاق الوضع التكيفي محليًا.", true);
        return;
      }
      renderHome();
    }
  }

  // Capture phase avoids losing taps when another component stops bubbling.
  document.addEventListener("click", event => {
    const origin = event.target instanceof Element ? event.target : event.target?.parentElement;
    const open = origin?.closest("[data-adaptive-open]");
    if (open) {
      event.preventDefault();
      try {
        // Always route through openMode so the adaptive nav state is restored
        // even after the user navigates back to a platform page.
        // A hidden main-app quiz must not keep counting down in the background.
        window.MilaLearningBridge?.pausePlatformSessionForAdaptive?.();
        openMode();
      } catch (error) {
        console.error("Adaptive navigation failed:", error);
        toast("تعذر فتح التدريب التكيفي: " + (error?.message || "خطأ غير متوقع"), true);
      }
      return;
    }
    const startButton = origin?.closest("[data-adaptive-start]");
    if (startButton) {
      event.preventDefault();
      start(startButton.getAttribute("data-adaptive-start"));
      return;
    }
    const actionButton = origin?.closest("[data-adaptive-action]");
    if (actionButton) {
      event.preventDefault();
      try { handleAction(actionButton.getAttribute("data-adaptive-action")); }
      catch (error) {
        console.error("Adaptive action failed:", error);
        toast("تعذر تنفيذ الإجراء: " + (error?.message || "خطأ غير متوقع"), true);
      }
    }
  }, true);

  document.addEventListener("keydown", event => {
    const isForgotShortcut = event.altKey && !event.ctrlKey && !event.metaKey &&
      !event.shiftKey && event.code === "KeyN";
    const adaptiveViewActive = Boolean($("appView")?.querySelector?.(".adaptive-study"));
    if (!isForgotShortcut || !adaptiveViewActive || !state.session ||
        state.session.paused || state.session.answered) return;
    event.preventDefault();
    event.stopPropagation();
    try { handleAction("forgot"); }
    catch (error) {
      console.error("Adaptive forgot shortcut failed:", error);
      toast("تعذر تسجيل الإجابة المنسية: " + (error?.message || "خطأ غير متوقع"), true);
    }
  }, true);

  document.addEventListener("submit", event => {
    if (event.target?.id !== "adaptiveAnswerForm") return;
    event.preventDefault();
    submitAdaptiveAnswer(event.target.elements.answer?.value ?? "");
  }, true);

  function init() {
    collectWords();
    navButton();
    const count = $("adaptiveNavButton")?.querySelector(".nav-chip");
    if (count) count.textContent = String(words.length);
    if (state.session) {
      const button = $("adaptiveNavButton");
      if (button) button.querySelector("span:nth-child(2)").textContent = "استكمال التدريب";
    }
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") save(); });
    window.addEventListener("pagehide", save);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
