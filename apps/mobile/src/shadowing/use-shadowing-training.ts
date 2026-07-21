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
  clearRecording: () => Promise<void>;
  handleBackToList: () => void;
  handleNextSentence: (sentenceCount: number) => void;
  handlePlayRecording: () => Promise<void>;
  handlePlaySentence: (text: string) => Promise<void>;
  handlePreviousSentence: () => void;
  handleStartShadowing: (materialId: string) => void;
  handleToggleRecording: () => Promise<void>;
  handleToggleTranslation: () => void;
  handleUpdateMetric: (metric: ReviewMetric, value: number) => void;
  recordingPlaybackSupported: boolean;
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
  const shadowingScoreCalculator = useMemo(() => new ScoreCalculator(), []);

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
    console.log("[STT] start event - speech recognition started");
  });

  useSpeechRecognitionEvent("audiostart", (event) => {
    console.log("[STT] audiostart event:", JSON.stringify(event));
  });

  useSpeechRecognitionEvent("audioend", (event) => {
    console.log("[STT] audioend event:", JSON.stringify(event));
  });

  useSpeechRecognitionEvent("result", (event) => {
    console.log("[STT] result event:", JSON.stringify(event));
    if (event.isFinal) {
      const transcript = event.results[0]?.transcript ?? "";
      console.log("[STT] final transcript:", transcript);
      if (transcript) {
        setTranscriptDraft(transcript);
        const refText = activeSentenceRef.current?.text;
        console.log("[STT] activeSentenceRef text:", JSON.stringify(refText));
        const referenceText = refText?.trim() ?? "";
        if (referenceText) {
          const comparison = createShadowingComparisonFeedback({
            referenceText,
            recognizedText: transcript,
            language: targetLangRef.current,
          });
          setShadowingSession((current) =>
            setShadowingSessionFeedback(current, {
              ...current.feedback,
              comparison,
              audioStatus: tRef.current("mobile.shadowingRecordingReady"),
            }),
          );
          console.log("[STT] comparison set in feedback");
        } else {
          setShadowingSession((current) =>
            setShadowingSessionFeedback(current, {
              ...current.feedback,
              comparison: createShadowingComparisonFeedback({
                referenceText: transcript,
                recognizedText: transcript,
                language: targetLangRef.current,
              }),
              audioStatus: tRef.current("mobile.shadowingRecordingReady"),
            }),
          );
        }
      }
    }
  });

  useSpeechRecognitionEvent("end", () => {
    console.log("[STT] end event");
    setShadowingSession((current) => {
      if (current.runtime.isRecording) {
        return setShadowingSessionRecording(current, false);
      }
      return current;
    });
  });

  useSpeechRecognitionEvent("error", (event) => {
    console.log("[STT] error event:", JSON.stringify(event));
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

  const activeSentence = useMemo(
    () => {
      const sentence = selectActiveShadowingSentence(
        activeMaterial,
        shadowingSession.practice.sentenceIndex,
      ) as ShadowingMaterial["sentences"][number] | null;
      console.log("[NAV] activeSentence computed, idx:", shadowingSession.practice.sentenceIndex, "materialId:", activeMaterial?.id, "text:", sentence?.text?.slice(0, 40));
      return sentence;
    },
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
      console.log("[REC] Stopping STT");
      setShadowingSession((current) => setShadowingSessionRecording(current, false));
      ExpoSpeechRecognitionModule.stop();
      console.log("[REC] STT stop() called");
      return;
    }

    console.log("[REC] Starting STT, requesting permissions...");
    const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    console.log("[REC] Permission result:", JSON.stringify(result));
    if (!result.granted) {
      Alert.alert(t("mobile.shadowingTitle"), t("mobile.shadowingMicDenied"));
      return;
    }

    try {
      const recognitionAvailable = ExpoSpeechRecognitionModule.isRecognitionAvailable();
      console.log("[REC] isRecognitionAvailable:", recognitionAvailable);
      if (!recognitionAvailable) {
        Alert.alert("语音识别不可用", "设备未安装语音识别服务。请检查 Google 语音识别是否开启。");
        return;
      }

      setTranscriptDraft("");
      console.log("[REC] activeSentenceRef.text at start:", JSON.stringify(activeSentenceRef.current?.text));
      setShadowingSession((current) => {
        const next = clearShadowingSessionFeedback(current);
        return setShadowingSessionRecording(next, true);
      });

      console.log("[REC] Calling STT start() with lang=en-US");
      ExpoSpeechRecognitionModule.start({
        lang: "en-US",
        interimResults: false,
        continuous: false,
        contextualStrings: activeSentence?.text ? [activeSentence.text] : undefined,
        addsPunctuation: true,
      });
      console.log("[REC] STT start() returned");
    } catch (e) {
      console.log("[REC] Error starting:", e);
      ExpoSpeechRecognitionModule.abort();
      setShadowingSession((current) =>
        clearShadowingSessionFeedback(setShadowingSessionRecording(current, false)),
      );
      Alert.alert(t("mobile.shadowingTitle"), t("mobile.shadowingRecordFailed"));
    }
  }, [activeSentence?.text, shadowingSession.runtime.isRecording, t]);

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

  const handleNextSentence = useCallback((sentenceCount: number) => {
    console.log("[NAV] handleNextSentence, idx:", shadowingSession.practice.sentenceIndex, "count:", sentenceCount);
    setShadowingSession((current) => goToNextShadowingSessionSentence(current, sentenceCount));
    setTranscriptDraft("");
  }, [shadowingSession.practice.sentenceIndex]);

  const handlePreviousSentence = useCallback(() => {
    console.log("[NAV] handlePreviousSentence, idx:", shadowingSession.practice.sentenceIndex);
    setShadowingSession((current) => goToPreviousShadowingSessionSentence(current));
    setTranscriptDraft("");
  }, [shadowingSession.practice.sentenceIndex]);

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

  const recordingPlaybackSupported = Platform.Version >= 33;

  return useMemo(
    () => ({
      activeMaterial,
      activeSentence,
      compareTranscript,
      clearRecording,
      handleBackToList,
      handleNextSentence,
      handlePlayRecording,
      handlePlaySentence,
      handlePreviousSentence,
      handleStartShadowing,
      handleToggleRecording,
      handleToggleTranslation,
      handleUpdateMetric,
      recordingPlaybackSupported,
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
      clearRecording,
      handleBackToList,
      handleNextSentence,
      handlePlayRecording,
      handlePlaySentence,
      handlePreviousSentence,
      handleStartShadowing,
      handleToggleRecording,
      handleToggleTranslation,
      handleUpdateMetric,
      recordingPlaybackSupported,
      resetForTargetLang,
      setTranscriptDraft,
      suspendAudio,
      shadowingSession,
      transcriptDraft,
    ],
  );
}
