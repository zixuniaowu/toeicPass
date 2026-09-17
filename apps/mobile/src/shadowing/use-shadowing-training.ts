import {
  clearShadowingSessionFeedback,
  createRecordingInProgressFeedback,
  createShadowingSessionState,
  goToNextShadowingSessionSentence,
  goToPreviousShadowingSessionSentence,
  reconcileShadowingSession,
  resetShadowingSession,
  setShadowingFeedbackReview,
  setShadowingSessionFeedback,
  setShadowingSessionPlayback,
  setShadowingSessionRecording,
  setShadowingSessionSpeaking,
  setShadowingSessionTranslationVisibility,
  startShadowingSession,
} from "@toeicpass/app-core";
import {
  createShadowingComparisonFeedback,
  setShadowingFeedbackComparison,
} from "@toeicpass/app-core/shadowing-feedback";
import type { ShadowingSessionState } from "@toeicpass/app-core/shadowing-session";
import {
  selectActiveShadowingMaterial,
  selectActiveShadowingSentence,
  updateShadowingReviewMetric,
} from "@toeicpass/app-core/shadowing-engine";
import { ScoreCalculator } from "@toeicpass/app-core/shadowing-score";
import type { ShadowingMaterial } from "@toeicpass/shadowing-content";
import { Alert, Platform } from "react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";
import { useAppStateEffect } from "../platform/use-app-state-effect";
import { useShadowingAudio } from "./use-shadowing-audio";
import {
  deleteRecording,
  listRecordings,
  saveRecording,
  type SavedRecording,
} from "../services/recording-store";

type Translate = (key: string) => string;

type UseShadowingTrainingParams = {
  materials: ShadowingMaterial[];
  targetLang: "en" | "ja";
  t: Translate;
};

type ReviewMetric = "pronunciationScore" | "fluencyScore" | "completenessScore";

export type UseShadowingTrainingResult = {
  activeMaterial: ShadowingMaterial | null;
  activeSentence: ShadowingMaterial["sentences"][number] | null;
  compareTranscript: (recognizedText: string) => void;
  deleteSavedRecording: (id: string) => Promise<void>;
  clearRecording: () => Promise<void>;
  handleBackToList: () => void;
  handleNextSentence: (sentenceCount: number) => void;
  handlePlayRecording: () => Promise<void>;
  handlePlaySentence: (text: string) => Promise<void>;
  handlePreviousSentence: () => void;
  handleStartShadowing: (materialId: string) => void;
  handleToggleRecording: () => Promise<void>;
  handleToggleRecordOnly: () => Promise<void>;
  handleToggleTranslation: () => void;
  handleUpdateMetric: (metric: ReviewMetric, value: number) => void;
  isRecordOnlyRecording: boolean;
  playSavedRecording: (uri: string) => Promise<void>;
  recordingPersistSupported: boolean;
  recordingPlaybackSupported: boolean;
  recordings: SavedRecording[];
  resetForTargetLang: (lang: "en" | "ja") => void;
  setTranscriptDraft: (value: string) => void;
  suspendAudio: () => Promise<void>;
  shadowingSession: ShadowingSessionState;
  transcriptDraft: string;
};

