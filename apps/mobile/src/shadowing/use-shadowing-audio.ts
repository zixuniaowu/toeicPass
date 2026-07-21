import { useMemo, useRef } from "react";
import type { Audio } from "expo-av";
import { createExpoShadowingAudioController } from "./expo-shadowing-audio";
import type {
  ShadowingAudioAdapter,
  ShadowingAudioStateHandlers,
} from "./shadowing-audio-adapter";

export function useShadowingAudio(
  handlers: ShadowingAudioStateHandlers,
): ShadowingAudioAdapter {
  const recordingRef = useRef<Audio.Recording | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const { onPlaybackChange, onSpeakingChange } = handlers;

  return useMemo(
    () =>
      createExpoShadowingAudioController({
        recordingRef,
        soundRef,
        onPlaybackChange,
        onSpeakingChange,
      }),
    [onPlaybackChange, onSpeakingChange],
  );
}
