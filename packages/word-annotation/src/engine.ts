/**
 * @toeicpass/word-annotation — WordAnnotationEngine
 *
 * Framework-agnostic, stateful annotation engine.
 * Manages per-word gloss, furigana, and sentence translation caches.
 *
 * Usage in a browser extension:
 *
 *   const engine = new WordAnnotationEngine({
 *     trainingLanguage: "en",
 *     uiLang: "ja",
 *     translate: (text, targetLang) => chrome.runtime.sendMessage({ type: "translate", text, targetLang }),
 *     getReading: (text) => chrome.runtime.sendMessage({ type: "reading", text }),
 *   });
 *
 *   // Call from your content script:
 *   engine.ensureSentenceTokens("日本語の文");
 *   engine.onStateChange = (state) => { renderFurigana(state.sentenceTokensMap); };
 */

import type {
  WordAnnotation,
  JapaneseReadingToken,
  TranslateAdapter,
  JapaneseReadingAdapter,
  WordGlossAdapter,
  WordAnnotationOptions,
  AnnotationState,
  TrainingLanguage,
  UiLang,
} from "./types";
import { tokenizeSentence } from "./tokenizer";

export class WordAnnotationEngine {
  private readonly trainingLanguage: TrainingLanguage;
  private readonly uiLang: UiLang;
  private readonly translate?: TranslateAdapter;
  private readonly getReadingApi?: JapaneseReadingAdapter;
  private readonly getGlossApi?: WordGlossAdapter;

  // ── Caches ─────────────────────────────────────────────────────────────────
  private wordGlossMap: Record<string, string> = {};
  private wordReadingMap: Record<string, string> = {};
  private sentenceTokensMap: Record<string, JapaneseReadingToken[]> = {};
  private sentenceTranslationMap: Record<string, string> = {};

  // ── In-flight dedup sets ───────────────────────────────────────────────────
  private fetchingGloss = new Set<string>();
  private fetchingReading = new Set<string>();
  private fetchingTokens = new Set<string>();
  private fetchingTranslation = new Set<string>();

  /**
   * Subscribe to receive a snapshot every time the engine's cache changes.
   * In React, use the `useWordAnnotation` hook instead (it wires this up automatically).
   * In a browser extension content script, assign this directly:
   *   engine.onStateChange = (state) => renderAnnotations(state);
   */
  public onStateChange?: (state: AnnotationState) => void;

