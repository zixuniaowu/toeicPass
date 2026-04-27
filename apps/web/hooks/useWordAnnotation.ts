"use client";
/**
 * useWordAnnotation — 划词翻译模块
 *
 * Manages all word-level and sentence-level annotation state for shadowing practice:
 * - Per-kanji furigana (reading) for Japanese sentences
 * - Word-level gloss (Chinese or Japanese translation) for both EN and JA training
 * - Sentence-level translation for Japanese UI users studying English
 *
 * This is the core of the 划词翻译 feature, extracted from ShadowingView.
 */
import { useState, useCallback, useRef } from "react";
import type { ShadowingMaterial } from "../data/shadowing-materials";
import type { WordAnnotation } from "../data/word-dictionary";
import type { JapaneseReadingToken } from "../lib/japanese-reading";
import type { UiLang } from "../types";
import type { TrainingLanguage } from "../lib/shadowing-utils";
import { containsKanji } from "../lib/shadowing-utils";
import { annotateWords } from "../data/word-dictionary";
import { getJapaneseReading } from "../lib/japanese-reading";
import { translateText } from "../lib/translate";
import { lookupEnWordAsync, lookupJaWordAsync, prefetchWord } from "../lib/offline-dict";

// ── Japanese word tokenizer (for annotated display) ──────────────────────────

