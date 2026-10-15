"use client";
import { useState, useCallback, useEffect } from "react";
import type { TrainingLanguage } from "../lib/shadowing-utils";
import { loadJaAudioManifest, playSpeech, stopSpeech } from "../lib/tts";

export type UseSpeechSynthesisReturn = {
  isSpeaking: boolean;
  speechRate: number;
  setSpeechRate: (rate: number) => void;
  speak: (text: string) => void;
  stopSpeaking: () => void;
};

export function useSpeechSynthesis(trainingLanguage: TrainingLanguage): UseSpeechSynthesisReturn {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speechRate, setSpeechRate] = useState(0.85);

  useEffect(() => {
    if (trainingLanguage === "ja") void loadJaAudioManifest();
    // Voices load asynchronously in Chrome; touching getVoices() warms the list.
    if (typeof window !== "undefined") window.speechSynthesis?.getVoices();
  }, [trainingLanguage]);

  const speak = useCallback(
    (text: string) => {
      setIsSpeaking(true);
      void playSpeech(text, trainingLanguage === "ja" ? "ja" : "en", speechRate).finally(() => setIsSpeaking(false));
    },
    [speechRate, trainingLanguage],
  );

  const stopSpeaking = useCallback(() => {
    stopSpeech();
    setIsSpeaking(false);
  }, []);

  return { isSpeaking, speechRate, setSpeechRate, speak, stopSpeaking };
}
