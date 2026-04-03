"use client";

import { useState } from "react";
import type { Locale } from "../../types";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import styles from "./WritingView.module.css";
import { API_BASE } from "../../lib/api";

const COPY = {
  zh: {
    title: "\u82f1\u8bed\u5199\u4f5c\u7ec3\u4e60",
    subtitle: "\u5728\u8fd9\u91cc\u8f93\u5165\u4f60\u7684\u82f1\u6587\u6587\u7ae0\u6216\u6bb5\u843d\uff0cAI\u4f1a\u81ea\u52a8\u4e3a\u4f60\u8bc4\u4f30\u8bcd\u6c47\u3001\u8bed\u6cd5\u548c\u7ed3\u6784\u3002",
    wordCount: "\u5b57\u6570",
    evaluating: "\u8bc4\u4f30\u4e2d...",
    submit: "\u63d0\u4ea4\u8bc4\u4f30",
    report: "\u8bc4\u4f30\u62a5\u544a",
    scoreLabel: "\u5f97\u5206",
    suggestions: "\u6539\u8fdb\u5efa\u8bae",
    noSuggestions: "\u975e\u5e38\u597d\uff01\u6ca1\u6709\u66f4\u591a\u5efa\u8bae\u3002",
    submitFailed: "\u8bc4\u4ef7\u63d0\u4ea4\u5931\u8d25\uff0c\u8bf7\u91cd\u8bd5",
  },
  ja: {
    title: "\u82f1\u8a9e\u30e9\u30a4\u30c6\u30a3\u30f3\u30b0\u7df4\u7fd2",
    subtitle: "\u82f1\u6587\u3092\u5165\u529b\u3059\u308b\u3068\u3001AI\u304c\u8a9e\u5f59\u30fb\u6587\u6cd5\u30fb\u69cb\u6210\u3092\u81ea\u52d5\u3067\u8a55\u4fa1\u3057\u307e\u3059\u3002",
    wordCount: "\u5358\u8a9e\u6570",
    evaluating: "\u8a55\u4fa1\u4e2d...",
    submit: "\u8a55\u4fa1\u3092\u63d0\u51fa",
    report: "\u8a55\u4fa1\u30ec\u30dd\u30fc\u30c8",
    scoreLabel: "\u30b9\u30b3\u30a2",
    suggestions: "\u6539\u5584\u63d0\u6848",
    noSuggestions: "\u7d20\u6674\u3089\u3057\u3044\uff01\u3053\u308c\u4ee5\u4e0a\u306e\u63d0\u6848\u306f\u3042\u308a\u307e\u305b\u3093\u3002",
    submitFailed: "\u8a55\u4fa1\u306e\u63d0\u51fa\u306b\u5931\u6557\u3057\u307e\u3057\u305f\u3002\u3082\u3046\u4e00\u5ea6\u304a\u8a66\u3057\u304f\u3060\u3055\u3044\u3002",
  },
} as const;

type WritingResult = {
  score: number;
  wordCount: number;
  feedback: string[];
};

interface WritingViewProps {
  locale: Locale;
  token: string | null;
  tenantCode: string;
}

export function WritingView({ locale, token, tenantCode }: WritingViewProps) {
  const [text, setText] = useState("");
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [result, setResult] = useState<WritingResult | null>(null);
  const t = COPY[locale];

  const wordCount = text.split(/\s+/).filter(Boolean).length;

  const handleSubmit = async () => {
    if (!text.trim() || !token) return;
    setIsEvaluating(true);
    setResult(null);
    try {
      const res = await fetch(`${API_BASE}/writing/evaluate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
          "x-tenant-code": tenantCode,
        },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      setResult(data);
    } catch (error) {
      console.error("Evaluation failed", error);
    } finally {
      setIsEvaluating(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>{t.title}</h2>
        <p className={styles.subtitle}>{t.subtitle}</p>
      </div>

      <div className={styles.workspace}>
        <Card className={styles.editorCard}>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Start writing your essay here..."
            className={styles.textArea}
            disabled={isEvaluating}
            rows={12}
          />
          <div className={styles.metrics}>
            <span>{t.wordCount}: {wordCount}</span>
            <Button onClick={handleSubmit} disabled={isEvaluating || wordCount === 0}>
              {isEvaluating ? t.evaluating : t.submit}
            </Button>
          </div>
        </Card>

        {result && (
          <Card className={styles.resultCard}>
            <div className={styles.resultHeader}>
              <h3>{t.report}</h3>
              <div className={styles.scoreBox}>
                {t.scoreLabel}: <span className={styles.score}>{result.score}</span> / 100
              </div>
            </div>
            <div className={styles.feedbackSection}>
              <h4>{t.suggestions}</h4>
              {result.feedback && result.feedback.length > 0 ? (
                <ul className={styles.feedbackList}>
                  {result.feedback.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              ) : (
                <p>{t.noSuggestions}</p>
              )}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
