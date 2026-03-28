"use client";

import { RefObject, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Locale } from "../../types";
import { annotateWords } from "../../data/word-dictionary";
import { getJapaneseReading } from "../../lib/japanese-reading";
import { getWordIpa } from "../../lib/pronunciation";
import { translateText } from "../../lib/translate";
import styles from "./SelectionPronunciation.module.css";

type SelectionState = {
  text: string;
  cleanWord: string | null;
  ipa: string | null;
  cn: string | null;
  phraseCn: string | null;
  unknownWords: string[];
  coverage: number;
  left: number;
  top: number;
  multipleWords: boolean;
};

interface SelectionPronunciationProps {
  scopeRef: RefObject<HTMLElement | null>;
  locale?: Locale;
  learningLanguage?: "en" | "ja";
}

function containsKanji(text: string): boolean {
  return /[一-龯々]/u.test(String(text ?? ""));
}

function buildPhraseTranslation(text: string): {
  phraseCn: string | null;
  unknownWords: string[];
  coverage: number;
} {
  const annotations = annotateWords(text).filter((item) => item.clean.length > 0);
  if (annotations.length === 0) {
    return { phraseCn: null, unknownWords: [], coverage: 0 };
  }
  const knownCount = annotations.filter((item) => Boolean(item.cn)).length;
  const coverage = knownCount / annotations.length;
  const phraseCn = annotations.map((item) => item.cn ?? `[${item.clean}]`).join(" ");
  const unknownWords = annotations
    .filter((item) => !item.cn)
    .map((item) => item.clean);
  return {
    phraseCn: phraseCn.length > 0 ? phraseCn : null,
    unknownWords,
    coverage,
  };
}

