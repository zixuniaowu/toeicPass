"use client";
/**
 * Shadowing recognition + recording.
 *
 * - Web Speech API with maxAlternatives=5 and continuous mode; final results are
 *   stitched and every alternative combination is scored, keeping the best.
 * - In parallel a MediaRecorder captures the attempt for playback
 *   (webm/opus, mp4/aac or whatever the browser supports).
 * - Android Chrome sometimes refuses to share the microphone between the
 *   recognizer and getUserMedia ("audio-capture"). When that happens we stop the
 *   recorder, retry recognition alone, and remember the device preference.
 * - Japanese transcripts are converted to hiragana readings server-side
 *   (/api/japanese-reading, kuromoji) before mora-level comparison.
 */
import { useState, useCallback, useRef, useEffect } from "react";
import {
  compareBest,
  type CompareResult,
  type CompareWord,
  type PhoneticSegment,
  type TrainingLanguage,
} from "@toeicpass/app-core/shadowing-compare";
import { getJapaneseReading } from "../lib/japanese-reading";
import { recordPracticeAttempt } from "../lib/practice-log";

export type MicPermission = "unknown" | "granted" | "denied" | "prompt";

export type UseRecognitionReturn = {
  isRecording: boolean;
  recognizedText: string;
  compareResult: { words: CompareWord[]; accuracy: number } | null;
  micPermission: MicPermission;
  /** Object URL of the learner's last attempt (null if recording unavailable). */
  recordingUrl: string | null;
  /** Human-readable notice (e.g. recording disabled on this device). */
  notice: string;
  startRecording: (originalText: string, compareText?: string, segments?: PhoneticSegment[]) => void;
  stopRecording: () => void;
  clearRecognition: () => void;
  requestMicPermission: () => Promise<boolean>;
  dismissMicBanner: () => void;
};

const NO_PARALLEL_KEY = "lb.rec.noParallel";
const MAX_SESSION_MS = 30000;

export function pickRecorderMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") return undefined;
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4;codecs=mp4a.40.2", "audio/mp4", "audio/aac", "audio/ogg;codecs=opus"];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type));
}

/** Build candidate transcripts from a list of results × alternatives. */
export function buildCandidates(results: string[][]): string[] {
  if (results.length === 0) return [];
  const maxAlt = Math.max(...results.map((r) => r.length));
  const out = new Set<string>();
  for (let k = 0; k < maxAlt; k++) {
    out.add(results.map((alts) => alts[Math.min(k, alts.length - 1)]).join(" ").replace(/\s+/g, " ").trim());
  }
  // also vary each segment independently against the top choice of the others
  results.forEach((alts, idx) => {
    alts.forEach((alt) => {
      out.add(results.map((a, j) => (j === idx ? alt : a[0])).join(" ").replace(/\s+/g, " ").trim());
    });
  });
  return Array.from(out).filter(Boolean).slice(0, 40);
}

