"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { GrammarCard, GrammarSummary, Locale } from "../../types";
import { createT } from "../../lib/i18n";
import { fetchGrammarCards, gradeGrammarCard } from "../../lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/Card";
import { Button } from "../ui/Button";
import styles from "./JlptGrammarView.module.css";

interface JlptGrammarViewProps {
  locale: Locale;
  token: string | null;
  tenantCode: string;
}

const GRADE_OPTIONS = [
  { grade: 1, labelKey: "grammarJlpt.gradeAgain" },
  { grade: 3, labelKey: "grammarJlpt.gradeGood" },
  { grade: 5, labelKey: "grammarJlpt.gradeEasy" },
] as const;

function localizeGrammarField(card: GrammarCard, locale: Locale, field: "title" | "explanation") {
  if (field === "title") {
    if (locale === "zh") {
      return card.titleCn || card.titleJa || card.title;
    }
    return card.titleJa || card.title || card.titleCn;
  }

  if (locale === "zh") {
    return card.explanationCn || card.explanationJa || card.explanation;
  }
  return card.explanationJa || card.explanation || card.explanationCn;
}

export function JlptGrammarView({ locale, token, tenantCode }: JlptGrammarViewProps) {
  const t = useMemo(() => createT(locale), [locale]);
  const [summary, setSummary] = useState<GrammarSummary | null>(null);
  const [cards, setCards] = useState<GrammarCard[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [gradingCardId, setGradingCardId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadCards = useCallback(async () => {
    if (!token) {
      return;
    }
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const payload = await fetchGrammarCards({ token, tenantCode }, "ja");
      if (!payload || !Array.isArray(payload.cards) || !payload.summary) {
        setErrorMsg(t("grammarJlpt.loadFailed"));
        setCards([]);
        setSummary(null);
        return;
      }
      setSummary(payload.summary);
      setCards(payload.cards);
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoading(false);
    }
  }, [t, tenantCode, token]);

  useEffect(() => {
    void loadCards();
  }, [loadCards]);

  const dueCards = useMemo(() => cards.filter((card) => card.due), [cards]);
  const activeCard = dueCards[0] ?? cards[0] ?? null;

  const handleGrade = useCallback(async (grade: number) => {
    if (!token || !activeCard) {
      return;
    }
    setGradingCardId(activeCard.id);
    setErrorMsg(null);
    try {
      const result = await gradeGrammarCard(activeCard.id, grade, { token, tenantCode });
      if (!result.success) {
        setErrorMsg(result.error ?? t("grammarJlpt.gradeFailed"));
        return;
      }
      await loadCards();
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : String(error));
    } finally {
      setGradingCardId(null);
    }
  }, [activeCard, loadCards, t, tenantCode, token]);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>{t("grammarJlpt.title")}</h2>
        <p>{t("grammarJlpt.subtitle")}</p>
      </div>

      {summary && (
        <div className={styles.summaryGrid}>
          <Card>
            <CardContent>
              <strong>{summary.total}</strong>
              <span>{t("grammarJlpt.totalLabel")}</span>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <strong>{summary.due}</strong>
              <span>{t("grammarJlpt.dueLabel")}</span>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <strong>{summary.learning}</strong>
              <span>{t("grammarJlpt.learningLabel")}</span>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <strong>{summary.mastered}</strong>
              <span>{t("grammarJlpt.masteredLabel")}</span>
            </CardContent>
          </Card>
        </div>
      )}

      {errorMsg && <p className={styles.error}>{errorMsg}</p>}

      {!isLoading && !activeCard && (
        <Card>
          <CardContent>
            <p className={styles.empty}>{t("grammarJlpt.empty")}</p>
          </CardContent>
        </Card>
      )}

      {activeCard && (
        <Card className={styles.card}>
          <CardHeader>
            <div className={styles.cardHeader}>
              <div>
                <CardTitle as="h3">{localizeGrammarField(activeCard, locale, "title")}</CardTitle>
                <div className={styles.metaRow}>
                  <span>{t("grammarJlpt.levelLabel")}: {activeCard.jlptLevel ?? "N5"}</span>
                  <span>{activeCard.due ? t("grammarJlpt.statusDue") : t("grammarJlpt.statusScheduled")}</span>
                </div>
              </div>
              <Button variant="secondary" onClick={() => void loadCards()} disabled={isLoading}>
                {t("grammarJlpt.refresh")}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <p className={styles.explanation}>{localizeGrammarField(activeCard, locale, "explanation")}</p>

            <div className={styles.examplesSection}>
              <h4>{t("grammarJlpt.examplesLabel")}</h4>
              <ul className={styles.exampleList}>
                {activeCard.examples.map((example) => (
                  <li key={example}>{example}</li>
                ))}
              </ul>
            </div>

            <div className={styles.gradeActions}>
              {GRADE_OPTIONS.map((option) => (
                <Button
                  key={option.grade}
                  variant={option.grade >= 5 ? "primary" : "secondary"}
                  onClick={() => void handleGrade(option.grade)}
                  disabled={gradingCardId === activeCard.id}
                >
                  {t(option.labelKey)}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}