export function useShadowingTraining(
  params: UseShadowingTrainingParams,
): UseShadowingTrainingResult {
  const { materials, t, targetLang } = params;
  const [shadowingSession, setShadowingSession] = useState<ShadowingSessionState>(() =>
    createShadowingSessionState(targetLang),
  );
  const [transcriptDraft, setTranscriptDraft] = useState("");
  const [recordings, setRecordings] = useState<SavedRecording[]>([]);
  const [isRecordOnlyRecording, setIsRecordOnlyRecording] = useState(false);
  const shadowingScoreCalculator = useMemo(() => new ScoreCalculator(), []);

  useEffect(() => {
    void listRecordings().then(setRecordings);
  }, []);

  const speechLocale = targetLang === "ja" ? "ja-JP" : "en-US";

  const updateShadowingSpeaking = useCallback((isSpeaking: boolean) => {
    setShadowingSession((current) => setShadowingSessionSpeaking(current, isSpeaking));
  }, []);

  const updateShadowingPlayback = useCallback((isPlayingRecording: boolean) => {
    setShadowingSession((current) => setShadowingSessionPlayback(current, isPlayingRecording));
  }, []);

  const shadowingAudio = useShadowingAudio({
    onSpeakingChange: updateShadowingSpeaking,
    onPlaybackChange: updateShadowingPlayback,
  });

  const clearRecording = useCallback(async () => {
    ExpoSpeechRecognitionModule.abort();
    await shadowingAudio.clearRecording();
    setShadowingSession((current) => clearShadowingSessionFeedback(current));
  }, [shadowingAudio]);

  const suspendAudio = useCallback(async () => {
    ExpoSpeechRecognitionModule.abort();
    await shadowingAudio.clearRecording();
    await shadowingAudio.stopSpeech();
    setIsRecordOnlyRecording(false);
    setShadowingSession((current) => {
      const next = setShadowingSessionPlayback(
        setShadowingSessionSpeaking(current, false),
        false,
      );
      if (!next.runtime.isRecording) {
        return next;
      }
      return clearShadowingSessionFeedback(setShadowingSessionRecording(next, false));
    });
  }, [shadowingAudio]);

  useEffect(() => {
    setShadowingSession((current) =>
      reconcileShadowingSession(
        current,
        materials.map((material) => material.id),
        targetLang,
      ),
    );
  }, [materials, targetLang]);

  useEffect(() => {
    void shadowingAudio.prewarmTts();
    return () => {
      void shadowingAudio.cleanup();
    };
  }, [shadowingAudio]);

  useAppStateEffect({
    onInactive: suspendAudio,
  });

  const targetLangRef = useRef(targetLang);
  targetLangRef.current = targetLang;
  const tRef = useRef(t);
  tRef.current = t;

  useSpeechRecognitionEvent("start", () => {
    // Recognition session started.
  });

  // When recordingOptions.persist is enabled, the recognizer writes the mic
  // stream to a cache file; `audioend` delivers the uri. Persist it to the
  // app's documents directory so practice recordings survive restarts.
  useSpeechRecognitionEvent("audioend", (event) => {
    const uri = event.uri;
    const material = activeMaterialRef.current;
    const sentence = activeSentenceRef.current;
    if (!uri || !material || !sentence) {
      return;
    }
    void (async () => {
      const saved = await saveRecording({
        sourceUri: uri,
        materialId: material.id,
        materialTitle: material.title,
        sentenceIndex: sentence.id,
        sentenceText: sentence.text,
        lang: targetLangRef.current,
      });
      if (!saved) {
        return;
      }
      setRecordings((current) => [saved, ...current]);
      setShadowingSession((current) => {
        if (!current.feedback.comparison && !current.feedback.review) {
          // Keep feedback untouched if no result arrived; just enable replay.
          return {
            ...current,
            feedback: { ...current.feedback, recordingUri: saved.uri },
          };
        }
        return {
          ...current,
          feedback: { ...current.feedback, recordingUri: saved.uri },
        };
      });
    })();
  });

  useSpeechRecognitionEvent("result", (event) => {
    if (!event.isFinal) {
      return;
    }
    // Compare every alternative transcription against the reference and keep
    // the best-scoring one — the top alternative is not always the closest.
    const candidates = event.results
      .map((item) => item?.transcript ?? "")
      .filter((transcript) => transcript.trim().length > 0);
    if (candidates.length === 0) {
      return;
    }
    const referenceText = activeSentenceRef.current?.text?.trim() ?? "";
    let bestTranscript = candidates[0];
    let bestComparison = referenceText
      ? createShadowingComparisonFeedback({
          referenceText,
          recognizedText: bestTranscript,
          language: targetLangRef.current,
        })
      : null;
    for (const transcript of candidates.slice(1)) {
      if (!referenceText || !bestComparison) {
        break;
      }
      const comparison = createShadowingComparisonFeedback({
        referenceText,
        recognizedText: transcript,
        language: targetLangRef.current,
      });
      if (comparison.accuracy > bestComparison.accuracy) {
        bestTranscript = transcript;
        bestComparison = comparison;
      }
    }

    setTranscriptDraft(bestTranscript);
    const comparison =
      bestComparison ??
      createShadowingComparisonFeedback({
        referenceText: bestTranscript,
        recognizedText: bestTranscript,
        language: targetLangRef.current,
      });
    setShadowingSession((current) =>
      setShadowingSessionFeedback(current, {
        ...current.feedback,
        comparison,
        audioStatus: tRef.current("mobile.shadowingRecordingReady"),
      }),
    );
  });

  useSpeechRecognitionEvent("end", () => {
    setShadowingSession((current) => {
      if (current.runtime.isRecording) {
        return setShadowingSessionRecording(current, false);
      }
      return current;
    });
  });

  useSpeechRecognitionEvent("error", (event) => {
    setShadowingSession((current) => {
      if (!current.runtime.isRecording) return current;
      return clearShadowingSessionFeedback(setShadowingSessionRecording(current, false));
    });
    if (event.error !== "aborted") {
      Alert.alert("语音识别出错", `${event.error}: ${event.message}`);
    }
  });

  const activeMaterial = useMemo(
    () => selectActiveShadowingMaterial(materials, shadowingSession.practice.materialId),
    [materials, shadowingSession.practice.materialId],
  );

  const activeMaterialRef = useRef(activeMaterial);
  activeMaterialRef.current = activeMaterial;

  const activeSentence = useMemo(
    () =>
      selectActiveShadowingSentence(
        activeMaterial,
        shadowingSession.practice.sentenceIndex,
      ) as ShadowingMaterial["sentences"][number] | null,
    [activeMaterial, shadowingSession.practice.sentenceIndex],
  );

  const activeSentenceRef = useRef(activeSentence);
  activeSentenceRef.current = activeSentence;

  const handleStartShadowing = useCallback((materialId: string) => {
    void shadowingAudio.stopSpeech();
    void shadowingAudio.clearRecording();
    void shadowingAudio.prewarmTts();
    setTranscriptDraft("");
    setShadowingSession((current) => startShadowingSession(current, materialId, targetLang));
  }, [shadowingAudio, targetLang]);

  const handleBackToList = useCallback(() => {
    void shadowingAudio.stopSpeech();
    void shadowingAudio.clearRecording();
    setTranscriptDraft("");
    setShadowingSession((current) => resetShadowingSession(current, targetLang));
  }, [shadowingAudio, targetLang]);

  const handlePlaySentence = useCallback(async (text: string) => {
    if (shadowingSession.runtime.isRecording) {
      return;
    }
    await shadowingAudio.toggleSpeech(text, targetLang === "ja" ? "ja-JP" : "en-US");
  }, [shadowingAudio, shadowingSession.runtime.isRecording, targetLang]);

  const handleToggleRecording = useCallback(async () => {
    if (shadowingSession.runtime.isRecording) {
      setShadowingSession((current) => setShadowingSessionRecording(current, false));
      ExpoSpeechRecognitionModule.stop();
      return;
    }

    const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!result.granted) {
      Alert.alert(t("mobile.shadowingTitle"), t("mobile.shadowingMicDenied"));
      return;
    }

    try {
      const recognitionAvailable = ExpoSpeechRecognitionModule.isRecognitionAvailable();
      if (!recognitionAvailable) {
        Alert.alert("语音识别不可用", "设备未安装语音识别服务。请检查 Google 语音识别是否开启。");
        return;
      }

      setTranscriptDraft("");
      setShadowingSession((current) => {
        const next = clearShadowingSessionFeedback(current);
        return setShadowingSessionRecording(next, true);
      });

      ExpoSpeechRecognitionModule.start({
        lang: speechLocale,
        interimResults: false,
        continuous: false,
        maxAlternatives: 3,
        contextualStrings: activeSentence?.text ? [activeSentence.text] : undefined,
        addsPunctuation: true,
        // Persist the mic stream to a file so recordings can be replayed and
        // are kept on the device (see audioend handler / recording-store).
        recordingOptions: {
          persist: true,
          outputFileName: `shadowing-${Date.now()}.wav`,
        },
      });
    } catch {
      ExpoSpeechRecognitionModule.abort();
      setShadowingSession((current) =>
        clearShadowingSessionFeedback(setShadowingSessionRecording(current, false)),
      );
      Alert.alert(t("mobile.shadowingTitle"), t("mobile.shadowingRecordFailed"));
    }
  }, [activeSentence?.text, shadowingSession.runtime.isRecording, speechLocale, t]);

  const handleUpdateMetric = useCallback((metric: ReviewMetric, value: number) => {
    setShadowingSession((current) => {
      if (!current.feedback.review) {
        return current;
      }
      return setShadowingSessionFeedback(
        current,
        setShadowingFeedbackReview(
          current.feedback,
          updateShadowingReviewMetric(current.feedback.review, metric, value, shadowingScoreCalculator),
        ),
      );
    });
  }, [shadowingScoreCalculator]);

  const handlePlayRecording = useCallback(async () => {
    if (!shadowingSession.feedback.recordingUri || shadowingSession.runtime.isRecording) {
      return;
    }
    if (shadowingSession.runtime.isPlayingRecording) {
      await shadowingAudio.stopPlayback();
      return;
    }
    try {
      await shadowingAudio.playRecording(shadowingSession.feedback.recordingUri);
    } catch {
      await shadowingAudio.stopPlayback();
      Alert.alert(t("mobile.shadowingTitle"), t("mobile.shadowingPlaybackFailed"));
    }
  }, [
    shadowingAudio,
    shadowingSession.feedback.recordingUri,
    shadowingSession.runtime.isPlayingRecording,
    shadowingSession.runtime.isRecording,
    t,
  ]);

  const recordingPersistSupported = Platform.OS === "ios" || Number(Platform.Version) >= 33;
  // Local file playback works on every supported Android/iOS version.
  const recordingPlaybackSupported = true;

  /**
   * Android < 13 cannot persist the recognizer's audio stream (native limit)
   * and the mic is exclusive across processes, so a separate record-only
   * flow (expo-av) lets those devices keep practice recordings locally.
   */
  const handleToggleRecordOnly = useCallback(async () => {
    if (isRecordOnlyRecording) {
      setIsRecordOnlyRecording(false);
      try {
        const recorded = await shadowingAudio.finishRecording();
        const material = activeMaterialRef.current;
        const sentence = activeSentenceRef.current;
        if (recorded?.uri && material && sentence) {
          const saved = await saveRecording({
            sourceUri: recorded.uri,
            materialId: material.id,
            materialTitle: material.title,
            sentenceIndex: sentence.id,
            sentenceText: sentence.text,
            lang: targetLangRef.current,
          });
          if (saved) {
            setRecordings((current) => [saved, ...current]);
            setShadowingSession((current) => ({
              ...current,
              feedback: { ...current.feedback, recordingUri: saved.uri },
            }));
            return;
          }
        }
      } catch {
        // Recording cleanup failures are non-fatal.
      }
      return;
    }

    const permission = await shadowingAudio.requestRecordingPermission();
    if (!permission) {
      Alert.alert(t("mobile.shadowingTitle"), t("mobile.shadowingMicDenied"));
      return;
    }
    try {
      await shadowingAudio.startRecording();
      setIsRecordOnlyRecording(true);
    } catch {
      setIsRecordOnlyRecording(false);
      Alert.alert(t("mobile.shadowingTitle"), t("mobile.shadowingRecordFailed"));
    }
  }, [isRecordOnlyRecording, shadowingAudio, t]);

  const handleNextSentence = useCallback((sentenceCount: number) => {
    setShadowingSession((current) => goToNextShadowingSessionSentence(current, sentenceCount));
    setTranscriptDraft("");
  }, []);

  const handlePreviousSentence = useCallback(() => {
    setShadowingSession((current) => goToPreviousShadowingSessionSentence(current));
    setTranscriptDraft("");
  }, []);

  const deleteSavedRecording = useCallback(async (id: string) => {
    const next = await deleteRecording(id);
    setRecordings(next);
  }, []);

  const playSavedRecording = useCallback(
    async (uri: string) => {
      try {
        await shadowingAudio.playRecording(uri);
      } catch {
        await shadowingAudio.stopPlayback();
      }
    },
    [shadowingAudio],
  );

  const handleToggleTranslation = useCallback(() => {
    setShadowingSession((current) =>
      setShadowingSessionTranslationVisibility(current, !current.practice.showTranslation),
    );
  }, []);

  const resetForTargetLang = useCallback((lang: "en" | "ja") => {
    setTranscriptDraft("");
    setShadowingSession(createShadowingSessionState(lang));
  }, []);

  const compareTranscript = useCallback((recognizedText: string) => {
    const referenceText = activeSentence?.text?.trim() ?? "";
    if (!referenceText) {
      return;
    }
    setShadowingSession((current) =>
      setShadowingSessionFeedback(
        current,
        setShadowingFeedbackComparison(
          current.feedback,
          createShadowingComparisonFeedback({
            referenceText,
            recognizedText,
            language: targetLang,
          }),
        ),
      ),
    );
  }, [activeSentence?.text, targetLang]);

  return useMemo(
    () => ({
      activeMaterial,
      activeSentence,
      compareTranscript,
      deleteSavedRecording,
      clearRecording,
      handleBackToList,
      handleNextSentence,
      handlePlayRecording,
      handlePlaySentence,
      handlePreviousSentence,
      handleStartShadowing,
      handleToggleRecording,
      handleToggleRecordOnly,
      handleToggleTranslation,
      handleUpdateMetric,
      isRecordOnlyRecording,
      playSavedRecording,
      recordingPersistSupported,
      recordingPlaybackSupported,
      recordings,
      resetForTargetLang,
      setTranscriptDraft,
      suspendAudio,
      shadowingSession,
      transcriptDraft,
    }),
    [
      activeMaterial,
      activeSentence,
      compareTranscript,
      deleteSavedRecording,
      clearRecording,
      handleBackToList,
      handleNextSentence,
      handlePlayRecording,
      handlePlaySentence,
      handlePreviousSentence,
      handleStartShadowing,
      handleToggleRecording,
      handleToggleRecordOnly,
      handleToggleTranslation,
      handleUpdateMetric,
      isRecordOnlyRecording,
      playSavedRecording,
      recordingPersistSupported,
      recordingPlaybackSupported,
      recordings,
      resetForTargetLang,
      setTranscriptDraft,
      suspendAudio,
      shadowingSession,
      transcriptDraft,
    ],
  );
}
