"use client";

/**
 * useShadowingEngine
 *
 * A self-contained hook that drives all shadowing exercise logic.
 * It abstracts over the audio source (`IShadowingContent`) so the
 * component only needs to deal with state transitions and callbacks.
 *
 * Responsibilities:
 *  - Playback orchestration (play / pause / seek, countdown)
 *  - Recording state management (via MediaRecorder + Web Audio API)
 *  - Per-attempt score calculation (via ScoreCalculator)
 *  - Countdown timer between listen → shadow phases
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { IShadowingContent, ShadowingAttemptMetrics } from "@toeicpass/shared";
import { ScoreCalculator, ScoreResult } from "../lib/score-calculator";

// ── Types ─────────────────────────────────────────────────────────────────────

export type EnginePhase =
  | "idle"
  | "loading"
  | "listening"   // Playing the reference audio
  | "countdown"   // Counting down before shadow window
  | "shadowing"   // User is recording their shadow
  | "reviewing"   // Playback of the user's own recording
  | "scored"      // Score result available
  | "error";

export interface ShadowingEngineState {
  phase: EnginePhase;
  /** Current playback position in seconds. */
  currentTimeSec: number;
  /** Countdown seconds remaining (only meaningful during 'countdown' phase). */
  countdownSec: number;
  /** Whether the audio is currently playing. */
  isPlaying: boolean;
  /** Whether the microphone is recording. */
  isRecording: boolean;
  /** Latest score result (available after 'scored' phase). */
  lastScore: ScoreResult | null;
  /** Blob URL for the user's last recording. */
  recordingUrl: string | null;
  error: string | null;
}

export interface UseShadowingEngineOptions {
  /** IShadowingContent to drive the session. */
  content: IShadowingContent | null;
  /** Seconds to count down before the shadowing window opens. Default: 3. */
  countdownDuration?: number;
  /** Score calculator options. */
  scoreWeights?: { pronunciation?: number; fluency?: number };
  /** Called when a score is computed. */
  onScored?: (result: ScoreResult) => void;
}

export interface UseShadowingEngineReturn {
  state: ShadowingEngineState;
  /** Start listening to the reference audio (enter 'listening' phase). */
  startListening: () => void;
  /** Pause/resume playback. */
  togglePlayback: () => void;
  /** Begin countdown then start recording. */
  startShadowing: () => void;
  /** Manually stop recording early. */
  stopRecording: () => void;
  /** Play back the last user recording. */
  reviewRecording: () => void;
  /** Reset to idle state. */
  reset: () => void;
  /** Seek the audio to a given second. */
  seekTo: (sec: number) => void;
}

const DEFAULT_COUNTDOWN = 3;

const INITIAL_STATE: ShadowingEngineState = {
  phase: "idle",
  currentTimeSec: 0,
  countdownSec: 0,
  isPlaying: false,
  isRecording: false,
  lastScore: null,
  recordingUrl: null,
  error: null,
};

