"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { ActiveSession, SessionQuestion, OptionKey, SubmitReport } from "../../types";
import { isListeningPart } from "../../types";
import { Button } from "../ui/Button";
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

export function MockExamView({
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
  const [timerMs, setTimerMs] = useState(MOCK_DURATION_MS);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [showQuestionNav, setShowQuestionNav] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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
          <h2>TOEIC 模拟考试</h2>
          <p className={styles.startDesc}>模拟真实 TOEIC 考试环境，限时完成所有题目</p>

          <div className={styles.examInfo}>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>题目数量</span>
              <strong>200 题</strong>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>考试时间</span>
              <strong>120 分钟</strong>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>题型覆盖</span>
              <strong>Part 1-7</strong>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>评分方式</span>
              <strong>听力 + 阅读</strong>
            </div>
          </div>

          <div className={styles.examRules}>
            <h3>考试须知</h3>
            <ul>
              <li>开始后计时器自动启动，请确保有足够时间</li>
              <li>所有题目作答完成后点击「提交试卷」</li>
              <li>提交后将显示详细成绩报告</li>
              <li>可通过题号导航快速跳转到任意题目</li>
              <li>计时结束后仍可继续作答并提交</li>
            </ul>
          </div>

          <Button fullWidth onClick={handleStartExam}>
            开始模拟考试
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

    return (
      <div ref={containerRef} className={`${styles.container} ${isFullscreen ? styles.fullscreen : ""}`}>
        {isFullscreen && (
          <button className={styles.exitFullscreenBtn} onClick={handleExitFullscreen}>退出全屏</button>
        )}
        <div className={styles.resultScreen}>
          <h2>模拟考试结果</h2>

          <div className={styles.scoreCard}>
            <div className={styles.totalScore}>
              <span>预估总分</span>
              <strong>{sessionResult.scoreTotal}</strong>
              <span className={styles.scoreRange}>/ 990</span>
            </div>
            <div className={styles.scoreBreakdown}>
              <div className={styles.scoreSection}>
                <span>听力</span>
                <strong>{sessionResult.scoreL}</strong>
                <span className={styles.sectionDetail}>{listeningCorrect}/{listeningItems.length} 正确</span>
              </div>
              <div className={styles.scoreSection}>
                <span>阅读</span>
                <strong>{sessionResult.scoreR}</strong>
                <span className={styles.sectionDetail}>{readingCorrect}/{readingItems.length} 正确</span>
              </div>
            </div>
          </div>

          <div className={styles.statsRow}>
            <div className={styles.statItem}>
              <span>正确率</span>
              <strong>{accuracy}%</strong>
            </div>
            <div className={styles.statItem}>
              <span>正确题数</span>
              <strong>{sessionResult.correct}/{sessionResult.answered}</strong>
            </div>
          </div>

          {/* Per-part breakdown */}
          <div className={styles.partBreakdown}>
            <h3>各 Part 表现</h3>
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
            <h3>错题回顾</h3>
            {sessionResult.review.filter((r) => !r.isCorrect).map((item) => (
              <div key={item.questionId} className={styles.wrongItem}>
                <div className={styles.wrongHeader}>
                  <span className={styles.wrongPart}>Part {item.partNo}</span>
                  <span className={styles.wrongAnswer}>
                    你的答案: {item.selectedKey ?? "未答"} | 正确答案: {item.correctKey}
                  </span>
                </div>
                <p className={styles.wrongStem}>{item.stem}</p>
                <p className={styles.wrongExplanation}>{item.explanation}</p>
              </div>
            ))}
            {sessionResult.review.filter((r) => !r.isCorrect).length === 0 && (
              <p className={styles.allCorrect}>全部答对！</p>
            )}
          </div>

          <Button fullWidth onClick={handleStartExam}>
            再来一次模拟考试
          </Button>
        </div>
      </div>
    );
  }

  // Active exam session
  return (
    <div ref={containerRef} className={`${styles.container} ${isFullscreen ? styles.fullscreen : ""}`}>
      {isFullscreen && (
        <button className={styles.exitFullscreenBtn} onClick={handleExitFullscreen}>退出全屏</button>
      )}
      {/* Timer bar */}
      <div className={styles.timerBar}>
        <div className={styles.timerInfo}>
          <span className={`${styles.timerDisplay} ${isTimeCritical ? styles.timerCritical : isTimeWarning ? styles.timerWarning : ""}`}>
            {formatTime(timerMs)}
          </span>
          <span className={styles.timerLabel}>剩余时间</span>
        </div>
        <div className={styles.timerTrack}>
          <div className={`${styles.timerFill} ${isTimeCritical ? styles.timerFillCritical : isTimeWarning ? styles.timerFillWarning : ""}`} style={{ width: `${timerPercent}%` }} />
        </div>
        <div className={styles.timerActions}>
          <span className={styles.progressText}>已答 {answeredCount}/{totalQuestions}</span>
          <button className={styles.navToggle} onClick={() => setShowQuestionNav(!showQuestionNav)}>
            {showQuestionNav ? "隐藏题号" : "题号导航"}
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
            <h2>第 {currentQuestionIndex + 1} / {totalQuestions} 题</h2>
            <span className={styles.partBadge}>Part {currentQuestion.partNo}</span>
          </div>

          <QuestionCard
            question={currentQuestion}
            selectedAnswer={answerMap[currentQuestion.id]}
            isAnswerRevealed={false}
            onSelectAnswer={(key) => onSelectAnswer(currentQuestion.id, key)}
            onRevealAnswer={() => {
              // Mock mode keeps answers hidden until submit.
            }}
          />

          <div className={styles.examNav}>
            <Button variant="secondary" onClick={onPrevious} disabled={currentQuestionIndex === 0}>
              上一题
            </Button>
            <Button variant="secondary" onClick={onNext} disabled={currentQuestionIndex >= totalQuestions - 1}>
              下一题
            </Button>
          </div>

          <Button fullWidth onClick={() => onSubmit({ allowPartial: true })} disabled={isSubmitting}>
            {isSubmitting ? "提交中..." : `提交试卷 (${answeredCount}/${totalQuestions} 已答)`}
          </Button>
        </div>
      )}
    </div>
  );
}
