
(function(){'use strict';
const $=id=>document.getElementById(id),storage={get(k){try{return JSON.parse(localStorage.getItem(k)||'null')}catch(e){return null}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true}catch(e){return false}},remove(k){try{localStorage.removeItem(k)}catch(e){}}};
const state={token:'',user:null,base:null,products:[],cart:[],customers:[],screen:'home',selected:null,scanner:null,lastScan:'',lastScanAt:0,pending:storage.get('sspos_pending')||[],filters:{},online:navigator.onLine,lastSynced:null,syncFailure:false,syncing:false};
const esc=s=>String(s===undefined||s===null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>'₱'+(Number(n)||0).toLocaleString('en-PH',{minimumFractionDigits:2,maximumFractionDigits:2});const iso=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
const uid=()=>{try{return crypto.randomUUID()}catch(e){return Date.now()+'-'+Math.random().toString(36).slice(2)+Math.random().toString(36).slice(2)}};
function toast(msg,bad){$('toast').textContent=msg;$('toast').style.background=bad?'#a03434':'#143c22';$('toast').classList.remove('hide');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').classList.add('hide'),5500)}
function busy(v){$('busy').classList.toggle('hide',!v)}
function service(method,...args){return window.KV_BRIDGE_SERVICE(method,...args)}

async function call(action,payload){const response=await service('posApi',state.token,action,payload||{});if(!response||!response.ok){state.syncFailure=true;throw new Error(response&&response.error||'The request failed.')}state.lastSynced=new Date().toISOString();state.syncFailure=false;return response.data}
async function work(fn){busy(true);try{return await fn()}catch(e){toast(e.message||String(e),true);throw e}finally{busy(false)}}
function may(perm){return state.user&&(state.user.role==='Owner'||(state.user.permissions||[]).includes(perm))}
function moneyField(id,label,value,required){return `<div class="field"><label for="${id}">${label}</label><input id="${id}" inputmode="decimal" type="number" min="0" step="0.01" value="${esc(value??'')}" ${required?'required':''}></div>`}
function textField(id,label,value,extra){return `<div class="field"><label for="${id}">${label}</label><input id="${id}" value="${esc(value??'')}" ${extra||''}></div>`}
function dateField(id,label,value){return `<div class="field"><label for="${id}">${label}</label><input id="${id}" type="date" value="${esc(value||iso())}"></div>`}
function sel(id,label,options,value){return `<div class="field"><label for="${id}">${label}</label><select id="${id}">${options.map(x=>{const v=typeof x==='string'?x:x.value,t=typeof x==='string'?x:x.label;return `<option value="${esc(v)}" ${v===value?'selected':''}>${esc(t)}</option>`}).join('')}</select></div>`}
function customerInput(value){return `<div class="field"><label>Customer (required for Utang)</label><input id="customer" placeholder="Search or enter new customer" list="customerList" value="${esc(value||'')}"><datalist id="customerList">${state.customers.map(n=>`<option value="${esc(n)}">`).join('')}</datalist></div>`}
function page(title,subtitle,body){$('content').innerHTML=`<div class="rowhead"><div><h2 class="title">${title}</h2>${subtitle?`<p class="sub" style="margin:5px 0 0">${subtitle}</p>`:''}</div><button data-view="home" class="circle" aria-label="Home">⌂</button></div>`+body;navHighlight()}
const KV_CATEGORY_ICONS={"Snacks & Chips":"\u{1F35F}","Biscuits, Cookies & Cakes":"\u{1F36A}","Candies & Sweets":"\u{1F36C}","Canned Goods":"\u{1F96B}","Noodles & Instant Food":"\u{1F35C}","Soft Drinks & Energy Drinks":"\u{1F964}","Juices, Tea & Dairy Drinks":"\u{1F9C3}","Coffee & Powdered Drinks":"\u{2615}","Alcoholic Beverages":"\u{1F37A}","Cigarettes & Smoking Accessories":"\u{1F6AC}","Cooking Essentials & Condiments":"\u{1F9C2}","Fresh Produce":"\u{1F96C}","Dairy, Chilled & Frozen Goods":"\u{1F9C0}","Personal Care & Hygiene":"\u{1F9F4}","Laundry & Fabric Care":"\u{1F9FA}","Cleaning & Dishwashing":"\u{1F9FD}","Medicines & First Aid":"\u{1F48A}","Household Essentials":"\u{1F3E0}","Services & Payments":"\u{1F4B3}"};
function kvCategoryIconSafe(category,icon){
 const text=String(icon||'').trim();
 // Mojibake includes UTF-8 bytes interpreted as Latin-1/Windows-1252.
 if(text && !/[\u00c2\u00c3\u00e2\u00f0\ufffd]/.test(text) && !/^[?]+$/.test(text))return text;
 return KV_CATEGORY_ICONS[String(category||'')]||'\u{1F6CD}';
}

function navHighlight(){document.querySelectorAll('#nav button[data-view]').forEach(b=>{b.classList.toggle('active',b.dataset.view===state.screen);if(b.dataset.view==='inventory')b.style.display=may('stock')?'':'none';if(b.dataset.view==='expenses')b.style.display=may('expenses')?'':'none'})}
function kvErrorScreen(error,where){
 const msg=String(error && error.message || error || 'Unknown error');
 $('login').classList.add('hide');$('app').classList.remove('hide');$('nav').classList.add('hide');
 $('content').innerHTML='<div class="card" style="margin:32px auto;max-width:580px;border:2px solid #FF6B50;padding:25px"><h2 style="color:#0B3C49">Store could not load</h2><p>'+esc(where||'Owner POS')+' encountered a problem. Your product and sales data were not changed.</p><p class="banner">'+esc(msg)+'</p><p>Check your internet connection or try loading again. If this continues, send the error message to your POS developer.</p><button id="kvRetry" class="btn block">Retry loading POS</button><button id="kvSignout" class="btn outline block" style="margin-top:10px">Sign out</button></div>';
 $('kvRetry').onclick=()=>{if(state.token)work(async()=>{await refreshProducts();$('nav').classList.remove('hide');setView('home')}).catch(()=>{});else location.reload()};
 $('kvSignout').onclick=()=>logout();
}
function setView(view,arg){stopScan();state.screen=view;state.selected=arg||state.selected;try{render()}catch(e){kvErrorScreen(e,'The '+view+' screen');return}if(view==='products'||view==='sale'||view==='inventory')refreshProducts().then(()=>{if(state.screen===view&&(view==='products'||view==='inventory'))render()}).catch(e=>toast('Inventory refresh failed: '+(e.message||e),true))}
function render(){navHighlight();const v=state.screen;({home:home,sale:sale,products:products,inventory:inventory,scan:scanPage,create:createProduct,edit:editProduct,restock:restock,utang:utang,expenses:expenses,expenseDashboard:expenseDashboard,expiryDashboard:expiryDashboard,editFinder:editFinder,dashboard:dashboard,analytics:analytics,history:history,adjust:adjust,stockCount:stockCount,users:users,services:services,catalogAdmin:catalogAdmin,qaIntegrity:qaIntegrity,refundsPage:refundsPage,visitorsPage:visitorsPage,more:more,queue:queuePage})[v]?.()}
async function refreshProducts(){const [p,c]=await Promise.all([call('products'),call('bootstrap')]);
if(!Array.isArray(p)||!c||!Array.isArray(c.categoryOptions))throw new Error('The store returned incomplete product/category data. Please retry.');
state.products=p.map(x=>Object.assign({},x,{icon:kvCategoryIconSafe(x.category,x.icon)}));
state.base=Object.assign({},c,{categoryOptions:c.categoryOptions.map(x=>Object.assign({},x,{icon:kvCategoryIconSafe(x.name,x.icon)}))});
state.customers=c.customers||[];
}
async function signIn(e){e.preventDefault();busy(true);try{
 const r=await service('posLogin',$('loginUser').value.trim(),$('loginPin').value);
 if(!r||!r.ok)throw new Error(r?.error||'Login unsuccessful');
 state.token=r.token;state.user=r.user;
 try{sessionStorage.setItem('sspos_session',JSON.stringify({token:r.token,user:r.user}))}catch(e){}
 $('login').classList.add('hide');$('app').classList.remove('hide');$('nav').classList.add('hide');
 $('content').innerHTML='<div class="card" style="margin:35px auto;max-width:580px"><h2>Loading Kuya Vince Store…</h2><p>Please wait while we securely load your products and inventory.</p></div>';
 try{await refreshProducts();$('nav').classList.remove('hide');setView('home');toast('Welcome, '+r.user.name+'!')}
 catch(loadError){kvErrorScreen(loadError,'The Owner POS login');}
 }catch(e){$('login').classList.remove('hide');$('app').classList.add('hide');$('nav').classList.add('hide');toast(e.message||String(e),true)}finally{busy(false)}}
async function loginRestore(){const cached=(()=>{try{return JSON.parse(sessionStorage.getItem('sspos_session')||'null')}catch(e){return null}})();if(!cached)return;
 state.token=cached.token;state.user=cached.user;try{await refreshProducts();$('login').classList.add('hide');$('app').classList.remove('hide');$('nav').classList.remove('hide');setView('home')}catch(e){state.token='';state.user=null;try{sessionStorage.removeItem('sspos_session')}catch(e){}$('login').classList.remove('hide');$('app').classList.add('hide');$('nav').classList.add('hide');toast('Previous login expired or could not be restored. Please sign in again.',true)}}
async function logout(){try{await call('logout')}catch(e){}state.token='';state.user=null;try{sessionStorage.removeItem('sspos_session')}catch(e){};$('login').classList.remove('hide');$('app').classList.add('hide');$('nav').classList.add('hide')}

const kvPaths={
 sale:'<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M7 9h10M7 13h6M7 17h4"/>',
 scan:'<path d="M7 3H4a1 1 0 0 0-1 1v3m14-4h3a1 1 0 0 1 1 1v3M3 17v3a1 1 0 0 0 1 1h3m14-4v3a1 1 0 0 1-1 1h-3M4 11v2m4-2v2m4-2v2m3-2v2m5-2v2M4 16h16"/>',
 create:'<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 9h8m-4-4v9m-4 2h8"/>',
 products:'<path d="m3 8 9-5 9 5-9 5-9-5Zm0 0v8l9 5 9-5V8M12 13v8"/>',
 edit:'<path d="M12 20h9M4 16l-1 5 5-1L20 8a2 2 0 0 0-3-3L4 16Z"/>',
 restock:'<path d="M12 3v12m-4-4 4 4 4-4M4 17v3h16v-3"/>',
 utang:'<circle cx="12" cy="12" r="9"/><path d="M15 8H9v4h6v4H9m3-10v12"/>',
 visitors:'<circle cx="9" cy="8" r="3"/><path d="M3 20v-2c0-3 2-5 6-5s6 2 6 5v2M16 6c3 0 5 2 5 5m-4 3c3 .5 4 2 4 5"/>',
 expenses:'<path d="M4 3h16v18l-4-2-4 2-4-2-4 2V3Zm4 6h8m-8 4h7"/>',
 services:'<rect x="2" y="5" width="20" height="14" rx="3"/><path d="M2 10h20M16 15h3"/>',
 dashboard:'<rect x="3" y="11" width="4" height="10" rx="1"/><rect x="10" y="7" width="4" height="14" rx="1"/><rect x="17" y="3" width="4" height="18" rx="1"/>',
 analytics:'<path d="M3 17l6-6 4 4 8-10M16 5h5v5"/>',
 stock:'<path d="M4 7h16v14H4zM2 3h20v4H2zM9 12h6"/>',
 history:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l4 2M3 4l2 2"/>'
};
function kvActionIcon(type){return '<svg class="kv-action-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(kvPaths[type]||kvPaths.products)+'</svg>'}

function home(){const t=[
['','New Sale','Fast checkout','sale','sales','sale'],
['','Scan Barcode','Use phone camera','scan','sales','scan'],
['','Create Product','Add new inventory','create','products','create'],
['','Existing Products','Search inventory','products','sales','products'],
['','Stock / Inventory','Levels & low stock','inventory','stock','stock'],
['','Edit Product','Type to find & edit','editFinder','products','edit'],
['','Add Stock','Restock & expiry','restock','stock','restock'],
['','Utang','Customer credit','utang','credit','utang'],
['','Visitors','Customer activity','visitorsPage','owner','visitors'],
['','Other Expenses','Record store costs','expenses','expenses','expenses'],
['','Payment Services','GCash, bills & load','services','sales','services'],
['','Dashboard','Store performance','dashboard','dashboard','dashboard'],
['','Analytics','Fast & slow items','analytics','dashboard','analytics'],
['','Stock Count','Inventory reconciliation','stockCount','stock','stock'],
['','Sales History','Review transactions','history','sales','history']];
 $('content').innerHTML=`<div class="hero kv-home-hero"><img class="kv-logo-home" src="data:image/webp;base64,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" alt="Kuya Vince Store"><div class="mini">YOUR STORE AT A GLANCE</div><h2>Welcome to your Store Vincent!</h2><p>Your neighborhood store, in one beautiful place.</p><div style="margin-top:15px;font-size:11px;color:#c5d7c7"><span class="statusdot ${navigator.onLine?'':'offline'}"></span>${state.syncFailure?'Sync Failed':state.syncing?'Syncing':state.pending.length?'Pending Sync':state.lastSynced?'Synced':'Checking'} · ${state.lastSynced?new Date(state.lastSynced).toLocaleTimeString('en-PH'):'Never'} · ${esc(state.user?.role||'')}</div></div>
 ${may('stock')?(()=>{const active=state.products.filter(p=>p&&p.id&&p.active!==false),units=active.reduce((s,p)=>s+Math.max(0,Number(p.stock)||0),0),low=active.filter(p=>inventoryStatus(p)==='low').length,out=active.filter(p=>inventoryStatus(p)==='out').length,close=active.filter(p=>Number(p.stock)>0&&kvExpiryDate(p.expiry)&&kvExpiryDays(p.expiry)<=30).length;return `<div class="kv-home-stockstrip" aria-label="Stock summary"><button data-view="inventory" class="kv-home-stock"><small>STOCK ON HAND</small><strong>${units.toLocaleString('en-PH')}</strong><span>${active.length} products</span></button><button data-view="inventory" class="kv-home-stock"><small>LOW / OUT</small><strong>${low} / ${out}</strong><span>Check inventory</span></button><button data-view="expiryDashboard" class="kv-home-stock"><small>EXPIRY ALERTS</small><strong>${close}</strong><span>Expired or within 30 days</span></button><button data-view="restock" class="kv-home-stock kv-stock-action"><strong>+ Add Stock</strong><span>Search for a product</span></button></div>`})():''}
 <div class="row"><div class="section">Quick actions</div><button data-view="dashboard" class="rightlink">View reports →</button></div><div class="grid">${t.filter(x=>may(x[4])).map(x=>`<button class="tile" data-view="${x[3]}"><span class="emoji kv-action-icon kv-action-${x[5]}">${kvActionIcon(x[5])}</span><strong>${x[1]}</strong><span>${x[2]}</span></button>`).join('')}</div><p class="footer-note">POS is private. The customer price list is a different link.</p>`;navHighlight()}

function iconForProduct(name){const n=String(name||'').toLowerCase();const list=[[/gin|rum|vodka|redhorse|beer/,'🍾'],[/coke|sprite|pepsi|royal|mountain dew|softdrink/,'🥤'],[/milk|chuckie|dutchmill|yakult/,'🥛'],[/coffee|kopiko|nescafe/,'☕'],[/shampoo|soap|dove|sunsilk/,'🧴'],[/piattos|chip|snack|crispy|martys|ding.dong/,'🍟'],[/sugar|salt|asin/,'🧂'],[/garlic|bawang|onion|sibuyas|luya/,'🧅'],[/sardina|tuna|fish/,'🐟'],[/flour|cornstarch|bigas|rice/,'🌾'],[/cheese|eden/,'🧀'],[/oil|mantika/,'🫙'],[/biogesic|solmux|neozep|medicine/,'💊'],[/biscuit|cookie/,'🍪'],[/candy|choco|chocolate/,'🍫'],[/water|tubig/,'💧']];for(const [pat,icon] of list)if(pat.test(n))return icon;return '🛍️'}
function productOptions(value){return `<option value="">Select product</option>${state.products.slice().sort((a,b)=>a.name.localeCompare(b.name)).map(p=>`<option value="${esc(p.id)}" ${value===p.id?'selected':''}>${esc(p.name)} · ${p.stock} left</option>`).join('')}`}
function getProduct(id){return state.products.find(p=>p.id===id)}
function addCartProduct(id){const p=getProduct(id);if(!p){toast('Product not found. Search or link the barcode.',true);return}if(p.stock<1){toast('Out of stock',true);return}
 const salePrice=Number(p.effectivePrice??p.price);const existing=state.cart.find(x=>x.kind==='product'&&x.id===id&&x.unitPrice===salePrice);if(kvCartQuantity(id)>=Number(p.stock||0)){toast('Only '+p.stock+' left for '+p.name,true);return}if(existing)existing.qty++;else state.cart.push({kind:'product',id,qty:1,unitPrice:salePrice});setView('sale');toast(p.name+(p.discountActive?' · promotional price applied':'')+' added')}
function kvSaleIcon(type){return kvActionIcon(type==='customer'?'users':type==='search'?'search':type==='cart'?'sale':type==='pay'?'services':'sale')}
function kvExpiryDate(raw){
 if(!raw)return null;
 const x=String(raw).trim();let d;
 if(/^\d{4}-\d{2}-\d{2}/.test(x))d=new Date(x.slice(0,10)+'T12:00:00');
 else if(/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(x)){const m=x.split('/').map(Number);d=new Date(m[2],m[1]-1,m[0],12);}
 else d=new Date(x);
 return d&&Number.isFinite(d.getTime())?d:null;
}
function kvExpiryNotice(product){
 const d=kvExpiryDate(product?.expiry);if(!d)return '';
 const now=new Date(),today=new Date(now.getFullYear(),now.getMonth(),now.getDate(),12);
 const days=Math.ceil((d.getTime()-today.getTime())/86400000);
 const readable=d.toLocaleDateString('en-PH',{day:'2-digit',month:'short',year:'numeric'});
 if(days<0)return `<span class="kv-expiry-alert expired">EXPIRED ${esc(readable)} — DO NOT SELL</span>`;
 if(days<=30)return `<span class="kv-expiry-alert">Expiry: ${esc(readable)} ${days===0?'· Today':'· '+days+' days left'}</span>`;
 return '';
}
function kvCartQuantity(id){return state.cart.filter(x=>x.kind==='product'&&x.id===id).reduce((n,x)=>n+Number(x.qty||0),0)}
function kvDiscountInfo(){
 const subtotal=Math.round(cartSum()*100),enabled=!!state.filters.discountEnabled&&may('discounts');
 const v=Number(state.filters.discountValue||0),type=state.filters.discountType==='amount'?'amount':'percent';
 const invalid=enabled&&(!Number.isFinite(v)||v<0||(type==='percent'&&v>100)||(type==='amount'&&Math.round(v*100)>subtotal));
 const discount=enabled&&!invalid?Math.min(subtotal,type==='percent'?Math.round(subtotal*v/100):Math.round(v*100)):0;
 return {subtotal,discount,total:subtotal-discount,invalid,enabled,type,value:v};
}
function kvSplitCheckAndPayment(){
 if(!$('splitCheck'))return;
 checkSplitTotal();
}
function kvDiscountedSaleItems(){
 const info=kvDiscountInfo();if(info.invalid)throw Error('Discount must be 0–100% or no greater than subtotal.');
 const orig=state.cart.map((item,i)=>{const cents=Math.round((item.kind==='manual'?Number(item.amount||0):Number(item.unitPrice||0)*Number(item.qty||0))*100);return {item,i,cents:Math.max(0,cents)}});
 const amount=orig.reduce((n,o)=>n+o.cents,0);
 if(!info.discount||!amount)return state.cart.map(x=>Object.assign({},x));
 // Allocate exact cent-denominated discount proportionally, including any manual items.
 const portions=orig.map(o=>({...o,part:Math.floor(info.discount*o.cents/amount),fraction:(info.discount*o.cents)%amount}));
 let remain=info.discount-portions.reduce((n,o)=>n+o.part,0);
 const order=[...portions].sort((a,b)=>b.fraction-a.fraction||a.i-b.i);
 for(const o of order){if(!remain)break;if(o.part<o.cents){o.part++;remain--}}
 if(remain)throw Error('Unable to allocate discount correctly.');
 const result=[];
 for(const o of portions){const x=o.item;
  if(x.kind==='manual'){
   const net=o.cents-o.part;
   if(net<=0)throw Error('Discount leaves an unspecified-product amount at zero. Reduce the discount or remove that line.');
   result.push(Object.assign({},x,{amount:(net/100).toFixed(2)}));continue;
  }
  const qty=Number(x.qty),unit=Math.round(Number(x.unitPrice)*100);
  if(!Number.isSafeInteger(qty)||qty<1)throw Error('Invalid product quantity.');
  const per=Math.floor(o.part/qty),remainder=o.part%qty;
  if(qty>remainder)result.push(Object.assign({},x,{qty:qty-remainder,unitPrice:((unit-per)/100).toFixed(2)}));
  if(remainder)result.push(Object.assign({},x,{qty:remainder,unitPrice:((unit-per-1)/100).toFixed(2)}));
 }
 if(result.length>40)throw Error('Discount needs more than 40 receipt lines. Reduce the number of different products.');
 const exact=Math.round(result.reduce((s,x)=>s+(x.kind==='manual'?Number(x.amount):Number(x.qty)*Number(x.unitPrice)),0)*100);
 if(exact!==info.total)throw Error('The discount allocation did not match the total; sale was not submitted.');
 return result;
}
function kvSaleCancel(){
 const modal=$('kvSaleCancelDialog');if(modal)modal.classList.remove('hide');
}
function kvCustomer2Suggest(show){
 const input=$('splitName2'),root=$('kvCustomer2Hints');if(!input||!root)return;
 const typed=input.value.trim(),q=typed.toLocaleLowerCase('en');
 const names=[...new Map((state.customers||[]).map(n=>[String(n).toLocaleLowerCase('en'),String(n)])).values()]
  .filter(n=>!q||n.toLocaleLowerCase('en').includes(q)).slice(0,6);
 const exact=(state.customers||[]).some(n=>String(n).toLocaleLowerCase('en')===q);
 root.innerHTML=!show?'':(
  names.map(n=>`<button type="button" class="kv-customer2-option" data-kv-customer2="${esc(n)}">👤 ${esc(n)}</button>`).join('')+
  (typed&&!exact?`<button type="button" class="kv-customer2-option kv-customer2-create" data-kv-customer2="${esc(typed)}">＋ Use new customer: <strong>${esc(typed)}</strong></button>`:'')
 );
 root.querySelectorAll('[data-kv-customer2]').forEach(b=>b.addEventListener('click',()=>{
  input.value=b.dataset.kvCustomer2;state.filters.splitName2=input.value;
  root.innerHTML='';checkSplitTotal();input.focus();
 }));
}
function sale(){
 const customer=state.filters.customer||'',payment=state.filters.payment||'Cash',split=!!state.filters.split,info=kvDiscountInfo();
 const payments=(state.base?.payments||['Cash','GCash','Bank Transfer','Card','Utang','Other']);
 const defaultSplit=money(kvSaleNet()/2);
 const catItems=state.cart.reduce((n,x)=>n+Number(x.qty||1),0);
 const findQuantity=x=>x.kind==='manual'?1:Number(x.qty)||0;
 $('content').innerHTML=`<div class="kv-new-sale-wrap"><section class="kv-sale-window">
 <header class="kv-sale-titlebar"><div><h2>New Sale</h2><div class="kv-sale-subtitle">Kuya Vince Store · One-window checkout</div></div>
 <button type="button" id="kvSaleX" class="kv-sale-x" aria-label="Close without saving">&times;</button></header>
 <div class="kv-sale-main">
   <div class="kv-sale-left">
     <section class="kv-sale-card kv-customer-card"><div class="kv-sale-cardtitle"><span class="kv-title-icon">${kvSaleIcon('customer')}</span>Customer details <span class="kv-sale-step">Step 1</span></div>
      <div class="kv-sale-inputrow"><div class="kv-sale-field"><label for="customer">Customer 1</label><input id="customer" list="customerList" placeholder="Walk-in / Customer name" value="${esc(customer)}"><datalist id="customerList">${state.customers.map(x=>`<option value="${esc(x)}"></option>`).join('')}</datalist></div>
      <div class="kv-sale-field"><label for="saleDate">Date</label><input type="date" id="saleDate" value="${esc(state.filters.date||iso())}"></div></div>
      <button type="button" id="splitToggle" class="kv-inline-link">${split?'− Remove second customer':'+ Add second customer'}</button>
      <div class="kv-sale-split ${split?'':'hide'}" id="kvSaleSplit">
        <div class="kv-sale-field kv-customer2-field"><label for="splitName2">Customer 2</label><input id="splitName2" list="customerList" autocomplete="off" maxlength="100" placeholder="Search or add a customer" value="${esc(state.filters.splitName2||'')}" aria-describedby="kvCustomer2Help"><div class="kv-customer2-hints" id="kvCustomer2Hints" aria-label="Customer 2 suggestions"></div><small id="kvCustomer2Help" class="kv-customer2-help">Select an existing customer or enter a new name. A new name is saved after the sale is completed.</small></div>
        <div class="kv-sale-splitpair"><div><label>Customer 1 payment</label><select id="splitMethod1"><option value="Cash" ${state.filters.splitMethod1==='Utang'?'':'selected'}>Cash</option><option value="Utang" ${state.filters.splitMethod1==='Utang'?'selected':''}>Utang</option></select></div><div><label>Customer 1 amount</label><input type="number" min="0" step=".01" id="splitAmount1" value="${esc(state.filters.splitAmount1??'')}"></div></div>
        <div class="kv-sale-splitpair"><div><label>Customer 2 payment</label><select id="splitMethod2"><option value="Cash" ${state.filters.splitMethod2==='Utang'?'':'selected'}>Cash</option><option value="Utang" ${state.filters.splitMethod2==='Utang'?'selected':''}>Utang</option></select></div><div><label>Customer 2 amount</label><input type="number" min="0" step=".01" id="splitAmount2" value="${esc(state.filters.splitAmount2??'')}"></div></div>
        <span id="splitCheck" class="kv-sale-muted"></span>
      </div>
     </section>
     <section class="kv-sale-card kv-search-card"><div class="kv-sale-cardtitle"><span class="kv-title-icon">${kvSaleIcon('search')}</span>Search & add products <span class="kv-sale-step">Tap to add</span></div>
       <div class="kv-search-line"><input id="saleSearch" autocomplete="off" placeholder="Search product name, ID or barcode…" value="${esc(state.filters.search||'')}" aria-label="Search products"><button type="button" class="kv-scan-mini" id="kvSaleLiveScan" title="Open barcode scanner">Scan</button></div>
       <div id="saleResults" class="kv-sale-picks" aria-live="polite"></div>
       <button id="addManual" type="button" class="kv-inline-link">+ Add unspecified/manual amount</button>
     </section>
   </div>
   <div class="kv-sale-right">
     <section class="kv-sale-card kv-cart-card"><div class="kv-sale-cardtitle"><span class="kv-title-icon">${kvSaleIcon('cart')}</span>Selected products <span class="kv-sale-step">${catItems} unit${catItems===1?'':'s'}</span></div>
      <div class="kv-sale-cartscroll" id="kvSaleCart">${state.cart.length?state.cart.map((x,i)=>{const p=x.kind==='manual'?null:getProduct(x.id);const qty=findQuantity(x), available=p?Number(p.stock||0):0, after=available-kvCartQuantity(x.id), itemTotal=x.kind==='manual'?Number(x.amount||0):qty*Number(x.unitPrice||0);
       return `<div class="kv-cart-line"><div class="kv-cart-line-top"><strong>${x.kind==='manual'?'Unspecified Product':esc(p?.name||x.id)}</strong><b>${money(itemTotal)}</b></div>
       ${p?`<div class="kv-stock-count ${after<0?'short':''}">In stock: ${available} · After sale: ${Math.max(0,after)}${after<0?' · Not enough stock':''}</div>${kvExpiryNotice(p)}`:'<span class="kv-stock-count">No inventory deduction for this manual line</span>'}
       <div class="kv-cart-controls">${x.kind==='manual'?`<div class="kv-manual-fields"><label>Sale amount (₱)</label><input type="number" min="0.01" step=".01" data-manual="${i}" value="${esc(x.amount||'')}" style="width:95px">${may('profit')?`<label>Cost (optional)</label><input type="number" min="0" step=".01" data-manualcost="${i}" value="${esc(x.cost||'')}" style="width:90px">`:''}</div>`:`<div class="kv-qty"><button type="button" data-step="${i}:-1" aria-label="Decrease quantity">−</button><b>${qty}</b><button type="button" data-step="${i}:1" aria-label="Increase quantity">+</button></div>${may('discounts')?`<label class="kv-unitprice">Price/unit<input type="number" min="0" step=".01" data-unitprice="${i}" value="${esc(x.unitPrice)}" aria-label="Unit selling price"></label>`:''}`}
       <button type="button" class="kv-sale-remove" data-remove="${i}">Remove</button></div></div>`}).join(''):'<div class="kv-sale-empty">No products yet. Search and tap + to add.</div>'}</div>
     </section>
     <section class="kv-sale-card kv-payment-card"><div class="kv-sale-cardtitle"><span class="kv-title-icon">${kvSaleIcon('pay')}</span>Payment & notes</div>
       <div class="kv-sale-inputrow"><div class="kv-sale-field" id="normalPayment" style="${split?'display:none':''}"><label for="salePayment">Payment method</label><select id="salePayment">${payments.map(m=>`<option value="${esc(m)}" ${m===payment?'selected':''}>${esc(m)}</option>`).join('')}</select></div>
       <div class="kv-sale-field"><label for="cashReceived">Amount received (₱)</label><input type="number" min="0" step=".01" id="cashReceived" value="${esc(state.filters.cash||'')}" placeholder="Optional"></div></div>
       <div id="changeNote" class="kv-change-label"></div>
       ${may('discounts')?`<button type="button" id="kvDiscountToggle" class="kv-discount-toggle"><span>${info.enabled?'− Remove discount':'+ Add discount'}</span><span id="kvDiscountStatus">${info.enabled?money(info.discount/100)+' off':'Choose % or ₱'}</span></button>
       <div class="kv-discount-panel ${info.enabled?'':'hide'}" id="kvDiscountPanel"><div><label for="kvDiscountType">Discount type</label><select id="kvDiscountType"><option value="percent" ${info.type==='percent'?'selected':''}>Percent (%)</option><option value="amount" ${info.type==='amount'?'selected':''}>Amount (₱)</option></select></div><div><label for="kvDiscountValue">Value</label><input id="kvDiscountValue" type="number" min="0" step=".01" value="${esc(state.filters.discountValue||'0')}"></div></div>`:''}
       <div class="kv-sale-field"><label for="saleNotes">Notes (optional)</label><textarea id="saleNotes" rows="2" placeholder="Note about this sale…">${esc(state.filters.notes||'')}</textarea></div>
       <button type="button" class="kv-queue-link" id="queueButton" ${state.cart.length?'':'disabled'}>Save to offline queue</button>
     </section>
   </div>
 </div>
 <footer class="kv-sale-footer"><div class="kv-sale-totals"><div class="kv-total-label">TOTAL TO PAY · ${catItems} units</div><div class="kv-grand-total" id="cartTotal">${money(info.total/100)}</div><div class="kv-total-breakdown" id="kvTotalDetail">Subtotal ${money(info.subtotal/100)} · Discount ${money(info.discount/100)}</div></div><div class="kv-sale-footer-actions"><button type="button" class="kv-cancel-btn" id="kvSaleCancel">Cancel</button><button type="button" class="kv-complete-btn" id="checkoutButton" ${state.cart.length?'':'disabled'}>Complete Sale →</button></div></footer>
 <div class="kv-sale-dialog hide" id="kvSaleCancelDialog" role="dialog" aria-modal="true" aria-label="Discard sale confirmation"><div class="kv-dialog-card"><strong>Discard this sale?</strong><p>All unsaved customer details, products, payment, discount and notes will be cleared. Your stock and sales history will NOT change.</p><div><button type="button" id="kvKeepEditing">Keep editing</button><button type="button" id="kvDiscardSale">Discard sale</button></div></div></div>
 </section></div>`;
 navHighlight();
 $('kvSaleLiveScan').onclick=()=>kvLiveScan('sale');
 const search=$('saleSearch');search.addEventListener('input',()=>{state.filters.search=search.value;updateSaleResults(search.value)});updateSaleResults(search.value);
 $('kvSaleX').onclick=kvSaleCancel;$('kvSaleCancel').onclick=kvSaleCancel;
 $('kvKeepEditing').onclick=()=>$('kvSaleCancelDialog').classList.add('hide');
 $('kvDiscardSale').onclick=()=>{state.cart=[];state.filters={};setView('home');toast('Unsaved sale discarded. No stock was changed.');};
 $('splitToggle').onclick=()=>{state.filters.split=!state.filters.split;if(state.filters.split){state.filters.splitName1=state.filters.customer||'';if(!state.filters.splitAmount1&&!state.filters.splitAmount2){const half=Math.floor(kvSaleNet()*50)/100;state.filters.splitAmount1=half.toFixed(2);state.filters.splitAmount2=(kvSaleNet()-half).toFixed(2)}}sale()};
 for(const i of [1,2]){
  if(i===2){
   const customer2=$('splitName2');
   customer2.addEventListener('input',e=>{state.filters.splitName2=e.target.value;kvCustomer2Suggest(true);checkSplitTotal()});
   customer2.addEventListener('focus',()=>kvCustomer2Suggest(true));
   customer2.addEventListener('blur',()=>setTimeout(()=>{const hints=$('kvCustomer2Hints');if(hints)hints.innerHTML=''},180));
   kvCustomer2Suggest(false);
  }
  for(const key of ['Method','Amount'])$('split'+key+i).addEventListener('input',e=>{state.filters['split'+key+i]=e.target.value;checkSplitTotal()});
 }
 $('customer').addEventListener('input',e=>{state.filters.customer=e.target.value;state.filters.splitName1=e.target.value});
 $('saleDate').addEventListener('input',e=>state.filters.date=e.target.value);
 $('salePayment').addEventListener('change',e=>{state.filters.payment=e.target.value;calculateChange()});
 $('cashReceived').addEventListener('input',e=>{state.filters.cash=e.target.value;calculateChange()});
 $('saleNotes').addEventListener('input',e=>state.filters.notes=e.target.value);
 $('addManual').onclick=()=>{state.cart.push({kind:'manual',amount:'',cost:''});sale()};
 $('checkoutButton').onclick=checkout;$('queueButton').onclick=queueSale;
 document.querySelectorAll('[data-step]').forEach(b=>b.onclick=()=>{const [i,s]=b.dataset.step.split(':').map(Number),line=state.cart[i];
 if(s>0&&line.kind==='product'){const product=getProduct(line.id);if(!product||kvCartQuantity(line.id)>=Number(product.stock||0)){toast('Not enough stock for '+(product?.name||'this product'),true);return}}
 line.qty+=s;if(line.qty<1)state.cart.splice(i,1);sale()});
 document.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{state.cart.splice(Number(b.dataset.remove),1);sale()});
 document.querySelectorAll('[data-manual]').forEach(e=>e.addEventListener('input',()=>{state.cart[Number(e.dataset.manual)].amount=e.value;updateCartTotal()}));
 document.querySelectorAll('[data-manualcost]').forEach(e=>e.addEventListener('input',()=>{state.cart[Number(e.dataset.manualcost)].cost=e.value}));
 document.querySelectorAll('[data-unitprice]').forEach(e=>e.addEventListener('change',()=>{state.cart[Number(e.dataset.unitprice)].unitPrice=Number(e.value);sale()}));
 if($('kvDiscountToggle')){$('kvDiscountToggle').onclick=()=>{state.filters.discountEnabled=!state.filters.discountEnabled;sale()};$('kvDiscountType').addEventListener('change',e=>{state.filters.discountType=e.target.value;updateCartTotal()});$('kvDiscountValue').addEventListener('input',e=>{state.filters.discountValue=e.target.value;updateCartTotal()})}
 updateCartTotal();
}
function updateSaleResults(v){
 const q=String(v||'').trim().toLowerCase(),results=state.products.filter(p=>p.active&&(!q||p.name.toLowerCase().includes(q)||p.id.toLowerCase().includes(q)||(p.barcodes||[]).some(b=>b.includes(q)))).slice(0,q?8:5);
 const el=$('saleResults');if(!el)return;
 el.innerHTML=results.map(p=>{const stock=Math.max(0,Number(p.stock||0)),left=stock-kvCartQuantity(p.id);return `<button type="button" class="kv-product-pill" data-add="${esc(p.id)}" ${left<=0?'disabled':''}><span class="kv-pill-plus">+</span><span class="kv-pill-main">${esc(p.name)}<small>${left>0?left+' available':'Out of stock'}</small></span><span class="kv-promo-saleprice"><b>${money(p.effectivePrice??p.price)}</b>${p.discountActive?`<s>${money(p.price)}</s>`:''}</span></button>`}).join('')||'<div class="kv-sale-muted">No matching products.</div>';
 el.querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>addCartProduct(b.dataset.add));
}
function cartSum(){return state.cart.reduce((n,x)=>n+(x.kind==='manual'?Number(x.amount||0):Number(x.qty||0)*Number(x.unitPrice||0)),0)}
function kvSaleNet(){return kvDiscountInfo().total/100}
function updateCartTotal(){
 const info=kvDiscountInfo(),valid=!info.invalid;
 if($('cartTotal'))$('cartTotal').textContent=valid?money(info.total/100):'Check discount';
 if($('kvTotalDetail')){$('kvTotalDetail').textContent=`Subtotal ${money(info.subtotal/100)} · Discount ${money(info.discount/100)}`;$('kvTotalDetail').style.color=valid?'':'#BD4A3B';}
 if($('kvDiscountStatus'))$('kvDiscountStatus').textContent=valid&&info.enabled?money(info.discount/100)+' off':info.invalid?'Invalid discount':'Choose % or ₱';
 calculateChange();checkSplitTotal();
}
function calculateChange(){if(!$('changeNote'))return;const n=Number($('cashReceived')?.value||0),sum=kvSaleNet(),m=$('salePayment')?.value;$('changeNote').textContent=m==='Cash'&&n>0?'Change: '+money(Math.max(0,n-sum))+(n<sum?' · Not enough cash':''):''}
function checkSplitTotal(){const el=$('splitCheck');if(!el||!state.filters.split)return;const cents=i=>Math.round(Number($('splitAmount'+i)?.value||0)*100);const diff=Math.round(kvSaleNet()*100)-cents(1)-cents(2);el.textContent=diff===0?'✓ Amounts match the discounted total':('Amount difference: '+money(Math.abs(diff)/100)+(diff>0?' still unassigned':' too much'));el.style.color=diff===0?'#087b63':'#ad4b37';}
function splitValues(){if(!state.filters.split)return null;return [1,2].map(i=>({name:i===1?$('customer').value.trim():$('splitName2').value.trim(),method:$('splitMethod'+i).value,amount:Number($('splitAmount'+i).value)}))}
function splitValid(p){if(!p.splitCustomers)return true;const a=p.splitCustomers;return a.length===2&&a.every(x=>x.name&&['Cash','Utang'].includes(x.method)&&Number.isFinite(x.amount)&&x.amount>0)&&a[0].name.toLowerCase()!==a[1].name.toLowerCase()&&a.reduce((s,x)=>s+Math.round(x.amount*100),0)===Math.round(kvSaleNet()*100)}
function salePayload(){
 const info=kvDiscountInfo();if(info.invalid)throw Error('Invalid discount: enter 0–100% or a fixed amount no larger than the subtotal.');
 const items=kvDiscountedSaleItems(),note=$('saleNotes').value.trim();
 const label=info.discount?`[Discount: ${info.type==='percent'?info.value+'%':'₱'+info.value.toFixed(2)}; saved ₱${(info.discount/100).toFixed(2)}]`:'';
 return {splitCustomers:splitValues(),requestId:uid(),date:$('saleDate').value,customer:$('customer').value.trim(),payment:$('salePayment').value,notes:note&&label?note+' '+label:note||label,items};
}
async function checkout(){
 if(!state.cart.length)return;
 const warning=kvSaleValidate();if(warning){toast(warning,true);return}
 let payload;try{payload=salePayload()}catch(e){toast(e.message,true);return}
 if(!payload.splitCustomers&&!payload.customer&&payload.payment==='Utang'){toast('Customer required for Utang',true);return}
 if(!splitValid(payload)){toast('Enter both customers with shares matching the discounted total.',true);return}
 if(!navigator.onLine){saveQueue(payload);return}
 if(!confirm('Record '+money(kvSaleNet())+' as '+(payload.splitCustomers?'Split Payment':payload.payment)+'?'))return;
 $('checkoutButton').disabled=true;
 await work(async()=>{try{const r=await call('checkout',payload);toast('Saved '+r.transactionId+' · '+money(r.total));state.cart=[];state.filters={};await refreshProducts();setView('sale')}catch(e){toast('Not saved. '+e.message+' Check _POS_Requests before submitting again.',true);$('checkoutButton')&&($('checkoutButton').disabled=false)}});
}
function kvSaleValidate(){
 const info=kvDiscountInfo();if(info.invalid)return 'Please correct the discount amount or percentage.';
 if(info.total<=0)return 'Total must be more than ₱0.00.';
 for(const x of state.cart){if(x.kind==='manual'){if(Number(x.amount||0)<=0)return 'Enter the manual sale amount.';continue;}
  const p=getProduct(x.id);if(!p)return 'A product is no longer in your inventory.';
  if(kvCartQuantity(x.id)>Number(p.stock||0))return p.name+': only '+p.stock+' left.';
  const expiry=kvExpiryDate(p.expiry);if(expiry){const now=new Date(),today=new Date(now.getFullYear(),now.getMonth(),now.getDate(),12);if(expiry.getTime()<today.getTime())return p.name+' has expired. Remove it before checkout.';}
 }
 return '';
}
function saveQueue(p){state.pending.push({payload:p,created:new Date().toISOString(),status:'PENDING'});if(!storage.set('sspos_pending',state.pending)){toast('Local offline storage blocked. Cannot queue safely on this phone.',true);state.pending.pop();return}state.cart=[];state.filters={};toast('Queued offline. Sync later when you have internet.');setView('queue')}
function queueSale(){if(!state.cart.length)return;const warning=kvSaleValidate();if(warning){toast(warning,true);return}let p;try{p=salePayload()}catch(e){toast(e.message,true);return}if(!p.splitCustomers&&p.payment==='Utang'&&!p.customer){toast('Enter a customer for Utang',true);return}if(!splitValid(p)){toast('Split amounts must equal the sale total.',true);return}if(confirm('Store this sale on THIS PHONE until you sync? Stock is not deducted until accepted by Google Sheets.'))saveQueue(p)}
function queuePage(){page('Offline queue','Pending entries saved on this device.','<div class="banner">Offline sales must be approved by the live Google Sheet when you reconnect. Stock conflicts are NOT silently ignored. Keep this browser data until each sale is confirmed.</div>'+
 `<div class="list">${state.pending.map((q,i)=>`<div class="item"><div><strong>${money(q.payload.items.reduce((s,x)=>s+(x.kind==='manual'?Number(x.amount||0):x.qty*x.unitPrice),0))}</strong><div class="desc">${esc(q.payload.customer||'Walk-in')} · ${esc(q.payload.payment)} · ${esc(q.status)}</div></div><div class="right"><button class="btn small" data-sync="${i}">Sync</button></div></div>`).join('')}</div><div style="margin-top:14px"><button class="btn block" id="syncAll">Sync all pending sales</button><button class="btn block danger" id="queueClear" style="margin-top:7px">Remove pending queue (after verifying)</button></div>`);
 document.querySelectorAll('[data-sync]').forEach(b=>b.onclick=()=>syncQueue(Number(b.dataset.sync)));$('queueClear').onclick=()=>{if(confirm('First verify _POS_Requests and Daily Sales Tracker. Removing the queue does not reverse any submitted sale. Remove all local entries?')){state.pending=[];storage.set('sspos_pending',[]);queuePage()}};$('syncAll').onclick=async()=>{for(let i=0;i<state.pending.length;){const before=state.pending.length;await syncQueue(i);if(state.pending.length===before)i++;}}}
async function syncQueue(i){const q=state.pending[i];if(!q)return;await work(async()=>{try{const r=await call('checkout',q.payload);state.pending.splice(i,1);storage.set('sspos_pending',state.pending);toast('Synced '+r.transactionId);await refreshProducts();queuePage()}catch(e){q.status='REVIEW: '+e.message;storage.set('sspos_pending',state.pending);queuePage()}})}
function inventoryStatus(p){
 const stock=Math.max(0,Number(p.stock)||0), red=Number(p.red),orange=Number(p.orange);
 if(stock===0)return 'out';
 const levels=[Number.isFinite(red)&&red>0?red:0,Number.isFinite(orange)&&orange>0?orange:0];
 return Math.max(...levels)>0&&stock<=Math.max(...levels)?'low':'good';
}
function inventory(){
 if(!may('stock')){page('Stock / Inventory','Only authorized staff can view inventory.',`<div class="banner red">You don't have inventory permission.</div>`);return}
 const all=(state.products||[]).filter(p=>p&&p.id);
 const out=all.filter(p=>inventoryStatus(p)==='out').length;
 const low=all.filter(p=>inventoryStatus(p)==='low').length;
 const totalUnits=all.reduce((a,p)=>a+Math.max(0,Number(p.stock)||0),0);
 page('Stock / Inventory','Current stock levels from Store Inventory Final.',`
  <div class="grid3">
   <div class="mini-stat"><div class="lbl">Products</div><div class="number">${all.length}</div></div>
   <div class="mini-stat"><div class="lbl">Stock units</div><div class="number">${totalUnits.toLocaleString('en-PH')}</div></div>
   <div class="mini-stat"><div class="lbl">Low / Out</div><div class="number">${low} / ${out}</div></div>
  </div>
  <div class="card" style="margin-top:14px">
   <div class="row wrap">
    <button class="btn light small" id="kvInventoryRefresh">↻ Refresh stock</button>
    <button class="btn outline small" data-view="products">Manage products</button>
   </div>
   <div style="height:14px"></div>
   <div class="field"><label for="kvInventorySearch">Search products / Product ID</label><input id="kvInventorySearch" placeholder="Name or ID" autocomplete="off"></div>
   <div class="fieldgrid"><div class="field"><label for="kvInventoryStatusFilter">Stock status</label><select id="kvInventoryStatusFilter">
      <option value="all">All stock</option><option value="out">Out of stock</option><option value="low">Low stock</option><option value="good">In stock</option></select></div>
    <div class="field"><label for="kvInventoryCategory">Category</label><select id="kvInventoryCategory">${productCategoryOptions('',true)}</select></div></div>
   <div class="field"><label for="kvInventorySort">Sort</label><select id="kvInventorySort"><option value="stock">Lowest stock first</option><option value="name">Product name A–Z</option><option value="category">Category A–Z</option></select></div>
   <div class="tiny" id="kvInventoryCount" style="margin:12px 0 6px"></div>
   <div class="kv-inventory-results" id="kvInventoryList"></div>
  </div>
  ${may('stock')?`<div class="row wrap"><button class="btn" data-view="restock">+ Add Stock</button><button class="btn outline" data-view="stockCount">Physical Stock Count</button><button class="btn outline" data-view="adjust">Damaged / Expired</button></div>`:''}
  <p class="footer-note">Stock is displayed from Google Sheets. Use Add Stock, Physical Count, or Damaged / Expired to change quantities. Viewing this page never changes inventory.</p>`);
 for(const id of ['kvInventorySearch','kvInventoryStatusFilter','kvInventoryCategory','kvInventorySort'])$(id).addEventListener(id==='kvInventorySearch'?'input':'change',inventoryList);
 $('kvInventoryRefresh').onclick=()=>work(async()=>{await refreshProducts();if(state.screen==='inventory')inventory();toast('Stock updated from Google Sheets')}).catch(()=>{});
 inventoryList();
}
function inventoryList(){
 const root=$('kvInventoryList');if(!root)return;
 const query=String($('kvInventorySearch').value||'').trim().toLowerCase(),status=$('kvInventoryStatusFilter').value,category=$('kvInventoryCategory').value,order=$('kvInventorySort').value;
 const rows=(state.products||[]).filter(p=>p&&p.id&&(!query||String(p.name||'').toLowerCase().includes(query)||String(p.id||'').toLowerCase().includes(query))&&(!category||p.category===category)&&(status==='all'||inventoryStatus(p)===status)).sort((a,b)=>order==='name'?a.name.localeCompare(b.name):order==='category'?String(a.category||'').localeCompare(String(b.category||''))||a.name.localeCompare(b.name):(Number(a.stock)||0)-(Number(b.stock)||0)||a.name.localeCompare(b.name));
 $('kvInventoryCount').textContent='Showing '+rows.length+' matching product'+(rows.length===1?'':'s')+(rows.length>100?' (first 100 shown)':'');
 root.innerHTML=rows.slice(0,100).map(p=>{
 const k=inventoryStatus(p),label=k==='out'?'Out of stock':k==='low'?'Low stock':'In stock';
 const available=Math.max(0,Number(p.stock)||0);const id=esc(p.id);
 return `<div class="kv-inventory-line">
  <span class="product-symbol" aria-hidden="true">${esc(kvCategoryIconSafe(p.category,p.icon))}</span>
  <div class="kv-inventory-info"><strong>${esc(p.name)}</strong><div class="tiny">${id} · ${esc(p.category||'Uncategorized')}</div><div class="tiny">${esc(p.expiry||'No expiry recorded')}</div></div>
  <div style="text-align:right"><div style="font-weight:850;color:#0B3C49;font-size:19px">${available.toLocaleString('en-PH')} <span class="tiny">units</span></div><span class="kv-inventory-status ${k}">${label}</span></div>
  <div class="kv-inventory-actions"><button class="btn outline small" data-inventory-product="${id}">View</button>${may('stock')?`<button class="btn small" data-inventory-restock="${id}">+ Stock</button>`:''}</div>
 </div>`}).join('')||'<div class="muted" style="padding:22px 0">No matching inventory items.</div>';
 root.querySelectorAll('[data-inventory-product]').forEach(b=>b.onclick=()=>manageProduct(b.dataset.inventoryProduct));
 root.querySelectorAll('[data-inventory-restock]').forEach(b=>b.onclick=()=>setView('restock',b.dataset.inventoryRestock));
}

function products(){page('Existing products','Search items registered in Google Sheets.',`<div class="card"><input id="productSearch" placeholder="Find product by name or ID" class="search"><div class="field"><label>Category</label><select id="productCategoryFilter">${productCategoryOptions('',true)}</select></div><div id="productResults" class="list"></div></div><div class="row wrap"><button class="btn outline" data-view="scan">Scan barcode</button>${may('products')?'<button class="btn" data-view="create">+ New product</button>':''}</div>`);$('productSearch').addEventListener('input',()=>listProducts($('productSearch').value));$('productCategoryFilter').addEventListener('change',()=>listProducts($('productSearch').value));listProducts('')}
function listProducts(v){const q=String(v).trim().toLowerCase(),filter=$('productCategoryFilter')?.value||'',list=state.products.filter(p=>(!filter||p.category===filter)&&(p.name.toLowerCase().includes(q)||p.id.toLowerCase().includes(q))).slice(0,60);
 $('productResults').innerHTML=list.map(p=>`<div class="item"><span class="product-symbol">${esc(p.icon||iconForProduct(p.name))}</span><div style="min-width:0"><strong>${esc(p.name)}</strong><div class="desc">${esc(p.id)} · ${esc(p.category||'Uncategorized')} · ${p.stock} left · ${p.expiry?'Expiry '+p.expiry:'No expiry date'}</div></div><div class="right"><strong class="price">${money(p.price)}</strong><div style="margin-top:6px"><button class="rightlink" data-product="${esc(p.id)}">Manage →</button></div></div></div>`).join('')||'<div class="muted">No matching products.</div>';document.querySelectorAll('[data-product]').forEach(b=>b.onclick=()=>manageProduct(b.dataset.product))}
function manageProduct(id){state.selected=id;const p=getProduct(id);page(esc(p.name),'Existing product · '+esc(p.id),`<div class="card"><div class="grid3"><div class="mini-stat"><div class="lbl">Stock left</div><div class="number">${p.stock}</div></div><div class="mini-stat"><div class="lbl">Sell price</div><div class="number" style="font-size:17px">${money(p.price)}</div></div><div class="mini-stat"><div class="lbl">Expiry</div><div class="number" style="font-size:13px">${esc(p.expiry||'Not set')}</div></div></div></div>
 <div class="grid"><button class="tile" id="manageSell"><span class="emoji">▤</span><strong>Add to Sale</strong><span>Put item in cart</span></button>${may('stock')?'<button class="tile" id="manageRestock"><span class="emoji">▥</span><strong>Add Stock</strong><span>Price, quantity and expiry</span></button>':''}${may('products')?'<button class="tile" id="manageEdit"><span class="emoji">✎</span><strong>Edit Product</strong><span>Modify item details</span></button><button class="tile" id="manageLink"><span class="emoji">▣</span><strong>Link Barcode</strong><span>Attach scanned code</span></button>':''}</div>`);
 $('manageSell').onclick=()=>addCartProduct(id);if($('manageRestock'))$('manageRestock').onclick=()=>setView('restock',id);if($('manageEdit'))$('manageEdit').onclick=()=>setView('edit',id);if($('manageLink'))$('manageLink').onclick=()=>promptBarcodeLink(id)}

/* v11.6 live scanner bridge: scanner must be served from a separate, TOP-LEVEL HTTPS site.
   Apps Script's sandboxed iframe can block getUserMedia on Safari iOS.
   Barcode transfer uses a short-lived nonce + origin check. No Google session token is sent. */
let kvScannerPending=null;
function kvScannerSite(){
 const configured=String(window.KV_LIVE_SCANNER_URL||'').trim();
 try{const u=new URL(configured);return u.protocol==='https:'&&u.hostname&&!/YOURNAME|YOUR_USERNAME|example\.com/i.test(configured)?u:null}catch(e){return null}
}
function kvLiveScan(mode){
 if(!['lookup','edit','create','sale'].includes(mode))mode='lookup';
 const context={mode,productId:mode==='edit'?String(state.selected||''):''};
 if(typeof window.kvOpenCameraModal!=='function'){
  toast('The live camera popup did not load. Please refresh the Owner website.',true);return;
 }
 window.kvOpenCameraModal({mode,onScan:barcode=>kvAcceptLiveBarcode(barcode,context)});
}

window.addEventListener('message',function(event){
 const u=kvScannerSite(),req=kvScannerPending;
 if(!u||!req||event.origin!==u.origin||Date.now()>req.expiry)return;
 const v=event.data;
 if(!v||v.source!=='kv-live-scanner-v1'||v.nonce!==req.nonce)return;
 const barcode=String(v.barcode||'').trim();
 if(!/^\d{6,20}$/.test(barcode)){toast('Invalid barcode from scanner. Expected 6–20 digits.',true);return}
 kvScannerPending=null;
 kvAcceptLiveBarcode(barcode,req);
});
function kvAcceptLiveBarcode(barcode,req){
 toast('Scanned: '+barcode);
 if(req.mode==='edit'){
  if(state.screen!=='edit'||state.selected!==req.productId){state.selected=req.productId;setView('edit',req.productId)}
  const f=$('pBarcodeLink');if(f){f.value=barcode;kvCheckEditBarcode(barcode);f.focus();}
  return;
 }
 if(req.mode==='create'){
  if(state.screen!=='create')setView('create');
  if($('pBarcode')){$('pBarcode').value=barcode;$('pBarcode').focus()}
  return;
 }
 if(req.mode==='sale'){
  const p=state.products.find(x=>(x.barcodes||[]).includes(barcode));
  if(p){addCartProduct(p.id);return}
  toast('Barcode '+barcode+' has no linked product yet. Open Products > Edit to link it.',true);
  return;
 }
 if(state.screen!=='scan')setView('scan');
 const field=$('manualBarcode');if(field)field.value=barcode;
 handleBarcode(barcode);
}
async function kvCheckEditBarcode(code){
 const status=$('kvEditBarcodeStatus');if(!status)return;
 const b=String(code||'').trim();
 if(!/^\d{6,20}$/.test(b)){status.textContent='Enter 6–20 barcode digits.';return}
 status.textContent='Checking whether this barcode is assigned…';
 try{
  const r=await call('barcode',{barcode:b});
  if(!$('kvEditBarcodeStatus')||$('pBarcodeLink')?.value.trim()!==b)return;
  status.textContent=r.linked&&r.product?(r.product.id===state.selected?'Already linked to this product.':'Already linked to '+r.product.name+' ('+r.product.id+'). Choose another barcode.'):'Not linked yet. Tap “Link barcode to this product” to save.';
 }catch(e){status.textContent='Could not check barcode: '+String(e.message||e)}
}
async function kvLinkEditBarcode(){
 const code=String($('pBarcodeLink')?.value||'').trim(),id=String(state.selected||'');
 if(!/^\d{6,20}$/.test(code)){toast('Barcode must contain 6–20 digits.',true);return}
 if(!id){toast('Select a product first.',true);return}
 try{
  await work(async()=>{
   const result=await call('linkBarcode',{requestId:uid(),barcode:code,productId:id});
   toast(result.alreadyLinked?'Barcode already linked to this product.':'Barcode saved to this product.');
   await refreshProducts();
   if(state.screen==='edit'){
    const p=getProduct(id),list=$('kvExistingBarcodes');
    if(list&&p)list.textContent='Linked: '+((p.barcodes||[]).join(', ')||'None');
    if($('kvEditBarcodeStatus'))$('kvEditBarcodeStatus').textContent='Saved. This barcode now belongs to '+(p?.name||id)+'.';
   }
  });
 }catch(e){if($('kvEditBarcodeStatus'))$('kvEditBarcodeStatus').textContent=String(e.message||e)}
}

function promptBarcodeLink(id,code){
 state.selected=id;setView('edit',id);
 if(code&&$('pBarcodeLink')){$('pBarcodeLink').value=String(code);kvCheckEditBarcode(code)}
 else if($('pBarcodeLink')){$('pBarcodeLink').focus()}
}
function categoryIcon(name){return (state.base?.categoryOptions||[]).find(c=>c.name===name)?.icon||'🏠'}
function productCategoryOptions(chosen,includeAll){return (includeAll?'<option value="">All categories</option>':'<option value="" disabled '+(!chosen?'selected':'')+'>Select category…</option>')+(state.base?.categoryOptions||[]).map(c=>`<option value="${esc(c.name)}" ${c.name===chosen?'selected':''}>${esc(c.icon)} ${esc(c.name)}</option>`).join('')}
function productIconOptions(chosen){return (state.base?.categoryOptions||[]).map(c=>`<option value="${esc(c.icon)}" ${c.icon===chosen?'selected':''}>${esc(c.icon)} ${esc(c.name)}</option>`).join('')}
function basicProductForm(x,creating){return `<form id="productForm">${textField('pName','Product name',x?.name||'', 'required')}
 <div class="fieldgrid">${creating?`<div class="field"><label>Initial quantity</label><input id="pQuantity" type="number" min="0" step="1" value="0" required></div>`:''}${dateField('pDate','Date bought',creating?iso():(x?.date||iso()))}</div>${creating?moneyField('pTotal','Total purchase cost (₱) — optional','',false):''}
 <div class="fieldgrid">${moneyField('pCost','Purchase cost/unit (₱)',x?.cost??'',true)}${moneyField('pPrice','Selling price/unit (₱)',x?.price??'',true)}</div>
 <div id="pProfit" class="banner green">Profit per unit will appear here.</div>
 ${textField('pSupplier','Supplier',x?.supplier||'')}<div class="fieldgrid"><div class="field"><label>Category (choose one)</label><select id="pCategory" required>${productCategoryOptions(x?.category||'',false)}</select></div><div class="field"><label>Product Icon</label><select id="pIcon">${productIconOptions(x?.icon||categoryIcon(x?.category))}</select></div></div>${textField('pPhoto','Private product photo URL',x?.photoUrl||'')}${dateField('pExpiry','Expiration date (optional)',x?.expiry||'')}
 <div class="banner">Expiration date may be left blank. You can edit it later.</div>
 <div class="fieldgrid">${textField('pRed','Replenish at (red)',x?.red??'', 'type="number" min="0"')}${textField('pOrange','Almost out (orange)',x?.orange??'', 'type="number" min="0"')}${textField('pGreen','Good stock at (green)',x?.green??'', 'type="number" min="0"')}</div>
 ${creating?`<div class="kv-editbarcode-actions">${textField('pBarcode','Barcode (optional)','', 'inputmode="numeric" pattern="[0-9]{6,20}"')}<button class="btn outline" id="kvCreateBarcodeScan" type="button">📷 Scan live barcode</button></div>`:`<section class="kv-editbarcode-box"><strong>Barcode for this product</strong><p class="tiny" id="kvExistingBarcodes">Linked: ${esc((x?.barcodes||[]).join(', ')||'None')}</p><label for="pBarcodeLink">Type barcode or scan with camera</label><input id="pBarcodeLink" type="text" inputmode="numeric" pattern="[0-9]{6,20}" autocomplete="off" placeholder="6–20 digits"><div class="kv-editbarcode-actions"><button class="btn outline" id="kvEditBarcodeScan" type="button">📷 Open live scanner</button><button class="btn" id="kvEditBarcodeSave" type="button">Link barcode to this product</button></div><p class="tiny" id="kvEditBarcodeStatus">A barcode already linked to another product cannot be reassigned silently.</p></section>`}${textField('pNotes','Notes',x?.notes||'')}
 ${creating?'':`<div class="field"><label>Active</label><select id="pActive"><option value="yes" ${x.active?'selected':''}>Active</option><option value="no" ${!x.active?'selected':''}>Inactive</option></select></div>`}
 <button class="btn block" type="submit">${creating?'Create Product':'Save Product Changes'} →</button></form>`}

/* Searchable product chooser for Add Stock and Edit Product.
   Product ID is only set after selecting a suggestion, preventing mismatched updates. */
function kvBindProductSearch(searchId,hiddenId,suggestId,onPick){
 const input=$(searchId),hidden=$(hiddenId),box=$(suggestId);if(!input||!hidden||!box)return;
 let matches=[];
 const hide=()=>{box.innerHTML='';box.classList.remove('open')};
 const choose=p=>{hidden.value=p.id;input.value=p.name;hide();if(onPick)onPick(p)};
 const draw=()=>{
  const q=String(input.value||'').trim().toLocaleLowerCase();
  matches=(state.products||[]).filter(p=>p&&p.id&&(!q||[p.name,p.id,p.category].some(v=>String(v||'').toLocaleLowerCase().includes(q)))).sort((a,b)=>a.name.localeCompare(b.name)).slice(0,9);
  box.innerHTML=matches.length?matches.map(p=>`<button type="button" class="kv-product-option" role="option" data-pick="${esc(p.id)}"><span class="kv-product-option-icon">${esc(kvCategoryIconSafe(p.category,p.icon))}</span><span class="kv-product-option-text"><strong>${esc(p.name)}</strong><small>${esc(p.id)} · ${esc(p.category||'No category')}</small></span><span class="kv-product-stock-pill">${Math.max(0,Number(p.stock)||0)} in stock</span></button>`).join(''):'<div class="kv-no-suggestion">No matching product found</div>';
  box.classList.add('open');
  box.querySelectorAll('[data-pick]').forEach(b=>{b.addEventListener('pointerdown',e=>e.preventDefault());b.onclick=()=>{const p=state.products.find(x=>x.id===b.dataset.pick);if(p)choose(p)}});
 };
 input.addEventListener('focus',draw);
 input.addEventListener('input',()=>{hidden.value='';if(onPick)onPick(null);draw()});
 input.addEventListener('keydown',e=>{if(e.key==='Escape'){hide();return}if(e.key==='Enter'&&box.classList.contains('open')&&matches[0]){e.preventDefault();choose(matches[0])}});
 input.addEventListener('blur',()=>setTimeout(hide,150));
}
function editFinder(){
 if(!may('products')){page('Find & edit product','',`<div class="banner red">Your account cannot edit products.</div>`);return}
 const current=getProduct(state.selected);
 page('Find & edit product','Type a name, product ID, or category to choose a product. No need to scroll through a dropdown.',`<section class="card kv-finder-card"><div class="field kv-product-search-wrap"><label for="kvEditSearch">Search your products</label><input id="kvEditSearch" placeholder="E.g. Piattos, PRD-00011…" autocomplete="off" value="${esc(current?.name||'')}"><input id="kvEditSelected" type="hidden" value="${esc(current?.id||'')}"><div id="kvEditSuggestions" class="kv-suggestion-list" role="listbox"></div></div><div id="kvFinderDetails" class="kv-finder-details"></div><button id="kvEditOpen" class="btn block" type="button" ${current?'':'disabled'}>Edit selected product →</button></section>`);
 const paint=()=>{const x=getProduct($('kvEditSelected').value),root=$('kvFinderDetails');if(!root)return;
  root.innerHTML=x?`<div class="kv-found-product"><span class="kv-product-option-icon">${esc(kvCategoryIconSafe(x.category,x.icon))}</span><div><strong>${esc(x.name)}</strong><div class="tiny">${esc(x.id)} · ${esc(x.category||'No category')}</div><div class="tiny">${Math.max(0,Number(x.stock)||0)} stock · ${money(x.price)} · ${x.expiry?'Expires '+esc(x.expiry):'No expiry date'}</div></div></div>`:'<div class="kv-finder-empty">Search and select the correct product before editing.</div>';
  $('kvEditOpen').disabled=!x;
 };
 kvBindProductSearch('kvEditSearch','kvEditSelected','kvEditSuggestions',paint);
 $('kvEditOpen').onclick=()=>{const id=$('kvEditSelected').value;if(!id)return toast('Select a suggested product first.',true);setView('edit',id)};
 paint();
}
function createProduct(){page('Create product','Register and optionally link a barcode.',`<div class="card">${basicProductForm(null,true)}</div>`);bindProductForm(true)}
function editProduct(){const p=getProduct(state.selected);if(!p)return products();page('Edit product',esc(p.name)+' · '+esc(p.id),`<div class="card">${basicProductForm(p,false)}</div>`);bindProductForm(false)}
function bindProductForm(creating){
 if(creating){if($('kvCreateBarcodeScan'))$('kvCreateBarcodeScan').onclick=()=>kvLiveScan('create')}
 else{
  if($('kvEditBarcodeScan'))$('kvEditBarcodeScan').onclick=()=>kvLiveScan('edit');
  if($('kvEditBarcodeSave'))$('kvEditBarcodeSave').onclick=kvLinkEditBarcode;
  if($('pBarcodeLink'))$('pBarcodeLink').addEventListener('change',e=>kvCheckEditBarcode(e.target.value));
 }
 $('pCategory').addEventListener('change',()=>{$('pIcon').value=categoryIcon($('pCategory').value)});const update=()=>{$('pProfit').textContent='Potential profit per unit: '+money(Number($('pPrice').value||0)-Number($('pCost').value||0))};['pPrice','pCost'].forEach(id=>$(id).addEventListener('input',update));if(creating){$('pTotal').addEventListener('change',()=>{const q=Number($('pQuantity').value||0);if(q>0&&$('pTotal').value!==''){$('pCost').value=(Number($('pTotal').value)/q).toFixed(2);update()}});$('pCost').addEventListener('change',()=>{$('pTotal').value=(Number($('pCost').value||0)*Number($('pQuantity').value||0)).toFixed(2)});$('pQuantity').addEventListener('change',()=>{$('pTotal').value=(Number($('pCost').value||0)*Number($('pQuantity').value||0)).toFixed(2)})}update();$('productForm').onsubmit=async e=>{e.preventDefault();
 const base={requestId:uid(),name:$('pName').value,unitCost:$('pCost').value,price:$('pPrice').value,supplier:$('pSupplier').value,category:$('pCategory')?.value||'',icon:$('pIcon')?.value||'',privatePhotoUrl:$('pPhoto')?.value||'',expiry:$('pExpiry').value,red:$('pRed').value,orange:$('pOrange').value,green:$('pGreen').value,notes:$('pNotes').value,date:$('pDate').value};
 if(creating){base.quantity=$('pQuantity').value;base.barcode=$('pBarcode').value}else{base.productId=state.selected;base.cost=base.unitCost;base.active=$('pActive').value==='yes';delete base.unitCost}
 await work(async()=>{const r=await call(creating?'createProduct':'editProduct',base);toast(creating?'Created '+r.productId:'Product updated');await refreshProducts();manageProduct(r.productId)})}}
function restock(){const current=getProduct(state.selected);page('Add stock','Receive inventory with updated costs and expiry.',`<div class="card"><div class="field kv-product-search-wrap"><label for="restockProductSearch">Find a product to restock</label><input id="restockProductSearch" autocomplete="off" placeholder="Type name, ID, or category…" value="${esc(current?.name||'')}"><input type="hidden" id="restockProduct" value="${esc(current?.id||'')}"><div id="restockProductSuggestions" class="kv-suggestion-list" role="listbox"></div><p class="tiny">Choose a suggested product so its stock and prices fill automatically.</p></div>
 <div id="restockStats" class="banner green">Choose a product</div><form id="restockForm">
 <div class="fieldgrid"><div class="field"><label>Quantity received</label><input id="rsQty" type="number" step="1" min="1" value="1" required></div>${dateField('rsDate','Date received',iso())}</div>
 <div class="fieldgrid">${moneyField('rsCost','New purchase cost / unit (₱)','',true)}${moneyField('rsPrice','Your new selling price (₱)','',true)}</div>
 <div id="rsCalc" class="banner green">Purchase and profit calculations appear here.</div>
 ${textField('rsSupplier','Supplier (optional)','')}${dateField('rsExpiry','Expiration date (optional)','')}
 <div class="banner">A new delivery keeps its own purchase cost and expiration date. Leave expiration blank if unknown.</div><button class="btn block" type="submit">Confirm Stock Delivery →</button></form></div>`);
 kvBindProductSearch('restockProductSearch','restockProduct','restockProductSuggestions',updateRestock);['rsCost','rsQty','rsPrice'].forEach(id=>$(id).addEventListener('input',calcRestock));$('restockForm').onsubmit=async e=>{e.preventDefault();const productId=$('restockProduct').value;if(!productId){toast('Select a product',true);return}
 const payload={requestId:uid(),productId,quantity:$('rsQty').value,unitCost:$('rsCost').value,price:$('rsPrice').value,expiry:$('rsExpiry').value,date:$('rsDate').value,supplier:$('rsSupplier').value};
 if(!confirm('Add '+payload.quantity+' units and update the cost and selling price?'))return;
 await work(async()=>{const r=await call('restock',payload);toast('Restocked! '+r.stock+' units · '+money(r.unitProfit)+' profit/unit');await refreshProducts();manageProduct(productId)})};updateRestock()}
function updateRestock(){const p=getProduct($('restockProduct').value);$('restockStats').textContent=p?`${p.name} · Current stock: ${p.stock} · Current cost: ${p.cost===undefined?'Private':money(p.cost)} · Sell: ${money(p.price)}`:'Choose a product';if(p){$('rsCost').value=p.cost??'';$('rsPrice').value=p.price??'';$('rsSupplier').value=p.supplier||''}calcRestock()}
function calcRestock(){const q=Number($('rsQty').value||0),c=Number($('rsCost').value||0),s=Number($('rsPrice').value||0);$('rsCalc').textContent='Purchase total '+money(q*c)+' · New-stock profit/unit '+money(s-c)+' · Potential profit '+money(q*(s-c))}
function scanPage(){page('Scan barcode','Scan a product barcode using your camera, a photo, or its digits.',`<div class="cameraBox"><div id="scanner" aria-live="polite">For iPhone and Android, live scanning opens in a separate HTTPS tab to avoid the Apps Script camera restriction.</div></div><div class="scanner-actions"><button class="btn" id="kvExternalScan" type="button">📷 Open live camera scanner</button><button class="btn outline" id="startScan" type="button">Try camera here</button><button class="btn outline" id="stopScan" type="button">Stop</button></div>
<div class="card" style="margin-top:12px"><div class="field"><label for="cameraChoice">Choose camera (if available)</label><select id="cameraChoice"><option value="">Rear camera (automatic)</option></select></div><p class="tiny" id="cameraHelp">On iPhone: allow Safari camera permission. If the live camera cannot open inside Google Apps Script, use the photo scanner below.</p><label for="scanPhoto" class="btn light block" style="cursor:pointer">📸 Scan a photo of a barcode</label><input id="scanPhoto" type="file" accept="image/*" capture="environment"><div class="sep"></div>
${textField('manualBarcode','Or enter barcode digits','','inputmode="numeric"')}<button class="btn block" id="manualFind">Find Product</button></div><div id="scanResult"></div>`);
$('kvExternalScan').onclick=()=>kvLiveScan('lookup');$('startScan').onclick=startScan;$('stopScan').onclick=stopScan;$('manualFind').onclick=()=>handleBarcode($('manualBarcode').value);
$('scanPhoto').addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;await stopScan();let reader;
 try{await kvLoadCameraLibrary();if(typeof Html5Qrcode==='undefined')throw Error('Scanner library did not load; please check internet access.');reader=new Html5Qrcode('scanner',{verbose:false});const code=await reader.scanFile(file,true);await handleBarcode(code)}catch(err){toast('Photo scan failed: '+String(err.message||err)+'. Try better lighting or manual digits.',true)}finally{if(reader)try{await reader.clear()}catch(e){}e.target.value=''} });
kvLoadCameraLibrary().then(()=>kvPopulateCameras()).catch(()=>{});
}
let kvLoadingCameraLibrary=null;
function kvLoadCameraLibrary(){
 if(typeof Html5Qrcode!=='undefined')return Promise.resolve();
 if(kvLoadingCameraLibrary)return kvLoadingCameraLibrary;
 kvLoadingCameraLibrary=new Promise((resolve,reject)=>{
  const script=document.createElement('script');script.src='https://cdnjs.cloudflare.com/ajax/libs/html5-qrcode/2.3.8/html5-qrcode.min.js';script.async=true;script.onload=()=>typeof Html5Qrcode!=='undefined'?resolve():reject(Error('Camera scanning library did not initialize'));script.onerror=()=>reject(Error('Cannot load barcode library on this network'));document.head.appendChild(script);
 }).catch(e=>{kvLoadingCameraLibrary=null;throw e});return kvLoadingCameraLibrary;
}
async function kvPopulateCameras(){try{if(typeof Html5Qrcode==='undefined')return;const cameras=await Html5Qrcode.getCameras();const pick=$('cameraChoice');if(!pick)return;for(const cam of cameras){const option=document.createElement('option');option.value=cam.id;option.textContent=cam.label||'Camera '+(pick.options.length);pick.appendChild(option)}}catch(e){/* camera permission can require a user gesture */}}
async function startScan(){
 if(state.scanner)return;
 if(!window.isSecureContext){toast('Camera needs HTTPS. Open the deployed https:// Apps Script URL.',true);return}
 const help=$('cameraHelp');if(help)help.textContent='Requesting camera permission…';
 let scanner;
 try{
  await kvLoadCameraLibrary();
  scanner=new Html5Qrcode('scanner',{verbose:false});state.scanner=scanner;
  const chosen=$('cameraChoice')?.value;
  const conf={fps:10,aspectRatio:1.777,qrbox:(w,h)=>{const width=Math.max(120,Math.min(w-16,Math.round(w*0.85),300));return {width,height:Math.max(75,Math.min(h-16,Math.round(width*0.54),165))}},formatsToSupport:undefined,disableFlip:false};
  const callback=code=>{const now=Date.now();if(code===state.lastScan&&now-state.lastScanAt<2500)return;state.lastScan=code;state.lastScanAt=now;try{navigator.vibrate?.(70)}catch(e){}handleBarcode(code)};
  try{await scanner.start(chosen||{facingMode:'environment'},conf,callback,()=>{})}
  catch(firstError){
   if(chosen)throw firstError;
   const cams=await Html5Qrcode.getCameras().catch(()=>[]);
   if(!cams.length)throw firstError;
   const back=cams.find(c=>/back|rear|environment|trás|arrière/i.test(c.label||''))||cams[cams.length-1];
   await scanner.start(back.id,conf,callback,()=>{});
  }
  if(help)help.textContent='Camera is on. Point it steadily at the full barcode.';
 }catch(e){state.scanner=null;try{if(scanner){await scanner.stop().catch(()=>{});await scanner.clear().catch(()=>{})}}catch(_){}
  const msg=String(e?.message||e||'Camera not available');
  if(help)help.textContent='Camera unavailable: '+msg+' · Use Scan a photo or enter barcode digits.';
  toast('Could not open camera: '+msg+'. Try your phone browser, check camera permission, or take a barcode photo.',true);
 }
}
async function stopScan(){if(!state.scanner)return;const s=state.scanner;state.scanner=null;try{await s.stop()}catch(e){}try{await s.clear()}catch(e){}}
async function handleBarcode(code){const barcode=String(code||'').trim();if(!barcode)return;await work(async()=>{const r=await call('barcode',{barcode});stopScan();if(r.linked&&r.product){const x=r.product;state.selected=x.id;$('scanResult').innerHTML=`<div class="card" style="margin-top:13px"><div class="pill">Barcode found</div><h3>${esc(x.name)}</h3><p>${money(x.price)} · ${x.stock} left</p><div class="grid"><button class="btn" id="scanSell">Add to Sale</button>${may('stock')?'<button class="btn outline" id="scanStock">Add Stock</button>':''}${may('products')?'<button class="btn outline" id="scanEdit">Edit Product</button>':''}</div></div>`;
 $('scanSell').onclick=()=>addCartProduct(x.id);if($('scanStock'))$('scanStock').onclick=()=>setView('restock',x.id);if($('scanEdit'))$('scanEdit').onclick=()=>setView('edit',x.id);
 }else{$('scanResult').innerHTML=`<div class="card" style="margin-top:13px"><strong>New barcode: ${esc(barcode)}</strong><p class="muted">Not linked to a product yet.</p>${may('products')?`<select id="linkChoice">${productOptions()}</select><button class="btn block" id="linkNow" style="margin-top:9px">Link to Existing Product</button><button class="btn block outline" id="createScanned" style="margin-top:9px">Create New Product</button>`:'<div class="banner">Ask an owner to link this barcode.</div>'}</div>`;
 if($('linkNow'))$('linkNow').onclick=()=>{const id=$('linkChoice').value;if(id)promptBarcodeLink(id,barcode)};if($('createScanned'))$('createScanned').onclick=()=>{setView('create');if($('pBarcode'))$('pBarcode').value=barcode};}
 })}
