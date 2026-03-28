"use client";

import { useState, useCallback, useRef } from "react";
import type {
  ActiveSession,
  Locale,
  OptionKey,
  SessionMode,
  SessionFilters,
  SessionQuestion,
  SubmitReport,
} from "../types";
import { isListeningPart } from "../types";
import * as api from "../lib/api";

export function useSession(
  ensureSession: () => Promise<string | null>,
  getRequestOptions: (token?: string) => { token?: string; tenantCode?: string },
  setMessage: (msg: string) => void,
  locale: Locale,
) {
  const byLocale = (zh: string, ja: string) => (locale === "ja" ? ja : zh);
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answerMap, setAnswerMap] = useState<Record<string, OptionKey>>({});
  const [sessionResult, setSessionResult] = useState<SubmitReport | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const durationMapRef = useRef<Record<string, number>>({});
  const questionStartedAtRef = useRef<number>(0);

  const currentQuestion = activeSession?.questions[currentQuestionIndex] ?? null;
  const answeredCount = Object.keys(answerMap).length;
  const totalQuestions = activeSession?.questions.length ?? 0;

  const practiceHint = currentQuestion
    ? isListeningPart(currentQuestion.partNo)
      ? currentQuestion.partNo <= 2
        ? byLocale("先播放题目音频再作答，仅按 A/B/C/D 选择。", "先に音声を聞いてから A/B/C/D で解答してください。")
        : byLocale("先听音频，再看题干关键词，再做题。", "先に音声を聞き、設問キーワードを確認して解答します。")
      : byLocale("先读题干关键词，再排除干扰项。", "設問キーワードを先に読み、不要な選択肢を除外します。")
    : "";

  const startSession = useCallback(
    async (mode: SessionMode, filters?: SessionFilters): Promise<boolean> => {
      const token = await ensureSession();
      if (!token) return false;

      const result = await api.startSession(mode, filters, getRequestOptions(token));
      if (!result.success || !result.questions) {
        setMessage(byLocale(`开题失败: ${result.error ?? "未知错误"}`, `問題セットの開始に失敗: ${result.error ?? "不明なエラー"}`));
        return false;
      }

      if (result.questions.length === 0) {
        setMessage(byLocale("当前筛选条件下没有题目。", "現在の条件に一致する問題がありません。"));
        return false;
      }

      setActiveSession({
        mode,
        attemptId: result.attemptId!,
        questions: result.questions,
      });
      setCurrentQuestionIndex(0);
      setAnswerMap({});
      setSessionResult(null);
      durationMapRef.current = {};
      questionStartedAtRef.current = Date.now();

      const listeningCount = result.questions.filter((q) => isListeningPart(q.partNo)).length;
      const readingCount = result.questions.length - listeningCount;
      setMessage(
        byLocale(
          `已加载 ${result.questions.length} 题（听力 ${listeningCount} / 阅读 ${readingCount}）。请按顺序逐题作答。`,
          `${result.questions.length} 問を読み込みました（L ${listeningCount} / R ${readingCount}）。順番に解答してください。`,
        ),
      );
      return true;
    },
    [ensureSession, getRequestOptions, locale, setMessage]
  );

  const startMistakeDrill = useCallback(
    async (payload: { partNo?: number; questionIds?: string[]; limit?: number }): Promise<number | null> => {
      const token = await ensureSession();
      if (!token) return null;

      const result = await api.startMistakeDrillSession(payload, getRequestOptions(token));
      if (!result.success || !result.questions) {
        setMessage(byLocale(`错题练习开题失败: ${result.error ?? "未知错误"}`, `ミス演習の開始に失敗: ${result.error ?? "不明なエラー"}`));
        return null;
      }
      if (result.questions.length === 0) {
        setMessage(byLocale("当前错题条件下没有可练习题目。", "現在の条件で練習できるミス問題がありません。"));
        return null;
      }

      setActiveSession({
        mode: "practice",
        attemptId: result.attemptId!,
        questions: result.questions,
      });
      setCurrentQuestionIndex(0);
      setAnswerMap({});
      setSessionResult(null);
      durationMapRef.current = {};
      questionStartedAtRef.current = Date.now();

      const listeningCount = result.questions.filter((q) => isListeningPart(q.partNo)).length;
      const readingCount = result.questions.length - listeningCount;
      setMessage(
        byLocale(
          `已生成错题强化 ${result.questions.length} 题（听力 ${listeningCount} / 阅读 ${readingCount}）。`,
          `ミス強化 ${result.questions.length} 問を生成しました（L ${listeningCount} / R ${readingCount}）。`,
        ),
      );
      return result.questions[0]?.partNo ?? null;
    },
    [ensureSession, getRequestOptions, locale, setMessage]
  );

  const trackCurrentQuestionDuration = useCallback(() => {
    if (!activeSession) return;
    const current = activeSession.questions[currentQuestionIndex];
    if (!current) return;
    const now = Date.now();
    if (questionStartedAtRef.current <= 0) {
      questionStartedAtRef.current = now;
      return;
    }
    const elapsed = Math.max(0, now - questionStartedAtRef.current);
    durationMapRef.current[current.id] = (durationMapRef.current[current.id] ?? 0) + elapsed;
    questionStartedAtRef.current = now;
  }, [activeSession, currentQuestionIndex]);

  const selectAnswer = useCallback((questionId: string, key: OptionKey) => {
    setAnswerMap((prev) => ({ ...prev, [questionId]: key }));
  }, []);

  const goToPrevious = useCallback(() => {
    trackCurrentQuestionDuration();
    setCurrentQuestionIndex((idx) => Math.max(0, idx - 1));
  }, [trackCurrentQuestionDuration]);

  const goToNext = useCallback(() => {
    trackCurrentQuestionDuration();
    setCurrentQuestionIndex((idx) => Math.min(totalQuestions - 1, idx + 1));
  }, [totalQuestions, trackCurrentQuestionDuration]);

  const goToQuestion = useCallback((index: number) => {
    trackCurrentQuestionDuration();
    setCurrentQuestionIndex(Math.max(0, Math.min(totalQuestions - 1, index)));
  }, [totalQuestions, trackCurrentQuestionDuration]);

  const submitSession = useCallback(async (options?: { allowPartial?: boolean }): Promise<SubmitReport | null> => {
    if (!activeSession) return null;

    const token = await ensureSession();
    if (!token) return null;

    trackCurrentQuestionDuration();

    const unanswered = activeSession.questions.filter((q) => !answerMap[q.id]);
    if (unanswered.length > 0 && !options?.allowPartial) {
      setMessage(byLocale(`还有 ${unanswered.length} 题未作答。`, `${unanswered.length} 問が未回答です。`));
      return null;
    }

    const answers = activeSession.questions
      .filter((q) => typeof answerMap[q.id] === "string")
      .map((q) => ({
        questionId: q.id,
        selectedKey: answerMap[q.id],
        durationMs: Math.max(1000, Math.round(durationMapRef.current[q.id] ?? 0)),
      }));

    setIsSubmitting(true);
    try {
      const result = await api.submitSession(
        activeSession.mode,
        activeSession.attemptId,
        answers,
        getRequestOptions(token)
      );

      if (!result.success || !result.report) {
        setMessage(byLocale(`提交失败: ${result.error ?? "未知错误"}`, `提出失敗: ${result.error ?? "不明なエラー"}`));
        return null;
      }

      setSessionResult(result.report);
      setActiveSession(null);
      setCurrentQuestionIndex(0);
      durationMapRef.current = {};
      questionStartedAtRef.current = 0;
      if (options?.allowPartial && unanswered.length > 0) {
        setMessage(
          byLocale(
            `已提交。未作答 ${unanswered.length} 题按错误计入。总分 ${result.report.scoreTotal}。`,
            `提出しました。未回答 ${unanswered.length} 問は誤答として計上。スコア ${result.report.scoreTotal}。`,
          ),
        );
      } else {
        setMessage(
          byLocale(
            `提交成功。总分 ${result.report.scoreTotal}，答对 ${result.report.correct}/${result.report.answered}。`,
            `提出完了。スコア ${result.report.scoreTotal}、正解 ${result.report.correct}/${result.report.answered}。`,
          ),
        );
      }
      return result.report;
    } finally {
      setIsSubmitting(false);
    }
  }, [activeSession, answerMap, ensureSession, getRequestOptions, locale, setMessage, trackCurrentQuestionDuration]);

  const resetSession = useCallback(() => {
    setActiveSession(null);
    setCurrentQuestionIndex(0);
    setAnswerMap({});
    setSessionResult(null);
    durationMapRef.current = {};
    questionStartedAtRef.current = 0;
  }, []);

  return {
    activeSession,
    currentQuestion,
    currentQuestionIndex,
    answerMap,
    sessionResult,
    isSubmitting,
    answeredCount,
    totalQuestions,
    practiceHint,
    startSession,
    selectAnswer,
    goToPrevious,
    goToNext,
    goToQuestion,
    startMistakeDrill,
    submitSession,
    resetSession,
    setSessionResult,
  };
}
