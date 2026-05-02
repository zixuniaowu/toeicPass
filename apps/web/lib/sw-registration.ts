/**
 * Service Worker registration and audio pre-caching utilities.
 *
 * Call `registerServiceWorker()` once at app startup (e.g. in layout.tsx).
 * Call `precacheAudioUrls(urls)` before a shadowing session begins to warm
 * the audio cache so the session can work offline.
 */

/** Register the service worker (no-op in non-browser / development hot-reload). */
export async function registerServiceWorker(): Promise<void> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  try {
    const registration = await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
    });
    if (registration.installing) {
      console.info("[SW] Installing service worker…");
    } else if (registration.waiting) {
      console.info("[SW] Service worker waiting for activation.");
    } else if (registration.active) {
      console.info("[SW] Service worker active.");
    }
  } catch (err) {
    console.warn("[SW] Registration failed:", err);
  }
}

/**
 * Send a list of audio URLs to the service worker for pre-caching.
 * Safe to call before the SW is fully activated — the message will queue.
 */
export async function precacheAudioUrls(urls: string[]): Promise<void> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  const sw = navigator.serviceWorker.controller;
  if (!sw) return;
  sw.postMessage({ type: "PRECACHE_AUDIO", urls });
}

/** Remove all audio entries from the offline cache. */
export async function clearAudioCache(): Promise<void> {
  if (typeof window === "undefined" || !("caches" in window)) return;
  try {
    await caches.delete("lb-audio-v1");
  } catch {
    // Best-effort
  }
}