function utang(){page('Utang & payments','Customer balances, partial payments and purchase history.',`<div class="card"><div class="utang-controls"><input id="utangSearch" placeholder="Search customer or transaction"><select id="utangSort" aria-label="Sort Utang customer list"><option value="name_asc">Customer name A–Z</option><option value="name_desc">Customer name Z–A</option><option value="balance_desc">Highest unpaid balance</option><option value="balance_asc">Lowest unpaid balance</option><option value="unpaid_first">Unpaid first</option></select></div><div id="utangResults" class="list" style="margin-top:12px"><div class="muted">Loading balances…</div></div></div>`);
 $('utangSearch').oninput=()=>loadUtang();$('utangSort').onchange=()=>loadUtang();loadUtang()}
let creditDelay;
function loadUtang(){clearTimeout(creditDelay);creditDelay=setTimeout(async()=>{try{const list=await call('utang',{search:$('utangSearch')?.value||''});const target=$('utangResults');if(!target)return;
 const mode=$('utangSort')?.value||'name_asc';const byName=(a,b)=>String(a.customer).localeCompare(String(b.customer));list.sort(mode==='name_desc'?(a,b)=>-byName(a,b):mode==='balance_desc'?(a,b)=>b.remaining-a.remaining||byName(a,b):mode==='balance_asc'?(a,b)=>a.remaining-b.remaining||byName(a,b):mode==='unpaid_first'?(a,b)=>Number(a.remaining===0)-Number(b.remaining===0)||byName(a,b):byName);
 target.innerHTML=list.length?list.map(r=>`<div class="item"><div style="min-width:0"><strong>${esc(r.customer)}</strong><div class="desc">${esc(r.product)} · ${esc(r.transactionId)}</div><span class="pill ${r.status==='Paid'?'':'warn'}">${esc(r.status)}</span></div><div class="right"><div class="price">${money(r.remaining)}</div><div class="tiny">Owed ${money(r.amount)}</div>${may('payments')&&r.remaining>0?`<button class="rightlink" data-pay="${esc(r.key)}:${r.remaining}">Accept payment</button>`:''}</div></div>`).join(''):'<p class="muted">No Utang records found.</p>';
 document.querySelectorAll('[data-pay]').forEach(b=>b.onclick=()=>openPayment(b.dataset.pay));}catch(e){toast(e.message,true)}},180)}
