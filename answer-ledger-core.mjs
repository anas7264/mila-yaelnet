/** Idempotent answer-event bookkeeping shared by sync and learning flows. */
const PREFIX="answer:";
const MAX=10000;
const safeId=value=>String(value??"").trim().slice(0,180);
export function createEventId(sessionId,questionId){const a=safeId(sessionId),b=safeId(questionId);if(!a||!b)return"";return "mila-answer-v1:"+encodeURIComponent(a)+":"+encodeURIComponent(b);}
export function applyAnswerEvent(rawState,event,{limit=MAX}={}){
 if(!rawState||typeof rawState!=="object"||!event||typeof event!=="object")return{accepted:false,reason:"invalid-event",state:rawState};
 const eventId=safeId(event.eventId),wordId=safeId(event.wordId),correct=event.correct;
 if(!eventId||!wordId||typeof correct!=="boolean")return{accepted:false,reason:"invalid-answer",state:rawState};
 const ledger=rawState.adaptiveEventIds&&typeof rawState.adaptiveEventIds==="object"&&!Array.isArray(rawState.adaptiveEventIds)?rawState.adaptiveEventIds:{};
 const key=PREFIX+eventId;if(ledger[key])return{accepted:true,duplicate:true,state:rawState};
 const state={...rawState,progress:{...(rawState.progress||{})},mistakes:[...(Array.isArray(rawState.mistakes)?rawState.mistakes:[])],adaptiveEventIds:{...ledger}};
 const prev=state.progress[wordId]||{},at=Math.max(0,Number(event.at)||Date.now());
 state.progress[wordId]={...prev,attempts:(Number(prev.attempts)||0)+1,correct:(Number(prev.correct)||0)+(correct?1:0),incorrect:(Number(prev.incorrect)||0)+(correct?0:1),mistakes:(Number(prev.mistakes)||0)+(correct?0:1),consecutiveCorrect:correct?(Number(prev.consecutiveCorrect)||0)+1:0,lastAnswerAt:at};
 if(!correct){const mistakeId="mistake-"+eventId; if(!state.mistakes.some(m=>m?.id===mistakeId))state.mistakes.push({id:mistakeId,wordId,selectedWordId:event.selectedWordId||null,createdAt:at,source:String(event.source||"جلسة تدريب").slice(0,120)});if(state.mistakes.length>500)state.mistakes.splice(0,state.mistakes.length-500);}
 state.adaptiveEventIds[key]=at;
 const cap=Math.max(1,Math.min(MAX,Number(limit)||MAX)),ids=Object.keys(state.adaptiveEventIds);
 if(ids.length>cap){ids.sort((a,b)=>(Number(state.adaptiveEventIds[a])||0)-(Number(state.adaptiveEventIds[b])||0));for(const id of ids.slice(0,ids.length-cap))delete state.adaptiveEventIds[id];}
 return{accepted:true,duplicate:false,state,eventId:key};
}
