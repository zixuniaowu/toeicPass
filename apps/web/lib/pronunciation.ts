"use client";

const IPA_CACHE_KEY = "toeicpass.ipaCache.v1";
const ipaCache = new Map<string, string | null>();
let cacheLoaded = false;

function normalizeWord(word: string): string {
  return word.toLowerCase().replace(/[^a-z'-]/g, "").trim();
}

function loadCacheFromStorage(): void {
  if (cacheLoaded || typeof window === "undefined") {
    return;
  }
  cacheLoaded = true;
  try {
    const raw = window.localStorage.getItem(IPA_CACHE_KEY);
    if (!raw) {
      return;
    }
    const parsed = JSON.parse(raw) as Record<string, string>;
    Object.entries(parsed).forEach(([key, value]) => {
      if (typeof value === "string" && value.trim().length > 0) {
        ipaCache.set(key, value.trim());
      }
    });
  } catch {
    // Ignore invalid local cache.
  }
}

function persistCacheToStorage(): void {
  if (typeof window === "undefined") {
    return;
  }
  const payload: Record<string, string> = {};
  ipaCache.forEach((value, key) => {
    if (typeof value === "string" && value.length > 0) {
      payload[key] = value;
    }
  });
  try {
    window.localStorage.setItem(IPA_CACHE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage errors in private mode or quota limits.
  }
}

function extractIpa(payload: unknown): string | null {
  if (!Array.isArray(payload) || payload.length === 0) {
    return null;
  }
  const first = payload[0] as { phonetic?: string; phonetics?: Array<{ text?: string }> };
  const phonetics = Array.isArray(first.phonetics) ? first.phonetics : [];
  const fromList = phonetics
    .map((item) => (typeof item.text === "string" ? item.text.trim() : ""))
    .find((text) => text.length > 0);
  const fromTop = typeof first.phonetic === "string" ? first.phonetic.trim() : "";
  const ipa = fromList || fromTop;
  if (!ipa) {
    return null;
  }
  return ipa.startsWith("/") ? ipa : `/${ipa.replace(/^\/|\/$/g, "")}/`;
}

export async function getWordIpa(word: string): Promise<string | null> {
  const normalized = normalizeWord(word);
  if (!normalized) {
    return null;
  }

  loadCacheFromStorage();
  if (ipaCache.has(normalized)) {
    return ipaCache.get(normalized) ?? null;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4500);
  try {
    const response = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(normalized)}`,
      { signal: controller.signal },
    );
    if (!response.ok) {
      ipaCache.set(normalized, null);
      return null;
    }
    const json = (await response.json()) as unknown;
    const ipa = extractIpa(json);
    ipaCache.set(normalized, ipa);
    if (ipa) {
      persistCacheToStorage();
    }
    return ipa;
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}
