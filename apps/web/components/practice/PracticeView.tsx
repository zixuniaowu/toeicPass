"use client";

import type { ActiveSession, SessionQuestion, OptionKey } from "../../types";
import { LISTENING_PARTS, READING_PARTS, isListeningPart } from "../../types";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/Card";
import { Button } from "../ui/Button";
import { Select } from "../ui/Select";
import { QuestionCard } from "./QuestionCard";
import styles from "./PracticeView.module.css";

type PracticeType = "listening" | "grammar" | "textcompletion" | "reading";

interface PracticeViewProps {
  type: PracticeType;
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
}

export function PracticeView({
  type,
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
}: PracticeViewProps) {
  const getTypeConfig = () => {
    switch (type) {
      case "listening":
        return {
          title: "听力训练中心 (Part 1-4)",
          startLabel: "开始听力训练",
          emptyLabel: '点击"开始听力训练"后进入逐题模式。',
          showPartFilter: true,
          parts: LISTENING_PARTS,
        };
      case "grammar":
        return {
          title: "语法填空训练 (Part 5)",
          startLabel: "开始语法训练",
          emptyLabel: '点击"开始语法训练"后进入逐题模式。',
          showPartFilter: false,
          parts: [5] as const,
        };
      case "textcompletion":
        return {
          title: "段落填空训练 (Part 6)",
          startLabel: "开始段落填空训练",
          emptyLabel: '点击"开始段落填空训练"后进入逐题模式。',
          showPartFilter: false,
          parts: [6] as const,
        };
      case "reading":
        return {
          title: "阅读理解训练 (Part 7)",
          startLabel: "开始阅读训练",
          emptyLabel: '点击"开始阅读训练"后进入逐题模式。',
          showPartFilter: false,
          parts: [7] as const,
        };
    }
  };

  const config = getTypeConfig();

  const partOptions = [
    { value: "all", label: "全部" },
    ...config.parts.map((p) => ({ value: String(p), label: `Part ${p}` })),
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h1">{config.title}</CardTitle>
      </CardHeader>

      <CardContent>
        <div className={styles.filters}>
          {config.showPartFilter && (
            <Select
              label="Part"
              options={partOptions}
              value={partFilter}
              onChange={(e) => onPartFilterChange(e.target.value)}
            />
          )}
          <div className={styles.filterAction}>
            <Button onClick={onStartPractice}>{config.startLabel}</Button>
          </div>
        </div>

        {!currentQuestion && <p className={styles.empty}>{config.emptyLabel}</p>}

        {currentQuestion && (
          <div className={styles.session}>
            <div className={styles.sessionHeader}>
              <h2>
                第 {currentQuestionIndex + 1} / {totalQuestions} 题 · Part {currentQuestion.partNo}
              </h2>
              <span className={styles.hint}>{practiceHint}</span>
            </div>

            <QuestionCard
              question={currentQuestion}
              selectedAnswer={answerMap[currentQuestion.id]}
              onSelectAnswer={(key) => onSelectAnswer(currentQuestion.id, key)}
            />

            <div className={styles.navigation}>
              <Button
                variant="secondary"
                onClick={onPrevious}
                disabled={currentQuestionIndex === 0}
              >
                上一题
              </Button>
              <span className={styles.progress}>
                已作答 {answeredCount}/{totalQuestions}
              </span>
              <Button
                variant="secondary"
                onClick={onNext}
                disabled={currentQuestionIndex >= totalQuestions - 1}
              >
                下一题
              </Button>
            </div>

            <Button fullWidth onClick={onSubmit} disabled={isSubmitting}>
              {isSubmitting ? "提交中..." : "提交本次训练"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
