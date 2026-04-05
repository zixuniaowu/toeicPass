"use client";

import { useMemo } from "react";
import type { Locale } from "../../types";
import * as api from "../../lib/api";
import { AdBanner as AdBannerBase } from "@toeicpass/ad-system/web";

interface AdBannerProps {
  locale: Locale;
  token: string;
  tenantCode: string;
  slot?: string;
  showAds: boolean;
}

export function AdBanner({ locale, token, tenantCode, slot, showAds }: AdBannerProps) {
  const adApi = useMemo(() => {
    const opts = { token, tenantCode };
    return {
      fetchAds: (s?: string) => api.fetchAds(opts, s),
      recordAdEvent: (id: string, type: string) => api.recordAdEvent(id, type as "impression" | "click" | "dismiss", opts),
    };
  }, [token, tenantCode]);

  return <AdBannerBase locale={locale} showAds={showAds} slot={slot} api={adApi} />;
}
