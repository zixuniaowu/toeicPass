import {
  compareWords,
  type CompareWord,
  type TrainingLanguage,
} from "./shadowing-compare";
import { createShadowingReview, type ShadowingReview } from "./shadowing-engine";
import { ScoreCalculator } from "./shadowing-score";

export type ShadowingComparisonFeedback = {
  recognizedText: string;
  accuracy: number;
  words: CompareWord[];
};

export type ShadowingFeedbackState = {
  recordingUri: string | null;
  audioStatus: string;
  comparison: ShadowingComparisonFeedback | null;
  review: ShadowingReview | null;
};

export function createEmptyShadowingFeedback(): ShadowingFeedbackState {
  return {
    recordingUri: null,
    audioStatus: "",
    comparison: null,
    review: null,
  };
}

export function createRecordingInProgressFeedback(audioStatus: string): ShadowingFeedbackState {
  return {
    recordingUri: null,
    audioStatus,
    comparison: null,
    review: null,
  };
}

export function clearShadowingFeedback(audioStatus = ""): ShadowingFeedbackState {
  return {
    recordingUri: null,
    audioStatus,
    comparison: null,
    review: null,
  };
}

export function createCompletedShadowingFeedback(
  input: {
    recordingUri: string | null;
    audioStatus: string;
    referenceText: string;
    recordedDurationMs: number;
    language: "en" | "ja";
  },
  calculator: ScoreCalculator = new ScoreCalculator(),
): ShadowingFeedbackState {
  if (!input.recordingUri) {
    return clearShadowingFeedback();
  }

  return {
    recordingUri: input.recordingUri,
    audioStatus: input.audioStatus,
    comparison: null,
    review: createShadowingReview(
      {
        referenceText: input.referenceText,
        recordedDurationMs: input.recordedDurationMs,
        language: input.language,
      },
      calculator,
    ),
  };
}

export function setShadowingFeedbackReview(
  state: ShadowingFeedbackState,
  review: ShadowingReview | null,
): ShadowingFeedbackState {
  return {
    ...state,
    review,
  };
}

export function createShadowingComparisonFeedback(
  input: {
    referenceText: string;
    recognizedText: string;
    language: TrainingLanguage;
  },
): ShadowingComparisonFeedback | null {
  const recognizedText = input.recognizedText.trim();
  if (!recognizedText) {
    return null;
  }

  const comparison = compareWords(input.referenceText, recognizedText, input.language);
  return {
    recognizedText,
    accuracy: comparison.accuracy,
    words: comparison.words,
  };
}

export function setShadowingFeedbackComparison(
  state: ShadowingFeedbackState,
  comparison: ShadowingComparisonFeedback | null,
): ShadowingFeedbackState {
  return {
    ...state,
    comparison,
  };
}
