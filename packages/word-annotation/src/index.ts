/**
 * @toeicpass/word-annotation
 *
 * Core (framework-agnostic) exports.
 * For the React hook, import from "@toeicpass/word-annotation/react".
 */

export { WordAnnotationEngine } from "./engine";
export { tokenizeSentence, tokenizeEnglish, tokenizeJapanese, containsKanji } from "./tokenizer";
export type {
  TrainingLanguage,
  UiLang,
  WordAnnotation,
  JapaneseReadingToken,
  TranslateAdapter,
  JapaneseReadingAdapter,
  WordGlossAdapter,
  WordAnnotationOptions,
  AnnotationState,
} from "./types";
