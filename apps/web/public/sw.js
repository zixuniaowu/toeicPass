/**
 * sw.js — Service Worker for LangBoost / toeicPass
 *
 * Capabilities:
 *  1. Pre-cache static app shell (HTML, CSS, JS bundles)
 *  2. Audio file pre-caching: intercepts fetch for audio assets and stores
 *     them in the AUDIO_CACHE so shadowing works offline
 *  3. Cache-first strategy for audio; network-first for API calls
 *  4. Stale-while-revalidate for static assets
 *
 * Registration: call `registerServiceWorker()` from a client component.
 */

const APP_SHELL_CACHE = "lb-shell-v1";
const AUDIO_CACHE = "lb-audio-v1";
const API_CACHE = "lb-api-v1";

/** Audio file extensions to cache offline. */
const AUDIO_EXTENSIONS = [".mp3", ".ogg", ".wav", ".webm", ".m4a", ".aac"];

/** API paths to cache with short TTL (stale-while-revalidate). */
const API_CACHE_PATHS = [
  "/api/v1/vocab",
  "/api/v1/practice/recommendations",
  "/api/v1/analytics/overview",
];

/** Static shell assets to pre-cache on install. */
const PRECACHE_URLS = [
  "/",
  // Next.js builds use content-hashed filenames; we skip those here and
  // rely on the stale-while-revalidate handler for dynamic chunks.
];

// ── Install ───────────────────────────────────────────────────────────────────

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(APP_SHELL_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

// ── Activate ──────────────────────────────────────────────────────────────────

self.addEventListener("activate", (event) => {
  const allowedCaches = [APP_SHELL_CACHE, AUDIO_CACHE, API_CACHE];
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => !allowedCaches.includes(name))
            .map((name) => caches.delete(name)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// ── Fetch ─────────────────────────────────────────────────────────────────────

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // 1. Audio files → cache-first (offline shadowing support)
  if (isAudioRequest(url)) {
    event.respondWith(audioCacheFirst(event.request));
    return;
  }

  // 2. API GET requests → stale-while-revalidate with short TTL
  if (url.pathname.startsWith("/api/") && event.request.method === "GET") {
    if (API_CACHE_PATHS.some((p) => url.pathname.startsWith(p))) {
      event.respondWith(staleWhileRevalidate(event.request, API_CACHE, 60));
      return;
    }
    // Other API calls: network-only (mutations, sensitive data)
    return;
  }

  // 3. Same-origin static assets → stale-while-revalidate
  if (url.origin === self.location.origin && event.request.method === "GET") {
    event.respondWith(staleWhileRevalidate(event.request, APP_SHELL_CACHE, 3600));
  }
});

// ── Message: pre-cache audio URLs ─────────────────────────────────────────────

/**
 * The web app can post `{ type: 'PRECACHE_AUDIO', urls: string[] }` messages
 * to proactively cache audio files before a shadowing session begins.
 */
self.addEventListener("message", (event) => {
  if (event.data?.type === "PRECACHE_AUDIO") {
    const urls = Array.isArray(event.data.urls) ? event.data.urls : [];
    event.waitUntil(precacheAudio(urls));
  }
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function isAudioRequest(url) {
  return AUDIO_EXTENSIONS.some(
    (ext) => url.pathname.endsWith(ext) || url.searchParams.has("audio"),
  );
}

async function audioCacheFirst(request) {
  const cache = await caches.open(AUDIO_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response("Audio unavailable offline", { status: 503 });
  }
}

async function staleWhileRevalidate(request, cacheName, maxAgeSec) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const fetchAndUpdate = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);

  if (cached) {
    // Check age via Date header
    const dateHeader = cached.headers.get("date");
    const ageMs = dateHeader
      ? Date.now() - new Date(dateHeader).getTime()
      : Infinity;

    if (ageMs < maxAgeSec * 1000) {
      return cached;
    }
    // Stale: return cached immediately, revalidate in background
    fetchAndUpdate;
    return cached;
  }

  return (await fetchAndUpdate) ?? new Response("Network error", { status: 503 });
}

async function precacheAudio(urls) {
  const cache = await caches.open(AUDIO_CACHE);
  await Promise.allSettled(
    urls.map(async (url) => {
      const exists = await cache.match(url);
      if (!exists) {
        try {
          const response = await fetch(url);
          if (response.ok) await cache.put(url, response);
        } catch {
          // Ignore individual failures during pre-caching
        }
      }
    }),
  );
}
