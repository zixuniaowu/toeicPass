export type ShadowingSpeechLocale = "en-US" | "ja-JP";

export type CompletedRecording = {
  durationMs: number;
  uri: string | null;
};

export type ShadowingAudioAdapter = {
  cleanup: () => Promise<void>;
  clearRecording: () => Promise<void>;
  finishRecording: () => Promise<CompletedRecording | null>;
  playRecording: (uri: string) => Promise<void>;
  prewarmTts: () => Promise<void>;
  requestRecordingPermission: () => Promise<boolean>;
  startRecording: () => Promise<void>;
  stopPlayback: () => Promise<void>;
  stopSpeech: () => Promise<void>;
  toggleSpeech: (text: string, locale: ShadowingSpeechLocale) => Promise<void>;
};

export type ShadowingAudioStateHandlers = {
  onSpeakingChange: (isSpeaking: boolean) => void;
  onPlaybackChange: (isPlayingRecording: boolean) => void;
};
