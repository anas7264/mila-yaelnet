export const SNAPSHOT_FORMAT='mila-localstorage-snapshot',SNAPSHOT_VERSION=1;
const LEARNING_PREFIX='mila-yaelnet-';
export function isLearningStorageKey(k){return typeof k==='string'&&k.startsWith(LEARNING_PREFIX)}
export function isInternalStorageKey(k){return !isLearningStorageKey(k)}
export function createSnapshot(a){if(!Array.isArray(a))throw TypeError('Storage entries must be an array');return{format:SNAPSHOT_FORMAT,version:SNAPSHOT_VERSION,entries:a.filter(e=>Array.isArray(e)&&e.length===2&&isLearningStorageKey(e[0])).map(([k,v])=>[k,String(v??'')]).sort(([a],[b])=>a<b?-1:a>b?1:0)}}
export function isSnapshot(v){return!!v&&v.format===SNAPSHOT_FORMAT&&v.version===SNAPSHOT_VERSION&&Array.isArray(v.entries)&&v.entries.every(e=>Array.isArray(e)&&e.length===2&&typeof e[0]==='string'&&typeof e[1]==='string')}
export function isSameSnapshot(a,b){return isSnapshot(a)&&isSnapshot(b)&&JSON.stringify(createSnapshot(a.entries))===JSON.stringify(createSnapshot(b.entries))}
export function hasSnapshotEntries(v){return isSnapshot(v)&&createSnapshot(v.entries).entries.length>0}



export function createStatusController(getElement, initialMessage = 'جارٍ تهيئة المزامنة…') {
  if (typeof getElement !== 'function') throw new TypeError('getElement must be a function');
  let message = String(initialMessage);
  let state = 'info';

  function render() {
    const element = getElement();
    if (!element) return false;
    if (element.textContent !== message) element.textContent = message;
    if (element.dataset?.state !== state && element.dataset) element.dataset.state = state;
    return true;
  }

  return {
    set(nextMessage, nextState = 'info') {
      message = String(nextMessage ?? '');
      state = String(nextState ?? 'info');
      return render();
    },
    render,
    getState() {
      return { message, state };
    }
  };
}

/**
 * Owns one user-scoped Realtime channel and retries terminal subscription
 * failures with bounded exponential backoff. stop() invalidates callbacks
 * and pending timers so stale sessions cannot reconnect.
 */
