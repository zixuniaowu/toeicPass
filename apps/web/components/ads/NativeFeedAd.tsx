"use client";

import { useMemo } from "react";
import type { Locale } from "../../types";
import * as api from "../../lib/api";
import { NativeFeedAd as NativeFeedAdBase } from "@toeicpass/ad-system/web";

interface NativeFeedAdProps {
  locale: Locale;
  token: string;
  tenantCode: string;
  showAds: boolean;
}

export function NativeFeedAd({ locale, token, tenantCode, showAds }: NativeFeedAdProps) {
  const adApi = useMemo(() => {
    const opts = { token, tenantCode };
    return {
      fetchAds: (s?: string) => api.fetchAds(opts, s),
      recordAdEvent: (id: string, type: string) => api.recordAdEvent(id, type as "impression" | "click" | "dismiss", opts),
    };
  }, [token, tenantCode]);

  return <NativeFeedAdBase locale={locale} showAds={showAds} api={adApi} />;
}
