"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import type { ActiveSession, Locale, OptionKey, SessionQuestion, SubmitReport } from "../../types";
import { isListeningPart } from "../../types";
import { Button } from "../ui/Button";
import { AudioPlayer } from "../ui/AudioPlayer";
import { QuestionCard } from "../practice/QuestionCard";
import styles from "./MockExamView.module.css";

function enterFullscreen(el: HTMLElement) {
  if (el.requestFullscreen) el.requestFullscreen();
  else if ((el as any).webkitRequestFullscreen) (el as any).webkitRequestFullscreen();
}

function exitFullscreen() {
  if (document.exitFullscreen) document.exitFullscreen();
  else if ((document as any).webkitExitFullscreen) (document as any).webkitExitFullscreen();
}

interface MockExamViewProps {
  locale: Locale;
  activeSession: ActiveSession | null;
  currentQuestion: SessionQuestion | null;
  currentQuestionIndex: number;
  totalQuestions: number;
  answeredCount: number;
  answerMap: Record<string, OptionKey>;
  isSubmitting: boolean;
  sessionResult: SubmitReport | null;
  onStartMock: () => void;
  onSelectAnswer: (questionId: string, key: OptionKey) => void;
  onGoToQuestion: (index: number) => void;
  onPrevious: () => void;
  onNext: () => void;
  onSubmit: (options?: { allowPartial?: boolean }) => void;
}

// Full TOEIC-style mock: 200 questions, 120 minutes.
const MOCK_DURATION_MS = 120 * 60 * 1000;

const COPY = {
  zh: {
    startTitle: "TOEIC 模拟考试",
    startDesc: "模拟真实 TOEIC 考试环境，限时完成所有题目",
    infoQuestionCount: "题目数量",
    infoQuestionCountValue: "200 题",
    infoExamTime: "考试时间",
    infoExamTimeValue: "120 分钟",
    infoCoverage: "题型覆盖",
    infoScoring: "评分方式",
    infoScoringValue: "听力 + 阅读",
    rulesTitle: "考试须知",
    rules: [
      "开始后计时器自动启动，请确保有足够时间",
      "所有题目作答完成后点击「提交试卷」",
      "提交后将显示详细成绩报告",
      "可通过题号导航快速跳转到任意题目",
      "计时结束后仍可继续作答并提交",
    ],
    startButton: "开始模拟考试",
    exitFullscreen: "退出全屏",
    resultTitle: "模拟考试结果",
    totalScore: "预估总分",
    listening: "听力",
    reading: "阅读",
    correctCount: (correct: number, total: number) => `${correct}/${total} 正确`,
    accuracy: "正确率",
    correctItems: "正确题数",
    partPerformance: "各 Part 表现",
    mistakeReview: "错题回顾",
    yourAnswer: "你的答案",
    correctAnswer: "正确答案",
    unanswered: "未答",
    allCorrect: "全部答对！",
    retake: "再来一次模拟考试",
    remainingTime: "剩余时间",
    answered: (answered: number, total: number) => `已答 ${answered}/${total}`,
    hideQuestionNav: "隐藏题号",
    showQuestionNav: "题号导航",
    questionIndex: (current: number, total: number) => `第 ${current} / ${total} 题`,
    previous: "上一题",
    next: "下一题",
    submitting: "提交中...",
    submitPaper: (answered: number, total: number) => `提交试卷 (${answered}/${total} 已答)`,
    reviewInteractive: "逐题回顾错题",
    backToResults: "返回成绩单",
    reviewProgress: (current: number, total: number) => `错题 ${current} / ${total}`,
    reviewPrev: "上一题",
    reviewNext: "下一题",
  },
  ja: {
    startTitle: "TOEIC 模擬試験",
    startDesc: "本番に近い環境で、制限時間内に全問題を解きます",
    infoQuestionCount: "問題数",
    infoQuestionCountValue: "200問",
    infoExamTime: "試験時間",
    infoExamTimeValue: "120分",
    infoCoverage: "出題範囲",
    infoScoring: "採点方式",
    infoScoringValue: "リスニング + リーディング",
    rulesTitle: "受験ガイド",
    rules: [
      "開始するとタイマーが自動で動作します",
      "解答後に「答案を提出」を押してください",
      "提出後に詳細な成績レポートを表示します",
      "問題番号ナビで任意の問題へ移動できます",
      "時間切れ後も解答継続して提出できます",
    ],
    startButton: "模擬試験を開始",
    exitFullscreen: "全画面を終了",
    resultTitle: "模擬試験の結果",
    totalScore: "推定スコア",
    listening: "リスニング",
    reading: "リーディング",
    correctCount: (correct: number, total: number) => `${correct}/${total} 正解`,
    accuracy: "正答率",
    correctItems: "正解数",
    partPerformance: "Part 別パフォーマンス",
    mistakeReview: "ミス問題の確認",
    yourAnswer: "あなたの回答",
    correctAnswer: "正解",
    unanswered: "未回答",
    allCorrect: "全問正解です！",
    retake: "もう一度受験する",
    remainingTime: "残り時間",
    answered: (answered: number, total: number) => `解答済み ${answered}/${total}`,
    hideQuestionNav: "番号ナビを隠す",
    showQuestionNav: "問題番号ナビ",
    questionIndex: (current: number, total: number) => `${current} / ${total} 問`,
    previous: "前の問題",
    next: "次の問題",
    submitting: "提出中...",
    submitPaper: (answered: number, total: number) => `答案を提出 (${answered}/${total} 解答済み)`,
    reviewInteractive: "ミス問題を1問ずつ確認",
    backToResults: "成績表に戻る",
    reviewProgress: (current: number, total: number) => `ミス ${current} / ${total}`,
    reviewPrev: "前の問題",
    reviewNext: "次の問題",
  },
} as const;

