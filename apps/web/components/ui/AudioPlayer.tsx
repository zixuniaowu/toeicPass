"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import styles from "./AudioPlayer.module.css";

interface AudioPlayerProps {
  src?: string;
  label?: string;
  compact?: boolean;
  ttsText?: string;
  ttsLabel?: string;
}

type ClipRange = {
  sourceUrl: string;
  start?: number;
  end?: number;
};

const clipBlobCache = new Map<string, string>();
const clipBlobPromiseCache = new Map<string, Promise<string>>();

function parseClipRange(src?: string): ClipRange | null {
  if (!src) {
    return null;
  }
  const [sourceUrl, fragment] = src.split("#", 2);
  if (!fragment) {
    return { sourceUrl };
  }
  const match = fragment.match(/(?:^|&)t=(\d+(?:\.\d+)?)(?:,(\d+(?:\.\d+)?))?/i);
  if (!match) {
    return { sourceUrl };
  }
  const start = Number(match[1]);
  const end = typeof match[2] === "string" ? Number(match[2]) : undefined;
  return {
    sourceUrl,
    start: Number.isFinite(start) ? start : undefined,
    end: Number.isFinite(end) ? end : undefined,
  };
}

function formatSec(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const mm = Math.floor(safe / 60);
  const ss = safe % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

function writeWavHeader(view: DataView, dataBytes: number, channels: number, sampleRate: number): void {
  const writeString = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i += 1) {
      view.setUint8(offset + i, value.charCodeAt(i));
    }
  };
  const bytesPerSample = 2;
  const blockAlign = channels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bytesPerSample * 8, true);
  writeString(36, "data");
  view.setUint32(40, dataBytes, true);
}

function encodeWavClip(audioBuffer: AudioBuffer, startSec: number, endSec: number): Blob {
  const sampleRate = audioBuffer.sampleRate;
  const channels = audioBuffer.numberOfChannels;
  const startFrame = Math.max(0, Math.floor(startSec * sampleRate));
  const endFrame = Math.max(startFrame + 1, Math.min(audioBuffer.length, Math.floor(endSec * sampleRate)));
  const frameCount = endFrame - startFrame;
  const bytesPerSample = 2;
  const dataBytes = frameCount * channels * bytesPerSample;
  const wavBuffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(wavBuffer);
  writeWavHeader(view, dataBytes, channels, sampleRate);

  let offset = 44;
  for (let frame = 0; frame < frameCount; frame += 1) {
    for (let channel = 0; channel < channels; channel += 1) {
      const sample = audioBuffer.getChannelData(channel)[startFrame + frame] ?? 0;
      const normalized = Math.max(-1, Math.min(1, sample));
      const pcm = normalized < 0 ? normalized * 0x8000 : normalized * 0x7fff;
      view.setInt16(offset, Math.round(pcm), true);
      offset += 2;
    }
  }
  return new Blob([wavBuffer], { type: "audio/wav" });
}

