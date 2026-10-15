import { findSentenceTranslation, glossLangFor, jaGlossLangFor, lookupEnglishWord, lookupJapanese, shortGloss, type GlossLang } from "./word-lookup";
import { tokenizeEnglish } from "./lookup-core";

export type SelectionLookup = {
  text: string;
  /** Normalised single word (lowercase for English). */
  word: string;
  /** Word as displayed (keeps acronym casing). */
  display: string;
  lang: "en" | "ja";
  glossLang: GlossLang | "en";
  isPhrase: boolean;
  ipa: string | null;
  reading: string | null;
  needsReading: boolean;
  meaning: string | null;
};

const KANJI = /[一-龯々]/u;

/**
 * Resolve a text selection against the bundled dictionary / material translations.
 * English: meaning in the UI language (zh default, ja for Japanese UI).
 * Japanese: reading + meaning in Chinese, or English for the English UI.
 */
export function buildSelectionLookup(text: string, learningLanguage: "en" | "ja", uiLang: string): SelectionLookup | null {
  const raw = String(text ?? "").trim();
  if (!raw) return null;
  if (learningLanguage === "ja") {
    const compact = raw.replace(/\s+/g, "");
    const jaGloss = jaGlossLangFor(uiLang);
    const j = lookupJapanese(compact, jaGloss);
    const sentence = findSentenceTranslation(compact, jaGloss);
    const isPhrase = compact.length > 10 || j.segments.filter((s) => s.meaning && !s.meaning.startsWith("（")).length > 2;
    return {
      text: compact, word: compact, display: compact, lang: "ja", glossLang: jaGloss, isPhrase,
      ipa: null,
      reading: KANJI.test(compact) ? j.reading : null,
      needsReading: KANJI.test(compact),
      meaning: sentence ?? (j.found ? j.meaning : null),
    };
  }
  const glossLang = glossLangFor(uiLang);
  const tokens = tokenizeEnglish(raw);
  if (tokens.length === 0) return null;
  if (tokens.length === 1) {
    const hit = lookupEnglishWord(tokens[0].raw, glossLang);
    return {
      text: raw, word: tokens[0].clean, display: tokens[0].acronym ? tokens[0].raw : tokens[0].clean,
      lang: "en", glossLang, isPhrase: false, ipa: hit.ipa, reading: null, needsReading: false, meaning: hit.meaning,
    };
  }
  const sentence = findSentenceTranslation(raw, glossLang);
  let meaning = sentence;
  if (!meaning) {
    const hits = tokens.map((tk) => ({ tk, hit: lookupEnglishWord(tk.raw, glossLang) }));
    if (hits.every((h) => h.hit.meaning) && tokens.length <= 6) {
      meaning = hits.map((h) => `${h.tk.raw}：${shortGloss(h.hit.meaning)}`).join("　");
    }
  }
  return {
    text: raw, word: tokens[0].clean, display: raw, lang: "en", glossLang, isPhrase: true,
    ipa: null, reading: null, needsReading: false, meaning,
  };
}
