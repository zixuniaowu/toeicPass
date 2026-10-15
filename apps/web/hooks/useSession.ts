"use client";

import { useState, useCallback, useRef, useMemo } from "react";
import type {
  ActiveSession,
  UiLang,
  OptionKey,
  SessionMode,
  SessionFilters,
  SessionQuestion,
  SubmitReport,
} from "../types";
import { isListeningPart } from "../types";
import { createT } from "@toeicpass/app-i18n";
import * as api from "../lib/api";

export function useSession(
  ensureSession: () => Promise<string | null>,
  getRequestOptions: (token?: string) => { token?: string; tenantCode?: string },
  setMessage: (msg: string) => void,
  locale: UiLang,
) {
  const t = useMemo(() => createT(locale), [locale]);
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
        ? t("session.tipAudioOnly")
        : t("session.tipListening")
      : t("session.tipReading")
    : "";

  const startSession = useCallback(
    async (mode: SessionMode, filters?: SessionFilters): Promise<boolean> => {
      const token = await ensureSession();
      if (!token) return false;

      const result = await api.startSession(mode, filters, getRequestOptions(token));
      if (!result.success || !result.questions) {
        setMessage(t("session.startFailed", { error: result.error ?? t("session.unknownError") }));
        return false;
      }

      if (result.questions.length === 0) {
        setMessage(t("session.noQuestions"));
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
        t("session.loaded", { count: result.questions.length, listening: listeningCount, reading: readingCount }),
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
        setMessage(t("session.mistakeStartFailed", { error: result.error ?? t("session.unknownError") }));
        return null;
      }
      if (result.questions.length === 0) {
        setMessage(t("session.noMistakeQuestions"));
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
        t("session.mistakeLoaded", { count: result.questions.length, listening: listeningCount, reading: readingCount }),
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
      setMessage(t("session.unanswered", { count: unanswered.length }));
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
        setMessage(t("session.submitFailed", { error: result.error ?? t("session.unknownError") }));
        return null;
      }

      setSessionResult(result.report);
      setActiveSession(null);
      setCurrentQuestionIndex(0);
      durationMapRef.current = {};
      questionStartedAtRef.current = 0;
      if (options?.allowPartial && unanswered.length > 0) {
        setMessage(
          t("session.submittedWithBlank", { count: unanswered.length, score: result.report.scoreTotal }),
        );
      } else {
        setMessage(
          t("session.submitSuccess", { score: result.report.scoreTotal, correct: result.report.correct, answered: result.report.answered }),
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
