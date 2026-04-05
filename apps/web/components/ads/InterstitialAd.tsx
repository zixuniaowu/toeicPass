"use client";

import { useMemo } from "react";
import type { Locale } from "../../types";
import * as api from "../../lib/api";
import { InterstitialAd as InterstitialAdBase } from "@toeicpass/ad-system/web";

interface InterstitialAdProps {
  locale: Locale;
  token: string;
  tenantCode: string;
  showAds: boolean;
  slot?: string;
  autoCloseSeconds?: number;
  onClose: () => void;
}

export function InterstitialAd({ locale, token, tenantCode, showAds, slot, autoCloseSeconds, onClose }: InterstitialAdProps) {
  const adApi = useMemo(() => {
    const opts = { token, tenantCode };
    return {
      fetchAds: (s?: string) => api.fetchAds(opts, s),
      recordAdEvent: (id: string, type: string) => api.recordAdEvent(id, type as "impression" | "click" | "dismiss", opts),
    };
  }, [token, tenantCode]);

  return (
    <InterstitialAdBase
      locale={locale}
      showAds={showAds}
      slot={slot}
      autoCloseSeconds={autoCloseSeconds}
      onClose={onClose}
      api={adApi}
    />
  );
}
