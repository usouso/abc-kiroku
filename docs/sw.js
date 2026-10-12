const CACHE='abc-kiroku-202610120610';
const FILES=['./','index.html','manifest.webmanifest','icon-180.png','icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  if(e.request.mode==='navigate'){
    e.respondWith(caches.open(CACHE).then(c=>{
      const net=fetch(e.request,{cache:'no-store'}).then(res=>{if(res&&res.ok)c.put('./',res.clone());return res;});
      const late=new Promise(r=>setTimeout(r,3000)).then(()=>c.match('./'));
      return Promise.race([net,late]).then(r=>r||net).catch(()=>c.match('./'));
    }));
    return;
  }
  e.respondWith(caches.open(CACHE).then(c=>c.match(e.request,{ignoreSearch:true}).then(hit=>{
    const net=fetch(e.request).then(res=>{if(res&&(res.ok||res.type==='opaque'))c.put(e.request,res.clone());return res;}).catch(()=>hit);
    return hit||net;
  })));
});
