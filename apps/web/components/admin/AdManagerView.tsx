"use client";

import { useMemo } from "react";
import type { Locale } from "../../types";
import * as api from "../../lib/api";
import { AdManagerView as AdManagerViewBase } from "@toeicpass/ad-system/web";

interface AdManagerViewProps {
  locale: Locale;
  token: string;
  tenantCode: string;
}

export function AdManagerView({ locale, token, tenantCode }: AdManagerViewProps) {
  const adminApi = useMemo(() => {
    const opts = { token, tenantCode };
    return {
      fetchAds: (s?: string) => api.fetchAds(opts, s),
      recordAdEvent: (id: string, type: string) => api.recordAdEvent(id, type as "impression" | "click" | "dismiss", opts),
      fetchAdminAds: () => api.fetchAdminAds(opts),
      fetchAdStats: () => api.fetchAdStats(opts),
      createAd: (data: Record<string, unknown>) => api.createAdPlacement(data as Parameters<typeof api.createAdPlacement>[0], opts),
      updateAd: (id: string, data: Record<string, unknown>) => api.updateAdPlacement(id, data as Parameters<typeof api.updateAdPlacement>[1], opts),
      deleteAd: async (id: string) => { await api.deleteAdPlacement(id, opts); return true; },
    };
  }, [token, tenantCode]);

  return <AdManagerViewBase locale={locale} api={adminApi} />;
}

