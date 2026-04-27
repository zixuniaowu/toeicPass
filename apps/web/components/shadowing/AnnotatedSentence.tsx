"use client";
/**
 * AnnotatedSentence — renders a sentence with per-word or per-kanji annotations.
 *
 * Japanese layout (first-principles):
 *   - Sentence text centered, large, readable
 *   - Furigana as ruby annotations inline above kanji (when showReading)
 *   - Word glosses in a separate grid below the sentence (when showWordTranslation)
 *   - IPA for English displayed inline below each word
 */
import type { WordAnnotation } from "../../data/word-dictionary";
import type { JapaneseReadingToken } from "../../lib/japanese-reading";
import type { TrainingLanguage } from "../../lib/shadowing-utils";
import { containsKanji } from "../../lib/shadowing-utils";
import styles from "./AnnotatedSentence.module.css";

type Props = {
  text: string;
  trainingLanguage: TrainingLanguage;
  showReading: boolean;
  showIPA: boolean;
  showWordTranslation: boolean;
  words: WordAnnotation[];
  sentenceTokens: JapaneseReadingToken[] | null;
  getWordGloss: (word: WordAnnotation) => string | null;
  getJapaneseWordReading: (word: WordAnnotation) => string | null;
};

export function AnnotatedSentence({
  text,
  trainingLanguage,
  showReading,
  showIPA,
  showWordTranslation,
  words,
  sentenceTokens,
  getWordGloss,
  getJapaneseWordReading,
}: Props) {
  // ── Japanese ─────────────────────────────────────────────────────────────
  if (trainingLanguage === "ja") {
    // Prefer sentence-level token stream for ruby furigana (accurate per-kanji)
    const hasSentenceTokens = sentenceTokens && sentenceTokens.length > 0;
    const glossEntries = showWordTranslation
      ? words.map((w) => ({ word: w.word, gloss: getWordGloss(w) })).filter((e) => e.gloss)
      : [];

    return (
      <div className={styles.jaContainer}>
        {/* Sentence text with furigana */}
        <p className={styles.jaSentence}>
          {hasSentenceTokens && showReading
            ? sentenceTokens!.map((token, i) =>
                token.hasKanji && token.reading ? (
                  <ruby key={i} className={styles.ruby}>
                    {token.surface}
                    <rt className={styles.rt}>{token.reading}</rt>
                  </ruby>
                ) : (
                  <span key={i}>{token.surface}</span>
                ),
              )
            : !showReading
              ? text
              : words.map((w, i) => {
                  // word-level fallback: show reading for kanji words above
                  const reading = containsKanji(w.word) ? getJapaneseWordReading(w) : null;
                  return reading ? (
                    <ruby key={i} className={styles.ruby}>
                      {w.word}
                      <rt className={styles.rt}>{reading}</rt>
                    </ruby>
                  ) : (
                    <span key={i}>{w.word}</span>
                  );
                })}
        </p>

        {/* Word gloss grid — separate from sentence text */}
        {glossEntries.length > 0 && (
          <div className={styles.glossGrid}>
            {glossEntries.map((e, i) => (
              <span key={i} className={styles.glossChip}>
                <span className={styles.glossWord}>{e.word}</span>
                <span className={styles.glossMeaning}>{e.gloss}</span>
              </span>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── English ───────────────────────────────────────────────────────────────
  return (
    <div className={styles.enContainer}>
      <p className={styles.enSentence}>
        {words.map((w, i) => {
          const gloss = showWordTranslation ? getWordGloss(w) : null;
          const hasAnnotation = (showIPA && w.ipa) || gloss;
          return hasAnnotation ? (
            <span key={i} className={styles.enWord}>
              <span className={styles.enWordMain}>{w.word}</span>
              {showIPA && w.ipa && <span className={styles.enIPA}>{w.ipa}</span>}
              {gloss && <span className={styles.enGloss}>{gloss}</span>}
            </span>
          ) : (
            <span key={i}>{w.word} </span>
          );
        })}
      </p>
    </div>
  );
}

