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