export function createRealtimeRetryManager({
  createChannel,
  removeChannel,
  canConnect = () => true,
  onStatus = () => {},
  setTimeoutImpl = globalThis.setTimeout,
  clearTimeoutImpl = globalThis.clearTimeout,
  baseDelayMs = 1000,
  maxDelayMs = 30000,
} = {}) {
  if (typeof createChannel !== "function" || typeof removeChannel !== "function") {
    throw new TypeError("createChannel and removeChannel must be functions");
  }
  if (typeof canConnect !== "function" || typeof onStatus !== "function") {
    throw new TypeError("canConnect and onStatus must be functions");
  }
  if (typeof setTimeoutImpl !== "function" || typeof clearTimeoutImpl !== "function") {
    throw new TypeError("Timer implementations must be functions");
  }
  if (!Number.isFinite(baseDelayMs) || baseDelayMs < 1 ||
      !Number.isFinite(maxDelayMs) || maxDelayMs < baseDelayMs) {
    throw new RangeError("Retry delays must be positive and maxDelayMs must be at least baseDelayMs");
  }

  let started = false;
  let activeChannel = null;
  let retryTimer = null;
  let retryCount = 0;
  let generation = 0;
  let cleanupPromise = Promise.resolve();

  const report = (state, error = null, retryDelayMs = null) => {
    try {
      onStatus(state, error, retryDelayMs);
    } catch {
      // UI callbacks must not break channel lifecycle management.
    }
  };

  const canStart = () => {
    if (!started) return false;
    try {
      return Boolean(canConnect());
    } catch (error) {
      report("CHANNEL_ERROR", error);
      return false;
    }
  };

  const removeSafely = (channel) => {
    if (!channel) return Promise.resolve();
    try {
      // Unsubscribe synchronously: pagehide/freeze may suspend queued microtasks.
      return Promise.resolve(removeChannel(channel))
        .catch((error) => report("REMOVE_ERROR", error));
    } catch (error) {
      report("REMOVE_ERROR", error);
      return Promise.resolve();
    }
  };

  const scheduleRetry = (state, error, failedChannel, token) => {
    if (!started || token !== generation) return;
    if (activeChannel === failedChannel) activeChannel = null;

    const retryDelayMs = Math.min(
      maxDelayMs,
      baseDelayMs * (2 ** Math.min(retryCount, 30))
    );
    retryCount += 1;
    report(state, error, retryDelayMs);

    cleanupPromise = removeSafely(failedChannel);
    if (!canStart()) return;

    const pendingCleanup = cleanupPromise;
    retryTimer = setTimeoutImpl(async () => {
      retryTimer = null;
      await pendingCleanup;
      if (token !== generation || !canStart() || activeChannel) return;
      connect(token);
    }, retryDelayMs);
  };

  const handleChannelStatus = (channel, state, error, token) => {
    if (!started || token !== generation || activeChannel !== channel) return;

    if (state === "SUBSCRIBED") {
      retryCount = 0;
      report(state, error, 0);
      return;
    }

    if (state === "CHANNEL_ERROR" || state === "TIMED_OUT" || state === "CLOSED") {
      scheduleRetry(state, error, channel, token);
      return;
    }

    report(state, error);
  };

  const connect = (token = generation) => {
    if (token !== generation || !canStart() || activeChannel || retryTimer !== null) {
      return activeChannel;
    }

    let createdChannel = null;
    const synchronousStatuses = [];
    const receiveStatus = (state, error) => {
      if (!createdChannel) {
        synchronousStatuses.push([state, error]);
        return;
      }
      handleChannelStatus(createdChannel, state, error, token);
    };

    try {
      createdChannel = createChannel(receiveStatus);
      if (!createdChannel) throw new Error("Realtime channel creation returned no channel");
    } catch (error) {
      scheduleRetry("CHANNEL_ERROR", error, null, token);
      return null;
    }

    if (!started || token !== generation) {
      void removeSafely(createdChannel);
      return null;
    }

    activeChannel = createdChannel;
    for (const [state, error] of synchronousStatuses) {
      handleChannelStatus(createdChannel, state, error, token);
    }
    return activeChannel;
  };

  return Object.freeze({
    start() {
      started = true;
      return connect(generation);
    },
    stop() {
      started = false;
      generation += 1;
      if (retryTimer !== null) {
        clearTimeoutImpl(retryTimer);
        retryTimer = null;
      }
      retryCount = 0;
      const previousCleanup = cleanupPromise;
      const channelToRemove = activeChannel;
      activeChannel = null;
      cleanupPromise = Promise.all([
        previousCleanup,
        removeSafely(channelToRemove),
      ]).then(() => undefined);
      return cleanupPromise;
    },
    getChannel() {
      return activeChannel;
    },
    getRetryCount() {
      return retryCount;
    },
    isStarted() {
      return started;
    },
  });
}

export const SUPABASE_SDK_URLS = Object.freeze([
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.0/dist/umd/supabase.js',
  'https://unpkg.com/@supabase/supabase-js@2.119.0/dist/umd/supabase.js',
]);
const DEFAULT_SUPABASE_SDK_TIMEOUT = 10000;

