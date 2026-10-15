"use client";
/**
 * RecordingPanel — mic banner, record/stop, playback (mine / model / A-B) and
 * detailed per-word feedback with tips and tap-to-hear.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  feedbackTipText,
  type CompareWord,
  type PhoneticSegment,
  type TrainingLanguage,
} from "@toeicpass/app-core/shadowing-compare";
import type { MicPermission } from "../../hooks/useSpeechRecognition";
import styles from "./ShadowingView.module.css";
import fb from "./ShadowingFeedback.module.css";

type Props = {
  micPermission: MicPermission;
  isRecording: boolean;
  isSpeaking: boolean;
  recognizedText: string;
  compareResult: { words: CompareWord[]; accuracy: number } | null;
  sentenceText: string;
  sentencePhoneticText?: string;
  sentenceSegments?: PhoneticSegment[];
  trainingLanguage?: TrainingLanguage;
  recordingUrl?: string | null;
  notice?: string;
  uiLang?: "zh" | "ja" | "en";
  speechRate?: number;
  onStartRecording: (text: string, compareText?: string, segments?: PhoneticSegment[]) => void;
  onStopRecording: () => void;
  onDismissMicBanner: () => void;
  l: (zh: string, ja: string, en?: string) => string;
};

/** Speak text with the browser TTS; resolves when finished. */
export function speakText(text: string, lang: TrainingLanguage, rate = 0.95): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) { resolve(); return; }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang === "ja" ? "ja-JP" : "en-US";
    u.rate = rate;
    const voice = window.speechSynthesis.getVoices().find((v) => v.lang.replace("_", "-").startsWith(u.lang));
    if (voice) u.voice = voice;
    u.onend = () => resolve();
    u.onerror = () => resolve();
    window.speechSynthesis.speak(u);
  });
}

type PlayMode = "none" | "mine" | "model" | "ab";

