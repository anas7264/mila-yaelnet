const LABELS=[/^الإعدادات(?:\s|$)/u,/^إعدادات(?:\s|$)/u,/^הגדרות(?:\s|$)/u,/^settings(?:\s|$)/iu];
export function isSettingsLabel(value){const s=String(value??'').replace(/[\s:：]+/gu,' ').trim();return LABELS.some(r=>r.test(s))}
export function buildEmailRedirect(origin){const u=new URL('/',origin);if(!['https:','http:'].includes(u.protocol))throw new TypeError('Unsupported redirect protocol');return u.href}
export function isExpiredConfirmation(search){const p=new URLSearchParams(String(search??'').replace(/^\?/u,''));return p.get('error_code')==='otp_expired'||p.get('error_code')==='otp_disabled'||p.get('error_description')?.toLowerCase().includes('expired')===true}
