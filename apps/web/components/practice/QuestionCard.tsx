"use client";

import { useRef, useEffect, useCallback } from "react";
import type { Locale, OptionKey, SessionQuestion } from "../../types";
import { isListeningPart } from "../../types";
import { AudioPlayer } from "../ui/AudioPlayer";
import { SelectionPronunciation } from "../ui/SelectionPronunciation";
import { Button } from "../ui/Button";
import styles from "./QuestionCard.module.css";

const COPY = {
  zh: {
    noCorrectKey: "当前题目未返回标准答案，请刷新后重开训练。",
    correctAnswer: "正确答案",
    optionAnalysis: "选项解析",
    correct: "正确",
    incorrect: "错误",
    matchesKey: "与题干/音频关键信息一致",
    mismatchesKey: "与题干/音频关键信息不一致",
    audioMatched: "听力题目音频（题目匹配）",
    audioTts: "听力题目朗读（官方文本）",
    ttsPlay12: "播放题目（仅听音频作答）",
    ttsPlayMatch: "播放题目（与当前题目匹配）",
    ttsPlayFallback: "播放官方文本朗读（无原始音频）",
    passageScript: "官方脚本文本（非原始音频）",
    passageRef: "参考材料",
    listenPrompt: (choices: string) => `请听音频后，仅按 ${choices} 作答。`,
    answerRevealed: "答案与解析已显示",
    revealAnswer: "查看答案与解析",
    selectFirst: "请先选择答案",
    correctLabel: "正确答案：",
    noCorrectInSession: "当前会话未返回正确答案，请刷新后重开本次训练。",
    yourAnswer: "你的答案：",
    explanation: "详细解释",
  },
  ja: {
    noCorrectKey: "この問題の正解が返されませんでした。更新して再開してください。",
    correctAnswer: "正解",
    optionAnalysis: "選択肢の解析",
    correct: "正解",
    incorrect: "不正解",
    matchesKey: "設問/音声のキー情報と一致",
    mismatchesKey: "設問/音声のキー情報と不一致",
    audioMatched: "リスニング音声（問題に対応）",
    audioTts: "リスニング読み上げ（公式テキスト）",
    ttsPlay12: "問題を再生（音声のみで回答）",
    ttsPlayMatch: "問題を再生（現在の問題に対応）",
    ttsPlayFallback: "公式テキスト読み上げ（元の音声なし）",
    passageScript: "公式スクリプト（元の音声なし）",
    passageRef: "参考資料",
    listenPrompt: (choices: string) => `音声を聞いてから ${choices} で回答してください。`,
    answerRevealed: "解答と解説を表示済み",
    revealAnswer: "解答と解説を見る",
    selectFirst: "先に回答を選んでください",
    correctLabel: "正解：",
    noCorrectInSession: "このセッションで正解が返されませんでした。更新して再開してください。",
    yourAnswer: "あなたの回答：",
    explanation: "詳しい解説",
  },
} as const;

interface QuestionCardProps {
  question: SessionQuestion;
  locale?: Locale;
  selectedAnswer: OptionKey | undefined;
  isAnswerRevealed: boolean;
  onSelectAnswer: (key: OptionKey) => void;
  onRevealAnswer: () => void;
}

function fallbackExplanation(question: SessionQuestion, locale: Locale): string {
  const t = COPY[locale];
  if (!question.correctKey) {
    return t.noCorrectKey;
  }
  const lines = [
    `${t.correctAnswer}：${question.correctKey}`,
    `${t.optionAnalysis}：`,
    ...question.options.map((opt) => {
      const verdict = opt.key === question.correctKey ? t.correct : t.incorrect;
      const reason =
        opt.key === question.correctKey
          ? t.matchesKey
          : t.mismatchesKey;
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
  const explanationText = question.explanation?.trim() || fallbackExplanation(question, locale);
  const textScopeRef = useRef<HTMLDivElement | null>(null);
  const t = COPY[locale];
  const passageLabel =
    isListening && !question.mediaUrl
      ? t.passageScript
      : t.passageRef;

  // Keyboard shortcuts: A/B/C/D to select, Enter to reveal answer
  const validKeys = question.options.map((opt) => opt.key);
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Skip if user is typing in an input/textarea
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      const upper = e.key.toUpperCase() as OptionKey;
      if (validKeys.includes(upper)) {
        e.preventDefault();
        onSelectAnswer(upper);
      } else if (e.key === "Enter" && canRevealAnswer && !isAnswerRevealed) {
        e.preventDefault();
        onRevealAnswer();
      }
    },
    [validKeys, onSelectAnswer, canRevealAnswer, isAnswerRevealed, onRevealAnswer],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

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
          label={question.mediaUrl ? t.audioMatched : t.audioTts}
          locale={locale}
          ttsText={ttsText}
          ttsLabel={
            question.mediaUrl
              ? question.partNo <= 2
                ? t.ttsPlay12
                : t.ttsPlayMatch
              : t.ttsPlayFallback
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
        <p className={styles.listeningPrompt}>{t.listenPrompt(choicePrompt)}</p>
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
            ? t.answerRevealed
            : canRevealAnswer
              ? t.revealAnswer
              : t.selectFirst}
        </Button>
      </div>

      {isAnswerRevealed && (
        <div className={styles.answerPanel}>
          <p className={styles.answerLine}>
            <strong>{t.correctLabel}</strong>
            {question.correctKey
              ? `${question.correctKey}. ${correctOption?.text ?? ""}`.trim()
              : t.noCorrectInSession}
          </p>
          <p className={styles.answerLine}>
            <strong>{t.yourAnswer}</strong>
            {selectedAnswer
              ? `${selectedAnswer}. ${selectedOption?.text ?? ""}`.trim()
              : "—"}
          </p>
          {/* Filled sentence for Part 5 fill-in-the-blank */}
          {question.partNo === 5 && question.stem?.includes("___") && correctOption && (
            <div className={styles.filledSentence}>
              <span className={styles.sentenceLabel}>
                {locale === "ja" ? "完成文：" : "完整句子："}
              </span>
              {question.stem.replace(/___+/, correctOption.text)}
            </div>
          )}

          <p className={styles.answerLabel}>{t.explanation}</p>
          <p className={styles.answerExplanation}>{explanationText}</p>

          {/* Option-by-option analysis for Part 5 */}
          {question.partNo === 5 && (
            <div className={styles.optionAnalysis}>
              <p className={styles.analysisLabel}>
                {locale === "ja" ? "選択肢の分析：" : "选项逐一分析："}
              </p>
              {question.options.map((opt) => {
                const isCorrect = opt.key === question.correctKey;
                return (
                  <div
                    key={opt.key}
                    className={`${styles.optionRow} ${isCorrect ? styles.optionCorrect : styles.optionWrong}`}
                  >
                    <span className={styles.optionMarker}>
                      {isCorrect ? "✓" : "✗"}
                    </span>
                    <span className={styles.optionKey}>{opt.key}.</span>
                    <span className={styles.optionText}>{opt.text}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <SelectionPronunciation scopeRef={textScopeRef} locale={locale} />
    </div>
  );
}
