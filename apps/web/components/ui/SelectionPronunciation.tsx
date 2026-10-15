"use client";

import { RefObject, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Locale } from "../../types";
import { createT } from "@toeicpass/app-i18n";
import { getJapaneseReading } from "../../lib/japanese-reading";
import { getWordIpa } from "../../lib/pronunciation";
import { translateText } from "../../lib/translate";
import { buildSelectionLookup, type SelectionLookup } from "../../lib/selection-lookup";
import styles from "./SelectionPronunciation.module.css";

type SelectionState = SelectionLookup & { left: number; top: number };

interface SelectionPronunciationProps {
  scopeRef: RefObject<HTMLElement | null>;
  /** UI language (popup labels and explanation language follow it). */
  locale?: Locale;
  learningLanguage?: "en" | "ja";
}

const NETWORK_TIMEOUT_MS = 6000;

function withTimeout<T>(promise: Promise<T>, fallback: T): Promise<T> {
  return Promise.race([
    promise.catch(() => fallback),
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), NETWORK_TIMEOUT_MS)),
  ]);
}

export function SelectionPronunciation({ scopeRef, locale = "zh", learningLanguage = "en" }: SelectionPronunciationProps) {
  const [selectionState, setSelectionState] = useState<SelectionState | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [remote, setRemote] = useState<{ ipa: string | null; meaning: string | null; reading: string | null; done: boolean }>({
    ipa: null, meaning: null, reading: null, done: true,
  });
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const t = createT(locale);

  useEffect(() => {
    setMounted(true);
  }, []);

  const stopSpeaking = () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    utteranceRef.current = null;
    setIsSpeaking(false);
  };

  const speak = () => {
    if (!selectionState?.text || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(selectionState.isPhrase ? selectionState.text : selectionState.word);
    utterance.lang = learningLanguage === "ja" ? "ja-JP" : "en-US";
    utterance.rate = 0.88;
    utterance.onend = () => { setIsSpeaking(false); utteranceRef.current = null; };
    utterance.onerror = () => { setIsSpeaking(false); utteranceRef.current = null; };
    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
    setIsSpeaking(true);
  };

  useEffect(() => {
    const readSelection = () => {
      const scope = scopeRef.current;
      if (!scope || typeof window === "undefined") return setSelectionState(null);
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return setSelectionState(null);
      const text = selection.toString().trim();
      if (!text) return setSelectionState(null);
      const range = selection.getRangeAt(0);
      const anchorNode = range.commonAncestorContainer;
      const anchorElement = anchorNode.nodeType === Node.ELEMENT_NODE ? (anchorNode as Element) : anchorNode.parentElement;
      if (!anchorElement || !scope.contains(anchorElement)) return setSelectionState(null);
      const lookup = buildSelectionLookup(text, learningLanguage, locale);
      if (!lookup) return setSelectionState(null);
      const rect = range.getBoundingClientRect();
      setSelectionState({ ...lookup, left: rect.left + rect.width / 2, top: rect.top - 12 });
    };
    const clearState = () => setSelectionState(null);
    const onMouseDown = (event: MouseEvent) => {
      const scope = scopeRef.current;
      if (!scope) return setSelectionState(null);
      if (event.target instanceof Node && popoverRef.current?.contains(event.target)) return;
      if (event.target instanceof Node && !scope.contains(event.target)) setSelectionState(null);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [learningLanguage, locale, scopeRef]);

  // Network fallback only for what the bundled dictionary could not answer; always finishes.
  const lookupKey = selectionState ? `${selectionState.lang}:${selectionState.text}` : "";
  useEffect(() => {
    if (!selectionState) return;
    const needIpa = selectionState.lang === "en" && !selectionState.isPhrase && !selectionState.ipa;
    const needMeaning = !selectionState.meaning;
    const needReading = selectionState.lang === "ja" && selectionState.needsReading && !selectionState.reading;
    if (!needIpa && !needMeaning && !needReading) {
      setRemote({ ipa: null, meaning: null, reading: null, done: true });
      return;
    }
    let cancelled = false;
    setRemote({ ipa: null, meaning: null, reading: null, done: false });
    const source = selectionState.isPhrase ? selectionState.text : selectionState.word;
    const target = selectionState.glossLang === "ja" ? "ja" : "zh-CN";
    void Promise.all([
      needIpa ? withTimeout(getWordIpa(selectionState.word), null) : Promise.resolve(null),
      needMeaning
        ? withTimeout(translateText(source, target, selectionState.lang === "ja" ? "ja" : "en"), "").then((r) => {
            const out = String(r ?? "").trim();
            return out && out.toLowerCase() !== source.toLowerCase() ? out : null;
          })
        : Promise.resolve(null),
      needReading
        ? withTimeout(getJapaneseReading(source), { readingText: "" } as Awaited<ReturnType<typeof getJapaneseReading>>).then((r) => {
            const reading = String(r?.readingText ?? "").trim();
            return reading && reading !== source ? reading : null;
          })
        : Promise.resolve(null),
    ]).then(([ipa, meaning, reading]) => {
      if (!cancelled) setRemote({ ipa, meaning, reading, done: true });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lookupKey]);

  if (!selectionState || !mounted) return null;

  const loading = !remote.done;
  const ipa = selectionState.ipa ?? remote.ipa;
  const meaning = selectionState.meaning ?? remote.meaning;
  const reading = selectionState.reading ?? remote.reading;
  const notFound = !loading && !meaning;
  const meaningLabel = selectionState.isPhrase ? t("lookup.translation") : t("lookup.meaning");

  const copyMeaning = async () => {
    if (!meaning || typeof window === "undefined" || !window.navigator?.clipboard) return;
    try {
      await window.navigator.clipboard.writeText(meaning);
    } catch {
      // Ignore clipboard failures in unsupported contexts.
    }
  };

  const popover = (
    <div
      ref={popoverRef}
      className={styles.popover}
      style={{ left: `${selectionState.left}px`, top: `${selectionState.top}px` }}
      role="dialog"
      aria-label="selection-pronunciation"
      data-testid="selection-popover"
      onMouseDown={(event) => event.preventDefault()}
    >
      <p className={styles.word}>{selectionState.isPhrase ? selectionState.text : selectionState.display}</p>
      {selectionState.lang === "en" && !selectionState.isPhrase && (
        <p className={styles.meta} data-testid="selection-ipa">
          {t("lookup.ipa")}：{ipa ?? (loading ? t("lookup.loading") : t("lookup.noIpa"))}
        </p>
      )}
      {selectionState.lang === "ja" && (reading || (loading && selectionState.needsReading)) && (
        <p className={styles.meta} data-testid="selection-reading">
          {t("lookup.reading")}：{reading ?? t("lookup.loading")}
        </p>
      )}
      <p className={styles.meta} data-testid="selection-meaning">
        {meaning
          ? `${meaningLabel}：${meaning}`
          : loading
            ? `${meaningLabel}：${t("lookup.loading")}`
            : t("lookup.notFound")}
      </p>
      <div className={styles.actions}>
        <button type="button" className={styles.button} onClick={speak}>
          {isSpeaking ? t("lookup.replay") : t("lookup.speak")}
        </button>
        <button type="button" className={styles.button} onClick={copyMeaning} disabled={notFound || !meaning}>
          {t("lookup.copy")}
        </button>
        <button type="button" className={`${styles.button} ${styles.secondary}`} onClick={stopSpeaking}>
          {t("lookup.stop")}
        </button>
      </div>
    </div>
  );

  // Use portal to render outside any Card/transform/backdrop-filter container
  return createPortal(popover, document.body);
}