export function MockExamView({
  locale,
  activeSession,
  currentQuestion,
  currentQuestionIndex,
  totalQuestions,
  answeredCount,
  answerMap,
  isSubmitting,
  sessionResult,
  onStartMock,
  onSelectAnswer,
  onGoToQuestion,
  onPrevious,
  onNext,
  onSubmit,
}: MockExamViewProps) {
  const copy = COPY[locale];
  const [timerMs, setTimerMs] = useState(MOCK_DURATION_MS);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [showQuestionNav, setShowQuestionNav] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [reviewMode, setReviewMode] = useState(false);
  const [reviewIndex, setReviewIndex] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Wrong items for interactive review
  const wrongItems = useMemo(
    () => (sessionResult ? sessionResult.review.filter((r) => !r.isCorrect) : []),
    [sessionResult],
  );

  // Timer logic
  useEffect(() => {
    if (isTimerRunning && timerMs > 0) {
      intervalRef.current = setInterval(() => {
        setTimerMs((prev) => Math.max(prev - 1000, 0));
      }, 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isTimerRunning, timerMs]);

  // Auto-stop timer when time runs out
  useEffect(() => {
    if (timerMs === 0 && isTimerRunning) {
      setIsTimerRunning(false);
      if (activeSession && !isSubmitting) {
        onSubmit({ allowPartial: true });
      }
    }
  }, [timerMs, isTimerRunning, activeSession, isSubmitting, onSubmit]);

  // Track fullscreen changes (e.g. user presses Esc)
  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const handleStartExam = useCallback(() => {
    setTimerMs(MOCK_DURATION_MS);
    setIsTimerRunning(true);
    if (containerRef.current) enterFullscreen(containerRef.current);
    onStartMock();
  }, [onStartMock]);

  const handleExitFullscreen = useCallback(() => {
    exitFullscreen();
  }, []);

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

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };

  const timerPercent = (timerMs / MOCK_DURATION_MS) * 100;
  const isTimeWarning = timerMs < 5 * 60 * 1000; // < 5 min
  const isTimeCritical = timerMs < 2 * 60 * 1000; // < 2 min

  // If no session and no result, show start screen
  if (!activeSession && !sessionResult) {
    return (
      <div ref={containerRef} className={styles.container}>
        <div className={styles.startScreen}>
          <h2>{copy.startTitle}</h2>
          <p className={styles.startDesc}>{copy.startDesc}</p>

          <div className={styles.examInfo}>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>{copy.infoQuestionCount}</span>
              <strong>{copy.infoQuestionCountValue}</strong>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>{copy.infoExamTime}</span>
              <strong>{copy.infoExamTimeValue}</strong>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>{copy.infoCoverage}</span>
              <strong>Part 1-7</strong>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>{copy.infoScoring}</span>
              <strong>{copy.infoScoringValue}</strong>
            </div>
          </div>

          <div className={styles.examRules}>
            <h3>{copy.rulesTitle}</h3>
            <ul>{copy.rules.map((rule) => <li key={rule}>{rule}</li>)}</ul>
          </div>

          <Button fullWidth onClick={handleStartExam}>
            {copy.startButton}
          </Button>
        </div>
      </div>
    );
  }

  // Show results after submission
  if (sessionResult) {
    const accuracy = sessionResult.answered > 0 ? Math.round((sessionResult.correct / sessionResult.answered) * 100) : 0;
    const listeningItems = sessionResult.review.filter((r) => r.partNo !== null && isListeningPart(r.partNo));
    const readingItems = sessionResult.review.filter((r) => r.partNo !== null && !isListeningPart(r.partNo));
    const listeningCorrect = listeningItems.filter((r) => r.isCorrect).length;
    const readingCorrect = readingItems.filter((r) => r.isCorrect).length;

    // Interactive step-through review mode
    if (reviewMode && wrongItems.length > 0) {
      const item = wrongItems[reviewIndex];
      return (
        <div ref={containerRef} className={`${styles.container} ${isFullscreen ? styles.fullscreen : ""}`}>
          <div className={styles.reviewScreen}>
            <div className={styles.reviewHeader}>
              <button className={styles.reviewBackBtn} onClick={() => setReviewMode(false)}>
                ← {copy.backToResults}
              </button>
              <span className={styles.reviewProgress}>
                {copy.reviewProgress(reviewIndex + 1, wrongItems.length)}
              </span>
            </div>

            <div className={styles.reviewCard}>
              <div className={styles.reviewPartBadge}>Part {item.partNo}</div>
              <p className={styles.reviewStem}>{item.stem}</p>

              {item.mediaUrl && (
                <AudioPlayer src={item.mediaUrl} locale={locale} compact />
              )}

              <div className={styles.reviewAnswers}>
                <div className={styles.reviewAnswerWrong}>
                  <span className={styles.reviewAnswerLabel}>{copy.yourAnswer}</span>
                  <strong>{item.selectedKey ?? copy.unanswered}</strong>
                </div>
                <div className={styles.reviewAnswerCorrect}>
                  <span className={styles.reviewAnswerLabel}>{copy.correctAnswer}</span>
                  <strong>{item.correctKey}</strong>
                </div>
              </div>

              <div className={styles.reviewExplanation}>
                <p>{item.explanation}</p>
              </div>
            </div>

            <div className={styles.reviewNav}>
              <Button
                variant="secondary"
                onClick={() => setReviewIndex((i) => Math.max(0, i - 1))}
                disabled={reviewIndex === 0}
              >
                {copy.reviewPrev}
              </Button>
              <Button
                variant="secondary"
                onClick={() => setReviewIndex((i) => Math.min(wrongItems.length - 1, i + 1))}
                disabled={reviewIndex >= wrongItems.length - 1}
              >
                {copy.reviewNext}
              </Button>
            </div>

            <Button fullWidth variant="secondary" onClick={() => setReviewMode(false)}>
              {copy.backToResults}
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div ref={containerRef} className={`${styles.container} ${isFullscreen ? styles.fullscreen : ""}`}>
        {isFullscreen && (
          <button className={styles.exitFullscreenBtn} onClick={handleExitFullscreen}>{copy.exitFullscreen}</button>
        )}
        <div className={styles.resultScreen}>
          <h2>{copy.resultTitle}</h2>

          <div className={styles.scoreCard}>
            <div className={styles.totalScore}>
              <span>{copy.totalScore}</span>
              <strong>{sessionResult.scoreTotal}</strong>
              <span className={styles.scoreRange}>/ 990</span>
            </div>
            <div className={styles.scoreBreakdown}>
              <div className={styles.scoreSection}>
                <span>{copy.listening}</span>
                <strong>{sessionResult.scoreL}</strong>
                <span className={styles.sectionDetail}>{copy.correctCount(listeningCorrect, listeningItems.length)}</span>
              </div>
              <div className={styles.scoreSection}>
                <span>{copy.reading}</span>
                <strong>{sessionResult.scoreR}</strong>
                <span className={styles.sectionDetail}>{copy.correctCount(readingCorrect, readingItems.length)}</span>
              </div>
            </div>
          </div>

          <div className={styles.statsRow}>
            <div className={styles.statItem}>
              <span>{copy.accuracy}</span>
              <strong>{accuracy}%</strong>
            </div>
            <div className={styles.statItem}>
              <span>{copy.correctItems}</span>
              <strong>{sessionResult.correct}/{sessionResult.answered}</strong>
            </div>
          </div>

          {/* Per-part breakdown */}
          <div className={styles.partBreakdown}>
            <h3>{copy.partPerformance}</h3>
            {[1, 2, 3, 4, 5, 6, 7].map((p) => {
              const items = sessionResult.review.filter((r) => r.partNo === p);
              if (items.length === 0) return null;
              const correct = items.filter((r) => r.isCorrect).length;
              const pct = Math.round((correct / items.length) * 100);
              return (
                <div key={p} className={styles.partRow}>
                  <span className={styles.partLabel}>Part {p}</span>
                  <div className={styles.partBar}>
                    <div className={styles.partBarFill} style={{ width: `${pct}%`, background: pct >= 80 ? "#10b981" : pct >= 60 ? "#f59e0b" : "#dc2626" }} />
                  </div>
                  <span className={styles.partScore}>{correct}/{items.length} ({pct}%)</span>
                </div>
              );
            })}
          </div>

          {/* Wrong answers review */}
          <div className={styles.wrongSection}>
            <h3>{copy.mistakeReview}</h3>
            {wrongItems.length > 0 && (
              <Button
                fullWidth
                variant="secondary"
                onClick={() => { setReviewIndex(0); setReviewMode(true); }}
              >
                {copy.reviewInteractive} ({wrongItems.length})
              </Button>
            )}
            {wrongItems.map((item) => (
              <div key={item.questionId} className={styles.wrongItem}>
                <div className={styles.wrongHeader}>
                  <span className={styles.wrongPart}>Part {item.partNo}</span>
                  <span className={styles.wrongAnswer}>
                    {copy.yourAnswer}: {item.selectedKey ?? copy.unanswered} | {copy.correctAnswer}: {item.correctKey}
                  </span>
                </div>
                <p className={styles.wrongStem}>{item.stem}</p>
                <p className={styles.wrongExplanation}>{item.explanation}</p>
              </div>
            ))}
            {wrongItems.length === 0 && (
              <p className={styles.allCorrect}>{copy.allCorrect}</p>
            )}
          </div>

          <Button fullWidth onClick={handleStartExam}>
            {copy.retake}
          </Button>
        </div>
      </div>
    );
  }

  // Active exam session
  return (
    <div ref={containerRef} className={`${styles.container} ${isFullscreen ? styles.fullscreen : ""}`}>
      {isFullscreen && (
        <button className={styles.exitFullscreenBtn} onClick={handleExitFullscreen}>{copy.exitFullscreen}</button>
      )}
      {/* Timer bar */}
      <div className={`${styles.timerBar} ${isTimeCritical ? styles.timerBarCritical : isTimeWarning ? styles.timerBarWarning : ""}`}>
        <div className={styles.timerInfo}>
          <span className={`${styles.timerDisplay} ${isTimeCritical ? styles.timerCritical : isTimeWarning ? styles.timerWarning : ""}`}>
            {formatTime(timerMs)}
          </span>
          <span className={styles.timerLabel}>{copy.remainingTime}</span>
        </div>
        <div className={styles.timerTrack}>
          <div className={`${styles.timerFill} ${isTimeCritical ? styles.timerFillCritical : isTimeWarning ? styles.timerFillWarning : ""}`} style={{ width: `${timerPercent}%` }} />
        </div>
        <div className={styles.timerActions}>
          <span className={styles.progressText}>{copy.answered(answeredCount, totalQuestions)}</span>
          <button className={styles.navToggle} onClick={() => setShowQuestionNav(!showQuestionNav)}>
            {showQuestionNav ? copy.hideQuestionNav : copy.showQuestionNav}
          </button>
        </div>
      </div>

      {/* Question number navigation */}
      {showQuestionNav && activeSession && (
        <div className={styles.questionNav}>
          {activeSession.questions.map((q, i) => {
            const isAnswered = !!answerMap[q.id];
            const isCurrent = i === currentQuestionIndex;
            return (
              <button
                key={q.id}
                className={`${styles.qNum} ${isCurrent ? styles.qNumCurrent : ""} ${isAnswered ? styles.qNumAnswered : ""}`}
                onClick={() => onGoToQuestion(i)}
              >
                {i + 1}
              </button>
            );
          })}
        </div>
      )}

      {/* Question area */}
      {currentQuestion && (
        <div className={styles.examBody}>
          <div className={styles.questionHeader}>
            <h2>{copy.questionIndex(currentQuestionIndex + 1, totalQuestions)}</h2>
            <span className={styles.partBadge}>Part {currentQuestion.partNo}</span>
          </div>

          <QuestionCard
            question={currentQuestion}
            locale={locale}
            selectedAnswer={answerMap[currentQuestion.id]}
            isAnswerRevealed={false}
            onSelectAnswer={(key) => onSelectAnswer(currentQuestion.id, key)}
            onRevealAnswer={() => {
              // Mock mode keeps answers hidden until submit.
            }}
          />

          <div className={styles.examNav}>
            <Button variant="secondary" onClick={onPrevious} disabled={currentQuestionIndex === 0}>
              {copy.previous}
            </Button>
            <Button variant="secondary" onClick={onNext} disabled={currentQuestionIndex >= totalQuestions - 1}>
              {copy.next}
            </Button>
          </div>

          <Button fullWidth onClick={() => onSubmit({ allowPartial: true })} loading={isSubmitting}>
            {isSubmitting ? copy.submitting : copy.submitPaper(answeredCount, totalQuestions)}
          </Button>
        </div>
      )}
    </div>
  );
}