async function buildClipBlobUrl(range: ClipRange): Promise<string> {
  if (typeof range.start !== "number" || typeof range.end !== "number" || range.end <= range.start) {
    throw new Error("Invalid clip range");
  }
  const response = await fetch(range.sourceUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch source audio: ${response.status}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  const audioContext = new window.AudioContext();
  try {
    const decoded = await audioContext.decodeAudioData(arrayBuffer.slice(0));
    const clipBlob = encodeWavClip(decoded, range.start, range.end);
    return URL.createObjectURL(clipBlob);
  } finally {
    await audioContext.close();
  }
}

export const AudioPlayer = forwardRef<HTMLAudioElement, AudioPlayerProps>(
  ({ src, label, compact = false, ttsText, ttsLabel = "题干朗读（匹配当前题目）" }, ref) => {
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [ttsError, setTtsError] = useState<string>("");
    const [resolvedSrc, setResolvedSrc] = useState<string | undefined>(undefined);
    const [clipStatusText, setClipStatusText] = useState<string>("");
    const utterRef = useRef<SpeechSynthesisUtterance | null>(null);
    const internalAudioRef = useRef<HTMLAudioElement | null>(null);
    const clipRange = useMemo(() => parseClipRange(src), [src]);

    useImperativeHandle(ref, () => internalAudioRef.current as HTMLAudioElement, []);

    useEffect(() => {
      if (!clipRange) {
        setResolvedSrc(undefined);
        setClipStatusText("");
        return;
      }
      const { sourceUrl, start, end } = clipRange;
      if (typeof start !== "number" || typeof end !== "number" || end <= start) {
        setResolvedSrc(sourceUrl);
        setClipStatusText("");
        return;
      }

      const clipKey = `${sourceUrl}|${start}|${end}`;
      const cached = clipBlobCache.get(clipKey);
      if (cached) {
        setResolvedSrc(cached);
        setClipStatusText("已切片为题目音频");
        return;
      }

      let disposed = false;
      setResolvedSrc(sourceUrl);
      setClipStatusText("正在切分题目音频...");

      let pending = clipBlobPromiseCache.get(clipKey);
      if (!pending) {
        pending = buildClipBlobUrl(clipRange);
        clipBlobPromiseCache.set(clipKey, pending);
      }

      pending
        .then((blobUrl) => {
          clipBlobCache.set(clipKey, blobUrl);
          if (disposed) {
            return;
          }
          setResolvedSrc(blobUrl);
          setClipStatusText("已切片为题目音频");
        })
        .catch(() => {
          if (disposed) {
            return;
          }
          setResolvedSrc(sourceUrl);
          setClipStatusText("切片失败，已启用片段播放控制");
        })
        .finally(() => {
          if (clipBlobPromiseCache.get(clipKey) === pending) {
            clipBlobPromiseCache.delete(clipKey);
          }
        });

      return () => {
        disposed = true;
      };
    }, [clipRange]);

    useEffect(() => {
      return () => {
        if (typeof window !== "undefined" && "speechSynthesis" in window) {
          window.speechSynthesis.cancel();
        }
      };
    }, []);

    useEffect(() => {
      const audio = internalAudioRef.current;
      if (!audio || !clipRange?.sourceUrl || !resolvedSrc) {
        return;
      }

      const start = clipRange.start;
      const end = clipRange.end;
      if (typeof start !== "number" || !Number.isFinite(start)) {
        return;
      }
      if (resolvedSrc !== clipRange.sourceUrl) {
        return;
      }

      const seekToStart = () => {
        if (!Number.isFinite(audio.currentTime) || Math.abs(audio.currentTime - start) > 0.2) {
          try {
            audio.currentTime = start;
          } catch {
            // Ignore metadata race conditions and let the next event retry.
          }
        }
      };

      const onLoadedMetadata = () => {
        seekToStart();
      };

      const onPlay = () => {
        if (audio.currentTime < start || (typeof end === "number" && audio.currentTime >= end)) {
          seekToStart();
        }
      };

      const onTimeUpdate = () => {
        if (typeof end !== "number" || !Number.isFinite(end)) {
          return;
        }
        if (audio.currentTime >= end) {
          audio.pause();
          seekToStart();
        }
      };

      audio.addEventListener("loadedmetadata", onLoadedMetadata);
      audio.addEventListener("play", onPlay);
      audio.addEventListener("timeupdate", onTimeUpdate);
      seekToStart();

      return () => {
        audio.removeEventListener("loadedmetadata", onLoadedMetadata);
        audio.removeEventListener("play", onPlay);
        audio.removeEventListener("timeupdate", onTimeUpdate);
      };
    }, [clipRange?.sourceUrl, clipRange?.start, clipRange?.end, resolvedSrc]);

    const stopTts = () => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) {
        return;
      }
      window.speechSynthesis.cancel();
      utterRef.current = null;
      setIsSpeaking(false);
    };

    const startTts = () => {
      if (!ttsText) {
        return;
      }
      if (typeof window === "undefined" || !("speechSynthesis" in window)) {
        setTtsError("当前浏览器不支持语音朗读。");
        return;
      }
      setTtsError("");
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(ttsText);
      utterance.lang = "en-US";
      utterance.rate = 0.9;
      utterance.pitch = 1;
      utterance.onend = () => {
        setIsSpeaking(false);
        utterRef.current = null;
      };
      utterance.onerror = () => {
        setIsSpeaking(false);
        setTtsError("朗读失败，请重试。");
      };
      utterRef.current = utterance;
      window.speechSynthesis.speak(utterance);
      setIsSpeaking(true);
    };

    return (
      <div className={`${styles.wrapper} ${compact ? styles.compact : ""}`}>
        {label && <p className={styles.label}>{label}</p>}
        {clipRange && typeof clipRange.start === "number" && typeof clipRange.end === "number" && (
          <p className={styles.clipMeta}>
            音频片段：{formatSec(clipRange.start)} - {formatSec(clipRange.end)}
          </p>
        )}
        {clipStatusText && <p className={styles.clipHint}>{clipStatusText}</p>}
        {ttsText && (
          <div className={styles.ttsBlock}>
            <div className={styles.ttsHeader}>
              <p className={styles.ttsLabel}>{ttsLabel}</p>
              <div className={styles.ttsActions}>
                <button className={styles.ttsButton} onClick={startTts} type="button">
                  {isSpeaking ? "重新播放" : "播放朗读"}
                </button>
                <button
                  className={`${styles.ttsButton} ${styles.ttsStop}`}
                  onClick={stopTts}
                  type="button"
                  disabled={!isSpeaking}
                >
                  停止
                </button>
              </div>
            </div>
            {ttsError && <p className={styles.ttsError}>{ttsError}</p>}
          </div>
        )}
        {resolvedSrc && (
          <audio
            key={resolvedSrc}
            ref={internalAudioRef}
            controls
            preload="metadata"
            src={resolvedSrc}
            className={styles.audio}
          />
        )}
      </div>
    );
  }
);

AudioPlayer.displayName = "AudioPlayer";
