export type ShadowingPracticeState = {
  materialId: string;
  sentenceIndex: number;
  completedSentenceIndices: number[];
  showTranslation: boolean;
};

function defaultShowTranslation(targetLang: "en" | "ja"): boolean {
  return targetLang === "ja";
}

export function createShadowingPracticeState(targetLang: "en" | "ja"): ShadowingPracticeState {
  return {
    materialId: "",
    sentenceIndex: 0,
    completedSentenceIndices: [],
    showTranslation: defaultShowTranslation(targetLang),
  };
}

export function startShadowingPractice(
  materialId: string,
  targetLang: "en" | "ja",
): ShadowingPracticeState {
  return {
    materialId,
    sentenceIndex: 0,
    completedSentenceIndices: [],
    showTranslation: defaultShowTranslation(targetLang),
  };
}

export function resetShadowingPractice(targetLang: "en" | "ja"): ShadowingPracticeState {
  return createShadowingPracticeState(targetLang);
}

export function reconcileShadowingPractice(
  state: ShadowingPracticeState,
  availableMaterialIds: string[],
  targetLang: "en" | "ja",
): ShadowingPracticeState {
  if (availableMaterialIds.length === 0) {
    return createShadowingPracticeState(targetLang);
  }
  if (!state.materialId || !availableMaterialIds.includes(state.materialId)) {
    return createShadowingPracticeState(targetLang);
  }
  return state;
}

export function goToPreviousShadowingSentence(state: ShadowingPracticeState): ShadowingPracticeState {
  return {
    ...state,
    sentenceIndex: Math.max(state.sentenceIndex - 1, 0),
  };
}

export function goToNextShadowingSentence(
  state: ShadowingPracticeState,
  sentenceCount: number,
): ShadowingPracticeState {
  const cappedCount = Math.max(sentenceCount, 1);
  const completedSentenceIndices = state.completedSentenceIndices.includes(state.sentenceIndex)
    ? state.completedSentenceIndices
    : [...state.completedSentenceIndices, state.sentenceIndex];

  return {
    ...state,
    completedSentenceIndices,
    sentenceIndex: Math.min(state.sentenceIndex + 1, cappedCount - 1),
  };
}

export function setShadowingTranslationVisibility(
  state: ShadowingPracticeState,
  showTranslation: boolean,
): ShadowingPracticeState {
  return {
    ...state,
    showTranslation,
  };
}
