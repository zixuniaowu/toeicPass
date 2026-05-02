"use client";
/**
 * RecordingPanel — mic permission banner, record/stop controls, and accuracy feedback.
 */
import type { CompareWord, TrainingLanguage, PhoneticSegment } from "../../lib/shadowing-utils";
import type { MicPermission } from "../../hooks/useSpeechRecognition";
import styles from "./ShadowingView.module.css";

type Props = {
  micPermission: MicPermission;
  isRecording: boolean;
  isSpeaking: boolean;
  recognizedText: string;
  compareResult: { words: CompareWord[]; accuracy: number } | null;
  sentenceText: string;
  /** Hiragana-only phonetic version of sentenceText (Japanese only).
   *  When provided, speech-recognition output is compared against this
   *  instead of the raw kanji text, avoiding false mismatches. */
  sentencePhoneticText?: string;
  /** Kuromoji morpheme segments (surface + hiragana reading) for token-level comparison.
   *  When provided, accuracy feedback colours whole morphemes instead of individual kana. */
  sentenceSegments?: PhoneticSegment[];
  trainingLanguage?: TrainingLanguage;
  onStartRecording: (text: string, compareText?: string, segments?: PhoneticSegment[]) => void;
  onStopRecording: () => void;
  onDismissMicBanner: () => void;
  l: (zh: string, ja: string, en?: string) => string;
};

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
  onStartRecording,
  onStopRecording,
  onDismissMicBanner,
  l,
}: Props) {
  const isJa = trainingLanguage === "ja";
  // Use phonetic text for comparison when available (Japanese kanji → hiragana)
  const textForComparison = (isJa && sentencePhoneticText) ? sentencePhoneticText : sentenceText;
  return (
    <div className={styles.recordSection}>
      {micPermission === "denied" && (
        <div className={styles.micBanner}>
          <div className={styles.micBannerIcon}>🎙</div>
          <div className={styles.micBannerContent}>
            <strong>{l("需要麦克风权限", "マイクの許可が必要です")}</strong>
            <p>
              {l(
                "请点击浏览器地址栏左侧的🔒图标，将麦克风设为「允许」后刷新页面",
                "ブラウザのアドレスバー左の🔒アイコンをタップし、マイクを「許可」に変更してページを再読み込みしてください",
              )}
            </p>
          </div>
          <button
            className={styles.micBannerClose}
            onClick={onDismissMicBanner}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
      )}

      <div className={styles.recordActions}>
        {!isRecording ? (
          <button
            className={styles.recordBtn}
            onClick={() => onStartRecording(sentenceText, textForComparison, sentenceSegments)}
            disabled={isSpeaking}
          >
            {`🎙 ${l("开始跟读", "シャドーイング開始")}`}
          </button>
        ) : (
          <button
            className={`${styles.recordBtn} ${styles.recordBtnActive}`}
            onClick={onStopRecording}
          >
            {`⏹ ${l("停止录音", "録音停止")}`}
          </button>
        )}
        {isRecording && (
          <span className={styles.recordingIndicator}>{l("录音中...", "録音中...")}</span>
        )}
      </div>

      {recognizedText && !compareResult && (
        <div className={styles.recognizedText}>
          <span className={styles.recognizedLabel}>{l("识别中：", "認識中：")}</span>
          {recognizedText}
        </div>
      )}

      {compareResult && (
        <div className={styles.compareResult}>
          <div className={styles.accuracyBar}>
            <span className={styles.accuracyLabel}>
              {l("准确率", "正確率")}：{compareResult.accuracy}%
            </span>
            <div className={styles.accuracyTrack}>
              <div
                className={styles.accuracyFill}
                style={{
                  width: `${compareResult.accuracy}%`,
                  background:
                    compareResult.accuracy >= 80
                      ? "var(--color-success, #10b981)"
                      : compareResult.accuracy >= 50
                        ? "var(--color-warning, #f59e0b)"
                        : "#dc2626",
                }}
              />
            </div>
            {compareResult.accuracy >= 80 && (
              <span className={styles.accuracyEmoji}>{l("太棒了！", "すばらしい！", "excellent!")}</span>
            )}
            {compareResult.accuracy >= 50 && compareResult.accuracy < 80 && (
              <span className={styles.accuracyEmoji}>{l("不错，继续加油！", "良いです！", "good, keep going")}</span>
            )}
            {compareResult.accuracy < 50 && (
              <span className={styles.accuracyEmoji}>{l("再试一次！", "もう一度！", "try again")}</span>
            )}
          </div>

          {/* For Japanese, remove inter-character gaps so the text flows naturally */}
          <div
            className={styles.wordComparison}
            style={isJa ? { gap: 0, letterSpacing: "0.05em" } : undefined}
          >
            {compareResult.words.map((w, i) => (
              <span
                key={i}
                className={
                  w.status === "correct"
                    ? styles.wordCorrect
                    : w.status === "wrong"
                      ? styles.wordWrong
                      : styles.wordMissing
                }
                title={
                  w.status === "correct"
                    ? l("正确", "正解")
                    : w.status === "wrong"
                      ? l("多余/错误", "余分/誤り")
                      : l("漏读", "読み落とし")
                }
              >
                {w.word}{!isJa && " "}
              </span>
            ))}
          </div>

          <div className={styles.compareHint}>
            <span className={styles.wordCorrect}>{l("绿色=正确", "緑=正解")}</span>
            <span className={styles.wordWrong}>{l("红色=错误", "赤=誤り")}</span>
            <span className={styles.wordMissing}>{l("灰色=漏读", "灰=読み落とし")}</span>
          </div>

          <button
            className={styles.retryBtn}
            onClick={() => onStartRecording(sentenceText, textForComparison, sentenceSegments)}
          >
            {`🎙 ${l("再读一次", "もう一度読む")}`}
          </button>
        </div>
      )}
    </div>
  );
}
