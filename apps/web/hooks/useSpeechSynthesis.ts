"use client";
import { useState, useCallback, useRef } from "react";
import type { TrainingLanguage } from "../lib/shadowing-utils";

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
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const speak = useCallback(
    (text: string) => {
      if (!window.speechSynthesis) return;
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = trainingLanguage === "ja" ? "ja-JP" : "en-US";
      utterance.rate = speechRate;
      utterance.pitch = 1;
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    },
    [speechRate, trainingLanguage],
  );

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis?.cancel();
    setIsSpeaking(false);
  }, []);

  return { isSpeaking, speechRate, setSpeechRate, speak, stopSpeaking };
}
