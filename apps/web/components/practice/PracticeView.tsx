"use client";

import { useEffect, useState, useCallback } from "react";
import type { ActiveSession, Locale, SessionQuestion, OptionKey } from "../../types";
import { LISTENING_PARTS, READING_PARTS, isListeningPart } from "../../types";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/Card";
import { Button } from "../ui/Button";
import { Select } from "../ui/Select";
import { QuestionCard } from "./QuestionCard";
import { NativeFeedAd } from "../ads/NativeFeedAd";
import styles from "./PracticeView.module.css";

type PracticeType = "listening" | "grammar" | "textcompletion" | "reading";

const COPY = {
  zh: {
    all: "\u5168\u90e8",
    diagnosticBanner: "\u5f53\u524d\u4e3a\u8bca\u65ad\u6a21\u5f0f\uff1a\u6309\u987a\u5e8f\u4f5c\u7b54\uff0c\u5b8c\u6210\u540e\u67e5\u770b\u8584\u5f31\u9879\u3002",
    questionOf: (idx: number, total: number, partNo: number) => `\u7b2c ${idx} / ${total} \u9898 \xb7 Part ${partNo}`,
    prev: "\u4e0a\u4e00\u9898",
    next: "\u4e0b\u4e00\u9898",
    answered: (done: number, total: number) => `\u5df2\u4f5c\u7b54 ${done}/${total}`,
    submitting: "\u63d0\u4ea4\u4e2d...",
    submit: "\u63d0\u4ea4\u672c\u6b21\u8bad\u7ec3",
    types: {
      listening: {
        title: "\u542c\u529b\u8bad\u7ec3\u4e2d\u5fc3 (Part 1-4)",
        diagTitle: "\u8bca\u65ad\u6a21\u5f0f\uff08\u542c\u529b Part 1-4\uff09",
        start: "\u5f00\u59cb\u542c\u529b\u8bad\u7ec3",
        empty: "\u70b9\u51fb\u201c\u5f00\u59cb\u542c\u529b\u8bad\u7ec3\u201d\u540e\u8fdb\u5165\u9010\u9898\u6a21\u5f0f\u3002",
      },
      grammar: {
        title: "\u8bed\u6cd5\u586b\u7a7a\u8bad\u7ec3 (Part 5)",
        diagTitle: "\u8bca\u65ad\u6a21\u5f0f\uff08Part 5\uff09",
        start: "\u5f00\u59cb\u8bed\u6cd5\u8bad\u7ec3",
        empty: "\u70b9\u51fb\u201c\u5f00\u59cb\u8bed\u6cd5\u8bad\u7ec3\u201d\u540e\u8fdb\u5165\u9010\u9898\u6a21\u5f0f\u3002",
      },
      textcompletion: {
        title: "\u6bb5\u843d\u586b\u7a7a\u8bad\u7ec3 (Part 6)",
        diagTitle: "\u8bca\u65ad\u6a21\u5f0f\uff08Part 6\uff09",
        start: "\u5f00\u59cb\u6bb5\u843d\u586b\u7a7a\u8bad\u7ec3",
        empty: "\u70b9\u51fb\u201c\u5f00\u59cb\u6bb5\u843d\u586b\u7a7a\u8bad\u7ec3\u201d\u540e\u8fdb\u5165\u9010\u9898\u6a21\u5f0f\u3002",
      },
      reading: {
        title: "\u9605\u8bfb\u7406\u89e3\u8bad\u7ec3 (Part 7)",
        diagTitle: "\u8bca\u65ad\u6a21\u5f0f\uff08Part 7\uff09",
        start: "\u5f00\u59cb\u9605\u8bfb\u8bad\u7ec3",
        empty: "\u70b9\u51fb\u201c\u5f00\u59cb\u9605\u8bfb\u8bad\u7ec3\u201d\u540e\u8fdb\u5165\u9010\u9898\u6a21\u5f0f\u3002",
      },
    },
  },
  ja: {
    all: "\u3059\u3079\u3066",
    diagnosticBanner: "\u8a3a\u65ad\u30e2\u30fc\u30c9\uff1a\u9806\u756a\u306b\u89e3\u7b54\u3057\u3001\u5b8c\u4e86\u5f8c\u306b\u5f31\u70b9\u3092\u78ba\u8a8d\u3057\u307e\u3059\u3002",
    questionOf: (idx: number, total: number, partNo: number) => `${idx} / ${total} \u554f \xb7 Part ${partNo}`,
    prev: "\u524d\u3078",
    next: "\u6b21\u3078",
    answered: (done: number, total: number) => `\u89e3\u7b54\u6e08 ${done}/${total}`,
    submitting: "\u63d0\u51fa\u4e2d...",
    submit: "\u3053\u306e\u7df4\u7fd2\u3092\u63d0\u51fa",
    types: {
      listening: {
        title: "\u30ea\u30b9\u30cb\u30f3\u30b0\u7df4\u7fd2 (Part 1-4)",
        diagTitle: "\u8a3a\u65ad\u30e2\u30fc\u30c9\uff08\u30ea\u30b9\u30cb\u30f3\u30b0 Part 1-4\uff09",
        start: "\u30ea\u30b9\u30cb\u30f3\u30b0\u7df4\u7fd2\u3092\u958b\u59cb",
        empty: "\u300c\u30ea\u30b9\u30cb\u30f3\u30b0\u7df4\u7fd2\u3092\u958b\u59cb\u300d\u3092\u62bc\u3057\u3066\u304f\u3060\u3055\u3044\u3002",
      },
      grammar: {
        title: "\u6587\u6cd5\u7df4\u7fd2 (Part 5)",
        diagTitle: "\u8a3a\u65ad\u30e2\u30fc\u30c9\uff08Part 5\uff09",
        start: "\u6587\u6cd5\u7df4\u7fd2\u3092\u958b\u59cb",
        empty: "\u300c\u6587\u6cd5\u7df4\u7fd2\u3092\u958b\u59cb\u300d\u3092\u62bc\u3057\u3066\u304f\u3060\u3055\u3044\u3002",
      },
      textcompletion: {
        title: "\u7a7a\u6240\u88dc\u5145\u7df4\u7fd2 (Part 6)",
        diagTitle: "\u8a3a\u65ad\u30e2\u30fc\u30c9\uff08Part 6\uff09",
        start: "\u7a7a\u6240\u88dc\u5145\u7df4\u7fd2\u3092\u958b\u59cb",
        empty: "\u300c\u7a7a\u6240\u88dc\u5145\u7df4\u7fd2\u3092\u958b\u59cb\u300d\u3092\u62bc\u3057\u3066\u304f\u3060\u3055\u3044\u3002",
      },
      reading: {
        title: "\u30ea\u30fc\u30c7\u30a3\u30f3\u30b0\u7df4\u7fd2 (Part 7)",
        diagTitle: "\u8a3a\u65ad\u30e2\u30fc\u30c9\uff08Part 7\uff09",
        start: "\u30ea\u30fc\u30c7\u30a3\u30f3\u30b0\u7df4\u7fd2\u3092\u958b\u59cb",
        empty: "\u300c\u30ea\u30fc\u30c7\u30a3\u30f3\u30b0\u7df4\u7fd2\u3092\u958b\u59cb\u300d\u3092\u62bc\u3057\u3066\u304f\u3060\u3055\u3044\u3002",
      },
    },
  },
} as const;

