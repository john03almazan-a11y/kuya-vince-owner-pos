/* KUYA VINCE OWNER WEB v12 - transport only, NO PASSWORDS OR PRIVATE DATA in GitHub.
  Apps Script bridge is a separate invisible iframe; all records and auth stay server-side.
  This does not make a public GitHub repo private; owner access remains password-gated.
*/
(function(){'use strict';
 const WEB_APP='https://script.google.com/macros/s/AKfycbwYses5Xh_67gY44Xe1PW7EqVTBS-c3n_SUsUP4V2m_w143VD4oLYYqnrBSOWhzzPf5/exec';
 const originAllowed=/^https:\/\/(?:[a-z0-9-]+\.googleusercontent\.com|script\.google\.com)$/i;
 const random=()=>{const a=new Uint8Array(24);crypto.getRandomValues(a);return Array.from(a).map(x=>x.toString(16).padStart(2,'0')).join('')};
 const nonce=random();
 let bridgeWindow=null,bridgeOrigin='',connected=false,resolveReady,rejectReady;
 const pending=new Map();let counter=0;
 const ready=new Promise((resolve,reject)=>{resolveReady=resolve;rejectReady=reject});
 function errorText(e){return e instanceof Error?e.message:String(e||'unknown error')}
 function connectionIssue(message){if(!connected)rejectReady(Error(message));
  for(const [id,p] of pending){clearTimeout(p.timer);p.reject(Error(message));pending.delete(id)}
 }
 function start(){
  const frame=document.createElement('iframe');
  frame.id='kv-backend-connection';frame.title='Secure Kuya Vince Store data connection';
  frame.style.cssText='position:absolute!important;left:-9999px!important;top:0!important;width:2px!important;height:2px!important;border:0!important;opacity:0!important;pointer-events:none!important';
  frame.setAttribute('aria-hidden','true');frame.tabIndex=-1;
  frame.src=WEB_APP+'?view=bridge&kv_nonce='+encodeURIComponent(nonce);
  document.body.appendChild(frame);
  window.setTimeout(()=>{
   if(!connected)connectionIssue('Could not connect to Google Apps Script. Deploy the included v12 Code.gs in the EXISTING project, then reopen this page. Check Safari settings if cross-site frames are blocked.');
  },20000);
 }
 window.addEventListener('message',event=>{
  const d=event.data;
  if(!d||d.source!=='kuya-vince-bridge-v12'||d.nonce!==nonce||!originAllowed.test(event.origin))return;
  if(d.type==='ready'){
   if(connected)return;
   bridgeWindow=event.source;bridgeOrigin=event.origin;connected=true;resolveReady();
   document.documentElement.setAttribute('data-backend-connected','true');
   return;
  }
  if(!connected||event.source!==bridgeWindow||event.origin!==bridgeOrigin||d.type!=='result')return;
  const p=pending.get(d.id);if(!p)return;
  clearTimeout(p.timer);pending.delete(d.id);
  if(d.ok)p.resolve(d.data);else p.reject(Error(String(d.error||'The Google Sheets request failed.')));
 });
 window.KV_BRIDGE_SERVICE=async function(method,...args){
  if(!['posLogin','posApi'].includes(method))throw Error('Unsupported POS service: '+method);
  await ready;
  const id=String(++counter),message={source:'kuya-vince-owner-v12',nonce,type:'request',id,method,args};
  if(JSON.stringify(message).length>150000)throw Error('Request too large.');
  return new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>{pending.delete(id);reject(Error('The POS backend timed out. Check your connection and retry.'))},65000);
   pending.set(id,{resolve,reject,timer});
   try{bridgeWindow.postMessage(message,bridgeOrigin)}catch(e){clearTimeout(timer);pending.delete(id);reject(Error(errorText(e)))}
  });
 };
 window.KV_BRIDGE_STATUS=()=>({connected,pending:pending.size,backend:WEB_APP});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();