"use client";

import { useState } from "react";
import type { Locale } from "../../types";
import { RewardVideoAd } from "../ads/RewardVideoAd";
import styles from "./UpgradeModal.module.css";

interface UpgradeModalProps {
  locale: Locale;
  reason: string;
  onUpgrade: () => void;
  onClose: () => void;
  /** If true, show the "watch ad" option */
  showAds?: boolean;
  token?: string;
  tenantCode?: string;
  /** Called when user earns reward by watching ad */
  onRewardEarned?: () => void;
}

const COPY = {
  zh: {
    title: "已达使用上限",
    upgradeBtn: "查看升级计划",
    watchAdBtn: "🎬 观看广告获得额外次数",
    closeBtn: "稍后再说",
    hint: "升级到更高级别的会员计划，解锁更多功能和用量。",
    adHint: "或者观看一段短视频广告获得额外练习机会",
  },
  ja: {
    title: "利用上限に達しました",
    upgradeBtn: "プランを見る",
    watchAdBtn: "🎬 広告を見て追加回数を獲得",
    closeBtn: "後で",
    hint: "上位プランにアップグレードして、さらに多くの機能をアンロックしましょう。",
    adHint: "または短い動画広告を視聴して追加チャンスを獲得",
  },
} as const;

export function UpgradeModal({
  locale,
  reason,
  onUpgrade,
  onClose,
  showAds = false,
  token = "",
  tenantCode = "",
  onRewardEarned,
}: UpgradeModalProps) {
  const copy = COPY[locale];
  const [watchingAd, setWatchingAd] = useState(false);

  if (watchingAd) {
    return (
      <RewardVideoAd
        locale={locale}
        token={token}
        tenantCode={tenantCode}
        onRewardEarned={() => {
          setWatchingAd(false);
          onRewardEarned?.();
          onClose();
        }}
        onSkip={() => setWatchingAd(false)}
      />
    );
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.icon}>🔒</div>
        <h3 className={styles.title}>{copy.title}</h3>
        <p className={styles.reason}>{reason}</p>
        <p className={styles.hint}>{copy.hint}</p>
        <div className={styles.actions}>
          <button className={styles.upgradeBtn} onClick={onUpgrade}>
            {copy.upgradeBtn}
          </button>
          {showAds && (
            <>
              <p className={styles.adHint}>{copy.adHint}</p>
              <button className={styles.watchAdBtn} onClick={() => setWatchingAd(true)}>
                {copy.watchAdBtn}
              </button>
            </>
          )}
          <button className={styles.closeBtn} onClick={onClose}>
            {copy.closeBtn}
          </button>
        </div>
      </div>
    </div>
  );
}
