import type { Plugin } from 'vite';
export function offlinePlugin(): Plugin {
  return {
    name: 'waxppu-offline',
    apply: 'build',
    generateBundle(_options, bundle) {
      const shell = [
        '/index.html',
        '/favicon.svg',
        '/icon-192.png',
        '/icon-512.png',
        '/manifest.webmanifest',
        ...Object.values(bundle)
          .filter((file) => file.fileName.startsWith('assets/index-'))
          .map((file) => '/' + file.fileName),
      ];
      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: `
const CACHE = 'waxppu-v2-${Date.now()}';
const SHELL = ${JSON.stringify(shell)};
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL))));
self.addEventListener('activate', event => event.waitUntil((async () => {
  for (const key of await caches.keys()) if (key.startsWith('waxppu-v2-') && key !== CACHE) await caches.delete(key);
  await self.clients.claim();
})()));
self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(async () => (await caches.open(CACHE)).match('/index.html')));
    return;
  }
  if (!url.pathname.startsWith('/assets/') && !SHELL.includes(url.pathname)) return;
  event.respondWith((async () => {
    // Same-origin static files do not vary by Origin; preview servers may send Vary: Origin.
    const cache = await caches.open(CACHE), hit = await cache.match(request, { ignoreVary: true });
    if (hit) return hit;
    const response = await fetch(request);
    if (response.ok) {
      try {
        await cache.put(request, response.clone());
        const keys = await cache.keys();
        const runtime = keys.filter(key => !SHELL.includes(new URL(key.url).pathname));
        for (const key of runtime.slice(0, Math.max(0, runtime.length - 60))) await cache.delete(key);
      } catch {} // full/blocked storage does not break playback
    }
    return response;
  })());
});
`,
      });
    },
  };
}