function openPayment(v){const idx=v.lastIndexOf(':'),key=v.slice(0,idx),left=Number(v.slice(idx+1));page('Pay Utang',`Sale line ${esc(key)} · Remaining ${money(left)}`,`<div class="card"><form id="payForm">${moneyField('payAmount','Payment amount (₱)',left,true)}${sel('payMethod','Payment method',['Cash','GCash','Bank Transfer','Card','Other'],'Cash')}${textField('payNotes','Payment notes','')}<button class="btn block" type="submit">Record Payment</button></form></div>`);
 $('payForm').onsubmit=async e=>{e.preventDefault();const p={requestId:uid(),key,amount:$('payAmount').value,method:$('payMethod').value,notes:$('payNotes').value};if(!confirm('Record '+money(p.amount)+' toward this Utang?'))return;
 await work(async()=>{const r=await call('payCredit',p);toast('Payment saved · Remaining '+money(r.remaining));setView('utang')})}}
function expenses(){
 const cats=state.base?.expenseCategories||[];
 const treat=state.base?.expenseTreatments||[];
 const pm=(state.base?.payments||[]).filter(x=>x!=='Utang');
 $('content').innerHTML=`<div class="kv-expenses-shell"><section class="kv-expense-header"><div><h2>Record Expense</h2><p>Kuya Vince Store · Keep store spending separate from product sales</p></div><span class="kv-expense-symbol">${kvActionIcon('expenses')}</span></section>
 <div class="kv-expenses-layout"><section class="kv-expense-card"><form id="expenseForm">
  <div class="kv-expense-grid">${dateField('expenseDate','Expense date',iso())}${moneyField('expenseAmount','Amount (₱)','',true)}</div>
  ${textField('expenseName','What was the expense?','', 'required placeholder="e.g. Electricity bill, delivery fee" maxlength="180"')}
  <div class="kv-expense-grid">${sel('expenseCat','Expense category',cats,'Delivery Fees')}${sel('expenseMethod','Payment method',pm,'Cash')}</div>
  ${sel('expenseTreatment','Accounting treatment',treat,'Operating Expense')}
  <div class="kv-expense-grid">${textField('expenseSupplier','Paid to / supplier','', 'placeholder="Optional"')}${textField('expenseNotes','Notes','', 'placeholder="Optional"')}</div>
  <div class="kv-expense-helper">Inventory purchases and equipment purchases have their own accounting treatments. Only <b>Operating Expense</b> is subtracted as a normal operating cost in profit reports.</div>
  <div class="kv-expense-buttons"><button type="button" id="kvCancelExpense" class="kv-expense-cancel">Cancel</button><button type="submit" class="kv-expense-save" id="kvSaveExpense">Save Expense →</button></div>
 </form></section><section class="kv-expense-card kv-expense-recent"><div class="kv-expense-recent-title">Recent expenses <button type="button" id="kvRefreshExpenses">Refresh</button></div><div id="expenseList" class="list"><div class="muted">Loading recent entries…</div></div></section></div></div>`;
 navHighlight();
 $('kvCancelExpense').onclick=()=>{if(confirm('Discard this unsaved expense? No expense will be recorded.'))setView('home')};
 $('kvRefreshExpenses').onclick=loadExpenses;
 $('expenseForm').onsubmit=async e=>{
  e.preventDefault();const amount=Number($('expenseAmount').value),name=$('expenseName').value.trim();
  if(!name||!Number.isFinite(amount)||amount<=0){toast('Enter an expense description and an amount above zero.',true);return}
  const data={requestId:uid(),date:$('expenseDate').value,name,amount:amount.toFixed(2),category:$('expenseCat').value,treatment:$('expenseTreatment').value,payment:$('expenseMethod').value,supplier:$('expenseSupplier').value.trim(),notes:$('expenseNotes').value.trim()};
  if(!confirm('Record '+money(amount)+' for '+name+' as '+data.treatment+'?'))return;
  const btn=$('kvSaveExpense');btn.disabled=true;
  try{await work(async()=>{const r=await call('addExpense',data);toast('Expense '+r.expenseId+' saved to Google Sheets');expenses()})}
  catch(error){if($('kvSaveExpense'))$('kvSaveExpense').disabled=false}
 };
 loadExpenses();
}
async function loadExpenses(){try{const rows=await call('expenses');if(!$('expenseList'))return;$('expenseList').innerHTML=rows.slice(0,20).map(r=>`<div class="item"><div><strong>${esc(r.name)}</strong><div class="desc">${esc(r.date)} · ${esc(r.category)} · ${esc(r.treatment)}</div></div><strong class="price">${money(r.amount)}</strong></div>`).join('')||'<div class="muted">No expenses recorded.</div>'}catch(e){toast(e.message,true)}}
function chartRows(rows,key,value,currency){if(!rows?.length)return '<div class="muted">Not enough activity for a graph yet.</div>';const max=Math.max(1,...rows.map(r=>Number(r[value]||0)));
 return rows.slice(0,12).map(r=>`<div class="barline"><span class="barlabel" title="${esc(r[key])}">${esc(r[key])}</span><div class="bartrack"><div class="barfill" style="width:${Math.max(1,Number(r[value]||0)/max*100)}%"></div></div><span class="barvalue">${currency?money(r[value]):Number(r[value]||0).toFixed(1)}</span></div>`).join('')}
