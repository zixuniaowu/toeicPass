/**
 * @toeicpass/word-annotation — Tokenizer utilities
 *
 * Splits text into annotatable word tokens. No API calls needed.
 * Safe to use in browser extensions, Service Workers, and Node.
 */

import type { WordAnnotation } from "./types";

/** Returns true if the string contains at least one CJK ideograph */
export function containsKanji(text: string): boolean {
  return /[\u4e00-\u9fff\u3400-\u4dbf]/.test(text);
}

/**
 * Tokenize an English sentence into annotatable word objects.
 * Strips punctuation, lowercases for lookup keys.
 */
export function tokenizeEnglish(sentence: string): WordAnnotation[] {
  const raw = String(sentence ?? "").trim();
  if (!raw) return [];
  const tokens = raw.match(/[A-Za-z'-]+/g);
  if (!tokens || tokens.length === 0) return [{ word: raw, clean: raw, cn: null, ipa: null }];
  return tokens.map((word) => ({
    word,
    clean: word.toLowerCase().replace(/['-]/g, ""),
    cn: null,
    ipa: null,
  }));
}

/**
 * Tokenize a Japanese sentence into annotatable word objects.
 * Groups kanji runs, kana runs, and ASCII words as separate tokens.
 */
export function tokenizeJapanese(sentence: string): WordAnnotation[] {
  const raw = String(sentence ?? "").trim();
  if (!raw) return [];
  const tokens = raw.match(/[ぁ-んァ-ヶ一-龯々ー]+|[A-Za-z0-9']+/g);
  const words = (tokens && tokens.length > 0 ? tokens : [raw]).filter(Boolean);
  return words.map((word) => ({ word, clean: word, cn: null, ipa: null }));
}

/**
 * Tokenize a sentence based on the training language.
 */
export function tokenizeSentence(
  sentence: string,
  language: "en" | "ja",
): WordAnnotation[] {
  return language === "ja"
    ? tokenizeJapanese(sentence)
    : tokenizeEnglish(sentence);
}
