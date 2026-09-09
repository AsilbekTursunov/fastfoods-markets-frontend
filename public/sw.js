/* FastFood Markets service worker.
 *
 * Rules, in order of importance:
 *   1. Never get in the way while the user is online. Pages and API calls are
 *      network-first, so fresh data always wins and nothing is delayed.
 *   2. Offline, fall back to whatever was already fetched: the app shell plus
 *      the last successful GET of each API endpoint (orders, products, …).
 *   3. Never touch anything that changes data (POST/PUT/PATCH/DELETE) and never
 *      touch other origins.
 */

const VERSION = 'v1'
const SHELL_CACHE = `ffm-shell-${VERSION}`
const API_CACHE = `ffm-api-${VERSION}`
const KEEP = [SHELL_CACHE, API_CACHE]

/** Enough to boot the app with no network at all. */
const SHELL_URLS = ['/', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) =>
      // one bad URL must not fail the whole install
      Promise.all(SHELL_URLS.map((url) => cache.add(url).catch(() => {}))),
    ),
  )
  // no skipWaiting(): a new version waits until the page asks for it, so an
  // open dashboard is never reloaded from under the user
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('ffm-') && !KEEP.includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('message', (event) => {
  const data = event.data
  if (data === 'SKIP_WAITING' || data?.type === 'SKIP_WAITING') self.skipWaiting()
})

/** Copy a response, adding the headers the app uses to tell fresh from cached. */
async function tag(response, extra) {
  const body = await response.blob()
  const headers = new Headers(response.headers)
  Object.entries(extra).forEach(([k, v]) => headers.set(k, v))
  return new Response(body, { status: response.status, statusText: response.statusText, headers })
}

async function networkFirstApi(request) {
  const cache = await caches.open(API_CACHE)
  try {
    const fresh = await fetch(request)
    if (fresh.ok) {
      const stamped = await tag(fresh.clone(), { 'X-Cached-At': new Date().toISOString() })
      cache.put(request, stamped).catch(() => {})
    }
    return fresh
  } catch (err) {
    const cached = await cache.match(request)
    if (cached) return tag(cached, { 'X-From-Cache': '1' })
    throw err
  }
}

async function networkFirstPage(request) {
  const cache = await caches.open(SHELL_CACHE)
  try {
    const fresh = await fetch(request)
    if (fresh.ok) cache.put(request, fresh.clone()).catch(() => {})
    return fresh
  } catch (err) {
    // any in-app route falls back to the cached shell; the router takes it from there
    const cached = (await cache.match(request)) || (await cache.match('/'))
    if (cached) return cached
    throw err
  }
}

/** Hashed build assets never change under the same name: serve from cache, refill in the background. */
async function cacheFirst(request) {
  const cache = await caches.open(SHELL_CACHE)
  const cached = await cache.match(request)
  if (cached) {
    fetch(request)
      .then((fresh) => fresh.ok && cache.put(request, fresh))
      .catch(() => {})
    return cached
  }
  const fresh = await fetch(request)
  if (fresh.ok) cache.put(request, fresh.clone()).catch(() => {})
  return fresh
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return // uploads, CDNs, Telegram — leave alone

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstPage(request))
    return
  }

  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstApi(request))
    return
  }

  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/') || url.pathname === '/manifest.webmanifest') {
    event.respondWith(cacheFirst(request))
  }
})