/* v11.5 read-only Owner Expenses Dashboard — preserves original expense entry and POS logic. */
let kvExpenseRows=[],kvExpenseShown=[],kvExpensePage=0;
const kvExpPiso=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
function kvExpensePreset(kind){
 const now=new Date(),d=new Date(now.getFullYear(),now.getMonth(),now.getDate());
 let a='',z=kvExpPiso(d);
 if(kind==='today')a=z;
 else if(kind==='week'){const start=new Date(d);start.setDate(start.getDate()-6);a=kvExpPiso(start)}
 else if(kind==='month')a=kvExpPiso(new Date(d.getFullYear(),d.getMonth(),1));
 else if(kind==='year')a=kvExpPiso(new Date(d.getFullYear(),0,1));
 else if(kind==='all'){a='';z=''}
 else return;
 $('kvExpFrom').value=a;$('kvExpTo').value=z;kvExpensePage=0;kvRenderExpenseReport();
 document.querySelectorAll('.kv-exp-preset').forEach(b=>b.classList.toggle('active',b.dataset.preset===kind));
}
function expenseDashboard(){
 if(!may('expenses')){toast('Expenses permission required.',true);setView('more');return;}
 page('Expenses Dashboard','Analyze and sort all recorded spending. Figures come from Other Expenses Tracker.',
 `<div class="kv-expdash">
 <div class="kv-expdash-hero"><div><span class="kv-expdash-overline">KUYA VINCE STORE · FINANCE</span><h2>Where does the money go?</h2><p>Filter by date, payment, category, or treatment — no changes to recorded expenses.</p></div><button type="button" class="kv-expdash-add" id="kvExpenseNew">+ Record expense</button></div>
 <div class="kv-expdash-card">
  <div class="kv-expdash-presets">${[['today','Today'],['week','Last 7 days'],['month','This month'],['year','This year'],['all','All dates']].map(([k,v])=>`<button class="kv-exp-preset" type="button" data-preset="${k}">${v}</button>`).join('')}</div>
  <div class="kv-expdash-filters">
   <div><label for="kvExpFrom">From</label><input id="kvExpFrom" type="date"></div>
   <div><label for="kvExpTo">To</label><input id="kvExpTo" type="date"></div>
   <div><label for="kvExpCategory">Category</label><select id="kvExpCategory"><option value="">All categories</option>${(state.base?.expenseCategories||[]).map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('')}</select></div>
   <div><label for="kvExpPayment">Payment</label><select id="kvExpPayment"><option value="">All payments</option>${(state.base?.payments||[]).filter(x=>x!=='Utang').map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('')}</select></div>
   <div><label for="kvExpTreatment">Treatment</label><select id="kvExpTreatment"><option value="">All types</option>${(state.base?.expenseTreatments||[]).map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('')}</select></div>
   <div><label for="kvExpOrder">Sort by</label><select id="kvExpOrder"><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="highest">Highest amount</option><option value="lowest">Lowest amount</option><option value="category">Category A–Z</option></select></div>
  </div>
  <div class="kv-expdash-searchrow"><input id="kvExpSearch" type="search" placeholder="Search expense, supplier, ID, notes…" aria-label="Search expenses"><button type="button" id="kvExpReset">Reset filters</button><button type="button" id="kvExpRefresh">Refresh data ↻</button></div>
 </div>
 <div id="kvExpDashResults" aria-live="polite"><div class="kv-expdash-loading">Loading expense records…</div></div>
 </div>`);
 $('kvExpenseNew').onclick=()=>setView('expenses');
 document.querySelectorAll('.kv-exp-preset').forEach(b=>b.onclick=()=>kvExpensePreset(b.dataset.preset));
 ['kvExpFrom','kvExpTo','kvExpCategory','kvExpPayment','kvExpTreatment','kvExpOrder'].forEach(id=>$(id).addEventListener('change',()=>{kvExpensePage=0;document.querySelectorAll('.kv-exp-preset').forEach(x=>x.classList.remove('active'));kvRenderExpenseReport()}));
 $('kvExpSearch').oninput=()=>{kvExpensePage=0;kvRenderExpenseReport()};
 $('kvExpReset').onclick=()=>{['kvExpCategory','kvExpPayment','kvExpTreatment','kvExpSearch'].forEach(id=>$(id).value='');$('kvExpOrder').value='newest';kvExpensePreset('month')};
 $('kvExpRefresh').onclick=()=>kvFetchExpenseReport();
 kvExpensePreset('month');kvFetchExpenseReport();
}
async function kvFetchExpenseReport(){
 if(!$('kvExpDashResults'))return;
 $('kvExpDashResults').innerHTML='<div class="kv-expdash-loading">Loading your expense records…</div>';
 try{
  const result=await call('expenses',{all:true});
  if(state.screen!=='expenseDashboard'||!$('kvExpDashResults'))return;
  kvExpenseRows=Array.isArray(result)?result:[];
  kvRenderExpenseReport();
 }catch(e){if($('kvExpDashResults'))$('kvExpDashResults').innerHTML='<div class="kv-expdash-card"><strong>Could not load the expenses report.</strong><p>'+esc(e.message||e)+'</p><button id="kvExpTryAgain" class="kv-expdash-add">Retry</button></div>';if($('kvExpTryAgain'))$('kvExpTryAgain').onclick=kvFetchExpenseReport}
}
function kvRenderExpenseReport(){
 const el=$('kvExpDashResults');if(!el||!Array.isArray(kvExpenseRows))return;
 const from=$('kvExpFrom').value,to=$('kvExpTo').value;
 if(from&&to&&from>to){el.innerHTML='<div class="kv-expdash-card">Start date must not be later than end date.</div>';return}
 const cat=$('kvExpCategory').value,pay=$('kvExpPayment').value,treat=$('kvExpTreatment').value,q=$('kvExpSearch').value.trim().toLowerCase();
 const rows=kvExpenseRows.filter(r=>(!from||r.date>=from)&&(!to||r.date<=to)&&(!cat||r.category===cat)&&(!pay||r.payment===pay)&&(!treat||r.treatment===treat)&&(!q||[r.id,r.name,r.category,r.supplier,r.notes,r.payment].join(' ').toLowerCase().includes(q)));
 const ord=$('kvExpOrder').value;
 rows.sort((a,b)=>ord==='oldest'?a.date.localeCompare(b.date)||a.id.localeCompare(b.id):ord==='highest'?Number(b.amount)-Number(a.amount)||b.date.localeCompare(a.date):ord==='lowest'?Number(a.amount)-Number(b.amount)||b.date.localeCompare(a.date):ord==='category'?a.category.localeCompare(b.category)||b.date.localeCompare(a.date):b.date.localeCompare(a.date)||b.id.localeCompare(a.id));
 kvExpenseShown=rows;
 const sum=items=>Math.round(items.reduce((t,x)=>t+(Number(x.amount)||0),0)*100)/100;
 const grand=sum(rows),operating=sum(rows.filter(r=>r.treatment==='Operating Expense')),inventory=sum(rows.filter(r=>r.treatment==='Inventory Purchase')),investments=sum(rows.filter(r=>r.treatment==='Equipment/Store Investment')),personal=sum(rows.filter(r=>r.treatment==='Personal (Exclude)'));
 const group=field=>{const m=new Map();rows.forEach(r=>{const key=String(r[field]||'Not specified');m.set(key,(m.get(key)||0)+(Number(r.amount)||0))});return [...m].sort((a,b)=>b[1]-a[1])};
 const cats=group('category'),methods=group('payment');
 const barSection=(heading,items,clickable)=>`<div class="kv-expdash-card kv-expdash-break"><h3>${heading}</h3>${items.length?items.slice(0,12).map(([name,value])=>{
  const tag=clickable?'button':'div';const attr=clickable?' type="button" data-exp-cat="'+esc(name)+'"':'';
  return `<${tag}${attr} class="kv-expdash-breakrow"><span class="kv-expdash-breakline"><span>${esc(name)}</span><strong>${money(value)}</strong></span><span class="kv-expdash-track"><span style="width:${Math.max(0,Math.min(100,(value/(items[0][1]||1))*100)).toFixed(2)}%"></span></span></${tag}>`;
 }).join(''):'<p class="muted">No data for these filters.</p>'}</div>`;
 const pageSize=25,maxPages=Math.max(1,Math.ceil(rows.length/pageSize));kvExpensePage=Math.min(kvExpensePage,maxPages-1);
 const visible=rows.slice(kvExpensePage*pageSize,(kvExpensePage+1)*pageSize);
 const detail=visible.map(r=>`<tr><td><strong>${esc(r.date)}</strong><small>${esc(r.id)}</small></td><td><strong>${esc(r.name)}</strong>${r.supplier?'<small>'+esc(r.supplier)+'</small>':''}${r.notes?'<small class="kv-expdash-note">'+esc(r.notes)+'</small>':''}</td><td>${esc(r.category)}</td><td>${esc(r.payment)}</td><td>${esc(r.treatment)}</td><td class="kv-expdash-price">${money(r.amount)}</td></tr>`).join('');
 el.innerHTML=`<div class="kv-expdash-stats"><div><span>All recorded outflows</span><strong>${money(grand)}</strong></div><div><span>Operating expenses</span><strong>${money(operating)}</strong></div><div><span>Inventory purchases</span><strong>${money(inventory)}</strong></div><div><span>Equipment investments</span><strong>${money(investments)}</strong></div><div><span>Entries</span><strong>${rows.length}</strong></div><div><span>Personal / excluded</span><strong>${money(personal)}</strong></div></div>
 <p class="kv-expdash-context">Amounts reflect the selected filters. Inventory purchases and equipment investments are tracked separately from operating expenses.</p>
 <div class="kv-expdash-breakgrid">${barSection('Spending by category',cats,true)}${barSection('By payment method',methods,false)}</div>
 <div class="kv-expdash-card kv-expdash-detail"><div class="kv-expdash-detailhead"><div><h3>Expense details</h3><p>${rows.length?`Showing ${kvExpensePage*pageSize+1}–${Math.min(rows.length,(kvExpensePage+1)*pageSize)} of ${rows.length}`:'No matching expenses'}</p></div><span class="kv-expdash-pill">${rows.length} record${rows.length===1?'':'s'}</span></div>
 <div class="kv-expdash-tablewrap"><table><thead><tr><th>Date / ID</th><th>Expense / supplier / notes</th><th>Category</th><th>Payment</th><th>Treatment</th><th class="kv-expdash-price">Amount</th></tr></thead><tbody>${detail||'<tr><td colspan="6" class="kv-expdash-empty">No expenses match these filters.</td></tr>'}</tbody></table></div>
 <div class="kv-expdash-pager"><button id="kvExpBack" type="button" ${kvExpensePage===0?'disabled':''}>← Previous</button><span>Page ${kvExpensePage+1} of ${maxPages}</span><button id="kvExpNext" type="button" ${kvExpensePage>=maxPages-1?'disabled':''}>Next →</button></div></div>`;
 el.querySelectorAll('[data-exp-cat]').forEach(b=>b.onclick=()=>{if([...(state.base?.expenseCategories||[])].includes(b.dataset.expCat)){$('kvExpCategory').value=b.dataset.expCat;kvExpensePage=0;kvRenderExpenseReport()}});
 $('kvExpBack').onclick=()=>{if(kvExpensePage>0){kvExpensePage--;kvRenderExpenseReport()}};
 $('kvExpNext').onclick=()=>{if(kvExpensePage<maxPages-1){kvExpensePage++;kvRenderExpenseReport()}};
}