export function createSupabaseLoader({
  windowRef,
  documentRef,
  sdkUrls = SUPABASE_SDK_URLS,
  timeoutMs = DEFAULT_SUPABASE_SDK_TIMEOUT,
} = {}) {
  let pendingLoad = null;

  return function loadSupabaseClient() {
    const existing = windowRef?.supabase?.createClient;
    if (typeof existing === 'function') return Promise.resolve(existing);
    if (pendingLoad) return pendingLoad;
    if (!windowRef || !documentRef?.head) {
      return Promise.reject(new Error('بيئة المتصفح غير متاحة لتحميل مكتبة المزامنة.'));
    }
    if (!Array.isArray(sdkUrls) || sdkUrls.length === 0) {
      return Promise.reject(new Error('لم تُحدّد مصادر تحميل مكتبة المزامنة.'));
    }

    const operation = (async () => {
      for (const url of sdkUrls) {
        const outcome = await new Promise((resolve) => {
          const script = documentRef.createElement('script');
          let settled = false;
          let timerId = null;

          const finish = (result) => {
            if (settled) return;
            settled = true;
            if (timerId !== null) windowRef.clearTimeout(timerId);
            script.removeEventListener('load', handleLoad);
            script.removeEventListener('error', handleError);
            if (result !== 'loaded') script.remove();
            resolve(result);
          };

          const handleLoad = () => {
            finish(typeof windowRef.supabase?.createClient === 'function' ? 'loaded' : 'invalid');
          };
          const handleError = () => finish('error');

          script.dataset.milaSupabaseSdk = 'true';
          script.src = url;
          script.async = true;
          script.crossOrigin = 'anonymous';
          script.addEventListener('load', handleLoad, { once: true });
          script.addEventListener('error', handleError, { once: true });
          timerId = windowRef.setTimeout(() => finish('timeout'), timeoutMs);
          documentRef.head.appendChild(script);
        });

        const createClient = windowRef.supabase?.createClient;
        if (outcome === 'loaded' && typeof createClient === 'function') return createClient;
      }

      throw new Error('تعذر تحميل مكتبة المزامنة من المصدرين. تحقق من اتصال الإنترنت أو جرّب تعطيل مانع المحتوى ثم أعد المحاولة.');
    })();

    pendingLoad = operation.finally(() => {
      pendingLoad = null;
    });
    return pendingLoad;
  };
}

/**
 * Bounds initialization calls that may stall without rejecting, while still
 * observing a late rejection from the original promise.
 */
export function withTimeout(value, timeoutMs = 10000, message = 'Operation timed out') {
  if (!Number.isFinite(timeoutMs) || timeoutMs < 0) {
    throw new RangeError('timeoutMs must be a non-negative finite number');
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    const timerId = setTimeout(() => {
      if (settled) return;
      settled = true;
      const error = new Error(message);
      error.name = 'TimeoutError';
      reject(error);
    }, timeoutMs);

    Promise.resolve(value).then(
      (result) => {
        if (settled) return;
        settled = true;
        clearTimeout(timerId);
        resolve(result);
      },
      (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timerId);
        reject(error);
      }
    );
  });
}

export function createTimeoutFetch(fetchImpl, {
  timeoutMs = 20000,
  AbortControllerImpl = globalThis.AbortController,
  setTimeoutImpl = globalThis.setTimeout,
  clearTimeoutImpl = globalThis.clearTimeout,
} = {}) {
  if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl must be a function');
  if (typeof AbortControllerImpl !== 'function') throw new TypeError('AbortController is unavailable');

  return async function fetchWithTimeout(input, init = {}) {
    const controller = new AbortControllerImpl();
    const externalSignal = init?.signal ?? input?.signal;
    let timedOut = false;
    const forwardAbort = () => controller.abort(externalSignal?.reason);

    if (externalSignal?.aborted) {
      forwardAbort();
    } else {
      externalSignal?.addEventListener('abort', forwardAbort, { once: true });
    }

    const timerId = setTimeoutImpl(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);

    try {
      return await fetchImpl(input, { ...init, signal: controller.signal });
    } catch (error) {
      if (timedOut) {
        const timeoutError = new Error('انتهت مهلة الاتصال بخدمة المزامنة. تحقق من الإنترنت ثم حاول مجددًا.');
        timeoutError.name = 'TimeoutError';
        throw timeoutError;
      }
      throw error;
    } finally {
      clearTimeoutImpl(timerId);
      externalSignal?.removeEventListener('abort', forwardAbort);
    }
  };
}

