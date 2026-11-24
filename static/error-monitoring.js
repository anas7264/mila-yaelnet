(function attachMilaErrorMonitoring(global) {
  "use strict";

  const SDK_URL = "https://browser.sentry-cdn.com/11.17.0/bundle.min.js";
  const MAX_PENDING_ERRORS = 12;
  const pending = [];
  let sentry = null;
  let enabled = false;
  let failed = false;

  function redact(value) {
    return String(value ?? "")
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]")
      .replace(/\bBearer\s+[A-Z0-9._~+/-]+=*/gi, "Bearer [redacted]")
      .replace(/\beyJ[A-Z0-9_-]{8,}\.[A-Z0-9_-]{8,}\.[A-Z0-9_-]{4,}\b/g, "[redacted-token]")
      .replace(/((?:password|passwd|secret|token|api[_-]?key|authorization|access[_-]?key)\s*[:=]\s*)[^\s,;]+/gi, "$1[redacted]")
      .replace(/([?&](?:token|code|key|secret|password|email)=)[^&#\s]+/gi, "$1[redacted]")
      .slice(0, 3000);
  }

  function safeError(value) {
    if (value instanceof Error) {
      const error = new Error(redact(value.message || value.name || "Browser error"));
      error.name = redact(value.name || "Error").slice(0, 80);
      if (value.stack) error.stack = redact(value.stack);
      return error;
    }
    if (value && typeof value === "object" && typeof value.message === "string") {
      return new Error(redact(value.message));
    }
    return new Error("Unhandled promise rejection (non-Error value)");
  }

  function safeTags(input) {
    const result = {};
    const allowed = new Set(["area", "action", "view", "phase", "component"]);
    if (!input || typeof input !== "object") return result;
    for (const [key, value] of Object.entries(input).slice(0, 6)) {
      if (!allowed.has(key) || typeof value !== "string") continue;
      if (!/^[a-zA-Z0-9._:-]{1,60}$/.test(value)) continue;
      result[key] = value;
    }
    return result;
  }

  function scrubEvent(event) {
    if (!event || typeof event !== "object") return null;
    delete event.user;
    delete event.request;
    delete event.breadcrumbs;
    delete event.extra;
    if (typeof event.message === "string") event.message = redact(event.message);
    if (typeof event.transaction === "string") event.transaction = redact(event.transaction).split("?")[0].split("#")[0];

    const values = event.exception?.values;
    if (Array.isArray(values)) {
      for (const item of values) {
        if (typeof item.value === "string") item.value = redact(item.value);
        const frames = item.stacktrace?.frames;
        if (Array.isArray(frames)) {
          for (const frame of frames) {
            delete frame.vars;
            if (typeof frame.filename === "string") frame.filename = redact(frame.filename).split("?")[0].split("#")[0];
            if (typeof frame.abs_path === "string") frame.abs_path = redact(frame.abs_path).split("?")[0].split("#")[0];
          }
        }
      }
    }

    const tags = safeTags(event.tags);
    event.tags = tags;
    return event;
  }

  function send(entry) {
    if (!sentry || !enabled) return;
    try {
      sentry.withScope(scope => {
        for (const [key, value] of Object.entries(entry.tags)) scope.setTag(key, value);
        sentry.captureException(entry.error);
      });
    } catch (_) {
      // Monitoring must never interfere with learning or persistence.
    }
  }

  function captureException(value, tags) {
    const entry = { error: safeError(value), tags: safeTags(tags) };
    if (sentry && enabled) {
      send(entry);
      return true;
    }
    if (!failed && pending.length < MAX_PENDING_ERRORS) pending.push(entry);
    return false;
  }

  function loadSdk() {
    return new Promise((resolve, reject) => {
      if (global.Sentry) return resolve(global.Sentry);
      const script = global.document.createElement("script");
      script.src = SDK_URL;
      script.async = true;
      script.crossOrigin = "anonymous";
      script.referrerPolicy = "no-referrer";
      script.onload = () => global.Sentry ? resolve(global.Sentry) : reject(new Error("Monitoring SDK global missing"));
      script.onerror = () => reject(new Error("Monitoring SDK could not be loaded"));
      global.document.head.appendChild(script);
    });
  }

  global.MilaErrorMonitor = Object.freeze({
    captureException,
    isEnabled: () => enabled
  });

  global.addEventListener("error", event => {
    // Ignore resource-loading errors; report uncaught JavaScript exceptions only.
    if (event.target && event.target !== global) return;
    captureException(event.error || new Error(event.message || "Uncaught browser error"), {
      area: "browser",
      phase: "uncaught-error"
    });
  });

  global.addEventListener("unhandledrejection", event => {
    captureException(event.reason, {
      area: "browser",
      phase: "unhandled-rejection"
    });
  });

  async function initialize() {
    if (typeof global.fetch !== "function") {
      failed = true;
      return;
    }

    let config;
    try {
      const response = await global.fetch("/api/monitoring-config", {
        method: "GET",
        cache: "no-store",
        credentials: "same-origin",
        headers: { Accept: "application/json" }
      });
      if (!response.ok) throw new Error("Monitoring configuration unavailable");
      config = await response.json();
    } catch (_) {
      failed = true;
      pending.length = 0;
      return;
    }

    if (!config?.enabled || typeof config.dsn !== "string" || !config.dsn.startsWith("https://")) {
      failed = true;
      pending.length = 0;
      return;
    }

    try {
      const sdk = await loadSdk();
      if (typeof sdk.init !== "function" || typeof sdk.captureException !== "function") {
        throw new Error("Unsupported browser monitoring SDK");
      }
      sdk.init({
        dsn: config.dsn,
        environment: config.environment || "production",
        release: config.release || undefined,
        sendDefaultPii: false,
        autoSessionTracking: false,
        tracesSampleRate: 0,
        maxBreadcrumbs: 0,
        defaultIntegrations: false,
        integrations: [],
        beforeSend: scrubEvent
      });
      sentry = sdk;
      enabled = true;
      while (pending.length) send(pending.shift());
    } catch (_) {
      failed = true;
      pending.length = 0;
    }
  }

  initialize();
})(window);