export function useSpeechRecognition(
  trainingLanguage: TrainingLanguage,
  stopSpeaking: () => void,
  l: (zh: string, ja: string, en?: string) => string,
): UseRecognitionReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [recognizedText, setRecognizedText] = useState("");
  const [compareResult, setCompareResult] = useState<CompareResult | null>(null);
  const [micPermission, setMicPermission] = useState<MicPermission>("unknown");
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const finalsRef = useRef<string[][]>([]);
  const targetRef = useRef<{ text: string; compareText: string; segments?: PhoneticSegment[] } | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const urlRef = useRef<string | null>(null);
  const userStoppedRef = useRef(false);
  const scoredRef = useRef(false);

  useEffect(() => () => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  const stopRecorder = useCallback(() => {
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") {
      try { rec.stop(); } catch { /* ignore */ }
    } else {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  const clearRecognition = useCallback(() => {
    setRecognizedText("");
    setCompareResult(null);
    setNotice("");
    recognitionRef.current?.abort();
    stopRecorder();
    setIsRecording(false);
  }, [stopRecorder]);

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

  const dismissMicBanner = useCallback(() => setMicPermission("unknown"), []);

  const score = useCallback(async () => {
    if (scoredRef.current) return;
    const target = targetRef.current;
    const finals = finalsRef.current;
    if (!target || finals.length === 0) return;
    scoredRef.current = true;
    const candidates = buildCandidates(finals);
    setRecognizedText(candidates[0] ?? "");
    let scored: (CompareResult & { transcript: string }) | null = null;
    if (trainingLanguage === "ja") {
      // Convert each candidate to its hiragana reading (kanji in ASR output otherwise never match).
      const readings = await Promise.all(
        candidates.slice(0, 6).map(async (c) => {
          const r = await getJapaneseReading(c).catch(() => ({ readingText: "" }));
          return r.readingText || c;
        }),
      );
      scored = compareBest(target.compareText, readings, "ja", target.segments);
      const idx = readings.indexOf(scored.transcript);
      if (idx >= 0) setRecognizedText(candidates[idx]);
    } else {
      scored = compareBest(target.text, candidates, "en");
      setRecognizedText(scored.transcript);
    }
    setCompareResult({ words: scored.words, accuracy: scored.accuracy });
    recordPracticeAttempt(target.text, trainingLanguage, scored.accuracy, scored.words);
  }, [trainingLanguage]);

  const startRecognizer = useCallback((allowRetryAlone: boolean) => {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) return false;
    const recognition = new SpeechRecognitionAPI();
    recognition.lang = trainingLanguage === "ja" ? "ja-JP" : "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 5;

    recognition.onstart = () => setIsRecording(true);
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const finals: string[][] = [];
      let interim = "";
      for (let i = 0; i < event.results.length; i++) {
        const res = event.results[i];
        if (res.isFinal) {
          const alts: string[] = [];
          for (let a = 0; a < res.length; a++) alts.push(res[a].transcript.trim());
          finals.push(alts.filter(Boolean));
        } else {
          interim += res[0].transcript;
        }
      }
      finalsRef.current = finals.filter((f) => f.length > 0);
      const shown = [...finalsRef.current.map((f) => f[0]), interim].join(" ").trim();
      setRecognizedText(shown);
    };
    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === "audio-capture" && allowRetryAlone && recorderRef.current) {
        // Mic could not be shared with MediaRecorder (common on some Android builds):
        // drop recording for this device and retry recognition alone.
        try { localStorage.setItem(NO_PARALLEL_KEY, "1"); } catch { /* ignore */ }
        stopRecorder();
        recorderRef.current = null;
        setNotice(l("此设备无法同时录音和识别，已切换为仅识别模式。", "この端末では録音と認識を同時に行えないため、認識のみで続行します。"));
        setTimeout(() => startRecognizer(false), 150);
        return;
      }
      if (event.error === "no-speech") {
        setRecognizedText(l("未检测到语音，请再试一次", "音声が検出されませんでした。もう一度試してください。"));
      } else if (event.error === "not-allowed") {
        setMicPermission("denied");
      } else if (event.error !== "aborted") {
        setRecognizedText(`${l("识别出错", "認識エラー")}: ${event.error}`);
      }
    };
    recognition.onend = () => {
      // Chrome may end continuous sessions on silence; keep listening until the user stops.
      if (!userStoppedRef.current && recognitionRef.current === recognition && finalsRef.current.length === 0) {
        try { recognition.start(); return; } catch { /* fall through */ }
      }
      if (recognitionRef.current !== recognition) return;
      setIsRecording(false);
      stopRecorder();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      void score();
    };
    recognitionRef.current = recognition;
    try { recognition.start(); } catch { return false; }
    return true;
  }, [l, score, stopRecorder, trainingLanguage]);

  const startRecording = useCallback(
    (originalText: string, compareText?: string, segments?: PhoneticSegment[]) => {
      const textForComparison = trainingLanguage === "ja" && compareText ? compareText : originalText;
      const SpeechRecognitionAPI = typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : undefined;
      stopSpeaking();
      recognitionRef.current?.abort();
      recognitionRef.current = null;
      setCompareResult(null);
      setRecognizedText("");
      setNotice("");
      finalsRef.current = [];
      scoredRef.current = false;
      userStoppedRef.current = false;
      targetRef.current = { text: originalText, compareText: textForComparison, segments };

      let noParallel = false;
      try { noParallel = localStorage.getItem(NO_PARALLEL_KEY) === "1"; } catch { /* ignore */ }
      const wantRecorder = typeof MediaRecorder !== "undefined" && (!noParallel || !SpeechRecognitionAPI);

      const begin = async () => {
        if (wantRecorder) {
          try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
            setMicPermission("granted");
            streamRef.current = stream;
            const mimeType = pickRecorderMimeType();
            const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
            chunksRef.current = [];
            recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
            recorder.onstop = () => {
              stream.getTracks().forEach((t) => t.stop());
              if (streamRef.current === stream) streamRef.current = null;
              if (chunksRef.current.length === 0) return;
              const blob = new Blob(chunksRef.current, { type: recorder.mimeType || mimeType || "audio/webm" });
              if (urlRef.current) URL.revokeObjectURL(urlRef.current);
              const url = URL.createObjectURL(blob);
              urlRef.current = url;
              setRecordingUrl(url);
            };
            recorder.start(250);
            recorderRef.current = recorder;
          } catch {
            setMicPermission("denied");
            return;
          }
        } else {
          const ok = await requestMicPermission();
          if (!ok) return;
          recorderRef.current = null;
        }

        if (!SpeechRecognitionAPI) {
          // Recording-only mode (e.g. Firefox): still allows self-review playback.
          setIsRecording(true);
          setNotice(l("当前浏览器不支持语音识别，可录音后回放自查。推荐使用 Android/桌面版 Chrome。", "このブラウザは音声認識に未対応です。録音して聞き返すことはできます（Android/PC版 Chrome 推奨）。"));
          timeoutRef.current = setTimeout(() => { stopRecorder(); setIsRecording(false); }, MAX_SESSION_MS);
          return;
        }
        const started = startRecognizer(Boolean(recorderRef.current));
        if (!started) {
          stopRecorder();
          setRecognizedText(l("语音识别启动失败，请重试", "音声認識を開始できませんでした。もう一度お試しください。"));
          return;
        }
        timeoutRef.current = setTimeout(() => { userStoppedRef.current = true; recognitionRef.current?.stop(); }, MAX_SESSION_MS);
      };
      void begin();
    },
    [l, requestMicPermission, startRecognizer, stopRecorder, stopSpeaking, trainingLanguage],
  );

  const stopRecording = useCallback(() => {
    userStoppedRef.current = true;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    } else {
      stopRecorder();
      setIsRecording(false);
    }
  }, [stopRecorder]);

  return {
    isRecording,
    recognizedText,
    compareResult,
    micPermission,
    recordingUrl,
    notice,
    startRecording,
    stopRecording,
    clearRecognition,
    requestMicPermission,
    dismissMicBanner,
  };
}
