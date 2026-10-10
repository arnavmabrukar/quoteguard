// Network-only customer data: do not cache RFQs, API responses, or quote exports.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', event => {
  if (event.request.mode !== 'navigate') return;
  event.respondWith(fetch(event.request).catch(() => new Response(`<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#f7f8fa"><title>QuoteGuard · Offline</title><style>body{font:16px system-ui,sans-serif;background:#f7f8fa;color:#182230;padding:48px 24px;max-width:440px;margin:auto}img{width:60px;border-radius:14px}h1{font-size:26px;margin-top:32px}p{line-height:1.7;color:#667085}button{background:#2563eb;color:white;padding:14px 20px;border:0;border-radius:10px;font:600 16px system-ui;min-height:48px}</style><h2>QuoteGuard</h2><h1>You’re offline.</h1><p>Your saved quotes are on the server. Reconnect to open the workspace and keep reviewing.</p><button onclick="location.reload()">Try again</button></html>`, {status:503,headers:{'Content-Type':'text/html; charset=utf-8'}})));
});
