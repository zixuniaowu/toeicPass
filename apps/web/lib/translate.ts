const requestCache = new Map<string, Promise<string>>();

type TranslateApiResponse = {
  success?: boolean;
  translation?: string;
};

export async function translateText(
  text: string,
  targetLang: "ja" | "zh-CN",
  sourceLang: "auto" | "en" | "zh-CN" | "ja" = "auto",
): Promise<string> {
  const normalized = String(text ?? "").trim();
  if (!normalized) {
    return "";
  }

  const cacheKey = `${sourceLang}:${targetLang}:${normalized}`;
  const cached = requestCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const request = (async () => {
    try {
      const response = await fetch("/api/translate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: normalized,
          targetLang,
          sourceLang,
        }),
      });
      if (!response.ok) {
        return normalized;
      }
      const payload = (await response.json()) as TranslateApiResponse;
      const translation = String(payload.translation ?? "").trim();
      return translation || normalized;
    } catch {
      return normalized;
    }
  })();

  requestCache.set(cacheKey, request);
  const resolved = await request;
  if (!resolved || resolved.trim().toLowerCase() === normalized.toLowerCase()) {
    requestCache.delete(cacheKey);
  }
  return resolved;
}
