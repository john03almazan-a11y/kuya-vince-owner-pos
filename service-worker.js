/* Kuya Vince PWA: strictly public static-file cache. Never cache sessions, bridge messages or Sheets data. */
'use strict';
const VERSION='kv-owner-static-v12-5-0';
const CORE=['./','./index.html','./app.js','./bridge.js','./camera-modal.js','./pwa.js','./manifest.webmanifest','./assets/brand-logo.webp','./assets/app-icon-192.png','./assets/app-icon-512.png'];
self.addEventListener('install',event=>{
  event.waitUntil((async()=>{const cache=await caches.open(VERSION);await cache.addAll(CORE);await self.skipWaiting();})());
});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{const names=await caches.keys();await Promise.all(names.filter(x=>x.startsWith('kv-owner-static-')&&x!==VERSION).map(x=>caches.delete(x)));await self.clients.claim();})());
});
const STATIC=new Set(CORE.map(x=>new URL(x,self.registration.scope).pathname));
self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET'||req.mode==='no-cors')return;
  const u=new URL(req.url);
  if(u.origin!==self.location.origin||!u.pathname.startsWith(new URL(self.registration.scope).pathname))return;
  if(!STATIC.has(u.pathname)||u.searchParams.has('view')||u.searchParams.has('token'))return;
  // Network first: deployments and bug fixes supersede cached files.
  event.respondWith((async()=>{const cache=await caches.open(VERSION);
    try{const res=await fetch(req,{cache:'no-store'});if(res.ok&&res.type==='basic')await cache.put(req,res.clone());return res;}
    catch(err){const fallback=await cache.match(req,{ignoreSearch:true})||await cache.match(new URL(u.pathname,self.location.origin).toString());if(fallback)return fallback;throw err;}
  })());
});