function annotateJapaneseWords(sentence: string): WordAnnotation[] {
  const raw = String(sentence ?? "").trim();
  if (!raw) return [];
  const tokens = raw.match(/[ぁ-んァ-ヶ一-龯々ー]+|[A-Za-z0-9']+/g);
  const words = (tokens && tokens.length > 0 ? tokens : [raw]).filter(Boolean);
  return words.map((word) => ({ word, clean: word, cn: null, ipa: null }));
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export type UseWordAnnotationReturn = {
  /** Fetch & cache translation for a full sentence (Japanese UI, English training) */
  ensureJaSentenceTranslation: (
    material: ShadowingMaterial,
    sentence: { id: number; text: string; translation?: string },
  ) => void;
  /** Get translated sentence for display (returns empty string when unavailable) */
  getSentenceTranslation: (
    material: ShadowingMaterial,
    sentence: { id: number; text: string; translation?: string },
  ) => string;
  /** Secondary translation (e.g. Chinese when primary is Japanese) */
  getSecondaryTranslation: (sentence: { id: number; text: string; translation?: string }) => string;
  /** Fetch gloss for a word when UI is Japanese and training language is English */
  ensureJaWordGloss: (word: WordAnnotation) => void;
  /** Fetch gloss for a word when training language is Japanese */
  ensureJapaneseWordGloss: (word: WordAnnotation) => void;
  /** Fetch furigana reading for a Japanese word */
  ensureJapaneseWordReading: (word: WordAnnotation) => void;
  /** Fetch per-kanji furigana tokens for a whole sentence */
  ensureSentenceTokens: (sentenceText: string) => void;
  /** Retrieve cached sentence tokens */
  getSentenceTokens: (sentenceText: string) => JapaneseReadingToken[] | null;
  /**
   * Build a hiragana-only version of the sentence using cached kuromoji tokens.
   * Used as the comparison target for speech recognition (which returns hiragana).
   */
  getSentencePhoneticText: (sentenceText: string) => string;
  /** Get the best available gloss for a word */
  getWordGloss: (word: WordAnnotation) => string | null;
  /** Get furigana reading for a Japanese word */
  getJapaneseWordReading: (word: WordAnnotation) => string | null;
  /** Tokenize a sentence into annotatable words */
  getAnnotatedWords: (text: string) => WordAnnotation[];
};

export function useWordAnnotation(
  trainingLanguage: TrainingLanguage,
  uiLang: UiLang,
): UseWordAnnotationReturn {
  // ── State ────────────────────────────────────────────────────────────────
  const [jpWordGlossMap, setJpWordGlossMap] = useState<Record<string, string>>({});
  const translatingJpWordGlossRef = useRef<Set<string>>(new Set());

  const [jpWordReadingMap, setJpWordReadingMap] = useState<Record<string, string>>({});
  const translatingJpWordReadingRef = useRef<Set<string>>(new Set());

  const [jpSentenceTokensMap, setJpSentenceTokensMap] = useState<
    Record<string, JapaneseReadingToken[]>
  >({});
  const fetchingSentenceTokensRef = useRef<Set<string>>(new Set());

  const [jaSentenceMap, setJaSentenceMap] = useState<Record<string, string>>({});
  const translatingSentenceSetRef = useRef<Set<string>>(new Set());

  const [jaWordGlossMap, setJaWordGlossMap] = useState<Record<string, string>>({});
  const translatingWordGlossRef = useRef<Set<string>>(new Set());

  // ── Key builders ─────────────────────────────────────────────────────────

  const makeSentenceTranslationKey = useCallback(
    (materialId: string, sentenceId: number, text: string) =>
      `${materialId}::${sentenceId}::${text}`,
    [],
  );

  const makeWordGlossKey = useCallback((word: WordAnnotation) => {
    return String(word.clean || word.word || "").toLowerCase().trim();
  }, []);

  // ── Sentence translation (Japanese UI × English training) ─────────────────

  const ensureJaSentenceTranslation = useCallback(
    (
      material: ShadowingMaterial,
      sentence: { id: number; text: string; translation?: string },
    ) => {
      if (uiLang !== "ja" || trainingLanguage !== "en") return;
      const key = makeSentenceTranslationKey(material.id, sentence.id, sentence.text);
      if (jaSentenceMap[key] || translatingSentenceSetRef.current.has(key)) return;
      translatingSentenceSetRef.current.add(key);
      void translateText(sentence.text, "ja", "en")
        .then(async (translated) => {
          let resolved = String(translated ?? "").trim();
          if (!resolved || resolved.toLowerCase() === sentence.text.trim().toLowerCase()) {
            const zhSource = String(sentence.translation ?? "").trim();
            if (zhSource) {
              const fromZh = String(
                await translateText(zhSource, "ja", "zh-CN") ?? "",
              ).trim();
              resolved = fromZh && fromZh !== zhSource ? fromZh : "";
            } else {
              resolved = "";
            }
          }
          if (resolved) setJaSentenceMap((prev) => ({ ...prev, [key]: resolved }));
        })
        .finally(() => {
          translatingSentenceSetRef.current.delete(key);
        });
    },
    [jaSentenceMap, uiLang, makeSentenceTranslationKey, trainingLanguage],
  );

  const getSentenceTranslation = useCallback(
    (
      material: ShadowingMaterial,
      sentence: { id: number; text: string; translation?: string },
    ): string => {
      if (trainingLanguage === "ja") {
        if (uiLang === "en" || uiLang === "ja") {
          return (sentence as { translationEn?: string }).translationEn || sentence.translation || "";
        }
        return sentence.translation ?? "";
      }
      if (uiLang === "zh") return sentence.translation ?? "";
      if (uiLang === "en") return sentence.translation ?? "";
      // Japanese UI studying English: dynamic translation
      const key = makeSentenceTranslationKey(material.id, sentence.id, sentence.text);
      return jaSentenceMap[key] ?? sentence.translation ?? "";
    },
    [jaSentenceMap, uiLang, makeSentenceTranslationKey, trainingLanguage],
  );

  const getSecondaryTranslation = useCallback(
    (sentence: { id: number; text: string; translation?: string }): string => {
      if (trainingLanguage !== "ja") return "";
      // Only show secondary when it differs from the primary (i.e., an English translation exists)
      // Returning the same Chinese text as both primary and secondary creates a duplicate.
      return (sentence as { translationEn?: string }).translationEn || "";
    },
    [trainingLanguage],
  );

  // ── Word gloss (English training, Japanese UI) ───────────────────────────

  const ensureJaWordGloss = useCallback(
    (word: WordAnnotation) => {
      if (uiLang !== "ja" || trainingLanguage !== "en") return;
      const key = makeWordGlossKey(word);
      if (!key || jaWordGlossMap[key] || translatingWordGlossRef.current.has(key)) return;
      translatingWordGlossRef.current.add(key);
      // Pre-warm offline dict chunk
      prefetchWord(key, "en");
      // Try offline dictionary first, fall back to translation API
      void lookupEnWordAsync(key)
        .then(async (entry) => {
          if (entry?.cn) {
            // Have offline CN gloss, but we need JA gloss for ja UI
            // Translate the CN gloss to Japanese
            const fromCn = String(await translateText(entry.cn, "ja", "zh-CN") ?? "").trim();
            return fromCn && fromCn !== entry.cn ? fromCn : entry.cn;
          }
          // No offline entry — call translation API directly
          const translated = String(await translateText(key, "ja", "en") ?? "").trim();
          if (translated && translated.toLowerCase() !== key.toLowerCase()) return translated;
          const zhSource = String(word.cn ?? "").trim();
          if (zhSource) {
            const fromZh = String(await translateText(zhSource, "ja", "zh-CN") ?? "").trim();
            return fromZh && fromZh !== zhSource ? fromZh : "";
          }
          return "";
        })
        .then((resolved) => {
          if (resolved) setJaWordGlossMap((prev) => ({ ...prev, [key]: resolved }));
        })
        .finally(() => {
          translatingWordGlossRef.current.delete(key);
        });
    },
    [jaWordGlossMap, uiLang, makeWordGlossKey, trainingLanguage],
  );

  // ── Word gloss (Japanese training) ───────────────────────────────────────

  const ensureJapaneseWordGloss = useCallback(
    (word: WordAnnotation) => {
      if (trainingLanguage !== "ja") return;
      const key = makeWordGlossKey(word);
      if (!key || jpWordGlossMap[key] || translatingJpWordGlossRef.current.has(key)) return;
      translatingJpWordGlossRef.current.add(key);
      // Pre-warm offline dict chunk while we check
      prefetchWord(key, "ja");
      void lookupJaWordAsync(key)
        .then(async (entry) => {
          // JMDict entries have English definitions in the `cn` field — check if it's actually
          // Chinese (contains CJK characters). If not, always go to the translation API so
          // the gloss shows Chinese (匹配 uiLang = zh/ja users' expectation).
          const offlineDef = String(entry?.cn ?? "").trim();
          const isChinese = offlineDef && /[\u4e00-\u9fff]/.test(offlineDef);
          if (isChinese) return offlineDef;
          // Fall back to translation API for Chinese output
          const translated = String(await translateText(key, "zh-CN", "ja") ?? "").trim();
          if (translated && translated !== key) return translated;
          // Last resort: return whatever the offline dict has (English OK)
          return offlineDef;
        })
        .then((resolved) => {
          if (resolved) setJpWordGlossMap((prev) => ({ ...prev, [key]: resolved }));
        })
        .finally(() => {
          translatingJpWordGlossRef.current.delete(key);
        });
    },
    [jpWordGlossMap, makeWordGlossKey, trainingLanguage],
  );

  // ── Furigana reading ─────────────────────────────────────────────────────

  const ensureJapaneseWordReading = useCallback(
    (word: WordAnnotation) => {
      if (trainingLanguage !== "ja") return;
      if (!containsKanji(word.word)) return;
      const key = makeWordGlossKey(word);
      if (!key || jpWordReadingMap[key] || translatingJpWordReadingRef.current.has(key)) return;
      translatingJpWordReadingRef.current.add(key);
      void getJapaneseReading(key)
        .then((result) => {
          const reading = String(result.readingText ?? "").trim();
          if (reading && reading !== key) {
            setJpWordReadingMap((prev) => ({ ...prev, [key]: reading }));
          }
        })
        .finally(() => {
          translatingJpWordReadingRef.current.delete(key);
        });
    },
    [jpWordReadingMap, makeWordGlossKey, trainingLanguage],
  );

  const ensureSentenceTokens = useCallback(
    (sentenceText: string) => {
      if (trainingLanguage !== "ja") return;
      const key = sentenceText.trim();
      if (!key || jpSentenceTokensMap[key] || fetchingSentenceTokensRef.current.has(key)) return;
      fetchingSentenceTokensRef.current.add(key);
      void getJapaneseReading(key)
        .then((result) => {
          if (result.tokens && result.tokens.length > 0) {
            setJpSentenceTokensMap((prev) => ({ ...prev, [key]: result.tokens }));
          }
        })
        .finally(() => {
          fetchingSentenceTokensRef.current.delete(key);
        });
    },
    [jpSentenceTokensMap, trainingLanguage],
  );

  const getSentenceTokens = useCallback(
    (sentenceText: string): JapaneseReadingToken[] | null => {
      if (trainingLanguage !== "ja") return null;
      return jpSentenceTokensMap[sentenceText.trim()] ?? null;
    },
    [jpSentenceTokensMap, trainingLanguage],
  );

  /**
   * Build a hiragana-only string by substituting kanji tokens with their readings.
   * Speech recognition returns hiragana for kanji words, so comparing against this
   * string avoids false mismatches (e.g. 何名様 → なんめいさま).
   */
  const getSentencePhoneticText = useCallback(
    (sentenceText: string): string => {
      if (trainingLanguage !== "ja") return sentenceText;
      const tokens = jpSentenceTokensMap[sentenceText.trim()];
      if (!tokens || tokens.length === 0) return sentenceText;
      return tokens
        .map((t) => (t.hasKanji && t.reading ? t.reading : t.surface))
        .join("");
    },
    [jpSentenceTokensMap, trainingLanguage],
  );

  // ── Gloss getters ─────────────────────────────────────────────────────────

  const getWordGloss = useCallback(
    (word: WordAnnotation): string | null => {
      if (trainingLanguage === "ja") {
        const key = makeWordGlossKey(word);
        if (!key) return null;
        return jpWordGlossMap[key] ?? null;
      }
      if (uiLang !== "ja") return word.cn ?? null;
      const key = makeWordGlossKey(word);
      if (!key) return word.cn ?? null;
      return jaWordGlossMap[key] ?? word.cn ?? null;
    },
    [jaWordGlossMap, jpWordGlossMap, uiLang, makeWordGlossKey, trainingLanguage],
  );

  const getJapaneseWordReading = useCallback(
    (word: WordAnnotation): string | null => {
      if (trainingLanguage !== "ja") return null;
      const key = makeWordGlossKey(word);
      if (!key) return null;
      return jpWordReadingMap[key] ?? null;
    },
    [jpWordReadingMap, makeWordGlossKey, trainingLanguage],
  );

  const getAnnotatedWords = useCallback(
    (text: string): WordAnnotation[] => {
      if (trainingLanguage === "ja") {
        // Prefer kuromoji token boundaries when available — they're far more accurate
        // than the simple regex fallback used by annotateJapaneseWords.
        const cached = jpSentenceTokensMap[text.trim()];
        if (cached && cached.length > 0) {
          return cached.map((t) => ({ word: t.surface, clean: t.surface, cn: null, ipa: null }));
        }
        return annotateJapaneseWords(text);
      }
      return annotateWords(text);
    },
    [trainingLanguage, jpSentenceTokensMap],
  );

  return {
    ensureJaSentenceTranslation,
    getSentenceTranslation,
    getSecondaryTranslation,
    ensureJaWordGloss,
    ensureJapaneseWordGloss,
    ensureJapaneseWordReading,
    ensureSentenceTokens,
    getSentenceTokens,
    getSentencePhoneticText,
    getWordGloss,
    getJapaneseWordReading,
    getAnnotatedWords,
  };
}
