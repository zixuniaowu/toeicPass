"use client";

import { useEffect, useRef, useState } from "react";
import type { AdPlacement } from "../../src/types";
import type { NativeFeedAdProps } from "../types";
import { getAdSenseSlot } from "../lib/ad-provider";
import { GoogleAdUnit } from "./GoogleAdUnit";
import styles from "./NativeFeedAd.module.css";

export function NativeFeedAd({ locale, showAds, api }: NativeFeedAdProps) {
  const [ads, setAds] = useState<AdPlacement[]>([]);
  const impressionSentFor = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!showAds) return;
    impressionSentFor.current.clear();
    void api.fetchAds("native_feed").then(setAds);
  }, [showAds, api]);

  // record impressions for all loaded ads
  useEffect(() => {
    for (const ad of ads) {
      if (impressionSentFor.current.has(ad.id)) continue;
      impressionSentFor.current.add(ad.id);
      void api.recordAdEvent(ad.id, "impression");
    }
  }, [ads, api]);

  if (!showAds) return null;

  if (ads.length === 0) {
    const adsenseSlot = getAdSenseSlot("native_feed");
    if (adsenseSlot) {
      return (
        <div className={styles.nativeAd}>
          <div className={styles.adLabel}>{locale === "ja" ? "広告" : "广告"}</div>
          <GoogleAdUnit slot={adsenseSlot} format="rectangle" style={{ minHeight: 250 }} />
        </div>
      );
    }
    return null;
  }

  const handleClick = (ad: AdPlacement) => {
    void api.recordAdEvent(ad.id, "click");
    if (ad.linkUrl) {
      window.open(ad.linkUrl, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div className={styles.feedList}>
      <div className={styles.adLabel}>{locale === "ja" ? "広告" : "广告"}</div>
      {ads.map((ad) => (
        <div key={ad.id} className={styles.nativeAd} onClick={() => handleClick(ad)}>
          <div className={styles.content}>
            {ad.imageUrl && <img src={ad.imageUrl} alt={ad.title} className={styles.thumb} />}
            <div className={styles.text}>
              <p className={styles.title}>{ad.title}</p>
              {ad.ctaText && <p className={styles.cta}>{ad.ctaText}</p>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