interface PracticeViewProps {
  type: PracticeType;
  locale: Locale;
  activeSession: ActiveSession | null;
  currentQuestion: SessionQuestion | null;
  currentQuestionIndex: number;
  totalQuestions: number;
  answeredCount: number;
  answerMap: Record<string, OptionKey>;
  practiceHint: string;
  isSubmitting: boolean;
  partFilter: string;
  onPartFilterChange: (value: string) => void;
  onStartPractice: () => void;
  onSelectAnswer: (questionId: string, key: OptionKey) => void;
  onPrevious: () => void;
  onNext: () => void;
  onSubmit: () => void;
  showAds?: boolean;
  token?: string;
  tenantCode?: string;
}

export function PracticeView({
  type,
  locale,
  activeSession,
  currentQuestion,
  currentQuestionIndex,
  totalQuestions,
  answeredCount,
  answerMap,
  practiceHint,
  isSubmitting,
  partFilter,
  onPartFilterChange,
  onStartPractice,
  onSelectAnswer,
  onPrevious,
  onNext,
  onSubmit,
  showAds = false,
  token = "",
  tenantCode = "",
}: PracticeViewProps) {
  const isDiagnosticSession = activeSession?.mode === "diagnostic";
  const [revealedAnswers, setRevealedAnswers] = useState<Record<string, boolean>>({});
  const t = COPY[locale];
  const typeTexts = t.types[type];

  useEffect(() => {
    setRevealedAnswers({});
  }, [activeSession?.attemptId]);

  // Keyboard navigation: ArrowLeft/ArrowRight for prev/next question
  const handleNavKey = useCallback(
    (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (!currentQuestion) return;

      if (e.key === "ArrowLeft" && currentQuestionIndex > 0) {
        e.preventDefault();
        onPrevious();
      } else if (e.key === "ArrowRight" && currentQuestionIndex < totalQuestions - 1) {
        e.preventDefault();
        onNext();
      }
    },
    [currentQuestion, currentQuestionIndex, totalQuestions, onPrevious, onNext],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleNavKey);
    return () => window.removeEventListener("keydown", handleNavKey);
  }, [handleNavKey]);

  // Scroll to top when question changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [currentQuestionIndex]);

  const partsMap = {
    listening: LISTENING_PARTS,
    grammar: [5] as const,
    textcompletion: [6] as const,
    reading: [7] as const,
  } as const;
  const parts = partsMap[type];
  const showPartFilter = type === "listening";

  const partOptions = [
    { value: "all", label: t.all },
    ...parts.map((p) => ({ value: String(p), label: `Part ${p}` })),
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h1">{isDiagnosticSession ? typeTexts.diagTitle : typeTexts.title}</CardTitle>
      </CardHeader>

      <CardContent>
        {!isDiagnosticSession && (
          <div className={styles.filters}>
            {showPartFilter && (
              <Select
                label="Part"
                options={partOptions}
                value={partFilter}
                onChange={(e) => onPartFilterChange(e.target.value)}
              />
            )}
            <div className={styles.filterAction}>
              <Button onClick={onStartPractice}>{typeTexts.start}</Button>
            </div>
          </div>
        )}

        {isDiagnosticSession && (
          <p className={styles.diagnosticBanner}>{t.diagnosticBanner}</p>
        )}

        {!currentQuestion && <p className={styles.empty}>{typeTexts.empty}</p>}

        {currentQuestion && (
          <div className={styles.session}>
            <div className={styles.sessionHeader}>
              <h2>
                {t.questionOf(currentQuestionIndex + 1, totalQuestions, currentQuestion.partNo)}
              </h2>
              <span className={styles.hint}>{practiceHint}</span>
            </div>

            <QuestionCard
              question={currentQuestion}
              selectedAnswer={answerMap[currentQuestion.id]}
              isAnswerRevealed={Boolean(revealedAnswers[currentQuestion.id])}
              onSelectAnswer={(key) => onSelectAnswer(currentQuestion.id, key)}
              onRevealAnswer={() =>
                setRevealedAnswers((prev) => ({
                  ...prev,
                  [currentQuestion.id]: true,
                }))
              }
            />

            {/* Progress bar */}
            <div className={styles.progressBar}>
              <div
                className={styles.progressBarFill}
                style={{ width: `${totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0}%` }}
              />
            </div>

            <div className={styles.navigation}>
              <Button
                variant="secondary"
                onClick={onPrevious}
                disabled={currentQuestionIndex === 0}
              >
                {t.prev}
              </Button>
              <span className={styles.progress}>
                {t.answered(answeredCount, totalQuestions)}
              </span>
              <Button
                variant="secondary"
                onClick={onNext}
                disabled={currentQuestionIndex >= totalQuestions - 1}
              >
                {t.next}
              </Button>
            </div>

            <Button fullWidth onClick={onSubmit} loading={isSubmitting}>
              {isSubmitting ? t.submitting : t.submit}
            </Button>

            {showAds && (
              <NativeFeedAd locale={locale} token={token} tenantCode={tenantCode} showAds={showAds} />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