function dashboard(){const first=state.filters.from||iso().slice(0,8)+'01',last=state.filters.to||iso();page('Business dashboard','Accrual sales, cash collections, Utang, expenses and inventory.',`<div class="card"><div class="fieldgrid">${dateField('filterFrom','Start date',first)}${dateField('filterTo','End date',last)}</div><button class="btn block" id="filterDashboard">Refresh dashboard</button></div><div id="dashboardData"><div class="muted">Loading analytics…</div></div>`);
 $('filterDashboard').onclick=()=>{state.filters.from=$('filterFrom').value;state.filters.to=$('filterTo').value;fetchDashboard()};fetchDashboard()}
async function fetchDashboard(){try{const d=await call('dashboard',{from:$('filterFrom').value,to:$('filterTo').value}),target=$('dashboardData');if(!target)return;
 target.innerHTML=`<div class="grid"><div class="mini-stat"><div class="lbl">Paid sales</div><div class="number">${money(d.sales)}</div></div><div class="mini-stat"><div class="lbl">Known gross profit</div><div class="number">${money(d.knownProfit)}</div></div><div class="mini-stat"><div class="lbl">Outstanding Utang</div><div class="number">${money(d.outstanding)}</div></div><div class="mini-stat"><div class="lbl">Operating expenses</div><div class="number">${money(d.expenses)}</div></div><div class="mini-stat"><div class="lbl">Units sold (paid)</div><div class="number">${d.units}</div></div><div class="mini-stat"><div class="lbl">Known profit after expenses</div><div class="number">${money(d.afterExpenses)}</div></div></div>
 ${d.cashReceipts!==undefined?`<div class="card"><div class="row"><span>Checkout payments collected</span><strong>${money(d.cashReceivedAtCheckout)}</strong></div><div class="sep"></div><div class="row"><span>Utang payments collected</span><strong>${money(d.creditCollectionsInPeriod)}</strong></div><div class="sep"></div><div class="row"><strong>Gross merchandise receipts</strong><strong>${money(d.cashReceipts)}</strong></div><div class="sep"></div><div class="row"><span>Refunds paid</span><strong>${money(d.refundsPaid||0)}</strong></div><div class="row"><strong>Net receipts</strong><strong>${money(d.netCashReceipts??d.cashReceipts)}</strong></div></div>`:''} ${d.serviceIncome?`<div class="section">Payment services — fees only</div><div class="grid"><div class="mini-stat"><div class="lbl">Convenience fees earned</div><div class="number">${money(d.serviceIncome.feeIncome)}</div></div><div class="mini-stat"><div class="lbl">Service transactions</div><div class="number">${d.serviceIncome.serviceCount}</div></div><div class="mini-stat"><div class="lbl">Principal received (not income)</div><div class="number">${money(d.serviceIncome.principalIn)}</div></div><div class="mini-stat"><div class="lbl">Principal paid out (not expense)</div><div class="number">${money(d.serviceIncome.principalOut)}</div></div></div><div class="card"><div class="row"><span class="muted">Paid merchandise + service fees</span><strong>${money(d.totalGrossIncome)}</strong></div><div class="sep"></div><div class="row"><span class="muted">Known profit including fees</span><strong>${money(d.totalKnownProfit)}</strong></div><div class="sep"></div><div class="row"><span class="muted">Known profit after operating expenses</span><strong>${money(d.totalAfterExpenses)}</strong></div></div>`:''}
 ${d.uncosted?`<div class="banner">${money(d.uncosted)} in manual sales with unknown purchase cost. This revenue is not included in known gross profit.</div>`:''}
 <div class="section">Sales over time</div><div class="card">${chartRows(d.trend,'day','amount',true)}</div>
 <div class="section">Payments received</div><div class="card">${chartRows(Object.entries(d.payments).map(([method,amount])=>({method,amount})),'method','amount',true)}</div>
 <div class="section">Store health</div><div class="card"><div class="row"><span class="muted">Estimated inventory value</span><strong>${money(d.inventoryValue)}</strong></div><div class="sep"></div><div class="row"><span class="muted">Utang part payments received</span><strong>${money(d.partialCollections)}</strong></div><div class="sep"></div><div class="row"><span class="muted">Stock warnings</span><strong>${d.lowStock.length}</strong></div><div class="sep"></div><div class="row"><span class="muted">Expiring within 30 days</span><strong>${d.expiry.length}</strong></div></div>
 <div class="section">Fast moving</div><div class="card">${chartRows(d.fast,'name','rate',false)}<button class="btn outline block" data-view="analytics">More product analytics →</button></div>`;
 }catch(e){toast(e.message,true)}}
