"use client";

import { useRef } from "react";
import type { Locale, OptionKey, SessionQuestion } from "../../types";
import { isListeningPart } from "../../types";
import { AudioPlayer } from "../ui/AudioPlayer";
import { SelectionPronunciation } from "../ui/SelectionPronunciation";
import { Button } from "../ui/Button";
import styles from "./QuestionCard.module.css";

interface QuestionCardProps {
  question: SessionQuestion;
  locale?: Locale;
  selectedAnswer: OptionKey | undefined;
  isAnswerRevealed: boolean;
  onSelectAnswer: (key: OptionKey) => void;
  onRevealAnswer: () => void;
}

function fallbackExplanation(question: SessionQuestion): string {
  if (!question.correctKey) {
    return "当前题目未返回标准答案，请刷新后重开训练。";
  }
  const lines = [
    `正确答案：${question.correctKey}`,
    "选项解析：",
    ...question.options.map((opt) => {
      const verdict = opt.key === question.correctKey ? "正确" : "错误";
      const reason =
        opt.key === question.correctKey
          ? "与题干/音频关键信息一致"
          : "与题干/音频关键信息不一致";
      return `${opt.key}. ${opt.text}（${verdict}：${reason}）`;
    }),
  ];
  return lines.join("\n");
}

function shouldShowPart1Image(question: SessionQuestion): boolean {
  if (question.partNo !== 1 || !question.imageUrl) {
    return false;
  }
  return true;
}

export function QuestionCard({
  question,
  locale = "zh",
  selectedAnswer,
  isAnswerRevealed,
  onSelectAnswer,
  onRevealAnswer,
}: QuestionCardProps) {
  const isListening = isListeningPart(question.partNo);
  const useChoiceKeyOnly = isListening && question.partNo <= 2;
  const hideStem = isListening && question.partNo <= 2;
  const showPart1Image = shouldShowPart1Image(question);
  const choicePrompt =
    question.options.length > 0 ? question.options.map((opt) => opt.key).join(" / ") : "A / B / C / D";
  const ttsText = isListening
    ? `${question.partNo === 1 ? "" : `${question.stem} `}${question.options
        .map((opt) => `${opt.key}. ${opt.text}`)
        .join(" ")}`
    : undefined;
  const correctOption = question.correctKey
    ? question.options.find((opt) => opt.key === question.correctKey)
    : undefined;
  const selectedOption = selectedAnswer
    ? question.options.find((opt) => opt.key === selectedAnswer)
    : undefined;
  const canRevealAnswer = Boolean(selectedAnswer);
  const explanationText = question.explanation?.trim() || fallbackExplanation(question);
  const textScopeRef = useRef<HTMLDivElement | null>(null);
  const passageLabel =
    isListening && !question.mediaUrl
      ? "官方脚本文本（非原始音频）"
      : "参考材料";

  return (
    <div className={styles.card} ref={textScopeRef}>
      {showPart1Image && (
        <div className={styles.imageWrap}>
          <img
            src={question.imageUrl}
            alt={`Part ${question.partNo} visual`}
            className={styles.image}
          />
        </div>
      )}

      {isListening && (question.mediaUrl || ttsText) && (
        <AudioPlayer
          src={question.mediaUrl}
          label={question.mediaUrl ? "听力题目音频（题目匹配）" : "听力题目朗读（官方文本）"}
          ttsText={ttsText}
          ttsLabel={
            question.mediaUrl
              ? question.partNo <= 2
                ? "播放题目（仅听音频作答）"
                : "播放题目（与当前题目匹配）"
              : "播放官方文本朗读（无原始音频）"
          }
        />
      )}

      {question.passage && (
        <div className={styles.passageBox}>
          <p className={styles.passageLabel}>{passageLabel}</p>
          <p className={styles.passage}>{question.passage}</p>
        </div>
      )}

      {hideStem ? (
        <p className={styles.listeningPrompt}>请听音频后，仅按 {choicePrompt} 作答。</p>
      ) : (
        <p className={styles.stem}>{question.stem}</p>
      )}

      <div className={styles.options}>
        {question.options.map((opt) => (
          <button
            key={opt.key}
            className={`${styles.option} ${useChoiceKeyOnly ? styles.optionKeyOnly : ""} ${selectedAnswer === opt.key ? styles.selected : ""}`}
            onClick={() => onSelectAnswer(opt.key)}
          >
            <span className={`${styles.optionKey} ${useChoiceKeyOnly ? styles.optionKeyOnlyText : ""}`}>{opt.key}.</span>
            {!useChoiceKeyOnly && <span>{opt.text}</span>}
          </button>
        ))}
      </div>

      <div className={styles.answerAction}>
        <Button
          variant="secondary"
          onClick={onRevealAnswer}
          disabled={isAnswerRevealed || !canRevealAnswer}
        >
          {isAnswerRevealed
            ? "答案与解析已显示"
            : canRevealAnswer
              ? "查看答案与解析"
              : "请先选择答案"}
        </Button>
      </div>

      {isAnswerRevealed && (
        <div className={styles.answerPanel}>
          <p className={styles.answerLine}>
            <strong>正确答案：</strong>
            {question.correctKey
              ? `${question.correctKey}. ${correctOption?.text ?? ""}`.trim()
              : "当前会话未返回正确答案，请刷新后重开本次训练。"}
          </p>
          <p className={styles.answerLine}>
            <strong>你的答案：</strong>
            {selectedAnswer
              ? `${selectedAnswer}. ${selectedOption?.text ?? ""}`.trim()
              : "—"}
          </p>
          <p className={styles.answerLabel}>详细解释</p>
          <p className={styles.answerExplanation}>{explanationText}</p>
        </div>
      )}

      <SelectionPronunciation scopeRef={textScopeRef} locale={locale} />
    </div>
  );
}
