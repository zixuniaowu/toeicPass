export type JapaneseReadingToken = {
  surface: string;
  reading: string | null;
  hasKanji: boolean;
};

type JapaneseReadingApiResponse = {
  success?: boolean;
  readingText?: string;
  tokens?: JapaneseReadingToken[];
};

type JapaneseReadingResult = {
  readingText: string;
  tokens: JapaneseReadingToken[];
};

const requestCache = new Map<string, Promise<JapaneseReadingResult>>();

export async function getJapaneseReading(text: string): Promise<JapaneseReadingResult> {
  const normalized = String(text ?? "").trim();
  if (!normalized) {
    return {
      readingText: "",
      tokens: [],
    };
  }

  const cached = requestCache.get(normalized);
  if (cached) {
    return cached;
  }

  const request = (async (): Promise<JapaneseReadingResult> => {
    try {
      const response = await fetch("/api/japanese-reading", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: normalized }),
      });
      if (!response.ok) {
        return { readingText: "", tokens: [] };
      }
      const payload = (await response.json()) as JapaneseReadingApiResponse;
      return {
        readingText: String(payload.readingText ?? "").trim(),
        tokens: Array.isArray(payload.tokens) ? payload.tokens : [],
      };
    } catch {
      return { readingText: "", tokens: [] };
    }
  })();

  requestCache.set(normalized, request);
  const resolved = await request;
  if (!resolved.readingText) {
    requestCache.delete(normalized);
  }
  return resolved;
}
