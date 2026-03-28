"use client";

import { RefObject, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { annotateWords } from "../../data/word-dictionary";
import { getWordIpa } from "../../lib/pronunciation";
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

export function SelectionPronunciation({ scopeRef }: SelectionPronunciationProps) {
  const [selectionState, setSelectionState] = useState<SelectionState | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [fallbackIpa, setFallbackIpa] = useState<string | null>(null);
  const [isLoadingIpa, setIsLoadingIpa] = useState(false);
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
    utterance.lang = "en-US";
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
    const text = selectionState?.phraseCn ?? selectionState?.cn;
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

      const wordCandidates = text.match(/[A-Za-z'-]+/g) ?? [];
      const multipleWords = wordCandidates.length !== 1;
      const firstCandidate = wordCandidates[0];
      const cleanWord = firstCandidate ? firstCandidate.toLowerCase() : null;

      const annotation = cleanWord ? annotateWords(cleanWord)[0] : null;
      const phraseTranslation = buildPhraseTranslation(text);
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
  }, [scopeRef]);

  useEffect(() => {
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
  }, [selectionState?.cleanWord, selectionState?.ipa, selectionState?.multipleWords]);

  if (!selectionState || !mounted) {
    return null;
  }

  const displayIpa = selectionState.ipa ?? fallbackIpa;

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
        <p className={styles.meta}>已选中短语，可查看划词翻译。</p>
      ) : (
        <>
          <p className={styles.meta}>
            {displayIpa ?? (isLoadingIpa ? "正在查询音标..." : "暂无 IPA，可直接朗读听发音。")}
          </p>
          {selectionState.cn && <p className={styles.meta}>释义：{selectionState.cn}</p>}
        </>
      )}
      {selectionState.phraseCn && (
        <p className={styles.meta}>翻译：{selectionState.phraseCn}</p>
      )}
      {selectionState.unknownWords.length > 0 && (
        <p className={styles.meta}>
          未收录词：{selectionState.unknownWords.slice(0, 4).join(", ")}
          {selectionState.unknownWords.length > 4 ? " ..." : ""}
          （覆盖率 {Math.round(selectionState.coverage * 100)}%）
        </p>
      )}
      <div className={styles.actions}>
        <button type="button" className={styles.button} onClick={speak}>
          {isSpeaking ? "重播" : "朗读"}
        </button>
        <button
          type="button"
          className={styles.button}
          onClick={copyTranslation}
          disabled={!selectionState.phraseCn && !selectionState.cn}
        >
          复制翻译
        </button>
        <button type="button" className={`${styles.button} ${styles.secondary}`} onClick={stopSpeaking}>
          停止
        </button>
      </div>
    </div>
  );

  // Use portal to render outside any Card/transform/backdrop-filter container
  return createPortal(popover, document.body);
}