export function createAsyncGate({ onBusy = () => {}, onError = () => {} } = {}) {
  let busy = false;
  return async function run(task) {
    if (busy) return { status: 'busy' };
    if (typeof task !== 'function') throw new TypeError('task must be a function');
    busy = true;
    onBusy(true);
    try {
      return { status: 'ok', value: await task() };
    } catch (error) {
      onError(error);
      return { status: 'error', error };
    } finally {
      busy = false;
      onBusy(false);
    }
  };
}

/**
 * Coordinates Supabase auth refresh with browser connectivity and visibility.
 * Calling startAutoRefresh/stopAutoRefresh disables Supabase's managed
 * visibility listener, so this controller deliberately owns that lifecycle.
 */
/**
 * Coordinates Supabase auth refresh with browser connectivity and page lifecycle.
 * Realtime/WebSocket owners suspend during hidden/frozen transitions and resume
 * after the page is active again (including BFCache restoration).
 */
export function createNetworkLifecycle({
  auth,
  windowRef = globalThis.window,
  documentRef = globalThis.document,
  navigatorRef = globalThis.navigator,
  onOnline = () => {},
  onOffline = () => {},
  onSuspend = () => {},
  onResume = () => {},
} = {}) {
  if (
    !auth ||
    typeof auth.startAutoRefresh !== "function" ||
    typeof auth.stopAutoRefresh !== "function"
  ) {
    throw new TypeError("auth must expose startAutoRefresh and stopAutoRefresh");
  }

  let disposed = false;
  let pageSuspended = false;
  let pageActive = documentRef?.visibilityState !== "hidden";

  const isPageActive = () =>
    !pageSuspended && documentRef?.visibilityState !== "hidden";

  const shouldRefresh = () =>
    navigatorRef?.onLine !== false && isPageActive();

  const notify = (callback, event) => {
    try {
      const result = callback(event);
      if (result && typeof result.then === "function") result.catch(() => {});
    } catch {
      // Browser lifecycle callbacks must never interrupt a page transition.
    }
  };

  const refreshAuth = () => {
    if (disposed) return false;
    const active = shouldRefresh();
    const operation = active ? auth.startAutoRefresh() : auth.stopAutoRefresh();
    void Promise.resolve(operation).catch(() => {});
    return active;
  };

  const updatePageActivity = (event) => {
    if (disposed) return false;
    const active = isPageActive();
    const changed = active !== pageActive;
    pageActive = active;
    refreshAuth();
    if (changed) notify(active ? onResume : onSuspend, event);
    return active;
  };

  const handleOnline = () => {
    if (refreshAuth()) notify(onOnline);
  };

  const handleOffline = () => {
    refreshAuth();
    if (navigatorRef?.onLine === false) notify(onOffline);
  };

  const handleVisibilityChange = (event) => updatePageActivity(event);

  const handlePageHide = (event) => {
    pageSuspended = true;
    updatePageActivity(event);
  };

  const handlePageShow = (event) => {
    pageSuspended = false;
    updatePageActivity(event);
  };

  const handleFreeze = (event) => {
    pageSuspended = true;
    updatePageActivity(event);
  };

  const handleResume = (event) => {
    pageSuspended = false;
    updatePageActivity(event);
  };

  windowRef?.addEventListener?.("online", handleOnline);
  windowRef?.addEventListener?.("offline", handleOffline);
  windowRef?.addEventListener?.("pagehide", handlePageHide);
  windowRef?.addEventListener?.("pageshow", handlePageShow);
  documentRef?.addEventListener?.("visibilitychange", handleVisibilityChange);
  // freeze/resume are Document events in the Page Lifecycle API.
  documentRef?.addEventListener?.("freeze", handleFreeze);
  documentRef?.addEventListener?.("resume", handleResume);

  refreshAuth();
  if (navigatorRef?.onLine === false) notify(onOffline);

  return Object.freeze({
    refresh: refreshAuth,
    dispose() {
      if (disposed) return;
      disposed = true;
      windowRef?.removeEventListener?.("online", handleOnline);
      windowRef?.removeEventListener?.("offline", handleOffline);
      windowRef?.removeEventListener?.("pagehide", handlePageHide);
      windowRef?.removeEventListener?.("pageshow", handlePageShow);
      documentRef?.removeEventListener?.("visibilitychange", handleVisibilityChange);
      documentRef?.removeEventListener?.("freeze", handleFreeze);
      documentRef?.removeEventListener?.("resume", handleResume);
      void Promise.resolve(auth.stopAutoRefresh()).catch(() => {});
    },
  });
}

