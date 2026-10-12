// app.html(アーティファクト用の断片)から、iPhone のホーム画面に置ける PWA 一式を docs/ に作る(GitHub Pages が docs/ を配信)
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const root = __dirname;
const out = path.join(root, 'docs');
fs.mkdirSync(out, { recursive: true });

const src = fs.readFileSync(path.join(root, 'app.html'), 'utf8');
const title = (src.match(/<title>[\s\S]*?<\/title>/) || [''])[0];
const style = (src.match(/<style>[\s\S]*?<\/style>/) || [''])[0];
const fontLink = (src.match(/<link rel="stylesheet"[^>]*>/) || [''])[0];
const VERSION = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12);
const body = src.replace(title, '').replace(style, '').replace(fontLink, '')
  .replace("var APP_VERSION='プレビュー版';", `var APP_VERSION='${VERSION}';`).trim();

const html = `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
${title}
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="ABC記録">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="theme-color" content="#F2F4F6" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#11161B" media="(prefers-color-scheme: dark)">
<link rel="manifest" href="manifest.webmanifest">
<link rel="apple-touch-icon" href="icon-180.png">
<style>
:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}
body{margin:0;font:14px/1.5 system-ui,sans-serif}
img{max-width:100%}
[hidden]{display:none!important}
</style>
${fontLink}
${style}
</head>
<body>
${body}
<script>
if('serviceWorker' in navigator){navigator.serviceWorker.register('sw.js').catch(function(){});}
</script>
</body>
</html>
`;
fs.writeFileSync(path.join(out, 'index.html'), html);

fs.writeFileSync(path.join(out, 'manifest.webmanifest'), JSON.stringify({
  name: 'ABC記録ノート',
  short_name: 'ABC記録',
  lang: 'ja',
  start_url: './',
  scope: './',
  display: 'standalone',
  background_color: '#F2F4F6',
  theme_color: '#2C679A',
  icons: [
    { src: 'icon-180.png', sizes: '180x180', type: 'image/png' },
    { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
  ]
}, null, 2));

// ページ本体はネット優先(つながれば最新版、3秒で応答がなければキャッシュ)。それ以外はキャッシュ優先+裏で更新
fs.writeFileSync(path.join(out, 'sw.js'), `const CACHE='abc-kiroku-${VERSION}';
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
`);

// アイコン:青地に A→B→C の3つの丸
function png(size) {
  const bg = [0x2C, 0x67, 0x9A], fg = [255, 255, 255];
  const raw = Buffer.alloc((size * 4 + 1) * size);
  const r = size * 0.105, cy = size * 0.5, xs = [0.24, 0.5, 0.76].map(v => v * size);
  const lineH = size * 0.022;
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      let a = 0;
      for (let sy = 0; sy < 4; sy++) for (let sx = 0; sx < 4; sx++) {
        const px = x + (sx + 0.5) / 4, py = y + (sy + 0.5) / 4;
        let hit = xs.some(cx => (px - cx) ** 2 + (py - cy) ** 2 <= r * r);
        if (!hit && Math.abs(py - cy) <= lineH && px > xs[0] && px < xs[2]) hit = true;
        if (hit) a++;
      }
      const t = a / 16, o = y * (size * 4 + 1) + 1 + x * 4;
      for (let k = 0; k < 3; k++) raw[o + k] = Math.round(bg[k] * (1 - t) + fg[k] * t);
      raw[o + 3] = 255;
    }
  }
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = buf => { let c = 0xFFFFFFFF; for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
fs.writeFileSync(path.join(out, 'icon-180.png'), png(180));
fs.writeFileSync(path.join(out, 'icon-512.png'), png(512));

console.log('built docs/ version', VERSION);
