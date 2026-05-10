"use client";

import { useEffect, useMemo, useState } from "react";
import type { Locale } from "../../types";
import { createT } from "../../lib/i18n";
import { getJapaneseReading } from "../../lib/japanese-reading";
import { JLPT_READING_PASSAGES } from "../../data/jlpt-reading-passages";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/Card";
import { Button } from "../ui/Button";
import styles from "./JlptReadingView.module.css";

interface JlptReadingViewProps {
  locale: Locale;
}

export function JlptReadingView({ locale }: JlptReadingViewProps) {
  const t = createT(locale);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [readingText, setReadingText] = useState("");
  const [isLoadingReading, setIsLoadingReading] = useState(false);
  const currentPassage = JLPT_READING_PASSAGES[currentIndex] ?? JLPT_READING_PASSAGES[0];

  useEffect(() => {
    let cancelled = false;
    setIsLoadingReading(true);
    void getJapaneseReading(currentPassage.passage)
      .then((result) => {
        if (!cancelled) {
          setReadingText(String(result.readingText ?? "").trim());
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingReading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [currentPassage.passage]);

  const localizedQuestion = locale === "zh" ? currentPassage.questionCn : currentPassage.questionJa;
  const localizedHint = locale === "zh" ? currentPassage.hintCn : currentPassage.hintJa;
  const localizedSummary = locale === "zh" ? currentPassage.summaryCn : currentPassage.summaryJa;
  const progressLabel = useMemo(
    () => `${currentIndex + 1} / ${JLPT_READING_PASSAGES.length}`,
    [currentIndex],
  );

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>{t("readingJlpt.title")}</h2>
        <p>{t("readingJlpt.subtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <div className={styles.titleRow}>
            <div>
              <CardTitle as="h3">{locale === "zh" ? currentPassage.titleCn : currentPassage.title}</CardTitle>
              <div className={styles.metaRow}>
                <span>{t("readingJlpt.levelLabel")}: {currentPassage.jlptLevel}</span>
                <span>{t("readingJlpt.progressLabel")}: {progressLabel}</span>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className={styles.passage}>{currentPassage.passage}</p>

          <div className={styles.infoBlock}>
            <h4>{t("readingJlpt.furiganaLabel")}</h4>
            <p className={styles.readingLine}>
              {isLoadingReading ? t("readingJlpt.loadingReading") : readingText || t("readingJlpt.noReading")}
            </p>
          </div>

          <div className={styles.infoBlock}>
            <h4>{t("readingJlpt.summaryLabel")}</h4>
            <p>{localizedSummary}</p>
          </div>

          <div className={styles.infoBlock}>
            <h4>{t("readingJlpt.questionLabel")}</h4>
            <p>{localizedQuestion}</p>
          </div>

          <div className={styles.infoBlock}>
            <h4>{t("readingJlpt.hintLabel")}</h4>
            <p>{localizedHint}</p>
          </div>

          <div className={styles.actions}>
            <Button
              variant="secondary"
              onClick={() => setCurrentIndex((idx) => Math.max(0, idx - 1))}
              disabled={currentIndex === 0}
            >
              {t("readingJlpt.previous")}
            </Button>
            <Button
              onClick={() => setCurrentIndex((idx) => Math.min(JLPT_READING_PASSAGES.length - 1, idx + 1))}
              disabled={currentIndex >= JLPT_READING_PASSAGES.length - 1}
            >
              {t("readingJlpt.next")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}