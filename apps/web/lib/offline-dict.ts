/**
 * Offline dictionary loader — lazy chunk loading
 *
 * Words are served from /public/dict/ as pre-built JSON chunks.
 * Each chunk is loaded on-demand when a word with that initial letter/kana is looked up.
 *
 * English: /dict/en/a.json, /dict/en/b.json ... /dict/en/z.json
 * Japanese: /dict/ja/a.json (あ行), /dict/ja/k.json (か行) ... /dict/ja/kanji.json
 *
 * Chunk format: Record<string, { cn: string; ipa?: string; kana?: string }>
 *
 * Build the chunks with:
 *   node apps/web/scripts/build-en-dict.mjs ecdict.csv apps/web/public/dict/en
 *   node apps/web/scripts/build-ja-dict.mjs jmdict-eng.json apps/web/public/dict/ja
 */

type DictEntry = {
  cn: string;
  ipa?: string;
  kana?: string;
};

// In-memory chunk cache: chunkUrl → loaded data
const chunkCache = new Map<string, Record<string, DictEntry>>();
// In-flight fetch dedup: chunkUrl → promise
const chunkFetching = new Map<string, Promise<Record<string, DictEntry>>>();

async function loadChunk(url: string): Promise<Record<string, DictEntry>> {
  const cached = chunkCache.get(url);
  if (cached) return cached;

  const inflight = chunkFetching.get(url);
  if (inflight) return inflight;

  const promise = fetch(url)
    .then((r) => {
      if (!r.ok) return {} as Record<string, DictEntry>;
      return r.json() as Promise<Record<string, DictEntry>>;
    })
    .then((data) => {
      chunkCache.set(url, data);
      chunkFetching.delete(url);
      return data;
    })
    .catch(() => {
      chunkFetching.delete(url);
      return {} as Record<string, DictEntry>;
    });

  chunkFetching.set(url, promise);
  return promise;
}

// ── English dictionary ────────────────────────────────────────────────────────

function enChunkUrl(word: string): string | null {
  const first = word[0]?.toLowerCase();
  if (!first || !/^[a-z]$/.test(first)) return null;
  return `/dict/en/${first}.json`;
}

/**
 * Look up an English word in the offline dictionary.
 * Returns null if the word is not found or the chunk has not loaded yet.
 * Call this after `prefetchEnChunk(word)` to warm the cache.
 */
export function lookupEnWord(word: string): DictEntry | null {
  const clean = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!clean) return null;
  const url = enChunkUrl(clean);
  if (!url) return null;
  const chunk = chunkCache.get(url);
  if (!chunk) return null;
  return chunk[clean] ?? null;
}

/**
 * Asynchronously look up an English word, loading the chunk if necessary.
 */
export async function lookupEnWordAsync(word: string): Promise<DictEntry | null> {
  const clean = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!clean) return null;
  const url = enChunkUrl(clean);
  if (!url) return null;
  const chunk = await loadChunk(url);
  return chunk[clean] ?? null;
}

/**
 * Pre-warm the chunk for a word (fire & forget).
 * Call this when displaying a sentence so the chunk is ready before the user hovers.
 */
export function prefetchEnChunk(word: string): void {
  const clean = word.toLowerCase().replace(/[^a-z]/g, "");
  const url = enChunkUrl(clean);
  if (url && !chunkCache.has(url)) void loadChunk(url);
}

// ── Japanese dictionary ───────────────────────────────────────────────────────

const KANA_ROWS: Array<[string, string]> = [
  ["あいうえおぁぃぅぇぉ", "a"],
  ["かきくけこがぎぐげご", "k"],
  ["さしすせそざじずぜぞ", "s"],
  ["たちつてとだぢづでどっ", "t"],
  ["なにぬねの", "n"],
  ["はひふへほばびぶべぼぱぴぷぺぽ", "h"],
  ["まみむめも", "m"],
  ["やゆよゃゅょ", "y"],
  ["らりるれろ", "r"],
  ["わをんゎゐゑ", "w"],
];

function containsKanji(text: string): boolean {
  return /[\u4e00-\u9fff\u3400-\u4dbf]/.test(text);
}

function jaChunkKey(word: string): string {
  if (containsKanji(word)) return "kanji";
  const first = word[0];
  if (!first) return "misc";
  for (const [chars, label] of KANA_ROWS) {
    if (chars.includes(first)) return label;
  }
  return "misc";
}

function jaChunkUrl(word: string): string {
  return `/dict/ja/${jaChunkKey(word)}.json`;
}

/**
 * Look up a Japanese word in the offline dictionary (sync, from cache).
 */
export function lookupJaWord(word: string): DictEntry | null {
  if (!word) return null;
  const url = jaChunkUrl(word);
  const chunk = chunkCache.get(url);
  if (!chunk) return null;
  return chunk[word] ?? null;
}

/**
 * Asynchronously look up a Japanese word, loading the chunk if necessary.
 */
export async function lookupJaWordAsync(word: string): Promise<DictEntry | null> {
  if (!word) return null;
  const url = jaChunkUrl(word);
  const chunk = await loadChunk(url);
  return chunk[word] ?? null;
}

/**
 * Pre-warm the Japanese dictionary chunk for a word.
 */
export function prefetchJaChunk(word: string): void {
  const url = jaChunkUrl(word);
  if (!chunkCache.has(url)) void loadChunk(url);
}

// ── Combined lookup ───────────────────────────────────────────────────────────

/**
 * Look up a word in the appropriate offline dictionary based on language.
 * Always resolves (returns null on miss). Loads the chunk as needed.
 */
export async function lookupWordAsync(
  word: string,
  language: "en" | "ja",
): Promise<{ cn: string; ipa?: string; kana?: string } | null> {
  return language === "ja"
    ? lookupJaWordAsync(word)
    : lookupEnWordAsync(word);
}

/**
 * Pre-warm the dictionary chunk for a word.
 */
export function prefetchWord(word: string, language: "en" | "ja"): void {
  if (language === "ja") prefetchJaChunk(word);
  else prefetchEnChunk(word);
}
