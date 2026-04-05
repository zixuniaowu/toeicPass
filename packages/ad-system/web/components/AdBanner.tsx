"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AdPlacement } from "../../src/types";
import type { AdBannerProps } from "../types";
import { getAdSenseSlot } from "../lib/ad-provider";
import { GoogleAdUnit } from "./GoogleAdUnit";
import styles from "./AdBanner.module.css";

const ROTATE_INTERVAL = 5000;

export function AdBanner({ locale, showAds, slot = "banner_top", api }: AdBannerProps) {
  const [ads, setAds] = useState<AdPlacement[]>([]);
  const [index, setIndex] = useState(0);
  const impressionSentFor = useRef<Set<string>>(new Set());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!showAds) return;
    impressionSentFor.current.clear();
    void api.fetchAds(slot).then((list) => {
      setAds(list);
      setIndex(0);
    });
  }, [showAds, slot, api]);

  const ad = ads[index] ?? null;

  // record impression for current ad
  useEffect(() => {
    if (!ad || impressionSentFor.current.has(ad.id)) return;
    impressionSentFor.current.add(ad.id);
    void api.recordAdEvent(ad.id, "impression");
  }, [ad, api]);

  // auto-rotate
  useEffect(() => {
    if (ads.length <= 1) return;
    timerRef.current = setInterval(() => {
      setIndex((prev) => (prev + 1) % ads.length);
    }, ROTATE_INTERVAL);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [ads.length]);

  const goTo = useCallback((i: number) => {
    setIndex(i);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setIndex((prev) => (prev + 1) % ads.length);
    }, ROTATE_INTERVAL);
  }, [ads.length]);

  if (!showAds) return null;

  if (ads.length === 0) {
    const adsenseSlot = getAdSenseSlot("banner_top");
    if (adsenseSlot) {
      return (
        <div className={styles.banner}>
          <GoogleAdUnit slot={adsenseSlot} format="horizontal" style={{ minHeight: 90 }} />
          <span className={styles.adLabel}>{locale === "ja" ? "広告" : "广告"}</span>
        </div>
      );
    }
    return null;
  }

  if (!ad) return null;

  const handleClick = () => {
    void api.recordAdEvent(ad.id, "click");
    if (ad.linkUrl) {
      window.open(ad.linkUrl, "_blank", "noopener,noreferrer");
    }
  };

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    void api.recordAdEvent(ad.id, "dismiss");
    const next = ads.filter((_, i) => i !== index);
    setAds(next);
    setIndex((prev) => (prev >= next.length ? 0 : prev));
  };

  return (
    <div className={styles.carouselWrap}>
      <div className={styles.banner} onClick={handleClick}>
        {ad.imageUrl ? (
          <img src={ad.imageUrl} alt={ad.title} className={styles.image} />
        ) : (
          <div className={styles.textAd}>
            <p className={styles.title}>{ad.title}</p>
            {ad.ctaText && <p className={styles.body}>{ad.ctaText}</p>}
          </div>
        )}
        <button className={styles.dismiss} onClick={handleDismiss} title={locale === "ja" ? "閉じる" : "关闭"}>✕</button>
        <span className={styles.adLabel}>{locale === "ja" ? "広告" : "广告"}</span>
      </div>
      {ads.length > 1 && (
        <div className={styles.dots}>
          {ads.map((_, i) => (
            <button
              key={i}
              className={`${styles.dot} ${i === index ? styles.dotActive : ""}`}
              onClick={() => goTo(i)}
              aria-label={`Ad ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
