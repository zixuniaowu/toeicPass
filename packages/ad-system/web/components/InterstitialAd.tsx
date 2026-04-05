"use client";

import { useEffect, useRef, useState } from "react";
import type { AdPlacement } from "../../src/types";
import type { InterstitialAdProps } from "../types";
import styles from "./InterstitialAd.module.css";

const COPY = {
  zh: {
    adLabel: "广告",
    closeIn: (s: number) => `${s}秒后可关闭`,
    close: "关闭",
    learnMore: "了解更多",
  },
  ja: {
    adLabel: "広告",
    closeIn: (s: number) => `${s}秒後に閉じられます`,
    close: "閉じる",
    learnMore: "詳細を見る",
  },
} as const;

export function InterstitialAd({
  locale,
  showAds,
  slot = "interstitial",
  autoCloseSeconds = 5,
  onClose,
  api,
}: InterstitialAdProps) {
  const [ad, setAd] = useState<AdPlacement | null>(null);
  const [countdown, setCountdown] = useState(autoCloseSeconds);
  const impressionSent = useRef(false);
  const copy = COPY[locale];

  useEffect(() => {
    if (!showAds) { onClose(); return; }
    void api.fetchAds(slot).then((ads) => {
      if (ads.length > 0) setAd(ads[0]);
      else onClose();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAds, slot]);

  useEffect(() => {
    if (!ad || impressionSent.current) return;
    impressionSent.current = true;
    void api.recordAdEvent(ad.id, "impression");
  }, [ad, api]);

  useEffect(() => {
    if (!ad || autoCloseSeconds === 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [ad, autoCloseSeconds]);

  if (!showAds || !ad) return null;

  const handleClick = () => {
    void api.recordAdEvent(ad.id, "click");
    if (ad.linkUrl) {
      window.open(ad.linkUrl, "_blank", "noopener,noreferrer");
    }
  };

  const handleClose = () => {
    void api.recordAdEvent(ad.id, "dismiss");
    onClose();
  };

  const canClose = countdown === 0;

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <span className={styles.adLabel}>{copy.adLabel}</span>
          {canClose ? (
            <button className={styles.closeBtn} onClick={handleClose}>{copy.close}</button>
          ) : (
            <span className={styles.countdown}>{copy.closeIn(countdown)}</span>
          )}
        </div>

        <div className={styles.adContent} onClick={handleClick}>
          {ad.imageUrl ? (
            <img src={ad.imageUrl} alt={ad.title} className={styles.image} />
          ) : (
            <div className={styles.textContent}>
              <h3 className={styles.title}>{ad.title}</h3>
              {ad.ctaText && <p className={styles.cta}>{ad.ctaText}</p>}
            </div>
          )}
        </div>

        <button className={styles.learnMoreBtn} onClick={handleClick}>
          {copy.learnMore}
        </button>
      </div>
    </div>
  );
}
