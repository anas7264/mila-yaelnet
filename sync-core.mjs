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
export function createNetworkLifecycle({
  auth,
  windowRef = globalThis.window,
  documentRef = globalThis.document,
  navigatorRef = globalThis.navigator,
  onOnline = () => {},
  onOffline = () => {},
} = {}) {
  if (
    !auth ||
    typeof auth.startAutoRefresh !== "function" ||
    typeof auth.stopAutoRefresh !== "function"
  ) {
    throw new TypeError("auth must expose startAutoRefresh and stopAutoRefresh");
  }

  let disposed = false;

  const shouldRefresh = () =>
    navigatorRef?.onLine !== false &&
    documentRef?.visibilityState !== "hidden";

  const notify = (callback) => {
    try {
      const result = callback();
      if (result && typeof result.then === "function") {
        result.catch(() => {});
      }
    } catch {
      // Event callbacks must not create unhandled browser event errors.
    }
  };

  const refreshAuth = () => {
    if (disposed) return false;
    const active = shouldRefresh();
    if (active) {
      void Promise.resolve(auth.startAutoRefresh()).catch(() => {});
    } else {
      void Promise.resolve(auth.stopAutoRefresh()).catch(() => {});
    }
    return active;
  };

  const handleOnline = () => {
    if (refreshAuth()) notify(onOnline);
  };

  const handleOffline = () => {
    refreshAuth();
    if (navigatorRef?.onLine === false) notify(onOffline);
  };

  const handleVisibilityChange = () => {
    if (refreshAuth()) notify(onOnline);
  };

  windowRef?.addEventListener?.("online", handleOnline);
  windowRef?.addEventListener?.("offline", handleOffline);
  documentRef?.addEventListener?.("visibilitychange", handleVisibilityChange);

  refreshAuth();
  if (navigatorRef?.onLine === false) notify(onOffline);

  return Object.freeze({
    refresh: refreshAuth,
    dispose() {
      if (disposed) return;
      disposed = true;
      windowRef?.removeEventListener?.("online", handleOnline);
      windowRef?.removeEventListener?.("offline", handleOffline);
      documentRef?.removeEventListener?.("visibilitychange", handleVisibilityChange);
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
