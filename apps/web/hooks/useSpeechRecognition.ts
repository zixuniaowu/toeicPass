"use client";
import { useState, useCallback, useRef } from "react";
import type { TrainingLanguage, CompareWord, PhoneticSegment } from "../lib/shadowing-utils";
import { compareWords, compareJapaneseSegments } from "../lib/shadowing-utils";

export type MicPermission = "unknown" | "granted" | "denied" | "prompt";

export type UseRecognitionReturn = {
  isRecording: boolean;
  recognizedText: string;
  compareResult: { words: CompareWord[]; accuracy: number } | null;
  micPermission: MicPermission;
  startRecording: (originalText: string, compareText?: string, segments?: PhoneticSegment[]) => void;
  stopRecording: () => void;
  clearRecognition: () => void;
  requestMicPermission: () => Promise<boolean>;
  dismissMicBanner: () => void;
};

export function useSpeechRecognition(
  trainingLanguage: TrainingLanguage,
  stopSpeaking: () => void,
  l: (zh: string, ja: string, en?: string) => string,
): UseRecognitionReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [recognizedText, setRecognizedText] = useState("");
  const [compareResult, setCompareResult] = useState<{
    words: CompareWord[];
    accuracy: number;
  } | null>(null);
  const [micPermission, setMicPermission] = useState<MicPermission>("unknown");
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const clearRecognition = useCallback(() => {
    setRecognizedText("");
    setCompareResult(null);
    recognitionRef.current?.abort();
    setIsRecording(false);
  }, []);

  const requestMicPermission = useCallback(async (): Promise<boolean> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      setMicPermission("granted");
      return true;
    } catch {
      setMicPermission("denied");
      return false;
    }
  }, []);

  const dismissMicBanner = useCallback(() => {
    setMicPermission("unknown");
  }, []);

  const startRecording = useCallback(
    (originalText: string, compareText?: string, segments?: PhoneticSegment[]) => {
      // For Japanese, compareText is the hiragana-only form (kanji replaced by readings).
      // Speech recognisers return hiragana for kanji words, so comparing against the
      // phonetic form prevents false mismatches on every kanji character.
      const textForComparison = (trainingLanguage === "ja" && compareText) ? compareText : originalText;
      const SpeechRecognitionAPI =
        window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognitionAPI) {
        setRecognizedText(
          l(
            "浏览器不支持语音识别，请使用 Chrome 浏览器",
            "ブラウザが音声認識に未対応です。Chrome を使用してください。",
          ),
        );
        return;
      }

      stopSpeaking();

      void requestMicPermission().then((granted) => {
        if (!granted) return;

        const recognition = new SpeechRecognitionAPI();
        recognition.lang = trainingLanguage === "ja" ? "ja-JP" : "en-US";
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
          setIsRecording(true);
          setRecognizedText("");
          setCompareResult(null);
        };

        recognition.onresult = (event: SpeechRecognitionEvent) => {
          let transcript = "";
          for (let i = 0; i < event.results.length; i++) {
            transcript += event.results[i][0].transcript;
          }
          setRecognizedText(transcript);

          if (event.results[event.results.length - 1].isFinal) {
            // For Japanese: use token-level segment comparison when kuromoji segments
            // are available so accuracy feedback colours whole morphemes (not single chars).
            const result =
              trainingLanguage === "ja" && segments && segments.length > 0
                ? compareJapaneseSegments(segments, transcript)
                : compareWords(textForComparison, transcript, trainingLanguage);
            setCompareResult(result);
          }
        };

        recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
          setIsRecording(false);
          if (event.error === "no-speech") {
            setRecognizedText(
              l("未检测到语音，请再试一次", "音声が検出されませんでした。もう一度試してください。"),
            );
          } else if (event.error === "not-allowed") {
            setMicPermission("denied");
          } else {
            setRecognizedText(`${l("识别出错", "認識エラー")}: ${event.error}`);
          }
        };

        recognition.onend = () => {
          setIsRecording(false);
        };

        recognitionRef.current = recognition;
        recognition.start();
      });
    },
    [l, requestMicPermission, stopSpeaking, trainingLanguage],
  );

  const stopRecording = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  return {
    isRecording,
    recognizedText,
    compareResult,
    micPermission,
    startRecording,
    stopRecording,
    clearRecognition,
    requestMicPermission,
    dismissMicBanner,
  };
}
