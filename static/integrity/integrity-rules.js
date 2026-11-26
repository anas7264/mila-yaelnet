"use strict";

(function attachMilaIntegrityRules(root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.MilaIntegrityRules = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createRules() {
  const STATUS = Object.freeze({ PASS: "PASS", FAIL: "FAIL", WARN: "WARN", UNKNOWN: "UNKNOWN" });
  const SEVERITY = Object.freeze({ LOW: "LOW", MEDIUM: "MEDIUM", HIGH: "HIGH" });
  const isObject = value => Boolean(value) && typeof value === "object" && !Array.isArray(value);
  const integer = value => Number.isSafeInteger(value) && value >= 0;
  const result = (id, status, severity, message, evidence = {}) => ({
    id, status, severity, message, evidence
  });
  const unknown = (id, message, evidence) => result(id, STATUS.UNKNOWN, SEVERITY.MEDIUM, message, evidence);

  function checkSessionStructure(state) {
    const session = state?.session;
    if (session == null) return result("session_structure", STATUS.PASS, SEVERITY.LOW, "لا توجد جلسة نشطة.", { active: false });
    if (!isObject(session) || !["he-ar", "ar-he"].includes(session.direction) ||
        !Array.isArray(session.queue) || session.queue.some(id => typeof id !== "string" || !id) ||
        typeof session.id !== "string" || !session.id ||
        !integer(session.cycle) || session.cycle < 1 ||
        typeof session.answered !== "boolean" || typeof session.paused !== "boolean") {
      return result("session_structure", STATUS.FAIL, SEVERITY.HIGH, "بنية الجلسة أو معرفاتها غير صالحة.");
    }
    return result("session_structure", STATUS.PASS, SEVERITY.LOW, "بنية الجلسة الأساسية سليمة.", {
      queueLength: session.queue.length
    });
  }

  function checkCursorBounds(state) {
    const session = state?.session;
    if (!session) return result("cursor_bounds", STATUS.PASS, SEVERITY.LOW, "لا يوجد مؤشر جلسة نشطة.", { active: false });
    if (!Array.isArray(session.queue) || !integer(session.cursor) || session.cursor > session.queue.length) {
      return result("cursor_bounds", STATUS.FAIL, SEVERITY.HIGH, "مؤشر الجلسة خارج حدود الطابور.", {
        cursor: Number.isFinite(session.cursor) ? session.cursor : null,
        queueLength: Array.isArray(session.queue) ? session.queue.length : null
      });
    }
    if (session.cursor === session.queue.length && session.answered !== true) {
      return result("cursor_bounds", STATUS.FAIL, SEVERITY.MEDIUM, "وصل المؤشر إلى نهاية الطابور دون وضع الجلسة في حالة answered.");
    }
    return result("cursor_bounds", STATUS.PASS, SEVERITY.LOW, "المؤشر ضمن حدود الطابور.", {
      cursor: session.cursor, queueLength: session.queue.length
    });
  }

  function checkAnswerAccounting(state) {
    const s = state?.session;
    if (!s) return result("answer_accounting", STATUS.PASS, SEVERITY.LOW, "لا توجد عدادات جلسة نشطة.", { active: false });
    if (![s.attempts, s.correct, s.incorrect].every(integer)) {
      return result("answer_accounting", STATUS.FAIL, SEVERITY.HIGH, "عدادات الإجابات ليست أعداداً صحيحة غير سالبة.");
    }
    if (s.attempts !== s.correct + s.incorrect) {
      return result("answer_accounting", STATUS.FAIL, SEVERITY.HIGH, "إجمالي المحاولات لا يساوي مجموع الصحيحة والخاطئة.", {
        attempts: s.attempts, correct: s.correct, incorrect: s.incorrect
      });
    }
    return result("answer_accounting", STATUS.PASS, SEVERITY.LOW, "عدادات الإجابات متطابقة.", {
      attempts: s.attempts, correct: s.correct, incorrect: s.incorrect
    });
  }

  function checkResultConsistency(state) {
    const s = state?.session;
    if (!s) return result("result_consistency", STATUS.PASS, SEVERITY.LOW, "لا توجد نتائج جلسة نشطة.", { active: false });
    if (!Array.isArray(s.results)) return result("result_consistency", STATUS.FAIL, SEVERITY.HIGH, "حقل نتائج الجلسة ليس مصفوفة.");
    const malformed = s.results.filter(item => !isObject(item) ||
      typeof item.questionId !== "string" || !item.questionId ||
      typeof item.wordId !== "string" || !item.wordId || typeof item.correct !== "boolean");
    if (malformed.length) {
      return result("result_consistency", STATUS.FAIL, SEVERITY.HIGH, "توجد نتائج إجابة ناقصة أو غير صالحة.", {
        malformedCount: malformed.length, resultCount: s.results.length
      });
    }
    const questionIds = s.results.map(item => item.questionId);
    const duplicateQuestionIds = questionIds.filter((id, index) => questionIds.indexOf(id) !== index);
    if (duplicateQuestionIds.length) {
      return result("result_consistency", STATUS.FAIL, SEVERITY.HIGH, "يوجد أكثر من سجل نتيجة لمعرف السؤال نفسه.", {
        duplicateQuestionCount: new Set(duplicateQuestionIds).size
      });
    }
    const correct = s.results.filter(item => item.correct).length;
    const incorrect = s.results.length - correct;
    if (s.attempts <= 10000 && s.results.length !== s.attempts) {
      return result("result_consistency", STATUS.FAIL, SEVERITY.HIGH, "عدد النتائج لا يطابق عدد المحاولات ضمن حد الاحتفاظ الكامل.", {
        resultCount: s.results.length, attempts: s.attempts
      });
    }
    if (s.attempts <= 10000 && (correct !== s.correct || incorrect !== s.incorrect)) {
      return result("result_consistency", STATUS.FAIL, SEVERITY.HIGH, "توزيع النتائج لا يطابق عدادات الجلسة.", {
        resultCorrect: correct, resultIncorrect: incorrect,
        correct: s.correct, incorrect: s.incorrect
      });
    }
    if (s.attempts > 10000) {
      return result("result_consistency", STATUS.WARN, SEVERITY.MEDIUM, "وصلت الجلسة إلى حد الاحتفاظ بالنتائج؛ لا يمكن مقارنة السجل الكامل بالعدادات.", {
        retainedResults: s.results.length, attempts: s.attempts
      });
    }
    return result("result_consistency", STATUS.PASS, SEVERITY.LOW, "سجل النتائج متوافق مع عدادات الجلسة.", {
      resultCount: s.results.length
    });
  }

  function checkRetryEligibility(state) {
    const s = state?.session;
    if (!s) return result("retry_eligibility", STATUS.PASS, SEVERITY.LOW, "لا توجد جلسة نشطة.", { active: false });
    if (!Array.isArray(s.queue) || !isObject(s.retryCounts)) {
      return result("retry_eligibility", STATUS.FAIL, SEVERITY.HIGH, "بيانات الطابور أو عدادات الإعادة غير صالحة.");
    }
    const policy = isObject(state.policy) ? state.policy : {};
    const minDelay = Number.isInteger(policy.minDelay) ? policy.minDelay : 2;
    const maxDelay = Number.isInteger(policy.maxDelay) ? policy.maxDelay : 4;
    const maxRetries = Number.isInteger(policy.maxRetries) ? policy.maxRetries : 3;
    const minDelay = Number.isInteger(policy.minDelay) ? policy.minDelay : 2;
    const maxDelay = Number.isInteger(policy.maxDelay) ? policy.maxDelay : 4;
    if (minDelay < 1 || minDelay > 8 || maxDelay < minDelay || maxDelay > 12 ||
        maxRetries < 1 || maxRetries > 5) {
      return result("retry_limits", STATUS.FAIL, SEVERITY.HIGH, "سياسة إعادة المحاولة خارج الحدود التي يقبلها محرك MILA.", {
        minDelay, maxDelay, maxRetries
      });
    }
    const invalid = Object.entries(s.retryCounts).filter(([id, count]) =>
      !id || !integer(count) || count > maxRetries
    );
    if (invalid.length) {
      return result("retry_eligibility", STATUS.FAIL, SEVERITY.HIGH, "توجد عدادات إعادة محاولة غير صالحة أو تتجاوز السياسة.", {
        invalidCounterCount: invalid.length, maxRetries
      });
    }
    return unknown("retry_eligibility",
      "لا يمكن إثبات توقيت إعادة الإدراج من snapshot وحدها؛ يلزم سجل أحداث مرتب لكل إجابة.",
      { minDelay, maxDelay, maxRetries, trackedRetryWords: Object.keys(s.retryCounts).length });
  }

  function checkRetryLimits(state) {
    const s = state?.session;
    if (!s) return result("retry_limits", STATUS.PASS, SEVERITY.LOW, "لا توجد جلسة نشطة.", { active: false });
    const maxRetries = Number.isInteger(state?.policy?.maxRetries) ? state.policy.maxRetries : 3;
    const counts = isObject(s.retryCounts) ? Object.values(s.retryCounts) : [];
    const invalid = counts.filter(count => !integer(count) || count > maxRetries);
    return invalid.length
      ? result("retry_limits", STATUS.FAIL, SEVERITY.HIGH, "تم تجاوز حد إعادة المحاولة أو تخزين عداد غير صالح.", { invalidCount: invalid.length, maxRetries })
      : result("retry_limits", STATUS.PASS, SEVERITY.LOW, "عدادات الإعادة لا تتجاوز الحد المعلن.", { trackedWords: counts.length, maxRetries });
  }

  function checkQuestionIdentity(state) {
    const s = state?.session;
    if (!s) return result("question_identity", STATUS.PASS, SEVERITY.LOW, "لا توجد جلسة نشطة.", { active: false });
    if (!Array.isArray(s.queue) || !integer(s.cursor) || s.cursor >= s.queue.length) {
      return unknown("question_identity", "لا يوجد سؤال حالي يمكن مطابقة هويته.");
    }
    const expected = String(s.id || "") + ":" + String(s.cycle || 1) + ":" + s.cursor + ":" + s.queue[s.cursor];
    if (typeof s.questionId !== "string" || s.questionId !== expected) {
      return result("question_identity", STATUS.FAIL, SEVERITY.HIGH, "معرف السؤال الحالي لا يطابق الجلسة والطابور والمؤشر.", {
        hasQuestionId: typeof s.questionId === "string" && Boolean(s.questionId)
      });
    }
    return result("question_identity", STATUS.PASS, SEVERITY.LOW, "معرف السؤال الحالي متوافق مع موضعه.", {
      cursor: s.cursor, cycle: s.cycle
    });
  }

  function checkEventConsistency(input) {
    const eventIds = input?.adaptiveEventIds || input?.eventIds;
    const learningEvents = input?.learningEvents;
    if (!isObject(learningEvents) || !isObject(eventIds)) {
      const events = input?.events;
      if (!Array.isArray(events) || !isObject(eventIds)) {
        return unknown("event_consistency", "لم تُقدّم مصادر الأحداث ومعرفاتها؛ لا يُفترض وجود سجل إجابات تاريخي كامل.");
      }
      const ids = events.map(event => event?.eventId);
      const missingIds = ids.filter(id => typeof id !== "string" || !id);
      const duplicateIds = ids.filter((id, index) => typeof id === "string" && ids.indexOf(id) !== index);
      const eventIdSet = new Set(ids.filter(id => typeof id === "string"));
      const orphanIds = Object.keys(eventIds).filter(key => {
        const id = key.startsWith("answer:") ? key.slice(7) : key;
        return !eventIdSet.has(id);
      });
      if (missingIds.length || duplicateIds.length || orphanIds.length) {
        return result("event_consistency", STATUS.FAIL, SEVERITY.MEDIUM, "توجد معرفات أحداث مفقودة أو مكررة أو مراجع يتيمة.", {
          missingIds: missingIds.length, duplicateIds: new Set(duplicateIds).size, orphanIds: orphanIds.length
        });
      }
      return result("event_consistency", STATUS.PASS, SEVERITY.LOW, "معرفات الأحداث المقدمة متسقة.", { eventCount: events.length });
    }

    const eventEntries = Object.entries(learningEvents);
    const ledgerKeys = Object.keys(eventIds);
    const seen = new Set();
    let missingIds = 0, duplicateIds = 0, malformedEvents = 0, keyMismatches = 0;
    for (const [key, event] of eventEntries) {
      if (!key.startsWith("answer:") || !isObject(event) ||
          typeof event.eventId !== "string" || !event.eventId ||
          typeof event.wordId !== "string" || !event.wordId ||
          typeof event.correct !== "boolean") {
        malformedEvents += 1;
        continue;
      }
      const expectedKey = "answer:" + event.eventId;
      if (key !== expectedKey) keyMismatches += 1;
      if (seen.has(event.eventId)) duplicateIds += 1;
      seen.add(event.eventId);
    }
    const eventKeys = new Set(eventEntries.map(([key]) => key));
    const orphanIds = ledgerKeys.filter(key => !eventKeys.has(key));
    const untrackedEvents = eventEntries.filter(([key]) => !Object.prototype.hasOwnProperty.call(eventIds, key)).length;
    missingIds += eventEntries.filter(([, event]) => !event?.eventId).length;
    if (missingIds || duplicateIds || malformedEvents || keyMismatches || orphanIds.length || untrackedEvents) {
      return result("event_consistency", STATUS.FAIL, SEVERITY.MEDIUM, "سجل الإجابات ومعرفات منع التكرار غير متطابقة.", {
        missingIds, duplicateIds, malformedEvents, keyMismatches,
        orphanIds: orphanIds.length, untrackedEvents
      });
    }
    return result("event_consistency", STATUS.PASS, SEVERITY.LOW, "سجل الإجابات ومعرفات منع التكرار متطابقة ضمن نافذة الاحتفاظ المحلية.", {
      eventCount: eventEntries.length
    });
  }

  function stable(value) {
    if (Array.isArray(value)) return "[" + value.map(stable).join(",") + "]";
    if (!isObject(value)) return JSON.stringify(value);
    return "{" + Object.keys(value).sort().map(key => JSON.stringify(key) + ":" + stable(value[key])).join(",") + "}";
  }

  function checkSnapshotConsistency(input) {
    const local = input?.localSnapshot, cloud = input?.cloudSnapshot;
    if (!isObject(local) || !isObject(cloud)) {
      return unknown("snapshot_consistency", "تتطلب المقارنة لقطتين صالحتين من مصدرين معروفين.");
    }
    const localRevision = input.localRevision, cloudRevision = input.cloudRevision;
    if (!integer(localRevision) || !integer(cloudRevision)) {
      return unknown("snapshot_consistency", "إصدارات اللقطات غير متاحة أو غير صالحة.");
    }
    if (localRevision !== cloudRevision) {
      return result("snapshot_consistency", STATUS.WARN, SEVERITY.MEDIUM, "الإصداران مختلفان؛ قد يكون هناك تحديث محلي أو مزامنة معلقة.", {
        localRevision, cloudRevision
      });
    }
    if (stable(local) !== stable(cloud)) {
      return result("snapshot_consistency", STATUS.FAIL, SEVERITY.HIGH, "لقطتان مختلفتان تحملان رقم revision نفسه.", {
        revision: localRevision
      });
    }
    return result("snapshot_consistency", STATUS.PASS, SEVERITY.LOW, "اللقطتان متطابقتان عند revision نفسه.", { revision: localRevision });
  }

  function checkSyncIntegrity(input) {
    const ledger = input?.syncLedger;
    if (!isObject(ledger)) return unknown("sync_integrity", "فحص سجل mutations يتطلب بيانات مجمعة من بيئة موثوقة.");
    const { snapshotRevision, ledgerCount, minRevision, maxRevision, distinctRevisions, lastMutationPresent } = ledger;
    if (![snapshotRevision, ledgerCount, minRevision, maxRevision, distinctRevisions].every(integer) ||
        typeof lastMutationPresent !== "boolean") {
      return result("sync_integrity", STATUS.FAIL, SEVERITY.HIGH, "بيانات فحص سجل المزامنة غير مكتملة أو غير صالحة.");
    }
    if (ledgerCount === 0) {
      return snapshotRevision === 0
        ? result("sync_integrity", STATUS.PASS, SEVERITY.LOW, "لا توجد mutations ولا revision متقدم.")
        : result("sync_integrity", STATUS.WARN, SEVERITY.MEDIUM, "لا توجد سجلات ledger رغم وجود revision محفوظ.", { snapshotRevision });
    }
    if (maxRevision !== snapshotRevision || distinctRevisions !== ledgerCount || !lastMutationPresent) {
      return result("sync_integrity", STATUS.FAIL, SEVERITY.HIGH, "سجل mutations لا يتوافق مع revision أو معرف آخر mutation.", {
        snapshotRevision, maxRevision, ledgerCount, distinctRevisions, lastMutationPresent
      });
    }
    if (minRevision > 1 || maxRevision - minRevision + 1 !== ledgerCount) {
      return result("sync_integrity", STATUS.WARN, SEVERITY.MEDIUM, "توجد فجوات أو بداية متأخرة في سجل mutations؛ قد يكون ذلك بسبب بدء التسجيل بعد إنشاء الحساب.", {
        minRevision, maxRevision, ledgerCount
      });
    }
    return result("sync_integrity", STATUS.PASS, SEVERITY.LOW, "سجل mutations متصل ومتوافق مع اللقطة.", {
      snapshotRevision, ledgerCount
    });
  }

  function run(input = {}) {
    const state = input.localState;
    if (!isObject(state)) throw new TypeError("LIM requires a localState object");
    const checks = [
      checkSessionStructure(state),
      checkCursorBounds(state),
      checkAnswerAccounting(state),
      checkResultConsistency(state),
      checkRetryEligibility(state),
      checkRetryLimits(state),
      checkQuestionIdentity(state),
      checkEventConsistency(input),
      checkSnapshotConsistency(input),
      checkSyncIntegrity(input)
    ];
    const status = checks.some(item => item.status === STATUS.FAIL) ? STATUS.FAIL
      : checks.some(item => item.status === STATUS.WARN) ? STATUS.WARN
      : checks.some(item => item.status === STATUS.UNKNOWN) ? STATUS.UNKNOWN : STATUS.PASS;
    return Object.freeze({
      monitor: "LIM", version: 1, mode: "read-only", status,
      summary: { total: checks.length, pass: checks.filter(x => x.status === STATUS.PASS).length,
        fail: checks.filter(x => x.status === STATUS.FAIL).length,
        warn: checks.filter(x => x.status === STATUS.WARN).length,
        unknown: checks.filter(x => x.status === STATUS.UNKNOWN).length },
      checks
    });
  }

  return Object.freeze({ STATUS, SEVERITY, run });
});
