import {
  clearShadowingFeedback,
  createEmptyShadowingFeedback,
  type ShadowingFeedbackState,
} from "./shadowing-feedback";
import {
  createShadowingPracticeState,
  goToNextShadowingSentence,
  goToPreviousShadowingSentence,
  reconcileShadowingPractice,
  setShadowingTranslationVisibility,
  startShadowingPractice,
  type ShadowingPracticeState,
} from "./shadowing-practice";
import {
  createShadowingRuntimeState,
  resetShadowingRuntimeState,
  setShadowingPlayback,
  setShadowingRecording,
  setShadowingSpeaking,
  type ShadowingRuntimeState,
} from "./shadowing-runtime";

export type ShadowingSessionState = {
  practice: ShadowingPracticeState;
  runtime: ShadowingRuntimeState;
  feedback: ShadowingFeedbackState;
  feedbackBySentence: Record<number, ShadowingFeedbackState>;
};

export function createShadowingSessionState(targetLang: "en" | "ja"): ShadowingSessionState {
  return {
    practice: createShadowingPracticeState(targetLang),
    runtime: createShadowingRuntimeState(),
    feedback: createEmptyShadowingFeedback(),
    feedbackBySentence: {},
  };
}

export function startShadowingSession(
  state: ShadowingSessionState,
  materialId: string,
  targetLang: "en" | "ja",
): ShadowingSessionState {
  return {
    ...state,
    practice: startShadowingPractice(materialId, targetLang),
    runtime: resetShadowingRuntimeState(),
    feedback: createEmptyShadowingFeedback(),
    feedbackBySentence: {},
  };
}

export function resetShadowingSession(
  state: ShadowingSessionState,
  targetLang: "en" | "ja",
): ShadowingSessionState {
  return {
    ...state,
    practice: createShadowingPracticeState(targetLang),
    runtime: resetShadowingRuntimeState(),
    feedback: createEmptyShadowingFeedback(),
    feedbackBySentence: {},
  };
}

export function reconcileShadowingSession(
  state: ShadowingSessionState,
  availableMaterialIds: string[],
  targetLang: "en" | "ja",
): ShadowingSessionState {
  return {
    ...state,
    practice: reconcileShadowingPractice(state.practice, availableMaterialIds, targetLang),
  };
}

export function clearShadowingSessionFeedback(
  state: ShadowingSessionState,
  audioStatus = "",
): ShadowingSessionState {
  return {
    ...state,
    runtime: resetShadowingRuntimeState(),
    feedback: clearShadowingFeedback(audioStatus),
  };
}

export function setShadowingSessionTranslationVisibility(
  state: ShadowingSessionState,
  showTranslation: boolean,
): ShadowingSessionState {
  return {
    ...state,
    practice: setShadowingTranslationVisibility(state.practice, showTranslation),
  };
}

export function goToNextShadowingSessionSentence(
  state: ShadowingSessionState,
  sentenceCount: number,
): ShadowingSessionState {
  const currentIndex = state.practice.sentenceIndex;
  const cappedCount = Math.max(sentenceCount, 1);
  const nextIndex = Math.min(currentIndex + 1, cappedCount - 1);
  return {
    ...state,
    practice: goToNextShadowingSentence(state.practice, sentenceCount),
    runtime: setShadowingSpeaking(state.runtime, false),
    feedbackBySentence: {
      ...state.feedbackBySentence,
      [currentIndex]: state.feedback,
    },
    feedback: state.feedbackBySentence[nextIndex] ?? createEmptyShadowingFeedback(),
  };
}

export function goToPreviousShadowingSessionSentence(
  state: ShadowingSessionState,
): ShadowingSessionState {
  const currentIndex = state.practice.sentenceIndex;
  const prevIndex = Math.max(currentIndex - 1, 0);
  return {
    ...state,
    practice: goToPreviousShadowingSentence(state.practice),
    runtime: setShadowingSpeaking(state.runtime, false),
    feedbackBySentence: {
      ...state.feedbackBySentence,
      [currentIndex]: state.feedback,
    },
    feedback: state.feedbackBySentence[prevIndex] ?? createEmptyShadowingFeedback(),
  };
}

export function setShadowingSessionSpeaking(
  state: ShadowingSessionState,
  isSpeaking: boolean,
): ShadowingSessionState {
  return {
    ...state,
    runtime: setShadowingSpeaking(state.runtime, isSpeaking),
  };
}

export function setShadowingSessionRecording(
  state: ShadowingSessionState,
  isRecording: boolean,
): ShadowingSessionState {
  return {
    ...state,
    runtime: setShadowingRecording(state.runtime, isRecording),
  };
}

export function setShadowingSessionPlayback(
  state: ShadowingSessionState,
  isPlayingRecording: boolean,
): ShadowingSessionState {
  return {
    ...state,
    runtime: setShadowingPlayback(state.runtime, isPlayingRecording),
  };
}

export function setShadowingSessionFeedback(
  state: ShadowingSessionState,
  feedback: ShadowingFeedbackState,
): ShadowingSessionState {
  return {
    ...state,
    feedback,
    feedbackBySentence: {
      ...state.feedbackBySentence,
      [state.practice.sentenceIndex]: feedback,
    },
  };
}
