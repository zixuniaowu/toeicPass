"use client";

import { useState } from "react";
import type { RewardVideoAdProps } from "../types";
import styles from "./RewardVideoAd.module.css";

const COPY = {
  zh: {
    title: "观看广告获得额外练习",
    desc: "观看一段短视频广告，即可获得额外的练习机会",
    watchBtn: "观看广告",
    watching: "广告播放中...",
    complete: "广告已完成！",
    reward: "你获得了 +5 次额外练习机会",
    continueBtn: "继续学习",
    skipBtn: "跳过",
    progressLabel: (s: number) => `${s}秒`,
  },
  ja: {
    title: "広告を見て追加練習を獲得",
    desc: "短い動画広告を視聴すると、追加の練習チャンスが得られます",
    watchBtn: "広告を見る",
    watching: "広告再生中...",
    complete: "広告が完了しました！",
    reward: "+5回の追加練習を獲得しました",
    continueBtn: "学習を続ける",
    skipBtn: "スキップ",
    progressLabel: (s: number) => `${s}秒`,
  },
} as const;

export function RewardVideoAd({ locale, onRewardEarned, onSkip, api }: RewardVideoAdProps) {
  const [phase, setPhase] = useState<"offer" | "watching" | "complete">("offer");
  const [progress, setProgress] = useState(0);
  const copy = COPY[locale];

  const DURATION = 15;

  const handleWatch = () => {
    setPhase("watching");
    setProgress(0);

    let elapsed = 0;
    const timer = setInterval(() => {
      elapsed += 1;
      setProgress(elapsed);
      if (elapsed >= DURATION) {
        clearInterval(timer);
        setPhase("complete");
        void api.fetchAds("reward_video").then((ads) => {
          if (ads.length > 0) {
            void api.recordAdEvent(ads[0].id, "click");
          }
        });
      }
    }, 1000);
  };

  const handleContinue = () => {
    onRewardEarned();
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        {phase === "offer" && (
          <>
            <div className={styles.icon}>🎬</div>
            <h3 className={styles.title}>{copy.title}</h3>
            <p className={styles.desc}>{copy.desc}</p>
            <div className={styles.actions}>
              <button className={styles.watchBtn} onClick={handleWatch}>
                {copy.watchBtn}
              </button>
              <button className={styles.skipBtn} onClick={onSkip}>
                {copy.skipBtn}
              </button>
            </div>
          </>
        )}

        {phase === "watching" && (
          <>
            <div className={styles.videoPlaceholder}>
              <div className={styles.videoBox}>
                <span className={styles.videoIcon}>▶</span>
              </div>
            </div>
            <p className={styles.watchingText}>{copy.watching}</p>
            <div className={styles.progressWrapper}>
              <div className={styles.progressBar}>
                <div
                  className={styles.progressFill}
                  style={{ width: `${(progress / DURATION) * 100}%` }}
                />
              </div>
              <span className={styles.progressLabel}>{copy.progressLabel(DURATION - progress)}</span>
            </div>
          </>
        )}

        {phase === "complete" && (
          <>
            <div className={styles.icon}>🎉</div>
            <h3 className={styles.title}>{copy.complete}</h3>
            <p className={styles.reward}>{copy.reward}</p>
            <button className={styles.watchBtn} onClick={handleContinue}>
              {copy.continueBtn}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
