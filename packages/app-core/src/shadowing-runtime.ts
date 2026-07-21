export type ShadowingRuntimeState = {
  isSpeaking: boolean;
  isRecording: boolean;
  isPlayingRecording: boolean;
};

export function createShadowingRuntimeState(): ShadowingRuntimeState {
  return {
    isSpeaking: false,
    isRecording: false,
    isPlayingRecording: false,
  };
}

export function setShadowingSpeaking(
  state: ShadowingRuntimeState,
  isSpeaking: boolean,
): ShadowingRuntimeState {
  return {
    ...state,
    isSpeaking,
  };
}

export function setShadowingRecording(
  state: ShadowingRuntimeState,
  isRecording: boolean,
): ShadowingRuntimeState {
  return {
    ...state,
    isRecording,
  };
}

export function setShadowingPlayback(
  state: ShadowingRuntimeState,
  isPlayingRecording: boolean,
): ShadowingRuntimeState {
  return {
    ...state,
    isPlayingRecording,
  };
}

export function resetShadowingRuntimeState(): ShadowingRuntimeState {
  return createShadowingRuntimeState();
}