export function createPendingMutation(snapshot, expectedRevision, mutationId, createdAt = Date.now(), userId = null) {
  if (!isSnapshot(snapshot)) throw new TypeError('A valid learning snapshot is required');
  if (!Number.isInteger(expectedRevision) || expectedRevision < 0) {
    throw new RangeError('expectedRevision must be a non-negative integer');
  }
  if (typeof mutationId !== 'string' || !mutationId.trim() || mutationId.length > 200) {
    throw new TypeError('mutationId must be a non-empty string of at most 200 characters');
  }
  if (!Number.isFinite(createdAt) || createdAt < 0) {
    throw new RangeError('createdAt must be a non-negative timestamp');
  }
  if (userId !== null && (typeof userId !== 'string' || !userId.trim() || userId.length > 128)) {
    throw new TypeError('userId must be null or a non-empty string of at most 128 characters');
  }
  return Object.freeze({
    version: 1,
    snapshot: createSnapshot(snapshot.entries),
    expectedRevision,
    mutationId,
    createdAt,
    userId
  });
}

export function normalizePendingMutation(value, fallbackRevision, createId = () => '') {
  if (isSnapshot(value)) {
    return createPendingMutation(value, fallbackRevision, createId(), Date.now(), null);
  }
  if (!value || typeof value !== 'object' || Array.isArray(value) || value.version !== 1) return null;
  try {
    return createPendingMutation(
      value.snapshot,
      value.expectedRevision,
      value.mutationId,
      value.createdAt,
      typeof value.userId === 'string' ? value.userId : null
    );
  } catch {
    return null;
  }
}


export function isDifferentAccount(storedUserId, currentUserId) {
  return typeof storedUserId === "string" && storedUserId.length > 0 &&
    typeof currentUserId === "string" && currentUserId.length > 0 &&
    storedUserId !== currentUserId;
}

export function hasMeaningfulLearningData(snapshot) {
  if (!isSnapshot(snapshot)) return false;
  const mainKey = 'mila-yaelnet-studio-v3';
  const adaptiveKey = 'mila-yaelnet-adaptive-v1';
  for (const [key, raw] of snapshot.entries) {
    if (key === mainKey) {
      let state;
      try { state = JSON.parse(raw); } catch { return true; }
      if (!state || typeof state !== 'object') return true;
      if (Object.keys(state.progress || {}).length ||
          (state.extras || []).length ||
          (state.mistakes || []).length ||
          (state.sessions || []).length ||
          Object.keys(state.learningEvents || {}).length ||
          (state.completedStageIds || []).length ||
          state.lastSessionSummary ||
          Number(state.daily?.completed) > 0 ||
          Number(state.daily?.streak) > 0 ||
          Number(state.legacyTotals?.attempted) > 0) return true;
      const defaults = { theme: 'light', dailyGoal: 10, defaultCount: 10, defaultMode: 'he-ar',
        timerSeconds: 0, feedbackTiming: 'instant', focusMode: false, sound: false, largeText: false };
      const settings = state.settings || {};
      if (Object.keys(defaults).some(name => settings[name] !== undefined && settings[name] !== defaults[name])) return true;
      continue;
    }
    if (key === adaptiveKey) {
      let state;
      try { state = JSON.parse(raw); } catch { return true; }
      if (!state || typeof state !== 'object') return true;
      if (Object.keys(state.progress || {}).length || state.session) return true;
      continue;
    }
    if (raw && raw !== '{}' && raw !== '[]' && raw !== 'null') return true;
  }
  return false;
}
