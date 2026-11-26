"use strict";

(function attachMilaIntegrityMonitor(root) {
  const rules = root?.MilaIntegrityRules ||
    (typeof module !== "undefined" && module.exports ? require("./integrity-rules.js") : null);
  if (!rules) throw new Error("MilaIntegrityRules must be loaded before the monitor.");

  function inspectLocalStorage(storage, key) {
    if (!storage || typeof storage.getItem !== "function" || typeof key !== "string" || !key) {
      throw new TypeError("A Storage-like object and explicit key are required.");
    }
    const raw = storage.getItem(key);
    if (raw == null) return { available: false, state: null, reason: "missing" };
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return { available: false, state: null, reason: "invalid-shape" };
      }
      return { available: true, state: parsed, reason: null };
    } catch (_) {
      return { available: false, state: null, reason: "invalid-json" };
    }
  }

  function inspectMilaStorage(storage) {
    if (!storage || typeof storage.getItem !== "function") {
      throw new TypeError("A Storage-like object is required.");
    }
    const readObject = key => {
      try {
        const raw = storage.getItem(key);
        if (raw == null) return { available: false, value: null, reason: "missing" };
        const value = JSON.parse(raw);
        if (!value || typeof value !== "object" || Array.isArray(value)) {
          return { available: false, value: null, reason: "invalid-shape" };
        }
        return { available: true, value, reason: null };
      } catch (_) {
        return { available: false, value: null, reason: "invalid-json-or-storage-error" };
      }
    };
    const adaptive = readObject("mila-yaelnet-adaptive-v1");
    const platform = readObject("mila-yaelnet-studio-v3");
    if (!adaptive.available) {
      return { available: false, localState: null, reason: "adaptive-" + adaptive.reason };
    }
    const eventsAvailable = platform.available &&
      platform.value.learningEvents && typeof platform.value.learningEvents === "object" &&
      !Array.isArray(platform.value.learningEvents) &&
      platform.value.adaptiveEventIds && typeof platform.value.adaptiveEventIds === "object" &&
      !Array.isArray(platform.value.adaptiveEventIds);
    return {
      available: true,
      localState: adaptive.value,
      learningEvents: eventsAvailable ? platform.value.learningEvents : null,
      adaptiveEventIds: eventsAvailable ? platform.value.adaptiveEventIds : null,
      eventSourceAvailable: Boolean(eventsAvailable),
      reason: platform.available ? null : "platform-" + platform.reason
    };
  }

  function create(input = {}) {
    if (!input.localState || typeof input.localState !== "object" || Array.isArray(input.localState)) {
      throw new TypeError("localState must be supplied explicitly.");
    }
    return rules.run(input);
  }

  const api = Object.freeze({ create, inspectLocalStorage, inspectMilaStorage });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.MilaIntegrityMonitor = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
