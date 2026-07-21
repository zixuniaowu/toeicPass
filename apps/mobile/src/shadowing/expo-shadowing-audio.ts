import type { MutableRefObject } from "react";
import { Audio } from "expo-av";
import * as Speech from "expo-speech";
import type {
  CompletedRecording,
  ShadowingAudioAdapter,
  ShadowingAudioStateHandlers,
  ShadowingSpeechLocale,
} from "./shadowing-audio-adapter";

type AudioRefs = {
  recordingRef: MutableRefObject<Audio.Recording | null>;
  soundRef: MutableRefObject<Audio.Sound | null>;
};

type ShadowingAudioController = AudioRefs & ShadowingAudioStateHandlers;

async function setPlaybackAudioMode() {
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: false,
    playsInSilentModeIOS: true,
    shouldDuckAndroid: true,
    playThroughEarpieceAndroid: false,
    staysActiveInBackground: false,
  });
}

async function setRecordingAudioMode() {
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
    shouldDuckAndroid: true,
    playThroughEarpieceAndroid: false,
    staysActiveInBackground: false,
  });
}

export function createExpoShadowingAudioController(
  controller: ShadowingAudioController,
): ShadowingAudioAdapter {
  const { onPlaybackChange, onSpeakingChange, recordingRef, soundRef } = controller;

  async function stopSpeech() {
    await Speech.stop();
    onSpeakingChange(false);
  }

  async function stopPlayback() {
    const sound = soundRef.current;
    soundRef.current = null;
    if (sound) {
      sound.setOnPlaybackStatusUpdate(null);
      await sound.unloadAsync();
    }
    onPlaybackChange(false);
  }

  async function clearRecording() {
    await stopPlayback();
    const recording = recordingRef.current;
    recordingRef.current = null;
    if (recording) {
      try {
        const status = await recording.getStatusAsync();
        if (status.isRecording) {
          await recording.stopAndUnloadAsync();
        }
      } catch {
        // Ignore cleanup failures during navigation or unmount.
      }
    }
    await setPlaybackAudioMode();
  }

  async function toggleSpeech(text: string, locale: ShadowingSpeechLocale) {
    await stopPlayback();
    const currentlySpeaking = await Speech.isSpeakingAsync();
    if (currentlySpeaking) {
      await stopSpeech();
      return;
    }
    onSpeakingChange(true);
    Speech.speak(text, {
      language: locale,
      rate: 0.92,
      onDone: () => onSpeakingChange(false),
      onStopped: () => onSpeakingChange(false),
      onError: () => onSpeakingChange(false),
    });
  }

  async function requestRecordingPermission() {
    const permission = await Audio.requestPermissionsAsync();
    return permission.granted;
  }

  async function startRecording() {
    await stopSpeech();
    await stopPlayback();
    await setRecordingAudioMode();
    const recording = new Audio.Recording();
    await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
    await recording.startAsync();
    recordingRef.current = recording;
  }

  async function finishRecording(): Promise<CompletedRecording | null> {
    const recording = recordingRef.current;
    recordingRef.current = null;
    if (!recording) {
      return null;
    }
    const status = await recording.getStatusAsync();
    const durationMs = status.durationMillis ?? 0;
    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    await setPlaybackAudioMode();
    return {
      durationMs,
      uri,
    };
  }

  async function playRecording(uri: string) {
    await stopSpeech();
    await stopPlayback();
    await setPlaybackAudioMode();
    const { sound } = await Audio.Sound.createAsync({ uri }, { shouldPlay: true });
    soundRef.current = sound;
    onPlaybackChange(true);
    sound.setOnPlaybackStatusUpdate((status) => {
      if (!status.isLoaded) {
        if (status.error) {
          onPlaybackChange(false);
        }
        return;
      }
      if (status.didJustFinish) {
        soundRef.current = null;
        sound.setOnPlaybackStatusUpdate(null);
        void sound.unloadAsync();
        onPlaybackChange(false);
      }
    });
  }

  async function prewarmTts() {
    try {
      await Speech.getAvailableVoicesAsync();
    } catch {
      // Silently ignore - TTS prewarm is best-effort
    }
  }

  async function cleanup() {
    await stopSpeech();
    await clearRecording();
  }

  return {
    cleanup,
    clearRecording,
    finishRecording,
    playRecording,
    prewarmTts,
    requestRecordingPermission,
    startRecording,
    stopPlayback,
    stopSpeech,
    toggleSpeech,
  };
}
