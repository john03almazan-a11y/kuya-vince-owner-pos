/* Kuya Vince live modal: top-level HTTPS = Safari/Android getUserMedia permitted.
  Barcode values only; no direct access to Google Sheets or user credentials. */
(function(){'use strict';
 const styles=`
 .kv-camera-backdrop{position:fixed;inset:0;z-index:99999;background:#082d35d9;display:flex;align-items:center;justify-content:center;padding:12px;box-sizing:border-box}
 .kv-camera-modal{box-sizing:border-box;width:min(100%,490px);max-height:min(94dvh,760px);overflow:auto;border-radius:20px;background:#FBF3E4;color:#0B3C49;box-shadow:0 18px 60px #061c22a8;font:14px/1.45 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
 .kv-camera-head{display:flex;justify-content:space-between;align-items:center;gap:12px;background:linear-gradient(115deg,#0B3C49,#1a636e);color:white;padding:15px 16px}
 .kv-camera-head strong{font-family:Georgia,serif;font-size:22px;line-height:1.1}
 .kv-camera-head small{display:block;font-size:11px;color:#bce8e1;margin-top:5px}
 .kv-camera-x{background:#ffffff20;border:1px solid #ffffff66;color:white;width:38px;height:38px;border-radius:10px;font-size:24px;cursor:pointer}
 .kv-camera-body{padding:13px}
 .kv-camera-window{min-height:235px;border-radius:14px;background:#133d46;color:white;display:flex;align-items:center;justify-content:center;overflow:hidden;position:relative}
 #kv-modal-reader{width:100%;min-height:215px;text-align:center}
 #kv-modal-reader video{width:100%;max-height:330px;object-fit:cover;border-radius:8px}
 #kv-modal-reader img{max-width:100%}
 .kv-camera-buttons{display:flex;flex-wrap:wrap;gap:8px;margin-top:11px}
 .kv-camera-buttons button{flex:1 1 120px;border:0;background:#0B3C49;color:white;border-radius:10px;min-height:43px;padding:9px 12px;font:800 13px/1.2 inherit;cursor:pointer}
 .kv-camera-buttons button.alt{background:#d9f0ea;color:#0B3C49}.kv-camera-buttons button.coral{background:#FF6B50;color:white}
 .kv-camera-buttons button:disabled{opacity:.55;cursor:default}
 .kv-camera-status{font-size:12px;padding:9px 10px;background:#dcefe9;border-radius:9px;color:#235c65;margin-top:9px;overflow-wrap:anywhere}
 .kv-camera-status.error{background:#ffe1d6;color:#873a20}
 .kv-camera-form{margin-top:12px}.kv-camera-form label{font-size:12px;font-weight:800;display:block;margin-bottom:4px}.kv-camera-form input{border:1px solid #b6d7d0;border-radius:9px;width:100%;box-sizing:border-box;font:16px sans-serif;padding:12px;min-height:44px;color:#0B3C49;background:white}
 .kv-camera-note{font-size:11px;color:#56777c;margin-top:9px}.kv-camera-hidden{display:none!important}
 @media (max-height:700px){.kv-camera-modal{max-height:97dvh}.kv-camera-window{min-height:175px}#kv-modal-reader{min-height:165px}}
 `;
 const style=document.createElement('style');style.textContent=styles;document.head.appendChild(style);
 let active=null,loading=null;
 function library(){if(window.Html5Qrcode)return Promise.resolve();if(loading)return loading;
  loading=new Promise((resolve,reject)=>{
   const urls=['https://cdnjs.cloudflare.com/ajax/libs/html5-qrcode/2.3.8/html5-qrcode.min.js','https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js'];
   function next(i){if(i>=urls.length)return reject(Error('Scanner library could not load. Check your internet connection.'));
    const s=document.createElement('script');s.src=urls[i];s.async=true;s.onload=()=>window.Html5Qrcode?resolve():next(i+1);s.onerror=()=>next(i+1);document.head.appendChild(s)}next(0)
  }).catch(e=>{loading=null;throw e});return loading;
 }
 window.kvOpenCameraModal=function({mode,onScan}){
  if(active)return;
  const overlay=document.createElement('div');overlay.className='kv-camera-backdrop';overlay.setAttribute('role','presentation');
  overlay.innerHTML=`<section class="kv-camera-modal" role="dialog" aria-modal="true" aria-label="Live barcode scanner">
    <header class="kv-camera-head"><div><strong>Live Barcode Scanner</strong><small>Kuya Vince Store · ${mode==='sale'?'Sell':mode==='edit'?'Edit Product':mode==='create'?'Create Product':'Find Product'}</small></div><button id="kv-modal-close" class="kv-camera-x" type="button" aria-label="Close scanner">×</button></header>
    <div class="kv-camera-body"><div class="kv-camera-window"><div id="kv-modal-reader">Tap Start Camera to scan your product barcode.</div></div>
     <div class="kv-camera-buttons"><button type="button" id="kv-modal-start">Start Camera</button><button type="button" class="alt" id="kv-modal-stop" disabled>Stop Camera</button></div>
     <div id="kv-modal-status" class="kv-camera-status" role="status">Camera opens here without leaving your sale.</div>
     <div class="kv-camera-form"><label for="kv-modal-code">Or type barcode manually</label><input id="kv-modal-code" inputmode="numeric" maxlength="20" placeholder="Barcode: 6–20 digits" autocomplete="off" type="text"/></div>
     <div class="kv-camera-buttons"><button class="coral" id="kv-modal-use" type="button">Use Barcode</button><button class="alt" id="kv-modal-cancel" type="button">Cancel</button></div>
     <p class="kv-camera-note">No new tab. Camera permissions apply to this HTTPS Owner POS site, not the old Apps Script iframe.</p>
    </div></section>`;
  document.body.appendChild(overlay);
  const $=id=>overlay.querySelector('#'+id),s=$('kv-modal-status');
  const initialFocus=document.activeElement;
  active={overlay,reader:null,closing:false,scannerRunning:false};
  function status(msg,bad){s.textContent=msg;s.classList.toggle('error',!!bad)}
  async function stop(){const a=active;if(!a||!a.reader)return;
   const reader=a.reader;a.reader=null;a.scannerRunning=false;
   try{await reader.stop()}catch(e){}try{await reader.clear()}catch(e){}
   $('kv-modal-stop').disabled=true;}
  async function close(){const a=active;if(!a||a.closing)return;
   a.closing=true;await stop();overlay.remove();active=null;try{initialFocus?.focus()}catch(e){}}
  async function accept(code){code=String(code||'').trim();if(!/^\d{6,20}$/.test(code)){status('Barcode must contain 6–20 digits.',true);return}
   await close();if(typeof onScan==='function')onScan(code);
  }
  async function start(){const a=active;if(!a||a.closing||a.reader)return;
   if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia){status('Live camera requires HTTPS in Safari or Chrome.',true);return}
   $('kv-modal-start').disabled=true;status('Requesting camera permission…');
   let reader=null;
   try{await library();const formats=window.Html5QrcodeSupportedFormats,opts={verbose:false};
    if(formats)opts.formatsToSupport=['EAN_13','EAN_8','UPC_A','UPC_E','CODE_128','CODE_39','CODE_93','ITF'].map(x=>formats[x]).filter(x=>typeof x==='number');
    reader=new Html5Qrcode('kv-modal-reader',opts);if(!active||active!==a){await reader.clear().catch(()=>{});return}a.reader=reader;
    const onFound=value=>{if(!a.closing)accept(value)};
    const cfg={fps:10,qrbox:(w,h)=>({width:Math.min(310,Math.max(160,Math.floor(w*.88))),height:Math.min(150,Math.max(85,Math.floor(h*.5)))})};
    try{await reader.start({facingMode:'environment'},cfg,onFound,()=>{})}
    catch(e){const cams=await Html5Qrcode.getCameras().catch(()=>[]);if(!cams.length)throw e;
     const cam=cams.find(x=>/back|rear|environment/i.test(x.label||''))||cams[cams.length-1];await reader.start(cam.id,cfg,onFound,()=>{})}
    a.scannerRunning=true;$('kv-modal-stop').disabled=false;status('Camera ready. Hold the barcode steady within the frame.');
   }catch(e){status('Camera unavailable: '+String(e.message||e)+'. Check Safari permission or type the digits below.',true);
    if(reader)try{await reader.clear()}catch(e){}if(active===a)a.reader=null;
   }finally{if(active===a)$('kv-modal-start').disabled=false}
  }
  $('kv-modal-start').onclick=start;
  $('kv-modal-stop').onclick=stop;
  $('kv-modal-close').onclick=close;
  $('kv-modal-cancel').onclick=close;
  $('kv-modal-use').onclick=()=>accept($('kv-modal-code').value);
  $('kv-modal-code').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();accept(e.target.value)}};
  overlay.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();close()}});
  $('kv-modal-start').focus();
 };
})();