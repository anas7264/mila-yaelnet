(() => {
  "use strict";

  const CATALOG = window.YaelCatalog;
  const ENGINE = window.VocabularyQuizEngine;
  const STORE = window.YaelStorage;
  if (!CATALOG || !ENGINE || !STORE) throw new Error("تعذر تحميل وحدات التطبيق الأساسية.");

  const $ = (id) => document.getElementById(id);
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const localDate = (date = new Date()) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + d;
  };
  const uid = () => (window.crypto?.randomUUID?.() || "id-" + Date.now() + "-" + Math.random().toString(36).slice(2, 9));
  const OFFICIAL = CATALOG.officialWords();
  const state = STORE.loadState(localStorage, OFFICIAL);
  if (!Array.isArray(state.completedStageIds)) state.completedStageIds = [];
  if (!Array.isArray(state.mistakes)) state.mistakes = [];
  if (!Array.isArray(state.sessions)) state.sessions = [];

  const ui = {
    view: "dashboard",
    stageId: CATALOG.stages[0]?.id || null,
    stageTab: "words",
    libraryFilter: "all",
    librarySearch: "",
    session: null,
    toastTimer: null,
    timerHandle: null,
    remainingSeconds: 0,
    paused: false,
    studyIndex: 0,
    studyFlipped: false,
    matching: null,
    studioDraft: {
      source: "all",
      stageId: CATALOG.stages[0]?.id || null,
      mode: "he-ar",
      count: 10,
      optionCount: 4,
      difficulty: "medium",
      timerSeconds: 0,
      shuffle: true,
      noRepeat: true,
      feedback: "instant",
      excludeMastered: false,
      distractorScope: "library",
      stageIds: CATALOG.stages.map((s) => s.id)
    }
  };

  const allWords = () => [...OFFICIAL, ...state.extras.map((w) => ({ ...w, source: "extra", stageId: null, stageTitle: "كلمات إضافية", category: w.category || "إضافية" }))];
  const wordMap = () => new Map(allWords().map((w) => [w.id, w]));
  const progressOf = (id) => state.progress[id] || {};
  const stageById = (id) => CATALOG.stages.find((s) => s.id === id) || CATALOG.stages[0];
  const stageWords = (id) => OFFICIAL.filter((w) => w.stageId === id);
  const stageMistakes = (id) => state.mistakes.filter((m) => wordMap().get(m.wordId)?.stageId === id);
  const stageAccuracy = (id) => {
    const words = stageWords(id);
    const records = words.map((w) => progressOf(w.id));
    const attempted = records.reduce((n, p) => n + (Number(p.attempts) || 0), 0);
    const correct = records.reduce((n, p) => n + (Number(p.correct) || 0), 0);
    return { attempted, correct, accuracy: attempted ? Math.round(correct / attempted * 100) : 0 };
  };
  const dueWords = (source = allWords()) => source.filter((w) => {
    const p = progressOf(w.id);
    return p.dueAt && Number(p.dueAt) <= Date.now();
  });
  const weakWords = (source = allWords()) => source.filter((w) => {
    const p = progressOf(w.id);
    const a = Number(p.attempts) || 0;
    return a > 0 && (Number(p.correct) || 0) / a < 0.7;
  });
  const mistakeWords = (source = allWords()) => {
    const ids = new Set(state.mistakes.map((m) => m.wordId));
    return source.filter((w) => ids.has(w.id) || (Number(progressOf(w.id).mistakes) || 0) > 0);
  };
  const favoriteWords = (source = allWords()) => source.filter((w) => progressOf(w.id).favorite);
  const masteredWords = (source = allWords()) => source.filter((w) => progressOf(w.id).mastered);
  const newWords = (source = allWords()) => source.filter((w) => !(Number(progressOf(w.id).attempts) || 0));

  function persist() {
    const ok = STORE.saveState(state, localStorage);
    if (!ok) toast("تعذر حفظ البيانات. قد تكون مساحة المتصفح ممتلئة؛ صدّر نسخة احتياطية.", "error");
    return ok;
  }

  function toast(message, kind = "success") {
    const node = $("toast");
    if (!node) return;
    node.textContent = message;
    node.className = "toast " + (kind === "error" ? "error" : "success");
    node.hidden = false;
    clearTimeout(ui.toastTimer);
    ui.toastTimer = setTimeout(() => { node.hidden = true; }, 3400);
  }

  function setTheme(theme) {
    state.settings.theme = theme === "dark" ? "dark" : "light";
    document.documentElement.dataset.theme = state.settings.theme;
    persist();
  }

  function applySettings() {
    setThemeWithoutSave();
    const focus = Boolean(state.settings.focusMode);
    document.body.classList.toggle("focus-mode", focus);
    document.body.classList.toggle("large-text", Boolean(state.settings.largeText));
    let exit = $("focusExit");
    if (focus && !exit) {
      exit = document.createElement("button");
      exit.id = "focusExit";
      exit.type = "button";
      exit.className = "focus-exit";
      exit.textContent = "إنهاء وضع التركيز";
      exit.addEventListener("click", () => {
        state.settings.focusMode = false;
        persist();
        render();
      });
      document.body.appendChild(exit);
    } else if (!focus && exit) {
      exit.remove();
    }
  }

  function setThemeWithoutSave() {
    document.documentElement.dataset.theme = state.settings.theme === "dark" ? "dark" : "light";
  }

  function formatDate(value) {
    if (!value) return "—";
    return new Intl.DateTimeFormat("ar", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
  }

  function formatDuration(seconds) {
    const s = Math.max(0, Number(seconds) || 0);
    return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
  }

  function stats() {
    const words = allWords();
    const records = words.map((w) => progressOf(w.id));
    const attempted = records.reduce((n, p) => n + (Number(p.attempts) || 0), 0);
    const correct = records.reduce((n, p) => n + (Number(p.correct) || 0), 0);
    const mastered = words.filter((w) => progressOf(w.id).mastered).length;
    return {
      words: words.length,
      attempted,
      correct,
      accuracy: attempted ? Math.round(correct / attempted * 100) : 0,
      mastered,
      due: dueWords(words).length,
      weak: weakWords(words).length,
      favorites: favoriteWords(words).length,
      sessions: state.sessions.length
    };
  }

  function renderShell() {
    document.querySelectorAll("[data-view]").forEach((button) => {
      button.classList.toggle("active", button.dataset.view === ui.view);
    });
    const names = {
      dashboard: "الرئيسية", stages: "المراحل التعليمية", studio: "مختبر التدريب",
      library: "مكتبة الكلمات", review: "مركز المراجعة", analytics: "التحليلات والأداء",
      settings: "الإعدادات والنسخ", stage: stageById(ui.stageId)?.title || "المرحلة"
    };
    $("breadcrumbTitle").textContent = names[ui.view] || names.stage;
    $("stageNavCount").textContent = String(CATALOG.stages.length);
    $("libraryNavCount").textContent = String(allWords().length);
    $("reviewNavCount").textContent = String(state.mistakes.length);
    const today = localDate();
    const yesterday = localDate(new Date(Date.now() - 86400000));
    $("streakCount").textContent = String(state.daily.lastDate === today || state.daily.lastDate === yesterday ? (state.daily.streak || 0) : 0);
    $("stageNav").innerHTML = CATALOG.stages.map((stage) => {
      const a = stageAccuracy(stage.id);
      return `<button type="button" class="stage-nav-item ${ui.view === "stage" && ui.stageId === stage.id ? "active" : ""}" data-action="open-stage" data-stage-id="${esc(stage.id)}">
        <span class="stage-nav-number">${stage.number}</span><span>${esc(stage.title)}</span><small class="stage-nav-progress">${a.accuracy}%</small>
      </button>`;
    }).join("");
  }

  function statCard(label, value, icon, note, trend = "") {
    return `<article class="stat-card">
      <div class="stat-top"><span>${esc(label)}</span><span class="stat-icon">${icon}</span></div>
      <strong class="stat-value">${esc(value)}</strong>
      <span class="stat-note">${trend ? '<span class="stat-trend">' + esc(trend) + '</span> · ' : ""}${esc(note)}</span>
    </article>`;
  }

  function pageHead(eyebrow, title, subtitle, actions = "") {
    return `<div class="page-head"><div><div class="eyebrow">${esc(eyebrow)}</div><h1 class="page-title">${esc(title)}</h1><p class="page-subtitle">${esc(subtitle)}</p></div><div class="page-actions">${actions}</div></div>`;
  }

  function emptyState(icon, title, copy, action = "") {
    return `<div class="empty-state"><div class="empty-icon">${icon}</div><strong>${esc(title)}</strong><p>${esc(copy)}</p>${action}</div>`;
  }

  function progressTrack(percent, extraClass = "") {
    return `<div class="progress-track"><div class="progress-fill ${extraClass}" style="width:${clamp(percent, 0, 100)}%"></div></div>`;
  }

  function renderDashboard() {
    const s = stats();
    const goal = Math.max(1, Number(state.settings.dailyGoal) || 10);
    const todayCompleted = state.daily.lastDate === localDate() ? Number(state.daily.completed) || 0 : 0;
    const goalPercent = Math.round(Math.min(100, todayCompleted / goal * 100));
    const due = dueWords().slice(0, 5);
    const latest = state.sessions.slice(-5).reverse();
    const stageCards = CATALOG.stages.map((stage) => {
      const words = stageWords(stage.id);
      const a = stageAccuracy(stage.id);
      const mastered = words.filter((w) => progressOf(w.id).mastered).length;
      return `<article class="stage-card">
        <div class="stage-card-top"><span class="stage-number">${stage.number}</span><span class="stage-state">${a.attempted ? "قيد الدراسة" : "لم تبدأ بعد"}</span></div>
        <h3>${esc(stage.title)}</h3><p>${esc(stage.subtitle)}</p>
        ${progressTrack(words.length ? mastered / words.length * 100 : 0)}
        <div class="progress-meta"><span>${mastered} / ${words.length} كلمات متقنة</span><span>${a.accuracy}% دقة</span></div>
        <div class="stage-metrics"><span><strong>${a.attempted}</strong> إجابة</span><span><strong>${stageMistakes(stage.id).length}</strong> أخطاء</span><span><strong>${words.length}</strong> كلمة</span></div>
        <div class="stage-card-actions"><button class="button button-secondary button-small" data-action="open-stage" data-stage-id="${esc(stage.id)}">مساحة المرحلة</button><button class="button button-primary button-small" data-action="stage-quiz" data-stage-id="${esc(stage.id)}">ابدأ اختبارًا</button></div>
      </article>`;
    }).join("");
    const dueMarkup = due.length ? `<div class="due-list">${due.map((w) => `<div class="due-item"><span class="hebrew-chip">${esc(w.he)}</span><div class="due-meaning"><strong>${esc(w.ar)}</strong><small>${esc(w.stageTitle || "كلمات إضافية")}</small></div><span class="due-flag">مستحقة</span></div>`).join("")}</div><div class="form-actions"><button class="button button-soft button-small" data-action="practice-source" data-source="due">ابدأ مراجعة المستحق</button></div>` : emptyState("↻", "لا توجد مراجعات مستحقة", "سيظهر هنا ما يحين موعد مراجعته حسب تقدمك.");
    const history = latest.length ? `<div class="history-list">${latest.map((item) => `<div class="history-row"><div><strong>${esc(item.title || "جلسة تدريب")}</strong><small>${formatDate(item.finishedAt)} · ${item.total || 0} سؤال</small></div><span class="badge ${item.accuracy >= 75 ? "badge-green" : "badge-gold"}">${item.accuracy || 0}%</span></div>`).join("")}</div>` : emptyState("◷", "لا توجد جلسات بعد", "ابدأ جلسة قصيرة لتظهر نتائجك وسجلّك هنا.");
    $("appView").innerHTML = `
      ${pageHead("YOUR LEARNING DESK", "مرحبًا بك في مساحة مילה", "منصة منظمة لمفردات יעלנט: كل مرحلة مستقلة، والتدريب يتشكل حسب نقاط ضعفك.", '<button class="button button-primary" data-action="open-studio">✳ إنشاء تمرين مخصص</button>')}
      <section class="dashboard-hero"><div class="hero-content">
        <div class="hero-kicker">YOUR NEXT LEVEL STARTS HERE</div><h2 class="hero-title">تعلّم الكلمات التي تحتاجها، بالطريقة التي تناسبك.</h2>
        <p class="hero-copy">لا تراجع كل شيء بالطريقة نفسها. اختر مرحلة محددة، أو دع مختبر التدريب يبني لك جلسة حسب الكلمات الضعيفة والمستحقة.</p>
        <div class="hero-actions"><button class="button button-primary" data-action="practice-source" data-source="due">ابدأ المراجعة الذكية ↗</button><button class="button button-secondary" data-view="stages">استعراض المراحل</button></div>
      </div></section>
      <section class="stats-grid">
        ${statCard("إجمالي المفردات", s.words, "◇", "في جميع المراحل والمكتبة الإضافية")}
        ${statCard("الإجابات الصحيحة", s.correct, "✓", "من أصل " + s.attempted + " إجابة")}
        ${statCard("دقة الإجابات", s.accuracy + "%", "◎", "مؤشر تدريبي وليس علامة رسمية")}
        ${statCard("كلمات متقنة", s.mastered, "✦", s.due + " مراجعة مستحقة", s.weak + " كلمة ضعيفة")}
      </section>
      <div class="dashboard-layout">
        <div class="stack">
          <section class="panel-card">
            <div class="panel-heading"><div><h2>هدفك اليومي</h2><p>خطوة صغيرة يوميًا أفضل من جلسة طويلة متباعدة</p></div><span class="badge badge-gold">${todayCompleted >= goal ? "اكتمل الهدف" : "هدف اليوم"}</span></div>
            <div class="goal-layout"><div class="goal-ring" style="--goal:${goalPercent}%"><div class="goal-ring-inner"><strong>${goalPercent}%</strong><small>من الهدف</small></div></div><div class="goal-copy"><strong>${todayCompleted} من ${goal} إجابة اليوم</strong><p>${goalPercent >= 100 ? "أحسنت. حافظ على الاستمرارية." : "أكمل بعض الأسئلة للوصول إلى هدفك اليومي."}</p>${progressTrack(goalPercent)}<div class="progress-meta"><span>هدف يومي ${goal} سؤال</span><button class="link-button" data-view="settings">تعديل الهدف</button></div></div></div>
          </section>
          <section class="panel-card"><div class="panel-heading"><div><h2>مراحلك التعليمية</h2><p>كل مرحلة مساحة مراجعة واختبار مستقلة</p></div><button class="link-button" data-view="stages">عرض جميع المراحل ←</button></div><div class="stage-grid">${stageCards}</div></section>
          <section class="panel-card"><div class="panel-heading"><div><h2>آخر الجلسات</h2><p>تتبّع تطور الدقة وعدد الأسئلة مع الوقت</p></div><button class="link-button" data-view="analytics">التحليلات ←</button></div>${history}</section>
        </div>
        <div class="stack">
          <section class="panel-card"><div class="panel-heading"><div><h2>المراجعة المستحقة</h2><p>كلمات حان موعد استرجاعها</p></div><span class="badge badge-red">${s.due}</span></div>${dueMarkup}</section>
          <section class="panel-card"><div class="panel-heading"><div><h2>اختصارات ذكية</h2><p>انتقل مباشرة إلى نوع المراجعة المطلوب</p></div></div>
            <div class="stack">
              <button class="button button-secondary" data-action="practice-source" data-source="weak">⌁ تدريب الكلمات الضعيفة <span class="badge badge-red">${s.weak}</span></button>
              <button class="button button-secondary" data-action="practice-source" data-source="mistakes">↻ إعادة الكلمات الخاطئة</button>
              <button class="button button-secondary" data-action="practice-source" data-source="favorites">★ الكلمات المفضلة</button>
              <button class="button button-secondary" data-action="practice-source" data-source="new">＋ كلمات لم تُدرس بعد</button>
            </div>
          </section>
          <section class="panel-card"><div class="panel-heading"><div><h2>معلومة مهمة</h2><p>عن طريقة عمل المنصة</p></div><span class="badge badge-blue">محلي</span></div><p class="page-subtitle">تُحفظ بياناتك على هذا المتصفح. استخدم النسخ الاحتياطي في الإعدادات لنقل تقدمك إلى جهاز آخر؛ لا توجد مزامنة تلقائية بين الأجهزة في هذه النسخة.</p></section>
        </div>
      </div>`;
  }

  function renderStages() {
    const cards = CATALOG.stages.map((stage) => {
      const words = stageWords(stage.id);
      const a = stageAccuracy(stage.id);
      const mastered = words.filter((w) => progressOf(w.id).mastered).length;
      return `<article class="stage-card">
        <div class="stage-card-top"><span class="stage-number">${stage.number}</span><span class="badge badge-gold">${words.length} مفردة</span></div>
        <h3>${esc(stage.title)}</h3><p>${esc(stage.description)}</p>
        ${progressTrack(mastered / Math.max(1, words.length) * 100)}
        <div class="progress-meta"><span>${mastered} كلمات متقنة</span><span>${a.accuracy}% دقة · ${a.attempted} إجابة</span></div>
        <div class="stage-card-actions"><button class="button button-secondary" data-action="open-stage" data-stage-id="${esc(stage.id)}">افتح مساحة المرحلة</button><button class="button button-primary" data-action="stage-quiz" data-stage-id="${esc(stage.id)}">اختبار مستقل</button></div>
      </article>`;
    }).join("");
    $("appView").innerHTML = `
      ${pageHead("LEARNING PATH", "المراحل التعليمية", "كل مرحلة منفصلة في الكلمات والاختبارات والأخطاء والإحصاءات، ويمكن مراجعتها دون خلطها بالمراحل الأخرى.", '<button class="button button-primary" data-action="open-studio">✳ مختبر التدريب</button>')}
      <section class="stats-grid">
        ${statCard("عدد المراحل", CATALOG.stages.length, "▤", "المراحل المعرفة حاليًا")}
        ${statCard("كلمات المرحلة الأولى", OFFICIAL.length, "◇", "مفردات موثقة من درسنا")}
        ${statCard("أخطاء مسجلة", state.mistakes.length, "↻", "تظل مرتبطة بكلمتها ومرحلتها")}
        ${statCard("جلسات تدريب", state.sessions.length, "◷", "محفوظة محليًا")}
      </section>
      <section class="stage-grid">${cards}</section>
      <div class="helper-note" style="margin-top:18px">تُضاف المراحل الجديدة من تمارينك القادمة. لن أملأ المراحل بكلمات عامة لا تظهر في مواد التدريب.</div>`;
  }

  function stageTabsMarkup() {
    const tabs = [["words","المفردات"],["study","بطاقات الدراسة"],["quiz","اختبار المرحلة"],["due","المستحقة"],["review","أخطاء المرحلة"],["favorites","المفضلة"],["stats","إحصاءات المرحلة"]];
    return `<div class="stage-tabs" role="tablist">${tabs.map(([id,label]) => `<button type="button" role="tab" aria-selected="${ui.stageTab === id}" class="stage-tab ${ui.stageTab === id ? "active" : ""}" data-action="stage-tab" data-tab="${id}">${label}</button>`).join("")}</div>`;
  }

  function wordListMarkup(words, options = {}) {
    if (!words.length) return emptyState("◇", options.emptyTitle || "لا توجد كلمات هنا", options.emptyCopy || "اختر مصدرًا آخر أو أضف كلمات جديدة.");
    const rows = words.map((word) => {
      const p = progressOf(word.id);
      const attempts = Number(p.attempts) || 0;
      const rate = attempts ? Math.round((Number(p.correct) || 0) / attempts * 100) : 0;
      return `<article class="word-row">
        <div><div class="word-he">${esc(word.he)}</div><div class="word-meta">${esc(word.category || (word.source === "extra" ? "إضافية" : "مفردة"))}</div></div>
        <div class="word-ar">${esc(word.ar)}</div>
        <div class="word-meta">${esc(word.level || (word.source === "extra" ? "شخصية" : "أساسي"))}</div>
        <div class="word-progress"><small>${attempts ? rate + "% إتقان" : "جديدة"}</small>${progressTrack(rate)}</div>
        <div class="word-actions">
          <button class="icon-action ${p.favorite ? "is-active" : ""}" title="المفضلة" data-action="toggle-favorite" data-word-id="${esc(word.id)}">★</button>
          <button class="icon-action ${p.mastered ? "is-active" : ""}" title="${p.mastered ? "إلغاء الإتقان" : "تحديد كمتقنة"}" data-action="toggle-mastered" data-word-id="${esc(word.id)}">✓</button>
          <button class="icon-action" title="نطق الكلمة" data-action="speak" data-word-id="${esc(word.id)}">◖</button>
          ${word.source === "extra" ? `<button class="icon-action" title="تعديل" data-action="edit-extra" data-word-id="${esc(word.id)}">✎</button><button class="icon-action" title="حذف" data-action="delete-extra" data-word-id="${esc(word.id)}">×</button>` : ""}
        </div>
      </article>`;
    }).join("");
    return `<div class="word-list">${rows}</div>`;
  }

  function renderStage() {
    const stage = stageById(ui.stageId);
    if (!stage) { ui.view = "stages"; render(); return; }
    const words = stageWords(stage.id);
    const a = stageAccuracy(stage.id);
    const mastered = words.filter((w) => progressOf(w.id).mastered).length;
    let body = "";
    if (ui.stageTab === "words") {
      const search = ui.stageSearch || "";
      const filtered = ENGINE.filterWords(words, state.progress, { stageId: stage.id, search });
      body = `<div class="toolbar"><div class="search-control"><input class="control" data-input="stage-search" value="${esc(search)}" placeholder="ابحث في كلمات هذه المرحلة فقط"></div><div class="toolbar-group"><button class="button button-secondary button-small" data-action="practice-stage-source" data-stage-id="${esc(stage.id)}" data-source="all">اختبار مفردات المرحلة</button><button class="button button-soft button-small" data-action="stage-tab" data-tab="favorites">المفضلة</button></div></div>${wordListMarkup(filtered)}</div>`;
    } else if (ui.stageTab === "study") {
      const word = words[ui.studyIndex % Math.max(1, words.length)];
      body = words.length ? `<div class="flashcard"><div class="question-kicker">STAGE ${stage.number} · STUDY CARD ${ui.studyIndex + 1} / ${words.length}</div><div class="question-prompt">${esc(word.he)}</div>${ui.studyFlipped ? `<div class="flashcard-back">${esc(word.ar)}</div><span class="badge badge-green">المعنى الصحيح</span>` : '<p class="question-hint">حاول تذكر المعنى قبل إظهاره</p>'}<div class="form-actions"><button class="button button-secondary" data-action="flip-card">${ui.studyFlipped ? "إخفاء المعنى" : "إظهار المعنى"}</button><button class="button button-primary" data-action="next-card">البطاقة التالية →</button><button class="icon-action ${progressOf(word.id).favorite ? "is-active" : ""}" data-action="toggle-favorite" data-word-id="${esc(word.id)}">★</button><button class="icon-action" data-action="speak" data-word-id="${esc(word.id)}">◖</button></div></div>` : emptyState("◇","لا توجد مفردات","أضف مفردات المرحلة أولًا.");
    } else if (ui.stageTab === "quiz") {
      body = `<div class="empty-hero"><div class="empty-icon">✳</div><h3>اختبار مستقل لهذه المرحلة</h3><p>ستكون الأسئلة من مفردات ${esc(stage.title)} فقط. أما المشتّتات فتُختار من بنك الكلمات الأوسع لتكون الخيارات أكثر تنوعًا دون تغيير نطاق الأسئلة.</p><button class="button button-primary" data-action="practice-stage-source" data-stage-id="${esc(stage.id)}" data-source="all">ابدأ الاختبار الآن</button><button class="button button-secondary" data-action="open-studio-stage" data-stage-id="${esc(stage.id)}">تخصيص إعدادات الاختبار</button></div>`;
    } else if (ui.stageTab === "due") {
      const due = dueWords(words);
      body = `${due.length ? '<div class="toolbar"><span class="badge badge-red">' + due.length + ' مراجعة مستحقة</span><button class="button button-primary button-small" data-action="practice-stage-source" data-stage-id="' + esc(stage.id) + '" data-source="due">اختبر المستحق</button></div>' : ""}${wordListMarkup(due,{emptyTitle:"لا توجد مراجعات مستحقة في هذه المرحلة",emptyCopy:"ستظهر الكلمة هنا عندما يحين موعد استعادتها حسب جدول المراجعة."})}`;
    } else if (ui.stageTab === "review") {
      const mistakes = stageMistakes(stage.id);
      const ids = new Set(mistakes.map((m) => m.wordId));
      const review = words.filter((w) => ids.has(w.id) || (Number(progressOf(w.id).mistakes) || 0) > 0);
      body = `${review.length ? '<div class="toolbar"><span class="badge badge-red">' + review.length + ' كلمة تحتاج إعادة مراجعة</span><button class="button button-primary button-small" data-action="practice-stage-source" data-stage-id="' + esc(stage.id) + '" data-source="mistakes">اختبر الأخطاء فقط</button></div>' : ""}${wordListMarkup(review,{emptyTitle:"هذه المرحلة بلا أخطاء مسجلة",emptyCopy:"الإجابات الخاطئة ستظهر هنا تلقائيًا بعد الاختبارات."})}`;
    } else if (ui.stageTab === "favorites") {
      body = wordListMarkup(favoriteWords(words), { emptyTitle: "لم تضف مفضلات بعد", emptyCopy: "اضغط على النجمة بجوار الكلمة لحفظها هنا." });
    } else {
      body = `<div class="stats-grid">${statCard("مفردات المرحلة",words.length,"◇","الكلمات الرسمية في هذه المرحلة")}${statCard("إجابات",a.attempted,"✓","إجابات من هذه المرحلة فقط")}${statCard("دقة",a.accuracy+"%","◎","صحة إجابات هذه المرحلة")}${statCard("متقنة",mastered,"✦","من إجمالي "+words.length+" كلمة")}</div><div class="panel-card"><div class="panel-heading"><h2>تقدم إتقان المرحلة</h2><span class="badge badge-gold">${Math.round(mastered/Math.max(1,words.length)*100)}%</span></div>${progressTrack(mastered/Math.max(1,words.length)*100)}<div class="progress-meta"><span>${mastered} متقنة</span><span>${words.length-mastered} لم تتقن بعد</span></div><div class="section-divider"></div><div class="history-list"><div class="history-row"><strong>الأخطاء المسجلة</strong><span>${stageMistakes(stage.id).length}</span></div><div class="history-row"><strong>الكلمات المفضلة</strong><span>${favoriteWords(words).length}</span></div><div class="history-row"><strong>المراجعات المستحقة</strong><span>${dueWords(words).length}</span></div></div></div>`;
    }
    $("appView").innerHTML = `
      ${pageHead("STAGE WORKSPACE · ${stage.number}", stage.title, stage.description, '<button class="button button-primary" data-action="open-studio-stage" data-stage-id="' + esc(stage.id) + '">✳ تمرين مخصص</button>')}
      <section class="stats-grid">${statCard("عدد المفردات",words.length,"◇","في هذه المرحلة فقط")}${statCard("الإجابات",a.attempted,"✓","سجل المرحلة")}${statCard("الدقة",a.accuracy+"%","◎","لا تشمل المراحل الأخرى")}${statCard("المراجعة",stageMistakes(stage.id).length,"↻","أخطاء هذه المرحلة")}</section>
      ${stageTabsMarkup()}<section class="stack">${body}</section>`;
  }

  function renderStudio() {
    const draft = ui.studioDraft;
    const selectedStages = draft.stageIds || [];
    const stageOptions = CATALOG.stages.map((stage) => `<label class="check-row stage-check"><input type="checkbox" data-config="stageIds" value="${esc(stage.id)}" ${selectedStages.includes(stage.id) ? "checked" : ""}><span>${esc(stage.title)}</span></label>`).join("");
    const presets = [
      ["quick","تدريب سريع","10 أسئلة · خيارات متعددة"],
      ["weak","الكلمات الضعيفة","اختبار موجّه للأخطاء المتكررة"],
      ["exam","محاكاة اختبار","20 سؤالًا · مؤقت 30 ثانية"],
      ["reverse","عربي إلى عبري","استرجاع عكسي"],
      ["due","المراجعة المستحقة","الكلمات التي حان موعدها"]
    ];
    const userPresets = Array.isArray(state.settings.presets) ? state.settings.presets : [];
    $("appView").innerHTML = `
      ${pageHead("PERSONALIZED PRACTICE ENGINE", "مختبر التدريب", "صمّم تمرينًا متخصصًا من الكلمات التي تختارها. نطاق الأسئلة منفصل عن بنك المشتّتات؛ لذلك يمكن أن تختبر مجموعة صغيرة بخيارات مأخوذة من المكتبة كاملة.", '<button class="button button-secondary" data-action="show-shortcuts">⌨ اختصارات لوحة المفاتيح</button>')}
      <div class="stack">
        <section class="form-card"><div class="panel-heading"><div><h3>قوالب جاهزة</h3><p>ابدأ بقالب ثم عدّل إعداداته</p></div><span class="badge badge-gold">SMART PRESETS</span></div><div class="stage-grid">${presets.map(([id,title,copy]) => `<button class="stage-card" type="button" data-action="preset" data-preset="${id}" style="text-align:right"><div class="stage-card-top"><span class="stage-number">✳</span><span class="badge badge-neutral">جاهز</span></div><h3>${title}</h3><p>${copy}</p></button>`).join("")}</div></section>
        ${userPresets.length ? '<section class="panel-card"><div class="panel-heading"><div><h2>قوالبي المحفوظة</h2><p>إعداداتك المخصصة التي تريد استخدامها مرة أخرى</p></div><span class="badge badge-neutral">' + userPresets.length + '</span></div><div class="toolbar-group">' + userPresets.map((preset) => '<div class="history-row" style="flex:1;min-width:210px"><strong>' + esc(preset.name) + '</strong><div class="toolbar-group"><button class="button button-secondary button-small" data-action="apply-saved-preset" data-preset-id="' + esc(preset.id) + '">تطبيق</button><button class="icon-action" title="حذف القالب" data-action="delete-saved-preset" data-preset-id="' + esc(preset.id) + '">×</button></div></div>').join('') + '</div></section>' : ''}
        <form id="studioForm" class="form-card">
          <h3>1. اختر مصدر الكلمات</h3><p>هذه الكلمات هي التي ستظهر كأسئلة. لن يتم إدخال كلمات خارج المصدر المحدد ضمن الأسئلة.</p>
          <div class="form-grid three">
            <div class="field"><label for="sourceSelect">مجموعة الأسئلة</label><select class="control" id="sourceSelect" name="source">
              <option value="all" ${draft.source==="all"?"selected":""}>كل المكتبة</option>
              <option value="stage" ${draft.source==="stage"?"selected":""}>مرحلة محددة</option>
              <option value="selected-stages" ${draft.source==="selected-stages"?"selected":""}>مراحل متعددة</option>
              <option value="extra" ${draft.source==="extra"?"selected":""}>الكلمات الإضافية</option>
              <option value="weak" ${draft.source==="weak"?"selected":""}>الكلمات الضعيفة</option>
              <option value="due" ${draft.source==="due"?"selected":""}>المراجعات المستحقة</option>
              <option value="mistakes" ${draft.source==="mistakes"?"selected":""}>الأخطاء السابقة</option>
              <option value="favorites" ${draft.source==="favorites"?"selected":""}>الكلمات المفضلة</option>
              <option value="new" ${draft.source==="new"?"selected":""}>كلمات جديدة</option>
            </select></div>
            <div class="field"><label for="modeSelect">نمط التدريب</label><select class="control" id="modeSelect" name="mode">
              <option value="he-ar" ${draft.mode==="he-ar"?"selected":""}>اختيار متعدد · عبري ← عربي</option>
              <option value="ar-he" ${draft.mode==="ar-he"?"selected":""}>اختيار متعدد · عربي ← عبري</option>
              <option value="typed-he-ar" ${draft.mode==="typed-he-ar"?"selected":""}>كتابة الإجابة · عبري ← عربي</option>
              <option value="typed-ar-he" ${draft.mode==="typed-ar-he"?"selected":""}>كتابة الإجابة · عربي ← عبري</option>
              <option value="flashcards" ${draft.mode==="flashcards"?"selected":""}>بطاقات تعليمية</option>
              <option value="matching" ${draft.mode==="matching"?"selected":""}>مطابقة أزواج</option>
            </select></div>
            <div class="field"><label for="countSelect">عدد الأسئلة</label><select class="control" id="countSelect" name="count">
              <option value="5" ${draft.count==5?"selected":""}>5 أسئلة</option><option value="10" ${draft.count==10?"selected":""}>10 أسئلة</option><option value="15" ${draft.count==15?"selected":""}>15 سؤالًا</option><option value="20" ${draft.count==20?"selected":""}>20 سؤالًا</option><option value="30" ${draft.count==30?"selected":""}>30 سؤالًا</option><option value="all" ${draft.count==="all"?"selected":""}>جميع الكلمات</option>
            </select></div>
          </div>
          <div id="singleStagePicker" class="advanced-panel" ${draft.source==="stage"?"":"hidden"}><strong class="field-label">اختر مرحلة واحدة فقط</strong><select id="singleStageSelect" name="stageId" class="control" style="margin-top:8px">${CATALOG.stages.map((stage)=>`<option value="${esc(stage.id)}" ${stage.id===(draft.stageId||ui.stageId)?"selected":""}>${esc(stage.title)}</option>`).join("")}</select></div>
          <div id="singleStagePicker" class="advanced-panel" ${draft.source==="stage"?"":"hidden"}><strong class="field-label">اختر مرحلة واحدة فقط</strong><select id="singleStageSelect" name="stageId" class="control" style="margin-top:8px">${CATALOG.stages.map((stage)=>`<option value="${esc(stage.id)}" ${stage.id===(draft.stageId||ui.stageId)?"selected":""}>${esc(stage.title)}</option>`).join("")}</select></div>
          <div id="stagePicker" class="advanced-panel" ${draft.source==="selected-stages"?"":"hidden"}><strong class="field-label">المراحل الداخلة في مجموعة الأسئلة</strong><div class="stage-checks">${stageOptions}</div></div></div>
          <details class="advanced-panel" open><summary>2. إعدادات متقدمة للتحكم في صعوبة التمرين</summary><div class="advanced-content">
            <div class="form-grid four">
              <div class="field"><label for="difficultySelect">مستوى الصعوبة</label><select id="difficultySelect" class="control" name="difficulty"><option value="easy" ${draft.difficulty==="easy"?"selected":""}>سهل · خياران</option><option value="medium" ${draft.difficulty==="medium"?"selected":""}>متوسط · 3 خيارات</option><option value="hard" ${draft.difficulty==="hard"?"selected":""}>متقدم · 5 خيارات</option><option value="adaptive" ${draft.difficulty==="adaptive"?"selected":""}>متكيف مع الأداء</option><option value="custom" ${draft.difficulty==="custom"?"selected":""}>تحديد يدوي</option></select></div>
              <div class="field"><label for="optionCountSelect">عدد الخيارات</label><select id="optionCountSelect" class="control" name="optionCount"><option value="2" ${draft.optionCount==2?"selected":""}>2 خيارات</option><option value="3" ${draft.optionCount==3?"selected":""}>3 خيارات</option><option value="4" ${draft.optionCount==4?"selected":""}>4 خيارات</option><option value="5" ${draft.optionCount==5?"selected":""}>5 خيارات</option></select></div>
              <div class="field"><label for="timerSelect">الوقت لكل سؤال</label><select id="timerSelect" class="control" name="timerSeconds"><option value="0" ${draft.timerSeconds==0?"selected":""}>بدون مؤقت</option><option value="10" ${draft.timerSeconds==10?"selected":""}>10 ثوانٍ</option><option value="15" ${draft.timerSeconds==15?"selected":""}>15 ثانية</option><option value="20" ${draft.timerSeconds==20?"selected":""}>20 ثانية</option><option value="30" ${draft.timerSeconds==30?"selected":""}>30 ثانية</option><option value="45" ${draft.timerSeconds==45?"selected":""}>45 ثانية</option><option value="60" ${draft.timerSeconds==60?"selected":""}>60 ثانية</option></select></div>
              <div class="field"><label for="feedbackSelect">عرض التصحيح</label><select id="feedbackSelect" class="control" name="feedback"><option value="instant" ${draft.feedback==="instant"?"selected":""}>فوري بعد الإجابة</option><option value="end" ${draft.feedback==="end"?"selected":""}>في نهاية الجلسة</option></select></div>
            </div>
            <div class="form-grid three" style="margin-top:14px">
              <label class="check-row"><input type="checkbox" name="shuffle" ${draft.shuffle?"checked":""}> خلط ترتيب الأسئلة والخيارات</label>
              <label class="check-row"><input type="checkbox" name="noRepeat" ${draft.noRepeat?"checked":""}> منع تكرار الكلمة داخل الجلسة</label>
              <label class="check-row"><input type="checkbox" name="excludeMastered" ${draft.excludeMastered?"checked":""}> استبعاد الكلمات المتقنة</label>
            </div>
            <div class="form-grid two" style="margin-top:14px">
              <div class="field"><label for="distractorScope">مصدر الخيارات الخاطئة</label><select id="distractorScope" name="distractorScope" class="control"><option value="library" ${draft.distractorScope==="library"?"selected":""}>كل المكتبة (موصى به)</option><option value="question-source" ${draft.distractorScope==="question-source"?"selected":""}>من مجموعة الأسئلة فقط</option></select></div>
              <div class="field"><label>التكيف مع الأداء</label><div class="helper-note">في الوضع المتكيف يبدأ الاختبار بثلاثة خيارات؛ تصعب الأسئلة التالية بعد الإجابات الصحيحة وتتراجع عند تكرار الخطأ.</div></div>
            </div>
          </div></details>
          <div class="form-actions"><button class="button button-primary" type="submit">إنشاء جلسة التدريب ↗</button><button class="button button-secondary" type="button" data-action="save-preset">حفظ هذه الإعدادات</button><span class="session-footnote" id="studioAvailability"></span></div>
        </form>
        <section class="panel-card"><div class="panel-heading"><div><h2>ما الذي سيتغير حسب إعداداتك؟</h2><p>نطاق الأسئلة وعدد الخيارات والنمط والوقت لا يختلط بعضها ببعض</p></div></div><div class="stage-grid">
          <div class="stat-card"><div class="stat-top">النطاق</div><strong class="stat-value" style="font-size:16px">مجموعة أسئلة مستقلة</strong><span class="stat-note">مرحلة، مراحل، ضعيفة، مستحقة أو مكتبة كاملة.</span></div>
          <div class="stat-card"><div class="stat-top">المشتّتات</div><strong class="stat-value" style="font-size:16px">بنك منفصل</strong><span class="stat-note">إجابات خاطئة مأخوذة من مفردات أخرى غير مترادفة.</span></div>
          <div class="stat-card"><div class="stat-top">التصحيح</div><strong class="stat-value" style="font-size:16px">بالمعرّف لا بالموقع</strong><span class="stat-note">ترتيب الخيارات لا يغير نتيجة الإجابة.</span></div>
          <div class="stat-card"><div class="stat-top">النتائج</div><strong class="stat-value" style="font-size:16px">حسب الكلمة والمرحلة</strong><span class="stat-note">المراجعة والتحليلات تبقى مرتبطة بمصدرها.</span></div>
        </div></section>
      </div>`;
    updateStudioAvailability();
  }

  function updateStudioAvailability() {
    const select = $("sourceSelect");
    if (!select) return;
    const source = select.value;
    const base = allWords();
    let targets = selectWordsForSource(source);
    const exclude = Boolean($('studioForm')?.elements.excludeMastered?.checked);
    if (exclude) targets = targets.filter((w) => !progressOf(w.id).mastered);
    const label = $("studioAvailability");
    if (label) label.textContent = targets.length + " كلمة متاحة في النطاق المحدد · بنك المشتّتات " + (base.length) + " كلمة";
    const picker = $("stagePicker");
    const singlePicker = $("singleStagePicker");
    if (picker) picker.hidden = source !== "selected-stages";
    if (singlePicker) singlePicker.hidden = source !== "stage";
    const singleSelect = $("singleStageSelect");
    if (singleSelect) {
      singleSelect.innerHTML = CATALOG.stages.map((stage) => `<option value="${esc(stage.id)}" ${stage.id === (ui.studioDraft.stageId || ui.stageId) ? "selected" : ""}>${esc(stage.title)}</option>`).join("");
    }
  }

  function selectWordsForSource(source, stageId) {
    const words = allWords();
    switch (source) {
      case "stage": return stageWords(stageId || ui.stageId || CATALOG.stages[0]?.id);
      case "selected-stages": {
        const ids = new Set(ui.studioDraft.stageIds || []);
        return OFFICIAL.filter((w) => ids.has(w.stageId));
      }
      case "extra": return words.filter((w) => w.source === "extra");
      case "weak": return weakWords(words);
      case "due": return dueWords(words);
      case "mistakes": return mistakeWords(words);
      case "favorites": return favoriteWords(words);
      case "new": return newWords(words);
      default: return words;
    }
  }

  function renderLibrary() {
    const filters = [
      ["all","الكل"],["stage","مراحل"],["extra","إضافية"],["weak","ضعيفة"],["due","مستحقة"],["mistakes","أخطاء"],["favorites","مفضلة"],["new","جديدة"],["mastered","متقنة"]
    ];
    let words = allWords();
    const q = ui.librarySearch || "";
    if (ui.libraryFilter === "stage") words = words.filter((w) => w.source === "stage");
    else if (ui.libraryFilter === "extra") words = words.filter((w) => w.source === "extra");
    else if (ui.libraryFilter === "weak") words = weakWords(words);
    else if (ui.libraryFilter === "due") words = dueWords(words);
    else if (ui.libraryFilter === "mistakes") words = mistakeWords(words);
    else if (ui.libraryFilter === "favorites") words = favoriteWords(words);
    else if (ui.libraryFilter === "new") words = newWords(words);
    else if (ui.libraryFilter === "mastered") words = masteredWords(words);
    words = ENGINE.filterWords(words, state.progress, { search: q });
    const addForm = `
      <form id="extraForm" class="form-card">
        <div class="panel-heading"><div><h3>إضافة مفردة إلى مكتبتك</h3><p>أدخل الكلمة ومعناها الصحيح فقط؛ خيارات الأسئلة تُنشأ آليًا من بقية المكتبة.</p></div><span class="badge badge-gold">WORD BANK</span></div>
        <div class="form-grid"><div class="field"><label for="extraHebrew">الكلمة بالعبرية</label><input class="control" id="extraHebrew" name="he" maxlength="100" placeholder="לדוגמה: משמעות" required dir="rtl"></div><div class="field"><label for="extraArabic">المعنى بالعربية</label><input class="control" id="extraArabic" name="ar" maxlength="240" placeholder="المعنى الصحيح" required></div></div>
        <div class="form-actions"><button class="button button-primary" type="submit">＋ إضافة الكلمة</button><button class="button button-secondary" type="button" data-action="bulk-import">إضافة مجموعة كلمات</button></div>
      </form>`;
    $("appView").innerHTML = `
      ${pageHead("WORD LIBRARY", "مكتبة الكلمات", "قاعدة المفردات المركزية. يمكنك البحث والتصفية، وإدارة الكلمات الإضافية، ومراجعة حالة كل كلمة.", '<button class="button button-secondary" data-action="export-csv">تصدير CSV ↓</button>')}
      <section class="stats-grid">${statCard("كل الكلمات",allWords().length,"◇","المراحل والإضافات")}${statCard("إضافية",state.extras.length,"＋","أدخلتها يدويًا")}${statCard("مفضلة",favoriteWords().length,"★","محفوظة للمراجعة")}${statCard("متقنة",masteredWords().length,"✓","حسب بيانات التقدم")}</section>
      ${addForm}
      <section class="panel-card" style="margin-top:16px"><div class="toolbar"><div class="search-control"><input class="control" data-input="library-search" value="${esc(q)}" placeholder="ابحث بالعبرية أو العربية"></div><div class="toolbar-group">${filters.map(([id,label]) => `<button class="stage-tab ${ui.libraryFilter===id?"active":""}" data-action="library-filter" data-filter="${id}">${label}</button>`).join("")}</div></div>
        <div class="panel-heading"><div><h2>نتائج المكتبة</h2><p>${words.length} كلمة مطابقة</p></div><span class="badge badge-neutral">${ui.libraryFilter === "all" ? "كل الكلمات" : esc(filters.find(f=>f[0]===ui.libraryFilter)?.[1] || "")}</span></div>
        ${wordListMarkup(words)}
      </section>`;
  }

  function renderReview() {
    const tabs = [["due","المستحقة"],["weak","الضعيفة"],["mistakes","الأخطاء"],["new","الجديدة"]];
    const source = ui.reviewFilter || "due";
    let words = source === "weak" ? weakWords() : source === "mistakes" ? mistakeWords() : source === "new" ? newWords() : dueWords();
    const list = `<section class="panel-card"><div class="panel-heading"><div><h2>قائمة المراجعة</h2><p>الكلمات المعروضة مصدرها هذا التصنيف فقط</p></div><span class="badge badge-gold">${words.length} كلمة</span></div>
      ${words.length ? '<div class="toolbar"><button class="button button-primary button-small" data-action="practice-source" data-source="' + source + '">اختبر هذه المجموعة</button></div>' : ""}
      ${wordListMarkup(words,{emptyTitle:"القائمة فارغة",emptyCopy:"ستُضاف الكلمات إلى هذا التصنيف حسب إجاباتك وجدولة المراجعة."})}
    </section>`;
    $("appView").innerHTML = `
      ${pageHead("RETRIEVAL & REVIEW", "مركز المراجعة", "استهدف الكلمات التي تحتاج عملًا بدل تكرار كل المفردات بالتساوي.", '<button class="button button-primary" data-action="open-studio">بناء جلسة مخصصة</button>')}
      <section class="stats-grid">${statCard("مستحقة",dueWords().length,"↻","حان موعد مراجعتها")}${statCard("ضعيفة",weakWords().length,"⌁","دقة أقل من 70% بعد المحاولة")}${statCard("أخطاء",state.mistakes.length,"!", "إجابات خاطئة مسجلة")}${statCard("جديدة",newWords().length,"＋","لم تُختبر بعد")}</section>
      <div class="stage-tabs">${tabs.map(([id,label])=>`<button class="stage-tab ${source===id?"active":""}" data-action="review-filter" data-filter="${id}">${label}</button>`).join("")}</div>${list}`;
  }

  function renderAnalytics() {
    const s = stats();
    const recent = state.sessions.slice(-7);
    const max = Math.max(1, ...recent.map((x) => Number(x.accuracy) || 0));
    const bars = recent.map((session) => `<div class="chart-bar-wrap"><span class="chart-bar-value">${Number(session.accuracy)||0}%</span><div class="chart-bar" style="height:${Math.max(3,(Number(session.accuracy)||0)/max*90)}%"></div><span class="chart-bar-label">${formatDate(session.finishedAt).replace(/\s*٢٠٢٦/,"")}</span></div>`).join("");
    const rows = CATALOG.stages.map((stage) => {
      const a = stageAccuracy(stage.id);
      return `<tr><td><strong>${esc(stage.title)}</strong></td><td>${stageWords(stage.id).length}</td><td>${a.attempted}</td><td>${a.correct}</td><td>${a.accuracy}%</td><td>${stageMistakes(stage.id).length}</td></tr>`;
    }).join("");
    const wordRows = allWords().map((w) => ({w,p:progressOf(w.id)}))
      .filter(({p}) => Number(p.attempts)>0)
      .sort((a,b) => ((Number(a.p.correct)||0)/(Number(a.p.attempts)||1)) - ((Number(b.p.correct)||0)/(Number(b.p.attempts)||1)))
      .slice(0,8);
    $("appView").innerHTML = `
      ${pageHead("LEARNING ANALYTICS", "التحليلات والأداء", "راقب السلوك الفعلي للتعلم: الدقة، الكلمات الصعبة، التقدم المرحلي وسجل الجلسات.")}
      <section class="stats-grid">${statCard("الإجابات",s.attempted,"✓","إجمالي المحاولات")}${statCard("الدقة",s.accuracy+"%","◎","المجموع الحالي")}${statCard("الكلمات المتقنة",s.mastered,"✦","معلّمة كمتقنة")}${statCard("جلسات التدريب",s.sessions,"◷","جلسات مكتملة")}</section>
      <div class="analytics-grid">
        <section class="panel-card"><div class="panel-heading"><div><h2>دقة آخر الجلسات</h2><p>آخر 7 جلسات محفوظة</p></div><span class="badge badge-gold">TREND</span></div>
          ${recent.length ? '<div class="chart-bars">' + bars + '</div>' : emptyState("▥","لا توجد بيانات بعد","أكمل جلسات التدريب لعرض منحنى الدقة.")}
        </section>
        <section class="panel-card"><div class="panel-heading"><div><h2>أضعف المفردات</h2><p>الكلمات التي سجلت أقل نسبة إجابة صحيحة</p></div><span class="badge badge-red">${wordRows.length}</span></div>
          ${wordRows.length ? '<div class="due-list">' + wordRows.map(({w,p})=>`<div class="due-item"><span class="hebrew-chip">${esc(w.he)}</span><div class="due-meaning"><strong>${esc(w.ar)}</strong><small>${Number(p.correct)||0} صحيح من ${Number(p.attempts)||0}</small></div><span class="badge badge-red">${Math.round((Number(p.correct)||0)/(Number(p.attempts)||1)*100)}%</span></div>`).join("") + '</div>' : emptyState("⌁","لا توجد نتائج كافية","سجل عدة إجابات أولًا.")}
        </section>
        <section class="panel-card" style="grid-column:1/-1"><div class="panel-heading"><div><h2>مقارنة المراحل</h2><p>كل صف محسوب من كلمات مرحلته فقط</p></div></div><div class="table-wrap"><table class="data-table"><thead><tr><th>المرحلة</th><th>كلمات</th><th>محاولات</th><th>صحيحة</th><th>الدقة</th><th>أخطاء</th></tr></thead><tbody>${rows}</tbody></table></div></section>
      </div>
      <section class="panel-card" style="margin-top:16px"><div class="panel-heading"><div><h2>سجل الجلسات</h2><p>النتائج الفعلية دون احتسابها كعلامة رسمية لامتحان יעלנט</p></div><button class="button button-secondary button-small" data-action="print-report">طباعة التقرير</button></div>
        ${recent.length ? '<div class="history-list">' + state.sessions.slice().reverse().map((session)=>`<div class="history-row"><div><strong>${esc(session.title || "جلسة تدريب")}</strong><small>${formatDate(session.finishedAt)} · ${session.total} سؤال · ${session.correct} صحيح</small></div><span class="badge ${session.accuracy>=75?"badge-green":"badge-gold"}">${session.accuracy}%</span></div>`).join("") + '</div>' : emptyState("◷","لا يوجد سجل","الجلسة المكتملة ستظهر هنا.")}
      </section>`;
  }

  function renderSettings() {
    const settings = state.settings;
    $("appView").innerHTML = `
      ${pageHead("PERSONALIZATION", "الإعدادات والنسخ الاحتياطي", "اضبط تجربة الاستخدام واحفظ نسخة من بياناتك لنقلها بين المتصفحات والأجهزة.")}
      <div class="settings-layout">
        <section class="form-card"><h3>تفضيلات التعلم</h3><p>إعدادات تتكيف مع عاداتك في الدراسة.</p>
          <div class="field"><label for="dailyGoalSetting">الهدف اليومي (عدد الإجابات)</label><input id="dailyGoalSetting" class="control" type="number" min="1" max="100" value="${settings.dailyGoal}"></div>
          <div class="settings-row"><div><strong>المظهر الليلي</strong><small>تبديل الثيم الفاتح/الداكن</small></div><button class="button button-secondary button-small" data-action="toggle-theme">${settings.theme==="dark"?"داكن":"فاتح"}</button></div>
          <div class="settings-row"><div><strong>وضع التركيز</strong><small>إخفاء القائمة والرأس لتقليل المشتتات</small></div><input type="checkbox" data-setting="focusMode" ${settings.focusMode?"checked":""}></div>
          <div class="settings-row"><div><strong>خط أكبر</strong><small>تحسين القراءة على الشاشات الصغيرة</small></div><input type="checkbox" data-setting="largeText" ${settings.largeText?"checked":""}></div>
          <div class="settings-row"><div><strong>النطق الصوتي</strong><small>استخدم صوت العبرية المتاح في جهازك</small></div><input type="checkbox" data-setting="sound" ${settings.sound?"checked":""}></div>
        </section>
        <section class="form-card"><h3>الخصوصية والنسخ الاحتياطي</h3><p>بيانات التعلم موجودة في localStorage على المتصفح الحالي فقط.</p>
          <div class="helper-note">لا توجد مزامنة تلقائية. احتفظ بنسخة JSON في مكان آمن وانقلها يدويًا إلى جهاز آخر.</div>
          <div class="stack" style="margin-top:14px"><button class="button button-primary" data-action="export-backup">↓ تنزيل نسخة احتياطية JSON</button><button class="button button-secondary" data-action="import-backup">↑ استعادة نسخة JSON</button><button class="button button-secondary" data-action="export-csv">تصدير الكلمات CSV</button><input type="file" id="backupFile" accept=".json,application/json" hidden></div>
        </section>
        <section class="form-card"><h3>اختصارات لوحة المفاتيح</h3><p>تنقل وأجب دون استخدام الفأرة في أثناء الاختبار.</p><div class="shortcut-list"><div class="shortcut-item"><span>اختيار الإجابة</span><kbd>1–5</kbd></div><div class="shortcut-item"><span>التالي / إظهار الإجابة</span><kbd>Enter</kbd></div><div class="shortcut-item"><span>إظهار البطاقة</span><kbd>Space</kbd></div><div class="shortcut-item"><span>إيقاف / متابعة المؤقت</span><kbd>P</kbd></div><div class="shortcut-item"><span>إغلاق النافذة</span><kbd>Esc</kbd></div><div class="shortcut-item"><span>الرئيسية</span><kbd>1</kbd></div></div></section>
        <section class="form-card"><h3>حالة المنصة</h3><p>معلومات تشغيلية عن النسخة الحالية.</p>
          <div class="history-list"><div class="history-row"><strong>إصدار البيانات</strong><span>v3</span></div><div class="history-row"><strong>مفردات رسمية</strong><span>${OFFICIAL.length}</span></div><div class="history-row"><strong>كلمات إضافية</strong><span>${state.extras.length}</span></div><div class="history-row"><strong>حفظ محلي</strong><span class="badge badge-green">نشط</span></div><div class="history-row"><strong>المزامنة السحابية</strong><span class="badge badge-neutral">غير مفعلة</span></div></div>
        </section>
      </div>`;
  }

  function render() {
    renderShell();
    applySettings();
    if (ui.view === "dashboard") renderDashboard();
    else if (ui.view === "stages") renderStages();
    else if (ui.view === "stage") renderStage();
    else if (ui.view === "studio") renderStudio();
    else if (ui.view === "library") renderLibrary();
    else if (ui.view === "review") renderReview();
    else if (ui.view === "analytics") renderAnalytics();
    else if (ui.view === "settings") renderSettings();
    else if (ui.view === "session") renderSession();
  }

  function navigate(view, params = {}) {
    if (ui.session && view !== "session") {
      if (!confirm("الجلسة الحالية لم تكتمل. هل تريد الخروج منها؟")) return;
      stopTimer();
      ui.session = null;
    }
    ui.view = view;
    if (params.stageId) ui.stageId = params.stageId;
    if (params.tab) ui.stageTab = params.tab;
    if (view === "review" && params.filter) ui.reviewFilter = params.filter;
    document.body.classList.remove("sidebar-open");
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function updateDailyStreak() {
    const today = localDate();
    if (state.daily.lastDate !== today) {
      const yesterday = localDate(new Date(Date.now() - 86400000));
      state.daily.streak = state.daily.lastDate === yesterday ? (Number(state.daily.streak) || 0) + 1 : 1;
      state.daily.lastDate = today;
      state.daily.completed = 0;
    }
    state.daily.completed = (Number(state.daily.completed) || 0) + 1;
  }

  function recordAnswer(wordId, correct, selectedWordId = null) {
    const previous = progressOf(wordId);
    const now = Date.now();
    const next = {
      ...previous,
      attempts: (Number(previous.attempts) || 0) + 1,
      correct: (Number(previous.correct) || 0) + (correct ? 1 : 0),
      incorrect: (Number(previous.incorrect) || 0) + (correct ? 0 : 1),
      mistakes: (Number(previous.mistakes) || 0) + (correct ? 0 : 1),
      consecutiveCorrect: correct ? (Number(previous.consecutiveCorrect) || 0) + 1 : 0,
      lastAnswerAt: now
    };
    const schedule = ENGINE.scheduleReview(previous, correct ? "good" : "again", now);
    Object.assign(next, schedule);
    state.progress[wordId] = next;
    if (!correct) {
      state.mistakes.push({ id: uid(), wordId, selectedWordId, createdAt: now, source: ui.session?.title || "جلسة تدريب" });
      if (state.mistakes.length > 500) state.mistakes.splice(0, state.mistakes.length - 500);
    }
    updateDailyStreak();
    return next;
  }

  function setReviewRating(wordId, rating) {
    const previous = progressOf(wordId);
    state.progress[wordId] = { ...previous, ...ENGINE.scheduleReview(previous, rating, Date.now()) };
    persist();
    toast("تم تحديث موعد المراجعة.");
    if (ui.view === "session") renderSession(); else render();
  }

  function beginSession(targetWords, config = {}, title = "جلسة تدريب") {
    if (!targetWords.length) {
      toast("لا توجد كلمات متاحة لهذا المصدر. جرّب توسيع النطاق.", "error");
      return;
    }
    const mode = config.mode || "he-ar";
    const engineMode = mode === "ar-he" || mode === "typed-ar-he" ? "ar-he" : "he-ar";
    const pool = config.distractorPool || allWords();
    const difficulty = config.difficulty || "medium";
    const adaptiveOptions = difficulty === "easy" ? 2 : difficulty === "medium" ? 3 : difficulty === "hard" ? 5 : difficulty === "adaptive" ? 3 : Number(config.optionCount) || 4;
    const sessionData = ENGINE.buildSession(targetWords, {
      targetWords,
      distractorPool: pool,
      mode: engineMode,
      count: config.count ?? targetWords.length,
      optionCount: config.optionCount || adaptiveOptions,
      difficulty,
      shuffle: config.shuffle !== false,
      noRepeat: config.noRepeat !== false
    });
    if (!sessionData.questions.length) {
      toast("لا يمكن إنشاء أسئلة غير ملتبسة من هذه الكلمات؛ أضف مفردات أخرى للمكتبة.", "error");
      return;
    }
    const wordsMap = wordMap();
    const targetIds = sessionData.questions.map((q) => q.targetWordId);
    ui.session = {
      id: sessionData.id,
      title,
      questions: sessionData.questions,
      targetIds,
      mode,
      difficulty,
      results: [],
      current: 0,
      answered: false,
      selectedWordId: null,
      feedbackVisible: false,
      paused: false,
      timerSeconds: mode === "matching" ? 0 : (Number(config.timerSeconds) || 0),
      remainingSeconds: mode === "matching" ? 0 : (Number(config.timerSeconds) || 0),
      startedAt: Date.now(),
      currentAdaptiveOptions: Number(config.optionCount) || adaptiveOptions,
      config: { ...persistableConfig, mode, targetCount: targetIds.length },
      distractorPool: pool,
      warnings: sessionData.warnings,
      matchState: null,
      flashRevealed: false,
      currentWord: () => wordsMap.get(targetIds[ui.session.current])
    };
    ui.view = "session";
    render();
    if (ui.session.timerSeconds) startTimer();
  }

  function startStudioSession(config = ui.studioDraft) {
    const source = config.source || "all";
    let targets = selectWordsForSource(source, config.stageId);
    if (source === "stage") {
      targets = stageWords(config.stageId || ui.stageId || CATALOG.stages[0]?.id);
    }
    if (source === "selected-stages") {
      const ids = new Set(config.stageIds || []);
      targets = OFFICIAL.filter((w) => ids.has(w.stageId));
    }
    if (config.scopeStageOnly && config.stageId) targets = targets.filter((w) => w.stageId === config.stageId);
    if (config.excludeMastered) targets = targets.filter((w) => !progressOf(w.id).mastered);
    if (config.search) targets = targets.filter((w) => ENGINE.normalizeText(w.he + " " + w.ar).includes(ENGINE.normalizeText(config.search)));
    if (config.category && config.category !== "all") targets = targets.filter((w) => w.category === config.category);
    if (config.count !== "all") targets = targets.slice(0, Math.max(1, Number(config.count) || 10));
    if (!targets.length) { toast("المصدر المحدد لا يحتوي على كلمات متاحة.", "error"); return; }
    const pool = config.distractorScope === "question-source" ? targets : allWords();
    beginSession(targets, { ...config, distractorPool: pool }, "مختبر التدريب · " + sourceLabel(source));
  }

  function sourceLabel(source) {
    return ({
      all:"كل المكتبة",stage:"مرحلة محددة","selected-stages":"مراحل متعددة",extra:"كلمات إضافية",
      weak:"كلمات ضعيفة",due:"مراجعات مستحقة",mistakes:"أخطاء سابقة",favorites:"المفضلة",new:"كلمات جديدة"
    })[source] || "جلسة تدريب";
  }

  function startTimer() {
    stopTimer();
    if (!ui.session || !ui.session.timerSeconds) return;
    ui.remainingSeconds = ui.session.remainingSeconds || ui.session.timerSeconds;
    ui.timerHandle = setInterval(() => {
      if (!ui.session || ui.session.paused || ui.session.answered || ui.view !== "session") return;
      ui.remainingSeconds -= 1;
      ui.session.remainingSeconds = ui.remainingSeconds;
      const node = $("sessionTimer");
      if (node) {
        node.textContent = formatDuration(ui.remainingSeconds);
        node.classList.toggle("is-warning", ui.remainingSeconds <= 5);
      }
      if (ui.remainingSeconds <= 0) {
        stopTimer();
        if (!ui.session.answered) submitCurrent(false, null, true);
      }
    }, 1000);
  }

  function stopTimer() {
    if (ui.timerHandle) clearInterval(ui.timerHandle);
    ui.timerHandle = null;
  }

  function pauseSession() {
    if (!ui.session) return;
    ui.session.paused = !ui.session.paused;
    ui.paused = ui.session.paused;
    if (ui.session.paused) stopTimer();
    else if (ui.session.timerSeconds && !ui.session.answered) startTimer();
    renderSession();
  }

  function renderSession() {
    const session = ui.session;
    if (!session) { ui.view = "dashboard"; render(); return; }
    const index = session.current;
    const total = session.questions.length;
    const q = session.questions[index];
    if (!q) { finishSession(); return; }
    const word = wordMap().get(q.targetWordId);
    const percent = Math.round(index / total * 100);
    const timer = session.timerSeconds ? `<span id="sessionTimer" class="session-timer ${session.remainingSeconds<=5?"is-warning":""}">${formatDuration(session.remainingSeconds)}</span>` : "";
    const prompt = q.prompt;
    const arabicPrompt = session.mode === "ar-he" || session.mode === "typed-ar-he";
    const controls = `<div class="session-controls"><span class="session-footnote">${index+1} من ${total} سؤال · ${esc(session.title)}</span><div class="toolbar-group"><button class="button button-secondary button-small" data-action="pause-session">${session.paused?"متابعة":"إيقاف مؤقت"}</button><button class="button button-quiet button-small" data-action="exit-session">إنهاء الجلسة</button></div></div>`;
    let interaction = "";
    if (session.paused) {
      interaction = emptyState("Ⅱ","الجلسة متوقفة مؤقتًا","اضغط متابعة لاستكمال التمرين.",'<button class="button button-primary" data-action="pause-session">متابعة</button>');
    } else if (session.mode === "flashcards") {
      interaction = `<div class="flashcard"><div class="question-kicker">ACTIVE RECALL · ${index+1}/${total}</div><div class="question-prompt ${arabicPrompt?"arabic":""}">${esc(prompt)}</div>${session.flashRevealed ? `<div class="flashcard-back">${esc(session.mode==="flashcards" ? (arabicPrompt?word.he:word.ar) : "")}</div><span class="badge badge-green">المعنى الصحيح</span>` : '<p class="question-hint">استرجع المعنى من ذاكرتك قبل إظهاره</p>'}<div class="form-actions"><button class="button button-secondary" data-action="speak" data-word-id="${esc(word.id)}">◖ استمع</button><button class="button button-primary" data-action="reveal-flashcard" ${session.answered?"disabled":""}>${session.flashRevealed?"تم إظهار المعنى":"إظهار المعنى"}</button></div>${session.flashRevealed && !session.answered ? '<div class="rating-row"><button class="button button-danger" data-action="flash-rate" data-rating="again">لم أتذكر</button><button class="button button-secondary" data-action="flash-rate" data-rating="hard">بصعوبة</button><button class="button button-primary" data-action="flash-rate" data-rating="good">جيد</button><button class="button button-gold" data-action="flash-rate" data-rating="easy">سهل</button></div>' : ""}</div>`;
    } else if (session.mode === "matching") {
      if (!session.matchState) createMatchRound();
      interaction = renderMatching();
    } else if (session.mode === "typed-he-ar" || session.mode === "typed-ar-he") {
      const feedback = session.feedbackVisible ? renderFeedback(q, word, session.results[index]?.correct) : "";
      interaction = `<div class="question-card"><div class="question-kicker">TYPE THE MEANING</div><div class="question-prompt ${arabicPrompt?"arabic":""}">${esc(prompt)}</div>
        <form id="typedForm" class="typed-answer-form"><input class="control" id="typedAnswer" name="answer" autocomplete="off" placeholder="اكتب الإجابة هنا" ${session.answered?"disabled":""}><button class="button button-primary" type="submit" ${session.answered?"disabled":""}>تحقق ←</button></form>
        ${feedback}
      </div>`;
    } else {
      const choices = q.choices || [];
      const feedback = session.feedbackVisible ? renderFeedback(q, word, session.results[index]?.correct) : "";
      interaction = `<div class="question-card"><div class="question-kicker">MULTIPLE CHOICE · ${session.mode==="ar-he"?"ARABIC → HEBREW":"HEBREW → ARABIC"}</div><p class="question-hint">اختر المعنى الصحيح للكلمة التالية</p><div class="question-prompt ${arabicPrompt?"arabic":""}">${esc(prompt)}</div>
        <div class="choice-grid">${choices.map((choice,i) => {
          const correct = session.answered && choice.wordId === q.correctWordId;
          const incorrect = session.answered && session.selectedWordId === choice.wordId && !correct;
          return `<button type="button" class="choice-button ${correct?"correct":incorrect?"incorrect":""}" data-action="answer-choice" data-word-id="${esc(choice.wordId)}" ${session.answered?"disabled":""}><span class="choice-index">${["أ","ب","ج","د","هـ"][i]}</span><span class="choice-text">${esc(choice.text)}</span></button>`;
        }).join("")}</div>${feedback}</div>`;
    }
    const advanceButton = session.answered
      ? `<button class="button button-primary" data-action="next-question">${index+1===total?"عرض النتيجة":"السؤال التالي"} ←</button>`
      : `<button class="button button-primary" disabled>أجب للمتابعة</button>`;
    $("appView").innerHTML = `
      ${pageHead("ACTIVE PRACTICE",session.title,"جلسة تدريب مستقلة. يتم حفظ نتائج كل مفردة وربط الأخطاء بمرحلتها.")}
      <div class="session-shell">
        <div class="session-top"><div class="session-progress-copy"><strong>${index+1}</strong> / ${total} سؤال · ${Math.round(session.results.filter(Boolean).length/total*100)}% اكتمل</div>${timer}</div>
        <div class="session-progress"><span style="width:${session.answered?Math.round((index+1)/total*100):percent}%"></span></div>
        ${session.warnings?.length && index===0 ? '<div class="helper-note">' + esc(session.warnings[0]) + '</div>' : ""}
        ${interaction}
        ${controls}
        ${!session.answered && session.mode!=="flashcards" && session.mode!=="matching" ? '<div class="session-controls"><span class="session-footnote">اختصارات: 1–5 للاختيار · Enter للمتابعة · P للإيقاف</span>' + (session.mode.startsWith("typed") ? "" : '') + '</div>' : ""}
        ${session.answered ? '<div class="session-controls"><span class="session-footnote">تم حفظ نتيجتك لهذه الكلمة.</span>' + advanceButton + '</div>' : ""}
      </div>`;
    if ((session.mode === "typed-he-ar" || session.mode === "typed-ar-he") && !session.answered) $("typedAnswer")?.focus();
    if (state.settings.sound && ui.lastAutoSpokenId !== q.targetWordId) {
      ui.lastAutoSpokenId = q.targetWordId;
      speakWord(q.targetWordId);
    }
    if (session.timerSeconds && !session.answered && !session.paused && !ui.timerHandle) startTimer();
  }

  function renderFeedback(question, word, correct) {
    const expected = question.mode === "ar-he" ? word.he : word.ar;
    return `<div class="answer-feedback ${correct?"good":"bad"}">${correct?"إجابة صحيحة — أحسنت.":"ليست صحيحة. الإجابة الصحيحة: "} <strong>${esc(expected)}</strong></div>
      <div class="rating-row" aria-label="تحديد موعد المراجعة">
        <span class="session-footnote" style="align-self:center">متى تريد مراجعة الكلمة؟</span>
        <button class="button button-danger button-small" data-action="rate-word" data-word-id="${esc(word.id)}" data-rating="again">مرة أخرى قريبًا</button>
        <button class="button button-secondary button-small" data-action="rate-word" data-word-id="${esc(word.id)}" data-rating="hard">بصعوبة</button>
        <button class="button button-primary button-small" data-action="rate-word" data-word-id="${esc(word.id)}" data-rating="good">جيد</button>
        <button class="button button-gold button-small" data-action="rate-word" data-word-id="${esc(word.id)}" data-rating="easy">سهل</button>
      </div>`;
  }

  function submitCurrent(correct, selectedWordId = null, timedOut = false) {
    const session = ui.session;
    if (!session || session.answered) return;
    const q = session.questions[session.current];
    const word = wordMap().get(q.targetWordId);
    const answer = ENGINE.gradeAnswer(q, selectedWordId);
    const isCorrect = Boolean(correct && answer.correct);
    session.answered = true;
    session.selectedWordId = selectedWordId;
    session.feedbackVisible = true;
    session.results[session.current] = { ...answer, correct: isCorrect, timedOut, targetWordId: q.targetWordId };
    recordAnswer(q.targetWordId, isCorrect, selectedWordId);
    stopTimer();
    persist();
    if (session.config.feedback === "end") session.feedbackVisible = false;
    renderSession();
  }

  function answerChoice(wordId) {
    const session = ui.session;
    if (!session || session.answered || !session.questions[session.current].choices.some((c)=>c.wordId===wordId)) return;
    const graded = ENGINE.gradeAnswer(session.questions[session.current], wordId);
    submitCurrent(graded.correct, wordId);
  }

  function answerTyped(value) {
    const session = ui.session;
    if (!session || session.answered) return;
    const q = session.questions[session.current];
    const word = wordMap().get(q.targetWordId);
    const checked = ENGINE.checkTypedAnswer(word, value, session.mode === "typed-ar-he" ? "ar-he" : "he-ar");
    session.answered = true;
    session.selectedWordId = null;
    session.feedbackVisible = true;
    session.results[session.current] = { correct: checked.correct, targetWordId: q.targetWordId, selectedWordId: null, correctWordId: q.targetWordId };
    recordAnswer(q.targetWordId, checked.correct, null);
    stopTimer();
    persist();
    renderSession();
  }

  function createMatchRound() {
    const session = ui.session;
    const start = session.current;
    const entries = session.questions.slice(start, Math.min(start + 4, session.questions.length));
    const ids = entries.map((q) => q.targetWordId);
    const words = ids.map((id) => wordMap().get(id)).filter(Boolean);
    session.matchState = {
      words,
      left: ENGINE.shuffle(words.map((w)=>({id:w.id,text:w.he}))),
      right: ENGINE.shuffle(words.map((w)=>({id:w.id,text:w.ar}))),
      selectedLeft: null,
      matched: [],
      mistakes: 0
    };
  }

  function renderMatching() {
    const match = ui.session.matchState;
    if (!match) return "";
    const left = match.left.map((item)=>`<button class="match-choice ${match.selectedLeft===item.id?"selected":""} ${match.matched.includes(item.id)?"matched":""}" data-action="match-left" data-word-id="${esc(item.id)}" ${match.matched.includes(item.id)?"disabled":""}>${esc(item.text)}</button>`).join("");
    const right = match.right.map((item)=>`<button class="match-choice ${match.matched.includes(item.id)?"matched":""}" data-action="match-right" data-word-id="${esc(item.id)}" ${match.matched.includes(item.id)?"disabled":""}>${esc(item.text)}</button>`).join("");
    return `<div class="question-card"><div class="question-kicker">MATCHING PAIRS</div><h2 class="page-title">اربط كل كلمة بترجمتها</h2><p class="question-hint">اختر كلمة عبرية ثم معناها العربي الصحيح. تم ربط ${match.matched.length} / ${match.words.length}</p><div class="match-grid"><div class="match-column">${left}</div><div class="match-column">${right}</div></div>${match.matched.length===match.words.length ? '<div class="answer-feedback good">أكملت هذه المجموعة بنجاح.</div>' : ""}</div>`;
  }

  function handleMatch(side, id) {
    const session = ui.session;
    if (!session || session.answered) return;
    const match = session.matchState;
    if (!match) return;
    if (side === "left") {
      match.selectedLeft = id;
      renderSession();
      return;
    }
    if (!match.selectedLeft) { toast("اختر الكلمة العبرية أولًا.", "error"); return; }
    const leftId = match.selectedLeft;
    if (leftId === id) {
      match.matched.push(id);
      match.selectedLeft = null;
      const word = wordMap().get(id);
      const q = session.questions.find((item)=>item.targetWordId===id);
      if (q) {
        const idx = session.questions.indexOf(q);
        session.results[idx] = { correct: true, targetWordId: id };
        recordAnswer(id, true, id);
      }
      if (match.matched.length === match.words.length) {
        const nextIndex = session.current + match.words.length;
        session.current = nextIndex;
        session.answered = false;
        session.matchState = null;
        if (nextIndex >= session.questions.length) finishSession();
      }
    } else {
      match.mistakes += 1;
      const word = wordMap().get(leftId);
      const q = session.questions.find((item)=>item.targetWordId===leftId);
      if (q) {
        const idx = session.questions.indexOf(q);
        if (!session.results[idx]) {
          session.results[idx] = { correct: false, targetWordId: leftId };
          recordAnswer(leftId, false, id);
        }
      }
      toast("هذا الربط غير صحيح. جرّب مرة أخرى.", "error");
      match.selectedLeft = null;
    }
    persist();
    renderSession();
  }

  function rateFlashcard(rating) {
    const session = ui.session;
    if (!session || session.answered) return;
    const q = session.questions[session.current];
    const good = rating !== "again";
    session.answered = true;
    session.feedbackVisible = true;
    session.results[session.current] = { correct: good, targetWordId: q.targetWordId, correctWordId: q.targetWordId };
    recordAnswer(q.targetWordId, good, null);
    const p = progressOf(q.targetWordId);
    state.progress[q.targetWordId] = { ...p, ...ENGINE.scheduleReview(p, rating, Date.now()) };
    persist();
    renderSession();
  }

  function nextQuestion() {
    const session = ui.session;
    if (!session || !session.answered) return;
    const previousResult = session.results[session.current];
    const nextIndex = session.current + 1;
    if (session.difficulty === "adaptive" && nextIndex < session.questions.length) {
      const direction = previousResult?.correct ? 1 : -1;
      session.currentAdaptiveOptions = clamp(session.currentAdaptiveOptions + direction, 2, 5);
      const nextQuestion = session.questions[nextIndex];
      const nextWord = wordMap().get(nextQuestion.targetWordId);
      const adaptiveQuestion = ENGINE.buildQuestion(nextWord, session.distractorPool || allWords(), {
        mode: session.mode === "ar-he" || session.mode === "typed-ar-he" ? "ar-he" : "he-ar",
        optionCount: session.currentAdaptiveOptions
      });
      if (adaptiveQuestion) session.questions[nextIndex] = adaptiveQuestion;
    }
    session.current += 1;
    session.answered = false;
    session.selectedWordId = null;
    session.feedbackVisible = false;
    session.flashRevealed = false;
    session.remainingSeconds = session.timerSeconds;
    if (session.current >= session.questions.length) finishSession();
    else {
      renderSession();
      if (session.timerSeconds) startTimer();
    }
  }

  function finishSession() {
    const session = ui.session;
    if (!session) return;
    stopTimer();
    const results = session.results.filter(Boolean);
    const summary = ENGINE.summarizeSession(results);
    const sessionRecord = {
      id: session.id,
      title: session.title,
      startedAt: session.startedAt,
      finishedAt: Date.now(),
      total: summary.total,
      correct: summary.correct,
      incorrect: summary.incorrect,
      accuracy: summary.accuracy,
      wrongWordIds: summary.wrongWordIds,
      settings: { ...session.config, mode: session.mode }
    };
    state.sessions.push(sessionRecord);
    if (state.sessions.length > 500) state.sessions.splice(0, state.sessions.length-500);
    const wrong = summary.wrongWordIds;
    state.lastSessionSummary = sessionRecord;
    persist();
    ui.session = { ...session, summary: sessionRecord, finished: true };
    renderSessionSummary(sessionRecord);
  }

  function renderSessionSummary(record) {
    const wrongWords = record.wrongWordIds.map((id)=>wordMap().get(id)).filter(Boolean);
    $("appView").innerHTML = `
      ${pageHead("SESSION COMPLETE","اكتملت جلسة التدريب","تم تسجيل نتيجة كل كلمة في مكتبتك وجدولة المراجعة التالية.")}
      <div class="session-summary"><div class="eyebrow" style="justify-content:center">YOUR SESSION REPORT</div><div class="summary-score">${record.accuracy}%</div><div class="summary-sub">دقة هذه الجلسة · ليست علامة امتحان رسمية</div>
        <div class="summary-grid"><div class="summary-metric"><strong>${record.total}</strong><small>إجمالي الأسئلة</small></div><div class="summary-metric"><strong>${record.correct}</strong><small>إجابات صحيحة</small></div><div class="summary-metric"><strong>${record.incorrect}</strong><small>إجابات خاطئة</small></div></div>
        <p class="page-subtitle">${record.accuracy>=85?"أداء قوي. انتقل إلى مستوى أصعب أو اعمل على سرعة الاسترجاع.":record.accuracy>=60?"أداء متوسط. ركز على إعادة الكلمات التي أخطأت فيها.":"هذه الجلسة كشفت نقاطًا تحتاج مراجعة؛ استخدم قائمة الأخطاء بدل إعادة المكتبة كاملة."}</p>
        ${wrongWords.length ? '<div class="section-divider"></div><div class="panel-heading"><h3>الكلمات التي تحتاج مراجعة</h3><span class="badge badge-red">' + wrongWords.length + '</span></div><div class="due-list">' + wrongWords.map(w=>`<div class="due-item"><span class="hebrew-chip">${esc(w.he)}</span><div class="due-meaning"><strong>${esc(w.ar)}</strong><small>${esc(w.stageTitle||"كلمات إضافية")}</small></div></div>`).join("") + '</div>' : '<div class="answer-feedback good">رائع — لا توجد أخطاء في هذه الجلسة.</div>'}
        <div class="summary-actions"><button class="button button-primary" data-action="replay-wrong" ${wrongWords.length?"":"disabled"}>إعادة الأخطاء</button><button class="button button-secondary" data-action="open-studio">جلسة جديدة</button><button class="button button-quiet" data-action="finish-to-dashboard">الرئيسية</button></div>
      </div>`;
  }

  function renderExtrasPanel() {
    renderLibrary();
    $("extraHebrew")?.focus();
  }

  function addExtra(event) {
    event.preventDefault();
    const form = event.target;
    const he = form.elements.he.value.trim().normalize("NFC");
    const ar = form.elements.ar.value.trim().normalize("NFC");
    if (!he || !ar) { toast("أدخل الكلمة ومعناها الصحيح.", "error"); return; }
    if (he.length > 100 || ar.length > 240 || /[<>]/.test(he+ar)) { toast("تحقق من طول الكلمة وعدم إدخال وسوم HTML.", "error"); return; }
    const duplicate = state.extras.some((w)=>ENGINE.normalizeText(w.he)===ENGINE.normalizeText(he));
    const duplicateOfficial = OFFICIAL.some((w)=>ENGINE.normalizeText(w.he)===ENGINE.normalizeText(he));
    if (duplicate || duplicateOfficial) { toast("هذه الكلمة موجودة مسبقًا في المكتبة.", "error"); return; }
    state.extras.push({ id: uid(), he, ar, source:"extra", tags:[], createdAt:Date.now() });
    if (!persist()) { state.extras.pop(); return; }
    toast("أضيفت المفردة إلى بنك الكلمات.");
    renderLibrary();
  }

  function editExtra(id) {
    const word = state.extras.find((w)=>w.id===id);
    if (!word) return;
    openModal("تعديل مفردة","حدّث الكلمة أو معناها الصحيح.",`
      <div class="field"><label>الكلمة بالعبرية</label><input class="control" id="editHe" value="${esc(word.he)}" maxlength="100" dir="rtl"></div>
      <div class="field" style="margin-top:10px"><label>المعنى بالعربية</label><input class="control" id="editAr" value="${esc(word.ar)}" maxlength="240"></div>`,
      "حفظ التعديل",()=>{
        const he=$("editHe").value.trim(),ar=$("editAr").value.trim();
        if (!he||!ar||/[<>]/.test(he+ar)) {toast("بيانات غير صالحة.","error");return false;}
        const duplicate=state.extras.some((w)=>w.id!==id&&ENGINE.normalizeText(w.he)===ENGINE.normalizeText(he))||OFFICIAL.some((w)=>ENGINE.normalizeText(w.he)===ENGINE.normalizeText(he));
        if(duplicate){toast("هذه الكلمة موجودة مسبقًا.","error");return false;}
        word.he=he;word.ar=ar;persist();render();toast("تم تحديث المفردة.");return true;
      });
  }

  function deleteExtra(id) {
    const index=state.extras.findIndex((w)=>w.id===id);
    if(index<0)return;
    const word=state.extras[index];
    openModal("حذف مفردة","سيتم حذف هذه المفردة من بنكك الشخصي. تبقى سجلات الجلسات السابقة محفوظة.",`<div class="hebrew-chip" style="display:inline-block">${esc(word.he)}</div><p>${esc(word.ar)}</p>`,"حذف",()=>{
      state.extras.splice(index,1);delete state.progress[id];state.mistakes=state.mistakes.filter(m=>m.wordId!==id);persist();render();toast("تم حذف المفردة.");return true;
    },"button-danger");
  }

  function bulkImport() {
    openModal("إضافة مجموعة كلمات","أدخل كلمة واحدة في كل سطر بالصيغة: الكلمة العبرية | المعنى العربي.",`
      <textarea id="bulkWords" class="control" rows="8" placeholder="משמעות | معنى\nהשפעה | تأثير\nתוצאה | نتيجة"></textarea>
      <p class="helper-note">سيتم تجاهل الأسطر الفارغة والتكرارات. لا تكتب أربع إجابات؛ معنى واحد صحيح لكل كلمة.</p>`,
      "استيراد الكلمات",()=>{
        const raw=$("bulkWords").value;
        const rows=raw.split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
        if(rows.length>500){toast("الحد الأقصى 500 سطر في المرة الواحدة.","error");return false;}
        let added=0,skipped=0;
        for(const line of rows){
          const parts=line.split(/[|｜]/);
          if(parts.length<2){skipped++;continue;}
          const he=parts.shift().trim(),ar=parts.join("|").trim();
          if(!he||!ar||he.length>100||ar.length>240||/[<>]/.test(he+ar)){skipped++;continue;}
          const dup=allWords().some(w=>ENGINE.normalizeText(w.he)===ENGINE.normalizeText(he));
          if(dup){skipped++;continue;}
          state.extras.push({id:uid(),he,ar,source:"extra",tags:[],createdAt:Date.now()});added++;
        }
        if(!persist()){state.extras.splice(-added,added);return false;}
        toast("تم استيراد "+added+" كلمة"+(skipped?"، وتجاهل "+skipped+" سطرًا مكررًا أو غير صالح.":"."));renderLibrary();return true;
      });
  }

  function openModal(title, copy, body, confirmLabel, onConfirm, confirmClass="button-primary") {
    const root=$("modalRoot");
    root.innerHTML=`<div class="modal-backdrop" data-action="modal-backdrop"><div class="modal-card" role="dialog" aria-modal="true" aria-label="${esc(title)}"><h3>${esc(title)}</h3><p>${esc(copy)}</p><div>${body}</div><div class="modal-actions"><button class="button ${confirmClass}" id="modalConfirm">${esc(confirmLabel)}</button><button class="button button-secondary" data-action="close-modal">إلغاء</button></div></div></div>`;
    $("modalConfirm").addEventListener("click",()=>{if(onConfirm()!==false)root.innerHTML="";});
  }

  function toggleFavorite(id) {
    const p=progressOf(id);
    state.progress[id]={...p,favorite:!p.favorite};
    persist();render();
    toast(state.progress[id].favorite?"أضيفت إلى المفضلة.":"أزيلت من المفضلة.");
  }

  function toggleMastered(id) {
    const p=progressOf(id);
    state.progress[id]={...p,mastered:!p.mastered};
    persist();render();
  }

  function speakWord(id) {
    const word=wordMap().get(id);
    if(!word)return;
    if(!("speechSynthesis" in window)){toast("النطق الصوتي غير مدعوم في هذا المتصفح.","error");return;}
    try{
      window.speechSynthesis.cancel();
      const utterance=new SpeechSynthesisUtterance(word.he);
      utterance.lang="he-IL";utterance.rate=.82;
      const voices=window.speechSynthesis.getVoices();
      const voice=voices.find(v=>/^he(-|_)/i.test(v.lang));
      if(voice)utterance.voice=voice;
      window.speechSynthesis.speak(utterance);
    }catch{toast("تعذر تشغيل النطق الصوتي.","error");}
  }

  function exportText(filename, content, type) {
    const blob=new Blob([content],{type});
    const url=URL.createObjectURL(blob);
    const anchor=document.createElement("a");
    anchor.href=url;anchor.download=filename;document.body.appendChild(anchor);anchor.click();anchor.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }

  function exportBackup() {
    try{
      exportText("mila-yaelnet-backup-"+localDate()+".json",STORE.exportBackup(state),"application/json;charset=utf-8");
      toast("تم تنزيل النسخة الاحتياطية. احتفظ بها خارج المتصفح.");
    }catch(error){toast(error.message||"تعذر إنشاء النسخة.","error");}
  }

  function importBackup() { $("backupFile")?.click(); }

  async function readBackupFile(file) {
    if(!file)return;
    if(file.size>2_000_000){toast("حجم الملف أكبر من 2 ميغابايت.","error");return;}
    try{
      const text=await file.text();
      const valid=STORE.validateBackup(text);
      if(!valid.ok){toast(valid.error,"error");return;}
      openModal("تأكيد استعادة النسخة","سيتم استبدال بيانات التعلم الحالية بالنسخة المستوردة. صدّر نسخة من بياناتك الحالية أولًا إذا أردت الاحتفاظ بها.",`<div class="helper-note">الكلمات الإضافية: ${valid.state.extras.length} · الجلسات: ${valid.state.sessions.length} · سجلات التقدم: ${Object.keys(valid.state.progress).length}</div>`,"استعادة البيانات",()=>{
        if(!STORE.importBackup(text,localStorage)){toast("تعذر استعادة البيانات.","error");return false;}
        Object.assign(state,valid.state);
        applySettings();render();toast("تمت استعادة النسخة الاحتياطية.");return true;
      });
    }catch{toast("تعذرت قراءة ملف النسخة الاحتياطية.","error");}
  }

  function exportCsv() {
    const rows=[["Hebrew","Arabic meaning","Source","Attempts","Correct","Accuracy","Favorite","Mastered"]];
    for(const word of allWords()){
      const p=progressOf(word.id),attempts=Number(p.attempts)||0,correct=Number(p.correct)||0;
      rows.push([word.he,word.ar,word.source,attempts,correct,attempts?Math.round(correct/attempts*100):0,p.favorite?"yes":"no",p.mastered?"yes":"no"]);
    }
    const csv="\uFEFF"+rows.map(row=>row.map(value=>'"'+String(value??"").replace(/"/g,'""')+'"').join(",")).join("\r\n");
    exportText("mila-vocabulary-"+localDate()+".csv",csv,"text/csv;charset=utf-8");
    toast("تم تصدير الكلمات وبيانات التقدم إلى CSV.");
  }

  function printReport() {
    window.print();
  }

  function setPreset(name) {
    const presets={
      quick:{source:"all",mode:"he-ar",count:10,optionCount:4,difficulty:"medium",timerSeconds:0,shuffle:true,noRepeat:true,feedback:"instant",excludeMastered:false,distractorScope:"library"},
      weak:{source:"weak",mode:"he-ar",count:"all",optionCount:4,difficulty:"medium",timerSeconds:0,shuffle:true,noRepeat:true,feedback:"instant",excludeMastered:false,distractorScope:"library"},
      exam:{source:"all",mode:"he-ar",count:20,optionCount:4,difficulty:"hard",timerSeconds:30,shuffle:true,noRepeat:true,feedback:"end",excludeMastered:false,distractorScope:"library"},
      reverse:{source:"all",mode:"ar-he",count:15,optionCount:4,difficulty:"hard",timerSeconds:20,shuffle:true,noRepeat:true,feedback:"instant",excludeMastered:false,distractorScope:"library"},
      due:{source:"due",mode:"he-ar",count:"all",optionCount:3,difficulty:"easy",timerSeconds:0,shuffle:true,noRepeat:true,feedback:"instant",excludeMastered:false,distractorScope:"library"}
    };
    ui.studioDraft={...ui.studioDraft,...presets[name]};
    ui.view="studio";render();
    toast("تم تطبيق قالب "+name+". راجع الإعدادات ثم أنشئ الجلسة.");
  }

  function savePreset() {
    const form = $("studioForm");
    if (form) {
      const values = new FormData(form);
      ui.studioDraft = {
        ...ui.studioDraft,
        source: String(values.get("source") || "all"),
        stageId: String(values.get("stageId") || ui.stageId || CATALOG.stages[0]?.id),
        mode: String(values.get("mode") || "he-ar"),
        count: values.get("count") === "all" ? "all" : Number(values.get("count") || 10),
        optionCount: Number(values.get("optionCount") || 4),
        difficulty: String(values.get("difficulty") || "medium"),
        timerSeconds: Number(values.get("timerSeconds") || 0),
        feedback: String(values.get("feedback") || "instant"),
        shuffle: form.querySelector('[name="shuffle"]')?.checked ?? false,
        noRepeat: form.querySelector('[name="noRepeat"]')?.checked ?? false,
        excludeMastered: form.querySelector('[name="excludeMastered"]')?.checked ?? false,
        distractorScope: String(values.get("distractorScope") || "library"),
        stageIds: [...form.querySelectorAll('[data-config="stageIds"]:checked')].map((x) => x.value)
      };
    }
    const name=prompt("اسم القالب الذي تريد حفظه:");
    if(!name?.trim())return;
    const presets=Array.isArray(state.settings.presets)?state.settings.presets:[];
    presets.push({id:uid(),name:name.trim().slice(0,50),config:{...ui.studioDraft,stageIds:[...(ui.studioDraft.stageIds||[])]}});
    state.settings.presets=presets.slice(-20);
    persist();
    renderStudio();
    toast("تم حفظ القالب وأصبح متاحًا في «قوالبي المحفوظة».");
  }

  function showShortcuts() {
    openModal("اختصارات لوحة المفاتيح","هذه الاختصارات تعمل داخل الجلسة عندما لا يكون المؤشر داخل حقل كتابة.",`
      <div class="shortcut-list">
        <div class="shortcut-item"><span>اختيار إجابة</span><kbd>1–5</kbd></div><div class="shortcut-item"><span>التالي / تحقق</span><kbd>Enter</kbd></div>
        <div class="shortcut-item"><span>كشف بطاقة</span><kbd>Space</kbd></div><div class="shortcut-item"><span>إيقاف مؤقت</span><kbd>P</kbd></div>
        <div class="shortcut-item"><span>إغلاق</span><kbd>Esc</kbd></div><div class="shortcut-item"><span>الرئيسية</span><kbd>1</kbd></div>
      </div>`,"فهمت",()=>true);
  }

  function handleAction(action, target) {
    const id=target.dataset.wordId;
    switch(action){
      case "go-dashboard": case "finish-to-dashboard": navigate("dashboard");break;
      case "open-studio": navigate("studio");break;
      case "open-studio-stage": ui.stageId=target.dataset.stageId;ui.studioDraft.source="stage";ui.studioDraft.stageIds=[ui.stageId];navigate("studio");break;
      case "open-stage": navigate("stage",{stageId:target.dataset.stageId,tab:"words"});break;
      case "stage-quiz": ui.stageId=target.dataset.stageId;startStudioSession({...ui.studioDraft,source:"stage",stageId:ui.stageId,stageIds:[ui.stageId],count:"all"});break;
      case "stage-tab": ui.stageTab=target.dataset.tab;renderStage();break;
      case "flip-card": ui.studyFlipped=!ui.studyFlipped;renderStage();break;
      case "next-card": ui.studyIndex=(ui.studyIndex+1)%stageWords(ui.stageId).length;ui.studyFlipped=false;renderStage();break;
      case "practice-stage-source": {
        const stageId=target.dataset.stageId || ui.stageId;
        const source=target.dataset.source || "stage";
        ui.stageId=stageId;
        startStudioSession({...ui.studioDraft,source,stageId,stageIds:[stageId],scopeStageOnly:source!=="stage",count:"all"});
        break;
      }
      case "practice-source": ui.studioDraft.source=target.dataset.source;startStudioSession({...ui.studioDraft,source:target.dataset.source,count:"all"});break;
      case "library-filter": ui.libraryFilter=target.dataset.filter;renderLibrary();break;
      case "review-filter": ui.reviewFilter=target.dataset.filter;renderReview();break;
      case "toggle-favorite": toggleFavorite(id);break;
      case "toggle-mastered": toggleMastered(id);break;
      case "rate-word": setReviewRating(id,target.dataset.rating);break;
      case "speak": speakWord(id);break;
      case "edit-extra": editExtra(id);break;
      case "delete-extra": deleteExtra(id);break;
      case "bulk-import": bulkImport();break;
      case "answer-choice": answerChoice(id);break;
      case "next-question": nextQuestion();break;
      case "pause-session": pauseSession();break;
      case "exit-session": if(confirm("هل تريد إنهاء الجلسة الحالية؟")){stopTimer();ui.session=null;navigate("dashboard");}break;
      case "reveal-flashcard": if(ui.session){ui.session.flashRevealed=true;renderSession();}break;
      case "flash-rate": rateFlashcard(target.dataset.rating);break;
      case "match-left": handleMatch("left",id);break;
      case "match-right": handleMatch("right",id);break;
      case "export-backup": exportBackup();break;
      case "import-backup": importBackup();break;
      case "export-csv": exportCsv();break;
      case "print-report": printReport();break;
      case "preset": setPreset(target.dataset.preset);break;
      case "save-preset": savePreset();break;
      case "apply-saved-preset": {
        const preset=(state.settings.presets||[]).find((item)=>item.id===target.dataset.presetId);
        if(!preset){toast("القالب غير موجود.","error");break;}
        ui.studioDraft={...ui.studioDraft,...preset.config,stageIds:[...(preset.config.stageIds||[])]};
        ui.view="studio";renderStudio();toast("تم تطبيق القالب: "+preset.name);break;
      }
      case "delete-saved-preset": {
        const before=state.settings.presets||[];
        state.settings.presets=before.filter((item)=>item.id!==target.dataset.presetId);
        persist();renderStudio();toast("تم حذف القالب.");break;
      }
      case "show-shortcuts": showShortcuts();break;
      case "toggle-theme": setTheme(state.settings.theme==="dark"?"light":"dark");render();break;
      case "toggle-sidebar": {
        const opening = !document.body.classList.contains("sidebar-open");
        document.body.classList.toggle("sidebar-open", opening);
        if ($("sidebarBackdrop")) $("sidebarBackdrop").hidden = !opening;
        break;
      }
      case "close-modal": $("modalRoot").innerHTML="";break;
      case "replay-wrong": {
        const record=ui.session?.summary || state.sessions[state.sessions.length-1];
        const words=(record?.wrongWordIds||[]).map((wordId)=>wordMap().get(wordId)).filter(Boolean);
        ui.session=null;beginSession(words,{mode:"he-ar",count:"all",distractorPool:allWords()},"إعادة الكلمات الخاطئة");break;
      }
      case "modal-backdrop": if(target === $("modalRoot").firstElementChild) $("modalRoot").innerHTML="";break;
    }
  }

  function bindEvents() {
    document.addEventListener("click",(event)=>{
      const button=event.target.closest("[data-action],[data-view]");
      if(!button)return;
      if(button.dataset.view && !button.dataset.action){event.preventDefault();navigate(button.dataset.view);return;}
      if(button.dataset.action){event.preventDefault();handleAction(button.dataset.action,button);}
    });

    document.addEventListener("submit",(event)=>{
      if(event.target.id==="extraForm"){addExtra(event);return;}
      if(event.target.id==="typedForm"){event.preventDefault();answerTyped(event.target.elements.answer.value);return;}
      if(event.target.id==="studioForm"){
        event.preventDefault();
        const form=event.target;
        const values=new FormData(form);
        const selectedStages=[...form.querySelectorAll('[data-config="stageIds"]:checked')].map((x)=>x.value);
        ui.studioDraft={
          source:String(values.get("source")||"all"),
          mode:String(values.get("mode")||"he-ar"),
          count:values.get("count")==="all"?"all":Number(values.get("count")||10),
          optionCount:Number(values.get("optionCount")||4),
          difficulty:String(values.get("difficulty")||"medium"),
          timerSeconds:Number(values.get("timerSeconds")||0),
          shuffle:(form.querySelector('[name="shuffle"]')?.checked ?? false),
          noRepeat:(form.querySelector('[name="noRepeat"]')?.checked ?? false),
          feedback:String(values.get("feedback")||"instant"),
          excludeMastered:(form.querySelector('[name="excludeMastered"]')?.checked ?? false),
          distractorScope:String(values.get("distractorScope")||"library"),
          stageIds:selectedStages,
          stageId:String(values.get("stageId") || ui.stageId || CATALOG.stages[0]?.id)
        };
        if(ui.studioDraft.source==="selected-stages"&&!selectedStages.length){toast("اختر مرحلة واحدة على الأقل.","error");return;}
        startStudioSession(ui.studioDraft);
      }
    });

    document.addEventListener("change",(event)=>{
      if(event.target.id==="sourceSelect")updateStudioAvailability();
      if(event.target.id==="singleStageSelect"){ui.studioDraft.stageId=event.target.value;updateStudioAvailability();}
      if(event.target.id==="backupFile"){readBackupFile(event.target.files?.[0]);event.target.value="";}
      if(event.target.id==="dailyGoalSetting"){
        state.settings.dailyGoal=clamp(Number(event.target.value)||10,1,100);persist();toast("تم تحديث الهدف اليومي.");renderSettings();
      }
      if(event.target.dataset.setting){
        state.settings[event.target.dataset.setting]=event.target.checked;persist();applySettings();toast("تم حفظ الإعداد.");
      }
      if(event.target.dataset.config==="stageIds"){
        ui.studioDraft.stageIds=[...document.querySelectorAll('[data-config="stageIds"]:checked')].map(x=>x.value);
        updateStudioAvailability();
      }
    });

    document.addEventListener("input",(event)=>{
      if(event.target.dataset.input==="library-search"){
        ui.librarySearch=event.target.value;
        const scroll=window.scrollY;
        renderLibrary();window.scrollTo(0,scroll);
        const field=document.querySelector('[data-input="library-search"]');
        field?.focus();field?.setSelectionRange(field.value.length,field.value.length);
      }
      if(event.target.dataset.input==="stage-search"){
        ui.stageSearch=event.target.value;
        const scroll=window.scrollY;
        renderStage();window.scrollTo(0,scroll);
        const field=document.querySelector('[data-input="stage-search"]');
        field?.focus();field?.setSelectionRange(field.value.length,field.value.length);
      }
    });

    document.addEventListener("keydown",(event)=>{
      if(event.key==="Escape"){
        if($("modalRoot").innerHTML){$("modalRoot").innerHTML="";return;}
        if(document.body.classList.contains("sidebar-open"))document.body.classList.remove("sidebar-open");
        return;
      }
      if(["INPUT","TEXTAREA","SELECT"].includes(document.activeElement?.tagName))return;
      if(!ui.session||ui.session.finished){
        if(event.key==="1") navigate("dashboard");
        return;
      }
      if(event.key.toLowerCase()==="p"){pauseSession();return;}
      if(event.key===" "&&ui.session.mode==="flashcards"){event.preventDefault();ui.session.flashRevealed=!ui.session.flashRevealed;renderSession();return;}
      if(event.key==="Enter"&&ui.session.answered){nextQuestion();return;}
      if(ui.session.mode==="he-ar"||ui.session.mode==="ar-he"){
        const index=Number(event.key)-1;
        const choices=ui.session.questions[ui.session.current]?.choices||[];
        if(index>=0&&index<choices.length)answerChoice(choices[index].wordId);
      }
    });

    $("sidebarBackdrop")?.addEventListener("click",()=>{document.body.classList.remove("sidebar-open");$("sidebarBackdrop").hidden=true;});
  }

  function registerPwa() {
    if(!("serviceWorker" in navigator))return;
    window.addEventListener("load",()=>navigator.serviceWorker.register("/sw.js",{scope:"/"}).catch(()=>{}),{once:true});
  }

  function initialize() {
    applySettings();
    bindEvents();
    render();
    registerPwa();
    if(!Array.isArray(state.extras))state.extras=[];
  }

  initialize();
})();