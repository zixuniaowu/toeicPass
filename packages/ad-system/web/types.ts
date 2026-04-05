// Frontend types for @toeicpass/ad-system/web

import type { AdPlacement, AdStats } from "../src/types";

/** API functions that ad components need — injected by the host app */
export interface AdApiFunctions {
  fetchAds: (slot?: string) => Promise<AdPlacement[]>;
  recordAdEvent: (placementId: string, eventType: string) => Promise<void>;
}

/** Additional admin API functions for AdManagerView */
export interface AdminAdApiFunctions extends AdApiFunctions {
  fetchAdminAds: () => Promise<AdPlacement[]>;
  fetchAdStats: () => Promise<AdStats | null>;
  createAd: (data: Record<string, unknown>) => Promise<AdPlacement | null>;
  updateAd: (adId: string, data: Record<string, unknown>) => Promise<AdPlacement | null>;
  deleteAd: (adId: string) => Promise<boolean>;
}

export interface AdBannerProps {
  locale: "zh" | "ja";
  showAds: boolean;
  slot?: string;
  api: AdApiFunctions;
}

export interface NativeFeedAdProps {
  locale: "zh" | "ja";
  showAds: boolean;
  api: AdApiFunctions;
}

export interface InterstitialAdProps {
  locale: "zh" | "ja";
  showAds: boolean;
  slot?: string;
  autoCloseSeconds?: number;
  onClose: () => void;
  api: AdApiFunctions;
}

export interface RewardVideoAdProps {
  locale: "zh" | "ja";
  onRewardEarned: () => void;
  onSkip: () => void;
  api: AdApiFunctions;
}

export interface AdManagerViewProps {
  locale: "zh" | "ja";
  api: AdminAdApiFunctions;
}

export type { AdPlacement, AdStats };
