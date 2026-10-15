"use client";

import { useState, useCallback, useMemo } from "react";
import type { UiLang, VocabCard, VocabSummary } from "../types";
import { createT } from "@toeicpass/app-i18n";
import * as api from "../lib/api";

export function useVocab(
  ensureSession: () => Promise<string | null>,
  getRequestOptions: (token?: string) => { token?: string; tenantCode?: string },
  setMessage: (msg: string) => void,
  locale: UiLang,
  targetLang: "en" | "ja" = "en",
) {
  const t = useMemo(() => createT(locale), [locale]);
  const [cards, setCards] = useState<VocabCard[]>([]);
  const [summary, setSummary] = useState<VocabSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [revealMap, setRevealMap] = useState<Record<string, boolean>>({});
  const [gradingCardId, setGradingCardId] = useState<string | null>(null);

  const loadCards = useCallback(
    async (token?: string) => {
      const activeToken = token ?? (await ensureSession());
      if (!activeToken) return;

      setIsLoading(true);
      try {
        const payload = await api.fetchVocabularyCards(getRequestOptions(activeToken), targetLang);
        if (payload) {
          setSummary(payload.summary);
          setCards(payload.cards);
        }
      } catch (error) {
        setMessage(
          t("vocab.loadError", { error: error instanceof Error ? error.message : String(error) }),
        );
      } finally {
        setIsLoading(false);
      }
    },
    [ensureSession, getRequestOptions, locale, setMessage, targetLang]
  );

  const toggleReveal = useCallback((cardId: string) => {
    setRevealMap((prev) => ({ ...prev, [cardId]: !prev[cardId] }));
  }, []);

  const gradeCard = useCallback(
    async (cardId: string, grade: number) => {
      const token = await ensureSession();
      if (!token) return false;

      setGradingCardId(cardId);
      try {
        const result = await api.gradeVocabularyCard(cardId, grade, getRequestOptions(token));
        if (!result.success) {
          setMessage(t("vocab.gradeFailed", { error: result.error ?? "" }));
          return false;
        }

        setRevealMap((prev) => ({ ...prev, [cardId]: false }));
        await loadCards(token);
        setMessage(t("vocab.progressUpdated"));
        return true;
      } catch (error) {
        setMessage(
          t("vocab.gradeError", { error: error instanceof Error ? error.message : String(error) }),
        );
        return false;
      } finally {
        setGradingCardId(null);
      }
    },
    [ensureSession, getRequestOptions, locale, setMessage, loadCards]
  );

  const dueCards = useMemo(() => cards.filter((card) => card.due), [cards]);
  const activeCard = dueCards[0] ?? cards[0] ?? null;

  return {
    cards,
    summary,
    isLoading,
    revealMap,
    gradingCardId,
    dueCards,
    activeCard,
    loadCards,
    toggleReveal,
    gradeCard,
  };
}
