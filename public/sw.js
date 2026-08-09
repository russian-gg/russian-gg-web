/*
 * The service worker. Deliberately small.
 *
 * Its job is to make the app installable and to survive a bad connection — not to be a cache
 * layer. A service worker that gets this wrong pins a broken version of the product onto a
 * phone with no way for the learner to clear it, which is far worse than any load time it
 * could have saved. So the rules here are the conservative ones:
 *
 *   - Pages are fetched from the network first. A new deploy is live on the next navigation;
 *     the cached copy is only ever reached when the network is not.
 *   - Built assets are served from the cache first, which is safe because their filenames
 *     contain a hash of their contents — a changed file is a different URL.
 *   - Nothing else is touched. The API, media and the admin panel go straight to the network,
 *     always, so no answer about a learner's progress or payment can come from a cache.
 */
const SHELL = 'rgg-shell'
const ASSETS = 'rgg-assets'

/** The offline fallback, and the only page kept by hand. */
const SHELL_URL = '/index.html'

/**
 * Old chunks accumulate across deploys and nothing here knows which are still in use, so the
 * cache is bounded instead: past this many entries the oldest are dropped. Generous enough to
 * hold a whole version of the app, small enough that a phone never loses real storage to us.
 */
const ASSET_LIMIT = 80

self.addEventListener('install', (event) => {
  // Ready on first load, so an install that happens straight away still has a shell to open.
  event.waitUntil(caches.open(SHELL).then((cache) => cache.add(SHELL_URL)))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((name) => name !== SHELL && name !== ASSETS).map((name) => caches.delete(name))))
      // Takes over open tabs rather than waiting for every one of them to close.
      .then(() => self.clients.claim()),
  )
})

/** Anything that must never be answered from a cache, however old. */
function isOffLimits(url) {
  return (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/media/') ||
    url.pathname.startsWith('/admin')
  )
}

async function trim(cache) {
  const keys = await cache.keys()
  if (keys.length <= ASSET_LIMIT) return

  await Promise.all(keys.slice(0, keys.length - ASSET_LIMIT).map((key) => cache.delete(key)))
}

self.addEventListener('fetch', (event) => {
  const { request } = event

  // Only plain reads. A POST is never replayed from here.
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin || isOffLimits(url)) return

  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request)

          // Keep the freshest shell for the next time there is no network.
          const cache = await caches.open(SHELL)
          await cache.put(SHELL_URL, response.clone())

          return response
        } catch {
          return (await caches.match(SHELL_URL)) ?? Response.error()
        }
      })(),
    )

    return
  }

  // Hashed filenames only: a changed build is a different URL, so this can never go stale.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request)
        if (cached) return cached

        const response = await fetch(request)

        if (response.ok) {
          const cache = await caches.open(ASSETS)
          await cache.put(request, response.clone())
          await trim(cache)
        }

        return response
      })(),
    )
  }
})
