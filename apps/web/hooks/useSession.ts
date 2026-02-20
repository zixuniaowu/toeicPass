"use client";

import { useState, useCallback } from "react";
import type {
  ActiveSession,
  SessionMode,
  SessionFilters,
  SessionQuestion,
  SubmitReport,
  OptionKey,
} from "../types";
import { isListeningPart } from "../types";
import * as api from "../lib/api";

export function useSession(
  ensureSession: () => Promise<string | null>,
  getRequestOptions: (token?: string) => { token?: string; tenantCode?: string },
  setMessage: (msg: string) => void
) {
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answerMap, setAnswerMap] = useState<Record<string, OptionKey>>({});
  const [sessionResult, setSessionResult] = useState<SubmitReport | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentQuestion = activeSession?.questions[currentQuestionIndex] ?? null;
  const answeredCount = Object.keys(answerMap).length;
  const totalQuestions = activeSession?.questions.length ?? 0;

  const practiceHint = currentQuestion
    ? isListeningPart(currentQuestion.partNo)
      ? "先听音频，再看图，再做题。"
      : "先读题干关键词，再排除干扰项。"
    : "";

  const startSession = useCallback(
    async (mode: SessionMode, filters?: SessionFilters): Promise<boolean> => {
      const token = await ensureSession();
      if (!token) return false;

      const result = await api.startSession(mode, filters, getRequestOptions(token));
      if (!result.success || !result.questions) {
        setMessage(`开题失败: ${result.error ?? "未知错误"}`);
        return false;
      }

      if (result.questions.length === 0) {
        setMessage("当前筛选条件下没有题目。");
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

      const listeningCount = result.questions.filter((q) => isListeningPart(q.partNo)).length;
      const readingCount = result.questions.length - listeningCount;
      setMessage(
        `已加载 ${result.questions.length} 题（听力 ${listeningCount} / 阅读 ${readingCount}）。请按顺序逐题作答。`
      );
      return true;
    },
    [ensureSession, getRequestOptions, setMessage]
  );

  const selectAnswer = useCallback((questionId: string, key: OptionKey) => {
    setAnswerMap((prev) => ({ ...prev, [questionId]: key }));
  }, []);

  const goToPrevious = useCallback(() => {
    setCurrentQuestionIndex((idx) => Math.max(0, idx - 1));
  }, []);

  const goToNext = useCallback(() => {
    setCurrentQuestionIndex((idx) => Math.min(totalQuestions - 1, idx + 1));
  }, [totalQuestions]);

  const goToQuestion = useCallback((index: number) => {
    setCurrentQuestionIndex(Math.max(0, Math.min(totalQuestions - 1, index)));
  }, [totalQuestions]);

  const submitSession = useCallback(async (): Promise<SubmitReport | null> => {
    if (!activeSession) return null;

    const token = await ensureSession();
    if (!token) return null;

    const unanswered = activeSession.questions.filter((q) => !answerMap[q.id]);
    if (unanswered.length > 0) {
      setMessage(`还有 ${unanswered.length} 题未作答。`);
      return null;
    }

    const answers = activeSession.questions.map((q) => ({
      questionId: q.id,
      selectedKey: answerMap[q.id],
      durationMs: 15000,
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
        setMessage(`提交失败: ${result.error ?? "未知错误"}`);
        return null;
      }

      setSessionResult(result.report);
      setActiveSession(null);
      setCurrentQuestionIndex(0);
      setMessage(
        `提交成功。总分 ${result.report.scoreTotal}，答对 ${result.report.correct}/${result.report.answered}。`
      );
      return result.report;
    } finally {
      setIsSubmitting(false);
    }
  }, [activeSession, answerMap, ensureSession, getRequestOptions, setMessage]);

  const resetSession = useCallback(() => {
    setActiveSession(null);
    setCurrentQuestionIndex(0);
    setAnswerMap({});
    setSessionResult(null);
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
    submitSession,
    resetSession,
    setSessionResult,
  };
}
