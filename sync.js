import{createSnapshot,hasSnapshotEntries,isSameSnapshot,isSnapshot,isInternalStorageKey,createSupabaseLoader,createTimeoutFetch,createStatusController,createNetworkLifecycle,withTimeout,createPendingMutation,normalizePendingMutation,isDifferentAccount}from'./sync-core.mjs?v=5';

import{isSettingsLabel,buildEmailRedirect,isExpiredConfirmation}from'./sync-settings-core.mjs?v=3';
import{mergeSnapshots}from'./sync-merge-core.mjs?v=1';
const C=window.__MILA_SYNC_CONFIG__||{},P='__mila_sync_',META=P+'meta_v1',PENDING=P+'pending_v1',ACCOUNT_BACKUP_PREFIX=P+'account_backup_v1_',$=id=>document.getElementById(id),parse=s=>{try{return JSON.parse(s)}catch{return null}},uuid=()=>crypto.randomUUID();
const card$=id=>card.querySelector('#'+id);
const statusController=createStatusController(()=>card$('mila-sync-status'));
const setStatus=(m,state='info')=>statusController.set(m,state);
document.getElementById('mila-sync-root')?.remove();
const style=document.createElement('style');style.textContent=`#mila-sync-card{color-scheme:light!important;--bg:#fff;--surface:#fff;--surface-2:#f7f8fa;--surface-3:#edf1f5;--ink:#172338;--ink-2:#34445d;--muted:#7d899b;--line:#d9deea;--gold-soft:#f8f0e3;--green-soft:#e8f4ef;--red-soft:#fff0ef;--blue-soft:#eef3fa;--mila-sync-border:#d9deea;--mila-sync-surface:#fff;--mila-sync-text:#17233a;--mila-sync-input:#fff;direction:rtl;margin:22px 0;padding:22px;border:1px solid var(--mila-sync-border,#d9deea);border-radius:18px;background:#fff!important;color:#17233a!important;border-color:#d9deea!important;box-shadow:0 8px 28px #14233d12;max-width:900px;font:inherit}#mila-sync-card *{box-sizing:border-box;color-scheme:light!important}#mila-sync-card .head{display:flex;gap:14px;align-items:flex-start;margin-bottom:16px}#mila-sync-card .ico{width:44px;height:44px;flex:0 0 44px;display:grid;place-items:center;border-radius:13px;background:#14233d;color:#d9b875;font-size:21px}#mila-sync-card h3{font-size:18px;font-weight:800;margin:0 0 5px;color:#17233a!important}#mila-sync-card p{font-size:13px;line-height:1.75;opacity:.78;margin:4px 0 12px;color:#34445d!important}#mila-sync-card .status{padding:12px 14px;border-radius:12px;background:#eef1f5!important;color:#34445d!important;font-size:13px;line-height:1.65;margin:14px 0}#mila-sync-card .status[data-state=ok]{background:#e5f5ec!important;color:#187447!important}#mila-sync-card .status[data-state=error],#mila-sync-card .status[data-state=conflict]{background:#fbe9e6!important;color:#a33c2d!important}#mila-sync-card .fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:12px 0}#mila-sync-card input{width:100%;min-width:0;padding:12px;border:1px solid #d9deea!important;border-radius:11px;background:#fff!important;color:#17233a!important;font:inherit;font-size:14px}#mila-sync-card .actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}#mila-sync-card button{border:0;border-radius:10px;padding:11px 16px;font:inherit;font-size:13px;font-weight:750;cursor:pointer;background:#172944!important;color:#f4e5c2!important}#mila-sync-card button.secondary{background:#e9edf2!important;color:#34445d!important}#mila-sync-card button.text{background:transparent!important;color:#34445d!important;text-decoration:underline;padding-inline:4px}#mila-sync-card button:disabled{opacity:.55;cursor:not-allowed}#mila-sync-card .conflict{display:none;margin-top:14px;padding:14px;border:1px solid #c69b55;border-radius:13px;background:#fff7e8!important;color:#17233a!important}#mila-sync-card .conflict p{color:#34445d!important}#mila-sync-card .conflict.show{display:block}#mila-sync-card [hidden]{display:none!important}@media(max-width:600px){#mila-sync-card{padding:16px}#mila-sync-card .fields{grid-template-columns:1fr}#mila-sync-card .actions button{flex:1 1 auto}}`;document.head.append(style);
const card=document.createElement('section');card.id='mila-sync-card';card.setAttribute('aria-label','مزامنة البيانات');card.innerHTML=`<div class="head"><div class="ico" aria-hidden="true">☁</div><div><h3>مزامنة البيانات</h3><p>احتفظ بتقدمك ومفرداتك ومراجعاتك متزامنة بين أجهزتك. لا تُرفع بياناتك إلا بعد تسجيل الدخول.</p></div></div><div id="mila-sync-status" class="status" role="status" aria-live="polite">جارٍ تهيئة المزامنة…</div><button id="mila-sync-retry" class="secondary" type="button" hidden>إعادة المحاولة</button><div id="mila-sync-auth"><div class="fields"><input id="mila-sync-email" type="email" autocomplete="email" placeholder="البريد الإلكتروني" aria-label="البريد الإلكتروني"><input id="mila-sync-password" type="password" autocomplete="current-password" placeholder="كلمة المرور" aria-label="كلمة المرور"></div><div class="actions"><button id="mila-sync-login" data-mila-auth-action disabled type="button">تسجيل الدخول</button><button class="secondary" id="mila-sync-signup" data-mila-auth-action disabled type="button">إنشاء حساب</button><button class="text" id="mila-sync-resend" data-mila-auth-action disabled type="button" hidden>إعادة إرسال رسالة التحقق</button></div></div><div id="mila-sync-account" hidden><p id="mila-sync-user"></p><div class="actions"><button id="mila-sync-now" type="button">مزامنة الآن</button><button class="secondary" id="mila-sync-logout" type="button">تسجيل الخروج</button></div></div><div id="mila-sync-conflict" class="conflict"><strong>توجد تعديلات مختلفة على هذا الجهاز وفي السحابة.</strong><p>لن نستبدل أي نسخة تلقائيًا. اختر البيانات التي تريد الاحتفاظ بها.</p><div class="actions"><button id="mila-sync-use-cloud" type="button">اعتماد نسخة السحابة</button><button class="secondary" id="mila-sync-use-device" type="button">اعتماد نسخة هذا الجهاز</button></div></div>`;
let authReady=false;
const syncAuthControls=()=>card.querySelectorAll('[data-mila-auth-action]').forEach(button=>{const disabled=!authReady;if(button.disabled!==disabled)button.disabled=disabled});
function settingsTarget(){const layout=document.querySelector('#appView .settings-layout');if(layout)return layout;const h=[...document.querySelectorAll('#appView h1,#appView h2,#appView h3,#appView h4,#appView [role=heading]')].find(n=>n.getClientRects().length&&isSettingsLabel(n.textContent));if(h)return h.closest('.page-head')?.parentElement||h.parentElement;const route=(location.pathname+location.hash).toLowerCase();return /settings|preferences|الإعدادات|إعدادات|הגדרות/u.test(route)?document.querySelector('#appView')||document.querySelector('main,[role=main]'):null}
function mount(){const t=settingsTarget();if(!t){card.remove();return}if(card.parentElement!==t){card.remove();if(t.classList.contains('settings-layout')){card.style.gridColumn='1 / -1';t.prepend(card)}else t.append(card)}if(t.classList.contains('settings-layout')){const p=[...t.querySelectorAll('.form-card p')].find(n=>n.textContent.includes('localStorage'));if(p)p.textContent='تُحفظ بيانات التعلم محليًا على جهازك، ويمكن مزامنتها إلى حسابك عند تسجيل الدخول.';const note=t.querySelector('.helper-note');if(note&&note.textContent.includes('لا توجد مزامنة تلقائية'))note.textContent='سجّل الدخول إلى الحساب نفسه على أجهزتك لمزامنة التقدم. وعند انقطاع الإنترنت تبقى بياناتك المحلية محفوظة.'}statusController.render();syncAuthControls()}
new MutationObserver(mount).observe(document.documentElement,{childList:true,subtree:true});mount();card$('mila-sync-retry').onclick=()=>location.reload();
const loadSupabaseClient=createSupabaseLoader({windowRef:window,documentRef:document,sdkUrls:['/static/vendor/supabase.umd.js'],timeoutMs:15000});
let createClient=null,initializationError=null;
if(C.url&&C.publishableKey){
  setStatus('جارٍ تحميل مكتبة المزامنة المحلية…');
  try{createClient=await loadSupabaseClient();authReady=true;syncAuthControls();setStatus('تم تحميل مكتبة المزامنة. جارٍ استعادة حالة الحساب…')}
  catch(error){initializationError=error;console.error('Mila local Supabase SDK initialization failed',error)}
}
if(!C.url||!C.publishableKey){setStatus('خدمة المزامنة غير مهيأة لهذا النشر. لم يتم إرسال أي بيانات.','error');card$('mila-sync-retry').hidden=false}
else if(!createClient){setStatus('تعذر تشغيل المزامنة: '+(initializationError?.message||'لم يتم تحميل مكتبة Supabase المحلية.'),'error');card$('mila-sync-retry').hidden=false}
else{
const timedFetch=createTimeoutFetch(window.fetch.bind(window),{timeoutMs:12000});
const sb=createClient(C.url,C.publishableKey,{global:{fetch:timedFetch},auth:{persistSession:true,autoRefreshToken:false,detectSessionInUrl:true},realtime:{params:{eventsPerSecond:5}}});
let device=localStorage.getItem(P+'device_v1');if(!device){device=uuid();localStorage.setItem(P+'device_v1',device)}
let session=null,revision=0,baseline=null,channel=null,suppress=false,dirty=false,conflict=null,timer=null,pending=parse(localStorage.getItem(PENDING)),syncReady=false,recoveryPromise=null,realtimeCleanup=Promise.resolve(),activationVersion=0;
const snap=()=>createSnapshot(Object.keys(localStorage).map(k=>[k,localStorage.getItem(k)])),meta=()=>parse(localStorage.getItem(META))||{},status=(m,s='info')=>statusController.set(m,s),emailRedirect=()=>buildEmailRedirect(location.origin),makeMutation=(v,r,id=uuid(),at=Date.now())=>createPendingMutation(v,r,id,at,session?.user?.id||null);
const writeMeta=(r,v,userId=session?.user?.id||meta().userId||null)=>{revision=r;baseline=v;localStorage.setItem(META,JSON.stringify({revision,baseline,userId,deviceId:device,updatedAt:new Date().toISOString()}))};
const setAuth=u=>{card$('mila-sync-auth').hidden=!!u;card$('mila-sync-account').hidden=!u;card$('mila-sync-user').textContent=u?'متصل بالحساب: '+(u.email||'حسابك'):''};
const clearConflict=()=>{conflict=null;card$('mila-sync-conflict').classList.remove('show')};
const showConflict=(l,c,r)=>{conflict={local:l,cloud:c,revision:r};card$('mila-sync-conflict').classList.add('show');status('اكتشفنا تعارضًا بين نسختين. اختر النسخة المعتمدة للمتابعة.','conflict')};
const autoMerge=async(local,cloud,cloudRevision,baseOverride=null,attempt=0)=>{
const storedBase=meta().baseline;
const base=isSnapshot(baseOverride)?baseOverride:(isSnapshot(storedBase)?storedBase:createSnapshot([]));
const merged=mergeSnapshots(base,local,cloud,{scheduleReview:window.VocabularyQuizEngine?.scheduleReview});
if(!merged.ok){showConflict(local,cloud,cloudRevision);status('تعذر الدمج التلقائي الآمن لبعض الحقول القديمة أو المتعارضة. لم نستبدل أي بيانات؛ اختر النسخة المعتمدة أو أعد المحاولة بعد مراجعة التعارض.','conflict');return false}
const mutation=makeMutation(merged.snapshot,cloudRevision,uuid());
const previousPending=pending;
try{
pending=mutation;
localStorage.setItem(PENDING,JSON.stringify(mutation));
apply(merged.snapshot);
}catch(error){
pending=previousPending;
try{localStorage.removeItem(PENDING)}catch{}
showConflict(local,cloud,cloudRevision);
status('تعذر تطبيق الدمج محليًا؛ احتفظنا بالنسخة السابقة. '+(error?.message||''),'error');
return false;
}
try{
const result=await save(mutation.snapshot,mutation.expectedRevision,mutation.mutationId);
if(result.conflict){
try{localStorage.removeItem(PENDING)}catch{}
pending=null;
if(attempt<2)return autoMerge(merged.snapshot,result.data.state,result.data.revision,cloud,attempt+1);
showConflict(snap(),result.data.state,result.data.revision);
return false;
}
clearConflict();
status('دُمجت التغييرات المستقلة بين الأجهزة تلقائيًا.','ok');
location.reload();
return true;
}catch(error){
status('دُمجت التغييرات محليًا، لكن تعذر رفعها الآن. ستُستأنف المزامنة تلقائيًا عند عودة الاتصال. '+(error?.message||''),'info');
location.reload();
return true;
}
};
const apply=v=>{if(!isSnapshot(v))throw Error('صيغة بيانات السحابة غير معروفة. لم تتغير بيانات الجهاز.');const b=Object.keys(localStorage).filter(k=>!isInternalStorageKey(k)).map(k=>[k,localStorage.getItem(k)]),entries=v.entries.filter(([k])=>!isInternalStorageKey(k));suppress=true;try{b.forEach(([k])=>localStorage.removeItem(k));entries.forEach(([k,x])=>localStorage.setItem(k,x))}catch(e){Object.keys(localStorage).filter(k=>!isInternalStorageKey(k)).forEach(k=>localStorage.removeItem(k));b.forEach(([k,x])=>localStorage.setItem(k,x));throw e}finally{suppress=false}};
const isolateLocalAccount=userId=>{
const currentMeta=meta();
if(!isDifferentAccount(currentMeta.userId,userId)){
if(currentMeta.userId===userId){try{localStorage.removeItem(ACCOUNT_BACKUP_PREFIX+userId)}catch{}}
return false;
}
const currentSnapshot=snap();
const backupKey=ACCOUNT_BACKUP_PREFIX+currentMeta.userId;
if(!localStorage.getItem(backupKey)){
const backup={version:1,userId:currentMeta.userId,snapshot:currentSnapshot,meta:currentMeta,pending:parse(localStorage.getItem(PENDING)),savedAt:Date.now()};
localStorage.setItem(backupKey,JSON.stringify(backup));
}
const targetBackupKey=ACCOUNT_BACKUP_PREFIX+userId;
const targetBackup=parse(localStorage.getItem(targetBackupKey));
const oldMetaRaw=localStorage.getItem(META),oldPendingRaw=localStorage.getItem(PENDING),oldRevision=revision,oldBaseline=baseline,oldPendingValue=pending;
try{
if(targetBackup?.version===1&&targetBackup.userId===userId&&isSnapshot(targetBackup.snapshot)&&targetBackup.meta?.userId===userId){
apply(targetBackup.snapshot);
revision=Number.isInteger(targetBackup.meta.revision)?targetBackup.meta.revision:0;
baseline=isSnapshot(targetBackup.meta.baseline)?targetBackup.meta.baseline:null;
if(targetBackup.pending)localStorage.setItem(PENDING,JSON.stringify(targetBackup.pending));else localStorage.removeItem(PENDING);
pending=targetBackup.pending||null;
localStorage.setItem(META,JSON.stringify({...targetBackup.meta,userId,deviceId:device,restoredAt:new Date().toISOString()}));
localStorage.removeItem(targetBackupKey);
}else{
const empty=createSnapshot([]);
apply(empty);
localStorage.removeItem(PENDING);pending=null;dirty=false;
writeMeta(0,empty,userId);
}
return true;
}catch(error){
try{apply(currentSnapshot)}catch{}
try{if(oldMetaRaw!==null)localStorage.setItem(META,oldMetaRaw);else localStorage.removeItem(META)}catch{}
try{if(oldPendingRaw!==null)localStorage.setItem(PENDING,oldPendingRaw);else localStorage.removeItem(PENDING)}catch{}
revision=oldRevision;baseline=oldBaseline;pending=oldPendingValue;
throw error;
}
};
const save=async(v,expected,mutationId)=>{const{data,error}=await sb.rpc('sync_learning_state',{p_state:v,p_expected_revision:expected,p_mutation_id:mutationId,p_device_id:device,p_schema_version:1});if(error)throw error;if(data?.status==='conflict')return{conflict:true,data};if(!['saved','duplicate'].includes(data?.status))throw Error('استجابة غير متوقعة من خدمة المزامنة');if(data.status==='duplicate'&&data.state&&!isSameSnapshot(data.state,v))return{conflict:true,data,duplicate:true};writeMeta(data.revision,data.state||v);localStorage.removeItem(PENDING);pending=null;dirty=false;return{conflict:false,data}};
const loginSync=async()=>{
status('جارٍ مقارنة بيانات هذا الجهاز بالسحابة…');
const userId=session?.user?.id;
if(!userId)throw Error('لا يمكن بدء المزامنة دون حساب مصادق.');
if(isDifferentAccount(meta().userId,userId))throw Error('يجب عزل بيانات الحساب السابق قبل بدء المزامنة.');
const{data,error}=await sb.from('learning_state').select('state,revision,updated_at,schema_version').maybeSingle();
if(error)throw error;let l=snap();
let m=meta();
if(!data||(data.revision===0&&!hasSnapshotEntries(data.state))){
let initial=normalizePendingMutation(pending,data?.revision??0,uuid);
if(initial?.userId&&initial.userId!==userId){
const key=ACCOUNT_BACKUP_PREFIX+initial.userId;
if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify({version:1,userId:initial.userId,snapshot:initial.snapshot,meta:{userId:initial.userId,revision:initial.expectedRevision,baseline:null},pending:initial,savedAt:Date.now()}));
localStorage.removeItem(PENDING);pending=null;initial=null;
}
if(initial&&!initial.userId)initial=makeMutation(initial.snapshot,initial.expectedRevision,initial.mutationId,initial.createdAt);
if(!initial)initial=makeMutation(l,data?.revision??0,uuid());
pending=initial;localStorage.setItem(PENDING,JSON.stringify(initial));
const r=await save(initial.snapshot,initial.expectedRevision,initial.mutationId);
if(r.conflict)await autoMerge(l,r.data.state,r.data.revision);else status('حُفظت بيانات هذا الجهاز في حسابك.','ok');
return;
}
let queued=normalizePendingMutation(pending,revision,uuid);
if(queued?.userId&&queued.userId!==userId){
const key=ACCOUNT_BACKUP_PREFIX+queued.userId;
if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify({version:1,userId:queued.userId,snapshot:queued.snapshot,meta:{userId:queued.userId,revision:queued.expectedRevision,baseline:null},pending:queued,savedAt:Date.now()}));
localStorage.removeItem(PENDING);pending=null;queued=null;
}
if(queued&&!queued.userId)queued=makeMutation(queued.snapshot,queued.expectedRevision,queued.mutationId,queued.createdAt);
if(queued){
pending=queued;localStorage.setItem(PENDING,JSON.stringify(queued));
if(isSameSnapshot(data.state,queued.snapshot)){writeMeta(data.revision,data.state,userId);localStorage.removeItem(PENDING);pending=null}
else if(queued.expectedRevision===data.revision){revision=data.revision;baseline=data.state;return}
else{await autoMerge(l,data.state,data.revision);return}
}
if(!hasSnapshotEntries(l)){apply(data.state);writeMeta(data.revision,data.state,userId);location.reload();return}
m=meta();
if(m.revision===data.revision&&isSameSnapshot(l,data.state)){writeMeta(data.revision,data.state,userId);status('هذا الجهاز متزامن مع أحدث نسخة سحابية.','ok');return}
if(m.revision===data.revision&&m.baseline&&isSameSnapshot(l,m.baseline)){apply(data.state);writeMeta(data.revision,data.state,userId);location.reload();return}
if(isSameSnapshot(l,data.state)){writeMeta(data.revision,data.state,userId);status('بيانات الجهاز والسحابة متطابقة.','ok');return}
await autoMerge(l,data.state,data.revision);
};
const flush=async()=>{if(!session||!navigator.onLine||conflict)return;const current=snap();if(baseline&&isSameSnapshot(current,baseline)&&!pending)return;status('جارٍ حفظ التعديلات في السحابة…');try{const normalized=normalizePendingMutation(pending,revision,uuid);if(normalized?.userId&&normalized.userId!==session.user.id){status('توقفت المزامنة لحماية بيانات حساب آخر. أعد تسجيل الدخول إلى الحساب الصحيح.','error');return}const mutation=normalized?(normalized.userId?normalized:makeMutation(normalized.snapshot,normalized.expectedRevision,normalized.mutationId,normalized.createdAt)):makeMutation(current,revision,uuid());pending=mutation;localStorage.setItem(PENDING,JSON.stringify(mutation));const r=await save(mutation.snapshot,mutation.expectedRevision,mutation.mutationId);if(r.conflict){await autoMerge(snap(),r.data.state,r.data.revision);return}status('تمت مزامنة دفعة التغييرات.','ok');const latest=snap();if(!isSameSnapshot(latest,mutation.snapshot)){dirty=true;clearTimeout(timer);timer=setTimeout(flush,0)}}catch(e){status('تعذرت المزامنة الآن؛ بقيت التغييرات محفوظة محليًا وستعاد المحاولة. '+(e.message||''),'error')}};
const schedule=()=>{if(!session||suppress||conflict)return;dirty=true;clearTimeout(timer);timer=setTimeout(flush,900)};
const remote=r=>{if(!r||r.updated_by_device_id===device||r.revision<=revision)return;const l=snap();if(dirty||(baseline&&!isSameSnapshot(l,baseline))){void autoMerge(l,r.state,r.revision);return}try{apply(r.state);writeMeta(r.revision,r.state);location.reload()}catch(e){status('تعذر تطبيق تحديث السحابة: '+e.message,'error')}};
const pauseRealtime=()=>{
const active=channel;channel=null;
if(!active)return realtimeCleanup;
try{realtimeCleanup=Promise.resolve(sb.removeChannel(active)).catch(()=>{});return realtimeCleanup}
catch{return Promise.resolve()}
};
const subscribe=()=>{
if(!session?.user?.id||navigator.onLine===false||document.visibilityState==='hidden'||channel)return;
const nextChannel=sb.channel('mila-learning-'+session.user.id).on('postgres_changes',{event:'*',schema:'public',table:'learning_state',filter:'user_id=eq.'+session.user.id},p=>remote(p.new));
channel=nextChannel;
nextChannel.subscribe(s=>{if(channel!==nextChannel)return;if(s==='CHANNEL_ERROR'||s==='TIMED_OUT')status('التحديث الفوري غير مستقر؛ المزامنة اليدوية متاحة.','error')});
};
const recoverOnline=async()=>{
if(!session||navigator.onLine===false||document.visibilityState==='hidden')return;
if(recoveryPromise)return recoveryPromise;
recoveryPromise=(async()=>{
try{
if(!syncReady){await loginSync();syncReady=true;}
await realtimeCleanup;
subscribe();
await flush();
}catch(e){status('تعذر استئناف المزامنة: '+(e.message||e),'error')}
})().finally(()=>{recoveryPromise=null});
return recoveryPromise;
};
const activate=async s=>{
const activation=++activationVersion;
const previousUserId=session?.user?.id;
if(previousUserId!==s?.user?.id)syncReady=false;
session=s;setAuth(s?.user||null);
await pauseRealtime();
if(activation!==activationVersion)return;
if(!s){syncReady=false;clearConflict();status('لم تسجّل الدخول حاليًا — تقدمك محفوظ على هذا الجهاز، ولن تتم مزامنته حتى تسجّل الدخول.','info');return}
try{if(isolateLocalAccount(s.user.id)){location.reload();return}}
catch(error){session=null;syncReady=false;setAuth(null);status('تعذر عزل بيانات الحساب السابق بأمان. أوقفنا المزامنة ولم نرسل بياناته إلى الحساب الحالي. صدّر نسخة JSON أو حرّر مساحة ثم أعد المحاولة. '+(error?.message||''),'error');return}
if(navigator.onLine===false){status('أنت مسجّل الدخول، لكن لا يوجد اتصال بالإنترنت. تقدمك محفوظ محليًا وستُستأنف المزامنة عند عودة الاتصال.','info');return}
await recoverOnline();
};
const creds=()=>({email:card$('mila-sync-email').value.trim(),password:card$('mila-sync-password').value});
card$('mila-sync-login').onclick=async()=>{const{email,password}=creds();if(!email||!password)return status('أدخل البريد الإلكتروني وكلمة المرور.','error');status('جارٍ تسجيل الدخول…');const{data,error}=await sb.auth.signInWithPassword({email,password});if(error)return status(error.message,'error');await activate(data.session)};
card$('mila-sync-signup').onclick=async()=>{const{email,password}=creds();if(!email||password.length<8)return status('أدخل بريدًا صحيحًا وكلمة مرور من 8 أحرف على الأقل.','error');status('جارٍ إرسال رسالة تأكيد الحساب…');const{data,error}=await sb.auth.signUp({email,password,options:{emailRedirectTo:emailRedirect()}});if(error)return status(error.message,'error');if(!data.session){card$('mila-sync-resend').hidden=false;status('أُنشئ الحساب. افتح رسالة التأكيد التي أرسلناها. إذا انتهت صلاحية الرابط يمكنك طلب رسالة جديدة.','ok');return}await activate(data.session)};
card$('mila-sync-resend').onclick=async()=>{const{email}=creds();if(!email)return status('أدخل البريد الإلكتروني أولًا.','error');status('جارٍ إرسال رسالة تأكيد جديدة…');const{error}=await sb.auth.resend({type:'signup',email,options:{emailRedirectTo:emailRedirect()}});if(error)return status(error.message,'error');status('أُرسلت رسالة جديدة. استخدم أحدث رسالة فقط.','ok')};
card$('mila-sync-logout').onclick=async()=>{const{error}=await sb.auth.signOut();if(error)status(error.message,'error');else await activate(null)};card$('mila-sync-now').onclick=flush;
card$('mila-sync-use-cloud').onclick=()=>{if(!conflict)return;try{apply(conflict.cloud);writeMeta(conflict.revision,conflict.cloud);clearConflict();dirty=false;pending=null;localStorage.removeItem(PENDING);location.reload()}catch(e){status(e.message,'error')}};
card$('mila-sync-use-device').onclick=async()=>{if(!conflict)return;const c=conflict;clearConflict();try{const mutation=makeMutation(c.local,c.revision,uuid());pending=mutation;localStorage.setItem(PENDING,JSON.stringify(mutation));const r=await save(mutation.snapshot,mutation.expectedRevision,mutation.mutationId);if(r.conflict)showConflict(c.local,r.data.state,r.data.revision);else status('اعتمدت بيانات هذا الجهاز وحُفظت في السحابة.','ok')}catch(e){showConflict(c.local,c.cloud,c.revision);status('تعذرت الكتابة: '+e.message,'error')}};
const set=Storage.prototype.setItem,remove=Storage.prototype.removeItem,clear=Storage.prototype.clear;
Storage.prototype.setItem=function(k,v){set.call(this,k,v);if(this===localStorage&&!isInternalStorageKey(String(k)))schedule()};
Storage.prototype.removeItem=function(k){remove.call(this,k);if(this===localStorage&&!isInternalStorageKey(String(k)))schedule()};
Storage.prototype.clear=function(){clear.call(this);if(this===localStorage)schedule()};
addEventListener('storage',e=>{if(e.storageArea===localStorage&&e.key&&!isInternalStorageKey(e.key))schedule()});
createNetworkLifecycle({
auth:sb.auth,
windowRef:window,
documentRef:document,
navigatorRef:navigator,
onOffline:()=>{
void pauseRealtime();
if(session)status('لا يوجد اتصال بالإنترنت. تقدمك محفوظ محليًا وستُستأنف المزامنة تلقائيًا.','info');
},
onOnline:()=>{void recoverOnline()}
});
if(isExpiredConfirmation(location.search)){status('انتهت صلاحية رابط تأكيد البريد أو استُخدم سابقًا. أدخل بريدك واطلب رسالة جديدة.','error');card$('mila-sync-resend').hidden=false}else if(new URLSearchParams(location.search).has('error')){status(new URLSearchParams(location.search).get('error_description')||'تعذر تأكيد البريد. اطلب رابطًا جديدًا.','error');card$('mila-sync-resend').hidden=false}
// Subscribe before getSession so INITIAL_SESSION can settle the UI even if
// the explicit session read stalls. Defer Supabase work outside its auth callback.
sb.auth.onAuthStateChange((event,nextSession)=>{
  queueMicrotask(()=>{
    let next=null;
    let shouldActivate=false;
    if(event==='INITIAL_SESSION'){
      if(activationVersion===0){next=nextSession;shouldActivate=true}
    }else if(event==='SIGNED_OUT'){
      if(session?.user?.id){next=null;shouldActivate=true}
    }else if(nextSession?.user?.id!==session?.user?.id){
      next=nextSession;shouldActivate=true;
    }
    if(shouldActivate){
      activate(next).catch(error=>{
        status('تعذر تحديث حالة الحساب: '+(error?.message||'خطأ غير معروف'),'error');
      });
    }
  });
});
const m=meta();
revision=Number.isInteger(m.revision)?m.revision:0;
baseline=m.baseline||null;
const restoreVersion=activationVersion;
try{
  const{data,error}=await withTimeout(
    sb.auth.getSession(),
    10000,
    'انتهت مهلة التحقق من حالة الحساب.'
  );
  if(activationVersion===restoreVersion){
    if(error){
      setAuth(null);
      status('تعذر التحقق من حالة الحساب: '+(error.message||'خطأ غير معروف')+' بياناتك محفوظة محليًا؛ أعد المحاولة.','error');
      card$('mila-sync-retry').hidden=false;
    }else{
      await activate(data?.session||null);
    }
  }
}catch(error){
  if(activationVersion===restoreVersion){
    setAuth(null);
    clearConflict();
    const message=error?.name==='TimeoutError'
      ?'استغرق التحقق من حالة الحساب أكثر من 10 ثوانٍ. بياناتك المحلية محفوظة ولم يتم حذفها. أعد المحاولة أو سجّل الدخول.'
      :'تعذر استعادة حالة الحساب: '+(error?.message||'خطأ غير معروف')+'. بياناتك محفوظة محليًا.';
    status(message,'error');
    card$('mila-sync-retry').hidden=false;
  }
}
}