function analytics(){
 const leadDays=Math.min(90,Math.max(1,Math.round(Number(state.filters.leadDays)||7)));
 state.filters.leadDays=leadDays;
 page('Product analytics','Fast/slow movement, stock risk and expiry alerts.',`<div class="banner">Speed uses physical units sold (including unpaid Utang), while revenue charts count only paid sales. Movement is normalized by days since the recorded purchase date.</div><div class="card"><div class="fieldgrid"><div class="field"><label for="leadDays">Supplier delivery lead time (days)</label><input id="leadDays" type="number" min="1" max="90" step="1" inputmode="numeric" value="${leadDays}"></div><div class="field" style="align-self:end"><button type="button" id="refreshAnalytics" class="btn block">Refresh Analytics</button></div></div><p class="muted" style="margin:9px 0 0">Restock recommendations use this delivery lead time plus 7 days of safety stock.</p></div><div id="analyticsData" aria-live="polite"><div class="muted">Loading analytics…</div></div>`);
 const refreshButton=$('refreshAnalytics'),leadInput=$('leadDays');
 if(!refreshButton||!leadInput){
  const target=$('analyticsData');
  if(target)target.innerHTML='<div class="banner red">Analytics controls failed to render. Refresh this app to install the latest update.</div>';
  return;
 }
 refreshButton.onclick=()=>{
  const value=Number(leadInput.value);
  if(!Number.isInteger(value)||value<1||value>90){toast('Enter a whole number of days between 1 and 90.',true);leadInput.focus();return}
  state.filters.leadDays=value;
  loadAnalytics();
 };
 leadInput.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();refreshButton.click()}});
 loadAnalytics();
}
async function loadAnalytics(){try{const d=await call('dashboard',{from:'2020-01-01',to:iso(),leadDays:state.filters.leadDays||7}),target=$('analyticsData');if(!target||state.screen!=='analytics')return;
 target.innerHTML=`<div class="section">Fast-moving products</div><div class="card">${chartRows(d.fast,'name','rate',false)}</div><div class="section">Slow-moving products</div><div class="card">${chartRows(d.slow,'name','rate',false)}</div>
 <div class="section">Suggested restock quantities</div><div class="card"><div class="muted" style="margin-bottom:8px">Estimated using the last 30 days, a ${d.leadDays}-day delivery lead time and 7 days of safety stock, plus your manually entered thresholds.</div>${d.reorder?.length?d.reorder.map(x=>`<div class="item"><div><strong>${esc(x.name)}</strong><div class="desc">${x.stock} on hand · ${x.rate.toFixed(2)} sold/day</div></div><div class="right"><strong class="price">Buy ${x.suggested}</strong></div></div>`).join(''):'<div class="muted">No restock suggestions yet.</div>'}</div><div class="section">Stock warnings</div><div class="card list">${d.lowStock.length?d.lowStock.map(p=>`<div class="row"><strong>${esc(p.name)}</strong><span class="pill warn">${p.stock} left</span></div>`).join('<div class="sep" style="margin:3px"></div>'):'<div class="muted">No low-stock products based on recorded reorder thresholds.</div>'}</div>
 <div class="section">Expiring stock batches</div><div class="card list">${d.expiry.length?d.expiry.map(p=>`<div class="row"><div><strong>${esc(p.name)}</strong><div class="desc">${p.qty} units · ${esc(p.date)}</div></div><span class="pill ${p.days<0?'danger':'warn'}">${p.days<0?'Expired':p.days+' days'}</span></div>`).join(''):'<div class="muted">No batches expiring within 30 days.</div>'}</div>`
 }catch(e){if(state.screen==='analytics'&&$('analyticsData'))$('analyticsData').innerHTML='<div class="card"><strong>Could not load Fast &amp; Slow Analytics.</strong><p class="muted">'+esc(e.message||String(e))+'</p><p class="muted">Check the Apps Script dashboard service and try Refresh Analytics again.</p></div>';toast(e.message||String(e),true)}}
function history(){
 page('Sales history','Filter by exact date, date range, customer or sale ID.',`<div class="card kv-history-card"><div class="field"><label for="historySearch">Search transaction or customer</label><input id="historySearch" placeholder="Customer name or transaction ID"></div><div class="kv-history-quick"><button class="btn outline small" data-hquick="today">Today</button><button class="btn outline small" data-hquick="7">Last 7 days</button><button class="btn outline small" data-hquick="30">Last 30 days</button><button class="btn outline small" data-hquick="all">All dates</button></div><div class="fieldgrid"><div class="field"><label for="historyFrom">From date</label><input id="historyFrom" type="date" value="${esc(state.filters.historyFrom||'')}"></div><div class="field"><label for="historyTo">To date</label><input id="historyTo" type="date" value="${esc(state.filters.historyTo||'')}"></div></div><div class="field"><label for="historySort">Sort by</label><select id="historySort"><option value="newest">Newest first</option><option value="oldest" ${state.filters.historySort==='oldest'?'selected':''}>Oldest first</option></select></div><div class="row" style="margin:14px 0"><button class="btn outline small" id="historyApply">Apply filters</button><button class="btn light small" id="historyClear">Clear dates</button></div><div id="historyResults" class="list" aria-live="polite">Loading sales…</div></div>`);
 const reload=()=>{state.filters.historyFrom=$('historyFrom').value;state.filters.historyTo=$('historyTo').value;state.filters.historySort=$('historySort').value;loadHistory()};
 $('historySearch').oninput=loadHistory;$('historyApply').onclick=reload;
 $('historyFrom').onchange=reload;$('historyTo').onchange=reload;$('historySort').onchange=reload;
 $('historyClear').onclick=()=>{$('historyFrom').value='';$('historyTo').value='';reload()};
 document.querySelectorAll('[data-hquick]').forEach(b=>b.onclick=()=>{const val=b.dataset.hquick;if(val==='all'){$('historyFrom').value='';$('historyTo').value=''}else{const to=iso();const dt=new Date();dt.setDate(dt.getDate()-(val==='today'?0:Number(val)-1));$('historyFrom').value=dt.getFullYear()+'-'+String(dt.getMonth()+1).padStart(2,'0')+'-'+String(dt.getDate()).padStart(2,'0');$('historyTo').value=to}reload()});loadHistory();
}
let historyDelay;function loadHistory(){clearTimeout(historyDelay);historyDelay=setTimeout(async()=>{try{
 const from=$('historyFrom')?.value||'',to=$('historyTo')?.value||'';
 if(from&&to&&from>to){toast('From date must be on or before To date.',true);return;}
 const r=await call('history',{search:$('historySearch')?.value||'',from,to});if(!$('historyResults'))return;
 if(($('historySort')?.value||'newest')==='oldest')r.reverse();
 $('historyResults').innerHTML=r.map(x=>`<div class="item"><div style="min-width:0"><strong>${esc(x.product)}</strong><div class="desc">${esc(x.transactionId)} · ${esc(x.date)} · ${esc(x.customer||'Walk-in')}</div><span class="pill ${x.status==='CREDIT'?'warn':'gray'}">${esc(x.payment)} · ${esc(x.status)}</span></div><div class="right"><div class="price">${money(x.amount)}</div>${may('owner')&&x.status!=='VOID'?`<button class="rightlink" data-correct="${esc(x.key)}">Correct</button><button class="rightlink" data-cancel="${esc(x.key)}">Void transaction</button>`:''}</div></div>`).join('')||'<div class="banner">No transactions match these filters.</div>';
 document.querySelectorAll('[data-cancel]').forEach(b=>b.onclick=()=>cancelLineUI(b.dataset.cancel));document.querySelectorAll('[data-correct]').forEach(b=>b.onclick=()=>correctLineUI(r.find(x=>x.key===b.dataset.correct)));
 }catch(e){toast(e.message,true)}},200)}
async function cancelLineUI(key){const tx=key.split('#')[0];if(!confirm('VOID ALL LINES of '+tx+'? Original records will be preserved in the audit log.'))return;
 const restock=confirm('Are ALL the physical products from this transaction returned and resellable? OK = return to stock. Cancel = no stock return.');const reason=prompt('Reason for void / customer return','Customer return');if(!reason)return;
 await work(async()=>{const r=await call('voidTransaction',{requestId:uid(),transactionId:tx,returnStock:restock,reason});toast('Voided '+r.transactionId+'. Review '+r.refundObligations.length+' refund obligations in More → Refunds.');await refreshProducts();history()})}