export function useShadowingEngine(
  options: UseShadowingEngineOptions,
): UseShadowingEngineReturn {
  const {
    content,
    countdownDuration = DEFAULT_COUNTDOWN,
    scoreWeights,
    onScored,
  } = options;

  const [state, setState] = useState<ShadowingEngineState>(INITIAL_STATE);

  // Audio element for reference playback
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // MediaRecorder for capturing the user's shadow attempt
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  // Countdown interval handle
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Audio context for analysis
  const audioCtxRef = useRef<AudioContext | null>(null);
  // URL to clean up on unmount
  const recordingUrlRef = useRef<string | null>(null);

  const scoreCalc = useRef(
    new ScoreCalculator({ weights: scoreWeights }),
  );

  // Re-create calculator if weights change
  useEffect(() => {
    scoreCalc.current = new ScoreCalculator({ weights: scoreWeights });
  }, [scoreWeights?.pronunciation, scoreWeights?.fluency]);

  // Initialise audio element when content changes
  useEffect(() => {
    if (!content) return;

    const audio = new Audio();

    if (content.sourceKind === "youtube") {
      // For YouTube content the caller is expected to supply a proxy URL or
      // the component should use an embedded player. We set the audioRef to
      // null and trust the component to handle playback externally.
      audioRef.current = null;
    } else {
      audio.src = content.audioRef;
      audio.preload = "metadata";
      audio.ontimeupdate = () => {
        setState((prev) => ({
          ...prev,
          currentTimeSec: audio.currentTime,
        }));
      };
      audio.onended = () => {
        setState((prev) => ({ ...prev, isPlaying: false }));
      };
      audio.onerror = () => {
        setState((prev) => ({
          ...prev,
          phase: "error",
          error: "Failed to load audio",
          isPlaying: false,
        }));
      };
      audioRef.current = audio;
    }

    return () => {
      audio.pause();
      audio.src = "";
    };
  }, [content?.id]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearCountdown();
      audioRef.current?.pause();
      recorderRef.current?.stop();
      if (recordingUrlRef.current) {
        URL.revokeObjectURL(recordingUrlRef.current);
      }
    };
  }, []);

  const clearCountdown = () => {
    if (countdownRef.current !== null) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  };

  const startListening = useCallback(() => {
    if (!content) return;
    const audio = audioRef.current;
    if (audio) {
      audio.currentTime = 0;
      void audio.play().catch(() => {
        setState((prev) => ({
          ...prev,
          phase: "error",
          error: "Autoplay blocked. Please interact with the page first.",
        }));
      });
    }
    setState((prev) => ({
      ...prev,
      phase: "listening",
      isPlaying: true,
      error: null,
    }));
  }, [content]);

  const togglePlayback = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      void audio.play();
      setState((prev) => ({ ...prev, isPlaying: true }));
    } else {
      audio.pause();
      setState((prev) => ({ ...prev, isPlaying: false }));
    }
  }, []);

  const seekTo = useCallback((sec: number) => {
    const audio = audioRef.current;
    if (audio) {
      audio.currentTime = sec;
      setState((prev) => ({ ...prev, currentTimeSec: sec }));
    }
  }, []);

  const startCountdown = useCallback(() => {
    audioRef.current?.pause();
    setState((prev) => ({
      ...prev,
      phase: "countdown",
      isPlaying: false,
      countdownSec: countdownDuration,
    }));

    let remaining = countdownDuration;
    countdownRef.current = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearCountdown();
        beginRecording();
      } else {
        setState((prev) => ({ ...prev, countdownSec: remaining }));
      }
    }, 1000);
  }, [countdownDuration]);

  const beginRecording = useCallback(() => {
    chunksRef.current = [];

    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        // Optional: set up AudioContext for real-time analysis
        const ctx = new AudioContext();
        audioCtxRef.current = ctx;
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        source.connect(analyser);

        const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };
        recorder.onstop = () => {
          stream.getTracks().forEach((t) => t.stop());
          void ctx.close();
          finalize();
        };
        recorder.start();
        recorderRef.current = recorder;

        setState((prev) => ({
          ...prev,
          phase: "shadowing",
          isRecording: true,
          countdownSec: 0,
        }));
      })
      .catch(() => {
        setState((prev) => ({
          ...prev,
          phase: "error",
          error: "Microphone access denied",
        }));
      });
  }, []);

  const stopRecording = useCallback(() => {
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
    }
  }, []);

  const finalize = useCallback(() => {
    const blob = new Blob(chunksRef.current, { type: "audio/webm" });

    if (recordingUrlRef.current) {
      URL.revokeObjectURL(recordingUrlRef.current);
    }
    const url = URL.createObjectURL(blob);
    recordingUrlRef.current = url;

    // ── Score estimation ──────────────────────────────────────────────────────
    // In production replace with a real speech-scoring backend or on-device model.
    // Here we compute a heuristic score based on blob size relative to content.
    const durationSec = content?.durationSec ?? 5;
    const expectedBytes = durationSec * 6000; // ~6 kB/s heuristic
    const completeness = Math.min(100, (blob.size / expectedBytes) * 100);
    // Pronunciation and fluency scores are placeholders pending real ASR integration.
    const metrics: ShadowingAttemptMetrics = {
      pronunciationScore: 70 + Math.random() * 20, // placeholder
      fluencyScore: 65 + Math.random() * 25,       // placeholder
      completenessScore: completeness,
    };

    const result = scoreCalc.current.compute(metrics);
    onScored?.(result);

    setState((prev) => ({
      ...prev,
      phase: "scored",
      isRecording: false,
      lastScore: result,
      recordingUrl: url,
    }));
  }, [content, onScored]);

  const startShadowing = useCallback(() => {
    startCountdown();
  }, [startCountdown]);

  const reviewRecording = useCallback(() => {
    const url = state.recordingUrl ?? recordingUrlRef.current;
    if (!url) return;
    const audio = new Audio(url);
    setState((prev) => ({ ...prev, phase: "reviewing", isPlaying: true }));
    audio.onended = () => {
      setState((prev) => ({ ...prev, phase: "scored", isPlaying: false }));
    };
    void audio.play();
  }, [state.recordingUrl]);

  const reset = useCallback(() => {
    clearCountdown();
    audioRef.current?.pause();
    if (audioRef.current) audioRef.current.currentTime = 0;
    recorderRef.current?.stop();
    if (recordingUrlRef.current) {
      URL.revokeObjectURL(recordingUrlRef.current);
      recordingUrlRef.current = null;
    }
    setState(INITIAL_STATE);
  }, []);

  return {
    state,
    startListening,
    togglePlayback,
    startShadowing,
    stopRecording,
    reviewRecording,
    reset,
    seekTo,
  };
}