  constructor(options: WordAnnotationOptions) {
    this.trainingLanguage = options.trainingLanguage;
    this.uiLang = options.uiLang;
    this.translate = options.translate;
    this.getReadingApi = options.getReading;
    this.getGlossApi = options.getGloss;
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /** Tokenize a sentence into annotatable word objects */
  tokenize(text: string): WordAnnotation[] {
    return tokenizeSentence(text, this.trainingLanguage);
  }

  /** Get the cached gloss for a word, or null if not yet fetched */
  getWordGloss(word: WordAnnotation): string | null {
    const key = this.wordGlossKey(word);
    return this.wordGlossMap[key] ?? null;
  }

  /** Get the cached furigana reading for a word, or null if not yet fetched */
  getJapaneseWordReading(word: WordAnnotation): string | null {
    return this.wordReadingMap[word.word] ?? null;
  }

  /** Get cached per-token furigana for a sentence, or null if not yet fetched */
  getSentenceTokens(text: string): JapaneseReadingToken[] | null {
    return this.sentenceTokensMap[text] ?? null;
  }

  /** Get cached sentence translation, or empty string if not yet fetched */
  getSentenceTranslation(
    materialId: string,
    sentenceId: number,
    sentence: { text: string; translation?: string; translationEn?: string },
  ): string {
    if (this.trainingLanguage === "ja") {
      if (this.uiLang === "en") return (sentence as { translationEn?: string }).translationEn || sentence.translation || "";
      return sentence.translation ?? "";
    }
    if (this.uiLang === "zh") return sentence.translation ?? "";
    if (this.uiLang === "en") return sentence.translation ?? "";
    const key = this.translationKey(materialId, sentenceId, sentence.text);
    return this.sentenceTranslationMap[key] ?? sentence.translation ?? "";
  }

  /** Get secondary translation (e.g. Chinese gloss when learning Japanese) */
  getSecondaryTranslation(sentence: { translation?: string; translationEn?: string }): string {
    if (this.trainingLanguage !== "ja") return "";
    if (this.uiLang === "ja") return sentence.translation ?? "";
    return (sentence as { translationEn?: string }).translationEn || "";
  }

  // ── Ensure (fire & forget fetch-and-cache) ─────────────────────────────────

  /** Trigger gloss fetch for a word when UI is Japanese and training is English */
  ensureJaWordGloss(word: WordAnnotation): void {
    if (this.uiLang !== "ja" || this.trainingLanguage !== "en") return;
    this.fetchGloss(word, "ja");
  }

  /** Trigger gloss fetch for a Japanese word (training = ja) */
  ensureJapaneseWordGloss(word: WordAnnotation): void {
    if (this.trainingLanguage !== "ja") return;
    this.fetchGloss(word, "zh-CN");
  }

  /** Trigger furigana reading fetch for a Japanese word */
  ensureJapaneseWordReading(word: WordAnnotation): void {
    if (this.trainingLanguage !== "ja") return;
    if (!this.getReadingApi) return;
    const key = word.word;
    if (this.wordReadingMap[key] || this.fetchingReading.has(key)) return;
    this.fetchingReading.add(key);
    void this.getReadingApi(key)
      .then(({ readingText }) => {
        if (readingText && readingText !== key) {
          this.wordReadingMap = { ...this.wordReadingMap, [key]: readingText };
          this.emit();
        }
      })
      .finally(() => this.fetchingReading.delete(key));
  }

  /** Trigger per-token furigana fetch for a full sentence */
  ensureSentenceTokens(text: string): void {
    if (this.trainingLanguage !== "ja") return;
    if (!this.getReadingApi) return;
    if (this.sentenceTokensMap[text] || this.fetchingTokens.has(text)) return;
    this.fetchingTokens.add(text);
    void this.getReadingApi(text)
      .then(({ tokens }) => {
        if (tokens && tokens.length > 0) {
          this.sentenceTokensMap = { ...this.sentenceTokensMap, [text]: tokens };
          this.emit();
        }
      })
      .finally(() => this.fetchingTokens.delete(text));
  }

  /** Trigger sentence translation fetch (Japanese UI, English training) */
  ensureJaSentenceTranslation(
    materialId: string,
    sentenceId: number,
    sentence: { text: string; translation?: string },
  ): void {
    if (this.uiLang !== "ja" || this.trainingLanguage !== "en") return;
    if (!this.translate) return;
    const key = this.translationKey(materialId, sentenceId, sentence.text);
    if (this.sentenceTranslationMap[key] || this.fetchingTranslation.has(key)) return;
    this.fetchingTranslation.add(key);
    void this.translate(sentence.text, "ja", "en")
      .then(async (translated) => {
        let resolved = String(translated ?? "").trim();
        if (!resolved || resolved.toLowerCase() === sentence.text.trim().toLowerCase()) {
          const zhSource = String(sentence.translation ?? "").trim();
          if (zhSource && this.translate) {
            const fromZh = String(await this.translate(zhSource, "ja", "zh-CN") ?? "").trim();
            resolved = fromZh && fromZh !== zhSource ? fromZh : "";
          } else {
            resolved = "";
          }
        }
        if (resolved) {
          this.sentenceTranslationMap = { ...this.sentenceTranslationMap, [key]: resolved };
          this.emit();
        }
      })
      .finally(() => this.fetchingTranslation.delete(key));
  }

  /** Get a snapshot of the current annotation state */
  getState(): AnnotationState {
    return {
      wordGlossMap: this.wordGlossMap,
      wordReadingMap: this.wordReadingMap,
      sentenceTokensMap: this.sentenceTokensMap,
      sentenceTranslationMap: this.sentenceTranslationMap,
    };
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private wordGlossKey(word: WordAnnotation): string {
    return String(word.clean || word.word || "").toLowerCase().trim();
  }

  private translationKey(materialId: string, sentenceId: number, text: string): string {
    return `${materialId}::${sentenceId}::${text}`;
  }

  private fetchGloss(word: WordAnnotation, targetLang: "zh-CN" | "ja"): void {
    if (!this.getGlossApi && !this.translate) return;
    const key = this.wordGlossKey(word);
    if (!key || this.wordGlossMap[key] || this.fetchingGloss.has(key)) return;
    this.fetchingGloss.add(key);
    const fetch = this.getGlossApi
      ? this.getGlossApi(key, targetLang)
      : this.translate!(key, targetLang);
    void fetch
      .then((gloss) => {
        const glossStr = String(gloss ?? "").trim();
        if (glossStr && glossStr !== key) {
          this.wordGlossMap = { ...this.wordGlossMap, [key]: glossStr };
          this.emit();
        }
      })
      .finally(() => this.fetchingGloss.delete(key));
  }

  private emit(): void {
    this.onStateChange?.(this.getState());
  }
}
