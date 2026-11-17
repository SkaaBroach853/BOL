/* Cache only the application shell. API responses always come from the real server. */
const CACHE='bol-shell-20261117';
self.addEventListener('install',event=>event.waitUntil((async()=>{
 const response=await fetch('/',{cache:'reload'});if(!response.ok)throw new Error('App shell unavailable');
 const html=await response.clone().text(),assets=[...html.matchAll(/(?:src|href)="(\/assets\/[^\"]+)"/g)].map(m=>m[1]);
 const cache=await caches.open(CACHE);await cache.put('/',response);await cache.addAll([...new Set(assets),'/favicon.svg']);await self.skipWaiting();
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const name of await caches.keys())if(name.startsWith('bol-shell-')&&name!==CACHE)await caches.delete(name);await self.clients.claim();})()));
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);if(url.origin!==location.origin||url.pathname.startsWith('/api/')||event.request.method!=='GET')return;
 event.respondWith((async()=>{try{const response=await fetch(event.request);if(response.ok&&(event.request.mode==='navigate'||url.pathname.startsWith('/assets/'))){const cache=await caches.open(CACHE);await cache.put(event.request.mode==='navigate'?'/':event.request,response.clone());}return response;}catch{const cache=await caches.open(CACHE),response=await cache.match(event.request.mode==='navigate'?'/':event.request);if(response)return response;return Response.error();}})());
});
