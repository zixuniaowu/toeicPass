/**
 * @toeicpass/word-annotation — Core types
 *
 * Framework-agnostic. Safe to import in browser extensions, CLI, and any JS/TS environment.
 */

// ── Language types ────────────────────────────────────────────────────────────

/** The language the learner is currently practising */
export type TrainingLanguage = "en" | "ja";

/** The language used in the application UI */
export type UiLang = "zh" | "ja" | "en";

// ── Word annotation ───────────────────────────────────────────────────────────

/** A single annotated word token */
export type WordAnnotation = {
  word: string;
  clean: string;
  cn: string | null;
  ipa: string | null;
};

/** One kanji/kana token with optional furigana reading */
export type JapaneseReadingToken = {
  surface: string;
  reading: string | null;
  hasKanji: boolean;
};

// ── API adapters (pluggable) ──────────────────────────────────────────────────

/**
 * Translation adapter — implement this to connect to any translation backend.
 * For browser extension use, you can call the Chrome extension messaging API.
 * For web apps, call your own `/api/translate` endpoint.
 */
export type TranslateAdapter = (
  text: string,
  targetLang: "ja" | "zh-CN",
  sourceLang?: "auto" | "en" | "zh-CN" | "ja",
) => Promise<string>;

/**
 * Japanese reading adapter — returns per-token furigana for a sentence.
 * Implement using MeCab, kuromoji, or any morphological analyzer API.
 */
export type JapaneseReadingAdapter = (text: string) => Promise<{
  readingText: string;
  tokens: JapaneseReadingToken[];
}>;

/**
 * Word gloss adapter — returns a brief translation/gloss for a single word.
 * Return null or empty string when no gloss is available.
 */
export type WordGlossAdapter = (
  word: string,
  targetLang: "zh-CN" | "ja",
) => Promise<string | null>;

// ── Annotation engine options ─────────────────────────────────────────────────

export type WordAnnotationOptions = {
  trainingLanguage: TrainingLanguage;
  uiLang: UiLang;
  /** Translation API adapter (required for sentence-level translation) */
  translate?: TranslateAdapter;
  /** Japanese reading/furigana API adapter (required for Japanese furigana) */
  getReading?: JapaneseReadingAdapter;
  /** Word gloss API adapter (optional; falls back to built-in dictionary) */
  getGloss?: WordGlossAdapter;
};

// ── Snapshot of annotation state (what the engine exposes) ───────────────────

export type AnnotationState = {
  /** word → gloss (CN or JA) */
  wordGlossMap: Record<string, string>;
  /** word → furigana reading */
  wordReadingMap: Record<string, string>;
  /** sentence text → per-token furigana */
  sentenceTokensMap: Record<string, JapaneseReadingToken[]>;
  /** `materialId::sentenceId::text` → translated sentence */
  sentenceTranslationMap: Record<string, string>;
};
