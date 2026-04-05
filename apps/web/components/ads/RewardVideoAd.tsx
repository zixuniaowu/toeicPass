"use client";

import { useMemo } from "react";
import type { Locale } from "../../types";
import * as api from "../../lib/api";
import { RewardVideoAd as RewardVideoAdBase } from "@toeicpass/ad-system/web";

interface RewardVideoAdProps {
  locale: Locale;
  token: string;
  tenantCode: string;
  onRewardEarned: () => void;
  onSkip: () => void;
}

export function RewardVideoAd({ locale, token, tenantCode, onRewardEarned, onSkip }: RewardVideoAdProps) {
  const adApi = useMemo(() => {
    const opts = { token, tenantCode };
    return {
      fetchAds: (s?: string) => api.fetchAds(opts, s),
      recordAdEvent: (id: string, type: string) => api.recordAdEvent(id, type as "impression" | "click" | "dismiss", opts),
    };
  }, [token, tenantCode]);

  return <RewardVideoAdBase locale={locale} onRewardEarned={onRewardEarned} onSkip={onSkip} api={adApi} />;
}
