/**
 * @toeicpass/word-annotation/react — React hook adapter
 *
 * Wraps WordAnnotationEngine in a React hook that triggers re-renders
 * whenever the annotation cache updates.
 *
 * Usage:
 *   import { useWordAnnotation } from "@toeicpass/word-annotation/react";
 *
 *   const annotation = useWordAnnotation({
 *     trainingLanguage: "en",
 *     uiLang: "ja",
 *     translate: (text, targetLang) => fetch("/api/translate", { ... }),
 *     getReading: (text) => fetch("/api/japanese-reading", { ... }),
 *   });
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { WordAnnotationEngine } from "../engine";
import type { WordAnnotationOptions, WordAnnotation, JapaneseReadingToken, AnnotationState } from "../types";

export type UseWordAnnotationReturn = {
  /** Fetch & cache translation for a full sentence (Japanese UI, English training) */
  ensureJaSentenceTranslation: (
    materialId: string,
    sentenceId: number,
    sentence: { text: string; translation?: string },
  ) => void;
  /** Get translated sentence for display */
  getSentenceTranslation: (
    materialId: string,
    sentenceId: number,
    sentence: { text: string; translation?: string; translationEn?: string },
  ) => string;
  /** Get secondary translation */
  getSecondaryTranslation: (sentence: { translation?: string; translationEn?: string }) => string;
  /** Fetch gloss for a word when UI is Japanese and training language is English */
  ensureJaWordGloss: (word: WordAnnotation) => void;
  /** Fetch gloss for a word when training language is Japanese */
  ensureJapaneseWordGloss: (word: WordAnnotation) => void;
  /** Fetch furigana reading for a Japanese word */
  ensureJapaneseWordReading: (word: WordAnnotation) => void;
  /** Fetch per-token furigana for a full sentence */
  ensureSentenceTokens: (text: string) => void;
  /** Get cached sentence tokens */
  getSentenceTokens: (text: string) => JapaneseReadingToken[] | null;
  /** Get cached gloss for a word */
  getWordGloss: (word: WordAnnotation) => string | null;
  /** Get cached furigana reading for a word */
  getJapaneseWordReading: (word: WordAnnotation) => string | null;
  /** Tokenize a sentence into annotatable word objects */
  getAnnotatedWords: (text: string) => WordAnnotation[];
};

export function useWordAnnotation(options: WordAnnotationOptions): UseWordAnnotationReturn {
  // Keep a stable engine instance — recreate only when language settings change
  const engineRef = useRef<WordAnnotationEngine | null>(null);
  const [, forceUpdate] = useState(0);

  // Build (or rebuild) the engine when options change
  const { trainingLanguage, uiLang, translate, getReading, getGloss } = options;
  if (!engineRef.current) {
    engineRef.current = new WordAnnotationEngine({ trainingLanguage, uiLang, translate, getReading, getGloss });
  }

  // Wire up state-change → React re-render
  useEffect(() => {
    const engine = engineRef.current!;
    engine.onStateChange = (_state: AnnotationState) => forceUpdate((n) => n + 1);
    return () => { engine.onStateChange = undefined; };
  }, []);

  // Recreate engine when core options change
  useEffect(() => {
    engineRef.current = new WordAnnotationEngine({ trainingLanguage, uiLang, translate, getReading, getGloss });
    engineRef.current.onStateChange = (_state: AnnotationState) => forceUpdate((n) => n + 1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trainingLanguage, uiLang]);

  const engine = engineRef.current;

  const ensureJaSentenceTranslation = useCallback(
    (materialId: string, sentenceId: number, sentence: { text: string; translation?: string }) =>
      engine.ensureJaSentenceTranslation(materialId, sentenceId, sentence),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [engine],
  );

  const getSentenceTranslation = useCallback(
    (materialId: string, sentenceId: number, sentence: { text: string; translation?: string; translationEn?: string }) =>
      engine.getSentenceTranslation(materialId, sentenceId, sentence),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [engine],
  );

  const getSecondaryTranslation = useCallback(
    (sentence: { translation?: string; translationEn?: string }) =>
      engine.getSecondaryTranslation(sentence),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [engine],
  );

  const ensureJaWordGloss = useCallback(
    (word: WordAnnotation) => engine.ensureJaWordGloss(word),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [engine],
  );

  const ensureJapaneseWordGloss = useCallback(
    (word: WordAnnotation) => engine.ensureJapaneseWordGloss(word),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [engine],
  );

  const ensureJapaneseWordReading = useCallback(
    (word: WordAnnotation) => engine.ensureJapaneseWordReading(word),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [engine],
  );

  const ensureSentenceTokens = useCallback(
    (text: string) => engine.ensureSentenceTokens(text),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [engine],
  );

  const getSentenceTokens = useCallback(
    (text: string) => engine.getSentenceTokens(text),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [engine],
  );

  const getWordGloss = useCallback(
    (word: WordAnnotation) => engine.getWordGloss(word),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [engine],
  );

  const getJapaneseWordReading = useCallback(
    (word: WordAnnotation) => engine.getJapaneseWordReading(word),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [engine],
  );

  const getAnnotatedWords = useCallback(
    (text: string) => engine.tokenize(text),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [engine],
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
    getWordGloss,
    getJapaneseWordReading,
    getAnnotatedWords,
  };
}
