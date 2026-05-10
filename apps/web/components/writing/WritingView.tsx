"use client";

import { useState } from "react";
import type { Locale, TargetLang, ViewTab } from "../../types";
import { createT } from "../../lib/i18n";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import styles from "./WritingView.module.css";
import { API_BASE } from "../../lib/api";

type WritingFocusArea = "content" | "organization" | "languageControl";

type WritingResult = {
  score: number;
  wordCount: number;
  feedback: string[];
  summary?: string;
  nextStep?: string;
  focusArea?: WritingFocusArea;
  focusSignals?: string[];
  drillChecklist?: string[];
  revisionPrompt?: string;
  sentenceFrames?: string[];
  rubric?: Array<{
    label: string;
    score: number;
    comment: string;
  }>;
};

interface WritingViewProps {
  locale: Locale;
  targetLang: TargetLang;
  token: string | null;
  tenantCode: string;
  onOpenView?: (view: ViewTab) => void;
}

export function WritingView({ locale, targetLang, token, tenantCode, onOpenView }: WritingViewProps) {
  const [text, setText] = useState("");
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [result, setResult] = useState<WritingResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const t = createT(locale);
  const isJapaneseTarget = targetLang === "ja";

  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const characterCount = text.replace(/\s+/g, "").length;
  const metricLabel = t(isJapaneseTarget ? "writing.charCount" : "writing.wordCount");
  const metricCount = isJapaneseTarget ? characterCount : wordCount;
  const title = t(isJapaneseTarget ? "writing.titleJa" : "writing.title");
  const subtitle = t(isJapaneseTarget ? "writing.subtitleJa" : "writing.subtitle");
  const placeholder = t(isJapaneseTarget ? "writing.placeholderJa" : "writing.placeholder");
  const recommendationReason = result?.focusArea === "content"
    ? t("writing.focusContentReason")
    : result?.focusArea === "organization"
      ? t("writing.focusOrganizationReason")
      : result?.focusArea === "languageControl"
        ? t("writing.focusLanguageReason")
        : null;
  const recommendedViews: Array<{ view: ViewTab; label: string }> = result?.focusArea === "content"
    ? [
        {
          view: "vocab",
          label: t(isJapaneseTarget ? "writing.trainingLinkVocabJa" : "writing.trainingLinkVocab"),
        },
        {
          view: "shadowing",
          label: t(isJapaneseTarget ? "writing.trainingLinkShadowingJa" : "writing.trainingLinkShadowing"),
        },
      ]
    : result?.focusArea === "organization"
      ? [
          {
            view: "grammar",
            label: t(isJapaneseTarget ? "writing.trainingLinkGrammarJa" : "writing.trainingLinkGrammar"),
          },
          {
            view: "shadowing",
            label: t(isJapaneseTarget ? "writing.trainingLinkShadowingJa" : "writing.trainingLinkShadowing"),
          },
        ]
      : result?.focusArea === "languageControl"
        ? [
            {
              view: "grammar",
              label: t(isJapaneseTarget ? "writing.trainingLinkGrammarJa" : "writing.trainingLinkGrammar"),
            },
            {
              view: "vocab",
              label: t(isJapaneseTarget ? "writing.trainingLinkVocabJa" : "writing.trainingLinkVocab"),
            },
          ]
        : [];

  const handleSubmit = async () => {
    if (!text.trim() || !token) return;
    setIsEvaluating(true);
    setResult(null);
    setErrorMsg(null);
    try {
      const res = await fetch(`${API_BASE}/writing/evaluate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
          "x-tenant-code": tenantCode,
        },
        body: JSON.stringify({ text, targetLang }),
      });
      if (!res.ok) {
        setErrorMsg(t("writing.submitFailed"));
        return;
      }
      const data = await res.json();
      setResult(data);
    } catch (error) {
      console.error("Evaluation failed", error);
      setErrorMsg(t("writing.submitFailed"));
    } finally {
      setIsEvaluating(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>{title}</h2>
        <p className={styles.subtitle}>{subtitle}</p>
      </div>

      <div className={styles.workspace}>
        <Card className={styles.editorCard}>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={placeholder}
            className={styles.textArea}
            disabled={isEvaluating}
            rows={12}
          />
          <div className={styles.metrics}>
            <span>{metricLabel}: {metricCount}</span>
            <Button onClick={handleSubmit} disabled={isEvaluating || metricCount === 0}>
              {isEvaluating ? t("writing.evaluating") : t("writing.submit")}
            </Button>
          </div>
        </Card>

        {errorMsg && (
          <p style={{ color: "var(--color-error, #dc2626)", fontWeight: 500 }}>{errorMsg}</p>
        )}

        {result && (
          <Card className={styles.resultCard}>
            <div className={styles.resultHeader}>
              <h3>{t("writing.report")}</h3>
              <div className={styles.scoreBox}>
                {t("writing.scoreLabel")}: <span className={styles.score}>{result.score}</span> / 100
              </div>
            </div>
            {result.summary && (
              <div className={styles.feedbackSection}>
                <h4>{t("writing.summaryLabel")}</h4>
                <p className={styles.summaryText}>{result.summary}</p>
              </div>
            )}
            {result.rubric && result.rubric.length > 0 && (
              <div className={styles.feedbackSection}>
                <h4>{t("writing.rubricLabel")}</h4>
                <ul className={styles.rubricList}>
                  {result.rubric.map((item) => (
                    <li key={item.label} className={styles.rubricItem}>
                      <div className={styles.rubricHeader}>
                        <strong>{item.label}</strong>
                        <span className={styles.rubricScore}>{item.score} / 100</span>
                      </div>
                      <p>{item.comment}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className={styles.feedbackSection}>
              <h4>{t("writing.suggestions")}</h4>
              {result.feedback && result.feedback.length > 0 ? (
                <ul className={styles.feedbackList}>
                  {result.feedback.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              ) : (
                <p>{t("writing.noSuggestions")}</p>
              )}
            </div>
            {result.nextStep && (
              <div className={styles.feedbackSection}>
                <h4>{t("writing.nextStepLabel")}</h4>
                <p className={styles.summaryText}>{result.nextStep}</p>
              </div>
            )}
            {result.focusSignals && result.focusSignals.length > 0 && (
              <div className={styles.feedbackSection}>
                <h4>{t("writing.focusSignalsLabel")}</h4>
                <ul className={styles.feedbackList}>
                  {result.focusSignals.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
            {result.drillChecklist && result.drillChecklist.length > 0 && (
              <div className={styles.feedbackSection}>
                <h4>{t("writing.drillChecklistLabel")}</h4>
                <ul className={styles.feedbackList}>
                  {result.drillChecklist.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
            {result.revisionPrompt && (
              <div className={styles.feedbackSection}>
                <h4>{t("writing.revisionPromptLabel")}</h4>
                <p className={styles.summaryText}>{result.revisionPrompt}</p>
              </div>
            )}
            {result.sentenceFrames && result.sentenceFrames.length > 0 && (
              <div className={styles.feedbackSection}>
                <h4>{t("writing.sentenceFramesLabel")}</h4>
                <ul className={styles.feedbackList}>
                  {result.sentenceFrames.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
            {recommendedViews.length > 0 && recommendationReason && (
              <div className={styles.feedbackSection}>
                <h4>{t("writing.recommendationsLabel")}</h4>
                <p className={styles.summaryText}>{recommendationReason}</p>
                <div className={styles.recommendationActions}>
                  {recommendedViews.map((item) => (
                    <Button
                      key={item.view}
                      variant="secondary"
                      onClick={() => onOpenView?.(item.view)}
                      disabled={!onOpenView}
                    >
                      {item.label}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
