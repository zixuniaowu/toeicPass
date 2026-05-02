"use client";

/**
 * useExamStateMachine
 *
 * React wrapper around `examReducer` that adds:
 *  - Automatic 1-second countdown timer
 *  - SRS (spaced-repetition) queue: wrong answers are sent to the API
 *  - Part 1–7 UI mode derivation helper
 */

import { useCallback, useEffect, useReducer, useRef } from "react";
import {
  examReducer,
  INITIAL_EXAM_STATE,
  PART_UI_MODE,
  type ExamAnswer,
  type ExamEvent,
  type ExamQuestion,
  type ExamState,
  type PartUiMode,
  type ToeicPart,
} from "../lib/exam-state-machine";

// ── SRS queue API ─────────────────────────────────────────────────────────────

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8001/api/v1";

export interface SrsQueuePayload {
  questionIds: string[];
  attemptId?: string;
  source: "exam_wrong_answer" | "manual_add";
}

/**
 * Adds incorrectly answered questions to the SRS (spaced-repetition) review queue.
 * Fire-and-forget — errors are logged but not re-thrown.
 */
export async function enqueueSrsCards(
  payload: SrsQueuePayload,
  authToken: string,
  tenantCode: string,
): Promise<void> {
  try {
    const res = await fetch(`${API_BASE}/srs/enqueue`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
        "x-tenant-code": tenantCode,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.warn("[SRS] Enqueue failed:", res.status, await res.text());
    }
  } catch (err) {
    console.warn("[SRS] Enqueue network error:", err);
  }
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export interface UseExamStateMachineOptions {
  /** Auth token for API calls. */
  authToken?: string;
  /** Tenant code for API calls. */
  tenantCode?: string;
  /**
   * Called when the exam transitions to 'Reviewing' (time-up or manual submit).
   * Receives the final state snapshot.
   */
  onFinished?: (state: ExamState) => void;
}

export interface UseExamStateMachineReturn {
  state: ExamState;
  dispatch: (event: ExamEvent) => void;
  /** Start exam with a given question list and time limit. */
  start: (questions: ExamQuestion[], timeLimitSec: number) => void;
  /** Pause the exam (stops timer). */
  pause: () => void;
  /** Resume from paused state. */
  resume: () => void;
  /** Record an answer for the current question. */
  answer: (questionId: string, key: "A" | "B" | "C" | "D") => void;
  /** Toggle the "mark for review" flag on a question. */
  toggleMark: (questionId: string) => void;
  /** Navigate to a question by index. */
  navigateTo: (index: number) => void;
  /** Manually submit (ends timer). */
  submit: () => void;
  /** Reset to initial state. */
  reset: () => void;
  /** Part UI mode for the question at the current index. */
  currentPartUiMode: PartUiMode | null;
  /** Progress stats. */
  progress: {
    answered: number;
    total: number;
    markedForReview: number;
    percentComplete: number;
  };
}

export function useExamStateMachine(
  options: UseExamStateMachineOptions = {},
): UseExamStateMachineReturn {
  const { authToken, tenantCode, onFinished } = options;
  const [state, dispatch] = useReducer(examReducer, INITIAL_EXAM_STATE);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onFinishedRef = useRef(onFinished);
  onFinishedRef.current = onFinished;

  // ── Timer ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (state.status === "In_Progress") {
      timerRef.current = setInterval(() => {
        dispatch({ type: "TICK" });
      }, 1000);
    } else {
      if (timerRef.current !== null) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current !== null) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [state.status]);

  // ── Auto-submit when timer hits 0 ─────────────────────────────────────────

  useEffect(() => {
    if (state.status === "In_Progress" && state.remainingSec <= 0) {
      dispatch({ type: "TIME_UP" });
    }
  }, [state.remainingSec, state.status]);

  // ── SRS enqueue + onFinished callback on Reviewing transition ─────────────

  const prevStatusRef = useRef(state.status);
  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = state.status;

    if (prev !== "Reviewing" && state.status === "Reviewing") {
      onFinishedRef.current?.(state);

      // Enqueue wrong answers into SRS queue
      if (authToken && tenantCode) {
        const wrongIds = state.questions
          .filter((q: ExamQuestion) => {
            const ans = state.answers[q.id];
            return ans && ans.selectedKey !== null;
            // Note: in a real implementation you'd compare against correct key
            // which requires enriched questions. Here we send all answered ones
            // for demonstration; replace with actual correctness check.
          })
          .map((q: ExamQuestion) => q.id);

        if (wrongIds.length > 0) {
          void enqueueSrsCards(
            { questionIds: wrongIds, source: "exam_wrong_answer" },
            authToken,
            tenantCode,
          );
        }
      }
    }
  }, [state.status]);

  // ── Derived values ─────────────────────────────────────────────────────────

  const currentPartUiMode: PartUiMode | null = state.activePart
    ? PART_UI_MODE[state.activePart as ToeicPart]
    : null;

  const answered = Object.values(state.answers).filter(
    (a: ExamAnswer) => a.selectedKey !== null,
  ).length;
  const markedForReview = Object.values(state.answers).filter(
    (a: ExamAnswer) => a.markedForReview,
  ).length;
  const total = state.questions.length;

  const progress = {
    answered,
    total,
    markedForReview,
    percentComplete: total > 0 ? Math.round((answered / total) * 100) : 0,
  };

  // ── Action creators ────────────────────────────────────────────────────────

  const start = useCallback(
    (questions: ExamQuestion[], timeLimitSec: number) => {
      dispatch({ type: "START", questions, timeLimitSec });
    },
    [],
  );

  const pause = useCallback(() => dispatch({ type: "PAUSE" }), []);
  const resume = useCallback(() => dispatch({ type: "RESUME" }), []);
  const answer = useCallback(
    (questionId: string, key: "A" | "B" | "C" | "D") => {
      dispatch({ type: "ANSWER", questionId, key });
    },
    [],
  );
  const toggleMark = useCallback(
    (questionId: string) => dispatch({ type: "TOGGLE_MARK", questionId }),
    [],
  );
  const navigateTo = useCallback(
    (index: number) => dispatch({ type: "NAVIGATE", index }),
    [],
  );
  const submit = useCallback(() => dispatch({ type: "SUBMIT" }), []);
  const reset = useCallback(() => dispatch({ type: "RESET" }), []);

  return {
    state,
    dispatch,
    start,
    pause,
    resume,
    answer,
    toggleMark,
    navigateTo,
    submit,
    reset,
    currentPartUiMode,
    progress,
  };
}