export function RecordingPanel({
  micPermission,
  isRecording,
  isSpeaking,
  recognizedText,
  compareResult,
  sentenceText,
  sentencePhoneticText,
  sentenceSegments,
  trainingLanguage = "en",
  recordingUrl = null,
  notice = "",
  uiLang = "zh",
  speechRate = 0.95,
  onStartRecording,
  onStopRecording,
  onDismissMicBanner,
  l,
}: Props) {
  const isJa = trainingLanguage === "ja";
  const textForComparison = isJa && sentencePhoneticText ? sentencePhoneticText : sentenceText;
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState<PlayMode>("none");

  useEffect(() => () => { audioRef.current?.pause(); }, []);

  const playMine = useCallback((): Promise<void> => new Promise((resolve) => {
    if (!recordingUrl) { resolve(); return; }
    audioRef.current?.pause();
    const audio = new Audio(recordingUrl);
    audioRef.current = audio;
    audio.onended = () => resolve();
    audio.onerror = () => resolve();
    void audio.play().catch(() => resolve());
  }), [recordingUrl]);

  const stopAll = useCallback(() => {
    audioRef.current?.pause();
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    setPlaying("none");
  }, []);

  const run = useCallback(async (mode: PlayMode) => {
    if (playing !== "none") { stopAll(); if (playing === mode) return; }
    setPlaying(mode);
    if (mode === "mine") await playMine();
    if (mode === "model") await speakText(sentenceText, trainingLanguage, speechRate);
    if (mode === "ab") {
      await speakText(sentenceText, trainingLanguage, speechRate);
      await new Promise((r) => setTimeout(r, 350));
      await playMine();
    }
    setPlaying("none");
  }, [playMine, playing, sentenceText, speechRate, stopAll, trainingLanguage]);

  const start = () => { stopAll(); onStartRecording(sentenceText, textForComparison, sentenceSegments); };

  const statusClass = (w: CompareWord) => fb[w.status] ?? "";
  const statusLabel = (s: CompareWord["status"]) =>
    ({ correct: l("正确", "正解"), close: l("接近", "惜しい"), wrong: l("读错", "誤り"), missing: l("漏读", "読み落とし"), extra: l("多读", "余分") })[s];
  const issues = compareResult?.words.filter((w) => w.status !== "correct") ?? [];
  const tipLang = uiLang === "ja" ? "ja" : "zh";

  return (
    <div className={styles.recordSection}>
      {micPermission === "denied" && (
        <div className={styles.micBanner}>
          <div className={styles.micBannerIcon}>🎙</div>
          <div className={styles.micBannerContent}>
            <strong>{l("需要麦克风权限", "マイクの許可が必要です")}</strong>
            <p>{l("请点击浏览器地址栏左侧的🔒图标，将麦克风设为「允许」后刷新页面", "ブラウザのアドレスバー左の🔒アイコンをタップし、マイクを「許可」に変更してページを再読み込みしてください")}</p>
          </div>
          <button className={styles.micBannerClose} onClick={onDismissMicBanner} aria-label="Close">✕</button>
        </div>
      )}

      <div className={styles.recordActions}>
        {!isRecording ? (
          <button className={styles.recordBtn} onClick={start} disabled={isSpeaking} data-testid="record-start">
            {`🎙 ${compareResult ? l("再读一次", "もう一度読む") : l("开始跟读", "シャドーイング開始")}`}
          </button>
        ) : (
          <button className={`${styles.recordBtn} ${styles.recordBtnActive}`} onClick={onStopRecording} data-testid="record-stop">
            {`⏹ ${l("读完了，停止", "読み終わったら停止")}`}
          </button>
        )}
        {isRecording && <span className={styles.recordingIndicator}>{l("录音中…读完后点击停止", "録音中…読み終えたら停止")}</span>}
      </div>

      {notice && <p className={fb.notice}>{notice}</p>}

      {(recordingUrl || compareResult) && !isRecording && (
        <div className={fb.playbackRow}>
          <button className={`${fb.playBtn} ${playing === "mine" ? fb.playBtnActive : ""}`} disabled={!recordingUrl} onClick={() => void run("mine")} data-testid="play-mine">
            ▶ {l("我的录音", "自分の録音")}
          </button>
          <button className={`${fb.playBtn} ${playing === "model" ? fb.playBtnActive : ""}`} onClick={() => void run("model")} data-testid="play-model">
            🔊 {l("原声", "お手本")}
          </button>
          <button className={`${fb.playBtn} ${playing === "ab" ? fb.playBtnActive : ""}`} disabled={!recordingUrl} onClick={() => void run("ab")} data-testid="play-ab">
            🔁 A/B {l("对比", "比較")}
          </button>
        </div>
      )}

      {recognizedText && !compareResult && (
        <div className={styles.recognizedText}>
          <span className={styles.recognizedLabel}>{l("识别中：", "認識中：")}</span>
          {recognizedText}
        </div>
      )}

      {compareResult && (
        <div className={styles.compareResult} data-testid="compare-result">
          <div className={fb.scoreRow}>
            <span className={fb.score} style={{ color: compareResult.accuracy >= 85 ? "#059669" : compareResult.accuracy >= 60 ? "#b45309" : "#dc2626" }}>
              {compareResult.accuracy}%
            </span>
            <span className={styles.accuracyEmoji}>
              {compareResult.accuracy >= 85 ? l("太棒了！", "すばらしい！") : compareResult.accuracy >= 60 ? l("不错，再打磨几个词", "いい感じ！あと数語を磨きましょう") : l("再听一遍原声，然后再试", "お手本をもう一度聞いて再挑戦")}
            </span>
          </div>
          <div className={styles.accuracyTrack}>
            <div className={styles.accuracyFill} style={{ width: `${compareResult.accuracy}%`, background: compareResult.accuracy >= 85 ? "#10b981" : compareResult.accuracy >= 60 ? "#f59e0b" : "#dc2626" }} />
          </div>

          <div className={`${fb.words} ${isJa ? fb.wordsJa : ""}`}>
            {compareResult.words.map((w, i) => (
              <button
                key={i}
                type="button"
                className={`${fb.word} ${statusClass(w)}`}
                title={`${statusLabel(w.status)}${w.heard && w.status !== "correct" ? ` · ${l("听到", "認識")}: ${w.heard}` : ""}`}
                onClick={() => void speakText(w.word, trainingLanguage, 0.8)}
              >
                {w.word}
              </button>
            ))}
          </div>
          <div className={fb.legend}>
            <span className={fb.correct}>{l("绿=正确", "緑=正解")}</span>
            <span className={fb.close}>{l("黄=接近", "黄=惜しい")}</span>
            <span className={fb.wrong}>{l("红=读错/漏读", "赤=誤り/抜け")}</span>
            <span className={fb.extra}>{l("灰=多读", "灰=余分")}</span>
          </div>
          <p className={fb.transcript}>{l("识别结果：", "認識結果：")}{recognizedText}</p>

          {issues.length > 0 && (
            <ul className={fb.issues} data-testid="issue-list">
              {issues.slice(0, 8).map((w, i) => (
                <li key={i} className={fb.issue}>
                  <span className={`${fb.issueBadge} ${statusClass(w)}`}>{statusLabel(w.status)}</span>
                  <div className={fb.issueBody}>
                    <span className={fb.issueWords}>
                      {w.status === "extra"
                        ? `${l("多读了", "余分")}: “${w.heard ?? w.word}”`
                        : w.status === "missing"
                          ? `${l("应读", "正しくは")}: “${w.word}” · ${l("未识别到", "認識されず")}`
                          : `${l("应读", "正しくは")}: “${w.word}”${isJa && w.expected ? `（${w.expected}）` : ""} · ${l("听到", "認識")}: “${w.heard ?? "—"}”`}
                      {w.status !== "extra" && (
                        <button type="button" className={fb.hearBtn} aria-label={l("听发音", "発音を聞く")} onClick={() => void speakText(w.word, trainingLanguage, 0.8)}>🔊</button>
                      )}
                    </span>
                    {w.tip && <span className={fb.issueTip}>💡 {feedbackTipText(w.tip, tipLang)}</span>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