async function correctLineUI(x){if(!x||x.status==='VOID')return;const isManual=!x.productId;
 const qty=isManual?0:Number(prompt('Corrected quantity for '+x.product+' (current '+x.qty+')',String(x.qty)));
 if(!isManual&&(!Number.isSafeInteger(qty)||qty<1))return toast('Correction requires positive whole quantity.',true);
 const priceOrAmount=prompt(isManual?'Corrected manual sale amount':'Corrected selling price per unit',String(isManual?x.amount:x.price));if(priceOrAmount===null)return;
 const reason=prompt('Reason for this correction (required)','Quantity/price entry mistake');if(!reason)return;
 const p={requestId:uid(),key:x.key,quantity:qty,price:priceOrAmount,amount:priceOrAmount,expectedAmount:x.amount,expectedQuantity:x.qty,reason};
 if(x.payment==='Split'){
  const sum=await call('splitDetails',{transactionId:x.transactionId});const newTotal=sum.transactionTotal-x.amount+(isManual?Number(priceOrAmount):qty*Number(priceOrAmount));
  const shares=sum.shares.map(s=>({customer:s.customer,method:s.method,amount:s.amount}));
  alert('The revised TOTAL transaction amount is '+money(newTotal)+'. Cash portions must remain unchanged.');
  const i=shares.findIndex(s=>s.method==='Utang');if(i<0&&Math.round(newTotal*100)!==Math.round(sum.transactionTotal*100))return toast('Two cash customers: void and reissue if amount changes.',true);
  if(i>=0){shares[i].amount=Math.round((newTotal-shares.reduce((a,s,j)=>a+(i===j?0:s.amount),0))*100)/100;}
  p.shares=shares.map(s=>s.amount);
 }
 if(!confirm('Apply owner correction? Stock, sales and the audit log will be updated.'))return;
 await work(async()=>{const r=await call('correctSaleLine',p);toast('Correction recorded '+r.key+(r.settlementReview?' · Cash difference needs review':''));await refreshProducts();history()});}

function adjust(){page('Damaged / expired stock','Write off unsellable inventory without recording a fake sale.',`<div class="card"><form id="adjustForm">${sel('adjustProd','Product',state.products.map(p=>({value:p.id,label:p.name+' · '+p.stock+' left'})),state.selected||'')}
 <div class="field"><label>Units to remove</label><input id="adjustQty" type="number" min="1" step="1" value="1" required></div>${sel('adjustReason','Reason',['Expired','Damaged','Lost','Spoiled','Other'],'Expired')}<button class="btn block" type="submit">Record stock write-off</button></form></div>`);
 $('adjustForm').onsubmit=async e=>{e.preventDefault();if(!confirm('Permanently remove these units from sellable stock?'))return;
 await work(async()=>{const r=await call('stockAdjust',{requestId:uid(),productId:$('adjustProd').value,quantity:$('adjustQty').value,reason:$('adjustReason').value});toast('Stock updated: '+r.stock+' left');await refreshProducts();setView('products')})}}
function stockCount(){page('Physical stock count','Reconcile actual shelf quantity against Google Sheets.',`<div class="card"><form id="countForm">${sel('countProd','Product',state.products.map(p=>({value:p.id,label:p.name+' · '+p.stock+' on record'})),state.selected||'')}
 <div class="field"><label>Actual counted quantity</label><input type="number" id="countQty" min="0" step="1" required></div>${textField('countReason','Reason / observation','Physical count')}<button class="btn block" type="submit">Reconcile Stock</button></form></div>`);
 $('countForm').onsubmit=async e=>{e.preventDefault();if(!confirm('Adjust recorded stock to the physical count?'))return;
 await work(async()=>{const r=await call('stockCount',{requestId:uid(),productId:$('countProd').value,actual:$('countQty').value,reason:$('countReason').value});toast('Stock count saved · difference '+r.difference);await refreshProducts();setView('products')})}}
async function refundsPage(){page('Refund obligations','Voided sales create a refund liability until explicitly paid.',`<div class="card"><p class="sub">Refunding a customer is separate from voiding their transaction. Record each actual payment with a reference.</p><div id="refundList">Loading…</div></div>`);
 try{const r=await call('refunds');if(state.screen!=='refundsPage')return;$('refundList').innerHTML=r.length?r.map(x=>`<div class="item"><div><strong>${esc(x.customer)}</strong><div class="desc">${esc(x.transactionId)} · ${esc(x.status)}</div></div><div class="right">${money(x.remaining)}<div>${x.remaining>0?`<button class="rightlink" data-refund="${esc(x.id)}">Record refund</button>`:''}</div></div></div>`).join(''):'<div class="muted">No refund obligations.</div>';
 document.querySelectorAll('[data-refund]').forEach(b=>b.onclick=async()=>{const x=r.find(z=>z.id===b.dataset.refund);const amt=prompt('Refund amount (up to '+money(x.remaining)+')',String(x.remaining));if(amt===null)return;const reference=prompt('Refund receipt/reference number (required)');if(!reference)return;const method=prompt('Method: Cash, GCash, Bank Transfer, Card','Cash');if(!method)return;
 await work(async()=>{await call('recordRefund',{requestId:uid(),obligationId:x.id,amount:amt,method,reference});toast('Refund recorded');refundsPage()})});}catch(e){toast(e.message,true)} }
function qaIntegrity(){page('QA consistency audit','Read-only checks. No records are modified.',`<div class="banner">Run this before deployment or after a synchronization problem. An empty finding list is not proof of full accounting correctness.</div><button class="btn block" id="runAudit">Run read-only audit</button><div id="qaResults" class="card" style="margin-top:12px">Not checked yet.</div>`);$('runAudit').onclick=async()=>{const b=$('runAudit');b.disabled=true;b.textContent='Checking…';try{const r=await call('qaAudit',{}),el=$('qaResults');if(!el)return;const s=r.summary;el.innerHTML=`<strong>Last checked ${esc(r.checkedAt)}</strong><div class="grid" style="margin:12px 0"><div class="mini-stat"><div class="lbl">Errors</div><div class="number">${s.errors}</div></div><div class="mini-stat"><div class="lbl">Warnings</div><div class="number">${s.warnings}</div></div><div class="mini-stat"><div class="lbl">Split transactions</div><div class="number">${s.splitTransactions}</div></div><div class="mini-stat"><div class="lbl">Products checked</div><div class="number">${s.products}</div></div></div><div class="list">${r.findings.length?r.findings.map(x=>`<div class="item"><div><strong>${esc(x.level)} — ${esc(x.code)}</strong><div class="desc">${esc(x.ref)} · ${esc(x.detail)}</div></div></div>`).join(''):'<div class="banner green">No findings in this targeted scan.</div>'}</div><p class="muted">${esc(r.disclaimer)}</p>`}catch(e){toast(e.message,true)}finally{b.disabled=false;b.textContent='Run read-only audit'}}}
async function visitorsPage(){page('Customer visitors','Customers who entered their name in your public catalog.',`<div class="card"><p class="muted">Online = seen within the last 2½ minutes. Names are a convenience, not verified identities.</p><button class="btn outline" id="refreshVisitors">Refresh visitors</button><div id="visitorList" class="list" style="margin-top:12px">Loading visitors…</div></div>`);$('refreshVisitors').onclick=()=>visitorsPage();try{const visitors=await call('visitors');if(state.screen!=='visitorsPage')return;$('visitorList').innerHTML=visitors.length?visitors.map(v=>`<div class="item"><div><strong>${esc(v.name)}</strong><div class="tiny">Last seen: ${esc(new Date(v.lastSeen).toLocaleString('en-PH'))}</div></div><span class="pill ${v.online?'':'gray'}">${v.online?'● Online':'○ Offline'}</span></div>`).join(''):'<div class="muted">No visitors have joined yet.</div>';}catch(e){toast(e.message,true)}}

/* Product Details Expiry Date dashboard. Read-only, no stock adjustments.
   For multiple delivery batches, refer to the per-batch analytics before write-offs. */
