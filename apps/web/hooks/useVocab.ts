"use client";

import { useState, useCallback, useMemo } from "react";
import type { Locale, VocabCard, VocabSummary } from "../types";
import * as api from "../lib/api";

export function useVocab(
  ensureSession: () => Promise<string | null>,
  getRequestOptions: (token?: string) => { token?: string; tenantCode?: string },
  setMessage: (msg: string) => void,
  locale: Locale,
) {
  const byLocale = (zh: string, ja: string) => (locale === "ja" ? ja : zh);
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
        const payload = await api.fetchVocabularyCards(getRequestOptions(activeToken));
        if (payload) {
          setSummary(payload.summary);
          setCards(payload.cards);
        }
      } catch (error) {
        setMessage(
          byLocale(
            `加载词卡异常: ${error instanceof Error ? error.message : String(error)}`,
            `単語カード読み込みエラー: ${error instanceof Error ? error.message : String(error)}`,
          ),
        );
      } finally {
        setIsLoading(false);
      }
    },
    [ensureSession, getRequestOptions, locale, setMessage]
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
          setMessage(byLocale(`词卡评级失败: ${result.error}`, `カード評価失敗: ${result.error}`));
          return false;
        }

        setRevealMap((prev) => ({ ...prev, [cardId]: false }));
        await loadCards(token);
        setMessage(byLocale("词卡进度已更新。", "カード進捗を更新しました。"));
        return true;
      } catch (error) {
        setMessage(
          byLocale(
            `词卡评级异常: ${error instanceof Error ? error.message : String(error)}`,
            `カード評価エラー: ${error instanceof Error ? error.message : String(error)}`,
          ),
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
