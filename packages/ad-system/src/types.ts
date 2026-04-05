// ===== Ad System Shared Types =====

export type AdSlot = "banner_top" | "interstitial" | "native_feed" | "reward_video";

export type AdEventType = "impression" | "click" | "dismiss" | "reward_complete";

export interface AdPlacement {
  id: string;
  slot: AdSlot;
  title: string;
  imageUrl?: string;
  linkUrl: string;
  ctaText: string;
  priority: number;
  targetPlans: string[];
  isActive: boolean;
  impressions: number;
  clicks: number;
  startsAt?: string;
  expiresAt?: string;
  createdAt: string;
}

export interface AdEvent {
  id: string;
  placementId: string;
  userId?: string;
  eventType: AdEventType;
  createdAt: string;
}

export interface AdStats {
  totalPlacements: number;
  activePlacements: number;
  totalImpressions: number;
  totalClicks: number;
  ctr: number;
  bySlot: Record<string, { count: number; impressions: number; clicks: number }>;
  recentEvents: Array<{ id: string; placementId: string; eventType: string; createdAt: string }>;
}

// ===== Store Interface (host app implements this) =====

export interface IAdStore {
  adPlacements: AdPlacement[];
  adEvents: AdEvent[];
  persistSnapshot(): void;
}

// ===== Service Configuration =====

export interface AdServiceConfig {
  /** Function to generate unique IDs. Default: crypto.randomUUID() */
  generateId?: () => string;
  /** Function to get current ISO timestamp. Default: new Date().toISOString() */
  nowIso?: () => string;
}

// ===== DTO shapes (plain objects — host app adds validation decorators) =====

export interface CreateAdInput {
  slot: string;
  title: string;
  imageUrl?: string;
  linkUrl: string;
  ctaText: string;
  priority: number;
  targetPlans: string[];
  startsAt?: string;
  expiresAt?: string;
}

export interface UpdateAdInput {
  slot?: string;
  title?: string;
  imageUrl?: string;
  linkUrl?: string;
  ctaText?: string;
  priority?: number;
  targetPlans?: string[];
  isActive?: boolean;
  startsAt?: string;
  expiresAt?: string;
}

export interface RecordAdEventInput {
  placementId: string;
  eventType: AdEventType;
}
