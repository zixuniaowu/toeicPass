/**
 * TOEIC Practice State Machine
 *
 * Defines the canonical states, events, and transition rules for a
 * TOEIC practice / mock-exam session in the browser.
 *
 * Architecture: pure reducer (no side effects here).
 * Integrate with `useExamStateMachine` hook for React usage.
 */

// ── Question types ────────────────────────────────────────────────────────────

export type ToeicPart = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface ExamQuestion {
  id: string;
  partNo: ToeicPart;
  stem: string;
  passage?: string;
  imageUrl?: string;
  mediaUrl?: string;
  options: Array<{ key: "A" | "B" | "C" | "D"; text: string }>;
}

export interface ExamAnswer {
  questionId: string;
  selectedKey: "A" | "B" | "C" | "D" | null;
  markedForReview: boolean;
  answeredAt?: number; // timestamp ms
}

// ── States ────────────────────────────────────────────────────────────────────

export type ExamStatus =
  | "Idle"        // Not yet started
  | "In_Progress" // Timer running, user answering
  | "Paused"      // Timer paused by user
  | "Reviewing"   // Time up / submitted — browsing answers
  | "Finished";   // Scores computed & displayed

// ── Events ────────────────────────────────────────────────────────────────────

export type ExamEvent =
  | { type: "START"; questions: ExamQuestion[]; timeLimitSec: number }
  | { type: "PAUSE" }
  | { type: "RESUME" }
  | { type: "ANSWER"; questionId: string; key: "A" | "B" | "C" | "D" }
  | { type: "TOGGLE_MARK"; questionId: string }
  | { type: "NAVIGATE"; index: number }
  | { type: "SUBMIT" }
  | { type: "TICK" }            // Emitted by the timer every second
  | { type: "TIME_UP" }
  | { type: "RESET" };

// ── Part UI mapping ───────────────────────────────────────────────────────────

/**
 * Maps each TOEIC part to its UI presentation mode.
 *
 * | Part | Description            | UI mode               |
 * |------|------------------------|-----------------------|
 * |  1   | Photographs            | image + 4 audio opts  |
 * |  2   | Question–Response      | audio only, 3 opts    |
 * |  3   | Short Conversations    | audio + passage + 3q  |
 * |  4   | Short Talks            | audio + passage + 3q  |
 * |  5   | Incomplete Sentences   | text stem + 4 opts    |
 * |  6   | Text Completion        | passage + blanks      |
 * |  7   | Reading Comprehension  | long passage + multi  |
 */
export type PartUiMode =
  | "image_audio"     // Part 1
  | "audio_only"      // Part 2
  | "audio_passage"   // Part 3 & 4
  | "sentence"        // Part 5
  | "text_completion" // Part 6
  | "reading";        // Part 7

export const PART_UI_MODE: Record<ToeicPart, PartUiMode> = {
  1: "image_audio",
  2: "audio_only",
  3: "audio_passage",
  4: "audio_passage",
  5: "sentence",
  6: "text_completion",
  7: "reading",
};

/** Time allowed per part in a full mock exam (seconds). */
export const PART_TIME_LIMITS_SEC: Record<ToeicPart, number> = {
  1: 6 * 60,
  2: 25 * 60,
  3: 39 * 60,
  4: 30 * 60,
  5: 40 * 60,
  6: 16 * 60,
  7: 54 * 60,
};

// ── State shape ───────────────────────────────────────────────────────────────

export interface ExamState {
  status: ExamStatus;
  questions: ExamQuestion[];
  answers: Record<string, ExamAnswer>; // keyed by questionId
  currentIndex: number;
  /** Remaining time in seconds. -1 = not started / no limit. */
  remainingSec: number;
  timeLimitSec: number;
  /** Timestamp (ms) when the current "running" segment started. */
  startedAtMs: number | null;
  /** Total elapsed ms at the moment the exam was last paused. */
  elapsedMsAtPause: number;
  /** Part currently in focus (derived from currentIndex). */
  activePart: ToeicPart | null;
}

export const INITIAL_EXAM_STATE: ExamState = {
  status: "Idle",
  questions: [],
  answers: {},
  currentIndex: 0,
  remainingSec: -1,
  timeLimitSec: 0,
  startedAtMs: null,
  elapsedMsAtPause: 0,
  activePart: null,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildInitialAnswers(
  questions: ExamQuestion[],
): Record<string, ExamAnswer> {
  return Object.fromEntries(
    questions.map((q) => [
      q.id,
      { questionId: q.id, selectedKey: null, markedForReview: false },
    ]),
  );
}

function activePart(
  questions: ExamQuestion[],
  index: number,
): ToeicPart | null {
  return questions[index]?.partNo ?? null;
}

// ── Reducer ───────────────────────────────────────────────────────────────────

export function examReducer(
  state: ExamState,
  event: ExamEvent,
): ExamState {
  switch (event.type) {
    case "START": {
      if (state.status !== "Idle") return state;
      return {
        ...INITIAL_EXAM_STATE,
        status: "In_Progress",
        questions: event.questions,
        answers: buildInitialAnswers(event.questions),
        timeLimitSec: event.timeLimitSec,
        remainingSec: event.timeLimitSec,
        startedAtMs: Date.now(),
        activePart: activePart(event.questions, 0),
      };
    }

    case "PAUSE": {
      if (state.status !== "In_Progress") return state;
      const elapsed =
        state.elapsedMsAtPause +
        (state.startedAtMs !== null ? Date.now() - state.startedAtMs : 0);
      return {
        ...state,
        status: "Paused",
        startedAtMs: null,
        elapsedMsAtPause: elapsed,
      };
    }

    case "RESUME": {
      if (state.status !== "Paused") return state;
      return {
        ...state,
        status: "In_Progress",
        startedAtMs: Date.now(),
      };
    }

    case "TICK": {
      if (state.status !== "In_Progress") return state;
      if (state.remainingSec <= 0) {
        return { ...state, status: "Reviewing", remainingSec: 0 };
      }
      return { ...state, remainingSec: state.remainingSec - 1 };
    }

    case "TIME_UP": {
      return { ...state, status: "Reviewing", remainingSec: 0 };
    }

    case "ANSWER": {
      if (state.status !== "In_Progress") return state;
      const prev = state.answers[event.questionId];
      if (!prev) return state;
      return {
        ...state,
        answers: {
          ...state.answers,
          [event.questionId]: {
            ...prev,
            selectedKey: event.key,
            answeredAt: Date.now(),
          },
        },
      };
    }

    case "TOGGLE_MARK": {
      const target = state.answers[event.questionId];
      if (!target) return state;
      return {
        ...state,
        answers: {
          ...state.answers,
          [event.questionId]: {
            ...target,
            markedForReview: !target.markedForReview,
          },
        },
      };
    }

    case "NAVIGATE": {
      const idx = Math.max(0, Math.min(event.index, state.questions.length - 1));
      return {
        ...state,
        currentIndex: idx,
        activePart: activePart(state.questions, idx),
      };
    }

    case "SUBMIT": {
      if (state.status === "Idle" || state.status === "Finished") return state;
      return { ...state, status: "Reviewing", remainingSec: 0 };
    }

    case "RESET": {
      return INITIAL_EXAM_STATE;
    }

    default:
      return state;
  }
}