function kvExpiryDays(raw){const d=kvExpiryDate(raw);if(!d)return null;const n=new Date(),today=new Date(n.getFullYear(),n.getMonth(),n.getDate(),12);return Math.round((d-today)/86400000)}
function kvExpiryISO(raw){const d=kvExpiryDate(raw);if(!d)return '';return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
const kvExpiryFilters={mode:'days',days:30,from:'',to:'',query:'',category:'',sort:'nearest',includeZero:false};
function expiryDashboard(){
 if(!may('stock')){page('Expiry Dates','',`<div class="banner red">You need Stock / Inventory permission to view expiry dates.</div>`);return}
 const f=kvExpiryFilters;
 page('Expiry Dates','See expired items and products approaching their recorded expiry dates.',`
 <div class="kv-expiry-head"><div><span class="kv-expiry-overline">INVENTORY WATCH</span><h3>Expiry Date Tracker</h3><p>Filter upcoming or expired products and sort by expiration date.</p></div><button id="kvExpiryRefresh" class="btn">↻ Refresh</button></div>
 <div class="kv-expiry-presets" role="group" aria-label="Expiry date presets">
  ${[['expired','Expired'],['7','7 days'],['14','14 days'],['30','30 days'],['60','60 days'],['90','90 days'],['range','Date range'],['all','All dated']].map(([v,l])=>`<button type="button" data-exp-preset="${v}" class="kv-expiry-preset ${(f.mode==='expired'&&v==='expired')||(f.mode==='range'&&v==='range')||(f.mode==='all'&&v==='all')||(f.mode==='days'&&String(f.days)===v)?'active':''}">${l}</button>`).join('')}
 </div>
 <div class="card kv-expiry-filtercard"><div class="kv-expiry-fields">
 <div class="field"><label for="kvExpiryMode">Show</label><select id="kvExpiryMode"><option value="days" ${f.mode==='days'?'selected':''}>Expiring within next N days</option><option value="expired" ${f.mode==='expired'?'selected':''}>Already expired</option><option value="range" ${f.mode==='range'?'selected':''}>Date range</option><option value="all" ${f.mode==='all'?'selected':''}>All with an expiry date</option></select></div>
 <div class="field" id="kvExpiryDaysWrap"><label for="kvExpiryDays">Within days</label><input id="kvExpiryDays" type="number" min="0" max="3650" step="1" value="${f.days}"></div>
 <div class="field" id="kvExpiryFromWrap"><label for="kvExpiryFrom">From expiry date</label><input type="date" id="kvExpiryFrom" value="${esc(f.from||iso())}"></div>
 <div class="field" id="kvExpiryToWrap"><label for="kvExpiryTo">To expiry date</label><input type="date" id="kvExpiryTo" value="${esc(f.to||iso())}"></div>
 <div class="field"><label for="kvExpirySort">Sort results</label><select id="kvExpirySort"><option value="nearest" ${f.sort==='nearest'?'selected':''}>Earliest expiry first</option><option value="latest" ${f.sort==='latest'?'selected':''}>Latest expiry first</option><option value="name" ${f.sort==='name'?'selected':''}>Product name A–Z</option><option value="stock" ${f.sort==='stock'?'selected':''}>Most stock first</option></select></div>
 <div class="field"><label for="kvExpiryCategory">Category</label><select id="kvExpiryCategory">${productCategoryOptions(f.category,true)}</select></div>
 </div>
 <div class="kv-expiry-searchrow"><input id="kvExpirySearch" placeholder="Search name or Product ID…" value="${esc(f.query)}"><label class="kv-expiry-toggle"><input type="checkbox" id="kvExpiryIncludeZero" ${f.includeZero?'checked':''}>Include out-of-stock</label></div>
 <p class="kv-expiry-note">Dates come from each product's <b>Expiry Date</b> in Google Sheets. Products with different delivery batches may have separate batch dates; check stock batches before removing expired items.</p></div>
 <div id="kvExpiryResults" aria-live="polite"></div>`);
 for(const [id,key] of [['kvExpiryMode','mode'],['kvExpiryDays','days'],['kvExpiryFrom','from'],['kvExpiryTo','to'],['kvExpirySort','sort'],['kvExpiryCategory','category'],['kvExpirySearch','query']]){
  $(id).addEventListener(id==='kvExpirySearch'||id==='kvExpiryDays'?'input':'change',()=>{f[key]=key==='days'?Math.max(0,Math.min(3650,Math.floor(Number($(id).value)||0))):$(id).value;kvExpiryPaint()})
 }
 $('kvExpiryIncludeZero').onchange=e=>{f.includeZero=e.target.checked;kvExpiryPaint()};
 document.querySelectorAll('[data-exp-preset]').forEach(b=>b.onclick=()=>{const v=b.dataset.expPreset;if(/^\d+$/.test(v)){f.mode='days';f.days=Number(v)}else f.mode=v;$('kvExpiryMode').value=f.mode;$('kvExpiryDays').value=f.days;document.querySelectorAll('[data-exp-preset]').forEach(x=>x.classList.toggle('active',x===b));kvExpiryPaint()});
 $('kvExpiryRefresh').onclick=()=>work(async()=>{await refreshProducts();if(state.screen==='expiryDashboard')kvExpiryPaint();toast('Expiry dates refreshed from Google Sheets')}).catch(()=>{});
 kvExpiryPaint();
}
function kvExpiryPaint(){
 const target=$('kvExpiryResults');if(!target)return;const f=kvExpiryFilters;
 $('kvExpiryDaysWrap').style.display=f.mode==='days'?'':'none';$('kvExpiryFromWrap').style.display=f.mode==='range'?'':'none';$('kvExpiryToWrap').style.display=f.mode==='range'?'':'none';
 document.querySelectorAll('[data-exp-preset]').forEach(b=>{const v=b.dataset.expPreset;b.classList.toggle('active',f.mode===v||(f.mode==='days'&&String(f.days)===v))});
 const rows=(state.products||[]).filter(p=>p&&p.id&&p.active!==false&&kvExpiryDate(p.expiry)).map(p=>({...p,expIso:kvExpiryISO(p.expiry),days:kvExpiryDays(p.expiry)}));
 const today=iso(),search=String(f.query||'').trim().toLocaleLowerCase();
 const visible=rows.filter(p=>{
  if(!f.includeZero&&Number(p.stock||0)<=0)return false;
  if(f.category&&p.category!==f.category)return false;
  if(search&&!String(p.name||'').toLocaleLowerCase().includes(search)&&!String(p.id||'').toLocaleLowerCase().includes(search))return false;
  if(f.mode==='expired')return p.days<0;
  if(f.mode==='days')return p.days>=0&&p.days<=f.days;
  if(f.mode==='range'){const from=$('kvExpiryFrom').value||today,to=$('kvExpiryTo').value||today;return from<=to&&p.expIso>=from&&p.expIso<=to}
  return true;
 }).sort((a,b)=>f.sort==='latest'?b.expIso.localeCompare(a.expIso)||a.name.localeCompare(b.name):f.sort==='name'?a.name.localeCompare(b.name):f.sort==='stock'?Number(b.stock||0)-Number(a.stock||0)||a.expIso.localeCompare(b.expIso):a.expIso.localeCompare(b.expIso)||a.name.localeCompare(b.name));
 const totalOnHand=visible.reduce((n,p)=>n+Math.max(0,Number(p.stock)||0),0),expired=visible.filter(p=>p.days<0).length,dueSoon=visible.filter(p=>p.days>=0&&p.days<=7).length,missing=(state.products||[]).filter(p=>p&&p.id&&p.active!==false&&Number(p.stock)>0&&!kvExpiryDate(p.expiry)).length;
 let invalid='';if(f.mode==='range'&&$('kvExpiryFrom').value>$('kvExpiryTo').value)invalid='<div class="banner red">The start date must be on or before the end date.</div>';
 target.innerHTML=`<div class="kv-expiry-stats"><div><small>Matching products</small><strong>${visible.length}</strong></div><div><small>Units on hand</small><strong>${totalOnHand.toLocaleString('en-PH')}</strong></div><div><small>Expired products</small><strong>${expired}</strong></div><div><small>Due within 7 days</small><strong>${dueSoon}</strong></div></div>
 <div class="kv-expiry-list"><div class="kv-expiry-listhead"><strong>Expiry results</strong><span>${visible.length} matching · ${missing} stocked products have no expiry date</span></div>${invalid}
 ${visible.slice(0,250).map(p=>{
  const status=p.days<0?'expired':p.days===0?'today':p.days<=7?'urgent':p.days<=30?'soon':'later',label=p.days<0?Math.abs(p.days)+' days expired':p.days===0?'Expires today':p.days+' days left';
  return `<div class="kv-expiry-row"><span class="kv-expiry-icon">${esc(kvCategoryIconSafe(p.category,p.icon))}</span><div class="kv-expiry-description"><strong>${esc(p.name)}</strong><small>${esc(p.id)} · ${esc(p.category||'Uncategorized')}</small><small>Stock: <b>${Math.max(0,Number(p.stock)||0)}</b> · Expires: <b>${esc(p.expIso)}</b></small></div><div class="kv-expiry-right"><span class="kv-expiry-status ${status}">${esc(label)}</span>${may('products')?`<button type="button" class="kv-expiry-edit" data-exp-edit="${esc(p.id)}">Edit product</button>`:''}</div></div>`}).join('')||'<div class="kv-expiry-empty">No products match your expiry-date filters.</div>'}${visible.length>250?'<p class="kv-expiry-note">Showing the first 250 matching products. Narrow your search to see the others.</p>':''}
 </div>`;
 target.querySelectorAll('[data-exp-edit]').forEach(b=>b.onclick=()=>setView('edit',b.dataset.expEdit));
}
function more(){const options=[['⌂','Customer View Manager','catalogAdmin','owner'],['₱','Payment Services','services','sales'],['▤','Record Other Expense','expenses','expenses'],['▥','Expenses Dashboard','expenseDashboard','expenses'],['◷','Expiry Dates','expiryDashboard','stock'],['▦','Stock / Inventory','inventory','stock'],['▥','Add Stock','restock','stock'],['⊗','Damaged / Expired Stock','adjust','stock'],['≋','Physical Stock Count','stockCount','stock'],['◫','Business Dashboard','dashboard','dashboard'],['◷','Fast & Slow Analytics','analytics','dashboard'],['◎','Customer History','history','sales'],['⌁','Offline Queue ('+state.pending.length+')','queue','sales'],['♙','Team & Roles','users','owner'],['✓','QA Integrity Audit','qaIntegrity','owner'],['↩','Refund Obligations','refundsPage','owner'],['👥','Customer Presence','visitorsPage','owner']];
 page('More tools','Keep your shop organized, online or offline.',`<div class="list">${options.filter(x=>may(x[3])).map(x=>`<button class="item" style="width:100%;text-align:left" data-view="${x[2]}"><span style="font-size:22px">${x[0]}</span><strong style="flex:1">${x[1]}</strong><span>→</span></button>`).join('')}</div><div class="gap"></div><div class="card"><div class="row"><div><strong>${esc(state.user?.name)}</strong><div class="muted">${esc(state.user?.role)}</div></div><button class="btn outline small" id="logoutBtn">Sign out</button></div>${may('owner')?'<div class="sep"></div><button class="btn light block" id="backupBtn">Create full Google Sheets backup</button>':''}</div>`);
 $('logoutBtn').onclick=logout;if($('backupBtn'))$('backupBtn').onclick=()=>work(async()=>{const r=await call('backupNow',{requestId:uid()});toast('Backup created');window.open(r.url,'_blank')})}
function users(){page('Team & permissions','You decide which accounts are Owners and Cashiers.',`<div class="card"><div class="section" style="margin-top:0">Add / update account</div><form id="userForm">${textField('userName','Login username','', 'required')}${textField('displayName','Display name','', 'required')}${textField('userPin','PIN / passphrase (8+ characters)','', 'type="password"')}${sel('userRole','Role',['Cashier','Owner'],'Cashier')}
 <div class="section">Cashier permissions</div><div class="grid">${['sales','credit','payments','products','stock','expenses','dashboard','profit','discounts','refund'].map(x=>`<label class="row" style="border:1px solid var(--line);border-radius:12px;padding:10px"><span>${esc(x)}</span><input data-permission="${x}" type="checkbox" ${['sales','credit'].includes(x)?'checked':''}></label>`).join('')}</div>
 <button class="btn block" type="submit" style="margin-top:15px">Save Account</button></form></div><div class="section">Existing users</div><div id="usersList" class="list">Loading…</div>`);
 $('userForm').onsubmit=async e=>{e.preventDefault();const p={requestId:uid(),username:$('userName').value,name:$('displayName').value,pin:$('userPin').value,role:$('userRole').value,permissions:[...document.querySelectorAll('[data-permission]:checked')].map(x=>x.dataset.permission),active:true};
 await work(async()=>{const r=await call('saveUser',p);toast('Account saved: '+r.username);users()})};loadUsers()}
async function loadUsers(){try{const users=await call('users');if(!$('usersList'))return;$('usersList').innerHTML=users.map(u=>`<div class="item"><div><strong>${esc(u.name)}</strong><div class="desc">${esc(u.username)} · ${esc(u.role)}</div></div><span class="pill ${u.active?'':'danger'}">${u.active?'Active':'Disabled'}</span></div>`).join('')}catch(e){toast(e.message,true)}}

async function services(){
 page('Payment services','Record GCash, bills and mobile load separately from product sales.',`<div class="card"><form id="svcForm"><div class="field"><label>Service</label><select id="svcKind"><option>GCash Cash In</option><option>GCash Cash Out</option><option>Pay Bills</option><option>Mobile Load</option></select></div><div class="field"><label>Provider transaction reference</label><input id="svcRef" required maxlength="120"></div><div class="field"><label>Principal amount (₱)</label><input id="svcPrincipal" type="number" min="0.01" step="0.01" required></div><div class="field"><label>Convenience fee / income (₱)</label><input id="svcFee" type="number" min="0" step="0.01" value="0" required></div><div class="field"><label>Payment method</label><select id="svcPay"><option>Cash</option><option>GCash</option><option>Bank Transfer</option></select></div><div class="field"><label>Customer (optional)</label><input id="svcCustomer"></div><button class="btn block" type="submit">Confirm service transaction</button></form></div><div class="card"><div id="svcStats">Loading history…</div></div>`);
 $('svcForm').onsubmit=async e=>{e.preventDefault();const req={requestId:uid(),serviceType:$('svcKind').value,reference:$('svcRef').value,principal:$('svcPrincipal').value,fee:$('svcFee').value,method:$('svcPay').value,customer:$('svcCustomer').value};if(!confirm('Record this service transaction?'))return;await work(async()=>{const r=await call('serviceSale',req);toast('Recorded '+r.serviceId);await services()})};
 try{const report=await call('serviceHistory');if(state.screen!=='services')return;$('svcStats').innerHTML='<b>Confirmed convenience-fee income:</b> '+money(report.feeIncome)+'<p>Principal received: '+money(report.principalIn)+' · Principal released: '+money(report.principalOut)+'</p>'+report.records.slice(0,15).map(r=>'<div class="item"><span>'+esc(r.type)+' · '+esc(r.reference)+'</span><span>'+money(r.principal)+' + fee '+money(r.fee)+'</span></div>').join('')}catch(e){toast(e.message,true)}
}

async function catalogAdmin(){
 const opts=[
 ['showCategoryIcons','Automatically assign category icons'],['allowCustomIcons','Allow custom product illustrations'],
 ['animateIcons','Animate icons on hover or tap'],['showPrices','Show product prices'],
 ['showStock','Show exact stock quantities'],['showDiscounted','Show Special Offers'],
 ['showBest','Show Best Sellers'],['showFeatured','Show Featured Products']];
 const icons=[['auto','Auto-detect product type'],['bottle','Mini soda bottle'],['chips','Mini chips pouch'],['noodles','Mini noodle pack'],
 ['milk','Mini milk carton'],['coffee','Mini coffee pouch'],['can','Canned goods'],['sardines','Mini sardine can'],
 ['drink','Juice cup'],['water','Water bottle'],['sachet','Mini sachet'],['candy','Candy'],['cookie','Biscuits'],['beer','Bottle beverage'],
 ['medicine','Medicine capsule'],['vegetable','Fresh produce'],['ice','Ice cubes'],['soap','Soap bottle'],['powder','Detergent pouch'],
 ['cleaning','Cleaning bottle'],['oil','Cooking oil'],['sauce','Condiment bottle'],['bread','Bread'],['egg','Egg'],
 ['cigarette','Cigarette pack'],['household','Household item'],['service','Services']];
 const productRows=state.products.slice().sort((a,b)=>a.name.localeCompare(b.name));
 const productOptions=productRows.map(p=>`<option value="${esc(p.id)}">${esc(p.name)} · ${esc(p.id)}</option>`).join('');
 page('Customer View Manager','Control your public catalog, discounts and cute mini-product icons.',`
 <div class="kv-catalog-hero"><div><small>PUBLIC STOREFRONT</small><strong>Your customers see only what you publish.</strong><p>Search · Best Sellers · Special Offers · Featured Products</p></div><span aria-hidden="true">✦</span></div>
 <div class="card kv-catalog-panel"><h3>Customer View display settings</h3><p class="muted">Your approved default: all eight features enabled. Change any option at any time.</p><div id="kvCatalogSettings">Loading settings…</div><button class="btn block" id="kvSaveDisplay" type="button">Save customer view settings</button></div>
 <div class="card kv-catalog-panel"><h3>Manage a product</h3><p class="muted">Choose a product, then publish, feature, discount or change its illustration.</p>
 <div class="field"><label for="catFind">Find a product</label><input id="catFind" autocomplete="off" placeholder="Type product name or ID…"></div>
 <div class="field"><label for="catProd">Product</label><select id="catProd">${productOptions}</select></div>
 <div id="catProductStatus" class="kv-cat-summary">Select a product to load its current customer settings.</div>
 <div class="fieldgrid"><div class="field"><label for="catPublic">Show in Customer View</label><select id="catPublic"><option value="yes">Yes — publish</option><option value="no">No — private</option></select></div><div class="field"><label for="catIcon">Cute product illustration</label><select id="catIcon">${icons.map(([v,t])=>`<option value="${esc(v)}">${esc(t)}</option>`).join('')}</select></div></div>
 <div class="fieldgrid"><div class="field"><label for="catFeatured">Featured product</label><select id="catFeatured"><option value="no">Not featured</option><option value="yes">Featured ✦</option></select></div><div class="field"><label for="catBestseller">Best Seller label</label><select id="catBestseller"><option value="AUTO">Automatic from sales</option><option value="YES">Always highlight ★</option><option value="NO">Do not highlight</option></select></div></div>
 <div class="field"><label for="catPhoto">Product photo URL (optional)</label><input id="catPhoto" type="url" placeholder="https://example.com/product.jpg"></div>
 <div class="kv-catalog-discount"><h3>Special offer / Discount</h3><div class="fieldgrid"><div class="field"><label for="catDiscKind">Discount type</label><select id="catDiscKind"><option value="none">No discount</option><option value="percent">Percentage off (%)</option><option value="amount">Amount off (₱)</option><option value="final">Set final promo price (₱)</option></select></div><div class="field"><label for="catDiscValue">Discount value</label><input type="number" id="catDiscValue" min="0" step="0.01" value="0" inputmode="decimal"></div></div><div id="catPricePreview" class="kv-cat-summary" aria-live="polite">Choose a product to preview its pricing.</div>
 <div class="field"><label for="catPromo">Promotion message (optional)</label><input id="catPromo" maxlength="180" placeholder="Weekend treat · Limited stock!"></div>
 <div class="fieldgrid"><div class="field"><label for="catStart">Promo start date (optional)</label><input type="date" id="catStart"></div><div class="field"><label for="catEnd">Promo end date (optional)</label><input type="date" id="catEnd"></div></div><p class="tiny">An active discount appears in the customer catalog and applies automatically when a product is added to the POS sale. Posted sales keep their original price snapshot.</p></div>
 <button class="btn block" id="saveCatalog">Save product for Customer View</button></div>
 <div class="card kv-catalog-panel"><h3>Store hours & customer link</h3><div id="storeSettingForm">Loading store settings…</div></div>`);
 const setIds=opts.map(([k])=>'kvSetting_'+k);
 const cfgBox=$('kvCatalogSettings');cfgBox.innerHTML=opts.map(([k,label])=>`<label class="kv-setting-line" for="kvSetting_${k}"><span>${esc(label)}</span><input type="checkbox" id="kvSetting_${k}" checked></label>`).join('');
 const showPrice=()=>{const p=state.products.find(x=>x.id===$('catProd')?.value);if(!p)return;
  const kind=$('catDiscKind').value,v=Number($('catDiscValue').value),reg=Number(p.price);
  if(kind==='none'){$('catPricePreview').textContent='Regular selling price: '+money(reg)+' · No active discount';return;}
  if(!Number.isFinite(v)||v<0){$('catPricePreview').textContent='Enter a valid positive discount.';return;}
  let price=kind==='percent'?reg*(1-v/100):kind==='amount'?reg-v:v;
  price=Math.round((price+Number.EPSILON)*100)/100;
  const okay=price>=0&&price<=reg&&(kind!=='percent'||v<=100);
  $('catPricePreview').textContent=okay?'Regular '+money(reg)+' → Promotional '+money(price)+' · Customer saves '+money(reg-price):'Discount must not exceed the regular price.';
 };
 ['catDiscKind','catDiscValue'].forEach(id=>$(id).addEventListener('input',showPrice));
 const loadEntry=async()=>{
  const id=$('catProd').value;if(!id)return;
  $('catProductStatus').textContent='Loading product settings…';
  try{const e=await call('catalogEntry',{productId:id});if(state.screen!=='catalogAdmin'||$('catProd').value!==id)return;
   const p=state.products.find(x=>x.id===id);
   $('catPublic').value=e.isPublic?'yes':'no';$('catIcon').value=e.iconStyle||'auto';$('catFeatured').value=e.featured?'yes':'no';$('catBestseller').value=e.bestSeller||'AUTO';
   $('catPhoto').value=e.photoUrl||'';$('catPromo').value=e.promotion||'';$('catStart').value=e.promoStart||'';$('catEnd').value=e.promoEnd||'';
   $('catDiscKind').value=e.promoPrice===''?'none':'final';$('catDiscValue').value=e.promoPrice===''?'0':String(e.promoPrice);
   $('catProductStatus').innerHTML='<strong>'+esc(p?.name||id)+'</strong><br>Regular '+money(p?.price||0)+' · '+Math.max(0,Number(p?.stock)||0)+' left · '+esc(p?.category||'');showPrice();
  }catch(e){if($('catProductStatus'))$('catProductStatus').textContent='Could not load: '+e.message;toast(e.message,true)}
 };
 $('catProd').addEventListener('change',loadEntry);
 $('catFind').addEventListener('input',e=>{const term=e.target.value.trim().toLowerCase();const matches=productRows.filter(p=>(p.name+' '+p.id).toLowerCase().includes(term)).slice(0,100);
  const existing=$('catProd').value;$('catProd').innerHTML=matches.map(p=>`<option value="${esc(p.id)}">${esc(p.name)} · ${esc(p.id)}</option>`).join('');
  if(matches.length){if(matches.some(p=>p.id===existing))$('catProd').value=existing;loadEntry()}else $('catProductStatus').textContent='No product matches your search.';
 });
 $('kvSaveDisplay').onclick=()=>work(async()=>{
  const values={requestId:uid()};opts.forEach(([k])=>values[k]=$('kvSetting_'+k).checked);
  await call('saveCatalogDisplaySettings',values);toast('Customer View settings saved');
 });
 $('saveCatalog').onclick=()=>work(async()=>{
  const product=state.products.find(x=>x.id===$('catProd').value);if(!product)throw Error('Please select a product.');
  const kind=$('catDiscKind').value,v=Number($('catDiscValue').value),regular=Number(product.price);
  if(!Number.isFinite(v)||v<0)throw Error('Enter a valid discount.');
  let promoPrice='';if(kind!=='none'){
   if(kind==='percent'&&v>100)throw Error('Percent discount must be between 0 and 100.');
   const value=kind==='percent'?regular*(1-v/100):kind==='amount'?regular-v:v;
   if(!Number.isFinite(value)||value<0||value>regular)throw Error('Discount cannot exceed regular selling price.');
   promoPrice=(Math.round((value+Number.EPSILON)*100)/100).toFixed(2);
  }
  if($('catStart').value&&$('catEnd').value&&$('catStart').value>$('catEnd').value)throw Error('Discount end date cannot precede start date.');
  const payload={requestId:uid(),productId:product.id,isPublic:$('catPublic').value==='yes',iconStyle:$('catIcon').value,featured:$('catFeatured').value==='yes',bestSeller:$('catBestseller').value,photoUrl:$('catPhoto').value,promotion:$('catPromo').value,promoPrice,promoStart:$('catStart').value,promoEnd:$('catEnd').value};
  await call('saveCatalogProduct',payload);await refreshProducts();toast('Saved product publication, illustration and promotion.');await loadEntry();
 });
 try{
  const [s,cfg]=await Promise.all([call('storeSettings'),call('catalogDisplaySettings')]);if(state.screen!=='catalogAdmin')return;
  opts.forEach(([k])=>{const e=$('kvSetting_'+k);if(e)e.checked=cfg[k]!==false});
  $('storeSettingForm').innerHTML=`<div class="field"><label for="storeName">Store name</label><input id="storeName" value="${esc(s.storeName)}"></div><div class="fieldgrid"><div class="field"><label for="openTime">Opening time</label><input id="openTime" type="time" value="${esc(s.openTime)}"></div><div class="field"><label for="closeTime">Closing time</label><input id="closeTime" type="time" value="${esc(s.closeTime)}"></div></div><div class="field"><label for="storeMode">Public status</label><select id="storeMode"><option value="OPEN" ${s.storeMode==='OPEN'?'selected':''}>Open</option><option value="AWAY" ${s.storeMode==='AWAY'?'selected':''}>Away</option><option value="CLOSED" ${s.storeMode==='CLOSED'?'selected':''}>Closed</option></select></div><div class="field"><label for="reopenAt">Back on (optional)</label><input type="datetime-local" id="reopenAt" value="${esc(s.reopenAt||'')}"></div><div class="field"><label for="storeMessage">Message to customers</label><input id="storeMessage" maxlength="160" value="${esc(s.storeMessage||'')}"></div><button class="btn block" id="saveStore">Save store hours & status</button><button type="button" class="btn outline block" id="showCustomerLink" style="margin-top:10px">Get customer shopping link ↗</button><div id="customerLinkResult" class="tiny" style="margin-top:9px"></div>`;
  $('showCustomerLink').onclick=()=>work(async()=>{const x=await call('customerLink');$('customerLinkResult').innerHTML=x.ready?`<label>Public link (no owner password)</label><input id="pubLink" readonly value="${esc(x.url)}"><button class="btn alt" id="copyPublicLink">Copy link</button>`:esc(x.note||'Web app deployment required');if(x.ready)$('copyPublicLink').onclick=async()=>{try{await navigator.clipboard.writeText(x.url);toast('Public link copied')}catch(e){$('pubLink').select();toast('Select the link to copy')}}});
  $('saveStore').onclick=()=>work(async()=>{await call('saveStoreSettings',{requestId:uid(),storeName:$('storeName').value,openTime:$('openTime').value,closeTime:$('closeTime').value,storeMode:$('storeMode').value,reopenAt:$('reopenAt').value,storeMessage:$('storeMessage').value});toast('Store hours and status saved')});
 }catch(e){if($('storeSettingForm'))$('storeSettingForm').textContent='Update Code.gs and deploy the new Apps Script version first. '+e.message;toast(e.message,true)}
 await loadEntry();
}

function initialEvents(){document.addEventListener('click',e=>{const v=e.target.closest('[data-view]');if(!v)return;const target=v.dataset.view;if(target==='home'||may(['dashboard','analytics'].includes(target)?'dashboard':target==='restock'||target==='expiryDashboard'?'stock':target==='expenses'||target==='expenseDashboard'?'expenses':target==='utang'?'credit':target==='users'?'owner':target==='visitorsPage'?'owner':target==='catalogAdmin'?'owner':target==='services'?'sales':target==='history'?'sales':target==='inventory'?'stock':target==='products'?'sales':target==='editFinder'?'products':target==='scan'?'sales':target==='create'?'products':target==='adjust'||target==='stockCount'?'stock':'sales'))setView(target)});
 $('loginForm').onsubmit=signIn;$('kvLoginButton').onclick=signIn;$('profileButton').onclick=()=>setView('more');window.addEventListener('online',()=>{state.online=true;toast('Online. Pending sales may be safely retried from the Offline Queue.');backgroundInventoryPoll()});window.addEventListener('offline',()=>{state.online=false;toast('Offline. New sales can be queued locally.')});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stopScan()});}
try{
 initialEvents();
 window.__kvOwnerBooted=true;
 const kvBootNotice=document.getElementById('kvBootNotice');
 if(kvBootNotice)kvBootNotice.style.display='none';
 loginRestore();
}catch(kvInitError){
 if(window.__kvBootDiagnostic)window.__kvBootDiagnostic(kvInitError&&kvInitError.message||String(kvInitError));
}
let lastInventoryPoll=0;
async function backgroundInventoryPoll(){
 if(!state.token||document.hidden||!navigator.onLine||state.pending.length)return;
 if(Date.now()-lastInventoryPoll<45000)return;
 lastInventoryPoll=Date.now();
 try{state.syncing=true;const [products,status]=await Promise.all([call('products'),call('syncStatus')]);state.products=products.map(x=>Object.assign({},x,{icon:kvCategoryIconSafe(x.category,x.icon)}));state.lastSynced=status.confirmedAt;state.serverPending=status.pendingServerRequests||0;state.syncing=false;
   if(['home','products','inventory'].includes(state.screen))render();
 }catch(e){state.syncFailure=true;state.syncing=false;}
}
setInterval(backgroundInventoryPoll,45000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)backgroundInventoryPoll()});
})();
