import { ROUTES, SITE } from "@/config/site";

export const dynamic = "force-static";

/**
 * Service worker, generated at build time so the page list and version stay in sync.
 * - Install: precache every page and the static assets it references (works offline after the first visit).
 * - /_next/static/*: cache-first (content-hashed, immutable).
 * - Pages: network-first, falling back to the cache when offline.
 * - Other files: stale-while-revalidate.
 * A new build has a new version → new cache; old caches are deleted on activate.
 */
export function GET() {
  const base = SITE.basePath;
  const script = `
const VERSION = ${JSON.stringify(SITE.version)};
const CACHE = "ndt-" + VERSION;
const BASE = ${JSON.stringify(base)};
const PAGES = ${JSON.stringify(ROUTES.map((r) => base + r))};
const EXTRA = ${JSON.stringify([`${base}/manifest.webmanifest`, `${base}/icons/icon-192.png`, `${base}/icons/icon-512.png`])};

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    for (const url of PAGES) {
      try {
        const res = await fetch(url, { cache: "no-cache" });
        if (!res.ok) continue;
        await cache.put(url, res.clone());
        const html = await res.text();
        const assets = [...html.matchAll(/(?:src|href)="([^"]*\\/_next\\/static\\/[^"]+)"/g)].map((m) => m[1]);
        await Promise.all([...new Set(assets)].map((a) => cache.add(a).catch(() => undefined)));
      } catch (e) {}
    }
    await Promise.all(EXTRA.map((u) => cache.add(u).catch(() => undefined)));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key.startsWith("ndt-") && key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(BASE + "/")) return;

  if (url.pathname.startsWith(BASE + "/_next/static/")) {
    event.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) caches.open(CACHE).then((c) => c.put(req, res.clone()));
      return res;
    })));
    return;
  }
  if (req.mode === "navigate") {
    event.respondWith(fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    }).catch(async () => (await caches.match(req, { ignoreSearch: true })) || (await caches.match(BASE + "/")) || Response.error()));
    return;
  }
  event.respondWith(caches.match(req, { ignoreSearch: true }).then((hit) => {
    const net = fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => hit || Response.error());
    return hit || net;
  }));
});
`;
  return new Response(script, { headers: { "Content-Type": "application/javascript; charset=utf-8" } });
}