export function SelectionPronunciation({
  scopeRef,
  locale = "zh",
  learningLanguage = "en",
}: SelectionPronunciationProps) {
  const [selectionState, setSelectionState] = useState<SelectionState | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [fallbackIpa, setFallbackIpa] = useState<string | null>(null);
  const [isLoadingIpa, setIsLoadingIpa] = useState(false);
  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [japaneseReading, setJapaneseReading] = useState<string | null>(null);
  const [isLoadingJapaneseReading, setIsLoadingJapaneseReading] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const stopSpeaking = () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      return;
    }
    window.speechSynthesis.cancel();
    utteranceRef.current = null;
    setIsSpeaking(false);
  };

  const speak = () => {
    if (!selectionState?.text) {
      return;
    }
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(selectionState.cleanWord ?? selectionState.text);
    utterance.lang = learningLanguage === "ja" ? "ja-JP" : "en-US";
    utterance.rate = 0.88;
    utterance.pitch = 1;
    utterance.onend = () => {
      setIsSpeaking(false);
      utteranceRef.current = null;
    };
    utterance.onerror = () => {
      setIsSpeaking(false);
      utteranceRef.current = null;
    };
    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
    setIsSpeaking(true);
  };

  const copyTranslation = async () => {
    const text = translatedText ?? selectionState?.phraseCn ?? selectionState?.cn;
    if (!text || typeof window === "undefined" || !window.navigator?.clipboard) {
      return;
    }
    try {
      await window.navigator.clipboard.writeText(text);
    } catch {
      // Ignore clipboard failures in unsupported contexts.
    }
  };

  useEffect(() => {
    const readSelection = () => {
      const scope = scopeRef.current;
      if (!scope || typeof window === "undefined") {
        setSelectionState(null);
        return;
      }

      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
        setSelectionState(null);
        return;
      }

      const text = selection.toString().trim();
      if (!text) {
        setSelectionState(null);
        return;
      }

      const range = selection.getRangeAt(0);
      const anchorNode = range.commonAncestorContainer;
      const anchorElement =
        anchorNode.nodeType === Node.ELEMENT_NODE
          ? (anchorNode as Element)
          : anchorNode.parentElement;

      if (!anchorElement || !scope.contains(anchorElement)) {
        setSelectionState(null);
        return;
      }

      let multipleWords = true;
      let cleanWord: string | null = null;
      let annotation: ReturnType<typeof annotateWords>[number] | null = null;
      let phraseTranslation: ReturnType<typeof buildPhraseTranslation> = {
        phraseCn: null,
        unknownWords: [],
        coverage: 0,
      };

      if (learningLanguage === "ja") {
        const compact = text.replace(/\s+/g, "").trim();
        cleanWord = compact || null;
        multipleWords = text.trim().includes(" ") || compact.length > 10;
        phraseTranslation = { phraseCn: null, unknownWords: [], coverage: 1 };
      } else {
        const wordCandidates = text.match(/[A-Za-z'-]+/g) ?? [];
        multipleWords = wordCandidates.length !== 1;
        const firstCandidate = wordCandidates[0];
        cleanWord = firstCandidate ? firstCandidate.toLowerCase() : null;
        annotation = cleanWord ? annotateWords(cleanWord)[0] : null;
        phraseTranslation = buildPhraseTranslation(text);
      }
      const rect = range.getBoundingClientRect();
      setSelectionState({
        text,
        cleanWord,
        ipa: annotation?.ipa ?? null,
        cn: annotation?.cn ?? null,
        phraseCn: phraseTranslation.phraseCn,
        unknownWords: phraseTranslation.unknownWords,
        coverage: phraseTranslation.coverage,
        left: rect.left + rect.width / 2,
        top: rect.top - 12,
        multipleWords,
      });
      setTranslatedText(null);
      setJapaneseReading(null);
    };

    const clearState = () => setSelectionState(null);
    const onMouseDown = (event: MouseEvent) => {
      const scope = scopeRef.current;
      if (!scope) {
        setSelectionState(null);
        return;
      }
      if (event.target instanceof Node && popoverRef.current?.contains(event.target)) {
        return;
      }
      if (event.target instanceof Node && !scope.contains(event.target)) {
        setSelectionState(null);
      }
    };

    document.addEventListener("selectionchange", readSelection);
    window.addEventListener("scroll", clearState, true);
    window.addEventListener("resize", clearState);
    document.addEventListener("mousedown", onMouseDown);

    return () => {
      document.removeEventListener("selectionchange", readSelection);
      window.removeEventListener("scroll", clearState, true);
      window.removeEventListener("resize", clearState);
      document.removeEventListener("mousedown", onMouseDown);
      stopSpeaking();
    };
  }, [learningLanguage, scopeRef]);

  useEffect(() => {
    if (!selectionState) {
      setTranslatedText(null);
      setIsTranslating(false);
      setJapaneseReading(null);
      setIsLoadingJapaneseReading(false);
      return;
    }
    let cancelled = false;
    const sourceText = (selectionState.cleanWord ?? selectionState.text).trim();
    if (!sourceText) {
      setTranslatedText(null);
      setIsTranslating(false);
      return;
    }
    if (learningLanguage !== "ja" && locale !== "ja") {
      setTranslatedText(null);
      setIsTranslating(false);
      return;
    }
    setIsTranslating(true);
    const targetLang = learningLanguage === "ja" ? "zh-CN" : "ja";
    const sourceLang = learningLanguage === "ja" ? "ja" : "en";
    void translateText(sourceText, targetLang, sourceLang)
      .then((result) => {
        if (!cancelled) {
          setTranslatedText(result);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsTranslating(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [learningLanguage, locale, selectionState]);

  useEffect(() => {
    if (learningLanguage !== "ja" || !selectionState) {
      setJapaneseReading(null);
      setIsLoadingJapaneseReading(false);
      return;
    }
    const sourceText = (selectionState.cleanWord ?? selectionState.text).trim();
    if (!sourceText || !containsKanji(sourceText)) {
      setJapaneseReading(null);
      setIsLoadingJapaneseReading(false);
      return;
    }

    let cancelled = false;
    setIsLoadingJapaneseReading(true);
    void getJapaneseReading(sourceText)
      .then((result) => {
        if (cancelled) {
          return;
        }
        const reading = String(result.readingText ?? "").trim();
        setJapaneseReading(reading && reading !== sourceText ? reading : null);
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingJapaneseReading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [learningLanguage, selectionState]);

  useEffect(() => {
    if (learningLanguage === "ja") {
      setFallbackIpa(null);
      setIsLoadingIpa(false);
      return;
    }
    if (!selectionState?.cleanWord || selectionState.multipleWords || selectionState.ipa) {
      setFallbackIpa(null);
      setIsLoadingIpa(false);
      return;
    }

    let cancelled = false;
    setIsLoadingIpa(true);
    setFallbackIpa(null);
    void getWordIpa(selectionState.cleanWord)
      .then((ipa) => {
        if (cancelled) {
          return;
        }
        setFallbackIpa(ipa);
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingIpa(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [learningLanguage, selectionState?.cleanWord, selectionState?.ipa, selectionState?.multipleWords]);

  if (!selectionState || !mounted) {
    return null;
  }

  const isJa = locale === "ja";
  const t = (zh: string, ja: string) => (isJa ? ja : zh);
  const displayIpa = selectionState.ipa ?? fallbackIpa;
  const displayWordTranslation = learningLanguage === "ja" ? translatedText : (isJa ? translatedText : selectionState.cn);
  const displayPhraseTranslation = learningLanguage === "ja" ? translatedText : (isJa ? translatedText : selectionState.phraseCn);
  const displayJapaneseReading = learningLanguage === "ja" ? japaneseReading : null;

  const popover = (
    <div
      ref={popoverRef}
      className={styles.popover}
      style={{
        left: `${selectionState.left}px`,
        top: `${selectionState.top}px`,
      }}
      role="dialog"
      aria-label="selection-pronunciation"
      onMouseDown={(event) => event.preventDefault()}
    >
      <p className={styles.word}>{selectionState.cleanWord ?? selectionState.text}</p>
      {selectionState.multipleWords ? (
        <p className={styles.meta}>{t("已选中短语，可查看划词翻译。", "フレーズを選択しました。翻訳を確認できます。")}</p>
      ) : (
        <>
          {learningLanguage !== "ja" && (
            <p className={styles.meta}>
              {displayIpa ?? (isLoadingIpa ? t("正在查询音标...", "IPA を取得中...") : t("暂无 IPA，可直接朗读听发音。", "IPA がありません。読み上げで確認できます。"))}
            </p>
          )}
          {displayWordTranslation && <p className={styles.meta}>{t("释义", "訳")}: {displayWordTranslation}</p>}
        </>
      )}
      {learningLanguage === "ja" && (isLoadingJapaneseReading || displayJapaneseReading) && (
        <p className={styles.meta}>
          {t("读法", "読み方")}：{isLoadingJapaneseReading ? t("获取中...", "取得中...") : displayJapaneseReading}
        </p>
      )}
      {isTranslating && <p className={styles.meta}>{t("翻译中...", "翻訳中...")}</p>}
      {displayPhraseTranslation && (
        <p className={styles.meta}>{t("翻译", "翻訳")}：{displayPhraseTranslation}</p>
      )}
      {learningLanguage !== "ja" && selectionState.unknownWords.length > 0 && (
        <p className={styles.meta}>
          {t("未收录词", "未収録語")}：{selectionState.unknownWords.slice(0, 4).join(", ")}
          {selectionState.unknownWords.length > 4 ? " ..." : ""}
          （{t("覆盖率", "カバー率")} {Math.round(selectionState.coverage * 100)}%）
        </p>
      )}
      <div className={styles.actions}>
        <button type="button" className={styles.button} onClick={speak}>
          {isSpeaking ? t("重播", "再生") : t("朗读", "読み上げ")}
        </button>
        <button
          type="button"
          className={styles.button}
          onClick={copyTranslation}
          disabled={!displayPhraseTranslation && !displayWordTranslation}
        >
          {t("复制翻译", "翻訳をコピー")}
        </button>
        <button type="button" className={`${styles.button} ${styles.secondary}`} onClick={stopSpeaking}>
          {t("停止", "停止")}
        </button>
      </div>
    </div>
  );

  // Use portal to render outside any Card/transform/backdrop-filter container
  return createPortal(popover, document.body);
}
